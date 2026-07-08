# Final Review Fix Report

Fixes applied for the whole-branch code review findings on `dashboard` (HEAD was `8b84279`, all 8 plan tasks done, 18/18 tests green).

## Changes

### Important #1 — expanded row detail has no column labels
`src/components/FeedTable.tsx`:
- Added three static label arrays (`STANDARD_LABELS`, `COMPRAS_LABELS`, `INVENTARIOS_LABELS`) matching the column order documented in `src/lib/normalizeFeed.ts`'s comments (Codigo.gs `doPost` append order).
- Added `labelsForTipo(tipo)` helper to pick the right label set for `Terrestre`/`Marítimo`/`Nacional` (standard, 24 cols), `Compras` (17 cols), and `Inventarios` (8 cols).
- Expanded-row rendering now maps each `raw[j]` to `<span><span>{label}: </span><span>{value} </span></span>` when a label exists at index `j`, falling back to a bare `<span>{value} </span>` (no label, no throw) when `j` is beyond the label array's length — satisfies the defensive requirement for raw/label length mismatches.
- Kept label and value as separate sibling text nodes (not concatenated into one string) specifically so the existing test's `screen.getByText('Prov1')` exact match still finds a node whose text content is exactly `'Prov1'` (the trailing space is inside its own span/text node). No test file changes were needed for this finding.

### Important #2 — expanded row index stale after filter changes
`src/components/FeedTable.tsx`:
- The tipo filter button's `onClick` now calls `setExpandedIndex(null)` alongside `setFiltro(tipo)`, so switching filters always collapses any previously expanded row instead of leaving a stale numeric index pointing at the wrong row in the new `visibleRows`.

### Minor #3 — 503 fallback's `sheetName: 'unknown'` not a valid `SheetName`
`src/lib/normalizeFeed.ts`:
- Narrowed the fix to the type only, per the "minimal blast radius" instruction: `NormalizeResult.errors` field type changed from `{ sheetName: SheetName; error: string }[]` to `{ sheetName: SheetName | 'unknown'; error: string }[]`.
- Updated the matching local `errors` array type annotation inside `normalizeFeed()` to the same union.
- `src/app/api/feed/route.ts` was not modified — the existing `{ sheetName: 'unknown', error: ... }` object literal is now legitimately typed against the updated `NormalizeResult`/`errors` shape without any call-site change. Per-sheet error push logic in `normalizeFeed()` (which always pushes a real `SheetName`) is untouched.

### Minor #5 — `feedCache.test.ts` tsc noise
`src/lib/feedCache.test.ts`:
- Changed `beforeEach(() => vi.useFakeTimers());` to `beforeEach(() => { vi.useFakeTimers(); });` and `afterEach(() => vi.useRealTimers());` to `afterEach(() => { vi.useRealTimers(); });` — explicit block bodies so the arrow functions return `undefined` instead of whatever `vi.useFakeTimers()`/`vi.useRealTimers()` return, matching the `beforeEach`/`afterEach` callback signature tsc expects.
- `vitest.config.ts`'s known/accepted vite-version skew tsc error was left untouched, as instructed.

### Skipped (no action, per instructions)
- Minor #4 (singleton cache comment) — optional, skipped.
- Minor #6 (AuthGate unused mock) — intentional/harmless, skipped.

## Commands run

```
cd C:\Users\jesus\Documents\Cotizador\dashboard
npx vitest run src/components/FeedTable.test.tsx src/lib/feedCache.test.ts
npx vitest run
npx tsc --noEmit
git add -A && git commit -m "fix: label expanded row columns, reset expand state on filter change, type 503 sheetName, fix tsc noise in feedCache test"
```

### Targeted test run (FeedTable.test.tsx + feedCache.test.ts)

```
 ✓ src/lib/feedCache.test.ts (3 tests) 3ms
 ✓ src/components/FeedTable.test.tsx (5 tests) 78ms

 Test Files  2 passed (2)
      Tests  8 passed (8)
```

### Full suite run

```
 ✓ src/lib/normalizeFeed.test.ts (4 tests) 8ms
 ✓ src/lib/feedCache.test.ts (3 tests) 8ms
 ✓ src/app/api/feed/route.test.ts (2 tests) 41ms
 ✓ src/components/AuthGate.test.tsx (2 tests) 25ms
 ✓ src/components/FeedTable.test.tsx (5 tests) 103ms
 ✓ src/lib/sheetsClient.test.ts (2 tests) 7ms

 Test Files  6 passed (6)
      Tests  18 passed (18)
```

### tsc --noEmit

Only the known, already-accepted `vitest.config.ts` vite-version-skew error remains (untouched, out of scope). No new tsc errors from the changed files.

## Files touched

- `src/components/FeedTable.tsx`
- `src/lib/normalizeFeed.ts`
- `src/lib/feedCache.test.ts`

## Commit

```
2de4b15039981bd712eff24f18bc082232ec7150
fix: label expanded row columns, reset expand state on filter change, type 503 sheetName, fix tsc noise in feedCache test
```

Result: 18 passed, 0 failed.
