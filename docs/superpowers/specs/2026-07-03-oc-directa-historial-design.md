# OC Directa — Historial, Edición, Consecutivo MTY y Dropbox — Design

**Fecha:** 2026-07-03
**Estado:** Aprobado
**Extiende:** `2026-07-03-ordenes-compra-directa-design.md` (fase captura+impresión, ya en producción)

## Objetivo

La fase 1 de OC Directa no guarda nada: se captura, se imprime y se pierde. Esta fase agrega:

1. **Historial**: cada orden generada se guarda y aparece en una lista dentro de la sección OC Directa.
2. **Edición**: cualquier orden guardada puede reabrirse en el formulario, modificarse y reimprimirse.
3. **Consecutivo MTY asíncrono**: quien captura está en Mérida; cuando la carga llega a bodega Monterrey, la persona de MTY (mismo dashboard, mismo login Google) abre la orden pendiente y escribe su consecutivo.
4. **Excel a Dropbox**: al guardar (crear o editar) se genera un `.xlsx` real basado en la plantilla oficial y se sube a Dropbox, donde el equipo guarda hoy sus archivos.

## Flujo de negocio

```
Mérida captura orden ──guardar──► Sheets (historial) + Dropbox (.xlsx)
        │
        ├─ NO entra a MTY → folio OC.<n>/Directo, estatus DIRECTO. Fin.
        │
        └─ SÍ entra a MTY → folio OC.<n>/PENDIENTE, estatus PENDIENTE MTY
                 │
                 └─ llega a bodega MTY → persona MTY abre la orden,
                    escribe su consecutivo (ej. E641) → folio OC.<n>/E641,
                    estatus COMPLETA → re-genera .xlsx en Dropbox, reimprime.
```

Cualquier edición posterior (líneas, precios, proveedor…) es posible en cualquier estatus; cada guardado re-sube el `.xlsx` (sobrescribe).

## Persistencia — Google Sheets

Nueva pestaña **`OC_DIRECTA`** en el spreadsheet de logística existente (`OC_SPREADSHEET_ID`). Una fila por orden; las líneas de material van serializadas como JSON en una celda (evita el problema de N filas por orden al editar/sobrescribir).

Encabezados (fila 1):

| Columna | Contenido |
|---|---|
| `ID` | identificador estable (`OCD-<timestamp>-<rand>`), clave de edición |
| `FOLIO CONSECUTIVO` | ej. `696` |
| `ENTRA MTY` | `SI` / `NO` |
| `FOLIO MTY` | ej. `E641`, vacío mientras pendiente |
| `ESTATUS` | `DIRECTO` / `PENDIENTE MTY` / `COMPLETA` |
| `FECHA` | `YYYY-MM-DD` |
| `PROVEEDOR` | nombre |
| `ENTIDAD COMPRA` | nombre (los datos fiscales se resuelven del catálogo al reabrir) |
| `ENTIDAD REVENTA` | nombre |
| `METODO PAGO` / `FORMA PAGO` | texto |
| `RETENCION` | `SI` / `NO` |
| `MARGEN` | número (por kg) |
| `LINEAS` | JSON: `[{"material":"ANTIMONIO","cantidadKg":1830,"unidad":"KGM","precioNeto":41}]` |
| `TOTAL COMPRA` | número (denormalizado para la lista) |
| `ACTUALIZADO` | ISO timestamp del último guardado |
| `ACTUALIZADO POR` | email del usuario autenticado |

- Folio derivado (no almacenado): `OC.<consecutivo>/Directo`, `OC.<consecutivo>/PENDIENTE` o `OC.<consecutivo>/<folioMty>`.
- **Autoconsecutivo Mérida**: al abrir el formulario en modo "nueva", se sugiere `max(consecutivos) + 1`; editable manualmente.
- Mapeo por nombre de encabezado (patrón existente), tolera reorden de columnas.

## Backend

### `dashboard/src/lib/ordenesDirectasStore.ts`

- `listOrdenes(api?): Promise<OrdenDirectaGuardada[]>` — lee `OC_DIRECTA!A1:Z`, parsea (JSON de líneas incluido), ordena por consecutivo descendente.
- `appendOrden(orden, api?)` — agrega fila.
- `updateOrden(id, orden, api?)` — localiza la fila por `ID` y la sobrescribe (`values.update`). Si el `ID` no existe → error `not_found`.
- `siguienteConsecutivo(ordenes): number` — máximo de los consecutivos numéricos + 1; si no hay órdenes devuelve 1 (la primera vez el usuario teclea el consecutivo real, ej. 697, y de ahí en adelante el sugerido es correcto).
- Tipos:

```ts
interface OrdenDirectaGuardada {
  id: string;
  folioConsecutivo: string;
  entraMty: boolean;
  folioMty: string;
  estatus: 'DIRECTO' | 'PENDIENTE MTY' | 'COMPLETA';
  fecha: string;
  proveedor: string;
  entidadCompraNombre: string;
  entidadReventaNombre: string;
  metodoPago: string;
  formaPago: string;
  retencion: 'SI' | 'NO';
  margenPorKg: number;
  lineas: { material: string; cantidadKg: number; unidad: string; precioNeto: number }[];
  totalCompra: number;
  actualizado: string;
  actualizadoPor: string;
}
```

### `dashboard/src/lib/ocDirectaXlsx.ts`

- Genera el `.xlsx` a partir de la plantilla `dashboard/templates/PLANTILLA OC.xlsx` (copiada al repo desde la plantilla del usuario), usando **ExcelJS**.
- Solo escribe **celdas de entrada** en la hoja `ORDEN DE COMPRA`; las fórmulas de la plantilla quedan intactas (Excel recalcula al abrir):
  - `G2` folio completo (`OC.696/E641`)
  - `C4` entidad compra (nombre; los VLOOKUP de RFC/dirección/régimen resuelven contra CONCEPTOS de la plantilla)
  - `L4` entidad reventa
  - `G10` razón social receptora — se escribe el nombre de la entidad reventa (equivale al valor manual del sheet)
  - `H11` proveedor
  - `E16`/`N16` método de pago; `E17`/`N17` forma de pago
  - `J18` retención (`SI`/`NO`)
  - `S21` margen por kg
  - Líneas (filas 21+): `D` cantidad, `E` unidad, `F` material, `J` precio neto (hasta 13 líneas, límite de la plantilla)
- Nombre de archivo: `OC<consecutivo> <PROVEEDOR>.xlsx` (ej. `OC696 RODRIGO CALDERA.xlsx`), mismo patrón que hoy.
- Devuelve `Buffer`.

### `dashboard/src/lib/dropboxUpload.ts`

- Sube el buffer a Dropbox vía HTTP API (`content.dropboxapi.com/2/files/upload`, `mode: overwrite`).
- Token de acceso obtenido con refresh token (`api.dropboxapi.com/oauth2/token`), cacheado en memoria hasta expirar.
- Variables de entorno (Vercel): `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_FOLDER` (default `/Ordenes de Compra`).
- Si las variables no están configuradas, el guardado en Sheets procede y la respuesta indica `dropbox: 'no configurado'` (no bloquea el flujo).
- Si Dropbox falla (red/token), igual: orden guardada, respuesta con `dropbox: 'error'` y mensaje; el UI lo muestra como advertencia.

### API routes

- `GET /api/ordenes-directas` — lista órdenes guardadas. Auth: `Authorization: Bearer` + `verifyGoogleCredential` (patrón ya establecido en el route de catálogo). Cache TTL corto (15 s) con fallback stale.
- `POST /api/ordenes-directas` — crea. Body: orden completa + `credential`. Valida campos obligatorios (proveedor, entidades, ≥1 línea completa). Escribe Sheets → genera xlsx → sube Dropbox → responde `{ ok, id, dropbox }`.
- `PUT /api/ordenes-directas/[id]` — edita (mismo pipeline que POST pero `updateOrden`). También es la vía para que MTY complete su consecutivo: el formulario manda la orden con `folioMty` lleno y el server recalcula `estatus`.
- Estatus derivado en servidor: `entraMty=false → DIRECTO`; `entraMty=true && folioMty vacío → PENDIENTE MTY`; `entraMty=true && folioMty lleno → COMPLETA`.

## Frontend

### `OrdenesDirectas.tsx` (nuevo contenedor de la sección)

- Vista **lista** (default): tabla con folio completo, fecha, proveedor, total compra, estatus (badge naranja si `PENDIENTE MTY`), actualizado por. Botón "+ Nueva orden". Buscador por folio/proveedor.
- Clic en fila → abre `OrdenDirectaForm` en modo edición con los datos cargados.
- "+ Nueva orden" → `OrdenDirectaForm` en modo nueva, con consecutivo sugerido (`max+1`).

### `OrdenDirectaForm.tsx` (cambios)

- Props nuevas: `orden?: OrdenDirectaGuardada` (modo edición), `consecutivoSugerido?: string`, `onGuardado: () => void` (regresa a la lista y recarga).
- Botón **"Guardar"** (independiente de "Generar documentos"): POST o PUT según modo. Muestra estado guardando/guardado/advertencia Dropbox.
- "Generar documentos" sigue funcionando igual (impresión), pero ahora exige guardar primero si hay cambios sin guardar (aviso simple).
- Campo "Consecutivo de Monterrey": visible cuando `entraMty` — en Mérida se deja vacío (folio imprime `/PENDIENTE`); la persona de MTY lo llena al editar.
- Mientras `entraMty && folioMty vacío`, el folio mostrado/impreso es `OC.<n>/PENDIENTE`.

### Navegación

- `page.tsx`: la sección `ordenes-directas` ahora monta `OrdenesDirectas` (lista) en vez del formulario directo. El contador del nav vuelve a tener sentido: número de órdenes `PENDIENTE MTY` (0 → badge oculto, comportamiento actual).

## Configuración Dropbox (paso manual del usuario, una vez)

1. https://www.dropbox.com/developers/apps → Create app → Scoped access → App folder (o Full dropbox si quieren carpeta existente del equipo).
2. Permisos: `files.content.write`.
3. Generar refresh token vía flujo OAuth (se darán los comandos exactos al implementar).
4. En Vercel: agregar `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_FOLDER`.

También manual: crear la pestaña `OC_DIRECTA` con la fila de encabezados en el spreadsheet de logística (o el implementador la crea vía API si el service account tiene permiso de escritura — verificar; el service account ya escribe en otras hojas del proyecto, pero este spreadsheet se compartió como lectura → **hay que subirlo a permiso de editor**, paso manual del usuario).

## Manejo de errores

- Sheets caído en lista → mensaje + reintentar (patrón existente).
- POST/PUT sin auth → 401.
- Conflicto de edición: sin bloqueo optimista en esta fase (equipo chico); el último guardado gana. `ACTUALIZADO`/`ACTUALIZADO POR` dejan rastro.
- Dropbox no configurado o caído → orden se guarda igual; advertencia visible en UI.
- Plantilla xlsx ilegible/corrupta → error de servidor en la parte Dropbox, orden guardada igual.

## Testing

- `ordenesDirectasStore.test.ts`: parseo de filas (JSON líneas), mapeo por encabezado, siguienteConsecutivo, update localiza fila por ID, not_found.
- `ocDirectaXlsx.test.ts`: escribe celdas de entrada correctas en el buffer generado (releer con ExcelJS y verificar G2, C4, D21…, J18, S21), respeta límite 13 líneas.
- `dropboxUpload.test.ts`: refresh de token, overwrite path correcto, no-configurado → resultado `no configurado` sin throw.
- Routes: 401 sin token, POST feliz, PUT not_found → 404, estatus derivado correcto (3 casos).
- `OrdenesDirectas.test.tsx`: lista, badge pendiente MTY, abrir orden en edición, nueva orden con consecutivo sugerido.
- `OrdenDirectaForm.test.tsx` (ampliar): guardar POST/PUT, advertencia Dropbox, folio `/PENDIENTE`.
- Manual: flujo completo Mérida→MTY con dos sesiones, verificación del xlsx descargado de Dropbox abierto en Excel (fórmulas recalculan).

## Fuera de alcance

- Bloqueo/lock de edición concurrente.
- Borrar órdenes (si se necesita, se agrega después; por ahora historial es append/update).
- Notificaciones a MTY (correo/push) cuando hay pendientes.
