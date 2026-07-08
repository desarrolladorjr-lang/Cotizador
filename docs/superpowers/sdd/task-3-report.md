# Task 3 Report: Normalize feed rows

## Summary
Implemented `normalizeFeed` per the brief, following strict TDD: wrote the test file first, confirmed
failure (module not found), wrote the implementation verbatim from the brief, confirmed all 4 tests
pass, then committed.

## Files changed
- Created: `dashboard/src/lib/normalizeFeed.test.ts`
- Created: `dashboard/src/lib/normalizeFeed.ts`

No other files were touched.

## Step-by-step record

### Step 1: Write failing test
Wrote `src/lib/normalizeFeed.test.ts` with the exact test code from the brief (4 test cases:
standard-sheet positional normalization, Compras column layout, error collection without dropping
other rows, and descending sort by `fecha`).

### Step 2: Run test, confirm failure
Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/normalizeFeed.test.ts
```
Output (abridged):
```
FAIL  src/lib/normalizeFeed.test.ts [ src/lib/normalizeFeed.test.ts ]
Error: Failed to resolve import "./normalizeFeed" from "src/lib/normalizeFeed.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
Failed for the expected reason: module `./normalizeFeed` did not exist yet.

### Step 3: Implement normalizeFeed.ts
Wrote `src/lib/normalizeFeed.ts` verbatim from the brief: exports `FeedRow`, `NormalizeResult`, and
`normalizeFeed(results: SheetFetchResult[]): NormalizeResult`. Internally dispatches to
`normalizeStandardRow` (Terrestre/Marítimo/Nacional, positional columns matching Codigo.gs doPost
append order), `normalizeComprasRow`, and `normalizeInventariosRow`; skips the header row (index 0)
and blank rows; collects `{ sheetName, error }` for any result with `rows === null`; sorts the final
row list by `fecha` descending.

Verified the consumed types (`SheetFetchResult`, `SheetName`) in `src/lib/sheetsClient.ts` match the
brief's expectations before implementing — they do (`SheetName` is a union including `'Terrestre' |
'Marítimo' | 'Nacional' | 'Compras' | 'Inventarios'`, `SheetFetchResult` has `sheetName`, `rows:
string[][] | null`, optional `error`).

### Step 4: Run test, confirm pass
Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/normalizeFeed.test.ts
```
Output (abridged):
```
✓ src/lib/normalizeFeed.test.ts (4 tests) 5ms
Test Files  1 passed (1)
     Tests  4 passed (4)
```
All 4 tests passed as expected.

### Step 5: Commit
Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/normalizeFeed.ts src/lib/normalizeFeed.test.ts && git commit -m "feat: normalize per-sheet rows into a common FeedRow shape"
```
Result: commit `ec1c3a0` on `master`, 2 files changed, 170 insertions(+). (Git emitted benign
LF→CRLF warnings for both new files; no content issue, consistent with repo's existing line-ending
config from earlier tasks.)

## Deviations
None. Test and implementation code match the brief verbatim. Did not touch any files outside the
two specified.

## Self-review notes
- Confirmed `sheetsClient.ts` exports line up with what the brief and test file expect — no
  surprises, no need to adjust imports.
- The known `tsc --noEmit` / vite-version type clash (isolated to `vitest.config.ts`) was not
  re-checked since it's explicitly called out as unrelated/non-blocking; `vitest run` is the
  authoritative check for this task and it's green.
- Did not run the full test suite (only the scoped `normalizeFeed.test.ts` file), per the
  instructions' explicit run command. No reason to expect interaction with other test files since
  this module has no side effects and only the two new files were added.

---

# Bugfix follow-up: sort comparator used naive string comparison on DD/MM/YYYY dates

## Summary
Code review on `ec1c3a0` found that `normalizeFeed`'s sort comparator (`a.fecha < b.fecha ? 1 : ...`)
assumed ISO `YYYY-MM-DD` format, but the real production `fecha` value (written by
`deploy/index.html` line 783 via `new Date().toLocaleDateString('es-MX')`) is actually `DD/MM/YYYY`
(e.g. `"19/06/2026"`). Lexicographic string comparison on that format does not sort chronologically
across month/year boundaries (e.g. `"03/01/2026"` sorts before `"25/12/2025"` as strings, despite
Dec 2025 being chronologically earlier). Fixed by adding a private `parseFechaForSort` helper that
converts `DD/MM/YYYY` into a comparable `YYYYMMDD` number, used only for the sort comparator — the
displayed `fecha` field is left untouched as the original string.

## Exact diff
```diff
diff --git a/src/lib/normalizeFeed.test.ts b/src/lib/normalizeFeed.test.ts
index e056975..ceab7c3 100644
--- a/src/lib/normalizeFeed.test.ts
+++ b/src/lib/normalizeFeed.test.ts
@@ -9,7 +9,7 @@ describe('normalizeFeed', () => {
         sheetName: 'Terrestre',
         rows: [
           ['Fecha', 'Usuario', 'Cliente', 'Proveedor', 'Cargas', 'Material'],
-          ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'],
+          ['19/06/2026', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'],
         ],
       },
     ];
@@ -19,7 +19,7 @@ describe('normalizeFeed', () => {
     expect(result.rows).toHaveLength(1);
     expect(result.rows[0]).toMatchObject({
       tipo: 'Terrestre',
-      fecha: '2026-06-19',
+      fecha: '19/06/2026',
       usuario: 'jesus',
       clienteOProveedor: 'ACME',
       material: 'Maiz',
@@ -34,7 +34,7 @@ describe('normalizeFeed', () => {
         sheetName: 'Compras',
         rows: [
           ['Fecha', 'Usuario', 'Proveedor', 'Cargas', 'Material'],
-          ['2026-06-19', 'jesus', 'CALDERA', '3', 'Sorgo'],
+          ['19/06/2026', 'jesus', 'CALDERA', '3', 'Sorgo'],
         ],
       },
     ];
@@ -57,7 +57,7 @@ describe('normalizeFeed', () => {
         sheetName: 'Nacional',
         rows: [
           ['Fecha', 'Usuario', 'Cliente'],
-          ['2026-06-18', 'ana', 'Cliente X'],
+          ['18/06/2026', 'ana', 'Cliente X'],
         ],
       },
     ];
@@ -74,14 +74,16 @@ describe('normalizeFeed', () => {
         sheetName: 'Terrestre',
         rows: [
           ['Fecha'],
-          ['2026-06-10', 'a', 'c1', 'p1', '1', 'm1'],
-          ['2026-06-19', 'b', 'c2', 'p2', '1', 'm2'],
+          ['25/12/2025', 'a', 'c1', 'p1', '1', 'm1'],
+          ['03/01/2026', 'b', 'c2', 'p2', '1', 'm2'],
         ],
       },
     ];
 
     const result = normalizeFeed(results);
 
-    expect(result.rows.map((r) => r.fecha)).toEqual(['2026-06-19', '2026-06-10']);
+    // 03/01/2026 (Jan 2026) is chronologically later than 25/12/2025 (Dec 2025),
+    // even though naive string comparison would order them the other way.
+    expect(result.rows.map((r) => r.fecha)).toEqual(['03/01/2026', '25/12/2025']);
   });
 });
diff --git a/src/lib/normalizeFeed.ts b/src/lib/normalizeFeed.ts
index 7168cb9..3882f80 100644
--- a/src/lib/normalizeFeed.ts
+++ b/src/lib/normalizeFeed.ts
@@ -56,6 +56,16 @@ function normalizeInventariosRow(row: string[]): FeedRow {
   };
 }
 
+// fecha is written as DD/MM/YYYY (see deploy/index.html toLocaleDateString('es-MX')).
+// Lexicographic string comparison does not sort that format chronologically across
+// month/year boundaries, so we derive a comparable YYYYMMDD numeric key for sorting
+// only; the displayed fecha string is left untouched.
+function parseFechaForSort(fecha: string): number {
+  const [day, month, year] = fecha.split('/').map(Number);
+  if (!day || !month || !year) return 0;
+  return year * 10000 + month * 100 + day;
+}
+
 export function normalizeFeed(results: SheetFetchResult[]): NormalizeResult {
   const rows: FeedRow[] = [];
   const errors: { sheetName: SheetName; error: string }[] = [];
@@ -78,6 +88,6 @@ export function normalizeFeed(results: SheetFetchResult[]): NormalizeResult {
     }
   }
 
-  rows.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
+  rows.sort((a, b) => parseFechaForSort(b.fecha) - parseFechaForSort(a.fecha));
   return { rows, errors };
 }
```

## Test command
```
cd "C:\Users\jesus\Documents\Cotizador\dashboard" && npx vitest run src/lib/normalizeFeed.test.ts
```

## Full test output
```
The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.

 RUN  v1.6.1 C:/Users/jesus/Documents/Cotizador/dashboard

 ✓ src/lib/normalizeFeed.test.ts (4 tests) 3ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  10:55:29
   Duration  742ms (transform 32ms, setup 69ms, collect 20ms, tests 3ms, environment 354ms, prepare 103ms)
```

## Commit
```
cd "C:\Users\jesus\Documents\Cotizador\dashboard" && git add src/lib/normalizeFeed.ts src/lib/normalizeFeed.test.ts && git commit -m "fix: sort feed rows by parsed DD/MM/YYYY date, not raw string comparison"
```
Result: commit `0c38851` on `master`, 2 files changed (20 insertions, 8 deletions). Benign LF→CRLF
warnings only, no content issue.

## Deviations
None. Only the two specified files (`normalizeFeed.ts`, `normalizeFeed.test.ts`) were touched, plus
this report file as instructed.
