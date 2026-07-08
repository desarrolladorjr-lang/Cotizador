# Simulador de Precios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "🧪 Simular" third mode to the Terrestre/Marítimo toggle bar — users play with pricing fields, see live results, with no save button, and can optionally push simulated values to the real quoter.

**Architecture:** All changes in `index.html`. New independent `sim*` React state variables drive a parallel copy of the math engine. When `modoSimulador === true`, form fields bind to `sim*` vars instead of real vars. A blue banner marks the mode. The "Guardar Trato" button is replaced by "Usar estos valores →" and "Limpiar".

**Tech Stack:** React 18 (UMD), Tailwind CSS (CDN), Babel standalone, single HTML file.

---

## File Map

- Modify only: `index.html`
  - Add `modoSimulador` + `sim*` state variables (~line 102)
  - Add `simPrecioVenta` computed value (~line 263)
  - Add simulator math engine `useEffect` (~line 323)
  - Add `obtenerTipoDeCambioSim` function (~line 223)
  - Patch tab-change `useEffect` to reset `modoSimulador` (~line 179)
  - Extend toggle bar from 2 to 3 buttons (~line 579)
  - Add blue simulator banner below toggle bar (~line 612)
  - Patch form fields to conditionally bind to `sim*` vars (~lines 650–842)
  - Replace "Guardar Trato" button with two sim buttons (~line 849)

---

### Task 1: Add simulator state variables

**Files:**
- Modify: `index.html` (after line 102 — after existing Compra Directa state block)

- [ ] **Step 1: Locate the insertion point**

Find this comment in `index.html`:
```javascript
// Compra Directa state
const [compraDirecta, setCompraDirecta] = useState(false);
const [pendientes, setPendientes] = useState({ terrestre: [], maritimo: [] });
const [cargandoPendientes, setCargandoPendientes] = useState(false);
const [errorPendientes, setErrorPendientes] = useState('');
```

- [ ] **Step 2: Insert simulator state after that block**

Add directly below that block:
```javascript
// Simulator state
const [modoSimulador, setModoSimulador] = useState(false);
const [simPorcentajeFijacion, setSimPorcentajeFijacion] = useState("100");
const [simFixPrice, setSimFixPrice] = useState("2550.00");
const [simTcHoy, setSimTcHoy] = useState("");
const [simCargandoTC, setSimCargandoTC] = useState(false);
const [simDiasCobro, setSimDiasCobro] = useState("15");
const [simFleteNac, setSimFleteNac] = useState("0");
const [simRutaNacSelect, setSimRutaNacSelect] = useState("");
const [simMerma, setSimMerma] = useState("1");
const [simManiobras, setSimManiobras] = useState("0.60");
const [simAduanaMex, setSimAduanaMex] = useState("2308");
const [simAduanaUsa, setSimAduanaUsa] = useState("65");
const [simPpProv, setSimPpProv] = useState("40.00");
const [simTcSeguro, setSimTcSeguro] = useState(0);
const [simPrecioTopeCompra, setSimPrecioTopeCompra] = useState(0);
const [simUtilidadNeta, setSimUtilidadNeta] = useState(0);
const [simStatus, setSimStatus] = useState('good');
```

- [ ] **Step 3: Add `simPrecioVenta` computed value**

Find this line (around line 263):
```javascript
const precioVenta = Number((((numFijacion / 100) * numFixPrice) / 1000).toFixed(5));
```

Add directly below it:
```javascript
const simPrecioVenta = Number((((Number(simPorcentajeFijacion) / 100) * Number(simFixPrice)) / 1000).toFixed(5));
```

- [ ] **Step 4: Open `index.html` in browser and verify no console errors**

Open the file, log in, check browser DevTools console — should be zero new errors.

---

### Task 2: Add simulator math engine

**Files:**
- Modify: `index.html` (after existing math engine `useEffect`, around line 323)

- [ ] **Step 1: Locate insertion point**

Find the closing brace of the real math engine effect — it ends with:
```javascript
          }, [precioVenta, tcHoy, diasCobro, fleteNac, aduanaMex, cruceInt, aduanaUsa, merma, maniobras, ppProv]);
```

- [ ] **Step 2: Insert simulator math engine after it**

```javascript
          // MOTOR SIMULADOR (Compra Inventarios style — cruceInt always 0)
          useEffect(() => {
            const numTcHoy = Number(simTcHoy) || 0;
            const numDiasCobro = Number(simDiasCobro) || 0;
            const numFleteNac = Number(simFleteNac) || 0;
            const numAduanaMex = Number(simAduanaMex) || 0;
            const numAduanaUsa = Number(simAduanaUsa) || 0;
            const numMerma = Number(simMerma) || 0;
            const numManiobras = Number(simManiobras) || 0;
            const numPpProv = Number(simPpProv) || 0;

            const tasaRiesgoAnual = 0.15;
            const margenExtra = 0.10;
            const colchon = ((numTcHoy * tasaRiesgoAnual / 365) * numDiasCobro) + margenExtra;
            const tcSeguroCalc = numTcHoy - colchon;

            const costoLogNacKg = numFleteNac / 24500;
            const costoLogIntKg = (numAduanaMex + (numAduanaUsa * tcSeguroCalc)) / 19500;
            const logKg = costoLogNacKg + costoLogIntKg;

            const ingresoKgMxn = simPrecioVenta * tcSeguroCalc;
            const tope = (ingresoKgMxn - logKg - numManiobras) * (1 - (numMerma / 100));

            const truncar = (num) => Math.trunc(num * 100) / 100;
            const costoCompraMaterial = truncar((numPpProv / (1 - (numMerma / 100))) + numManiobras);
            const netaKg = truncar(ingresoKgMxn - costoCompraMaterial - logKg);
            const netaTotalReferencia = netaKg * 19500;

            setSimTcSeguro(tcSeguroCalc);
            setSimPrecioTopeCompra(tope);
            setSimUtilidadNeta(netaTotalReferencia);

            if (numPpProv > tope) setSimStatus('bad');
            else if (numPpProv > tope - 0.5) setSimStatus('warning');
            else setSimStatus('good');
          }, [simPrecioVenta, simTcHoy, simDiasCobro, simFleteNac, simAduanaMex, simAduanaUsa, simMerma, simManiobras, simPpProv]);
```

- [ ] **Step 3: Open `index.html` in browser and verify no console errors**

---

### Task 3: Add simulator TC fetch function

**Files:**
- Modify: `index.html` (after `obtenerTipoDeCambio` function, around line 223)

- [ ] **Step 1: Locate insertion point**

Find the closing brace of `obtenerTipoDeCambio`:
```javascript
          };
```
It follows the block that ends with `setCargandoTC(false)` and contains `'https://api.exchangerate-api.com/v4/latest/USD'`.

- [ ] **Step 2: Add `obtenerTipoDeCambioSim` after it**

```javascript
          const obtenerTipoDeCambioSim = async () => {
            setSimCargandoTC(true);
            try {
              const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
              const data = await response.json();
              if (data && data.rates && data.rates.MXN) {
                setSimTcHoy(data.rates.MXN.toFixed(2));
              }
            } catch (error) {
              console.error("Error TC sim:", error);
              if (!simTcHoy) setSimTcHoy("17.50");
            } finally {
              setSimCargandoTC(false);
            }
          };
```

- [ ] **Step 3: Verify in browser — no errors**

---

### Task 4: Reset `modoSimulador` on tab change

**Files:**
- Modify: `index.html` (tab-change `useEffect`, around line 179)

- [ ] **Step 1: Locate the tab-change effect**

Find:
```javascript
          useEffect(() => {
            setCompraDirecta(false);
            setCargandoPendientes(false);
            setCruceInt("0");
```

- [ ] **Step 2: Add `modoSimulador` reset at the top of that effect**

Change to:
```javascript
          useEffect(() => {
            setModoSimulador(false);
            setCompraDirecta(false);
            setCargandoPendientes(false);
            setCruceInt("0");
```

- [ ] **Step 3: Add reset effect for when `modoSimulador` turns on**

After the tab-change effect, add:
```javascript
          useEffect(() => {
            if (!modoSimulador) return;
            setSimPorcentajeFijacion("100");
            setSimFixPrice("2550.00");
            setSimTcHoy("");
            setSimDiasCobro("15");
            setSimFleteNac("0");
            setSimRutaNacSelect("");
            setSimMerma("1");
            setSimManiobras("0.60");
            setSimAduanaMex("2308");
            setSimAduanaUsa("65");
            setSimPpProv("40.00");
          }, [modoSimulador]);
```

- [ ] **Step 4: Verify in browser — switching tabs resets mode, no errors**

---

### Task 5: Extend toggle bar to 3 buttons

**Files:**
- Modify: `index.html` (toggle bar JSX, around line 580)

- [ ] **Step 1: Locate the toggle bar**

Find the "Compra Inventarios" button block:
```javascript
                  {/* Compra Directa Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCompraDirecta(false);
                        setCruceInt("0");
                        setRutaIntSelect('');
                      }}
                      disabled={cargandoPendientes}
```

- [ ] **Step 2: Replace entire toggle bar div with 3-button version**

Replace the entire block from `{/* Compra Directa Toggle */}` through the closing `</div>` of the flex container (which ends after the "Back to Back" button's `</button>`) with:

```jsx
                  {/* Mode Toggle: Compra Inventarios / Back to Back / Simular */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setModoSimulador(false);
                        setCompraDirecta(false);
                        setCruceInt("0");
                        setRutaIntSelect('');
                      }}
                      disabled={cargandoPendientes}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                        !compraDirecta && !modoSimulador
                          ? 'bg-gray-700 text-gray-300 border-gray-600'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                    >
                      Compra Inventarios
                    </button>
                    <button
                      onClick={() => {
                        setModoSimulador(false);
                        if (tabPendientes.length === 0) fetchPendientes();
                        setCompraDirecta(true);
                      }}
                      disabled={cargandoPendientes}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                        compraDirecta && !modoSimulador
                          ? 'text-white border-orange-500'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                      style={compraDirecta && !modoSimulador ? { backgroundColor: '#ff6600', borderColor: '#ea580c' } : {}}
                    >
                      {cargandoPendientes ? 'Cargando...' : 'Back to Back'}
                    </button>
                    <button
                      onClick={() => {
                        setCompraDirecta(false);
                        setCruceInt("0");
                        setRutaIntSelect('');
                        setModoSimulador(true);
                      }}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
                        modoSimulador
                          ? 'text-white border-blue-500'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                      style={modoSimulador ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}}
                    >
                      🧪 Simular
                    </button>
                  </div>
```

- [ ] **Step 3: Verify in browser — 3 buttons appear, each activates correctly, no errors**

---

### Task 6: Add simulator banner and error/empty states

**Files:**
- Modify: `index.html` (below toggle bar, around line 612)

- [ ] **Step 1: Locate insertion point**

Find the error/empty state blocks that follow the toggle bar:
```javascript
                  {errorPendientes && (
                    <div className="text-red-400 text-[10px] font-bold text-center">{errorPendientes}</div>
                  )}
```

- [ ] **Step 2: Add blue simulator banner before that block**

Insert:
```jsx
                  {modoSimulador && (
                    <div className="bg-blue-900 border border-blue-700 text-blue-300 text-[10px] font-black text-center py-2 px-3 rounded-lg uppercase tracking-widest">
                      🧪 Simulación — Los valores no se guardarán
                    </div>
                  )}
```

- [ ] **Step 3: Verify in browser — banner appears in blue when Simular active, gone otherwise**

---

### Task 7: Update form field bindings

**Files:**
- Modify: `index.html` (all form inputs in the Terrestre/Marítimo form, ~lines 650–783)

All changes follow the pattern: `value={modoSimulador ? simX : x}` and `onChange={e => (modoSimulador ? setSimX : setX)(e.target.value)}`.

- [ ] **Step 1: Update % Fijación input**

Find:
```jsx
                        <input type="number" value={porcentajeFijacion} onChange={e => setPorcentajeFijacion(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white" />
```
Replace with:
```jsx
                        <input type="number" value={modoSimulador ? simPorcentajeFijacion : porcentajeFijacion} onChange={e => (modoSimulador ? setSimPorcentajeFijacion : setPorcentajeFijacion)(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white" />
```

- [ ] **Step 2: Update Fix Price input**

Find:
```jsx
                        <input type="number" value={fixPrice} onChange={e => setFixPrice(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-white font-bold text-sm outline-none focus:border-white" />
```
Replace with:
```jsx
                        <input type="number" value={modoSimulador ? simFixPrice : fixPrice} onChange={e => (modoSimulador ? setSimFixPrice : setFixPrice)(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-white font-bold text-sm outline-none focus:border-white" />
```

- [ ] **Step 3: Update Venta x KG (readonly)**

Find:
```jsx
                        <input type="text" readOnly value={precioVenta.toFixed(5)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none cursor-not-allowed" />
```
Replace with:
```jsx
                        <input type="text" readOnly value={(modoSimulador ? simPrecioVenta : precioVenta).toFixed(5)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none cursor-not-allowed" />
```

- [ ] **Step 4: Update Días Crédito input**

Find:
```jsx
                      <input type="number" value={diasCobro} onChange={e => setDiasCobro(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none text-center focus:border-white" />
```
Replace with:
```jsx
                      <input type="number" value={modoSimulador ? simDiasCobro : diasCobro} onChange={e => (modoSimulador ? setSimDiasCobro : setDiasCobro)(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none text-center focus:border-white" />
```

- [ ] **Step 5: Update Merma input**

Find:
```jsx
                          type="number"
                          step="0.1"
                          value={merma}
                          onChange={e => setMerma(e.target.value)}
```
Replace with:
```jsx
                          type="number"
                          step="0.1"
                          value={modoSimulador ? simMerma : merma}
                          onChange={e => (modoSimulador ? setSimMerma : setMerma)(e.target.value)}
```

- [ ] **Step 6: Update T.C. Banco input and refresh button**

Find the TC Banco label + button block:
```jsx
                        <button 
                          onClick={obtenerTipoDeCambio} 
                          className="text-[9px] font-bold flex items-center gap-1 hover:text-white transition-colors"
                          style={{ color: '#ff6600' }}
                          title="Actualizar TC de internet"
                        >
                          {cargandoTC ? '⏳...' : '🔄 Act.'}
                        </button>
```
Replace with:
```jsx
                        <button 
                          onClick={modoSimulador ? obtenerTipoDeCambioSim : obtenerTipoDeCambio} 
                          className="text-[9px] font-bold flex items-center gap-1 hover:text-white transition-colors"
                          style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}
                          title="Actualizar TC de internet"
                        >
                          {(modoSimulador ? simCargandoTC : cargandoTC) ? '⏳...' : '🔄 Act.'}
                        </button>
```

Then find the TC Banco input:
```jsx
                        <input type="number" step="0.01" value={tcHoy} onChange={e => setTcHoy(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
```
Replace with:
```jsx
                        <input type="number" step="0.01" value={modoSimulador ? simTcHoy : tcHoy} onChange={e => (modoSimulador ? setSimTcHoy : setTcHoy)(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
```

- [ ] **Step 7: Update T.C. Seguro display (readonly)**

Find:
```jsx
                          value={tcSeguro > 0 ? tcSeguro.toFixed(2) : "0.00"} 
```
Replace with:
```jsx
                          value={(modoSimulador ? simTcSeguro : tcSeguro) > 0 ? (modoSimulador ? simTcSeguro : tcSeguro).toFixed(2) : "0.00"} 
```

Also update the border/text color to reflect simulator mode. Find the `style` on that same input:
```jsx
                          style={{ color: '#ff6600', borderColor: '#ff6600' }}
```
Replace with:
```jsx
                          style={{ color: modoSimulador ? '#3b82f6' : '#ff6600', borderColor: modoSimulador ? '#3b82f6' : '#ff6600' }}
```

And the label above it:
```jsx
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ff6600' }}>T.C. Seguro</label>
```
Replace with:
```jsx
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}>T.C. Seguro</label>
```

- [ ] **Step 8: Update Flete Nac route select and input**

Find the Flete Nac route select:
```jsx
                          value={rutaNacSelect} 
                          onChange={e => {
                            const val = e.target.value;
                            setRutaNacSelect(val); 
                            if (val === 'N/A' || val === '') { setFleteNac("0"); return; }
                            const r = [{name: "MID - MTY", cost: 61480}, {name: "GDL - MTY", cost: 35960}, {name: "MEX / TOL - MTY", cost: 38860}, {name: "PUE - MTY", cost: 49300}, {name: "QRO - MTY", cost: 35380}].find(x => x.name === val); 
                            if(r) setFleteNac(r.cost.toString());
                          }} 
```
Replace with:
```jsx
                          value={modoSimulador ? simRutaNacSelect : rutaNacSelect} 
                          onChange={e => {
                            const val = e.target.value;
                            const setRuta = modoSimulador ? setSimRutaNacSelect : setRutaNacSelect;
                            const setFlete = modoSimulador ? setSimFleteNac : setFleteNac;
                            setRuta(val);
                            if (val === 'N/A' || val === '') { setFlete("0"); return; }
                            const r = [{name: "MID - MTY", cost: 61480}, {name: "GDL - MTY", cost: 35960}, {name: "MEX / TOL - MTY", cost: 38860}, {name: "PUE - MTY", cost: 49300}, {name: "QRO - MTY", cost: 35380}].find(x => x.name === val); 
                            if(r) setFlete(r.cost.toString());
                          }} 
```

Then find the Flete Nac number input:
```jsx
                        <input type="number" value={fleteNac} onChange={e => {setFleteNac(e.target.value); setRutaNacSelect('');}} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
```
Replace with:
```jsx
                        <input type="number" value={modoSimulador ? simFleteNac : fleteNac} onChange={e => { (modoSimulador ? setSimFleteNac : setFleteNac)(e.target.value); (modoSimulador ? setSimRutaNacSelect : setRutaNacSelect)(''); }} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
```

- [ ] **Step 9: Hide Flete Int column in simulator mode**

The Flete Int column already uses `{compraDirecta && (...)}`. Since `modoSimulador` sets `compraDirecta = false`, this column will already be hidden automatically. No change needed.

- [ ] **Step 10: Verify in browser — all inputs in simulator use sim* values, real cotizador values unchanged when switching back**

---

### Task 8: Update results display for simulator

**Files:**
- Modify: `index.html` (Tope Máximo, PP Prov input, status block, ~lines 811–841)

- [ ] **Step 1: Update Tope Máximo de Compra display**

Find:
```jsx
                      {fMxn(precioTopeCompra)}
```
Replace with:
```jsx
                      {fMxn(modoSimulador ? simPrecioTopeCompra : precioTopeCompra)}
```

Also update the border color of the card. Find:
```jsx
                  <div className="text-center bg-black py-4 rounded-xl border shadow-lg" style={{ borderColor: '#ff6600' }}>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#ff6600' }}>Tope Máximo de Compra</label>
```
Replace with:
```jsx
                  <div className="text-center bg-black py-4 rounded-xl border shadow-lg" style={{ borderColor: modoSimulador ? '#3b82f6' : '#ff6600' }}>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}>Tope Máximo de Compra</label>
```

- [ ] **Step 2: Update PP Proveedor input**

Find:
```jsx
                        type="number" step="0.01" value={ppProv} onChange={e => setPpProv(e.target.value)} 
                        className={`w-full bg-black border-2 rounded-xl p-2 pl-8 text-white font-black text-2xl text-center outline-none shadow-inner transition-colors ${status === 'bad' ? 'border-red-500 focus:border-red-400' : status === 'warning' ? 'border-yellow-500 focus:border-yellow-400' : 'border-green-500 focus:border-green-400'}`} 
```
Replace with:
```jsx
                        type="number" step="0.01" value={modoSimulador ? simPpProv : ppProv} onChange={e => (modoSimulador ? setSimPpProv : setPpProv)(e.target.value)} 
                        className={`w-full bg-black border-2 rounded-xl p-2 pl-8 text-white font-black text-2xl text-center outline-none shadow-inner transition-colors ${(modoSimulador ? simStatus : status) === 'bad' ? 'border-red-500 focus:border-red-400' : (modoSimulador ? simStatus : status) === 'warning' ? 'border-yellow-500 focus:border-yellow-400' : 'border-green-500 focus:border-green-400'}`} 
```

- [ ] **Step 3: Update status indicator block**

Find:
```jsx
                    <div className={`mt-4 p-3 rounded-xl text-[10px] uppercase tracking-widest font-black flex flex-col items-center justify-center gap-1.5 shadow-sm transition-colors ${status === 'bad' ? 'bg-red-900 text-red-400 border border-red-700' : status === 'warning' ? 'bg-yellow-900 text-yellow-400 border border-yellow-700' : 'bg-green-900 text-green-400 border border-green-700'}`}>
                      {status === 'bad' && <div className="text-xs">⚠️ PÉRDIDA SEGURA</div>}
                      {status === 'warning' && <div className="text-xs">⚠️ MARGEN RIESGOSO</div>}
                      {status === 'good' && (
                        <>
                          <div className="text-xs flex items-center gap-1">✅ APROBADO (GANANCIA)</div>
                          <div className="text-white bg-green-800 px-2 py-1 rounded mt-1 text-center">
                            Total Ref: {fMxn(utilidadNeta)} <br/>
                            <span className="text-[9px] text-green-400 font-normal">*(Ganancia por camión de 19.5T)*</span>
                          </div>
                        </>
                      )}
                    </div>
```
Replace with:
```jsx
                    {(() => {
                      const activeStatus = modoSimulador ? simStatus : status;
                      const activeUtilidad = modoSimulador ? simUtilidadNeta : utilidadNeta;
                      return (
                        <div className={`mt-4 p-3 rounded-xl text-[10px] uppercase tracking-widest font-black flex flex-col items-center justify-center gap-1.5 shadow-sm transition-colors ${activeStatus === 'bad' ? 'bg-red-900 text-red-400 border border-red-700' : activeStatus === 'warning' ? 'bg-yellow-900 text-yellow-400 border border-yellow-700' : 'bg-green-900 text-green-400 border border-green-700'}`}>
                          {activeStatus === 'bad' && <div className="text-xs">⚠️ PÉRDIDA SEGURA</div>}
                          {activeStatus === 'warning' && <div className="text-xs">⚠️ MARGEN RIESGOSO</div>}
                          {activeStatus === 'good' && (
                            <>
                              <div className="text-xs flex items-center gap-1">✅ APROBADO (GANANCIA)</div>
                              <div className="text-white bg-green-800 px-2 py-1 rounded mt-1 text-center">
                                Total Ref: {fMxn(activeUtilidad)} <br/>
                                <span className="text-[9px] text-green-400 font-normal">*(Ganancia por camión de 19.5T)*</span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
```

- [ ] **Step 4: Verify in browser — simulator results update live as you type, real results unchanged**

---

### Task 9: Replace Guardar button with simulator actions

**Files:**
- Modify: `index.html` (~line 849, the Guardar Trato button)

- [ ] **Step 1: Locate the Guardar Trato button**

Find:
```jsx
                  <button
                    onClick={handleGuardarCotizacion}
                    disabled={guardando || status === 'bad' || !ppProv}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border"
                    style={{ 
                      backgroundColor: guardando || status === 'bad' || !ppProv ? '#374151' : '#ff6600', 
                      color: guardando || status === 'bad' || !ppProv ? '#9ca3af' : '#ffffff',
                      borderColor: guardando || status === 'bad' || !ppProv ? '#4b5563' : '#ea580c'
                    }}
                  >
                    {guardando ? 'Guardando...' : '💾 Guardar Trato'}
                  </button>
```

- [ ] **Step 2: Wrap with conditional**

Replace the entire button with:
```jsx
                  {modoSimulador ? (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setPorcentajeFijacion(simPorcentajeFijacion);
                          setFixPrice(simFixPrice);
                          setTcHoy(simTcHoy);
                          setDiasCobro(simDiasCobro);
                          setFleteNac(simFleteNac);
                          setRutaNacSelect(simRutaNacSelect);
                          setMerma(simMerma);
                          setManiobras(simManiobras);
                          setAduanaMex(simAduanaMex);
                          setAduanaUsa(simAduanaUsa);
                          setPpProv(simPpProv);
                          setModoSimulador(false);
                          setCompraDirecta(false);
                        }}
                        className="flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border text-white"
                        style={{ backgroundColor: '#3b82f6', borderColor: '#2563eb' }}
                      >
                        ✅ Usar estos valores →
                      </button>
                      <button
                        onClick={() => {
                          setSimPorcentajeFijacion("100");
                          setSimFixPrice("2550.00");
                          setSimTcHoy("");
                          setSimDiasCobro("15");
                          setSimFleteNac("0");
                          setSimRutaNacSelect("");
                          setSimMerma("1");
                          setSimManiobras("0.60");
                          setSimAduanaMex("2308");
                          setSimAduanaUsa("65");
                          setSimPpProv("40.00");
                        }}
                        className="px-4 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border text-gray-300 bg-gray-700 border-gray-600"
                      >
                        Limpiar
                      </button>
                    </div>
                  ) : (
                  <button
                    onClick={handleGuardarCotizacion}
                    disabled={guardando || status === 'bad' || !ppProv}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border"
                    style={{ 
                      backgroundColor: guardando || status === 'bad' || !ppProv ? '#374151' : '#ff6600', 
                      color: guardando || status === 'bad' || !ppProv ? '#9ca3af' : '#ffffff',
                      borderColor: guardando || status === 'bad' || !ppProv ? '#4b5563' : '#ea580c'
                    }}
                  >
                    {guardando ? 'Guardando...' : '💾 Guardar Trato'}
                  </button>
                  )}
```

- [ ] **Step 3: Verify "Usar estos valores →" behavior in browser**

1. Switch to 🧪 Simular
2. Change Fix Price to "3000"
3. Press "Usar estos valores →"
4. Should: return to Compra Inventarios mode, Fix Price in real form now shows "3000"
5. Pressing Guardar Trato should still work normally

- [ ] **Step 4: Verify "Limpiar" behavior in browser**

1. Switch to 🧪 Simular
2. Change several fields
3. Press "Limpiar"
4. Should: all sim* fields reset to defaults, mode stays Simular

---

### Task 10: Final verification and commit

- [ ] **Step 1: Full feature walkthrough**

Test all paths:
1. Open app, log in
2. Tab Terrestre → click 🧪 Simular → blue banner visible, 3rd button blue
3. Change Fix Price, % Fijación → Tope updates live in blue
4. Hit 🔄 Act. → simTcHoy populates, not tcHoy (switch back to Compra Inventarios to verify tcHoy unchanged)
5. Enter PP Prov > Tope → red status
6. Enter PP Prov < Tope → green status with utilidad
7. Press Limpiar → fields reset
8. Change values again → press "Usar estos valores →" → returns to Compra Inventarios, real fields updated
9. Press Guardar Trato → normal save works
10. Switch to Back to Back → Simular button still works
11. Switch tab (Marítimo) → modoSimulador resets to false
12. Inventarios tab → no 3-button bar (only Terrestre/Marítimo show it)

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add price simulator mode to Terrestre/Marítimo tabs

Three-state toggle: Compra Inventarios / Back to Back / Simular.
Simulator uses independent sim* state, parallel math engine, blue UI.
'Usar estos valores' copies sim values to real quoter."
```
