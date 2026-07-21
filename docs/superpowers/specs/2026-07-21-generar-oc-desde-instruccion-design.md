# Generar Orden de Compra desde la instrucción (Pipeline Compras)

> **Revisión 2026-07-21b:** el diseño original (abajo, sección "Revisión 1 — DESCARTADA")
> reutilizaba `OrdenDirectaForm` (el flujo de compra/reventa con Dropbox). El usuario
> aclaró que el documento correcto es el formato de `OrdenPrint.tsx` (N° OC, Negociación,
> Proveedor, líneas Material/Embalaje/Cantidad/Precio/Importe — el mismo que usa la
> pestaña "Órdenes de Compra"). Esta sección es la vigente; la Revisión 1 queda como
> registro histórico de lo que se implementó y luego se revirtió/reemplazó.

## Contexto

El drawer de detalle de una operación (`OpDrawer.tsx`) muestra las tarjetas del track
Compras. La primera etapa es `instruccion` (badge PENDIENTE en el kanban). El documento
"Orden de Compra" que la empresa realmente usa tiene el formato de `OrdenPrint.tsx`
(logo, N° DE OC, FECHA, NEGOCIACIÓN, EMITIDO A (PROVEEDOR), tabla de líneas
Material/Embalaje/Cantidad/Precio Unitario/Importe, TOTAL) — hoy esas órdenes son
**solo lectura**, leídas de un Google Sheet de logística (`ordenesClient.ts` →
spreadsheet `17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM`, hoja `COMPRAS`). No existe
ninguna forma de crear una OC nueva en ese formato desde la app.

## Objetivo

Botón "Generar Orden de Compra" en el drawer, visible solo en la etapa `instruccion`
de operaciones Compras, que abre un formulario simple precargado con proveedor y
material de la instrucción, permite completar líneas (material/embalaje/cantidad/
precio), y genera el documento con el mismo diseño visual de `OrdenPrint.tsx` para
imprimir/guardar como PDF. Al generar, el N° de OC capturado se copia al campo
"No. OC" (`noPO`) del registro de pipeline.

**Fuera de alcance (decisión explícita del usuario):** el documento generado NO se
escribe al Google Sheet de logística — es un documento generado y capturado solo
dentro de la app, sin persistencia en ningún backend. Es equivalente a llenar el
PDF a mano pero con el formulario ayudando a hacer los cálculos.

## Diseño

### 1. `OcSimpleForm.tsx` (nuevo componente)
Formulario de captura, sin llamadas a red (a diferencia de `OrdenDirectaForm`, que
carga catálogos remotos — aquí todo es texto libre, no hay catálogo de proveedores/
materiales para este flujo).

Props:
```ts
interface OcSimpleFormProps {
  proveedorInicial: string;
  materialInicial: string;
  onGenerado: (numero: string) => void;
}
```

Estado interno:
- `numero` (texto libre, ej. "P054")
- `fecha` (input date, default hoy)
- `negociacion` (texto libre, ej. "RECOLECCION")
- `proveedor` (texto libre, precargado con `proveedorInicial`, editable)
- `lineas: LineaForm[]` donde `LineaForm = { material: string; embalaje: string;
  cantidadKg: string; precioUnitario: string }` — arranca con una línea cuyo
  `material` es `materialInicial` y el resto vacío. Botón "+ Agregar línea" /
  "Quitar" por fila, mismo patrón que `OrdenDirectaForm.tsx` (sin límite `MAX_LINEAS`
  — no aplica aquí, es un documento de una sola orden, no hay restricción de sheet).
- Cálculo derivado (no estado, `useMemo`): cada línea → `importe = cantidadKg *
  precioUnitario` (o `null` si cualquiera de los dos está vacío/no numérico, mismo
  criterio que `parseNumero` en `ordenesShared.ts`); `total = suma de importes no
  nulos`.

Botón "Generar documento" (habilitado si `numero`, `proveedor` y al menos una línea
con material+cantidad+precio completos) construye un objeto `OrdenCompra` (tipo ya
existente en `@/lib/ordenesShared`: `{ numero, fecha, proveedor, negociacion, estatus:
'', lineas, total }`) y cambia a vista de documento:
- Renderiza `<OrdenPrint orden={orden} />` dentro de un contenedor con clase
  `oc-print-area` (mismo patrón que `OrdenesCompra.tsx`).
- Botón "← Editar" (regresa a captura sin perder datos, mismo patrón que
  `OrdenDirectaForm`).
- Botón "Imprimir / Guardar PDF" → `window.print()` (idéntico a `OrdenesCompra.tsx`).
- Al entrar a la vista de documento (primera vez que se genera), llama
  `onGenerado(numero)`.

### 2. `GenerarOcModal.tsx` (ya existe, se modifica)
- Se quita el `useEffect`/fetch a `/api/ordenes-directas/archivos` y el estado
  `consecutivoSugerido` — ya no aplica (no hay catálogo de consecutivos para este
  documento suelto).
- Se quita la prop `credential` (ya no se necesita — `OcSimpleForm` no llama red).
- Renderiza `<OcSimpleForm proveedorInicial materialInicial onGenerado={onGenerado} />`
  en vez de `<OrdenDirectaForm ... />`, dentro del mismo overlay/backdrop/botón
  "Cerrar" que ya existen (sin cambios en esa parte).
- La prop `error` añadida en el fix del review anterior se mantiene igual (sigue
  aplicando: si el PATCH de `noPO` en `OpDrawer` falla, el mensaje debe verse dentro
  del modal).

### 3. `OpDrawer.tsx`
- Sin cambios en la lógica de `guardarNoPO` (ya recibe un string y lo manda como
  `noPO` — sigue funcionando igual, ahora recibe el `numero` capturado en vez de un
  folio con formato `OC.N/Directo`).
- Se quita la prop `credential` al renderizar `<GenerarOcModal />` (ya no aplica).
- El resto (botón visible solo en `esCompras && record.etapa === 'instruccion'`,
  `showOcModal`, wiring de `onClose`/`onGenerado`) no cambia.

## Fuera de alcance

- No se toca ningún API route (no hay lectura ni escritura de red en este flujo).
- No hay catálogo de proveedores/materiales — todo texto libre, coherente con que
  es un documento ad-hoc, no ligado al sheet de logística.
- No hay numeración automática de N° de OC — el usuario lo escribe a mano.
- No hay historial/lista de OCs generadas por este flujo (a diferencia de "Órdenes
  Directas") — es generar → imprimir → cerrar, sin guardar nada.

## Testing

- `OcSimpleForm.test.tsx` (nuevo): precarga proveedor/material; agrega/quita líneas;
  calcula importe y total correctamente (incluye caso cantidad o precio vacío →
  importe null, no rompe el total); botón "Generar documento" deshabilitado sin
  datos mínimos; al generar muestra `OrdenPrint` y llama `onGenerado(numero)`;
  "← Editar" regresa sin perder datos.
- `GenerarOcModal.test.tsx` (se actualiza): ya no hace fetch de archivos/consecutivo;
  renderiza `OcSimpleForm` con las props correctas; comportamiento de backdrop/cerrar/
  error sin cambios (tests existentes de esa parte se mantienen).
- `OpDrawer.test.tsx`: sin cambios de fondo — los tests de "botón visible solo en
  instrucción" y "PATCH con noPO = valor recibido de onGenerado" siguen validando lo
  mismo, solo cambia qué string simulan como argumento (ya no hace falta que tenga
  forma de folio).

---

## Revisión 1 — DESCARTADA (registro histórico)

Diseño original, implementado en los commits `e2c548f`, `d98682a`, `1a03e34`, `acf0015`
del repo `dashboard` y luego descartado por no ser el documento correcto:

Reutilizaba `OrdenDirectaForm.tsx` (flujo compra/reventa con catálogo remoto, folio
`OC.N/Directo`, guardado en Dropbox) dentro de un modal `GenerarOcModal`, con prefill
de proveedor/material vía dos props nuevas y un `onGuardado` que devolvía el folio
generado para copiarlo a `noPO`. **Decisión:** las props `proveedorInicial`/`materialInicial` y el cambio de firma de
`onGuardado` a `(folio: string) => void` en `OrdenDirectaForm.tsx` quedan sin ningún
consumidor una vez aplicada esta revisión (el modal ya no usa `OrdenDirectaForm`).
Por YAGNI, el plan de implementación las revierte: `OrdenDirectaForm.tsx` vuelve a su
forma previa a la Revisión 1 (props originales, `onGuardado?: () => void`), y se
eliminan los dos tests que esta feature le había agregado. `OrdenesDirectas.tsx` (el
único consumidor real de `OrdenDirectaForm`) no se ve afectado por este revert.
