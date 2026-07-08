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

