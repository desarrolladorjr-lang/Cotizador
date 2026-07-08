# Ligar N° Contrato en Back to Back — Design Spec
Date: 2026-06-04

## Overview

En modo **Back to Back**, cuando una compra se liga a un pedido pendiente, el usuario elige el contrato específico al que se liga. El número de contrato (columna D de la hoja fuente) se guarda en la hoja de cotización junto con el trato.

Esto extiende el modo Back to Back ya existente (antes "Compra Directa"). No es un modo nuevo.

## Data Source

**Spreadsheet:** `14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc` (la misma en uso)

**Hojas fuente (pendientes):** `TERRESTRES`, `MARÍTIMO`
- N° de contrato = columna **D** (índice 3, 0-based)
- CLIENT = col 0 (A), MATERIAL = col 4 (E) — ya en uso

**Hojas destino (cotización guardada):** `Terrestre`, `Marítimo`, `Nacional`

## Backend — Codigo.gs

### `doGet` — agregar contrato a cada pendiente

Hoy `doGet` devuelve por pendiente `{ client, material }`, deduplicado por `client|material`.

Cambios:
- Leer columna D (`row[3]`) como `contrato`.
- Incluir `contrato` en cada objeto: `{ client, material, contrato }`.
- Cambiar la clave de dedup de `client|material` a `client|material|contrato`. Así varios contratos del mismo cliente+material aparecen como entradas distintas.
- Aplicar idéntico a TERRESTRES y MARÍTIMO.
- Mantener exclusiones existentes (`!client`, `client === 'INVENTARIO'`, `estWeight <= 1`).
- Convertir contrato a String: `String(contrato)`.

### `doPost` — guardar contrato en la fila

La fila no-inventarios hoy escribe 20 columnas (A–T), terminando en `data.notas`.

Cambio: agregar `data.contrato` como columna **U** (nueva, al final del array `row`):

```javascript
row = [
  data.fecha, data.usuario, data.cliente, data.proveedor, data.cargas,
  data.material, data.destino, data.porcentajeFijacion, data.fixPrice,
  data.precioVenta, data.tcHoy, data.tcSeguro, data.fleteNac, data.cruceInt,
  data.precioTopeCompra, data.ppProv, data.status, data.utilidadNeta,
  data.tipoCompra, data.notas,
  data.contrato || ''   // col U — N° Contrato (vacío en modo normal)
];
```

La rama `inventarios` no cambia.

**Deploy:** redeploy del Web App tras editar (acceso "Anyone", igual que hoy).

## Hojas de cálculo (manual)

Agregar encabezado **"N° Contrato"** en columna U de las hojas `Terrestre`, `Marítimo`, `Nacional`. (Paso manual del usuario, una vez.)

## Frontend — index.html

### Estado nuevo

```javascript
const [contrato, setContrato] = useState('');
```

### 3er dropdown "N° Contrato"

Visible solo cuando `compraDirecta === true` (Back to Back), tras elegir cliente+material.

Opciones = contratos únicos de `tabPendientes` filtrados por cliente+material seleccionados:

```javascript
const currentContratos = compraDirecta && tabPendientes.length > 0
  ? [...new Set(tabPendientes
      .filter(p => p.material === material && p.client === cliente)
      .map(p => p.contrato))]
  : [];
```

- Si `currentContratos.length === 1` → auto-seleccionar (set `contrato` en un `useEffect` que dependa de cliente+material).
- Si cambia cliente o material → resetear `contrato`.
- Estilo: igual a los dropdowns existentes.

### Payload

Agregar al objeto `payload` en `handleGuardarCotizacion`:

```javascript
contrato: compraDirecta ? contrato : '',
```

### Reset

- Salir de Back to Back → `setContrato('')`.
- Cambio de tab estando en Back to Back → `setContrato('')`.

## Error handling

- Si `contrato` queda vacío en Back to Back (sin contratos cargados): se guarda vacío, no bloquea. (Mismo criterio laxo del flujo actual.)
- `doGet` con error de red: ya manejado (fallback a listas normales, mensaje "No se pudieron cargar pendientes").

## Qué NO cambia

- Modo Inventarios (rama `inventarios` de doPost intacta).
- Hoja fuente TERRESTRES/MARÍTIMO: solo lectura, no se marca ni modifica.
- Motor de cálculo (precioTope, utilidad, tcSeguro).
- Auth (Google Sign-In).
- Modo normal: `contrato` siempre vacío.

## Referencia de columnas (0-based)

| Hoja | CLIENT | CONTRATO | MATERIAL | EST_WEIGHT (filtro pendiente) |
|------|--------|----------|----------|-------------------------------|
| TERRESTRES | 0 (A) | 3 (D) | 4 (E) | 7 (H) |
| MARÍTIMO | 0 (A) | 3 (D) | 4 (E) | 12 (M) |

Filtro "pendiente" actual en doGet: `estWeight <= 1` se excluye (no `INVOICE`).

Fila destino — nueva col **U (índice 20)** = N° Contrato.
