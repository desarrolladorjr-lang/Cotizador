# Órdenes de Compra Directa (2° tipo de OC) — Design

**Fecha:** 2026-07-03
**Estado:** Aprobado
**Fase:** única (captura + impresión, sin historial)

## Objetivo

Nueva sección en el dashboard para generar el segundo tipo de orden de compra que hoy se arma a mano en Excel (ej. `OC696 RODRIGO CALDERA.xlsx`): compra a un proveedor persona física con esquema back-to-back — la misma mercancía se compra bajo una entidad legal (Entidad A) y se revende con margen bajo otra entidad legal (Entidad B), generando dos documentos OC imprimibles por operación.

Esta sección es independiente de la ya existente "Órdenes de Compra" (`OrdenesCompra.tsx`, fuente `COMPRAS`), que sigue sin cambios. Ambas conviven como dos tipos de OC distintos en el dashboard.

## Diferencias clave vs. el tipo existente

| | Órdenes de Compra (existente) | Órdenes de Compra Directa (nuevo) |
|---|---|---|
| Fuente de datos | Hoja `COMPRAS`, ya poblada | Formulario de captura manual |
| Flujo | Solo lectura/impresión | Captura + cálculo + impresión |
| Partes | 1 proveedor, 1 comprador | Proveedor → Entidad A (compra) → Entidad B (revende) |
| Fiscal | No aplica | RFC, régimen, IVA, retención, clave SAT |
| Persistencia | N/A (ya vive en el sheet) | Ninguna — no se guarda historial |

## Flujo de negocio

1. Proveedor (persona física) vende material.
2. Entidad A lo compra — este es el documento "de compra" (precio real).
3. Entidad B lo revende con margen % aplicado — documento "de reventa" (precio + margen), mismas líneas de material.
4. Se generan e imprimen ambos documentos para la misma operación.

## Catálogos (fuente de datos)

Nueva hoja de catálogos en el spreadsheet de logística existente (mismo spreadsheet que `COMPRAS`), ej. tab `CONCEPTOS`, editable por el usuario sin tocar código:

- **Materiales → clave SAT**: columnas `MATERIAL`, `CLAVE SAT`.
- **Entidades emisoras** (2 listas independientes, una para "compra" y otra para "reventa"): `NOMBRE`, `RFC`, `DIRECCION`, `REGIMEN`.
- **Proveedores**: lista de nombres.
- **Métodos de pago** y **formas de pago**: listas de opciones para dropdown.

### `dashboard/src/lib/ordenesDirectasCatalogo.ts`

- Lee el tab de catálogos con el mismo patrón de mapeo por encabezado ya usado en `ordenesClient.ts` / `pipelineClient.ts` (tolera reorden de columnas).
- Expone:

```ts
interface EntidadFiscal {
  nombre: string;
  rfc: string;
  direccion: string;
  regimen: string;
}

interface CatalogoOrdenDirecta {
  materiales: { material: string; claveSat: string }[];
  entidadesCompra: EntidadFiscal[];
  entidadesReventa: EntidadFiscal[];
  proveedores: string[];
  metodosPago: string[];
  formasPago: string[];
}
```

- Cache en memoria con TTL (mismo estilo que `feedCache`).

### `dashboard/src/app/api/ordenes-directas/catalogo/route.ts`

- `GET`, protegido con `verifyGoogleToken`.
- Responde `{ catalogo: CatalogoOrdenDirecta }`.

## Formulario de captura

### `dashboard/src/components/OrdenDirectaForm.tsx`

Estado propio del formulario (no persiste a ningún backend — todo vive en memoria del componente hasta imprimir):

**Encabezado:**
- Folio: input numérico para el consecutivo (ej. `696`), manual — sin autonumérico (no hay historial de donde derivarlo).
- Checkbox **"Entra a Monterrey"**:
  - Desmarcado (default): segundo segmento del folio = texto fijo `"Directo"`, no editable. Folio resultante: `OC.696/Directo`.
  - Marcado: segundo segmento = input de texto libre para que la persona de MTY escriba su propio consecutivo (ej. `E641`). Folio resultante: `OC.696/E641`.
- Fecha: date picker, default hoy.
- Proveedor: dropdown desde catálogo `proveedores`.
- Entidad A (compra): dropdown desde `entidadesCompra` → autocompleta RFC, dirección, régimen (solo lectura, mostrados como referencia).
- Entidad B (reventa): dropdown desde `entidadesReventa` → autocompleta igual.
- Método de pago, forma de pago: dropdowns desde catálogo.
- Retención IVA: sí/no (afecta cálculo de precio unitario).
- Margen %: input numérico (ej. `3` → 3%), aplica a la entidad B.

**Líneas de material** (agregar/quitar filas, mínimo 1):
- Material: dropdown desde catálogo `materiales` → autocompleta clave SAT (solo lectura).
- Cantidad (kg).
- Unidad (default `KGM`).
- Precio neto: input numérico (precio con IVA incluido, tal como se negocia con el proveedor).

**Cálculo en vivo** (por línea y totales), replicando las fórmulas del Excel:
- `precioUnitario = retencion === 'NO' ? precioNeto / 1.16 : precioNeto`
- `importeCompra = cantidad * precioUnitario`
- `precioUnitarioReventa = precioUnitario + (precioUnitario * margen / 100)`
- `importeReventa = cantidad * precioUnitarioReventa`
- `subtotalCompra = suma(importeCompra)`, `ivaCompra = subtotalCompra * 0.16`, `ivaRetCompra = retencion === 'NO' ? 0 : ivaCompra`, `totalCompra = subtotalCompra + ivaCompra - ivaRetCompra`
- Igual para reventa con los importes de reventa.
- `importeEnLetras`: convertidor número→palabras en español/MXN, reimplementado en TS (`dashboard/src/lib/numeroALetras.ts`), sin depender de la hoja `Pesos` del Excel ni de fórmulas array.

### Validación mínima

- Cantidad y precio neto deben ser numéricos > 0 para calcular; si falta alguno, la línea se marca incompleta y no se incluye en el documento impreso hasta corregirse.
- Proveedor, Entidad A, Entidad B son obligatorios para habilitar impresión.

## Documentos imprimibles

Dos vistas, mismo formato visual que `OrdenPrint.tsx` (barra naranja, logo SIDELL, fondo blanco, tabla con header negro, notas/condiciones, firmas):

### `dashboard/src/components/OrdenDirectaPrint.tsx`

Componente único parametrizado por `lado: 'compra' | 'reventa'`:
- Header: folio completo, fecha, entidad emisora (A o B según lado), datos fiscales (RFC, dirección, régimen), proveedor.
- Tabla: clave SAT, cantidad, unidad, descripción, precio unitario, importe (usando los valores de compra o reventa según `lado`).
- Subtotal, IVA 16%, IVA retenido, total, importe en letras.
- Notas/condiciones de pago: método, forma, condiciones — mismo bloque de texto fijo del Excel (recepción sujeta a inspección, mermas, horario, pago contra recepción de documentos, etc., ajustado a este tipo de OC).
- Firmas: comprador / vendedor.

### Vista combinada

`OrdenDirectaForm.tsx`, tras capturar y validar, muestra ambos documentos uno debajo del otro con:
- Botón "Imprimir / Guardar PDF" por cada uno (usa `window.print()` con CSS `@media print` que aísla solo el documento activo, mismo patrón ya usado).
- Botón "← Editar" para volver al formulario sin perder los datos capturados (estado se mantiene en memoria).

## Sin persistencia

- No hay endpoint `POST` que escriba a ningún sheet. Si el usuario recarga la página o cierra la pestaña, los datos capturados se pierden — comportamiento esperado por ahora.
- No hay historial ni búsqueda de OCs Directas pasadas.

## Navegación

- Nuevo `SectionId` `'ordenes-directas'` en `dashboard/src/app/page.tsx`, entrada en el sidebar: label "OC Directa", sub "Compra y reventa a proveedor individual".
- Sin contador en el nav (no hay lista, es un formulario).

## Manejo de errores

- Falla al cargar catálogo → mensaje "No se pudieron cargar los catálogos" + botón reintentar (mismo patrón que el feed).
- Token inválido/ausente → 401 del API route, mismo manejo que las rutas existentes.

## Testing

Vitest:
- `ordenesDirectasCatalogo.test.ts`: mapeo por encabezado con columnas reordenadas, parsing de las 2 listas de entidades, materiales, proveedores, métodos/formas de pago.
- `api/ordenes-directas/catalogo/route.test.ts`: 401 sin token, respuesta feliz, error de Sheets → respuesta de error.
- `numeroALetras.test.ts`: casos representativos (miles, millones, centavos, singular "PESO" vs "PESOS", "CIEN" vs "CIENTO").
- `OrdenDirectaForm.test.tsx`: cálculo de precio unitario con/sin retención, cálculo de margen en reventa, folio con/sin checkbox MTY, validación de líneas incompletas.
- Verificación manual: `npm run dev`, capturar una OC completa, comparar cálculos lado a lado contra el Excel `OC696 RODRIGO CALDERA.xlsx`, probar ambos folios (Directo / MTY), imprimir ambos documentos.

## Fuera de alcance

- Historial y consecutivo automático de folio (queda manual hasta que se defina un esquema de persistencia).
- Edición/reimpresión de OCs Directas ya cerradas (no hay guardado, no aplica).
