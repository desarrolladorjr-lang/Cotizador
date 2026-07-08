# Modo "Compras" en Nacional — Design Spec
Date: 2026-06-13

## Overview

Agregar un tercer modo en el tab **Nacional**, junto a "Back to Back" y "Simular": **"Compras"**.

Compras permite registrar una compra de mercado (sin cliente/contrato ligado) marcando tres flags informativos (Para Inventarios, Intención de Venta, Intención de Compra) y comprando el mismo material a **varios proveedores**, cada uno con su propia cantidad de cargas.

Reutiliza el motor de cálculo y el flujo de guardado existentes (igual a Back to Back/normal), solo cambia el bloque Proveedor/Cargas y agrega los flags.

## Alcance

- Solo aplica al tab **Nacional**. Terrestre y Marítimo mantienen el toggle de 2 botones (Back to Back / Simular) sin cambios.
- No afecta el modo Inventarios (tab separado, rama `inventarios` de doPost intacta).
- No afecta cálculo de tope/utilidad ni el motor Simulador.

## Frontend — index.html

### Estado nuevo

```javascript
const [modoCompras, setModoCompras] = useState(false);
const [paraInventarios, setParaInventarios] = useState(false);
const [intencionVenta, setIntencionVenta] = useState(false);
const [intencionCompra, setIntencionCompra] = useState(false);
const [comprasProveedores, setComprasProveedores] = useState([
  { proveedor: optionsProveedorNacional[0], cargas: "1" }
]);
```

### Toggle (3 botones, solo en Nacional)

Estructura del toggle actual (líneas ~940-974) se extiende: si `activeTab === 'nacional'`, se muestra un tercer botón "Compras" a la derecha de "Simular".

- Click en "Back to Back": `setCompraDirecta(true); setModoSimulador(false); setModoCompras(false);` (+ fetch pendientes como hoy)
- Click en "Simular": `setModoSimulador(true); setCompraDirecta(false); setModoCompras(false);` (+ limpiezas existentes de cruceInt/rutaInt)
- Click en "Compras" (nuevo):
  ```javascript
  setModoCompras(true);
  setCompraDirecta(false);
  setModoSimulador(false);
  setCruceInt("0");
  setRutaIntSelect('');
  ```
- Color botón "Compras": verde `#16a34a` / borde `#15803d` (mismo patrón visual que los otros dos).

### Reset al salir de Compras

Al activar Back to Back o Simular desde Compras (o cambiar de tab):
```javascript
setModoCompras(false);
setParaInventarios(false);
setIntencionVenta(false);
setComprasProveedores([{ proveedor: optionsProveedorNacional[0], cargas: "1" }]);
```
Mismo `useEffect` de reset que ya limpia `contrato` al cambiar `activeTab` (línea ~415) se extiende para incluir esto.

### Checkboxes "Para Inventarios" / "Intención de Venta" / "Intención de Compra"

Visibles solo si `modoCompras === true`. Se colocan junto al toggle, antes del selector de Cliente/Material. Tres checkboxes independientes, estilo simple (label + input checkbox), default sin marcar.

### Cliente oculto

Si `modoCompras === true`, el bloque/selector de Cliente no se renderiza. `cliente` se guarda como `''` en el payload (igual patrón que `contrato: ''` cuando `compraDirecta` es false).

`currentClientes`/`currentMaterial`/`currentDestino` para Nacional en modo Compras usan las listas normales (`optionsClientesNacional` no aplica porque cliente está oculto; `optionsMaterialNacional`, `optionsDestinoNacional` se usan igual que en Simular).

### Bloque Multi-Proveedor (reemplaza Proveedor + Cargas)

Cuando `modoCompras === true`, el bloque "Proveedor" + "Cargas" (líneas ~1222-1258, sección "Datos Informativos") se reemplaza por una lista dinámica:

```jsx
{comprasProveedores.map((row, i) => (
  <div key={i} className="flex items-center gap-1">
    <select value={row.proveedor} onChange={e => updateComprasProveedor(i, 'proveedor', e.target.value)}>
      {optionsProveedorNacional.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
    <input type="number" step="0.5" value={row.cargas} onChange={e => updateComprasProveedor(i, 'cargas', e.target.value)} />
    {comprasProveedores.length > 1 && (
      <button onClick={() => removeComprasProveedor(i)}>✕</button>
    )}
  </div>
))}
<button onClick={addComprasProveedor}>+ Agregar proveedor</button>
```

Helpers:
```javascript
const updateComprasProveedor = (i, field, value) => {
  setComprasProveedores(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
};
const addComprasProveedor = () => {
  setComprasProveedores(prev => [...prev, { proveedor: optionsProveedorNacional[0], cargas: "1" }]);
};
const removeComprasProveedor = (i) => {
  setComprasProveedores(prev => prev.filter((_, idx) => idx !== i));
};
```

### visualKg en modo Compras

`visualKg` (mostrado junto al input de cargas) = suma de `cargas` de todas las filas × 24500.

### Modo normal (no Compras)

El bloque Proveedor + Cargas actual (single `proveedor`/`cargas`) sigue igual cuando `modoCompras === false`, sin cambios.

## Payload — handleGuardarCotizacion

Cuando `modoCompras === true`:

```javascript
proveedor: modoCompras
  ? comprasProveedores.map(r => `${r.proveedor}: ${r.cargas}`).join(', ')
  : proveedor,

cargas: modoCompras
  ? comprasProveedores.reduce((sum, r) => sum + (Number(r.cargas) || 0), 0)
  : Number(cargas),

cliente: modoCompras ? '' : cliente,
contrato: compraDirecta ? contrato : '',

tipoCompra: compraDirecta ? 'Back to Back' : modoCompras ? 'Compra Mercado' : 'Compra Inventarios',

paraInventarios: modoCompras ? paraInventarios : false,
intencionVenta: modoCompras ? intencionVenta : false,
intencionCompra: modoCompras ? intencionCompra : false,
```

Ejemplo de `proveedor` resultante: `"CALDERA: 2, LALO: 1.5"`.

## Backend — Codigo.gs

### `doPost` — nuevas columnas V, W y X

La rama no-inventarios escribe hoy columnas A–U (20 + contrato = 21, índices 0–20). Se agregan 3 columnas nuevas al final:

```javascript
row = [
  data.fecha, data.usuario, data.cliente, data.proveedor, data.cargas,
  data.material, data.destino, data.porcentajeFijacion, data.fixPrice,
  data.precioVenta, data.tcHoy, data.tcSeguro, data.fleteNac, data.cruceInt,
  data.precioTopeCompra, data.ppProv, data.status, data.utilidadNeta,
  data.tipoCompra, data.notas, data.contrato || '',
  data.paraInventarios ? 'Sí' : 'No',   // col V — Para Inventarios
  data.intencionVenta ? 'Sí' : 'No',    // col W — Intención de Venta
  data.intencionCompra ? 'Sí' : 'No'    // col X — Intención de Compra
];
```

La rama `inventarios` no cambia.

**Deploy:** redeploy del Web App tras editar (acceso "Anyone", igual que hoy).

## Hojas de cálculo (manual)

Agregar encabezados **"Para Inventarios"** (col V), **"Intención Venta"** (col W) e **"Intención Compra"** (col X) en las hojas `Terrestre`, `Marítimo`, `Nacional`. (Paso manual del usuario, una vez.)

## Qué NO cambia

- Modo Inventarios (tab y rama doPost intactos).
- Motor de cálculo (precioTope, utilidad, tcSeguro) y motor Simulador.
- Toggle de Terrestre/Marítimo: 2 botones (Back to Back / Simular), sin "Compras".
- Flujo Back to Back / N° Contrato (spec 2026-06-04) intacto.
- Auth (Google Sign-In).

## Referencia de columnas (0-based) — hojas destino Terrestre/Marítimo/Nacional

| Col | Índice | Campo |
|-----|--------|-------|
| U | 20 | N° Contrato |
| V | 21 | Para Inventarios |
| W | 22 | Intención de Venta |
| X | 23 | Intención de Compra |
