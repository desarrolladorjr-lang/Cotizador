# Task 7 Report: AuthGate component + page wiring

## Summary

Implemented `AuthGate.tsx` (Google Sign-In gate) using TDD, then rewired `src/app/page.tsx` to poll `/api/feed` and wrap the dashboard content with `AuthGate` + `FeedTable`. All steps from the brief (`docs/superpowers/sdd/task-7-brief.md`) were followed exactly, with code used verbatim as specified.

## Steps performed

### Step 1: Write failing test

Created `dashboard/src/components/AuthGate.test.tsx` with the exact test code from the brief — two tests:
1. `shows the sign-in button before login` — asserts children are not rendered before a Google credential callback fires.
2. `renders children after a credential callback fires` — fakes a JWT credential, fires the captured `__gsiCallback`, asserts children are rendered.

### Step 2: Run test, confirm failure

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```

Result: **FAIL** as expected — `Error: Failed to resolve import "./AuthGate" from "src/components/AuthGate.test.tsx". Does the file exist?`

```
 ❯ src/components/AuthGate.test.tsx (0 test)
 FAIL src/components/AuthGate.test.tsx [ src/components/AuthGate.test.tsx ]
Error: Failed to resolve import "./AuthGate" from "src/components/AuthGate.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

Failure reason matches expectation: module not found (AuthGate.tsx did not exist yet).

### Step 3: Implement AuthGate.tsx

Created `dashboard/src/components/AuthGate.tsx` with the exact implementation from the brief: a client component that calls `window.google.accounts.id.initialize` / `renderButton` in a `useEffect`, decodes the JWT credential payload via `atob` + `JSON.parse` on callback, stores the decoded user in state, and renders `children` once a user is set (otherwise renders an empty `<div ref={buttonRef} />` placeholder for the Google button).

### Step 4: Run test, confirm pass

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```

Result: **PASS**, 2/2 tests.

```
 ✓ src/components/AuthGate.test.tsx (2 tests) 20ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

### Step 5: Wire page.tsx

Rewrote `dashboard/src/app/page.tsx` (previously a placeholder `<main>Dashboard en construcción</main>`) to the exact implementation from the brief:
- Loads `https://accounts.google.com/gsi/client` via `next/script` with `strategy="afterInteractive"`.
- Polls `/api/feed` on mount and every 45s (`POLL_MS = 45_000`) via `setInterval`, with a `cancelled` flag and `clearInterval` cleanup to avoid state updates after unmount.
- Tracks `data: FeedResponse` (`rows`, `errors`, `stale`) and `updatedAt: Date | null`.
- Wraps the page body in `<AuthGate>`, rendering an `<h1>`, a last-updated timestamp (once available), and `<FeedTable rows={data.rows} errors={data.errors} stale={data.stale} />`.

No dedicated test file for `page.tsx` per the brief — it is wired manually and exercised indirectly via the existing `AuthGate` and `FeedTable` unit tests.

### Step 6: Run full suite

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run
```

Result: **PASS**, all 6 test files / 18 tests.

```
 ✓ src/lib/feedCache.test.ts (3 tests) 3ms
 ✓ src/lib/normalizeFeed.test.ts (4 tests) 4ms
 ✓ src/app/api/feed/route.test.ts (2 tests) 23ms
 ✓ src/components/AuthGate.test.tsx (2 tests) 23ms
 ✓ src/components/FeedTable.test.tsx (5 tests) 87ms
 ✓ src/lib/sheetsClient.test.ts (2 tests) 2ms

 Test Files  6 passed (6)
      Tests  18 passed (18)
```

### Step 7: Commit

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/AuthGate.tsx src/components/AuthGate.test.tsx src/app/page.tsx && git commit -m "feat: gate dashboard behind Google Sign-In and poll /api/feed"
```

Result:

```
[master 497044c] feat: gate dashboard behind Google Sign-In and poll /api/feed
 3 files changed, 128 insertions(+), 1 deletion(-)
 create mode 100644 src/components/AuthGate.test.tsx
 create mode 100644 src/components/AuthGate.tsx
```

Commit hash: **`497044c`**

`git status` after commit confirmed a clean working tree for the dashboard repo (only the pre-existing, unrelated `docs/` directory remains untracked — outside this task's scope and not modified by it).

## Deviations from the brief

None. All test code and implementation code (`AuthGate.test.tsx`, `AuthGate.tsx`, `page.tsx`) were used verbatim as specified in the brief. Commit message and staged file list match the brief's Step 7 exactly.

## Self-review notes

- `AuthGate` only renders `children` once `window.google.accounts.id` calls back with a credential; before that it renders an empty placeholder `div` (the future home of the rendered Google button). This matches the interface contract in the brief ("Renders `children` once `window.google` calls back with a credential; otherwise renders a sign-in button container").
- The `useEffect` dependency array is `[user]` — it re-runs (a no-op due to the early `if (user) return`) after sign-in, which is harmless and matches the brief's code exactly; not something I should "fix" since the brief specifies exact verbatim code.
- `decodeJwt` makes no integrity/signature verification of the JWT — this is acceptable for this task's scope (client-side display of name/email only) and matches the brief; no security validation was requested.
- `page.tsx`'s polling effect correctly guards against state updates after unmount via the `cancelled` flag, and clears the interval on cleanup.
- Did not modify any files outside the three permitted paths (`src/components/AuthGate.tsx`, `src/components/AuthGate.test.tsx`, `src/app/page.tsx`).
- Did not run `npx tsc --noEmit` since the brief notes a known pre-existing, unrelated failure isolated to `vitest.config.ts` and instructs to ignore it; `vitest run` (which was run) is unaffected and all 18 tests pass, including the 2 new AuthGate tests and the full existing suite (FeedTable, normalizeFeed, feedCache, api/feed route, sheetsClient).
