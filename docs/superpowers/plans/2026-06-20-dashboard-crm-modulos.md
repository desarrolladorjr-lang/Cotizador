# Dashboard CRM Módulos Editables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing read-only dashboard feed into a CRM-style layout: one module/tab per sheet (Terrestre, Marítimo, Nacional, Compras, Inventarios), each showing its real columns, with inline editing of any field that writes back to the Google Sheet with conflict detection and audit columns.

**Architecture:** Builds on the existing dashboard (`./dashboard`, Next.js App Router). Read path (`sheetsClient.ts`, `normalizeFeed.ts`, `feedCache.ts`, `/api/feed`) gains a `rowIndex` per row. A new write path (`sheetSchemas.ts`, `sheetsWriter.ts`, `/api/rows/[sheetName]/[rowIndex]`) reads-before-write to detect conflicts, then writes the row plus two audit columns (`EditadoPor`, `EditadoFecha`) via the Sheets API using an upgraded (Editor) service account scope. UI replaces the generic merged `FeedTable` with per-module schema-driven tables (`ModuleTable.tsx`) and a row edit modal (`RowEditModal.tsx`); `AuthGate.tsx` becomes a render-prop so the logged-in user's email is available as the `editor` for audits.

**Tech Stack:** Next.js 14 (App Router, TypeScript), `googleapis`, Vitest + @testing-library/react.

## Global Constraints

- Spreadsheet ID: `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` (unchanged).
- Sheet names: `Terrestre`, `Marítimo`, `Nacional`, `Compras`, `Inventarios` (unchanged).
- Service account permission must move from Viewer to **Editor** on the spreadsheet (manual step, documented in Task 10) — Sheets API scope moves from `spreadsheets.readonly` to `spreadsheets`.
- Update-only: no row creation or deletion from the dashboard.
- Write path must detect conflicts (row changed since loaded) and refuse to write rather than overwrite.
- Every successful write appends `EditadoPor` (editor email) and `EditadoFecha` (ISO timestamp) in two fixed columns after the sheet's real data columns.
- Cotizador (`Codigo.gs`, `deploy/index.html`) is never modified.
- Cache TTL (25s) and poll interval (45s) on the read path are unchanged.

---

### Task 1: Add `rowIndex` to normalized rows

**Files:**
- Modify: `dashboard/src/lib/normalizeFeed.ts`
- Modify: `dashboard/src/lib/normalizeFeed.test.ts`

**Interfaces:**
- Consumes: `SheetFetchResult`, `SheetName` from `@/lib/sheetsClient` (unchanged)
- Produces: `FeedRow` now includes `rowIndex: number` (1-based real row number in the sheet, header = row 1, first data row = row 2)

- [ ] **Step 1: Add a failing test for rowIndex**

Add to `dashboard/src/lib/normalizeFeed.test.ts` (new `describe` block at the end of the file, before the final closing — keep all existing tests as-is):

```ts
describe('normalizeFeed rowIndex', () => {
  it('assigns rowIndex as the real sheet row number, accounting for the header row', () => {
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

    const row1 = result.rows.find((r) => r.fecha === '2026-06-10');
    const row2 = result.rows.find((r) => r.fecha === '2026-06-19');
    expect(row1?.rowIndex).toBe(2);
    expect(row2?.rowIndex).toBe(3);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/normalizeFeed.test.ts
```
Expected: FAIL — `rowIndex` is `undefined`.

- [ ] **Step 3: Implement rowIndex**

Replace the body of `dashboard/src/lib/normalizeFeed.ts` with:

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
  rowIndex: number;
}

export interface NormalizeResult {
  rows: FeedRow[];
  errors: { sheetName: SheetName; error: string }[];
}

// Column indices match the append order written by Codigo.gs doPost.
function normalizeStandardRow(tipo: SheetName, row: string[], rowIndex: number): FeedRow {
  return {
    tipo,
    fecha: row[0] || '',
    usuario: row[1] || '',
    clienteOProveedor: row[2] || '',
    material: row[5] || '',
    cargas: Number(row[4]) || 0,
    status: row[16] || null,
    raw: row,
    rowIndex,
  };
}

function normalizeComprasRow(row: string[], rowIndex: number): FeedRow {
  return {
    tipo: 'Compras',
    fecha: row[0] || '',
    usuario: row[1] || '',
    clienteOProveedor: row[2] || '',
    material: row[4] || '',
    cargas: Number(row[3]) || 0,
    status: null,
    raw: row,
    rowIndex,
  };
}

function normalizeInventariosRow(row: string[], rowIndex: number): FeedRow {
  return {
    tipo: 'Inventarios',
    fecha: row[0] || '',
    usuario: row[1] || '',
    clienteOProveedor: row[2] || '',
    material: row[4] || '',
    cargas: Number(row[3]) || 0,
    status: null,
    raw: row,
    rowIndex,
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
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row[0]) continue; // skip blank rows
      const rowIndex = i + 2; // sheet row 1 is the header, first data row is sheet row 2
      if (result.sheetName === 'Compras') {
        rows.push(normalizeComprasRow(row, rowIndex));
      } else if (result.sheetName === 'Inventarios') {
        rows.push(normalizeInventariosRow(row, rowIndex));
      } else {
        rows.push(normalizeStandardRow(result.sheetName, row, rowIndex));
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
Expected: PASS, all 5 tests (4 existing + 1 new).

- [ ] **Step 5: Update FeedTable.test.tsx fixtures so they keep typechecking**

`FeedRow` now requires `rowIndex`. `dashboard/src/components/FeedTable.test.tsx` builds two `FeedRow` fixtures without it. Add `rowIndex: 2` to the Terrestre fixture and `rowIndex: 3` to the Compras fixture (any positive number works — these tests don't assert on it):

```ts
const rows: FeedRow[] = [
  { tipo: 'Terrestre', fecha: '2026-06-19', usuario: 'jesus', clienteOProveedor: 'ACME', material: 'Maiz', cargas: 2, status: 'Pendiente', rowIndex: 2, raw: ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'] },
  { tipo: 'Compras', fecha: '2026-06-18', usuario: 'ana', clienteOProveedor: 'CALDERA', material: 'Sorgo', cargas: 3, status: null, rowIndex: 3, raw: ['2026-06-18', 'ana', 'CALDERA', '3', 'Sorgo'] },
];
```

- [ ] **Step 6: Run the full suite, confirm nothing else broke**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run
```
Expected: PASS, all test files.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/normalizeFeed.ts src/lib/normalizeFeed.test.ts src/components/FeedTable.test.tsx && git commit -m "feat: track real sheet row index on normalized feed rows"
```

---

### Task 2: Sheet schemas

**Files:**
- Create: `dashboard/src/lib/sheetSchemas.ts`
- Test: `dashboard/src/lib/sheetSchemas.test.ts`

**Interfaces:**
- Consumes: `SheetName` from `@/lib/sheetsClient`
- Produces:
  - `interface FieldSchema { key: string; label: string; index: number }`
  - `schemaFor(sheetName: SheetName): FieldSchema[]`

- [ ] **Step 1: Write failing test**

`dashboard/src/lib/sheetSchemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { schemaFor } from './sheetSchemas';

describe('schemaFor', () => {
  it('returns the 24-field standard schema for Terrestre, Marítimo and Nacional', () => {
    for (const sheetName of ['Terrestre', 'Marítimo', 'Nacional'] as const) {
      const schema = schemaFor(sheetName);
      expect(schema).toHaveLength(24);
      expect(schema[0]).toEqual({ key: 'fecha', label: 'Fecha', index: 0 });
      expect(schema[16]).toEqual({ key: 'status', label: 'Status', index: 16 });
      expect(schema[23]).toEqual({ key: 'intencionCompra', label: 'Intención Compra', index: 23 });
    }
  });

  it('returns the 17-field Compras schema', () => {
    const schema = schemaFor('Compras');
    expect(schema).toHaveLength(17);
    expect(schema[2]).toEqual({ key: 'proveedor', label: 'Proveedor', index: 2 });
    expect(schema[16]).toEqual({ key: 'notas', label: 'Notas', index: 16 });
  });

  it('returns the 8-field Inventarios schema', () => {
    const schema = schemaFor('Inventarios');
    expect(schema).toHaveLength(8);
    expect(schema[4]).toEqual({ key: 'material', label: 'Material', index: 4 });
    expect(schema[7]).toEqual({ key: 'notas', label: 'Notas', index: 7 });
  });

  it('every index is unique and sequential starting at 0', () => {
    for (const sheetName of ['Terrestre', 'Marítimo', 'Nacional', 'Compras', 'Inventarios'] as const) {
      const schema = schemaFor(sheetName);
      schema.forEach((field, i) => expect(field.index).toBe(i));
    }
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetSchemas.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement sheetSchemas.ts**

`dashboard/src/lib/sheetSchemas.ts`:
```ts
import type { SheetName } from './sheetsClient';

export interface FieldSchema {
  key: string;
  label: string;
  index: number;
}

// Mirrors the row arrays Codigo.gs doPost builds for each modalidad.
export const STANDARD_SCHEMA: FieldSchema[] = [
  { key: 'fecha', label: 'Fecha', index: 0 },
  { key: 'usuario', label: 'Usuario', index: 1 },
  { key: 'cliente', label: 'Cliente', index: 2 },
  { key: 'proveedor', label: 'Proveedor', index: 3 },
  { key: 'cargas', label: 'Cargas', index: 4 },
  { key: 'material', label: 'Material', index: 5 },
  { key: 'destino', label: 'Destino', index: 6 },
  { key: 'porcentajeFijacion', label: '% Fijación', index: 7 },
  { key: 'fixPrice', label: 'Fix Price', index: 8 },
  { key: 'precioVenta', label: 'Precio Venta', index: 9 },
  { key: 'tcHoy', label: 'TC Hoy', index: 10 },
  { key: 'tcSeguro', label: 'TC Seguro', index: 11 },
  { key: 'fleteNac', label: 'Flete Nac', index: 12 },
  { key: 'cruceInt', label: 'Cruce Int', index: 13 },
  { key: 'precioTopeCompra', label: 'Precio Tope Compra', index: 14 },
  { key: 'ppProv', label: 'PP Prov', index: 15 },
  { key: 'status', label: 'Status', index: 16 },
  { key: 'utilidadNeta', label: 'Utilidad Neta', index: 17 },
  { key: 'tipoCompra', label: 'Tipo Compra', index: 18 },
  { key: 'notas', label: 'Notas', index: 19 },
  { key: 'contrato', label: 'N° Contrato', index: 20 },
  { key: 'paraInventarios', label: 'Para Inventarios', index: 21 },
  { key: 'intencionVenta', label: 'Intención Venta', index: 22 },
  { key: 'intencionCompra', label: 'Intención Compra', index: 23 },
];

export const COMPRAS_SCHEMA: FieldSchema[] = [
  { key: 'fecha', label: 'Fecha', index: 0 },
  { key: 'usuario', label: 'Usuario', index: 1 },
  { key: 'proveedor', label: 'Proveedor', index: 2 },
  { key: 'cargas', label: 'Cargas', index: 3 },
  { key: 'material', label: 'Material', index: 4 },
  { key: 'origenFlete', label: 'Origen Flete', index: 5 },
  { key: 'destinoFlete', label: 'Destino Flete', index: 6 },
  { key: 'fleteNac', label: 'Flete Nac', index: 7 },
  { key: 'fixPrice', label: 'Fix Price', index: 8 },
  { key: 'porcentajeFijacion', label: '% Fijación', index: 9 },
  { key: 'precioVenta', label: 'Precio Venta', index: 10 },
  { key: 'precioTopeCompra', label: 'Precio Tope Compra', index: 11 },
  { key: 'paraInventarios', label: 'Para Inventarios', index: 12 },
  { key: 'intencionVenta', label: 'Intención Venta', index: 13 },
  { key: 'intencionCompra', label: 'Intención Compra', index: 14 },
  { key: 'precioCompraMxn', label: 'Precio Compra MXN', index: 15 },
  { key: 'notas', label: 'Notas', index: 16 },
];

export const INVENTARIOS_SCHEMA: FieldSchema[] = [
  { key: 'fecha', label: 'Fecha', index: 0 },
  { key: 'usuario', label: 'Usuario', index: 1 },
  { key: 'proveedor', label: 'Proveedor', index: 2 },
  { key: 'cargas', label: 'Cargas', index: 3 },
  { key: 'material', label: 'Material', index: 4 },
  { key: 'fleteNac', label: 'Flete Nac', index: 5 },
  { key: 'precioCompraMxn', label: 'Precio Compra MXN', index: 6 },
  { key: 'notas', label: 'Notas', index: 7 },
];

export function schemaFor(sheetName: SheetName): FieldSchema[] {
  switch (sheetName) {
    case 'Compras':
      return COMPRAS_SCHEMA;
    case 'Inventarios':
      return INVENTARIOS_SCHEMA;
    default:
      return STANDARD_SCHEMA;
  }
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetSchemas.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/sheetSchemas.ts src/lib/sheetSchemas.test.ts && git commit -m "feat: add per-sheet field schemas matching Codigo.gs row layouts"
```

---

### Task 3: Upgrade Sheets client to read-write and expose a shared API getter

**Context — do not regress existing fixes:** `dashboard/src/lib/sheetsClient.ts` already has a `buildAuthorizedSheetsApi()` helper that calls `auth.authorize()` once before the 5 parallel sheet fetches, fixing an intermittent "Premature close" failure against `oauth2.googleapis.com` on Vercel (see the comment above it and commit `db01349`). **Keep that async-authorize-once pattern.** This task only renames it to a shared export, widens the scope, and exports `SPREADSHEET_ID`.

**Files:**
- Modify: `dashboard/src/lib/sheetsClient.ts`
- Modify: `dashboard/src/lib/sheetsClient.test.ts`

**Interfaces:**
- Produces (new, in addition to existing `SHEET_NAMES`, `SheetName`, `SheetFetchResult`, `fetchAllSheets`):
  - `getSheetsApi(): Promise<SheetsApi>` — async (renamed from the existing `buildAuthorizedSheetsApi`), exported so `sheetsWriter.ts` (Task 4) can reuse the same authorize-once pattern.
  - `SPREADSHEET_ID` exported as a named export (was a private const) so `sheetsWriter.ts` doesn't duplicate it.
  - `SheetsApi` type exported (was unexported `type SheetsApi = ReturnType<typeof google.sheets>`).

- [ ] **Step 1: Write failing test for the new exports**

Add to `dashboard/src/lib/sheetsClient.test.ts` (new test, keep existing ones):

```ts
import { getSheetsApi, SPREADSHEET_ID } from './sheetsClient';

describe('getSheetsApi', () => {
  it('exports a constant spreadsheet id', () => {
    expect(SPREADSHEET_ID).toBe('12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A');
  });

  it('returns an authorized object with a spreadsheets.values interface', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: 'a@b.com', private_key: 'x' });
    const api = await getSheetsApi();
    expect(api.spreadsheets.values.get).toBeTypeOf('function');
    expect(api.spreadsheets.values.update).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetsClient.test.ts
```
Expected: FAIL — `getSheetsApi`/`SPREADSHEET_ID` not exported.

- [ ] **Step 3: Update sheetsClient.ts**

Replace the body of `dashboard/src/lib/sheetsClient.ts` with (note: only the scope string, the three renames, and the two new exports changed — `buildAuthorizedSheetsApi`'s body and its comment are preserved verbatim under the new name):

```ts
import { google } from 'googleapis';

export const SHEET_NAMES = ['Terrestre', 'Marítimo', 'Nacional', 'Compras', 'Inventarios'] as const;
export type SheetName = typeof SHEET_NAMES[number];

export const SPREADSHEET_ID = '12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A';

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export type SheetsApi = ReturnType<typeof google.sheets>;

export async function getSheetsApi(): Promise<SheetsApi> {
  const auth = getAuthClient();
  // Authorize once up front so callers that fan out parallel requests (e.g. the
  // 5 parallel sheet fetches in fetchAllSheets) reuse a single cached access
  // token instead of each racing to request their own (concurrent token requests
  // have been observed to fail intermittently with "Premature close" against
  // oauth2.googleapis.com on Vercel).
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

async function fetchSheetRows(sheetName: SheetName, api: SheetsApi): Promise<string[][]> {
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1000`,
  });
  return (res.data.values as string[][]) || [];
}

export async function fetchAllSheets(sheetsApi?: SheetsApi): Promise<SheetFetchResult[]> {
  const api = sheetsApi || (await getSheetsApi());
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

Note the scope changed from `spreadsheets.readonly` to `spreadsheets` — this requires the service account to have **Editor** access on the spreadsheet (see Task 10).

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetsClient.test.ts
```
Expected: PASS, all tests (existing 2 + new 2).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/sheetsClient.ts src/lib/sheetsClient.test.ts && git commit -m "feat: upgrade Sheets scope to read-write and export shared authorized API getter"
```

---

### Task 4: Sheets writer with conflict detection and audit columns

**Files:**
- Create: `dashboard/src/lib/sheetsWriter.ts`
- Test: `dashboard/src/lib/sheetsWriter.test.ts`

**Interfaces:**
- Consumes: `SheetName`, `SheetsApi`, `SPREADSHEET_ID` from `@/lib/sheetsClient`; `schemaFor` from `@/lib/sheetSchemas`
- Produces:
  - `type UpdateRowResult = { ok: true } | { ok: false; reason: 'conflict' | 'error'; message?: string }`
  - `updateRow(sheetName: SheetName, rowIndex: number, newValues: string[], expectedValues: string[], editor: string, sheetsApi?: SheetsApi): Promise<UpdateRowResult>`
  - `columnLetter(index0: number): string` (0-based column index → A1 letter, exported for reuse/testing)

- [ ] **Step 1: Write failing test**

`dashboard/src/lib/sheetsWriter.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { updateRow, columnLetter } from './sheetsWriter';

function makeMockApi({
  currentRow,
  getError,
  updateError,
}: {
  currentRow?: string[];
  getError?: Error;
  updateError?: Error;
}) {
  return {
    spreadsheets: {
      values: {
        get: vi.fn(() => {
          if (getError) return Promise.reject(getError);
          return Promise.resolve({ data: { values: currentRow ? [currentRow] : [] } });
        }),
        update: vi.fn(() => {
          if (updateError) return Promise.reject(updateError);
          return Promise.resolve({ data: {} });
        }),
      },
    },
  };
}

describe('columnLetter', () => {
  it('converts 0-based indices to A1 column letters', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
  });
});

describe('updateRow', () => {
  it('writes the row plus audit columns when the current row matches expectedValues', async () => {
    const mockApi = makeMockApi({ currentRow: ['2026-06-19', 'jesus', 'CALDERA', '3', 'Sorgo'] });

    const result = await updateRow(
      'Compras',
      5,
      ['2026-06-20', 'jesus', 'CALDERA', '4', 'Sorgo', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['2026-06-19', 'jesus', 'CALDERA', '3', 'Sorgo'],
      'ana@b.com',
      mockApi as any
    );

    expect(result).toEqual({ ok: true });
    expect(mockApi.spreadsheets.values.update).toHaveBeenCalledTimes(1);
    const call = mockApi.spreadsheets.values.update.mock.calls[0][0];
    expect(call.range).toBe('Compras!A5:S5'); // Compras schema has 17 fields (A..Q), audit cols R,S
    expect(call.values[0][17]).toBe('ana@b.com');
    expect(typeof call.values[0][18]).toBe('string'); // ISO timestamp
  });

  it('returns conflict and does not call update when the current row differs', async () => {
    const mockApi = makeMockApi({ currentRow: ['2026-06-19', 'jesus', 'CALDERA', '999', 'Sorgo'] });

    const result = await updateRow(
      'Compras',
      5,
      ['2026-06-20', 'jesus', 'CALDERA', '4', 'Sorgo'],
      ['2026-06-19', 'jesus', 'CALDERA', '3', 'Sorgo'],
      'ana@b.com',
      mockApi as any
    );

    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(mockApi.spreadsheets.values.update).not.toHaveBeenCalled();
  });

  it('returns conflict when reading the current row fails', async () => {
    const mockApi = makeMockApi({ getError: new Error('boom') });

    const result = await updateRow('Compras', 5, ['x'], ['y'], 'ana@b.com', mockApi as any);

    expect(result).toEqual({ ok: false, reason: 'conflict' });
  });

  it('returns an error result when the write itself fails', async () => {
    const mockApi = makeMockApi({ currentRow: ['a'], updateError: new Error('quota exceeded') });

    const result = await updateRow('Compras', 5, ['a'], ['a'], 'ana@b.com', mockApi as any);

    expect(result).toEqual({ ok: false, reason: 'error', message: 'quota exceeded' });
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetsWriter.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement sheetsWriter.ts**

`dashboard/src/lib/sheetsWriter.ts`:
```ts
import { SPREADSHEET_ID, getSheetsApi, type SheetName, type SheetsApi } from './sheetsClient';
import { schemaFor } from './sheetSchemas';

export type UpdateRowResult = { ok: true } | { ok: false; reason: 'conflict' | 'error'; message?: string };

export function columnLetter(index0: number): string {
  let n = index0 + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function rowsMatch(a: string[], b: string[]): boolean {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if ((a[i] || '') !== (b[i] || '')) return false;
  }
  return true;
}

export async function updateRow(
  sheetName: SheetName,
  rowIndex: number,
  newValues: string[],
  expectedValues: string[],
  editor: string,
  sheetsApi?: SheetsApi
): Promise<UpdateRowResult> {
  const api = sheetsApi || (await getSheetsApi());
  const schema = schemaFor(sheetName);
  const lastDataCol = columnLetter(schema.length - 1);

  let currentRow: string[];
  try {
    const res = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex}:${lastDataCol}${rowIndex}`,
    });
    currentRow = (res.data.values?.[0] as string[]) || [];
  } catch {
    return { ok: false, reason: 'conflict' };
  }

  if (!rowsMatch(currentRow, expectedValues)) {
    return { ok: false, reason: 'conflict' };
  }

  // Audit columns sit right after the schema's data columns: schema.length is EditadoPor, +1 is EditadoFecha.
  const fechaCol = columnLetter(schema.length + 1);
  const fullValues = [...newValues, editor, new Date().toISOString()];

  try {
    await api.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex}:${fechaCol}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [fullValues] },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', message: (err as Error).message };
  }
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/sheetsWriter.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/sheetsWriter.ts src/lib/sheetsWriter.test.ts && git commit -m "feat: add sheetsWriter with read-before-write conflict detection and audit columns"
```

---

### Task 5: PATCH /api/rows/[sheetName]/[rowIndex] route

**Files:**
- Create: `dashboard/src/app/api/rows/[sheetName]/[rowIndex]/route.ts`
- Test: `dashboard/src/app/api/rows/[sheetName]/[rowIndex]/route.test.ts`

**Interfaces:**
- Consumes: `updateRow` from `@/lib/sheetsWriter`; `SHEET_NAMES` from `@/lib/sheetsClient`
- Produces: `PATCH(request: Request, context: { params: { sheetName: string; rowIndex: string } }): Promise<Response>` — body `{ values: string[]; expectedValues: string[]; editor: string }`, responds `200` on success, `409` on conflict, `400` on invalid sheet name, `503` on write error.

- [ ] **Step 1: Write failing test**

`dashboard/src/app/api/rows/[sheetName]/[rowIndex]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sheetsWriter', () => ({
  updateRow: vi.fn(),
}));

import { updateRow } from '@/lib/sheetsWriter';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/rows/Compras/5', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/rows/[sheetName]/[rowIndex]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when the write succeeds', async () => {
    (updateRow as any).mockResolvedValue({ ok: true });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      makeRequest({ values: ['a'], expectedValues: ['a'], editor: 'ana@b.com' }),
      { params: { sheetName: 'Compras', rowIndex: '5' } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(updateRow).toHaveBeenCalledWith('Compras', 5, ['a'], ['a'], 'ana@b.com');
  });

  it('returns 409 on conflict', async () => {
    (updateRow as any).mockResolvedValue({ ok: false, reason: 'conflict' });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      makeRequest({ values: ['a'], expectedValues: ['b'], editor: 'ana@b.com' }),
      { params: { sheetName: 'Compras', rowIndex: '5' } }
    );

    expect(response.status).toBe(409);
  });

  it('returns 503 on write error', async () => {
    (updateRow as any).mockResolvedValue({ ok: false, reason: 'error', message: 'quota exceeded' });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      makeRequest({ values: ['a'], expectedValues: ['a'], editor: 'ana@b.com' }),
      { params: { sheetName: 'Compras', rowIndex: '5' } }
    );

    expect(response.status).toBe(503);
  });

  it('returns 400 for an unknown sheet name', async () => {
    const { PATCH } = await import('./route');

    const response = await PATCH(
      makeRequest({ values: ['a'], expectedValues: ['a'], editor: 'ana@b.com' }),
      { params: { sheetName: 'NoExiste', rowIndex: '5' } }
    );

    expect(response.status).toBe(400);
    expect(updateRow).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run "src/app/api/rows/[sheetName]/[rowIndex]/route.test.ts"
```
Expected: FAIL — `./route` not found.

- [ ] **Step 3: Implement route.ts**

`dashboard/src/app/api/rows/[sheetName]/[rowIndex]/route.ts`:
```ts
import { SHEET_NAMES, type SheetName } from '@/lib/sheetsClient';
import { updateRow } from '@/lib/sheetsWriter';

function isSheetName(value: string): value is SheetName {
  return (SHEET_NAMES as readonly string[]).includes(value);
}

export async function PATCH(
  request: Request,
  { params }: { params: { sheetName: string; rowIndex: string } }
) {
  if (!isSheetName(params.sheetName)) {
    return Response.json({ ok: false, reason: 'error', message: 'hoja inválida' }, { status: 400 });
  }

  const rowIndex = Number(params.rowIndex);
  const { values, expectedValues, editor } = await request.json();

  const result = await updateRow(params.sheetName, rowIndex, values, expectedValues, editor);

  if (result.ok) {
    return Response.json(result, { status: 200 });
  }
  const status = result.reason === 'conflict' ? 409 : 503;
  return Response.json(result, { status });
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run "src/app/api/rows/[sheetName]/[rowIndex]/route.test.ts"
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add "src/app/api/rows" && git commit -m "feat: add PATCH /api/rows/[sheetName]/[rowIndex] endpoint"
```

---

### Task 6: AuthGate exposes the logged-in user via render prop

**Context — do not regress existing behavior:** `dashboard/src/components/AuthGate.tsx` already polls every 100ms for the Google Identity Services script to finish loading before calling `initialize`/`renderButton` (fix for a race with `next/script strategy="afterInteractive"`, commit `29ac865`), and already renders a branded Sidell login screen when there's no user. **Keep the polling `useEffect` and the branded unauthenticated view exactly as they are.** The only change in this task: `children` becomes a render-prop function instead of a plain node, and `GoogleUser` becomes an exported type, so callers (Task 9) can read the editor's email.

**Files:**
- Modify: `dashboard/src/components/AuthGate.tsx`
- Modify: `dashboard/src/components/AuthGate.test.tsx`

**Interfaces:**
- Produces: `AuthGate({ children }: { children: (user: GoogleUser) => React.ReactNode }): JSX.Element` (was `children: React.ReactNode`) — `GoogleUser` (`{ email: string; name: string }`) now exported.

- [ ] **Step 1: Update the test for the render-prop API**

In `dashboard/src/components/AuthGate.test.tsx`, change only the two `render(<AuthGate>...)` calls — keep the `beforeEach` mock setup as-is:

```tsx
  it('shows the sign-in button before login', () => {
    render(<AuthGate>{() => <p>contenido secreto</p>}</AuthGate>);
    expect(screen.queryByText('contenido secreto')).not.toBeInTheDocument();
  });

  it('passes the decoded user into children after a credential callback fires', () => {
    render(<AuthGate>{(user) => <p>contenido secreto de {user.email}</p>}</AuthGate>);
    const fakeJwt = `header.${btoa(JSON.stringify({ email: 'a@b.com', name: 'A' }))}.sig`;
    act(() => {
      (window as any).__gsiCallback({ credential: fakeJwt });
    });
    expect(screen.getByText('contenido secreto de a@b.com')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```
Expected: FAIL — children invoked as a plain node, not a function.

- [ ] **Step 3: Update AuthGate.tsx**

In `dashboard/src/components/AuthGate.tsx`, make exactly these changes, leaving the polling `useEffect` body, the `decodeJwt` function, and the entire unauthenticated branded JSX untouched:

1. Add `export` to `interface GoogleUser`.
2. Change the component signature from `{ children }: { children: React.ReactNode }` to `{ children }: { children: (user: GoogleUser) => React.ReactNode }`.
3. Change `return <>{children}</>;` to `return <>{children(user)}</>;` (the `if (user)` guard above it already narrows `user` to non-null).

No other lines change — the script-polling logic, the `setup()` helper, the cleanup, and the branded login screen markup stay exactly as they are today.

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/AuthGate.tsx src/components/AuthGate.test.tsx && git commit -m "refactor: AuthGate exposes the logged-in user via a render prop"
```

---

### Task 7: RowEditModal component

**Files:**
- Create: `dashboard/src/components/RowEditModal.tsx`
- Test: `dashboard/src/components/RowEditModal.test.tsx`

**Interfaces:**
- Consumes: `FeedRow` from `@/lib/normalizeFeed`; `schemaFor` from `@/lib/sheetSchemas`; `SheetName` from `@/lib/sheetsClient`
- Produces: `RowEditModal({ sheetName, row, editor, onClose, onSaved, onReload }: { sheetName: SheetName; row: FeedRow; editor: string; onClose: () => void; onSaved: (updatedRaw: string[]) => void; onReload: () => void }): JSX.Element`, default export. Calls `fetch('/api/rows/{sheetName}/{row.rowIndex}', { method: 'PATCH', ... })`.

- [ ] **Step 1: Write failing test**

`dashboard/src/components/RowEditModal.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RowEditModal from './RowEditModal';
import type { FeedRow } from '@/lib/normalizeFeed';

const row: FeedRow = {
  tipo: 'Compras',
  fecha: '2026-06-19',
  usuario: 'jesus',
  clienteOProveedor: 'CALDERA',
  material: 'Sorgo',
  cargas: 3,
  status: null,
  rowIndex: 5,
  raw: ['2026-06-19', 'jesus', 'CALDERA', '3', 'Sorgo', '', '', '', '', '', '', '', '', '', '', '', ''],
};

describe('RowEditModal', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('renders one labeled input per schema field, prefilled', () => {
    render(
      <RowEditModal sheetName="Compras" row={row} editor="ana@b.com" onClose={vi.fn()} onSaved={vi.fn()} onReload={vi.fn()} />
    );
    const proveedorInput = screen.getByLabelText('Proveedor') as HTMLInputElement;
    expect(proveedorInput.value).toBe('CALDERA');
  });

  it('PATCHes the row and calls onSaved + onClose on success', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <RowEditModal sheetName="Compras" row={row} editor="ana@b.com" onClose={onClose} onSaved={onSaved} onReload={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Cargas'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/rows/Compras/5');
    const body = JSON.parse(options.body);
    expect(body.values[3]).toBe('4');
    expect(body.expectedValues).toEqual(row.raw);
    expect(body.editor).toBe('ana@b.com');
  });

  it('shows a conflict message and a reload button on 409', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 409, json: async () => ({ ok: false, reason: 'conflict' }) });
    const onReload = vi.fn();

    render(
      <RowEditModal sheetName="Compras" row={row} editor="ana@b.com" onClose={vi.fn()} onSaved={vi.fn()} onReload={onReload} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByText(/cambió desde que la cargaste/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /recargar/i }));
    expect(onReload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/RowEditModal.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RowEditModal.tsx**

`dashboard/src/components/RowEditModal.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { FeedRow } from '@/lib/normalizeFeed';
import { schemaFor } from '@/lib/sheetSchemas';
import type { SheetName } from '@/lib/sheetsClient';

export default function RowEditModal({
  sheetName,
  row,
  editor,
  onClose,
  onSaved,
  onReload,
}: {
  sheetName: SheetName;
  row: FeedRow;
  editor: string;
  onClose: () => void;
  onSaved: (updatedRaw: string[]) => void;
  onReload: () => void;
}) {
  const schema = schemaFor(sheetName);
  const [values, setValues] = useState<string[]>(() => schema.map((field) => row.raw[field.index] || ''));
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setFieldValue(index: number, value: string) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setConflict(false);
    setError(null);

    const expectedValues = schema.map((field) => row.raw[field.index] || '');
    const res = await fetch(`/api/rows/${sheetName}/${row.rowIndex}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, expectedValues, editor }),
    });
    setSaving(false);

    if (res.status === 200) {
      onSaved(values);
      onClose();
      return;
    }
    if (res.status === 409) {
      setConflict(true);
      return;
    }
    setError('No se pudo guardar. Intenta de nuevo.');
  }

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 24,
          maxWidth: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {schema.map((field, i) => (
            <label
              key={field.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--grey)',
              }}
            >
              {field.label}
              <input
                value={values[i]}
                onChange={(e) => setFieldValue(i, e.target.value)}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--cream)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '6px 8px',
                }}
              />
            </label>
          ))}
        </div>
        {conflict && (
          <div role="alert" style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            <p>Esta fila cambió desde que la cargaste.</p>
            <button type="button" onClick={onReload}>
              Recargar fila
            </button>
          </div>
        )}
        {error && (
          <p role="alert" style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/RowEditModal.test.tsx
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/RowEditModal.tsx src/components/RowEditModal.test.tsx && git commit -m "feat: add RowEditModal with conflict and error handling"
```

---

### Task 8: Add editing to FeedTable (replace inline labels with sheetSchemas, add Editar + RowEditModal)

**Context — do not regress existing behavior:** `dashboard/src/components/FeedTable.tsx` already implements the module-tab behavior (the `TIPOS` filter buttons with icons and per-tipo counts already act as module tabs), the card-grid layout, the stat cards, and per-tipo column labels for the expanded detail view (`STANDARD_LABELS`/`COMPRAS_LABELS`/`INVENTARIOS_LABELS`/`labelsForTipo`). **Keep all of that markup, the icons, the stat cards, and the filter/expand behavior exactly as they are.** This task only: (a) replaces the 3 inline label arrays + `labelsForTipo` with `schemaFor` from the schema module built in Task 2 (same label text, single source of truth shared with the write path), and (b) adds an "Editar" button inside the expanded card that opens `RowEditModal`.

**Files:**
- Modify: `dashboard/src/components/FeedTable.tsx`
- Modify: `dashboard/src/components/FeedTable.test.tsx`

**Interfaces:**
- Consumes: `schemaFor` from `@/lib/sheetSchemas` (Task 2); `RowEditModal` from `@/components/RowEditModal` (Task 7)
- Produces: `FeedTable` gains 3 new required props: `editor: string`, `onRowSaved: (tipo: FeedRow['tipo'], rowIndex: number, updatedRaw: string[]) => void`, `onReload: () => void`.

- [ ] **Step 1: Update the test file**

In `dashboard/src/components/FeedTable.test.tsx`, add `editor={vi.fn() as any}`-free real values and the two new callbacks to every `render(<FeedTable .../>)` call (5 calls total), and add one new test. The fixtures already have `rowIndex` from Task 1. Replace the file's `import` line and `describe` block with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedTable from './FeedTable';
import type { FeedRow } from '@/lib/normalizeFeed';

const rows: FeedRow[] = [
  { tipo: 'Terrestre', fecha: '2026-06-19', usuario: 'jesus', clienteOProveedor: 'ACME', material: 'Maiz', cargas: 2, status: 'Pendiente', rowIndex: 2, raw: ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'] },
  { tipo: 'Compras', fecha: '2026-06-18', usuario: 'ana', clienteOProveedor: 'CALDERA', material: 'Sorgo', cargas: 3, status: null, rowIndex: 3, raw: ['2026-06-18', 'ana', 'CALDERA', '3', 'Sorgo'] },
];

describe('FeedTable', () => {
  it('renders one row per feed entry', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} editor="ana@b.com" onRowSaved={vi.fn()} onReload={vi.fn()} />);
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('CALDERA')).toBeInTheDocument();
  });

  it('filters by tipo', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} editor="ana@b.com" onRowSaved={vi.fn()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compras' }));
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
    expect(screen.getByText('CALDERA')).toBeInTheDocument();
  });

  it('expands a row to show raw columns on click', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} editor="ana@b.com" onRowSaved={vi.fn()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByText('ACME'));
    expect(screen.getByText('Prov1')).toBeInTheDocument();
  });

  it('shows an unavailable indicator for sheets that failed to load', () => {
    render(<FeedTable rows={rows} errors={[{ sheetName: 'Marítimo', error: 'denied' }]} stale={false} editor="ana@b.com" onRowSaved={vi.fn()} onReload={vi.fn()} />);
    expect(screen.getByText(/Marítimo no disponible/i)).toBeInTheDocument();
  });

  it('shows a stale data warning', () => {
    render(<FeedTable rows={rows} errors={[]} stale={true} editor="ana@b.com" onRowSaved={vi.fn()} onReload={vi.fn()} />);
    expect(screen.getByText(/datos desactualizados/i)).toBeInTheDocument();
  });

  it('opens RowEditModal when Editar is clicked on an expanded row', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} editor="ana@b.com" onRowSaved={vi.fn()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByText('ACME')); // expand
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/FeedTable.test.tsx
```
Expected: FAIL — `editor`/`onRowSaved`/`onReload` not accepted by the current props type (or the new "Editar" test fails to find the button).

- [ ] **Step 3: Update FeedTable.tsx**

Apply these changes to `dashboard/src/components/FeedTable.tsx`, leaving `TipoIcon`, `StatCard`, the stat cards block, the filter-buttons block, and all card layout/styling untouched:

1. Add imports at the top:
   ```ts
   import { schemaFor } from '@/lib/sheetSchemas';
   import RowEditModal from './RowEditModal';
   ```

2. Delete the `STANDARD_LABELS`, `COMPRAS_LABELS`, `INVENTARIOS_LABELS` constants and the `labelsForTipo` function entirely.

3. In the expanded-detail block, replace:
   ```tsx
   {row.raw.map((value, j) => {
     const labels = labelsForTipo(row.tipo);
     const label = labels[j];
   ```
   with:
   ```tsx
   {row.raw.map((value, j) => {
     const label = schemaFor(row.tipo)[j]?.label;
   ```
   (rest of that block — the two `<span>`s rendering `label` and `value` — stays exactly as it is).

4. Change the component signature from:
   ```tsx
   export default function FeedTable({
     rows,
     errors,
     stale,
   }: {
     rows: FeedRow[];
     errors: { sheetName: string; error: string }[];
     stale: boolean;
   }) {
   ```
   to:
   ```tsx
   export default function FeedTable({
     rows,
     errors,
     stale,
     editor,
     onRowSaved,
     onReload,
   }: {
     rows: FeedRow[];
     errors: { sheetName: string; error: string }[];
     stale: boolean;
     editor: string;
     onRowSaved: (tipo: FeedRow['tipo'], rowIndex: number, updatedRaw: string[]) => void;
     onReload: () => void;
   }) {
   ```

5. Add one line near the top of the function body, alongside the existing `useState` calls:
   ```tsx
   const [editingRow, setEditingRow] = useState<FeedRow | null>(null);
   ```

6. Inside the `{expanded && ( ... )}` block, immediately after the closing `</div>` of the `grid` of raw fields (i.e. as the last child of the `expanded &&` fragment, still inside the outer parens), add an Editar button:
   ```tsx
   <button
     type="button"
     onClick={(e) => {
       e.stopPropagation();
       setEditingRow(row);
     }}
     style={{
       alignSelf: 'flex-start',
       marginTop: 8,
       padding: '6px 14px',
       borderRadius: 3,
       border: '1px solid var(--orange)',
       background: 'transparent',
       color: 'var(--orange)',
       fontFamily: 'var(--font-display)',
       fontWeight: 700,
       fontSize: 12,
       letterSpacing: '0.04em',
       textTransform: 'uppercase',
       cursor: 'pointer',
     }}
   >
     Editar
   </button>
   ```
   (`e.stopPropagation()` matters: the card's own `onClick` toggles expand/collapse, and the button sits inside that card.)

7. At the very end of the component's returned JSX, right before the final closing `</div>` of the component, add the conditional modal:
   ```tsx
   {editingRow && (
     <RowEditModal
       sheetName={editingRow.tipo}
       row={editingRow}
       editor={editor}
       onClose={() => setEditingRow(null)}
       onSaved={(updatedRaw) => onRowSaved(editingRow.tipo, editingRow.rowIndex, updatedRaw)}
       onReload={onReload}
     />
   )}
   ```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/FeedTable.test.tsx
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/FeedTable.tsx src/components/FeedTable.test.tsx && git commit -m "feat: add row editing to FeedTable via shared schemas and RowEditModal"
```

---

### Task 9: Wire page.tsx — pass editor email and reload/save handlers into FeedTable

**Context:** `dashboard/src/app/page.tsx` already has the branded header, polling loop, and `<AuthGate>` wrapper. **Keep the header markup and polling logic exactly as they are.** This task only: switches `AuthGate`'s children to the render-prop form (Task 6 changed its signature) and passes the 3 new props `FeedTable` now requires (Task 8).

**Files:**
- Modify: `dashboard/src/app/page.tsx`

**Interfaces:**
- Consumes: `AuthGate`, `GoogleUser` from `@/components/AuthGate`; `FeedTable` (now requiring `editor`, `onRowSaved`, `onReload`) from `@/components/FeedTable`

- [ ] **Step 1: Update page.tsx**

Apply these changes to `dashboard/src/app/page.tsx`, leaving the `<header>` JSX block (SIDELL title, timestamp) untouched:

1. Change the import line `import AuthGate from '@/components/AuthGate';` to `import AuthGate, { type GoogleUser } from '@/components/AuthGate';`.

2. Wrap the existing function body in a new inner component so it can receive the authenticated user, mirroring the current structure. Change:
   ```tsx
   export default function Page() {
     const [data, setData] = useState<FeedResponse>({ rows: [], errors: [], stale: false });
     const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

     useEffect(() => {
   ```
   to:
   ```tsx
   function DashboardContent({ user }: { user: GoogleUser }) {
     const [data, setData] = useState<FeedResponse>({ rows: [], errors: [], stale: false });
     const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

     async function reload() {
       const res = await fetch('/api/feed');
       const body = (await res.json()) as FeedResponse;
       setData(body);
       setUpdatedAt(new Date());
     }

     function handleRowSaved(tipo: FeedRow['tipo'], rowIndex: number, updatedRaw: string[]) {
       setData((prev) => ({
         ...prev,
         rows: prev.rows.map((r) => (r.tipo === tipo && r.rowIndex === rowIndex ? { ...r, raw: updatedRaw } : r)),
       }));
     }

     useEffect(() => {
   ```

3. Change the `<FeedTable rows={data.rows} errors={data.errors} stale={data.stale} />` line to:
   ```tsx
   <FeedTable
     rows={data.rows}
     errors={data.errors}
     stale={data.stale}
     editor={user.email}
     onRowSaved={handleRowSaved}
     onReload={reload}
   />
   ```

4. After the closing `}` of what is now `DashboardContent`, add the new outer `Page`:
   ```tsx
   export default function Page() {
     return (
       <>
         <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
         <AuthGate>{(user) => <DashboardContent user={user} />}</AuthGate>
       </>
     );
   }
   ```
   Remove the old `<Script .../>` + `<AuthGate><main>...</main></AuthGate>` wrapper from inside `DashboardContent` — that markup (the `<main>` with the header and the `<FeedTable>` div) becomes `DashboardContent`'s return value directly (no `<Script>`/`<AuthGate>` inside it anymore, those moved to the new outer `Page`).

- [ ] **Step 2: Run full suite, confirm everything still passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run
```
Expected: PASS, all test files.

- [ ] **Step 3: Manually verify the dev server still renders**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx tsc --noEmit
```
Expected: no type errors (confirms `DashboardContent`/`Page` split and the `FeedTable` prop wiring are type-correct).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/app/page.tsx && git commit -m "feat: wire editor email and row-save/reload handlers from AuthGate into FeedTable"
```

---

### Task 10: Update deploy docs for Editor permission and audit columns

**Files:**
- Modify: `dashboard/docs/deploy.md`

**Interfaces:** None (documentation only).

- [ ] **Step 1: Update deploy.md**

In `dashboard/docs/deploy.md`, replace step 1.3 of the "Service account" section:

Old:
```markdown
3. Abrir el spreadsheet `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` → Compartir → agregar el `client_email` de la service account con permiso **Viewer**.
```

New:
```markdown
3. Abrir el spreadsheet `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` → Compartir → agregar el `client_email` de la service account con permiso **Editor** (subió de Viewer a Editor para soportar edición desde el dashboard — v2).
```

And append a new section at the end of the file:

```markdown

## 5. Columnas de auditoría (v2)

Cada hoja gana 2 columnas nuevas al final de sus datos, escritas automáticamente cuando alguien edita una fila desde el dashboard:

- `EditadoPor`: email del usuario que guardó el cambio.
- `EditadoFecha`: timestamp ISO de cuándo se guardó.

No requieren configuración manual — el dashboard las escribe en la primera edición de cada fila. No es necesario crear encabezados a mano, pero si quieres encabezados visibles en el sheet, agrega manualmente "Editado Por" / "Editado Fecha" en la fila 1 en las columnas correspondientes (ver `dashboard/src/lib/sheetSchemas.ts` para el offset exacto por hoja).

## 6. Verificación post-deploy (v2)

- Editar una fila de prueba en cada uno de los 5 módulos, confirmar el cambio en el Google Sheet real, incluyendo `EditadoPor`/`EditadoFecha`.
- Abrir la misma fila en dos pestañas, editar y guardar en una, luego intentar guardar en la otra sin recargar: debe mostrar el mensaje de conflicto.
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add docs/deploy.md && git commit -m "docs: document Editor permission upgrade and audit columns"
```
