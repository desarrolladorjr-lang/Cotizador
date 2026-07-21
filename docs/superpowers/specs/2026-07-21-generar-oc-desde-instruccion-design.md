# Generar Orden de Compra desde la instrucción (Pipeline Compras)

## Contexto

El drawer de detalle de una operación (`OpDrawer.tsx`) muestra las tarjetas del track
Compras. La primera etapa es `instruccion` (badge PENDIENTE en el kanban). Hoy no hay
forma de generar una Orden de Compra desde ahí — el flujo de OC vive aparte, en la
pestaña "Órdenes Directas" (`OrdenesDirectas.tsx` → `OrdenDirectaForm.tsx`), totalmente
desconectado de la instrucción que lo origina.

## Objetivo

Botón "Generar Orden de Compra" en el drawer, visible solo en la etapa `instruccion`
de operaciones Compras, que abre el formulario existente de OC precargado con
proveedor y material de la instrucción, y que al guardar copia el folio generado al
campo "No. OC" (`noPO`) del registro de pipeline.

## Diseño

### 1. `OpDrawer.tsx`
- Nuevo estado `mostrarOcModal: boolean`.
- Nuevo botón, visible cuando `esCompras && record.etapa === 'instruccion'`:
  `Generar Orden de Compra` → `setMostrarOcModal(true)`.
- Al montar el modal, se le pasan:
  - `credential`
  - `proveedorInicial={row.clienteOProveedor}`
  - `materialInicial={row.material}`
  - `onClose={() => setMostrarOcModal(false)}`
  - `onGenerado={(folio) => guardarNoPO(folio)}`
- `guardarNoPO(folio)`: mismo PATCH que `guardarCambios`, pero con
  `fields: { ...ruteo, ...trabajos, contrato, noPO: folio }`. En éxito: `onSaved`,
  cierra el modal, actualiza el estado local `noPO`.

### 2. `GenerarOcModal.tsx` (nuevo componente)
- Overlay fijo pantalla completa (`position: fixed; inset: 0; z-index: 60`, por
  encima del drawer que usa z-index 50), fondo oscuro semitransparente, contenedor
  centrado con scroll propio.
- Al montar, `fetch('/api/ordenes-directas/archivos', ...)` (mismo endpoint y
  Authorization Bearer que usa `OrdenesDirectas`) para calcular `consecutivoSugerido`
  (máximo consecutivo existente + 1, mismo cálculo que ya existe en
  `OrdenesDirectas.tsx`).
- Renderiza `<OrdenDirectaForm credential proveedorInicial materialInicial
  consecutivoSugerido onGuardado={onGenerado} />` dentro del overlay.
- Botón "Cerrar" / click en backdrop → `onClose`.
- No duplica lista de archivos ni vista "editar": solo cubre el caso "nueva orden".

### 3. `OrdenDirectaForm.tsx`
- Dos props nuevas, opcionales: `proveedorInicial?: string`, `materialInicial?: string`.
- Solo se aplican cuando `ordenInicial` no viene (caso "nueva orden"; el caso
  "editar" ignora estas props, igual que hoy).
- `proveedor` inicial: `ordenInicial?.proveedor ?? proveedorInicial ?? ''`.
- `lineas` inicial: si no hay `ordenInicial.lineas` y viene `materialInicial`, la
  primera línea nace con `material: materialInicial` (resto de la línea vacío,
  cantidad/precio los captura el usuario). Si el valor no calza exacto con las
  opciones del `<select>` del catálogo, el select simplemente queda sin selección
  (comportamiento estándar de `<select>`, no requiere manejo especial).
- `onGuardado` cambia de `() => void` a `(folio: string) => void`. En
  `guardarEnDropbox`, tras guardar con éxito: `onGuardado?.(folio)` en vez de
  `onGuardado?.()`.
- `OrdenesDirectas.tsx` (el único otro consumidor) no usa el argumento — sigue
  funcionando sin cambios porque JS ignora argumentos extra en callbacks tipo
  `() => load()`. Se actualiza su firma de prop a `(folio: string) => void` solo si
  TypeScript lo exige por la nueva firma del tipo; el cuerpo (`load`) no cambia.

## Fuera de alcance

- No se toca ningún API route.
- No se agrega edición de OC ya generadas desde el drawer (solo creación).
- No se valida que `proveedorInicial`/`materialInicial` existan en el catálogo antes
  de precargar — si no calzan, el usuario simplemente los selecciona manualmente.
- El botón no aparece en otras etapas de Compras ni en track Ventas.

## Testing

- `OpDrawer.test.tsx`: botón visible solo en etapa `instruccion` de Compras; abre
  modal; `onGenerado` dispara PATCH con `noPO` = folio recibido.
- `OrdenDirectaForm.test.tsx`: con `proveedorInicial`/`materialInicial` y sin
  `ordenInicial`, el estado inicial refleja esos valores; `onGuardado` se invoca con
  el folio construido.
- Nuevo `GenerarOcModal.test.tsx`: fetch de archivos calcula consecutivo sugerido;
  cierra con backdrop/botón; delega guardado a `OrdenDirectaForm`.
