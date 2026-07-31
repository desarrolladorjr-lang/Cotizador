# Captura unificada del Cotizador (una sola pantalla)

Fecha: 2026-07-31
Archivo objetivo: `deploy/js/app.js` (101 KB, un solo componente)

## Problema

La captura está repartida en 4 pestañas (Terrestre, Marítimo, Nacional, Compras) y
dentro de cada una hay hasta tres ejes anidados más: `Back to Back / Simular`,
`Surtir / Nuevo`, y en Compras `Inventario / Int. Venta / Int. Compra` con **otra**
selección de modalidad (Nacional/Marítimo/Terrestre) por debajo.

Consecuencias:

- "Modalidad" existe en dos niveles distintos del árbol y significa lo mismo.
- El bloque `compras/intencionVenta` reimplementa campo por campo los formularios de
  Terrestre y Marítimo: `% Fijación`, `Fix Price`, `T.C. Banco/Seguro`, `Flete Int.`,
  la cascada de Ocean Freight y el desglose marítimo están escritos dos veces.
- El modo Simular duplica ~15 estados (`simPrecioVenta`, `simFleteNac`, `simTcHoy`…)
  y un segundo `useEffect` de cálculo que replica la fórmula del principal.
- Hay dos campos distintos para el precio de compra: `ppProv` (x KG, al final del
  formulario) y `precioCompraMxnCompras` (MXN total, dentro de Compras).

## Objetivo

Una sola pantalla. Primero se elige **qué** se va a cotizar; a partir de esa elección
se desbloquean hacia abajo los campos que aplican. Ningún campo escrito dos veces.

## Modelo

Un único estado raíz:

```js
modalidad ∈ { 'terrestre' | 'maritimo' | 'nacional' | 'inventario' }
```

Derivado, no es estado:

```js
const tieneVenta = modalidad !== 'inventario';
```

Cada cotización captura **la compra siempre** y **la venta cuando la hay**. `inventario`
es el caso de compra sin venta ligada todavía.

### Estado que se elimina

| Estado | Motivo |
|---|---|
| `activeTab` | Reemplazado por `modalidad` |
| `compraDirecta`, `modoNuevoSurtido` | Back to Back sale del alcance (ver Fuera de alcance) |
| `contrato`, `pendientes`, `hasFetchedPendientes`, `cargandoPendientes`, `errorPendientes`, `fetchPendientes()` | Sólo servían a Back to Back |
| `modoSimulador` y todos los `sim*` (~15 estados + su `useEffect` de cálculo + `obtenerTipoDeCambioSim`) | El modo Simular desaparece |
| `comprasTipo`, `intencionVentaModalidad` | Absorbidos por `modalidad` |
| `precioCompraMxnCompras` | Se fusiona con `ppProv` (ver §4) |

Cambiar de chip **no** borra lo capturado en el bloque de compra; sólo cambia qué
campos muestra el bloque de venta.

## Layout

```
┌ [Terrestre] [Marítimo] [Nacional] [Inventario] ┐  paso 1 — modalidad
├ COMPRA   (siempre visible)                     ┤  paso 2
├ VENTA    (si tieneVenta)                       ┤  paso 3
└ Resultado + Guardar                            ┘
```

## §1 — Selector de modalidad

Cuatro chips en una fila, reemplazan la barra de pestañas actual. Terrestre / Marítimo /
Nacional en naranja `#ff6600` (el acento actual); Inventario en verde `#16a34a` (el color
que hoy usa la pestaña Compras).

## §2 — Bloque COMPRA

Idéntico en las cuatro modalidades. Toma los campos que hoy sólo existen dentro de la
pestaña Compras:

- **Proveedores y cargas** — filas `{ proveedor, cargas }`, botón `✕` para quitar
  (mínimo una fila), total KG/LB calculado.
- **Embalaje** — `PACAS | JUMBOS | GAYLORD`
- **Negociación** — `RECOLECCION DIRECTA | RECOLECCION BMTY | DIRECTO ENTREGA | BMTY ENTREGA | LAREDO ENTREGA`
- **Material** — catálogo por modalidad (`optionsMaterial*`)
- **Origen → Destino (flete nacional)** — autollena `fleteNac` desde
  `FLETES_NACIONALES_COMPRAS`; si no hay match, `fleteNac = "0"`.
- **Flete Nac.** — editable; editarlo a mano limpia origen y destino.
- **Precio de compra** — campo único, ver §4.

Capacidad por carga según modalidad:

| Modalidad | kg por carga |
|---|---|
| terrestre | 19 500 |
| maritimo | `capacidadCNT × 1000` |
| nacional, inventario | 24 500 |

## §3 — Bloque VENTA

Sólo si `tieneVenta`. Cada campo se define **una vez** y se muestra según modalidad:

| Campo | terrestre | maritimo | nacional |
|---|:--:|:--:|:--:|
| Cliente | ✓ | ✓ | ✓ |
| Destino | ✓ | ✓ | ✓ |
| Precio Total MXN / Precio x Ton (auto ×24.5) | — | — | ✓ |
| % Fijación · Fix Price · Venta x KG (readonly) | ✓ | ✓ | — |
| Días crédito · Merma | ✓ | ✓ | — |
| T.C. Banco (con botón actualizar) · T.C. Seguro (readonly) | ✓ | ✓ | — |
| Flete Int. — selector de ruta o captura manual USD | ✓ | — | — |
| Ocean Freight — cascada proveedor→origen→POD→equipo→tipo | — | ✓ | — |
| `<DesgloseMaritimo>` | — | ✓ | — |
| Origen embarque | — | ✓ | — |
| Cap. contenedor (slider 5–30 TON) | — | ✓ | — |

Comportamientos que se conservan tal cual:

- Proveedor marítimo **sin tarifario**: se oculta la cascada, se captura el ocean freight
  manual en USD y `aduanaMex` pasa a `"0"` (el despacho ya viene dentro del cruce). Al
  volver a un proveedor con tarifario, `aduanaMex` regresa a `"2308"`.
- Editar `cruceInt` a mano limpia la selección de tarifario marítimo.
- Ruta de flete en MXN se convierte a USD dividiendo entre el T.C. capturado.

`aduanaMex` (`"2308"`), `aduanaUsa` (`"65"`) y `maniobras` (`"0.60"`) siguen siendo
parámetros internos con default, no capturados en el formulario.

## §4 — Precio de compra unificado

Hoy conviven `ppProv` ("¿A cuánto lo cerraste?", x KG) y `precioCompraMxnCompras`
("Precio Compra MXN total"). Queda **un solo campo, en el bloque COMPRA**. El bloque de
resultado lo lee, no lo vuelve a pedir.

**Unidad: MXN por KG** — la misma que `ppProv` hoy, que es la que compara contra el tope.
El total en MXN se deriva, no se captura:

```js
precioCompraMxn = ppProv * kgTotales   // kgTotales = cargas × kg por carga (§2)
```

Debajo del campo se muestra el total derivado en gris, como referencia.

- Con venta: se muestra **Tope Máximo de Compra** y el semáforo
  (`good` / `warning` / `bad`) comparando el precio capturado contra el tope.
- Inventario: no hay ingreso, por lo tanto no hay tope ni semáforo. Se guarda el costo
  capturado y se muestra el total, sin evaluación.

## §5 — Payload

El payload a Google Apps Script no cambia de forma: `Codigo.gs`, las columnas de la hoja
y el dashboard quedan intactos. Se mapea desde el modelo nuevo:

```js
modalidad      : { terrestre:'Terrestre', maritimo:'Marítimo',
                   nacional:'Nacional',  inventario:'Compras' }[modalidad]
cliente        : tieneVenta ? cliente : ''
proveedor      : proveedores.map(r => r.proveedor).join(', ')
cargas         : proveedores.reduce((s, r) => s + (Number(r.cargas) || 0), 0)
paraInventarios: modalidad === 'inventario'
intencionVenta : tieneVenta
intencionCompra: false
tipoCompra     : 'Compra Mercado'
contrato       : ''
origenEmbarque : modalidad === 'maritimo' ? origenEmbarque : ''
origenFlete    : comprasOrigenFlete
destinoFlete   : comprasDestinoFlete
ppProv         : precio de compra capturado, MXN x KG (§4)
precioCompraMxn: ppProv * kgTotales — derivado, ya no se captura aparte
```

Los sufijos `[INV]` / `[IV]` / `[IC]` que hoy se concatenan al nombre del proveedor
desaparecen: la intención ya está en `paraInventarios` / `intencionVenta`, que se derivan
de `modalidad` y aplican al registro completo, no por fila de proveedor.

**`intencionCompra` queda permanentemente en `false`.** El tipo "Intención de Compra" de
la pestaña Compras se retira: en la práctica era lo mismo que Inventario, y esos casos se
capturan ahora con el chip Inventario. El campo se conserva en el payload por contrato con
la hoja, pero ya no hay estado que lo active.

`origenFlete`, `destinoFlete` y `precioCompraMxn` pasan a llenarse en **las cuatro**
modalidades, no sólo en Compras como hoy. Es consecuencia directa de que el bloque de
compra sea universal y de que el precio de compra sea un solo campo (§4): la hoja empieza
a recibir valores en columnas que antes venían vacías o en cero para Terrestre, Marítimo y
Nacional. Es intencional.

El resto de campos (`fecha`, `usuario`, `material`, `destino`, `porcentajeFijacion`,
`fixPrice`, `precioVenta`, `tcHoy`, `tcSeguro`, `fleteNac`, `cruceInt`,
`precioTopeCompra`, `status`, `utilidadNeta`, `notas`, `embalaje`, `negociacion`)
conserva nombre, tipo y significado.

En inventario, `precioVenta`, `precioTopeCompra` y `utilidadNeta` se mandan en `0` y
`status` en `''`, porque sin venta no hay tope que calcular.

## §6 — Estructura de archivos

Sin build step: se mantienen los `<script type="text/babel">` que transpila Babel en el
navegador, igual que hoy.

```
deploy/js/app.js               shell, login, estado raíz, mapeo del payload
deploy/js/blocks/Compra.js     bloque compra (único)
deploy/js/blocks/VentaTerrestre.js
deploy/js/blocks/VentaMaritimo.js   incluye la cascada y <DesgloseMaritimo>
deploy/js/blocks/VentaNacional.js
deploy/js/calc.js              tope, utilidad, status — un solo motor
```

Cada archivo entra como `<script type="text/babel" src="...">` en `deploy/index.html`,
antes de `app.js`, con el mismo parámetro `?v=` de cache busting.

Los componentes de bloque reciben props explícitas (valores + setters) y no leen estado
global. `calc.js` expone funciones puras que reciben los números y devuelven
`{ precioVenta, precioTopeCompra, utilidadNeta, status }`, sin ramas `sim*`.

## Fuera de alcance

- **Back to Back / Surtir pendientes.** Se retira por ahora; se reintegrará después
  dentro del bloque de venta (selector "pendiente existente / cliente nuevo"). Mientras
  tanto no se hace el fetch de pendientes ni se captura `contrato`.
- **Modo Simular.** Se elimina y no vuelve.
- Cambios en `Codigo.gs`, en la hoja de cálculo o en el dashboard.

## Verificación

- Guardar una cotización en cada una de las cuatro modalidades y confirmar que la fila
  escrita en la hoja tiene las mismas columnas y valores que antes del cambio.
- Marítimo con proveedor con tarifario y sin tarifario: `aduanaMex` en `"2308"` y `"0"`
  respectivamente, y el tope resultante coincide con el de la versión actual.
- Cambiar de chip conserva lo capturado en el bloque de compra.
- Inventario: no aparece bloque de venta, no aparece tope ni semáforo, y el payload sale
  con `paraInventarios: true`, `intencionVenta: false`, `modalidad: 'Compras'`.
