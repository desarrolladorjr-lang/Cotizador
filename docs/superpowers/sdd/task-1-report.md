# Task 1 Report: Scaffold Next.js dashboard project

## Summary

Scaffolded the `dashboard/` project skeleton exactly as specified in `task-1-brief.md`: all 10 files created verbatim, dependencies installed, git repo initialized and committed. One pre-existing dependency-resolution issue (duplicate `vite` major versions) causes `tsc --noEmit` to fail on `vitest.config.ts` only — app source files type-check cleanly. This is flagged as a concern below; no file content was altered to work around it.

## What was done

### Step 1: Files created (all verbatim per brief)

- `dashboard/package.json`
- `dashboard/tsconfig.json`
- `dashboard/next.config.js`
- `dashboard/vitest.config.ts`
- `dashboard/vitest.setup.ts`
- `dashboard/.env.local.example`
- `dashboard/.gitignore` (later amended, see Deviations)
- `dashboard/src/app/layout.tsx`
- `dashboard/src/app/page.tsx`
- `dashboard/src/app/globals.css`

All content matches the brief exactly, no edits to logic/structure.

### Step 2: Install dependencies

Command:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npm install
```
Output (abridged):
```
npm warn deprecated whatwg-encoding@3.1.1: ...
npm warn deprecated uuid@9.0.1: ...
added 268 packages, and audited 269 packages in 4m
56 packages are looking for funding
10 vulnerabilities (7 moderate, 2 high, 1 critical)
```
Exit code: 0. `node_modules` and `package-lock.json` were created as expected. The reported vulnerabilities are from transitive deps of the pinned package versions in the brief; not addressed per task scope (scaffolding only).

### Step 3: Type-check verification (before commit)

Command: `npx tsc --noEmit`

Result: **Failed (exit code 2)** — but only on `vitest.config.ts`, with a deep generic type-compatibility error:
```
vitest.config.ts(6,13): error TS2769: No overload matches this call.
... Type 'Plugin<any>' is not assignable to type 'PluginOption'.
... node_modules/vite/dist/node/index ... vs ... node_modules/vitest/node_modules/vite/dist/node/index ...
```

Root cause investigated: npm resolved **two different major versions of `vite`** in `node_modules`:
- top-level `vite@7.3.5` (pulled in transitively, likely via `@vitejs/plugin-react` or another dep)
- `vitest@1.6.x`'s own nested `node_modules/vitest/node_modules/vite@5.4.21` (vitest 1.x requires vite 4/5)

These two `vite` packages have structurally incompatible `Plugin`/`PluginOption` types, so the call `react()` (typed against v7) doesn't satisfy `defineConfig({ plugins: [...] })` (typed against v5, vitest's bundled copy). This is a classic duplicate-peer-dependency type clash, **not** caused by a missing generated file.

I verified this is unrelated to the brief's anticipated "missing `next-env.d.ts`" scenario:
1. Ran `npx next build` once — it generated `next-env.d.ts` successfully (and also auto-mutated `tsconfig.json`, adding `allowJs`, `noEmit`, `.next/types/**/*.ts` to `include`). The build itself **still failed** with the identical `vitest.config.ts` type error.
2. I reverted `tsconfig.json` back to the brief's exact verbatim content (undoing Next's auto-mutation) since the brief requires exact file contents.
3. Re-ran `npx tsc --noEmit` with `next-env.d.ts` now present and `tsconfig.json` reverted: **same identical error**, confirming it is not related to the missing-file scenario.
4. Isolated test: ran `tsc` directly against only `src/app/layout.tsx` and `src/app/page.tsx` with equivalent compiler flags — **exit code 0, no errors**. The app source code is clean; the failure is 100% confined to `vitest.config.ts`'s interaction with the duplicate `vite` installs.

Per the brief's instructions, I did not alter `vitest.config.ts` or `package.json` content to "fix" this, since the brief specifies their content verbatim and the fallback clause only covers the missing-`next-env.d.ts` case (which I ruled out). I left `next-env.d.ts` in place since it's harmless/expected and a normal generated artifact, and cleaned up the `.next` build directory afterward (gitignored anyway, and removed before commit).

### Step 4: git init and commit

Commands:
```
cd "C:/Users/jesus/Documents/Cotizador/dashboard"
git init
git add -A
git commit -m "chore: scaffold Next.js dashboard project"
```
Output: repo initialized; commit `33bafea` created with 13 files (including `package-lock.json` and the generated `next-env.d.ts`). LF→CRLF warnings only (cosmetic, no errors). Exit code 0.

Follow-up cleanup commit (see Deviations): commit `2be49fa` untracks `tsconfig.tsbuildinfo` (an incremental-build cache artifact created by the `incremental: true` tsconfig option during the tsc runs above) and adds `*.tsbuildinfo` to `.gitignore`.

Final commit log:
```
2be49fa chore: untrack tsc incremental build cache
33bafea chore: scaffold Next.js dashboard project
```

`node_modules` confirmed excluded from both commits; `git status` is clean.

## Deviations from the brief

1. **`.gitignore` amended** after the initial commit: added a `*.tsbuildinfo` line. Cause: `tsconfig.json`'s `incremental: true` option (specified verbatim by the brief) causes `tsc` to write a `tsconfig.tsbuildinfo` cache file to disk; it got swept into the first commit via `git add -A`. This is a local build-cache artifact with no source value, so I untracked it and ignored the pattern going forward. No other brief-specified file content was changed.
2. **`next-env.d.ts` is committed**, per the brief's own contingency instructions ("you may run `npx next build` once to let Next.js generate `next-env.d.ts` ... then commit that generated file"). Confirmed it is not gitignored by default Next.js conventions (it isn't covered by the brief's minimal `.gitignore`).
3. **`tsconfig.json`'s auto-mutation by `next build` was reverted.** Running `next build` causes Next.js to rewrite `tsconfig.json` (adding `allowJs`, `noEmit`, and a `.next/types/**/*.ts` include entry). Since the brief mandates exact tsconfig content, I reverted this mutation before committing. The committed `tsconfig.json` matches the brief exactly.

## Concern (unresolved, flagged for visibility)

`npx tsc --noEmit` **fails** (exit 2) due to a duplicate-`vite`-version type conflict between top-level `vite@7.3.5` and vitest's nested `vite@5.4.21`, isolated entirely to `vitest.config.ts`'s `plugins: [react()]` line. All actual app source (`layout.tsx`, `page.tsx`) type-checks cleanly in isolation. This will likely also surface when `npm test` (vitest) is run in a later task, or may resolve itself silently since vitest's own bundler runs through its nested vite copy at runtime (the conflict is a type-level/IDE issue, not necessarily a runtime one — this was not verified by running `npm test`, which is out of scope for Task 1's file list but worth flagging for whichever task first writes a test). A future task or a `package.json` `overrides`/`resolutions` pin to force a single `vite` version may be needed if this blocks CI type-checking.

## Files touched (outside brief's exact list)

- `dashboard/next-env.d.ts` — created by Next.js, committed per brief's contingency clause.
- `dashboard/.gitignore` — one line added (`*.tsbuildinfo`) beyond brief's exact content, justified above.
- `dashboard/package-lock.json` — created by `npm install`, expected per Step 2.

No files outside `dashboard/` were touched.
