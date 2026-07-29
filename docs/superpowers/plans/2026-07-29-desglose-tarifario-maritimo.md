# Desglose del Tarifario Marítimo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el total de despacho hardcodeado (`12974`/`9360`) por una tabla por POL con sumas calculadas, y mostrar el desglose completo de precios de solo lectura bajo los selects del tarifario marítimo.

**Architecture:** Los valores de despacho viven en una tabla `DESPACHO_POR_POL` en `deploy/js/data-tarifario.js` junto a `TARIFARIO_DATA`, con una función pura `calcDespacho(pol)` que devuelve el desglose y las dos sumas (`totalAA`, `total`). `app.js` consume esa función en el `useEffect` de selección marítima en lugar del ternario hardcodeado, guarda la fila resuelta en un estado nuevo `maritimoRow`, y la pasa a un componente presentacional nuevo `DesgloseMaritimo` que se renderiza en los dos bloques que ya tienen los selects en cascada.

**Tech Stack:** React 18 vía UMD + Babel standalone en el navegador (sin build step). Tailwind vía CDN. `deploy/js/*.js` son scripts globales cargados por `deploy/index.html` — **no** módulos ES, sin `import`/`export`. Node solo se usa para verificar la función pura desde la terminal.

**Spec:** `docs/superpowers/specs/2026-07-29-desglose-tarifario-maritimo-design.md`

## Global Constraints

- `deploy/js/data-tarifario.js` se carga como `<script>` plano (`deploy/index.html:34`). Declarar todo con `const`/`function` en el ámbito global. **Nunca** agregar `export`, `module.exports` ni `import`.
- `deploy/js/app.js` se carga como `type="text/babel"`. JSX permitido. Sin `import`.
- No existe suite de tests para `deploy/` (vitest cubre solo `dashboard/`). La verificación de la función pura es un comando `node -e` en la terminal; la verificación de UI es manual en el navegador.
- **Ningún precio calculado debe cambiar.** `aduanaMex` debe seguir recibiendo exactamente `12974` para POL `Progreso` y `9360` para `Altamira`/`Ensenada`.
- Valores exactos del xlsx, MXN, no negociables:
  - `Progreso`: pedimento `846`, maniobras `2678`, honorarios `4500`, validación `300`, COVE `150`, arrastre `4500` → Total AA `8474`, total `12974`
  - `Altamira` / `Ensenada` (`_default`): pedimento `1010`, maniobras `2900`, honorarios `5000`, validación `300`, COVE `150`, arrastre `0` → Total AA `9360`, total `9360`
- El desglose usa **T.C. banco** (`tcHoy` / `simTcHoy`), no `tcSeguro`. El renglón final se llama `COSTO FINAL TARIFARIO` y lleva la nota al pie sobre T.C. Seguro.
- Acento de color: `#ff6600` normal, `#3b82f6` en modo simulador.
- Los comentarios y strings de UI van en español, como el resto del archivo.
- Commits en español, formato Conventional Commits, con trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `deploy/js/data-tarifario.js` | Datos del tarifario + fórmulas de despacho. Única fuente de verdad de costos. | Modificar (agregar al final) |
| `deploy/js/app.js` | App React. Consume `calcDespacho`, mantiene `maritimoRow`, renderiza `DesgloseMaritimo`. | Modificar (4 puntos) |

No se crean archivos. El componente `DesgloseMaritimo` va en `app.js` porque `index.html` carga una lista fija de scripts y agregar un archivo nuevo requeriría tocar el HTML sin ganancia — el componente son ~45 líneas y solo lo usa `App`.

---

### Task 1: Tabla de despacho y función `calcDespacho`

**Files:**
- Modify: `deploy/js/data-tarifario.js` (agregar después de la línea final `];`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `DESPACHO_POR_POL` — objeto. Llaves: nombres de POL (`'Progreso'`) más `'_default'`. Valores: `{ ped: number, man: number, hon: number, val: number, cove: number, arr: number }`.
  - `calcDespacho(pol: string) => { ped: number, man: number, hon: number, val: number, cove: number, arr: number, totalAA: number, total: number }` — función pura, global. Un POL desconocido cae a `'_default'`.

- [ ] **Step 1: Agregar la tabla y la función al final de `deploy/js/data-tarifario.js`**

El archivo termina con `];` (cierre de `TARIFARIO_DATA`). Agregar después, dejando una línea en blanco:

```js

// Despacho + arrastre por puerto de salida (MXN). Fuente: TARIFARIO MENSUAL SIDELL LOGISTICS.xlsx
// Los valores dependen solo del POL: el xlsx repite los mismos dos juegos en sus 72 filas.
const DESPACHO_POR_POL = {
  'Progreso': { ped: 846,  man: 2678, hon: 4500, val: 300, cove: 150, arr: 4500 },
  '_default': { ped: 1010, man: 2900, hon: 5000, val: 300, cove: 150, arr: 0    }, // Altamira / Ensenada
};

// Desglose + totales de despacho para un POL. Las sumas se calculan, no se hardcodean.
function calcDespacho(pol) {
  const d = DESPACHO_POR_POL[pol] || DESPACHO_POR_POL['_default'];
  const totalAA = d.ped + d.man + d.hon + d.val + d.cove;  // xlsx col W = SUM(R:V)
  return { ...d, totalAA, total: totalAA + d.arr };         // xlsx col Z = R+S+T+U+V+X
}
```

- [ ] **Step 2: Verificar los totales y que todos los POL del tarifario estén cubiertos**

Desde `C:\Users\jesus\Documents\Cotizador`, en Bash:

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('deploy/js/data-tarifario.js', 'utf8');
const { calcDespacho, TARIFARIO_DATA } = new Function(src + '; return { calcDespacho, TARIFARIO_DATA };')();
const a = require('assert');

// Totales que reemplazan los hardcodeos de app.js
a.strictEqual(calcDespacho('Progreso').totalAA, 8474, 'Total AA Progreso');
a.strictEqual(calcDespacho('Progreso').total, 12974, 'Arrastre+Despacho Progreso');
a.strictEqual(calcDespacho('Altamira').totalAA, 9360, 'Total AA Altamira');
a.strictEqual(calcDespacho('Altamira').total, 9360, 'Total Altamira (sin arrastre)');
a.strictEqual(calcDespacho('Ensenada').total, 9360, 'Total Ensenada');
a.strictEqual(calcDespacho('POL_QUE_NO_EXISTE').total, 9360, 'POL desconocido cae a _default');

// Conceptos individuales
const p = calcDespacho('Progreso');
a.deepStrictEqual([p.ped, p.man, p.hon, p.val, p.cove, p.arr], [846, 2678, 4500, 300, 150, 4500], 'Conceptos Progreso');

// Todo POL del tarifario resuelve a un total > 0
const pols = [...new Set(TARIFARIO_DATA.map(r => r.pol))];
pols.forEach(pol => a.ok(calcDespacho(pol).total > 0, 'POL sin total: ' + pol));

console.log('OK — POL en el tarifario:', pols.join(', '));
"
```

Esperado: `OK — POL en el tarifario: Progreso, Altamira, Ensenada`

Si algún assert truena, corregir los valores en `DESPACHO_POR_POL` contra la tabla de Global Constraints y volver a correr. Si aparece un POL nuevo no listado ahí, cae a `_default` y el assert pasa — anotarlo pero no bloquear.

- [ ] **Step 3: Commit**

```bash
git add deploy/js/data-tarifario.js
git commit -m "feat(tarifario): tabla de despacho por POL con sumas calculadas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Cablear `calcDespacho` y guardar la fila resuelta

**Files:**
- Modify: `deploy/js/app.js:92` (estado nuevo, después de `maritimoTipo`)
- Modify: `deploy/js/app.js:277-293` (el `useEffect` de selección marítima)
- Modify: `deploy/js/app.js:1418` (el `onChange` del input manual de OF)

**Interfaces:**
- Consumes: `calcDespacho(pol)` de Task 1.
- Produces: estado `maritimoRow` — la fila de `TARIFARIO_DATA` seleccionada, o `null`. Task 3 la lee. Forma de la fila: `{ p, o, pol, pod, pais, nav, tt, via, eq, tipo, of, dlo, dld }`.

- [ ] **Step 1: Declarar el estado `maritimoRow`**

En `deploy/js/app.js`, línea 92 es:

```js
  const [maritimoTipo, setMaritimoTipo] = useState('');
```

Agregar justo debajo:

```js
  const [maritimoRow, setMaritimoRow] = useState(null); // fila del tarifario resuelta, para el desglose
```

- [ ] **Step 2: Reemplazar el ternario hardcodeado por `calcDespacho`**

El `useEffect` en las líneas 277-293 dice hoy:

```js
  useEffect(() => {
    const rows = TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino && r.eq === maritimoEquipo);
    const hasTipo = rows.some(r => r.tipo !== null);
    const match = hasTipo ? rows.find(r => r.tipo === maritimoTipo) : rows[0];
    if (match) {
      const arrDesp = match.pol === 'Progreso' ? 12974 : 9360;
      if (modoSimulador) {
        setSimCruceInt(match.of.toString());
        setSimAduanaMex(arrDesp.toString());
        setSimRutaIntSelect('');
      } else {
        setCruceInt(match.of.toString());
        setAduanaMex(arrDesp.toString());
        setRutaIntSelect('');
      }
    }
  }, [maritimoProveedor, maritimoOrigen, maritimoDestino, maritimoEquipo, maritimoTipo, modoSimulador]);
```

Reemplazarlo completo por:

```js
  useEffect(() => {
    const rows = TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino && r.eq === maritimoEquipo);
    const hasTipo = rows.some(r => r.tipo !== null);
    const match = hasTipo ? rows.find(r => r.tipo === maritimoTipo) : rows[0];
    if (match) {
      const desp = calcDespacho(match.pol);
      setMaritimoRow(match);
      if (modoSimulador) {
        setSimCruceInt(match.of.toString());
        setSimAduanaMex(desp.total.toString());
        setSimRutaIntSelect('');
      } else {
        setCruceInt(match.of.toString());
        setAduanaMex(desp.total.toString());
        setRutaIntSelect('');
      }
    } else {
      setMaritimoRow(null);
    }
  }, [maritimoProveedor, maritimoOrigen, maritimoDestino, maritimoEquipo, maritimoTipo, modoSimulador]);
```

Dos cambios: `arrDesp` hardcodeado → `desp.total`, y el nuevo `setMaritimoRow(match)` / `setMaritimoRow(null)`. La rama `else` es nueva: hoy no existe, y sin ella el desglose se quedaría pegado al cambiar un select a una combinación incompleta.

- [ ] **Step 3: Limpiar `maritimoRow` cuando el OF se edita a mano**

En la línea 1418, el input de OF tiene este `onChange`:

```js
onChange={e => { (modoSimulador ? setSimCruceInt : setCruceInt)(e.target.value); (modoSimulador ? setSimRutaIntSelect : setRutaIntSelect)(''); if(activeTab === 'maritimo') { setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); } }}
```

Agregar `setMaritimoRow(null);` dentro del bloque `if(activeTab === 'maritimo')`, al final:

```js
onChange={e => { (modoSimulador ? setSimCruceInt : setCruceInt)(e.target.value); (modoSimulador ? setSimRutaIntSelect : setRutaIntSelect)(''); if(activeTab === 'maritimo') { setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); setMaritimoRow(null); } }}
```

Nota: limpiar los selects ya dispara el `useEffect` del Step 2, que pondría `maritimoRow` en `null` de todas formas. El `setMaritimoRow(null)` explícito evita un frame intermedio donde la tabla se pinta con datos viejos. Ponerlo igual.

- [ ] **Step 4: Verificar que los precios no se movieron**

Abrir `deploy/index.html` en el navegador (doble clic sirve; no requiere servidor). Consola del navegador abierta para ver errores de Babel.

1. Tab **Marítimo** → Proveedor `GWT` → Origen `Mérida` → Destino `Bilbao` → Equipo `20' DC`.
2. En la consola: `document.querySelector('input[type=number]')` no sirve para leer `aduanaMex` porque no tiene UI. En su lugar, confirmar el **precio de venta calculado** que muestra la app y anotarlo.
3. `git stash` → recargar → repetir los mismos pasos → confirmar que el precio es **idéntico**.
4. `git stash pop`.

Esperado: mismo precio con y sin el cambio. Cero errores en consola.

Si el precio cambia, el bug está en `desp.total` — verificar con el comando `node -e` de Task 1 Step 2 que `calcDespacho('Progreso').total === 12974`.

- [ ] **Step 5: Commit**

```bash
git add deploy/js/app.js
git commit -m "refactor(cotizador): usa calcDespacho en vez de total hardcodeado

Mismo valor de aduanaMex (12974 / 9360), ahora sumado desde
DESPACHO_POR_POL. Guarda la fila resuelta en maritimoRow.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Componente `DesgloseMaritimo` y su render

**Files:**
- Modify: `deploy/js/app.js:1-2` (insertar el componente antes de `function App()`)
- Modify: `deploy/js/app.js:1388-1390` (render en el tab Marítimo)
- Modify: `deploy/js/app.js:1090-1091` (render en Compras → Intención de Venta → Marítimo)

**Interfaces:**
- Consumes: `calcDespacho(pol)` de Task 1; estado `maritimoRow` de Task 2.
- Produces: componente global `DesgloseMaritimo({ row, tc, accent })`.
  - `row`: fila de `TARIFARIO_DATA` o `null`. Si es `null` o falsy, retorna `null` (no renderiza).
  - `tc`: string o number. El T.C. banco. Si no parsea a > 0, los renglones en MXN que dependen del T.C. muestran `—`.
  - `accent`: string de color hex para totales.

- [ ] **Step 1: Insertar el componente**

`deploy/js/app.js` empieza así:

```js
const { useState, useEffect } = React;

function App() {
```

Insertar el componente entre la línea 1 y `function App()`:

```js
const { useState, useEffect } = React;

// Desglose de solo lectura del tarifario marítimo. Replica las columnas del xlsx.
function DesgloseMaritimo({ row, tc, accent }) {
  if (!row) return null;

  const d = calcDespacho(row.pol);
  const numTc = Number(tc) || 0;
  const ofMxn = numTc > 0 ? row.of * numTc : null;
  const costoFinal = ofMxn !== null ? ofMxn + d.total : null;

  const mxn = n => n === null ? '—' : '$ ' + Math.round(n).toLocaleString('es-MX');
  const conArrastre = d.arr > 0;

  const Renglon = ({ label, valor, total, sangria }) => (
    <div className={"flex justify-between items-baseline " + (sangria ? 'pl-2' : '')}>
      <span className={total ? 'text-[10px] font-black uppercase tracking-wider' : 'text-[10px] text-gray-400 font-bold'} style={total ? { color: accent } : undefined}>{label}</span>
      <span className={"font-mono " + (total ? 'text-xs font-black' : 'text-[11px] text-gray-200 font-bold')} style={total ? { color: accent } : undefined}>{valor}</span>
    </div>
  );

  return (
    <div className="bg-black rounded-xl border border-gray-700 p-3 space-y-1 mt-2">
      <Renglon label="Ocean Freight" valor={'USD ' + row.of.toLocaleString('es-MX')} />
      <Renglon label="T.C. Banco" valor={numTc > 0 ? numTc.toFixed(2) : '—'} />
      <Renglon label="OF en MXN" valor={mxn(ofMxn)} />

      <div className="h-px bg-gray-700 my-1.5"></div>
      <div className="text-[9px] font-black uppercase tracking-wider text-gray-500">Despacho — {row.pol}</div>

      <Renglon label="Pedimento"     valor={mxn(d.ped)}  sangria />
      <Renglon label="Maniobras"     valor={mxn(d.man)}  sangria />
      <Renglon label="Honorarios"    valor={mxn(d.hon)}  sangria />
      <Renglon label="Validación"    valor={mxn(d.val)}  sangria />
      <Renglon label="Servicio COVE" valor={mxn(d.cove)} sangria />
      <Renglon label="Total AA"      valor={mxn(d.totalAA)} total />
      {conArrastre && <Renglon label="Arrastre" valor={mxn(d.arr)} sangria />}
      {conArrastre && <Renglon label="Arrastre + Despacho" valor={mxn(d.total)} total />}

      <div className="h-px bg-gray-700 my-1.5"></div>
      <Renglon label="Costo Final Tarifario" valor={mxn(costoFinal)} total />
      <div className="text-[8px] text-gray-600 font-bold leading-tight pt-0.5">T.C. banco — el motor de costo usa T.C. Seguro</div>
    </div>
  );
}

function App() {
```

Notas de implementación:
- Cuando `d.arr === 0` (Altamira / Ensenada) se omiten los dos renglones de arrastre y `Total AA` queda como el total de despacho — es el mismo número (`9360`), así que repetirlo sería ruido. Esto cumple la regla del spec sin necesitar un label condicional.
- `row.of` se muestra con `toLocaleString` sin forzar decimales, porque hay tarifas enteras (`2701`) y con decimal (`2908.8`).
- Los MXN se redondean: el xlsx no maneja centavos en despacho.

- [ ] **Step 2: Renderizar en el tab Marítimo**

En el tab Marítimo, el IIFE de los selects cierra en la línea 1388 y el contenedor en la 1389, así (el `})()}` es el IIFE que arma los selects, seguido del `</div>` del contenedor):

```js
                  })()}
                </div>
              ) : (
```

Insertar el componente entre el `})()}`  y el `</div>`:

```js
                  })()}
                  <DesgloseMaritimo row={maritimoRow} tc={modoSimulador ? simTcHoy : tcHoy} accent={modoSimulador ? '#3b82f6' : '#ff6600'} />
                </div>
              ) : (
```

- [ ] **Step 3: Renderizar en Compras → Intención de Venta → Marítimo**

Mismo patrón en el bloque de la línea 1090. Hoy dice:

```js
                      })()}
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'terrestre' && (
```

Queda:

```js
                      })()}
                      <DesgloseMaritimo row={maritimoRow} tc={tcHoy} accent="#ff6600" />
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'terrestre' && (
```

Aquí `tc` es siempre `tcHoy` y el acento siempre naranja: el modo Compras no coexiste con el simulador (`setModoSimulador(false)` al entrar, y los bloques son mutuamente excluyentes por `activeTab`).

- [ ] **Step 4: Verificar en el navegador**

Abrir `deploy/index.html`, consola abierta.

1. **Progreso con arrastre.** Tab Marítimo → `GWT` / `Mérida` / `Bilbao` / `20' DC`. Poner T.C. Banco en `18.50`.
   Esperado, exacto:
   - Ocean Freight `USD 2,701`
   - T.C. Banco `18.50`
   - OF en MXN `$ 49,969` (2701 × 18.5 = 49,968.5 → redondea a 49,969)
   - Despacho — Progreso: Pedimento `$ 846`, Maniobras `$ 2,678`, Honorarios `$ 4,500`, Validación `$ 300`, Servicio COVE `$ 150`
   - Total AA `$ 8,474`
   - Arrastre `$ 4,500`
   - Arrastre + Despacho `$ 12,974`
   - Costo Final Tarifario `$ 62,943` (49,969 + 12,974)
2. **Altamira sin arrastre.** `GWT` / `Querétaro` / `Algeciras` / `20' DC` / Tipo `Full`.
   Esperado: encabezado `Despacho — Altamira`; Pedimento `$ 1,010`, Maniobras `$ 2,900`, Honorarios `$ 5,000`, Validación `$ 300`, COVE `$ 150`, Total AA `$ 9,360`; **sin** renglones de Arrastre.
3. **Selección incompleta.** Cambiar Proveedor a `AMERICARGO` (resetea Origen/Destino/Equipo) → el desglose desaparece.
4. **Edición manual.** Volver a seleccionar una tarifa completa, luego escribir un número en el input de OF → los selects se limpian y el desglose desaparece.
5. **T.C. vacío.** Borrar el T.C. Banco → `OF en MXN` y `Costo Final Tarifario` muestran `—`; el desglose de despacho sigue con sus cifras (no depende del T.C.).
6. **Compras.** Tab Compras → Intención de Venta → Marítimo → repetir el paso 1; mismo desglose.
7. Consola sin errores en todos los pasos.

Si el desglose no aparece: revisar que `maritimoRow` se esté llenando (Task 2 Step 2) y que la consola no muestre error de Babel por el JSX insertado.

- [ ] **Step 5: Commit**

```bash
git add deploy/js/app.js
git commit -m "feat(cotizador): desglose de precios del tarifario maritimo

Tabla de solo lectura bajo los selects: OF USD, T.C. banco, OF MXN,
los 5 conceptos de despacho, Total AA, arrastre y costo final.
Se renderiza en el tab Maritimo y en Compras > Intencion de Venta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Actualizar el grafo**

```bash
graphify update .
```

Requerido por `CLAUDE.md` después de modificar código. Sin costo de API (solo AST).

Commit si genera cambios:

```bash
git add graphify-out
git commit -m "chore: actualiza grafo tras desglose maritimo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notas de despliegue

`deploy/` se publica aparte del `dashboard/`. Este plan **no** despliega nada. Según memoria del proyecto, el auto-deploy desde GitHub está roto y se publica con `vercel deploy --prod --yes` — confirmar con el usuario antes de publicar; no está en el alcance de este plan.
