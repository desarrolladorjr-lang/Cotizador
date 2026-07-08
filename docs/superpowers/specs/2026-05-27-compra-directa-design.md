# Compra Directa Mode — Design Spec
Date: 2026-05-27

## Overview

Add "Compra Directa" toggle to Terrestre and Marítimo tabs. When active, client and material dropdowns filter to only show pending (unsupplied) orders from the live Google Sheets data. This lets the user target specific clients that need supply instead of seeing all possible options.

## Data Source

**Spreadsheet:** `14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc` (same one already in use)

**Sheet mapping:**
- Tab Terrestre → reads sheet `TERRESTRES`
- Tab Marítimo → reads sheet `MARÍTIMO`

**"Sin surtir" definition:** rows where column `INVOICE` is empty/null.

**Exclusions:** rows where CLIENT = `"INVENTARIO"` (internal stock rows, not real clients).

**Deduplication:** same CLIENT + MATERIAL combo may appear multiple times (multiple pending loads). Return unique pairs only.

## Backend — Codigo.gs

Add `doGet(e)` function to the existing Apps Script:

```javascript
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { terrestre: [], maritimo: [] };

    // TERRESTRES: INVOICE = col index 15 (0-based), CLIENT=0, MATERIAL=4
    var sheetT = ss.getSheetByName('TERRESTRES');
    if (sheetT) {
      var dataT = sheetT.getDataRange().getValues();
      var headerRowT = -1;
      for (var i = 0; i < dataT.length; i++) {
        if (dataT[i][0] === 'CLIENT') { headerRowT = i; break; }
      }
      var seen = {};
      for (var i = headerRowT + 1; i < dataT.length; i++) {
        var row = dataT[i];
        var client = row[0], material = row[4], invoice = row[15];
        if (!client || client === 'INVENTARIO' || invoice) continue;
        var key = client + '|' + material;
        if (!seen[key]) {
          seen[key] = true;
          result.terrestre.push({ client: String(client), material: String(material) });
        }
      }
    }

    // MARÍTIMO: INVOICE = col index 18 (0-based), CLIENT=0, MATERIAL=4
    var sheetM = ss.getSheetByName('MARÍTIMO');
    if (sheetM) {
      var dataM = sheetM.getDataRange().getValues();
      var headerRowM = -1;
      for (var i = 0; i < dataM.length; i++) {
        if (dataM[i][0] === 'CLIENT') { headerRowM = i; break; }
      }
      var seen2 = {};
      for (var i = headerRowM + 1; i < dataM.length; i++) {
        var row = dataM[i];
        var client = row[0], material = row[4], invoice = row[18];
        if (!client || client === 'INVENTARIO' || invoice) continue;
        var key = client + '|' + material;
        if (!seen2[key]) {
          seen2[key] = true;
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

**Deploy note:** After adding `doGet`, redeploy the Web App with "Anyone" access (same as existing doPost).

## Frontend — index.html

### New state variables

```javascript
const [compraDirecta, setCompraDirecta] = useState(false);
const [pendientes, setPendientes] = useState({ terrestre: [], maritimo: [] });
const [cargandoPendientes, setCargandoPendientes] = useState(false);
```

### Toggle UI

Placed between the tab bar and the form content, visible only on Terrestre and Marítimo tabs:

```
[ NORMAL ]  [ COMPRA DIRECTA ]
```

Pill-style toggle, orange accent on active state (matching existing brand color `#ff6600`).

### Data fetch

Triggered when user switches to "Compra Directa" mode (or when tab changes while mode is active):

```javascript
const fetchPendientes = async () => {
  setCargandoPendientes(true);
  const res = await fetch(GOOGLE_SCRIPT_URL); // GET request
  const data = await res.json();
  setPendientes(data);
  setCargandoPendientes(false);
};
```

Fetch is GET — the existing `GOOGLE_SCRIPT_URL` constant is reused.

### Filtered dropdowns

When `compraDirecta === true`:

- `currentClientes` → derived from `pendientes[activeTab]` unique clients only
- When client changes → `currentMaterial` filters to only materials matching that client in `pendientes[activeTab]`
- If filtered material list has exactly 1 item → auto-select it

When `compraDirecta === false`:

- `currentClientes` and `currentMaterial` use existing full lists (no change)

### Visual indicator

When Compra Directa active and a pending client is selected, show small badge next to client label:
```
Cliente  ● PENDIENTE
```
Badge color: orange (`#ff6600`), text size `text-[9px]`.

### Reset behavior

- Switching from Compra Directa → Normal: reset client/material to tab defaults (existing `useEffect` handles this already)
- Switching tabs while Compra Directa is ON: re-filter using the other tab's pendientes data (no new fetch needed, data already loaded)

## Error handling

- If `doGet` returns error or network fails: show inline warning `"No se pudieron cargar pendientes"`, fall back to normal full lists
- If pendientes list is empty for current tab: show message `"Sin pendientes para esta modalidad"` and disable the toggle (or show empty state)

## What does NOT change

- Inventarios tab: no modification
- Math engine (precioTope, utilidad, tcSeguro)
- Save flow (doPost, handleGuardarCotizacion)
- Auth (Google Sign-In)
- All existing dropdown options for Normal mode

## Column index reference (0-based)

| Sheet | CLIENT | MATERIAL | INVOICE |
|-------|--------|----------|---------|
| TERRESTRES | 0 | 4 | 15 |
| MARÍTIMO | 0 | 4 | 18 |

Header row is dynamically detected (row where col 0 === 'CLIENT'), not hardcoded by row number.
