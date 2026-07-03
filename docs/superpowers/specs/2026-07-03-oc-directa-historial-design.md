# OC Directa — Historial en Dropbox, Edición y Consecutivo MTY — Design

**Fecha:** 2026-07-03 (v2 — reemplaza la versión que persistía en Google Sheets; el usuario pidió explícitamente NO escribir en el spreadsheet)
**Estado:** Aprobado
**Extiende:** `2026-07-03-ordenes-compra-directa-design.md` (fase captura+impresión, ya en producción)

## Objetivo

Dropbox es la **única fuente de verdad** del historial de órdenes directas. Al guardar una orden, el dashboard sube a Dropbox:

1. El **`.xlsx`** generado desde la plantilla oficial (`dashboard/templates/PLANTILLA OC.xlsx`), con fórmulas intactas — editable en Excel como hoy.
2. **Dos imágenes PNG**: el documento de compra y el de reventa, tal como se ven al imprimir.

El dashboard **lista** los Excel de la carpeta Dropbox, puede **abrir** cualquiera (lee sus celdas de entrada), **editarlo** en el formulario y re-subirlo. La persona de MTY completa su consecutivo desde el dashboard. **No se escribe nada en Google Sheets** — el spreadsheet sigue siendo solo lectura (catálogos).

## Flujo de negocio

```
Mérida captura orden ──Guardar──► Dropbox: OC696 PROVEEDOR….xlsx + 2 PNG
        │
        ├─ NO entra a MTY → folio OC.696/Directo
        │                   archivo: "OC696 RODRIGO CALDERA.xlsx"
        │
        └─ SÍ entra a MTY → folio OC.696/PENDIENTE
                            archivo: "OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx"
                 │
                 └─ llega a bodega MTY → persona MTY abre la orden desde la
                    lista del dashboard, escribe su consecutivo (E641) →
                    folio OC.696/E641, archivo renombrado a
                    "OC696 RODRIGO CALDERA.xlsx" (sufijo PENDIENTE fuera)
```

El **estatus vive en el nombre del archivo** (sufijo ` - PENDIENTE MTY`): la lista lo muestra sin descargar cada Excel, y también es visible a simple vista en Dropbox.

## Convención de nombres en Dropbox (`DROPBOX_FOLDER`, default `/Ordenes de Compra`)

| Archivo | Ejemplo |
|---|---|
| Excel | `OC696 RODRIGO CALDERA.xlsx` (o `… - PENDIENTE MTY.xlsx`) |
| Imagen compra | `OC696 RODRIGO CALDERA COMPRA.png` |
| Imagen reventa | `OC696 RODRIGO CALDERA REVENTA.png` |

Al re-guardar se sobrescribe (`mode: overwrite`). Si cambia consecutivo/proveedor/estatus, el server sube con el nombre nuevo y borra los archivos con el nombre anterior (`files/delete_v2`, best-effort).

## Backend

### `dashboard/src/lib/dropboxClient.ts`

- Access token vía refresh token (`api.dropboxapi.com/oauth2/token`), cacheado en memoria hasta expirar.
- `uploadFile(path, buffer)` — `content.dropboxapi.com/2/files/upload`, overwrite.
- `listFolder(folder)` — `files/list_folder` (+ `list_folder/continue`), solo `.xlsx`.
- `downloadFile(path)` — `files/download` → Buffer.
- `deleteFile(path)` — `files/delete_v2`, no lanza si no existe.
- Env: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_FOLDER` (ya configuradas en Vercel, prod y preview). Sin configurar → error claro `dropbox_no_configurado`.

### `dashboard/src/lib/ocDirectaXlsx.ts`

**Escritura** — `generarXlsx(orden): Promise<Buffer>` con ExcelJS sobre la plantilla; solo celdas de entrada de la hoja `ORDEN DE COMPRA` (fórmulas intactas, Excel recalcula al abrir):

| Celda | Valor |
|---|---|
| `G2` | folio completo (`OC.696/E641`, `OC.696/Directo` o `OC.696/PENDIENTE`) |
| `C4` | entidad compra (nombre; VLOOKUPs de la plantilla resuelven RFC/dirección/régimen) |
| `L4` | entidad reventa |
| `G10` | razón social receptora (= entidad reventa) |
| `H11` | proveedor |
| `E16`, `N16` | método de pago |
| `E17`, `N17` | forma de pago |
| `J18` | retención `SI`/`NO` |
| `S21` | margen por kg |
| Filas 21–33 | `D` cantidad, `E` unidad, `F` material, `J` precio neto (máx. 13 líneas, límite de plantilla; el formulario limita a 13) |

**Lectura** — `parseXlsx(buffer): OrdenDirectaDatos` — lee las mismas celdas para reconstruir el estado del formulario al editar. Folio se descompone: consecutivo (entre `OC.` y `/`), segundo segmento → `Directo` ⇒ entraMty=false; `PENDIENTE` ⇒ entraMty=true, folioMty=''; otro ⇒ entraMty=true, folioMty=valor.

```ts
interface OrdenDirectaDatos {
  folioConsecutivo: string;
  entraMty: boolean;
  folioMty: string;
  fecha: string;              // del formulario; en xlsx la fecha es =NOW(), no se lee
  proveedor: string;
  entidadCompraNombre: string;
  entidadReventaNombre: string;
  metodoPago: string;
  formaPago: string;
  retencion: 'SI' | 'NO';
  margenPorKg: number;
  lineas: { material: string; cantidadKg: number; unidad: string; precioNeto: number }[];
}
```

- `nombreArchivo(orden)` / `parseNombre(nombre)` — construyen y descomponen la convención de nombres (consecutivo, proveedor, sufijo pendiente).

### API routes (todas con `Authorization: Bearer` + `verifyGoogleCredential`, patrón existente)

- **`GET /api/ordenes-directas/archivos`** — lista la carpeta. Respuesta por archivo: `{ nombre, path, consecutivo, proveedor, pendienteMty, modificado }` (todo derivado de `parseNombre` + metadata, sin descargar contenido). Orden: consecutivo descendente. Cache TTL 15 s con fallback stale.
- **`POST /api/ordenes-directas/abrir`** — body `{ path }` → descarga el xlsx, `parseXlsx`, responde `{ orden }`. Sin cache.
- **`POST /api/ordenes-directas/guardar`** — body:

```ts
{
  orden: OrdenDirectaDatos;
  imagenes: { compra: string; reventa: string }; // PNG base64 (sin prefijo data:)
  pathOriginal?: string; // presente al editar; si el nombre cambió, borrar archivos viejos
}
```

  Pipeline: validar (proveedor, entidades, 1–13 líneas completas) → `generarXlsx` → subir xlsx + 2 PNG → si `pathOriginal` difiere del nuevo path, borrar xlsx y PNGs anteriores → responder `{ ok, path }`. Tamaño: 2 PNG base64 ≈ 1–2 MB, dentro del límite de body de Vercel (4.5 MB).

## Frontend

### Captura de imágenes (cliente)

- Dependencia nueva: **`html2canvas`**. Al guardar, el cliente renderiza los dos `OrdenDirectaPrint` (la vista de documentos ya existe) y captura cada `.ocd-sheet` a PNG (`scale: 2`, fondo blanco).
- El botón **"Guardar en Dropbox"** vive en la vista de documentos generados (junto a los de imprimir): así lo que se sube es exactamente lo que el usuario está viendo.

### `OrdenesDirectas.tsx` (nuevo contenedor de la sección)

- Vista **lista** (default): tabla desde `/api/ordenes-directas/archivos`: folio (`OC696`), proveedor, estatus (badge naranja `PENDIENTE MTY`), fecha de modificación. Buscador por texto. Botón "+ Nueva orden".
- Clic en fila → `POST /abrir` → `OrdenDirectaForm` en modo edición (estado precargado + `pathOriginal`).
- "+ Nueva orden" → formulario vacío. Sin autoconsecutivo confiable (habría que descargar archivos); el consecutivo sugerido = máximo de los consecutivos visibles en la lista + 1, editable.

### `OrdenDirectaForm.tsx` (cambios)

- Props nuevas: `ordenInicial?: OrdenDirectaDatos`, `pathOriginal?: string`, `consecutivoSugerido?: string`, `onGuardado: () => void`.
- Límite de líneas: máx. 13 (límite de la plantilla); el botón "+ Agregar línea" se desactiva al llegar.
- En la vista de documentos: botón "Guardar en Dropbox" → captura 2 PNG → `POST /guardar` → estados guardando / guardado / error (con mensaje). Tras guardar OK: `onGuardado()` regresa a la lista.
- Campo "Consecutivo de Monterrey": en Mérida se deja vacío → folio `/PENDIENTE`; la persona de MTY abre la orden, lo llena y guarda → renombrado automático en Dropbox.

### Navegación

- `page.tsx`: la sección monta `OrdenesDirectas` (lista). Contador del nav = número de archivos `PENDIENTE MTY` (badge oculto en 0, comportamiento actual).

## Manejo de errores

- Dropbox no configurado / token inválido → lista muestra error + reintentar; guardar responde 503 con mensaje claro.
- `POST /abrir` con xlsx que no sigue la plantilla (celdas vacías inesperadas) → error `formato_no_reconocido`, el UI sugiere editarlo directo en Excel.
- Guardar: si suben las imágenes pero falla el xlsx (o viceversa) → responder error; el usuario reintenta (overwrite hace el reintento idempotente).
- Sin auth → 401 (patrón existente).
- Concurrencia: sin lock; último guardado gana (equipo chico). Dropbox conserva historial de versiones de archivos de todos modos (recuperación manual posible).

## Testing

- `ocDirectaXlsx.test.ts`: round-trip generar→parsear (las celdas escritas se leen igual), folio se descompone en los 3 casos (Directo/PENDIENTE/E641), límite 13 líneas, `nombreArchivo`/`parseNombre` round-trip incluido sufijo pendiente.
- `dropboxClient.test.ts` (fetch mockeado): refresh de token + cache, upload path/overwrite correcto, listFolder con paginación, delete no lanza en 409 not_found, sin env → `dropbox_no_configurado`.
- Routes: 401 sin token; `archivos` lista+parsea nombres+cache; `abrir` feliz y `formato_no_reconocido`; `guardar` feliz, borra archivos viejos al renombrar, 503 sin config.
- `OrdenesDirectas.test.tsx`: lista, badge pendiente, abrir → formulario precargado, nueva orden con consecutivo sugerido.
- `OrdenDirectaForm.test.tsx` (ampliar): guardar manda orden+imágenes+pathOriginal, estados de guardado, límite 13 líneas. `html2canvas` mockeado.
- Manual: crear orden con "entra a MTY" → verificar en Dropbox xlsx con sufijo PENDIENTE + 2 PNG → abrir el xlsx en Excel (fórmulas recalculan) → en el dashboard, abrir la orden, poner consecutivo MTY, guardar → verificar renombrado y folio actualizado.

## Fuera de alcance

- Escritura en Google Sheets (explícitamente excluida).
- Borrar órdenes desde el dashboard (se hace directo en Dropbox si hace falta).
- Notificaciones a MTY cuando hay pendientes.
- Lock de edición concurrente.
