# Simulador de Precios — Design Spec
Date: 2026-05-27

## Overview

Add a "Simular" mode to the Terrestre and Marítimo tabs. Users can play freely with all pricing parameters and see the calculated results (Tope Máximo, TC Seguro, Utilidad) without saving anything. Optionally, they can copy the simulated values into the real quoter with one tap.

## Approach

Extend the existing 2-button toggle bar ("Compra Inventarios" / "Back to Back") into a 3-button bar by adding a "🧪 Simular" third state. The simulator is visually differentiated (blue accent `#3b82f6` vs orange `#ff6600`) and uses an independent set of state variables so the real quoter is never affected.

## State

Add a boolean `modoSimulador` (default `false`). When true, the form renders using simulator-specific state variables:

```
simFixPrice         default "2550.00"
simPorcentajeFijacion  default "100"
simTcHoy            default "" (same as real tcHoy on mount, or empty)
simDiasCobro        default "15"
simFleteNac         default "0"
simCruceInt         default "0"
simAduanaMex        default "2308"
simAduanaUsa        default "65"
simMerma            default "1"
simManiobras        default "0.60"
simPpProv           default "40.00"
simRutaNacSelect    default ""
simRutaIntSelect    default ""
```

Simulator defaults mirror the real quoter defaults so the form feels familiar.

## Math Engine

The existing math engine runs on the real state variables. The simulator adds a parallel derived calculation block using sim* variables:

```javascript
// Computed from sim* vars (same formulas as real engine)
simPrecioVenta
simTcSeguro
simPrecioTopeCompra
simUtilidadNeta
simUtilidadPorKg
simStatus
```

Both engines can coexist — real one runs from its `useEffect`, simulator runs inline via `useMemo` or a mirrored `useEffect`. Since simulador state is only active when `modoSimulador === true`, performance impact is negligible.

## UI Changes

### Toggle bar (extends existing)

```
[ Compra Inventarios ]  [ Back to Back ]  [ 🧪 Simular ]
```

- "Simular" active state: blue background `#3b82f6`, white text, border `#2563eb`
- Activating "Simular" resets all `sim*` vars to their defaults
- Switching back to "Compra Inventarios" or "Back to Back" sets `modoSimulador = false` (no state loss on real vars)

### Banner (shown only in simulator mode)

```
🧪 SIMULACIÓN — Los valores no se guardarán
```

Blue banner (`bg-blue-900 border-blue-700 text-blue-300`) shown between toggle bar and form when `modoSimulador === true`.

### Form fields

When `modoSimulador === true`, all form inputs bind to `sim*` variables instead of the real ones. The form is visually identical except:
- Input borders use blue focus color instead of white
- TC Seguro output uses blue instead of orange
- The "🔄 Act." TC refresh button calls `obtenerTipoDeCambio` but writes the result to `simTcHoy` instead of `tcHoy`

The same "Flete Int." select (shown when Back to Back is active) is NOT shown in simulator mode — simulator is always Compra Inventarios-style since it has no client context.

### Footer buttons (replaces "Guardar Trato")

Two buttons:
1. **"✅ Usar estos valores →"** (primary, blue `#3b82f6`)
   - Copies sim* → real state vars
   - Sets `modoSimulador = false` and `compraDirecta = false`
   - Does NOT copy client/material/destino/proveedor/cargas
2. **"Limpiar"** (secondary, dark gray)
   - Resets all sim* vars to defaults

## "Usar estos valores" — Copy mapping

| From | To |
|------|----|
| simFixPrice | fixPrice |
| simPorcentajeFijacion | porcentajeFijacion |
| simTcHoy | tcHoy |
| simDiasCobro | diasCobro |
| simFleteNac | fleteNac |
| simAduanaMex | aduanaMex |
| simAduanaUsa | aduanaUsa |
| simMerma | merma |
| simManiobras | maniobras |
| simPpProv | ppProv |
| simRutaNacSelect | rutaNacSelect |

CruceInt is intentionally excluded (simulator is always Compra Inventarios style).

## What does NOT change

- Tabs (Terrestre / Marítimo / Inventarios)
- Real save flow (handleGuardarCotizacion, doPost)
- Compra Directa / Back to Back logic
- Client/material/destino/proveedor dropdowns
- Auth (Google Sign-In)
- Inventarios tab

## Scope

Frontend only. No backend changes. No new files — all changes in `index.html`.
