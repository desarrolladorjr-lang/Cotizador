# Órdenes de Compra en Dashboard — Design

**Fecha:** 2026-07-02
**Estado:** Aprobado
**Fase:** 1 de 2 (consulta e impresión; crear/editar queda para fase 2)

## Objetivo

Nueva sección "Órdenes de Compra" en el dashboard (Next.js, `dashboard/`) que reemplaza el flujo manual en Google Sheets: hoy el usuario abre el doc de logística, selecciona el número de orden en un dropdown de la hoja `ORDEN DE COMPRA` y VLOOKUPs/FILTERs arman el formato desde la hoja `COMPRAS`. El dashboard mostrará la lista de órdenes, la vista de OC con el formato exacto del sheet, y un botón Imprimir / Guardar PDF.

## Fuente de datos

- Spreadsheet de logística: `17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM` (distinto al spreadsheet principal `12-gjHH...` que ya lee el dashboard).
- Hoja `COMPRAS` (gid 783689622): log operativo. Encabezados relevantes: `ORDEN`, `FECHA`, `ESTATUS`, `PROVEEDOR`, `MATERIAL`, `EMBALAJE`, `KG OC`, `NEGOCIACION`, `PRECIO PACTADO`.
- Acceso: mismo service account del dashboard (`cotizador@cotizador-499917.iam.gserviceaccount.com`), ya compartido con permiso de lectura.
- Una orden = todas las filas de `COMPRAS` que comparten el mismo valor en `ORDEN` (ej. `P022` con 3 líneas de material). Filas con `ORDEN` vacío se ignoran.
- Lógica replicada del sheet `ORDEN DE COMPRA`:
  - Encabezado de la orden (fecha, proveedor, negociación): tomados de la primera fila del grupo (equivale a los VLOOKUP por `ORDEN`).
  - Líneas de material: `MATERIAL`, `EMBALAJE`, `KG OC` (cantidad), `PRECIO PACTADO` (precio unitario) — equivale a los FILTER.
  - `importe = cantidad × precio unitario`; total = suma de importes.

## Backend

### `dashboard/src/lib/ordenesClient.ts`

- Exporta `OC_SPREADSHEET_ID = '17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM'`.
- Lee `COMPRAS!A1:Z` con el `getSheetsApi()` existente; mapea columnas por nombre de encabezado (mismo patrón que pipeline — tolera reorden de columnas).
- Parsing de números: acepta `8,000.00` (comas de miles) y `$37.80` (símbolo `$`). Valor no numérico o vacío → `null`.
- Agrupa por `ORDEN` y devuelve:

```ts
interface OrdenLinea {
  material: string;
  embalaje: string;
  cantidadKg: number | null;
  precioUnitario: number | null;
  importe: number | null; // cantidadKg * precioUnitario; null si falta alguno
}

interface OrdenCompra {
  numero: string;        // "P022"
  fecha: string;         // texto tal cual del sheet ("8 abril, 2026")
  proveedor: string;
  negociacion: string;
  estatus: string;
  lineas: OrdenLinea[];
  total: number;         // suma de importes no nulos
}
```

### `dashboard/src/app/api/ordenes/route.ts`

- `GET`, protegido con `verifyGoogleToken` (mismo mecanismo que las rutas existentes; token en header).
- Respuesta: `{ ordenes: OrdenCompra[] }` ordenadas por número descendente.
- Cache en memoria con TTL corto (mismo estilo que `feedCache`) para no golpear la API de Sheets en cada clic.

## Frontend

### Navegación

- Nuevo `SectionId` `'ordenes'` en `dashboard/src/app/page.tsx`, con entrada en el sidebar: label "Órdenes de Compra", sub "Formatos OC para proveedores". El contador del nav muestra el número de órdenes cargadas.
- La sección hace su propio fetch a `/api/ordenes` (no pasa por `/api/feed`).

### `dashboard/src/components/OrdenesCompra.tsx`

- Estado propio: `ordenes`, `loading`, `error`, `seleccionada`, `busqueda`.
- Lista: tabla con N° OC, fecha, proveedor, negociación, estatus, # de materiales y total. Orden descendente por número. Buscador de texto que filtra por número o proveedor.
- Clic en fila → muestra `OrdenPrint` con esa orden + botón "← Volver a la lista" + botón "Imprimir / Guardar PDF" que llama `window.print()`.

### `dashboard/src/components/OrdenPrint.tsx`

Réplica visual del formato del sheet (verificada contra el PDF exportado de la hoja `ORDEN DE COMPRA`):

- Barra naranja superior a ancho completo de la hoja.
- Logo SIDELL en caja negra (archivo `LOGO_PNG.png` del repo copiado a `dashboard/public/logo-oc.png`).
- Columna derecha: título "ORDEN DE COMPRA" con línea naranja debajo, subtítulo "DOCUMENTO DE MATERIALES".
- Cajas con borde gris: **N° DE OC** y **FECHA** lado a lado; debajo **NEGOCIACIÓN**.
- Columna izquierda: label "EMITIDO A (PROVEEDOR)" y nombre del proveedor en caja gris claro con borde izquierdo naranja.
- Tabla de materiales: header fondo negro texto blanco (`MATERIAL / DESCRIPCIÓN`, `EMBALAJE`, `CANTIDAD`, `PRECIO UNITARIO`, `IMPORTE`); filas con línea divisoria inferior; se rellenan filas vacías (solo línea) hasta un mínimo de 8 para conservar la proporción del formato.
- Formatos de número: cantidad `8,000.00`; precio unitario `$69.00`; importe `552,000` (sin decimales, con comas). Solo se muestran importes de líneas reales (no el "0" que aparece en el sheet por fórmula en fila vacía).
- Debajo de la tabla: "**** PRECIO EN DLLS" en negritas, luego "Notas / Condiciones Comerciales:" y caja con texto fijo:
  - El material está sujeto a inspección de calidad en báscula.
  - Se aplicarán mermas según el porcentaje de impurezas detectadas.
  - Horario de recepción: Lunes a Viernes de 8:00 AM a 4:00 PM.
- Pie: "SIDELL Scrap Metal LLC" y barra naranja inferior.
- Fondo blanco siempre (el dashboard es dark; la hoja OC se renderiza como documento claro dentro del layout).

### Impresión

- CSS `@media print`: oculta sidebar, encabezados de sección, lista y botones; deja únicamente la hoja OC. Tamaño carta, márgenes razonables, colores exactos (`print-color-adjust: exact` para barras naranjas y header negro).

## Manejo de errores

- Falla de Sheets API → mensaje "No se pudieron cargar las órdenes" + botón reintentar (mismo patrón que el feed).
- Celdas vacías (fecha, precio, embalaje) → se muestran vacías sin romper el render; `importe` solo se calcula si cantidad y precio son numéricos.
- Token inválido/ausente → 401 del API route, mismo manejo que las rutas existentes.

## Testing

Vitest (framework ya configurado en `dashboard/`):

- `ordenesClient.test.ts`: agrupación por `ORDEN`, filas sin `ORDEN` ignoradas, mapeo por encabezado con columnas reordenadas, parsing de `8,000.00` y `$37.80`, cálculo de importe y total, líneas con datos faltantes.
- `api/ordenes/route.test.ts`: 401 sin token, respuesta feliz con datos agrupados, error de Sheets → respuesta de error.
- `OrdenesCompra.test.tsx`: render de lista, filtrado por buscador, selección de orden muestra la vista OC.
- Verificación manual: `npm run dev`, abrir sección, seleccionar P022, comparar lado a lado contra el PDF exportado del sheet, probar Imprimir / Guardar PDF.

## Fase 2 (fuera de alcance de este spec)

Crear y editar órdenes desde el dashboard (POST que escribe filas en `COMPRAS` del doc de logística, asignación de número de orden). El diseño actual la deja preparada: `ordenesClient.ts` centraliza el acceso al spreadsheet; solo se agregará un writer y el formulario.
