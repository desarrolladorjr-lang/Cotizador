# Dashboard — CRM con módulos editables (v2) — Design Spec
Date: 2026-06-20

## Overview

Evoluciona el dashboard (hoy: feed en vivo, solo lectura, tabla única mezclando las 5 hojas) a un layout tipo CRM: un módulo por hoja del spreadsheet, cada uno con su tabla de columnas reales y edición inline de cualquier campo, con escritura de vuelta al sheet.

Construye sobre lo existente: `dashboard/src/lib/sheetsClient.ts`, `normalizeFeed.ts`, `feedCache.ts`, `/api/feed`, `FeedTable.tsx`, `AuthGate.tsx` (ver `docs/superpowers/specs/2026-06-19-dashboard-feed-design.md`).

Audiencia: equipo operativo interno (misma que hoy).

## Alcance

- Módulos = uno por hoja existente: Terrestre, Marítimo, Nacional, Compras, Inventarios. (Más módulos de negocio —Clientes, etc.— quedan fuera, es trabajo futuro.)
- Cada módulo muestra sus columnas reales (no el shape genérico `FeedRow` de hoy) y permite editar cualquier campo de una fila existente.
- Solo Update. Alta y baja de filas sigue siendo trabajo de Cotizador (`Codigo.gs` / `deploy/index.html`), sin cambios ahí.
- Escritura va directo a Sheets API desde el backend del dashboard (no pasa por `Codigo.gs`).
- Conflictos: si la fila cambió en el sheet entre que se cargó y que se intenta guardar, se bloquea el guardado y se avisa al usuario.
- Auditoría: cada edición escribe quién y cuándo en columnas fijas al final de la hoja.
- Fuera de alcance: alta/baja de filas desde el dashboard, restricción de acceso por email, nuevos módulos de negocio, status tracking agregado/métricas (specs futuros separados, según spec 2026-06-19).

## Arquitectura

- Mismo proyecto Next.js (`./dashboard`), mismo stack (Next 14 App Router, `googleapis`, Vitest).
- **Permisos:** la service account pasa de **Viewer** a **Editor** sobre el spreadsheet. Scope de `sheetsClient.ts` pasa de `spreadsheets.readonly` a `spreadsheets` (lectura+escritura). Esto requiere un paso manual: re-compartir el sheet con permiso Editor para el `client_email` de la service account.
- **Lectura:** sin cambios de mecanismo (`fetchAllSheets`, cache TTL 25s), pero `normalizeFeed` ahora también devuelve `rowIndex` (número de fila real en el sheet, 1-based incluyendo header) por cada `FeedRow`, necesario para ubicar la fila al editar.
- **Escritura:** nuevo módulo `dashboard/src/lib/sheetsWriter.ts`:
  - `updateRow(sheetName, rowIndex, newValues: string[], expectedCurrentValues: string[]): Promise<{ok: true} | {ok: false, reason: 'conflict' | 'error', message?: string}>`
  - Antes de escribir, lee la fila actual (`values.get` del range exacto) y la compara contra `expectedCurrentValues` (snapshot que el cliente cargó). Si no coincide → `conflict`, no escribe nada.
  - Si coincide, escribe `newValues` vía `values.update` en el range de esa fila, y además escribe `EditadoPor` / `EditadoFecha` en las 2 columnas siguientes al final de los datos de esa hoja (posición fija por tipo de hoja, ver esquema abajo).
- **Endpoint:** `PATCH /api/rows/[sheetName]/[rowIndex]` (route handler dinámico App Router) — body: `{ values: string[], expectedValues: string[], editor: string }`. Responde `{ ok: true }` o `{ ok: false, reason, message }` con status 409 en conflicto.
- `editor` viene del email decodificado del JWT de Google Sign-In en el cliente (mismo mecanismo que `AuthGate` ya usa para decodificar `credential`).

## Esquema por módulo

Columnas fijas por tipo de hoja, igual al orden que `Codigo.gs` `doPost` ya escribe (no inventa nada nuevo, documenta lo existente):

`dashboard/src/lib/sheetSchemas.ts`:
```ts
export interface FieldSchema { key: string; label: string; index: number }

export const STANDARD_SCHEMA: FieldSchema[] = [ // Terrestre, Marítimo, Nacional
  { key: 'fecha', label: 'Fecha', index: 0 },
  { key: 'usuario', label: 'Usuario', index: 1 },
  { key: 'cliente', label: 'Cliente', index: 2 },
  { key: 'proveedor', label: 'Proveedor', index: 3 },
  { key: 'cargas', label: 'Cargas', index: 4 },
  { key: 'material', label: 'Material', index: 5 },
  { key: 'destino', label: 'Destino', index: 6 },
  { key: 'porcentajeFijacion', label: '% Fijación', index: 7 },
  { key: 'fixPrice', label: 'Fix Price', index: 8 },
  { key: 'precioVenta', label: 'Precio Venta', index: 9 },
  { key: 'tcHoy', label: 'TC Hoy', index: 10 },
  { key: 'tcSeguro', label: 'TC Seguro', index: 11 },
  { key: 'fleteNac', label: 'Flete Nac', index: 12 },
  { key: 'cruceInt', label: 'Cruce Int', index: 13 },
  { key: 'precioTopeCompra', label: 'Precio Tope Compra', index: 14 },
  { key: 'ppProv', label: 'PP Prov', index: 15 },
  { key: 'status', label: 'Status', index: 16 },
  { key: 'utilidadNeta', label: 'Utilidad Neta', index: 17 },
  { key: 'tipoCompra', label: 'Tipo Compra', index: 18 },
  { key: 'notas', label: 'Notas', index: 19 },
  { key: 'contrato', label: 'Contrato', index: 20 },
  { key: 'paraInventarios', label: 'Para Inventarios', index: 21 },
  { key: 'intencionVenta', label: 'Intención Venta', index: 22 },
  { key: 'intencionCompra', label: 'Intención Compra', index: 23 },
]; // EditadoPor=24, EditadoFecha=25

export const COMPRAS_SCHEMA: FieldSchema[] = [
  { key: 'fecha', label: 'Fecha', index: 0 },
  { key: 'usuario', label: 'Usuario', index: 1 },
  { key: 'proveedor', label: 'Proveedor', index: 2 },
  { key: 'cargas', label: 'Cargas', index: 3 },
  { key: 'material', label: 'Material', index: 4 },
  { key: 'origenFlete', label: 'Origen Flete', index: 5 },
  { key: 'destinoFlete', label: 'Destino Flete', index: 6 },
  { key: 'fleteNac', label: 'Flete Nac', index: 7 },
  { key: 'fixPrice', label: 'Fix Price', index: 8 },
  { key: 'porcentajeFijacion', label: '% Fijación', index: 9 },
  { key: 'precioVenta', label: 'Precio Venta', index: 10 },
  { key: 'precioTopeCompra', label: 'Precio Tope Compra', index: 11 },
  { key: 'paraInventarios', label: 'Para Inventarios', index: 12 },
  { key: 'intencionVenta', label: 'Intención Venta', index: 13 },
  { key: 'intencionCompra', label: 'Intención Compra', index: 14 },
  { key: 'precioCompraMxn', label: 'Precio Compra MXN', index: 15 },
  { key: 'notas', label: 'Notas', index: 16 },
]; // EditadoPor=17, EditadoFecha=18

export const INVENTARIOS_SCHEMA: FieldSchema[] = [
  { key: 'fecha', label: 'Fecha', index: 0 },
  { key: 'usuario', label: 'Usuario', index: 1 },
  { key: 'proveedor', label: 'Proveedor', index: 2 },
  { key: 'cargas', label: 'Cargas', index: 3 },
  { key: 'material', label: 'Material', index: 4 },
  { key: 'fleteNac', label: 'Flete Nac', index: 5 },
  { key: 'precioCompraMxn', label: 'Precio Compra MXN', index: 6 },
  { key: 'notas', label: 'Notas', index: 7 },
]; // EditadoPor=8, EditadoFecha=9

export function schemaFor(sheetName: SheetName): FieldSchema[] { ... } // switch sobre las 3
```

`AUDIT_COLUMN_OFFSET` por esquema = `schema.length` (índice de `EditadoPor`), `+1` para `EditadoFecha`.

## UI

- Tabs por módulo arriba (reemplaza el filtro "Todos/Terrestre/.../Inventarios" genérico de `FeedTable` de hoy). Un tab activo a la vez, renderiza tabla propia del módulo con sus columnas reales (vía `schemaFor`).
- Click en fila abre modal de edición: un input de texto por campo del esquema (todos editables), prellenado con valores actuales. Botón "Guardar".
- Guardar → `PATCH /api/rows/[sheetName]/[rowIndex]` con `values` (array completo nuevo), `expectedValues` (snapshot al abrir el modal), `editor` (email del usuario).
  - Éxito: cierra modal, actualiza esa fila en el estado local sin esperar al próximo poll (45s sigue corriendo igual para el resto).
  - Conflicto (409): mensaje "Esta fila cambió desde que la cargaste" + botón "Recargar fila" (vuelve a pedir `/api/feed`, repuebla el modal con datos frescos, usuario reintenta).
  - Error de red/Sheets API: mensaje genérico, no cierra modal, el usuario puede reintentar Guardar.
- Indicadores existentes se mantienen: "hoja no disponible", "datos desactualizados" (stale), "última actualización: hace Xs".

## Auditoría

- Cada PATCH exitoso escribe `editor` (email) y `new Date().toISOString()` en las 2 columnas fijas al final de la fila (offsets de la sección anterior), sobrescribiendo cualquier valor previo en esas columnas.
- No se versiona historial — solo el último editor/fecha queda visible (suficiente para "quién tocó esto último").

## Manejo de errores

- Conflicto de concurrencia: ver UI arriba — no se escribe nada, usuario decide recargar y reintentar.
- Sheets API rate limit/cuota en escritura: PATCH devuelve 503 con mensaje, modal no cierra, usuario reintenta. No hay cola de reintentos automática (fuera de alcance, equipo chico, bajo volumen).
- Falla la lectura inicial de la fila (para comparar contra `expectedValues`): se trata igual que conflicto, ya que no se puede confirmar que no cambió.
- El resto del manejo de errores (hoja individual no disponible, login, stale feed) no cambia respecto al spec 2026-06-19.

## Testing

- Unit: `sheetsWriter.test.ts` — escribe cuando coincide snapshot, devuelve conflict cuando no coincide, no llama `values.update` en caso de conflict.
- Unit: `sheetSchemas.test.ts` — `schemaFor` devuelve el esquema correcto por tipo de hoja, longitudes correctas.
- Unit: ruta `PATCH /api/rows/[sheetName]/[rowIndex]` — éxito devuelve 200, conflict devuelve 409, error inesperado devuelve 503.
- Component: modal de edición — abre con valores prellenados, Guardar dispara PATCH con el shape correcto, conflicto muestra botón recargar.
- Manual: editar una fila real de prueba en cada uno de los 5 módulos, confirmar que aparece el cambio en el Google Sheet real, incluyendo columnas `EditadoPor`/`EditadoFecha`. Editar la misma fila desde dos pestañas para confirmar que la segunda en guardar recibe conflicto.

## Qué NO cambia / fuera de alcance

- Cotizador (`Codigo.gs`, `deploy/index.html`) sin modificar.
- Sin alta ni baja de filas desde el dashboard.
- Sin restricción de acceso por email.
- Sin nuevos módulos de negocio (Clientes, etc.) todavía — mencionado como trabajo futuro.
- Sin historial de auditoría versionado, solo último editor/fecha.
- Sin status tracking agregado ni métricas/gráficas (specs futuros separados).
