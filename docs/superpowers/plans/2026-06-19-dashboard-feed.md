# Dashboard Feed v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate Next.js dashboard app that reads the 5 Cotizador sheets (Terrestre, Marítimo, Nacional, Compras, Inventarios) via the Google Sheets API and shows a live, auto-refreshing feed gated behind Google Sign-In.

**Architecture:** Next.js App Router project (`./dashboard`), deployed standalone on Vercel. A server-side API route (`/api/feed`) authenticates to Google Sheets via a service account, reads all 5 sheets, normalizes rows into a common shape, caches the result in memory for 20-25s, and returns JSON. The client page polls that route every 30-60s and renders a filterable table behind a Google Sign-In gate.

**Tech Stack:** Next.js 14 (App Router, TypeScript), `googleapis` npm package for Sheets API, Vitest + @testing-library/react for tests, Vercel for hosting.

## Global Constraints

- Spreadsheet ID is fixed: `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` (same one `Codigo.gs` writes to).
- Sheet names to read: `Terrestre`, `Marítimo`, `Nacional`, `Compras`, `Inventarios`.
- Google Sign-In `client_id`: `65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com` (reuse Cotizador's — no new OAuth client).
- No email/domain restriction on login (any Google account passes).
- Read-only: this app never writes to the spreadsheet.
- One sheet failing to load must never break the other 4 — errors are per-sheet.
- Cache TTL: 25 seconds. Refresh interval on client: every 30-60s (use 45s).
- Project lives at `C:\Users\jesus\Documents\Cotizador\dashboard`, its own git repo (separate from Cotizador, which has no git repo).

---

### Task 1: Scaffold project

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.js`
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/vitest.setup.ts`
- Create: `dashboard/.env.local.example`
- Create: `dashboard/.gitignore`
- Create: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/page.tsx`
- Create: `dashboard/src/app/globals.css`

**Interfaces:**
- Produces: working Next.js dev server (`npm run dev`), Vitest runner (`npm test`), path alias `@/*` → `dashboard/src/*`.

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir -p "C:/Users/jesus/Documents/Cotizador/dashboard/src/app"
```

`dashboard/package.json`:
```json
{
  "name": "dashboard-feed",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "googleapis": "^144.0.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`dashboard/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

`dashboard/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
```

`dashboard/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`dashboard/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`dashboard/.env.local.example`:
```
GOOGLE_SERVICE_ACCOUNT_KEY={"client_email":"...","private_key":"..."}
```

`dashboard/.gitignore`:
```
node_modules
.next
.env.local
```

`dashboard/src/app/globals.css`:
```css
body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f5; }
```

`dashboard/src/app/layout.tsx`:
```tsx
import './globals.css';

export const metadata = { title: 'Dashboard Cotizador' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

`dashboard/src/app/page.tsx` (placeholder, replaced in Task 7):
```tsx
export default function Page() {
  return <main>Dashboard en construcción</main>;
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npm install
```
Expected: installs without errors, creates `node_modules` and `package-lock.json`.

- [ ] **Step 3: Init git repo and commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git init && git add -A && git commit -m "chore: scaffold Next.js dashboard project"
```

---

### Task 2: Sheets client

**Files:**
- Create: `dashboard/src/lib/sheetsClient.ts`
- Test: `dashboard/src/lib/sheetsClient.test.ts`

**Interfaces:**
- Produces:
  - `SHEET_NAMES: readonly ['Terrestre','Marítimo','Nacional','Compras','Inventarios']`
  - `type SheetName = typeof SHEET_NAMES[number]`
  - `interface SheetFetchResult { sheetName: SheetName; rows: string[][] | null; error?: string }`
  - `fetchAllSheets(sheetsApi?: any): Promise<SheetFetchResult[]>`

- [ ] **Step 1: Write failing test**

`dashboard/src/lib/sheetsClient.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchAllSheets, SHEET_NAMES } from './sheetsClient';

function makeMockApi(responses: Record<string, string[][] | Error>) {
  return {
    spreadsheets: {
      values: {
        get: vi.fn(({ range }: { range: string }) => {
          const sheetName = range.split('!')[0];
          const res = responses[sheetName];
          if (res instanceof Error) return Promise.reject(res);
          return Promise.resolve({ data: { values: res } });
        }),
      },
    },
  };
}

describe('fetchAllSheets', () => {
  it('returns rows for every sheet when all succeed', async () => {
    const mockApi = makeMockApi({
      Terrestre: [['h1'], ['a', 'b']],
      'Marítimo': [['h1'], ['c', 'd']],
      Nacional: [['h1'], ['e', 'f']],
      Compras: [['h1'], ['g', 'h']],
      Inventarios: [['h1'], ['i', 'j']],
    });

    const results = await fetchAllSheets(mockApi as any);

    expect(results).toHaveLength(SHEET_NAMES.length);
    const terrestre = results.find((r) => r.sheetName === 'Terrestre');
    expect(terrestre?.rows).toEqual([['h1'], ['a', 'b']]);
    expect(terrestre?.error).toBeUndefined();
  });

  it('isolates a failing sheet without affecting the others', async () => {
    const mockApi = makeMockApi({
      Terrestre: new Error('permission denied'),
      'Marítimo': [['h1'], ['c', 'd']],
      Nacional: [['h1']],
      Compras: [['h1']],
      Inventarios: [['h1']],
    });

    const results = await fetchAllSheets(mockApi as any);

    const terrestre = results.find((r) => r.sheetName === 'Terrestre');
    expect(terrestre?.rows).toBeNull();
    expect(terrestre?.error).toBe('permission denied');

    const maritimo = results.find((r) => r.sheetName === 'Marítimo');
    expect(maritimo?.rows).toEqual([['h1'], ['c', 'd']]);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetsClient.test.ts
```
Expected: FAIL — `sheetsClient.ts` does not exist / export not found.

- [ ] **Step 3: Implement sheetsClient.ts**

`dashboard/src/lib/sheetsClient.ts`:
```ts
import { google } from 'googleapis';

export const SHEET_NAMES = ['Terrestre', 'Marítimo', 'Nacional', 'Compras', 'Inventarios'] as const;
export type SheetName = typeof SHEET_NAMES[number];

const SPREADSHEET_ID = '12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A';

export interface SheetFetchResult {
  sheetName: SheetName;
  rows: string[][] | null;
  error?: string;
}

function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}';
  const credentials = JSON.parse(raw);
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

type SheetsApi = ReturnType<typeof google.sheets>;

async function fetchSheetRows(sheetName: SheetName, api: SheetsApi): Promise<string[][]> {
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1000`,
  });
  return (res.data.values as string[][]) || [];
}

export async function fetchAllSheets(sheetsApi?: SheetsApi): Promise<SheetFetchResult[]> {
  const api = sheetsApi || google.sheets({ version: 'v4', auth: getAuthClient() });
  return Promise.all(
    SHEET_NAMES.map(async (sheetName): Promise<SheetFetchResult> => {
      try {
        const rows = await fetchSheetRows(sheetName, api);
        return { sheetName, rows };
      } catch (err) {
        return { sheetName, rows: null, error: (err as Error).message };
      }
    })
  );
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetsClient.test.ts
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/sheetsClient.ts src/lib/sheetsClient.test.ts && git commit -m "feat: add Google Sheets client with per-sheet error isolation"
```

---

### Task 3: Normalize feed rows

**Files:**
- Create: `dashboard/src/lib/normalizeFeed.ts`
- Test: `dashboard/src/lib/normalizeFeed.test.ts`

**Interfaces:**
- Consumes: `SheetFetchResult`, `SheetName` from `@/lib/sheetsClient`
- Produces:
  - `interface FeedRow { tipo: SheetName; fecha: string; usuario: string; clienteOProveedor: string; material: string; cargas: number; status: string | null; raw: string[] }`
  - `interface NormalizeResult { rows: FeedRow[]; errors: { sheetName: SheetName; error: string }[] }`
  - `normalizeFeed(results: SheetFetchResult[]): NormalizeResult`

- [ ] **Step 1: Write failing test**

`dashboard/src/lib/normalizeFeed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeFeed } from './normalizeFeed';
import type { SheetFetchResult } from './sheetsClient';

describe('normalizeFeed', () => {
  it('normalizes a standard sheet (Terrestre) using positional columns', () => {
    const results: SheetFetchResult[] = [
      {
        sheetName: 'Terrestre',
        rows: [
          ['Fecha', 'Usuario', 'Cliente', 'Proveedor', 'Cargas', 'Material'],
          ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'],
        ],
      },
    ];

    const result = normalizeFeed(results);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      tipo: 'Terrestre',
      fecha: '2026-06-19',
      usuario: 'jesus',
      clienteOProveedor: 'ACME',
      material: 'Maiz',
      cargas: 2,
    });
    expect(result.errors).toEqual([]);
  });

  it('normalizes Compras rows using the Compras column layout', () => {
    const results: SheetFetchResult[] = [
      {
        sheetName: 'Compras',
        rows: [
          ['Fecha', 'Usuario', 'Proveedor', 'Cargas', 'Material'],
          ['2026-06-19', 'jesus', 'CALDERA', '3', 'Sorgo'],
        ],
      },
    ];

    const result = normalizeFeed(results);

    expect(result.rows[0]).toMatchObject({
      tipo: 'Compras',
      clienteOProveedor: 'CALDERA',
      material: 'Sorgo',
      cargas: 3,
      status: null,
    });
  });

  it('collects an error for a failed sheet without dropping other rows', () => {
    const results: SheetFetchResult[] = [
      { sheetName: 'Marítimo', rows: null, error: 'permission denied' },
      {
        sheetName: 'Nacional',
        rows: [
          ['Fecha', 'Usuario', 'Cliente'],
          ['2026-06-18', 'ana', 'Cliente X'],
        ],
      },
    ];

    const result = normalizeFeed(results);

    expect(result.errors).toEqual([{ sheetName: 'Marítimo', error: 'permission denied' }]);
    expect(result.rows).toHaveLength(1);
  });

  it('sorts rows by fecha descending', () => {
    const results: SheetFetchResult[] = [
      {
        sheetName: 'Terrestre',
        rows: [
          ['Fecha'],
          ['2026-06-10', 'a', 'c1', 'p1', '1', 'm1'],
          ['2026-06-19', 'b', 'c2', 'p2', '1', 'm2'],
        ],
      },
    ];

    const result = normalizeFeed(results);

    expect(result.rows.map((r) => r.fecha)).toEqual(['2026-06-19', '2026-06-10']);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/normalizeFeed.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement normalizeFeed.ts**

`dashboard/src/lib/normalizeFeed.ts`:
```ts
import type { SheetFetchResult, SheetName } from './sheetsClient';

export interface FeedRow {
  tipo: SheetName;
  fecha: string;
  usuario: string;
  clienteOProveedor: string;
  material: string;
  cargas: number;
  status: string | null;
  raw: string[];
}

export interface NormalizeResult {
  rows: FeedRow[];
  errors: { sheetName: SheetName; error: string }[];
}

// Column indices match the append order written by Codigo.gs doPost.
function normalizeStandardRow(tipo: SheetName, row: string[]): FeedRow {
  return {
    tipo,
    fecha: row[0] || '',
    usuario: row[1] || '',
    clienteOProveedor: row[2] || '',
    material: row[5] || '',
    cargas: Number(row[4]) || 0,
    status: row[16] || null,
    raw: row,
  };
}

function normalizeComprasRow(row: string[]): FeedRow {
  return {
    tipo: 'Compras',
    fecha: row[0] || '',
    usuario: row[1] || '',
    clienteOProveedor: row[2] || '',
    material: row[4] || '',
    cargas: Number(row[3]) || 0,
    status: null,
    raw: row,
  };
}

function normalizeInventariosRow(row: string[]): FeedRow {
  return {
    tipo: 'Inventarios',
    fecha: row[0] || '',
    usuario: row[1] || '',
    clienteOProveedor: row[2] || '',
    material: row[4] || '',
    cargas: Number(row[3]) || 0,
    status: null,
    raw: row,
  };
}

export function normalizeFeed(results: SheetFetchResult[]): NormalizeResult {
  const rows: FeedRow[] = [];
  const errors: { sheetName: SheetName; error: string }[] = [];

  for (const result of results) {
    if (result.rows === null) {
      errors.push({ sheetName: result.sheetName, error: result.error || 'unknown error' });
      continue;
    }
    const dataRows = result.rows.slice(1); // row 0 is the header
    for (const row of dataRows) {
      if (!row[0]) continue; // skip blank rows
      if (result.sheetName === 'Compras') {
        rows.push(normalizeComprasRow(row));
      } else if (result.sheetName === 'Inventarios') {
        rows.push(normalizeInventariosRow(row));
      } else {
        rows.push(normalizeStandardRow(result.sheetName, row));
      }
    }
  }

  rows.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  return { rows, errors };
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/normalizeFeed.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/normalizeFeed.ts src/lib/normalizeFeed.test.ts && git commit -m "feat: normalize per-sheet rows into a common FeedRow shape"
```

---

### Task 4: TTL cache

**Files:**
- Create: `dashboard/src/lib/feedCache.ts`
- Test: `dashboard/src/lib/feedCache.test.ts`

**Interfaces:**
- Produces: `createTtlCache<T>(ttlMs: number): { get(): T | null; getStale(): T | null; set(data: T): void }`

- [ ] **Step 1: Write failing test**

`dashboard/src/lib/feedCache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTtlCache } from './feedCache';

describe('createTtlCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null before anything is set', () => {
    const cache = createTtlCache<string>(1000);
    expect(cache.get()).toBeNull();
  });

  it('returns the value while within TTL', () => {
    const cache = createTtlCache<string>(1000);
    cache.set('hello');
    vi.advanceTimersByTime(500);
    expect(cache.get()).toBe('hello');
  });

  it('returns null from get() once TTL expires, but getStale() still returns it', () => {
    const cache = createTtlCache<string>(1000);
    cache.set('hello');
    vi.advanceTimersByTime(1500);
    expect(cache.get()).toBeNull();
    expect(cache.getStale()).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/feedCache.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement feedCache.ts**

`dashboard/src/lib/feedCache.ts`:
```ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function createTtlCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;

  return {
    get(): T | null {
      if (!entry) return null;
      if (Date.now() - entry.timestamp > ttlMs) return null;
      return entry.data;
    },
    getStale(): T | null {
      return entry ? entry.data : null;
    },
    set(data: T): void {
      entry = { data, timestamp: Date.now() };
    },
  };
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/feedCache.test.ts
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/feedCache.ts src/lib/feedCache.test.ts && git commit -m "feat: add in-memory TTL cache with stale fallback"
```

---

### Task 5: /api/feed route

**Files:**
- Create: `dashboard/src/app/api/feed/route.ts`
- Test: `dashboard/src/app/api/feed/route.test.ts`

**Interfaces:**
- Consumes: `fetchAllSheets` from `@/lib/sheetsClient`, `normalizeFeed`/`NormalizeResult` from `@/lib/normalizeFeed`, `createTtlCache` from `@/lib/feedCache`
- Produces: `GET(): Promise<Response>` returning JSON `{ rows: FeedRow[]; errors: {...}[]; stale: boolean }`

- [ ] **Step 1: Write failing test**

`dashboard/src/app/api/feed/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sheetsClient', () => ({
  fetchAllSheets: vi.fn(),
}));

import { fetchAllSheets } from '@/lib/sheetsClient';

describe('GET /api/feed', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns normalized rows on success', async () => {
    (fetchAllSheets as any).mockResolvedValue([
      {
        sheetName: 'Terrestre',
        rows: [
          ['Fecha', 'Usuario', 'Cliente', 'Proveedor', 'Cargas', 'Material'],
          ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'],
        ],
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.stale).toBe(false);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].clienteOProveedor).toBe('ACME');
    expect(body.errors).toEqual([]);
  });

  it('falls back to last cached value when the sheets fetch throws and marks stale', async () => {
    (fetchAllSheets as any)
      .mockResolvedValueOnce([
        {
          sheetName: 'Terrestre',
          rows: [['Fecha'], ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz']],
        },
      ])
      .mockRejectedValueOnce(new Error('quota exceeded'));

    const { GET } = await import('./route');

    const first = await GET();
    const firstBody = await first.json();
    expect(firstBody.stale).toBe(false);

    vi.useFakeTimers();
    vi.advanceTimersByTime(30_000); // past the 25s cache TTL
    const second = await GET();
    const secondBody = await second.json();
    vi.useRealTimers();

    expect(secondBody.stale).toBe(true);
    expect(secondBody.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/app/api/feed/route.test.ts
```
Expected: FAIL — `./route` not found.

- [ ] **Step 3: Implement route.ts**

`dashboard/src/app/api/feed/route.ts`:
```ts
import { fetchAllSheets } from '@/lib/sheetsClient';
import { normalizeFeed, type NormalizeResult } from '@/lib/normalizeFeed';
import { createTtlCache } from '@/lib/feedCache';

const cache = createTtlCache<NormalizeResult>(25_000);

export async function GET() {
  const cached = cache.get();
  if (cached) {
    return Response.json({ ...cached, stale: false });
  }

  try {
    const sheetResults = await fetchAllSheets();
    const normalized = normalizeFeed(sheetResults);
    cache.set(normalized);
    return Response.json({ ...normalized, stale: false });
  } catch (err) {
    const stale = cache.getStale();
    if (stale) {
      return Response.json({ ...stale, stale: true });
    }
    return Response.json(
      { rows: [], errors: [{ sheetName: 'unknown', error: (err as Error).message }], stale: true },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/app/api/feed/route.test.ts
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/app/api/feed/route.ts src/app/api/feed/route.test.ts && git commit -m "feat: add /api/feed route with caching and stale fallback"
```

---

### Task 6: FeedTable component

**Files:**
- Create: `dashboard/src/components/FeedTable.tsx`
- Test: `dashboard/src/components/FeedTable.test.tsx`

**Interfaces:**
- Consumes: `FeedRow` type from `@/lib/normalizeFeed`
- Produces: `FeedTable({ rows, errors, stale }: { rows: FeedRow[]; errors: { sheetName: string; error: string }[]; stale: boolean }): JSX.Element`, default export

- [ ] **Step 1: Write failing test**

`dashboard/src/components/FeedTable.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedTable from './FeedTable';
import type { FeedRow } from '@/lib/normalizeFeed';

const rows: FeedRow[] = [
  { tipo: 'Terrestre', fecha: '2026-06-19', usuario: 'jesus', clienteOProveedor: 'ACME', material: 'Maiz', cargas: 2, status: 'Pendiente', raw: ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'] },
  { tipo: 'Compras', fecha: '2026-06-18', usuario: 'ana', clienteOProveedor: 'CALDERA', material: 'Sorgo', cargas: 3, status: null, raw: ['2026-06-18', 'ana', 'CALDERA', '3', 'Sorgo'] },
];

describe('FeedTable', () => {
  it('renders one row per feed entry', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} />);
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('CALDERA')).toBeInTheDocument();
  });

  it('filters by tipo', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compras' }));
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
    expect(screen.getByText('CALDERA')).toBeInTheDocument();
  });

  it('expands a row to show raw columns on click', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} />);
    fireEvent.click(screen.getByText('ACME'));
    expect(screen.getByText('Prov1')).toBeInTheDocument();
  });

  it('shows an unavailable indicator for sheets that failed to load', () => {
    render(<FeedTable rows={rows} errors={[{ sheetName: 'Marítimo', error: 'denied' }]} stale={false} />);
    expect(screen.getByText(/Marítimo no disponible/i)).toBeInTheDocument();
  });

  it('shows a stale data warning', () => {
    render(<FeedTable rows={rows} errors={[]} stale={true} />);
    expect(screen.getByText(/datos desactualizados/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/FeedTable.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement FeedTable.tsx**

`dashboard/src/components/FeedTable.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import type { FeedRow } from '@/lib/normalizeFeed';

const TIPOS = ['Todos', 'Terrestre', 'Marítimo', 'Nacional', 'Compras', 'Inventarios'] as const;

export default function FeedTable({
  rows,
  errors,
  stale,
}: {
  rows: FeedRow[];
  errors: { sheetName: string; error: string }[];
  stale: boolean;
}) {
  const [filtro, setFiltro] = useState<typeof TIPOS[number]>('Todos');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const visibleRows = useMemo(
    () => (filtro === 'Todos' ? rows : rows.filter((r) => r.tipo === filtro)),
    [rows, filtro]
  );

  return (
    <div>
      {stale && <p role="alert">⚠️ datos desactualizados</p>}
      {errors.map((e) => (
        <p key={e.sheetName} role="alert">
          {e.sheetName} no disponible
        </p>
      ))}
      <div>
        {TIPOS.map((tipo) => (
          <button key={tipo} onClick={() => setFiltro(tipo)} aria-pressed={filtro === tipo}>
            {tipo}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Cliente/Proveedor</th>
            <th>Material</th>
            <th>Cargas</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => (
            <>
              <tr key={i} onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}>
                <td>{row.tipo}</td>
                <td>{row.fecha}</td>
                <td>{row.usuario}</td>
                <td>{row.clienteOProveedor}</td>
                <td>{row.material}</td>
                <td>{row.cargas}</td>
                <td>{row.status || ''}</td>
              </tr>
              {expandedIndex === i && (
                <tr>
                  <td colSpan={7}>{row.raw.join(' | ')}</td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/FeedTable.test.tsx
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/FeedTable.tsx src/components/FeedTable.test.tsx && git commit -m "feat: add FeedTable component with filter, expand, and error/stale indicators"
```

---

### Task 7: AuthGate component + page wiring

**Files:**
- Create: `dashboard/src/components/AuthGate.tsx`
- Test: `dashboard/src/components/AuthGate.test.tsx`
- Modify: `dashboard/src/app/page.tsx`

**Interfaces:**
- Consumes: `FeedTable` from `@/components/FeedTable`
- Produces: `AuthGate({ children }: { children: React.ReactNode }): JSX.Element`, default export. Renders `children` once `window.google` calls back with a credential; otherwise renders a sign-in button container.

- [ ] **Step 1: Write failing test**

`dashboard/src/components/AuthGate.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AuthGate from './AuthGate';

describe('AuthGate', () => {
  beforeEach(() => {
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }: { callback: (r: { credential: string }) => void }) => {
            (window as any).__gsiCallback = callback;
          }),
          renderButton: vi.fn(),
          disableAutoSelect: vi.fn(),
        },
      },
    };
  });

  it('shows the sign-in button before login', () => {
    render(<AuthGate><p>contenido secreto</p></AuthGate>);
    expect(screen.queryByText('contenido secreto')).not.toBeInTheDocument();
  });

  it('renders children after a credential callback fires', () => {
    render(<AuthGate><p>contenido secreto</p></AuthGate>);
    const fakeJwt = `header.${btoa(JSON.stringify({ email: 'a@b.com', name: 'A' }))}.sig`;
    act(() => {
      (window as any).__gsiCallback({ credential: fakeJwt });
    });
    expect(screen.getByText('contenido secreto')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AuthGate.tsx**

`dashboard/src/components/AuthGate.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = '65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com';

interface GoogleUser {
  email: string;
  name: string;
}

function decodeJwt(credential: string): GoogleUser {
  const payload = credential.split('.')[1];
  const json = atob(payload);
  return JSON.parse(json);
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) return;
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response: { credential: string }) => {
        setUser(decodeJwt(response.credential));
      },
    });

    if (buttonRef.current) {
      google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large' });
    }
  }, [user]);

  if (user) {
    return <>{children}</>;
  }

  return <div ref={buttonRef} />;
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire page.tsx (polling + AuthGate + FeedTable)**

`dashboard/src/app/page.tsx`:
```tsx
'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import FeedTable from '@/components/FeedTable';
import type { FeedRow } from '@/lib/normalizeFeed';

interface FeedResponse {
  rows: FeedRow[];
  errors: { sheetName: string; error: string }[];
  stale: boolean;
}

const POLL_MS = 45_000;

export default function Page() {
  const [data, setData] = useState<FeedResponse>({ rows: [], errors: [], stale: false });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch('/api/feed');
      const body = (await res.json()) as FeedResponse;
      if (!cancelled) {
        setData(body);
        setUpdatedAt(new Date());
      }
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <AuthGate>
        <main style={{ padding: 24 }}>
          <h1>Dashboard Cotizador</h1>
          {updatedAt && <p>última actualización: {updatedAt.toLocaleTimeString()}</p>}
          <FeedTable rows={data.rows} errors={data.errors} stale={data.stale} />
        </main>
      </AuthGate>
    </>
  );
}
```

- [ ] **Step 6: Run full suite, confirm everything still passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run
```
Expected: PASS, all test files.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/AuthGate.tsx src/components/AuthGate.test.tsx src/app/page.tsx && git commit -m "feat: gate dashboard behind Google Sign-In and poll /api/feed"
```

---

### Task 8: Deploy setup docs

**Files:**
- Create: `dashboard/docs/deploy.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Write deploy doc**

`dashboard/docs/deploy.md`:
```markdown
# Deploy — Dashboard Feed

## 1. Service account (una sola vez)

1. Google Cloud Console → IAM & Admin → Service Accounts → crear uno nuevo.
2. Generar key JSON, copiar el contenido completo (es el valor de `GOOGLE_SERVICE_ACCOUNT_KEY`).
3. Abrir el spreadsheet `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` → Compartir → agregar el `client_email` de la service account con permiso **Viewer**.

## 2. Google Sign-In origin

1. Google Cloud Console → APIs & Services → Credentials → editar el OAuth client `65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com`.
2. Agregar el dominio de Vercel (ej. `https://dashboard-cotizador.vercel.app`) a "Authorized JavaScript origins".

## 3. Vercel

1. `vercel link` (o importar el repo `dashboard/` desde el dashboard de Vercel).
2. Settings → Environment Variables → agregar `GOOGLE_SERVICE_ACCOUNT_KEY` con el JSON completo de la key (una sola línea).
3. Deploy.

## 4. Verificación post-deploy

- Abrir la URL de Vercel, confirmar que aparece el botón de Google Sign-In.
- Tras login, confirmar que la tabla carga filas reales del spreadsheet.
- Subir una cotización de prueba en Cotizador y confirmar que aparece en el feed dentro de 60s.
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add docs/deploy.md && git commit -m "docs: add deploy instructions for service account, OAuth origin, and Vercel"
```
