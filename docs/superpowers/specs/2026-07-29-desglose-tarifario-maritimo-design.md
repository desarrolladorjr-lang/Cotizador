# Desglose del tarifario marítimo

Fecha: 2026-07-29
Fuente de datos: `C:\Users\jesus\Downloads\TARIFARIO MENSUAL SIDELL LOGISTICS.xlsx` (hoja `Hoja1`)

## Problema

El tarifario marítimo está integrado a medias. Al elegir Proveedor → Origen → Destino → Equipo → Tipo en el tab Marítimo, la app llena el Ocean Freight (USD) desde `TARIFARIO_DATA`, pero el costo de despacho entra como un total mágico:

```js
// deploy/js/app.js:282
const arrDesp = match.pol === 'Progreso' ? 12974 : 9360;
```

Ese total no se ve en ninguna parte de la UI (`aduanaMex` solo se consume dentro de `costoLogIntKg`) y no se puede auditar: nadie sabe de dónde salen los 12,974.

## Datos reales del xlsx

El desglose de despacho depende **solo del POL**. Las 72 filas del xlsx repiten los mismos dos juegos de valores:

| Concepto (col xlsx) | PROGRESO | ALTAMIRA / ENSENADA |
|---|---|---|
| Pedimento (R) | 846 | 1,010 |
| Maniobras (S) | 2,678 | 2,900 |
| Honorarios (T) | 4,500 | 5,000 |
| Validación (U) | 300 | 300 |
| Servicio COVE (V) | 150 | 150 |
| **Total AA (W)** | **8,474** | **9,360** |
| Arrastre / Transporte Mérida (X) | 4,500 | NA → 0 |
| **Arrastre + Despacho (Z)** | **12,974** | **9,360** |

Los dos totales cuadran exacto con los dos números hardcodeados que se reemplazan.

Fórmulas del xlsx que se replican:
- `W = SUM(R:V)` → Total AA
- `Z = R+S+T+U+V+X` → Arrastre + Despacho
- `AB = K*AA` → OF en MXN (OF USD × T.C.)
- `AC = AB+Z` → Costo Final

## Decisiones tomadas

1. **Desglose de solo lectura.** Se calcula del tarifario y se muestra; no editable. El usuario elige opciones y ve cómo se forma el precio.
2. **T.C. banco (`tcHoy`)** para convertir OF a MXN, no `tcSeguro`.
3. **Consecuencia aceptada:** el motor de costo (`costoLogIntKg`, app.js:446) usa `tcSeguro`, así que el "Costo Final Tarifario" del desglose no coincide con el costo interno de la app. Se etiqueta explícitamente `COSTO FINAL TARIFARIO (T.C. banco)` con nota al pie. Es el número comparable contra el xlsx.
4. **Tabla por POL, no campos por fila.** El xlsx duplica 432 valores idénticos; una tabla de 2 entradas hace que la actualización mensual sea 1 línea por concepto.
5. **Ningún precio existente se mueve.** `aduanaMex` recibe el mismo valor que antes; el cambio es de procedencia (suma vs. constante), no de resultado.

## Diseño

### 1. Datos — `deploy/js/data-tarifario.js`

Al final del archivo, después de `TARIFARIO_DATA`:

```js
// Despacho + arrastre por puerto de salida (MXN). Fuente: TARIFARIO MENSUAL SIDELL LOGISTICS.xlsx
const DESPACHO_POR_POL = {
  'Progreso': { ped: 846,  man: 2678, hon: 4500, val: 300, cove: 150, arr: 4500 },
  '_default': { ped: 1010, man: 2900, hon: 5000, val: 300, cove: 150, arr: 0    }, // Altamira / Ensenada
};

// Devuelve desglose + totales. Nada hardcodeado: totalAA y total son suma.
function calcDespacho(pol) {
  const d = DESPACHO_POR_POL[pol] || DESPACHO_POR_POL['_default'];
  const totalAA = d.ped + d.man + d.hon + d.val + d.cove;   // xlsx col W
  return { ...d, totalAA, total: totalAA + d.arr };          // xlsx col Z
}
```

`_default` cubre Altamira y Ensenada porque en el xlsx son idénticos. Si un mes difieren, se agregan como llaves propias sin tocar el resto.

Los POL presentes en `TARIFARIO_DATA` hoy son: `Progreso`, `Altamira`, `Ensenada`.

### 2. Cableado — `deploy/js/app.js`

En el `useEffect` de selección marítima (líneas 277-293):

```js
const desp = calcDespacho(match.pol);
// ...
setAduanaMex(desp.total.toString());       // rama normal
setSimAduanaMex(desp.total.toString());    // rama simulador
```

Se elimina la línea `const arrDesp = match.pol === 'Progreso' ? 12974 : 9360;`.

Estado nuevo para poder pintar la tabla:

```js
const [maritimoRow, setMaritimoRow] = useState(null);
```

- Se llena con `match` en ese mismo effect.
- Se limpia a `null` en el `onChange` del input manual de OF (app.js:1418), junto a los `setMaritimo*('')` que ya existen ahí.

Razón: si el OF se escribió a mano, el número dejó de venir del tarifario y el desglose ya no aplica. La tabla debe desaparecer, no mostrar un desglose que no corresponde.

### 3. UI — componente `DesgloseMaritimo`

Componente nuevo, declarado fuera del componente principal:

```js
function DesgloseMaritimo({ row, tc, accent }) { ... }
```

- `row`: fila resuelta del tarifario (`maritimoRow`). Si es `null`, el componente no renderiza nada.
- `tc`: `tcHoy` (o `simTcHoy` en simulador).
- `accent`: `'#ff6600'` normal, `'#3b82f6'` en modo simulador — consistente con el resto de la app.

Layout:

```
OCEAN FREIGHT        USD  2,701
T.C. Banco                18.50
OF en MXN            $  49,968
──────────────────────────────────
DESPACHO — PROGRESO
  Pedimento          $     846
  Maniobras          $   2,678
  Honorarios         $   4,500
  Validación         $     300
  Servicio COVE      $     150
  Total AA           $   8,474
  Arrastre           $   4,500
  Arrastre+Despacho  $  12,974
──────────────────────────────────
COSTO FINAL TARIFARIO $ 62,942
(T.C. banco — el motor de costo usa T.C. Seguro)
```

Reglas de presentación:
- Totales (`Total AA`, `Arrastre+Despacho`, `Costo Final Tarifario`) en negritas y color `accent`. Conceptos en gris.
- Miles con `toLocaleString`; MXN sin decimales, OF USD con los decimales que traiga la fila (hay tarifas como 2908.8).
- El encabezado `DESPACHO — <POL>` usa el POL real de la fila, no un literal.
- Si `arr === 0` (Altamira / Ensenada): se omite el renglón Arrastre y el total pasa a llamarse `Total Despacho`.
- Estilo: mismo lenguaje visual que el resto (fondo negro, `rounded-xl`, borde gris, tipografía `text-[10px]`/`text-xs` mono para cifras).

Puntos de render — los dos bloques que ya tienen los selects en cascada, mismo componente:
- Tab **Marítimo**: app.js:1344-1389, debajo del bloque de selects.
- **Compras → Intención de Venta → Marítimo**: app.js:1046-1092, igual.

## Verificación

`deploy/` no tiene suite de tests (vitest cubre solo `dashboard/`), así que la verificación es manual en el navegador:

1. Tab Marítimo → GWT / Mérida / Bilbao / 20' DC → aparece el desglose; confirmar 846+2678+4500+300+150 = 8,474 y +4,500 = 12,974.
2. GWT / Querétaro / Algeciras / 20' DC / Full → confirmar 1,010+2,900+5,000+300+150 = 9,360 y que **no** aparece renglón Arrastre.
3. Editar el OF a mano → el desglose desaparece y los selects se limpian.
4. Confirmar que el precio de venta calculado es idéntico al de antes del cambio (mismo `aduanaMex`).
5. Repetir 1 en Compras → Intención de Venta → Marítimo.

## Fuera de alcance

- Editar el desglose / overrides por cotización. Si se necesita, `DESPACHO_POR_POL` admite un `row.desp` de override en ~4 líneas.
- Cambiar el motor de costo o el T.C. que usa internamente.
- Cargar el xlsx en vivo. El tarifario sigue siendo un archivo JS que se actualiza a mano cada mes.
- Los campos del xlsx que la app ya ignora (vigencia, días libres en columnas O/P, moneda por fila).
