# OC Directa: modo "sin reventa" — design

## Contexto

El módulo OC Directa (`OrdenDirectaForm.tsx`) siempre exige una entidad de
reventa (compra + reventa a otra entidad fiscal, con margen por kg). El
usuario tiene compras donde no hay reventa a otra entidad — compra directa
simple — y hoy el formulario bloquea la generación sin ese dato.

El usuario agregó una hoja nueva llamada **"OC"** al archivo
`PLANTILLA OC.xlsx` (versión en la raíz del repo, sin commitear). Al
inspeccionar esa hoja se confirmó que **no es un formulario ni fuente de
datos independiente**: es una vista de impresión alterna que se auto-calcula
con fórmulas que referencian la hoja `ORDEN DE COMPRA` del mismo libro
(`C16='ORDEN DE COMPRA'!C21`, etc.). No incluye entidad fiscal, margen ni
retención — solo folio, fecha, proveedor ("EMITIDO PARA"), método/forma de
pago, líneas y total. Es decir: ya es el layout correcto para una compra sin
reventa, y no requiere código nuevo para generarse — se recalcula sola al
abrir el xlsx en Excel.

**Conclusión de diseño:** el trabajo real es relajar la exigencia de
reventa en el flujo existente, no construir un módulo nuevo.

## Alcance

Toggle "Sin reventa" dentro de `OrdenDirectaForm` (no una sección/tab
nueva). Cuando está activo:

1. **Template**: reemplazar `dashboard/templates/PLANTILLA OC.xlsx` con la
   versión de la raíz del repo (trae la hoja "OC"). `ocDirectaXlsx.ts` no
   cambia — sigue escribiendo solo en la hoja `ORDEN DE COMPRA`; la hoja
   "OC" se recalcula sola al abrir en Excel.

2. **UI (`OrdenDirectaForm.tsx`)**:
   - Nuevo estado `sinReventa: boolean`, inicial `false` (o
     `!ordenInicial?.entidadReventaNombre` al editar una orden existente —
     se infiere del dato, sin campo nuevo en el schema).
   - Cuando `sinReventa` es `true`: oculta selects "Entidad emisora
     (reventa)" y "Margen por kg"; fuerza `margenPorKg = '0'`.
   - Retención IVA se mantiene visible siempre (aplica al lado compra,
     independiente de si hay reventa).
   - `puedeGenerar = Boolean(proveedor && entidadCompra && (sinReventa ||
     entidadReventa) && calculo.lineas.length > 0)`.
   - Vista de impresión: si `sinReventa`, solo botón "Imprimir/Guardar PDF
     (Compra)" y solo se renderiza `compraRef` (sin bloque reventa).

3. **Print (`OrdenDirectaPrint.tsx`)**:
   - `entidadContraria` pasa a ser opcional (`EntidadFiscal | undefined`).
   - Si falta, usa `{ nombre: proveedor }` como fallback en los dos lugares
     donde se muestra ("EMITIDO PARA" y firma) — igual que la hoja "OC"
     simple, que solo muestra el nombre del proveedor ahí, sin RFC ni
     dirección.

4. **Guardar (`guardarEnDropbox` en `OrdenDirectaForm.tsx` +
   `POST /api/ordenes-directas/guardar`)**:
   - Cliente: si `sinReventa`, solo captura `compraRef`; `imagenes.reventa`
     se omite (`undefined`).
   - Ruta: `imagenes.reventa` pasa a opcional en `GuardarBody`.
     `validar()` ya no exige `entidadReventaNombre` (se infiere sin-reventa
     de que venga vacío). Sube imagen de reventa solo si `body.imagenes.reventa`
     viene. El borrado de la imagen de reventa anterior (al renombrar) se
     sigue intentando siempre — `deleteFile` ya tolera 404/409 sin error.

5. **`ocDirectaXlsx.ts` / cálculo**: sin cambios. Celdas de reventa
   (`L4`, `G10`) quedan vacías cuando no hay entidad reventa —
   `generarXlsx` ya soporta strings vacíos. `calcularOrden` sigue
   calculando ambos lados (compra/reventa); con `margenPorKg = 0` el lado
   reventa simplemente no se usa ni se muestra.

## Fuera de alcance

- No se agrega un tipo de orden nuevo ni tab nuevo en el dashboard.
- No se modifica `ocDirectaXlsx.ts` para escribir en la hoja "OC" — ya se
  calcula sola vía fórmulas.
- No se cambia el schema de `OrdenDirectaDatos` (sin reventa se infiere de
  `entidadReventaNombre` vacío, no se agrega un flag persistido).

## Testing

- `OrdenDirectaForm.test.tsx`: toggle oculta campos reventa/margen;
  `puedeGenerar` habilitado sin entidad reventa cuando `sinReventa`;
  guardado envía `imagenes.reventa` undefined.
- `OrdenDirectaPrint.test.tsx`: render sin `entidadContraria` usa fallback
  proveedor en ambos spots.
- `route.test.ts` (guardar): acepta body sin `imagenes.reventa` cuando
  `entidadReventaNombre` vacío; sigue exigiendo reventa si el campo viene
  lleno pero falta la imagen (evita estados inconsistentes).
