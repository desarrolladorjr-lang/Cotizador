# Task 5 Report: /api/feed route

## Summary

Implemented the Next.js App Router GET handler at `dashboard/src/app/api/feed/route.ts`, wiring together `fetchAllSheets` (`@/lib/sheetsClient`), `normalizeFeed`/`NormalizeResult` (`@/lib/normalizeFeed`), and `createTtlCache` (`@/lib/feedCache`) per the task brief. Followed TDD exactly as specified.

## Files changed

- Created: `C:\Users\jesus\Documents\Cotizador\dashboard\src\app\api\feed\route.test.ts`
- Created: `C:\Users\jesus\Documents\Cotizador\dashboard\src\app\api\feed\route.ts`

No other files were touched.

## Steps executed

### Step 1: Write failing test

Created `route.test.ts` with the exact test code from the brief (two tests: success path returning normalized rows with `stale: false`, and cache-stale-fallback path after fake-timer advance past the 25s TTL).

### Step 2: Run test, confirm failure

Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/app/api/feed/route.test.ts
```
Result: **FAIL** as expected.
```
FAIL src/app/api/feed/route.test.ts [ src/app/api/feed/route.test.ts ]
Error: Failed to resolve import "./route" from "src/app/api/feed/route.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
This confirms the test harness and the `@/*` → `src/*` alias setup load correctly (the mock for `@/lib/sheetsClient` was accepted; the only failure was the missing `./route` module), matching the expected failure reason in the brief.

### Step 3: Implement route.ts

Created `route.ts` with the exact implementation code from the brief — a module-level `createTtlCache<NormalizeResult>(25_000)`, with `GET()` checking the cache first, calling `fetchAllSheets()` + `normalizeFeed()` on cache miss, caching the result, and falling back to `cache.getStale()` (marking `stale: true`) on fetch failure, with a 503 + empty-rows fallback if no stale data exists either.

### Step 4: Run test, confirm pass

Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/app/api/feed/route.test.ts
```
Result: **PASS**, 2/2 tests.
```
✓ src/app/api/feed/route.test.ts (2 tests) 23ms
Test Files  1 passed (1)
     Tests  2 passed (2)
```
Confirms:
- `@/lib/sheetsClient` mock via `vi.mock` resolves correctly through the `@/*` alias.
- Success path normalizes rows and returns `stale: false`.
- Stale-fallback path: after `vi.advanceTimersByTime(30_000)` (past the 25s TTL), a second `GET()` call with a rejected `fetchAllSheets` falls back to the previously cached data and returns `stale: true`.

### Step 5: Commit

Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/app/api/feed/route.ts src/app/api/feed/route.test.ts && git commit -m "feat: add /api/feed route with caching and stale fallback"
```
Output:
```
warning: in the working copy of 'src/app/api/feed/route.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/app/api/feed/route.ts', LF will be replaced by CRLF the next time Git touches it
[master 348dd74] feat: add /api/feed route with caching and stale fallback
 2 files changed, 89 insertions(+)
 create mode 100644 src/app/api/feed/route.test.ts
 create mode 100644 src/app/api/feed/route.ts
```
Commit hash: **348dd74**

(The LF/CRLF warnings are pre-existing repo line-ending config behavior, not an error — commit succeeded.)

## Deviations from brief

None. Test file and implementation file were written verbatim as specified in the brief.

## Self-review notes

- Confirmed the `@/*` path alias (configured in Task 1) resolves correctly under both Vitest's module resolution and the `vi.mock('@/lib/sheetsClient', ...)` mock factory — no alias-related friction encountered.
- Did not run `npx tsc --noEmit` since the brief flagged a known pre-existing, unrelated vite-version type clash in `vitest.config.ts` as non-blocking and out of scope.
- Did not modify any files outside the two files listed in the brief.
- `git status` before starting showed only an untracked `docs/` directory (this report's own directory) — no stray modifications from prior tasks.
