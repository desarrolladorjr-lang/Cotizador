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

