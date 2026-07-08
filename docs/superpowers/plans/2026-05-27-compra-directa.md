# Compra Directa Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Compra Directa" toggle to Terrestre and Marítimo tabs that filters client/material dropdowns to only show pending (unsupplied) orders pulled live from Google Sheets.

**Architecture:** A new `doGet` function in Apps Script reads TERRESTRES/MARÍTIMO sheets, filters rows with empty INVOICE column, deduplicates CLIENT+MATERIAL pairs, and returns JSON. The React frontend adds a toggle that fetches this data and replaces the dropdown options with the filtered list.

**Tech Stack:** Google Apps Script (backend), React 18 (CDN, no build step), Tailwind CSS (CDN), vanilla `fetch` API.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `Codigo.gs` | Modify | Add `doGet` function |
| `index.html` | Modify | Add 3 state vars, toggle UI, fetch logic, filtered dropdown logic |

---

### Task 1: Add `doGet` to Codigo.gs

**Files:**
- Modify: `Codigo.gs`

This adds the GET endpoint to the existing Apps Script. The existing `doPost` stays untouched.

- [ ] **Step 1: Open `Codigo.gs` and append `doGet` after the closing brace of `doPost`**

Add this entire function at the end of the file:

```javascript
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { terrestre: [], maritimo: [] };

    // TERRESTRES — CLIENT=col0, MATERIAL=col4, INVOICE=col15
    var sheetT = ss.getSheetByName('TERRESTRES');
    if (sheetT) {
      var dataT = sheetT.getDataRange().getValues();
      var headerRowT = -1;
      for (var i = 0; i < dataT.length; i++) {
        if (dataT[i][0] === 'CLIENT') { headerRowT = i; break; }
      }
      var seenT = {};
      for (var i = headerRowT + 1; i < dataT.length; i++) {
        var row = dataT[i];
        var client = row[0], material = row[4], invoice = row[15];
        if (!client || client === 'INVENTARIO' || invoice) continue;
        var key = client + '|' + material;
        if (!seenT[key]) {
          seenT[key] = true;
          result.terrestre.push({ client: String(client), material: String(material) });
        }
      }
    }

    // MARÍTIMO — CLIENT=col0, MATERIAL=col4, INVOICE=col18
    var sheetM = ss.getSheetByName('MARÍTIMO');
    if (sheetM) {
      var dataM = sheetM.getDataRange().getValues();
      var headerRowM = -1;
      for (var i = 0; i < dataM.length; i++) {
        if (dataM[i][0] === 'CLIENT') { headerRowM = i; break; }
      }
      var seenM = {};
      for (var i = headerRowM + 1; i < dataM.length; i++) {
        var row = dataM[i];
        var client = row[0], material = row[4], invoice = row[18];
        if (!client || client === 'INVENTARIO' || invoice) continue;
        var key = client + '|' + material;
        if (!seenM[key]) {
          seenM[key] = true;
          result.maritimo.push({ client: String(client), material: String(material) });
        }
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

- [ ] **Step 2: Test `doGet` in Apps Script editor**

In Google Apps Script editor:
1. Select function `doGet` from dropdown
2. Click Run
3. Check Execution Log — should show no errors
4. Optionally: add temporary `Logger.log(JSON.stringify(result))` to verify data shape, then remove it

- [ ] **Step 3: Redeploy the Web App**

In Apps Script:
1. Deploy → Manage deployments → Edit (pencil icon on current deployment)
2. Change version to "New version"
3. Keep "Execute as: Me" and "Who has access: Anyone"
4. Click Deploy
5. Copy the deployment URL — verify it's the same as `GOOGLE_SCRIPT_URL` in `index.html`

- [ ] **Step 4: Verify `doGet` live**

Open a browser tab and paste the deployment URL directly (it's a GET request).
Expected response:
```json
{
  "terrestre": [
    {"client":"INFINITY METALS","material":"SCRAP 5052"},
    {"client":"INTRAMETCO","material":"5052 BALES"},
    ...
  ],
  "maritimo": [
    {"client":"GMI","material":"EC WIRE SCRAP"},
    {"client":"NOVELIS","material":"UBC"},
    ...
  ]
}
```
If you see `{"error":"..."}` — check the sheet names match exactly (including accents: `MARÍTIMO`, `TERRESTRES`).

---

### Task 2: Add state and fetch logic to index.html

**Files:**
- Modify: `index.html` — inside the `App()` function, after existing state declarations (~line 95)

- [ ] **Step 1: Add 3 new state variables**

Find the block of existing state declarations (around line 88–95 where `invCargas` is declared). Add immediately after:

```javascript
// Compra Directa state
const [compraDirecta, setCompraDirecta] = useState(false);
const [pendientes, setPendientes] = useState({ terrestre: [], maritimo: [] });
const [cargandoPendientes, setCargandoPendientes] = useState(false);
const [errorPendientes, setErrorPendientes] = useState('');
```

- [ ] **Step 2: Add the fetch function**

Add this function after `obtenerTipoDeCambio` (around line 200):

```javascript
const fetchPendientes = async () => {
  setCargandoPendientes(true);
  setErrorPendientes('');
  try {
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOX2dJUvvpRcDkHYstwnezDyyfeIpUtfdnpuwRtZxICOu2AorLT80PvO6LP7wudRGh_A/exec";
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setPendientes(data);
  } catch (err) {
    console.error('fetchPendientes error:', err);
    setErrorPendientes('No se pudieron cargar pendientes');
    setCompraDirecta(false);
  } finally {
    setCargandoPendientes(false);
  }
};
```

- [ ] **Step 3: Add useEffect to reset compraDirecta when tab changes**

Find the existing `useEffect` that resets cliente/material on tab change (around line 172). Add `setCompraDirecta(false)` inside it so the toggle resets when switching tabs:

```javascript
useEffect(() => {
  setCompraDirecta(false);  // ← add this line at the top
  if (activeTab === 'terrestre') {
    setCliente("OMC");
    setMaterial("UBC");
    setDestino("Laredo, TX");
    setProveedor("CALDERA");
  } else if (activeTab === 'maritimo') {
    setCliente(optionsClientesMaritimo[0]);
    setMaterial(optionsMaterialMaritimo[0]);
    setDestino(optionsDestinoMaritimo[0]);
    setProveedor(optionsProveedorMaritimo[0]);
  }
}, [activeTab]);
```

- [ ] **Step 4: Replace the `currentClientes` and `currentMaterial` derived values**

Find these two lines (around line 359–362):

```javascript
const currentClientes = activeTab === 'terrestre' ? optionsClientesTerrestre : optionsClientesMaritimo;
const currentMaterial = activeTab === 'terrestre' ? optionsMaterialTerrestre : optionsMaterialMaritimo;
```

Replace with:

```javascript
const tabPendientes = activeTab === 'terrestre' ? pendientes.terrestre : pendientes.maritimo;

const currentClientes = compraDirecta && tabPendientes.length > 0
  ? [...new Set(tabPendientes.map(p => p.client))]
  : activeTab === 'terrestre' ? optionsClientesTerrestre : optionsClientesMaritimo;

const currentMaterial = compraDirecta && tabPendientes.length > 0
  ? tabPendientes.filter(p => p.client === cliente).map(p => p.material)
  : activeTab === 'terrestre' ? optionsMaterialTerrestre : optionsMaterialMaritimo;

const currentDestino = activeTab === 'terrestre' ? optionsDestinoTerrestre : optionsDestinoMaritimo;
const currentProveedor = activeTab === 'terrestre' ? optionsProveedorTerrestre : optionsProveedorMaritimo;
```

Note: `currentDestino` and `currentProveedor` lines already existed — just keep them, only replace `currentClientes` and `currentMaterial`.

- [ ] **Step 5: Auto-select material when only one option in Compra Directa**

Add a `useEffect` after the one from Step 3:

```javascript
useEffect(() => {
  if (compraDirecta && currentMaterial.length === 1) {
    setMaterial(currentMaterial[0]);
  }
}, [cliente, compraDirecta]);
```

- [ ] **Step 6: Auto-select first client when Compra Directa activates**

Add another `useEffect`:

```javascript
useEffect(() => {
  if (compraDirecta && currentClientes.length > 0) {
    setCliente(currentClientes[0]);
  }
}, [compraDirecta]);
```

---

### Task 3: Add toggle UI to the form

**Files:**
- Modify: `index.html` — inside the JSX of the non-Inventarios form section

- [ ] **Step 1: Add toggle between tabs and form content**

Find the JSX section that begins the non-inventarios form (the `else` branch, around line 518):

```jsx
) : (
<div className="p-6 space-y-5 relative z-10">
```

Insert this block immediately after the opening `<div className="p-6 space-y-5 relative z-10">`:

```jsx
{/* Compra Directa Toggle */}
<div className="flex items-center gap-2">
  <button
    onClick={() => {
      if (!compraDirecta) {
        fetchPendientes();
        setCompraDirecta(true);
      } else {
        setCompraDirecta(false);
      }
    }}
    disabled={cargandoPendientes}
    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
      !compraDirecta
        ? 'bg-gray-700 text-gray-300 border-gray-600'
        : 'text-gray-500 bg-transparent border-gray-700'
    }`}
  >
    Normal
  </button>
  <button
    onClick={() => {
      if (compraDirecta) {
        setCompraDirecta(false);
      } else {
        fetchPendientes();
        setCompraDirecta(true);
      }
    }}
    disabled={cargandoPendientes}
    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border ${
      compraDirecta
        ? 'text-white border-orange-500'
        : 'text-gray-500 bg-transparent border-gray-700'
    }`}
    style={compraDirecta ? { backgroundColor: '#ff6600', borderColor: '#ea580c' } : {}}
  >
    {cargandoPendientes ? '⏳ Cargando...' : '🎯 Compra Directa'}
  </button>
</div>

{errorPendientes && (
  <div className="text-red-400 text-[10px] font-bold text-center">{errorPendientes}</div>
)}

{compraDirecta && tabPendientes.length === 0 && !cargandoPendientes && (
  <div className="text-yellow-400 text-[10px] font-bold text-center bg-yellow-900 border border-yellow-700 rounded-lg p-2">
    Sin pendientes para esta modalidad
  </div>
)}
```

- [ ] **Step 2: Add PENDIENTE badge next to Cliente label**

Find the Cliente label in the JSX (around line 521):

```jsx
<label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
```

Replace with:

```jsx
<label className="block text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
  <span className="text-gray-400">Cliente</span>
  {compraDirecta && (
    <span className="font-black" style={{ color: '#ff6600' }}>● PENDIENTE</span>
  )}
</label>
```

- [ ] **Step 3: Verify toggle logic visually in browser**

Open `index.html` in a local browser (or via your dev server). Log in.
1. Go to Terrestre tab — toggle should show "Normal" active (gray), "Compra Directa" inactive
2. Click "Compra Directa" — should show spinner briefly, then orange active state
3. Cliente dropdown should now show only INFINITY METALS, INTRAMETCO, TEMPO, REGEN, OMC (the pending ones)
4. Select INTRAMETCO — material dropdown should show only their pending materials
5. Switch to Marítimo tab — toggle resets to Normal; click Compra Directa — shows NOVELIS, OMC, GMI, etc.
6. Switch back to Terrestre — toggle is Normal again ✓

---

### Task 4: Final verification and commit

- [ ] **Step 1: Full smoke test**

Test each scenario:

| Scenario | Expected |
|----------|----------|
| Terrestre Normal | All existing clients/materials (no change) |
| Terrestre Compra Directa | Only pending clients from TERRESTRES sheet |
| Marítimo Normal | All existing clients/materials (no change) |
| Marítimo Compra Directa | Only pending clients from MARÍTIMO sheet |
| Single material for client | Auto-selects material |
| Switch tab | Toggle resets to Normal |
| Inventarios tab | No toggle shown, no change |
| Save cotización | Works normally after selecting from filtered list |
| Network error on fetch | Error message shown, toggle reverts to Normal |

- [ ] **Step 2: Commit**

```bash
git add index.html Codigo.gs
git commit -m "feat: add Compra Directa mode to Terrestre and Maritimo tabs

Filters client/material dropdowns to pending orders (no invoice) from
Google Sheets. New doGet endpoint in Apps Script reads TERRESTRES and
MARITIMO sheets and returns deduplicated CLIENT+MATERIAL pairs."
```

---

## Deploy Checklist (manual steps after implementation)

1. Copy updated `doGet` code into Google Apps Script editor
2. Redeploy as new version (same URL)
3. Verify GET request returns JSON in browser
4. Deploy updated `index.html` to hosting (GitHub Pages / wherever it lives)
