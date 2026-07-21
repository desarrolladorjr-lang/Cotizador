# Persistencia y "Ver Orden de Compra" para OC generada desde instrucción (Pipeline Compras)

**Fecha:** 2026-07-21
**Estado:** Aprobado
**Extiende:** `2026-07-21-generar-oc-desde-instruccion-design.md` (revierte explícitamente su
decisión "fuera de alcance: sin persistencia en ningún backend")

## Contexto

`2026-07-21-generar-oc-desde-instruccion-design.md` implementó el botón "Generar Orden de
Compra" en `OpDrawer.tsx` (visible solo en etapa `instruccion` de operaciones Compras), que
abre `OcSimpleForm` dentro de `GenerarOcModal` y genera un documento `OrdenPrint` para
imprimir/guardar como PDF. Esa versión decidió explícitamente NO persistir el documento en
ningún backend — se genera, se imprime, se cierra, y los datos capturados se pierden.

El usuario ahora pide: una vez generada la OC, el botón "Generar Orden de Compra" debe
convertirse en "Ver Orden de Compra", que reabre el documento completo tal como se generó.
Esto requiere persistir los datos capturados.

## Objetivo

1. Al generar una OC desde este flujo, guardar los datos capturados (`OrdenCompra`) en
   Dropbox, identificados por el `opId` del registro de pipeline (estable, no depende de lo
   que el usuario escriba en "No. OC").
2. En el drawer, si ya existe una OC guardada para ese `opId`, mostrar botón "Ver Orden de
   Compra" en vez de "Generar Orden de Compra" — visible en cualquier etapa del pipeline
   (no solo `instruccion`), ya que es un documento ya emitido que debe poder consultarse
   después.
3. "Ver" reabre el documento completo (`OrdenPrint` con los mismos datos), no solo el folio.
   Reutiliza la vista de documento que `OcSimpleForm` ya tiene (incluye "← Editar" y
   "Imprimir / Guardar PDF"); si el usuario edita y vuelve a "Generar documento", se
   sobrescribe la copia guardada.

No se guarda snapshot de imagen (PNG) — solo el JSON de datos. `OrdenPrint` se re-renderiza
en vivo a partir de esos datos, siempre fiel al diseño actual del componente.

## Diseño

### Backend

#### `dashboard/src/lib/dropboxClient.ts`
Sin cambios — se reutiliza tal cual (`uploadFile`, `downloadFile`, ya soporta cualquier
path/carpeta).

#### Carpeta Dropbox
Nueva subcarpeta bajo `DROPBOX_FOLDER` (o una carpeta dedicada vía nueva env si se prefiere
mantener separado de Órdenes Directas): `/Ordenes de Compra/Pipeline/<opId>.json`. Contenido:
el objeto `OrdenCompra` (`{ numero, fecha, proveedor, negociacion, estatus, lineas, total }`)
serializado como JSON, `content-type: application/json`.

#### `GET /api/oc-pipeline/[opId]`
- Auth: `Authorization: Bearer` + `verifyGoogleCredential` (patrón existente en
  `/api/ordenes-directas/*`).
- Descarga `Pipeline/<opId>.json` de Dropbox, parsea, responde `{ orden: OrdenCompra }`.
- Si el archivo no existe (Dropbox `not_found`) → `404 { error: 'no_encontrada' }` (no es un
  error real, es la señal de "aún no generada" que usa el frontend).
- Dropbox no configurado → `503 { error: 'dropbox_no_configurado' }`.
- Sin auth → `401`.

#### `POST /api/oc-pipeline/guardar`
- Auth: igual patrón.
- Body: `{ opId: string; orden: OrdenCompra }`.
- Valida `opId` no vacío y `orden.numero`/`orden.proveedor` no vacíos (mismo criterio mínimo
  que ya aplica `OcSimpleForm` para habilitar "Generar documento").
- Sube `Pipeline/<opId>.json` (overwrite). Responde `{ ok: true }`.
- Dropbox no configurado → `503`. Sin auth → `401`.

### Frontend

#### `OpDrawer.tsx`
- Nuevo estado `ocExistente: OrdenCompra | null` (default `null`).
- `useEffect` (dispara cuando `esCompras` es true y hay `opId` válido, una vez por montaje
  del drawer): `GET /api/oc-pipeline/[opId]`. 200 → `setOcExistente(orden)`. 404 →
  `setOcExistente(null)`. Otros errores → se ignoran silenciosamente para esta detección
  (no bloquean el drawer; el usuario puede reintentar con el botón normal si aplica).
- Reemplaza el bloque del botón (líneas 252–256 actuales):
  - `ocExistente` truthy → botón **"Ver Orden de Compra"** (visible sin importar `record.etapa`),
    `onClick` → `setShowOcModal(true)` con modal en modo "ver" (pasa `ordenInicial={ocExistente}`).
  - `ocExistente === null && record.etapa === 'instruccion'` → botón **"Generar Orden de
    Compra"** (como hoy, sin `ordenInicial`).
  - Ningún otro caso → sin botón.
- `guardarNoPO` (línea 161) se renombra conceptualmente a `guardarOc` y cambia de firma:
  recibe `orden: OrdenCompra` completa (antes recibía solo `numero: string`). Internamente:
  1. PATCH del registro con `noPO: orden.numero` (igual que hoy).
  2. `POST /api/oc-pipeline/guardar { opId: record.opId, orden }`.
  3. Si el POST falla, error se muestra igual que hoy (prop `error` del modal); el PATCH de
     `noPO` no se revierte (falla parcial aceptable, igual que otros flujos del drawer —
     usuario puede reintentar generando de nuevo).
  4. Éxito → `setOcExistente(orden)` (para que sin recargar el drawer ya muestre "Ver" si se
     vuelve a abrir el modal) y cierra el modal.

#### `GenerarOcModal.tsx`
- Nueva prop opcional `ordenInicial?: OrdenCompra`, se pasa tal cual a `OcSimpleForm`. Sin
  cambios de red (sigue sin llamar red directamente).

#### `OcSimpleForm.tsx`
- Nueva prop opcional `ordenInicial?: OrdenCompra`.
- Si `ordenInicial` está presente: el estado interno (`numero`, `fecha`, `negociacion`,
  `proveedor`, `lineas`) se inicializa desde ella y el componente arranca directo en la
  **vista de documento** (salta la vista de captura). El resto del comportamiento no cambia:
  "← Editar" regresa a captura con esos datos precargados, "Imprimir / Guardar PDF" igual,
  y si el usuario edita y vuelve a pulsar "Generar documento", se reconstruye el objeto
  `OrdenCompra` y se llama `onGenerado(orden)` de nuevo (sobrescribe lo guardado, vía
  `guardarOc` en `OpDrawer`).
- `onGenerado` cambia de firma: `(orden: OrdenCompra) => void` (antes `(numero: string) => void`).
  Sigue sin llamadas a red — la persistencia vive en `OpDrawer`.

### Manejo de errores

- Fetch inicial de `ocExistente` con error de red/servidor (no 404): se trata como "no se
  pudo determinar", el drawer no muestra ningún botón de OC para evitar generar un duplicado
  sin saberlo si en realidad ya existe uno. (Alternativa descartada: mostrar "Generar" por
  default en error — riesgo de sobrescribir una OC ya generada sin que el usuario lo sepa.)
- `POST /guardar` falla: mensaje de error visible en el modal (prop `error` existente),
  `noPO` ya quedó actualizado en el registro (falla parcial, usuario puede reintentar
  "Generar documento" para reguardar sin perder lo capturado en el formulario, que sigue en
  memoria).
- Dropbox no configurado: mismo mensaje `dropbox_no_configurado` que usa el flujo de Órdenes
  Directas, consistente en toda la app.

## Fuera de alcance

- Snapshot PNG del documento (decisión explícita: solo JSON, re-render en vivo).
- Historial/lista de todas las OC generadas por este flujo (a diferencia de "Órdenes
  Directas") — el acceso sigue siendo 1:1 vía el drawer del registro de pipeline, no hay
  vista de listado nueva.
- Borrar una OC ya generada desde el dashboard.
- Migrar OC ya generadas antes de este cambio (registros con `noPO` prellenado por el flujo
  viejo sin persistencia no tendrán `ocExistente` y seguirán mostrando "Generar" si siguen en
  etapa `instruccion`; si ya avanzaron de etapa, no verán ningún botón — comportamiento
  aceptado, es dato histórico previo a este cambio).

## Testing

- `oc-pipeline` route tests (nuevo, patrón de `ordenes-directas` route tests): 401 sin token;
  `GET` 200 con orden existente, 404 sin archivo, 503 sin config; `POST guardar` 200 feliz,
  valida campos mínimos, 503 sin config.
- `OpDrawer.test.tsx`: fetch al montar determina botón mostrado (Generar/Ver/ninguno) en los
  3 casos y combinaciones de etapa; `guardarOc` manda PATCH `noPO` + POST guardar con `opId`
  y `orden` completos; error de POST se muestra sin revertir `noPO`; "Ver" visible fuera de
  etapa `instruccion`.
- `OcSimpleForm.test.tsx` (ampliar): con `ordenInicial` arranca en vista documento; "← Editar"
  y regenerar llama `onGenerado(orden)` con el objeto completo actualizado.
- `GenerarOcModal.test.tsx` (ampliar): pasa `ordenInicial` a `OcSimpleForm` cuando se provee.
