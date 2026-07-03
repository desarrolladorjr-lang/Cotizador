# Órdenes de Compra Directa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, independent OC type to the dashboard — "OC Directa" — where the user captures a purchase from an individual supplier and the app calculates and prints two mirrored documents (compra / reventa with a per-kg margin), replacing the manual Excel workflow (`OC696 RODRIGO CALDERA.xlsx`).

**Architecture:** Follows the existing `OrdenesCompra` feature's layering exactly: a `lib/` client reads/parses a Google Sheet (catalogs only this time, not transactional data), a cached `GET` API route serves it, pure calculation functions live in their own testable module, a form component captures input and drives live calculation, and a print component renders the two documents reusing the existing `.oc-*` print CSS. No new persistence — this is capture → calculate → print, nothing saved.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Vitest + Testing Library, existing `sheetsClient.ts` (Google Sheets API wrapper), existing `.oc-*` print styles in `globals.css`.

## Global Constraints

- Spreadsheet: reuse `OC_SPREADSHEET_ID` (`17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM`) already exported from `dashboard/src/lib/ordenesClient.ts` — the catalog tab lives in the same logística spreadsheet.
- Catalog sheet name: `CONCEPTOS`.
- No backend writes, no history, no auto-incrementing folio — per approved spec, folio consecutivo is a manual text input.
- Retención IVA is a single toggle shared by both documents (compra and reventa use the same flag).
- Margin is a **flat per-kg amount added to the unit price** (e.g. `+$0.03/kg`), not a percentage — confirmed by reading the source formula `P21 = G21 + $S$21` where `S21 = 0.03` is an absolute value, not a rate. (The approved spec's wording "Margen %" was based on a misreading; this plan corrects it to a flat per-kg amount. Flag this correction to the user after implementation.)
- All new files follow existing naming/style conventions in `dashboard/src/lib/` and `dashboard/src/components/` — no new patterns introduced.
- Test runner: `npm run test` (= `vitest run`) from the `dashboard/` directory.

---

### Task 1: `numeroALetras` — number to Spanish words converter

**Files:**
- Create: `dashboard/src/lib/numeroALetras.ts`
- Test: `dashboard/src/lib/numeroALetras.test.ts`

**Interfaces:**
- Produces: `numeroALetras(valor: number): string` — used by Task 6 (`OrdenDirectaPrint.tsx`) to render "IMPORTE EN LETRAS SON:".

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/lib/numeroALetras.test.ts
import { describe, it, expect } from 'vitest';
import { numeroALetras } from './numeroALetras';

describe('numeroALetras', () => {
  it('convierte un monto con millones, miles y centenas', () => {
    expect(numeroALetras(1105545.5)).toBe(
      'UN MILLON CIENTO CINCO MIL QUINIENTOS CUARENTA Y CINCO PESOS 50/100 M.N.'
    );
  });

  it('singular PESO cuando el entero es 1', () => {
    expect(numeroALetras(1)).toBe('UN PESO 00/100 M.N.');
  });

  it('CIEN exacto (no "UN CIENTO")', () => {
    expect(numeroALetras(100)).toBe('CIEN PESOS 00/100 M.N.');
  });

  it('veintiuno y compuestos con Y', () => {
    expect(numeroALetras(21)).toBe('VEINTIUN PESOS 00/100 M.N.');
    expect(numeroALetras(45)).toBe('CUARENTA Y CINCO PESOS 00/100 M.N.');
  });

  it('cero pesos con centavos', () => {
    expect(numeroALetras(0.5)).toBe('CERO PESOS 50/100 M.N.');
  });

  it('mil exacto no dice "UN MIL"', () => {
    expect(numeroALetras(1000)).toBe('MIL PESOS 00/100 M.N.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/numeroALetras.test.ts`
Expected: FAIL — `Cannot find module './numeroALetras'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/lib/numeroALetras.ts
const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIECIS = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
];
const DECENAS = [
  '', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

function decenasATexto(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DIECIS[n - 10];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return DECENAS[d];
  if (d === 2) return 'VEINTI' + UNIDADES[u];
  return `${DECENAS[d]} Y ${UNIDADES[u]}`;
}

function centenasATexto(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let texto = c > 0 ? CENTENAS[c] : '';
  if (resto > 0) texto += (texto ? ' ' : '') + decenasATexto(resto);
  return texto;
}

function enterosATexto(n: number): string {
  if (n === 0) return 'CERO';

  const millones = Math.floor(n / 1_000_000);
  const restoMillones = n % 1_000_000;
  const miles = Math.floor(restoMillones / 1000);
  const centenas = restoMillones % 1000;

  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLON' : `${centenasATexto(millones)} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${centenasATexto(miles)} MIL`);
  }
  if (centenas > 0) {
    partes.push(centenasATexto(centenas));
  }
  return partes.join(' ');
}

export function numeroALetras(valor: number): string {
  const absoluto = Math.abs(valor);
  const entero = Math.floor(absoluto);
  const centavos = Math.round((absoluto - entero) * 100);
  const sufijo = entero === 1 ? 'PESO' : 'PESOS';
  const centavosTxt = String(centavos).padStart(2, '0');
  return `${enterosATexto(entero)} ${sufijo} ${centavosTxt}/100 M.N.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/numeroALetras.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/numeroALetras.ts dashboard/src/lib/numeroALetras.test.ts
git commit -m "feat: add numeroALetras Spanish number-to-words converter"
```

---

### Task 2: `ordenDirectaCalculos` — pure calculation functions

**Files:**
- Create: `dashboard/src/lib/ordenDirectaCalculos.ts`
- Test: `dashboard/src/lib/ordenDirectaCalculos.test.ts`

**Interfaces:**
- Produces: types `LineaCaptura`, `LineaCalculada`, `TotalesLado`, `CalculoOrden`, `EntidadFiscal`; functions `calcularLinea`, `calcularOrden`, `construirFolio`. Consumed by Task 7 (`OrdenDirectaForm.tsx`) and Task 6 (`OrdenDirectaPrint.tsx`).
- Consumes: nothing (pure module, no imports beyond types).

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/lib/ordenDirectaCalculos.test.ts
import { describe, it, expect } from 'vitest';
import { calcularLinea, calcularOrden, construirFolio, type LineaCaptura } from './ordenDirectaCalculos';

const LINEA_BASE: LineaCaptura = {
  material: 'ALUMINIO 1100 TRASTE',
  claveSat: '11191610',
  cantidadKg: 7485,
  unidad: 'KGM',
  precioNeto: 43,
};

describe('calcularLinea', () => {
  it('sin retención: precio unitario = precio neto / 1.16', () => {
    const l = calcularLinea(LINEA_BASE, 'NO', 0.03)!;
    expect(l.precioUnitarioCompra).toBeCloseTo(37.068966, 5);
    expect(l.importeCompra).toBeCloseTo(277461.21, 1);
  });

  it('con retención: precio unitario = precio neto tal cual', () => {
    const l = calcularLinea(LINEA_BASE, 'SI', 0.03)!;
    expect(l.precioUnitarioCompra).toBe(43);
  });

  it('margen es un monto plano por kg, no un porcentaje', () => {
    const l = calcularLinea(LINEA_BASE, 'NO', 0.03)!;
    expect(l.precioUnitarioReventa).toBeCloseTo(37.098966, 5);
    expect(l.importeReventa).toBeCloseTo(l.cantidadKg * 37.098966, 1);
  });

  it('cantidad o precio faltante → null (línea incompleta)', () => {
    expect(calcularLinea({ ...LINEA_BASE, cantidadKg: null }, 'NO', 0.03)).toBeNull();
    expect(calcularLinea({ ...LINEA_BASE, precioNeto: null }, 'NO', 0.03)).toBeNull();
  });

  it('cantidad o precio en cero o negativo → null', () => {
    expect(calcularLinea({ ...LINEA_BASE, cantidadKg: 0 }, 'NO', 0.03)).toBeNull();
    expect(calcularLinea({ ...LINEA_BASE, precioNeto: -1 }, 'NO', 0.03)).toBeNull();
  });
});

describe('calcularOrden', () => {
  it('excluye líneas incompletas y calcula subtotal/iva/total por lado', () => {
    const orden = calcularOrden(
      [LINEA_BASE, { ...LINEA_BASE, cantidadKg: null }],
      'NO',
      0.03
    );
    expect(orden.lineas).toHaveLength(1);
    expect(orden.compra.subtotal).toBeCloseTo(277461.21, 1);
    expect(orden.compra.iva).toBeCloseTo(277461.21 * 0.16, 1);
    expect(orden.compra.ivaRetenido).toBe(0);
    expect(orden.compra.total).toBeCloseTo(277461.21 * 1.16, 1);
  });

  it('con retención: iva retenido = iva completo', () => {
    const orden = calcularOrden([LINEA_BASE], 'SI', 0.03);
    expect(orden.compra.ivaRetenido).toBeCloseTo(orden.compra.iva, 5);
    expect(orden.compra.total).toBeCloseTo(orden.compra.subtotal, 1);
  });

  it('lista vacía → totales en cero', () => {
    const orden = calcularOrden([], 'NO', 0.03);
    expect(orden.lineas).toEqual([]);
    expect(orden.compra.subtotal).toBe(0);
    expect(orden.reventa.subtotal).toBe(0);
  });
});

describe('construirFolio', () => {
  it('sin entrar a MTY: segundo segmento fijo "Directo"', () => {
    expect(construirFolio('696', false, '')).toBe('OC.696/Directo');
  });

  it('entrando a MTY: segundo segmento es el consecutivo de MTY', () => {
    expect(construirFolio('696', true, 'E641')).toBe('OC.696/E641');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/ordenDirectaCalculos.test.ts`
Expected: FAIL — `Cannot find module './ordenDirectaCalculos'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/lib/ordenDirectaCalculos.ts
export interface EntidadFiscal {
  nombre: string;
  rfc: string;
  direccion: string;
  regimen: string;
}

export interface LineaCaptura {
  material: string;
  claveSat: string;
  cantidadKg: number | null;
  unidad: string;
  precioNeto: number | null;
}

export interface LineaCalculada {
  material: string;
  claveSat: string;
  cantidadKg: number;
  unidad: string;
  precioUnitarioCompra: number;
  importeCompra: number;
  precioUnitarioReventa: number;
  importeReventa: number;
}

export interface TotalesLado {
  subtotal: number;
  iva: number;
  ivaRetenido: number;
  total: number;
}

export interface CalculoOrden {
  lineas: LineaCalculada[];
  compra: TotalesLado;
  reventa: TotalesLado;
}

export function calcularLinea(
  linea: LineaCaptura,
  retencion: 'SI' | 'NO',
  margenPorKg: number
): LineaCalculada | null {
  if (linea.cantidadKg === null || linea.precioNeto === null) return null;
  if (linea.cantidadKg <= 0 || linea.precioNeto <= 0) return null;

  const precioUnitarioCompra = retencion === 'NO' ? linea.precioNeto / 1.16 : linea.precioNeto;
  const importeCompra = linea.cantidadKg * precioUnitarioCompra;
  const precioUnitarioReventa = precioUnitarioCompra + margenPorKg;
  const importeReventa = linea.cantidadKg * precioUnitarioReventa;

  return {
    material: linea.material,
    claveSat: linea.claveSat,
    cantidadKg: linea.cantidadKg,
    unidad: linea.unidad,
    precioUnitarioCompra,
    importeCompra,
    precioUnitarioReventa,
    importeReventa,
  };
}

function totalesDe(importes: number[], retencion: 'SI' | 'NO'): TotalesLado {
  const subtotal = importes.reduce((a, b) => a + b, 0);
  const iva = subtotal * 0.16;
  const ivaRetenido = retencion === 'NO' ? 0 : iva;
  const total = subtotal + iva - ivaRetenido;
  return { subtotal, iva, ivaRetenido, total };
}

export function calcularOrden(
  lineasCaptura: LineaCaptura[],
  retencion: 'SI' | 'NO',
  margenPorKg: number
): CalculoOrden {
  const lineas = lineasCaptura
    .map((l) => calcularLinea(l, retencion, margenPorKg))
    .filter((l): l is LineaCalculada => l !== null);

  return {
    lineas,
    compra: totalesDe(lineas.map((l) => l.importeCompra), retencion),
    reventa: totalesDe(lineas.map((l) => l.importeReventa), retencion),
  };
}

export function construirFolio(consecutivo: string, entraMty: boolean, folioMty: string): string {
  const segundo = entraMty ? folioMty.trim() : 'Directo';
  return `OC.${consecutivo.trim()}/${segundo}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/ordenDirectaCalculos.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/ordenDirectaCalculos.ts dashboard/src/lib/ordenDirectaCalculos.test.ts
git commit -m "feat: add pure calculation functions for OC Directa (precio, margen, folio)"
```

---

### Task 3: `ordenesDirectasCatalogo` — catalog client

**Files:**
- Create: `dashboard/src/lib/ordenesDirectasCatalogo.ts`
- Test: `dashboard/src/lib/ordenesDirectasCatalogo.test.ts`

**Interfaces:**
- Consumes: `getSheetsApi`, `SheetsApi` from `./sheetsClient`; `OC_SPREADSHEET_ID` from `./ordenesClient`; `EntidadFiscal` from `./ordenDirectaCalculos`.
- Produces: `CatalogoOrdenDirecta` type, `parseCatalogo(rows: string[][]): CatalogoOrdenDirecta`, `fetchCatalogo(api?: SheetsApi): Promise<CatalogoOrdenDirecta>`. Consumed by Task 4 (API route) and Task 7 (form).

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/lib/ordenesDirectasCatalogo.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseCatalogo, fetchCatalogo } from './ordenesDirectasCatalogo';
import { OC_SPREADSHEET_ID } from './ordenesClient';

// Layout mimics CONCEPTOS: materiales en A/C, métodos en E, formas en G,
// bloque de entidades "EMISOR 2" en fila 1 (I:L), bloque "EMISOR" en fila 6 (I:L),
// proveedores en P.
const ROWS: string[][] = [
  ['CONCEPTO', 'X', 'CLAVE SAT', 'X', 'METODOS DE PAGO', 'X', 'FORMAS DE PAGO', 'X',
    'EMISOR 2', 'RFC', 'DIRECCION', 'REGIMEN', 'X', 'X', 'X', 'PROVEEDOR'],
  ['ALUMINIO CABLE', '', '11191610', '', 'PUE', '', '01-EFECTIVO', '',
    'ELSY GUADALUPE SOSA CHAVEZ', 'AIDC780612P9A', 'CALLE 6', 'P.F. ACT EMP Y PROF', '', '', '', 'RODRIGO CALDERA'],
  ['ANTIMONIO', '', '11191610', '', 'PPD', '', '02-CHEQUE', '', '', '', '', '', '', '', '', 'CESAR DELGADO'],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  [],
  [],
  ['', '', '', '', '', '', '', '', 'EMISOR', 'RFC', 'DIRECCION', 'REGIMEN'],
  ['', '', '', '', '', '', '', '', 'ALVARO RESENDIZ GALLEGOS', 'REGA5602198E6', 'CALLE 22', 'P.F. ACT EMP Y PROF'],
  ['', '', '', '', '', '', '', '', 'HECTOR RESENDIZ GALLEGOS', 'REGH680904C68', 'CALLE 135', 'P.F. ACT EMP Y PROF'],
];

describe('parseCatalogo', () => {
  it('parsea materiales con clave SAT', () => {
    const c = parseCatalogo(ROWS);
    expect(c.materiales).toEqual([
      { material: 'ALUMINIO CABLE', claveSat: '11191610' },
      { material: 'ANTIMONIO', claveSat: '11191610' },
    ]);
  });

  it('parsea métodos y formas de pago', () => {
    const c = parseCatalogo(ROWS);
    expect(c.metodosPago).toEqual(['PUE', 'PPD']);
    expect(c.formasPago).toEqual(['01-EFECTIVO', '02-CHEQUE']);
  });

  it('parsea proveedores', () => {
    const c = parseCatalogo(ROWS);
    expect(c.proveedores).toEqual(['RODRIGO CALDERA', 'CESAR DELGADO']);
  });

  it('parsea el primer bloque EMISOR* como entidadesCompra y el segundo como entidadesReventa', () => {
    const c = parseCatalogo(ROWS);
    expect(c.entidadesCompra).toEqual([
      { nombre: 'ELSY GUADALUPE SOSA CHAVEZ', rfc: 'AIDC780612P9A', direccion: 'CALLE 6', regimen: 'P.F. ACT EMP Y PROF' },
    ]);
    expect(c.entidadesReventa).toEqual([
      { nombre: 'ALVARO RESENDIZ GALLEGOS', rfc: 'REGA5602198E6', direccion: 'CALLE 22', regimen: 'P.F. ACT EMP Y PROF' },
      { nombre: 'HECTOR RESENDIZ GALLEGOS', rfc: 'REGH680904C68', direccion: 'CALLE 135', regimen: 'P.F. ACT EMP Y PROF' },
    ]);
  });

  it('hoja vacía → catálogo con listas vacías', () => {
    const c = parseCatalogo([]);
    expect(c).toEqual({
      materiales: [],
      entidadesCompra: [],
      entidadesReventa: [],
      proveedores: [],
      metodosPago: [],
      formasPago: [],
    });
  });
});

describe('fetchCatalogo', () => {
  it('lee CONCEPTOS del spreadsheet OC y parsea', async () => {
    const get = vi.fn().mockResolvedValue({ data: { values: ROWS } });
    const api = { spreadsheets: { values: { get } } } as any;
    const catalogo = await fetchCatalogo(api);
    expect(get).toHaveBeenCalledWith({
      spreadsheetId: OC_SPREADSHEET_ID,
      range: `'CONCEPTOS'!A1:P60`,
    });
    expect(catalogo.materiales).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/ordenesDirectasCatalogo.test.ts`
Expected: FAIL — `Cannot find module './ordenesDirectasCatalogo'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/lib/ordenesDirectasCatalogo.ts
import { getSheetsApi, type SheetsApi } from './sheetsClient';
import { OC_SPREADSHEET_ID } from './ordenesClient';
import type { EntidadFiscal } from './ordenDirectaCalculos';

const CATALOGO_SHEET_NAME = 'CONCEPTOS';

export interface CatalogoOrdenDirecta {
  materiales: { material: string; claveSat: string }[];
  entidadesCompra: EntidadFiscal[];
  entidadesReventa: EntidadFiscal[];
  proveedores: string[];
  metodosPago: string[];
  formasPago: string[];
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

function findColumn(rows: string[][], label: string): number {
  for (const row of rows) {
    const i = row.findIndex((cell) => norm(cell) === label);
    if (i >= 0) return i;
  }
  return -1;
}

function readColumnList(rows: string[][], col: number, startRow: number): string[] {
  const out: string[] = [];
  if (col < 0) return out;
  for (let r = startRow; r < rows.length; r++) {
    const v = (rows[r]?.[col] || '').trim();
    if (!v) break;
    out.push(v);
  }
  return out;
}

function readMateriales(rows: string[][]): { material: string; claveSat: string }[] {
  const colMaterial = findColumn(rows, 'concepto');
  const colSat = findColumn(rows, 'clave sat');
  if (colMaterial < 0) return [];
  const out: { material: string; claveSat: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const material = (rows[r]?.[colMaterial] || '').trim();
    if (!material) break;
    out.push({ material, claveSat: colSat >= 0 ? (rows[r]?.[colSat] || '').trim() : '' });
  }
  return out;
}

function readEntidadBlocks(rows: string[][]): EntidadFiscal[][] {
  const blocks: EntidadFiscal[][] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const col = row.findIndex((cell) => /^emisor/i.test(String(cell ?? '').trim()));
    if (col < 0) continue;
    const entidades: EntidadFiscal[] = [];
    for (let rr = r + 1; rr < rows.length; rr++) {
      const nombre = (rows[rr]?.[col] || '').trim();
      if (!nombre) break;
      entidades.push({
        nombre,
        rfc: (rows[rr]?.[col + 1] || '').trim(),
        direccion: (rows[rr]?.[col + 2] || '').trim(),
        regimen: (rows[rr]?.[col + 3] || '').trim(),
      });
    }
    blocks.push(entidades);
  }
  return blocks;
}

export function parseCatalogo(rows: string[][]): CatalogoOrdenDirecta {
  const colMetodos = findColumn(rows, 'metodos de pago');
  const colFormas = findColumn(rows, 'formas de pago');
  const colProveedor = findColumn(rows, 'proveedor');
  const [entidadesCompra = [], entidadesReventa = []] = readEntidadBlocks(rows);

  return {
    materiales: readMateriales(rows),
    entidadesCompra,
    entidadesReventa,
    proveedores: readColumnList(rows, colProveedor, 1),
    metodosPago: readColumnList(rows, colMetodos, 1),
    formasPago: readColumnList(rows, colFormas, 1),
  };
}

export async function fetchCatalogo(api?: SheetsApi): Promise<CatalogoOrdenDirecta> {
  const sheets = api || (await getSheetsApi());
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: OC_SPREADSHEET_ID,
    range: `'${CATALOGO_SHEET_NAME}'!A1:P60`,
  });
  return parseCatalogo((res.data.values as string[][]) || []);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/ordenesDirectasCatalogo.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/ordenesDirectasCatalogo.ts dashboard/src/lib/ordenesDirectasCatalogo.test.ts
git commit -m "feat: add OC Directa catalog client (materiales, entidades, proveedores)"
```

---

### Task 4: API route `/api/ordenes-directas/catalogo`

**Files:**
- Create: `dashboard/src/app/api/ordenes-directas/catalogo/route.ts`
- Test: `dashboard/src/app/api/ordenes-directas/catalogo/route.test.ts`

**Interfaces:**
- Consumes: `fetchCatalogo`, `type CatalogoOrdenDirecta` from `@/lib/ordenesDirectasCatalogo`; `createTtlCache` from `@/lib/feedCache`.
- Produces: `GET` handler returning `{ catalogo: CatalogoOrdenDirecta, stale: boolean }` on success, or `{ catalogo: null, error: string, stale: true }` with 503 when there's no cache to fall back on. Consumed by Task 7 (form fetches `/api/ordenes-directas/catalogo`).

Follows the exact same shape as `dashboard/src/app/api/ordenes/route.ts` — this is a read-only GET with no credential check, matching that existing route (auth is enforced only on mutating `POST` routes elsewhere in this codebase).

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/app/api/ordenes-directas/catalogo/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/ordenesDirectasCatalogo', () => ({
  fetchCatalogo: vi.fn(),
}));

import { fetchCatalogo } from '@/lib/ordenesDirectasCatalogo';

const CATALOGO = {
  materiales: [{ material: 'ANTIMONIO', claveSat: '11191610' }],
  entidadesCompra: [{ nombre: 'ELSY', rfc: 'X', direccion: 'X', regimen: 'X' }],
  entidadesReventa: [{ nombre: 'ALVARO', rfc: 'Y', direccion: 'Y', regimen: 'Y' }],
  proveedores: ['RODRIGO CALDERA'],
  metodosPago: ['PPD'],
  formasPago: ['99-POR DEFINIR'],
};

describe('GET /api/ordenes-directas/catalogo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('regresa el catálogo', async () => {
    (fetchCatalogo as any).mockResolvedValue(CATALOGO);
    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.json();
    expect(body.catalogo.proveedores).toEqual(['RODRIGO CALDERA']);
    expect(body.stale).toBe(false);
  });

  it('cachea: segunda llamada no vuelve a leer Sheets', async () => {
    (fetchCatalogo as any).mockResolvedValue(CATALOGO);
    const { GET } = await import('./route');
    await GET();
    await GET();
    expect(fetchCatalogo).toHaveBeenCalledTimes(1);
  });

  it('error de Sheets sin cache previa → 503', async () => {
    (fetchCatalogo as any).mockRejectedValue(new Error('boom'));
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.catalogo).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/catalogo/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/app/api/ordenes-directas/catalogo/route.ts
import { fetchCatalogo, type CatalogoOrdenDirecta } from '@/lib/ordenesDirectasCatalogo';
import { createTtlCache } from '@/lib/feedCache';

export const dynamic = 'force-dynamic';

const cache = createTtlCache<CatalogoOrdenDirecta>(60_000);

export async function GET() {
  const cached = cache.get();
  if (cached) return Response.json({ catalogo: cached, stale: false });

  try {
    const catalogo = await fetchCatalogo();
    cache.set(catalogo);
    return Response.json({ catalogo, stale: false });
  } catch (err) {
    const stale = cache.getStale();
    if (stale) return Response.json({ catalogo: stale, stale: true });
    return Response.json(
      { catalogo: null, error: (err as Error).message, stale: true },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/catalogo/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/ordenes-directas/catalogo/route.ts dashboard/src/app/api/ordenes-directas/catalogo/route.test.ts
git commit -m "feat: add cached GET route for OC Directa catalog"
```

---

### Task 5: Print CSS additions

**Files:**
- Modify: `dashboard/src/app/globals.css` (append after the existing `.oc-foot` rule, before the `@media print` block — check current line numbers with the Grep below since Task 1-4 commits don't touch this file)

**Interfaces:**
- Produces: CSS classes `.oc-lado-banner`, `.oc-fiscal`, `.oc-letras`, `.oc-firmas`, `.oc-firma-line` — consumed by Task 6 (`OrdenDirectaPrint.tsx`).

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "oc-foot\|@media print" dashboard/src/app/globals.css`
Expected output includes lines like:
```
300:.oc-foot {
306:@media print {
```

- [ ] **Step 2: Insert the new rules immediately before `@media print`**

Add this block right after the closing `}` of `.oc-foot` and before `@media print {`:

```css
.oc-lado-banner {
  margin: 0 40px 12px;
  padding: 6px 12px;
  text-align: center;
  font-family: var(--font-display, sans-serif);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.08em;
  background: #0a0a0a;
  color: #fff;
}
.oc-fiscal { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.5; }
.oc-letras { margin: 12px 40px 0; font-size: 11px; }
.oc-firmas { display: flex; justify-content: space-between; margin: 40px 40px 0; }
.oc-firma-line {
  border-top: 1px solid #000;
  width: 220px;
  text-align: center;
  padding-top: 6px;
  font-size: 10px;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 3: Verify no build errors**

Run: `cd dashboard && npm run build`
Expected: build completes without CSS errors (this is a plain CSS file, no linting step specific to it — a successful Next.js build is the check).

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/globals.css
git commit -m "feat: add print CSS for OC Directa (lado banner, fiscal data, firmas)"
```

---

### Task 6: `OrdenDirectaPrint` component

**Files:**
- Create: `dashboard/src/components/OrdenDirectaPrint.tsx`
- Test: `dashboard/src/components/OrdenDirectaPrint.test.tsx`

**Interfaces:**
- Consumes: `type { LineaCalculada, TotalesLado, EntidadFiscal }` from `@/lib/ordenDirectaCalculos`; `numeroALetras` from `@/lib/numeroALetras`.
- Produces: `OrdenDirectaPrint` default export, props:

```ts
interface OrdenDirectaPrintProps {
  lado: 'compra' | 'reventa';
  folio: string;
  fecha: string;
  proveedor: string;
  entidad: EntidadFiscal;
  metodoPago: string;
  formaPago: string;
  lineas: LineaCalculada[];
  totales: TotalesLado;
}
```

Consumed by Task 7 (`OrdenDirectaForm.tsx`) — one instance per lado.

- [ ] **Step 1: Write the failing tests**

```tsx
// dashboard/src/components/OrdenDirectaPrint.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrdenDirectaPrint from './OrdenDirectaPrint';
import type { LineaCalculada, TotalesLado, EntidadFiscal } from '@/lib/ordenDirectaCalculos';

const ENTIDAD: EntidadFiscal = {
  nombre: 'ELSY GUADALUPE SOSA CHAVEZ',
  rfc: 'AIDC780612P9A',
  direccion: 'CALLE 6 No.370',
  regimen: 'P.F. ACT EMP Y PROF',
};

const LINEAS: LineaCalculada[] = [
  {
    material: 'ALUMINIO 1100 TRASTE', claveSat: '11191610', cantidadKg: 7485, unidad: 'KGM',
    precioUnitarioCompra: 37.068966, importeCompra: 277461.21,
    precioUnitarioReventa: 37.098966, importeReventa: 277685.76,
  },
];

const TOTALES: TotalesLado = { subtotal: 277461.21, iva: 44393.79, ivaRetenido: 0, total: 321855 };

function renderLado(lado: 'compra' | 'reventa') {
  return render(
    <OrdenDirectaPrint
      lado={lado}
      folio="OC.696/Directo"
      fecha="2026-07-02"
      proveedor="RODRIGO CALDERA"
      entidad={ENTIDAD}
      metodoPago="PPD"
      formaPago="99-POR DEFINIR"
      lineas={LINEAS}
      totales={TOTALES}
    />
  );
}

describe('OrdenDirectaPrint', () => {
  it('muestra folio, proveedor y datos fiscales de la entidad', () => {
    renderLado('compra');
    expect(screen.getByText('OC.696/Directo')).toBeInTheDocument();
    expect(screen.getByText('RODRIGO CALDERA')).toBeInTheDocument();
    expect(screen.getByText('AIDC780612P9A')).toBeInTheDocument();
  });

  it('lado compra: usa precio e importe de compra', () => {
    renderLado('compra');
    expect(screen.getByText('277461')).toBeInTheDocument();
  });

  it('lado reventa: usa precio e importe de reventa', () => {
    renderLado('reventa');
    expect(screen.getByText('277686')).toBeInTheDocument();
  });

  it('muestra el importe en letras del total', () => {
    renderLado('compra');
    expect(screen.getByText(/PESOS/)).toBeInTheDocument();
  });

  it('banner de lado indica COMPRA o REVENTA', () => {
    renderLado('reventa');
    expect(screen.getByText(/REVENTA/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaPrint.test.tsx`
Expected: FAIL — `Cannot find module './OrdenDirectaPrint'`

- [ ] **Step 3: Implement**

```tsx
// dashboard/src/components/OrdenDirectaPrint.tsx
import type { LineaCalculada, TotalesLado, EntidadFiscal } from '@/lib/ordenDirectaCalculos';
import { numeroALetras } from '@/lib/numeroALetras';

const MIN_FILAS = 8;

const fmtCantidad = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPrecio = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtImporte = (n: number) => Math.round(n).toLocaleString('en-US');

interface OrdenDirectaPrintProps {
  lado: 'compra' | 'reventa';
  folio: string;
  fecha: string;
  proveedor: string;
  entidad: EntidadFiscal;
  metodoPago: string;
  formaPago: string;
  lineas: LineaCalculada[];
  totales: TotalesLado;
}

export default function OrdenDirectaPrint({
  lado, folio, fecha, proveedor, entidad, metodoPago, formaPago, lineas, totales,
}: OrdenDirectaPrintProps) {
  const filas = [...lineas, ...Array(Math.max(0, MIN_FILAS - lineas.length)).fill(null)];
  const precioDe = (l: LineaCalculada) => (lado === 'compra' ? l.precioUnitarioCompra : l.precioUnitarioReventa);
  const importeDe = (l: LineaCalculada) => (lado === 'compra' ? l.importeCompra : l.importeReventa);

  return (
    <div className="oc-sheet">
      <div className="oc-bar" />
      <div className="oc-lado-banner">{lado === 'compra' ? 'DOCUMENTO DE COMPRA' : 'DOCUMENTO DE REVENTA'}</div>
      <div className="oc-head">
        <div className="oc-head-left">
          <img src="/logo-oc.png" alt="SIDELL Scrap Metal" className="oc-logo" />
          <div className="oc-emitido-label">EMITIDO A (PROVEEDOR)</div>
          <div className="oc-proveedor">{proveedor}</div>
          <div className="oc-fiscal">
            <div>{entidad.nombre}</div>
            <div>RFC: {entidad.rfc}</div>
            <div>{entidad.direccion}</div>
            <div>{entidad.regimen}</div>
          </div>
        </div>
        <div className="oc-head-right">
          <h2 className="oc-title">ORDEN DE COMPRA</h2>
          <div className="oc-subtitle">DOCUMENTO DE MATERIALES</div>
          <div className="oc-meta-row">
            <div className="oc-meta-box">
              <div className="oc-meta-label">N° DE OC</div>
              <div className="oc-meta-value">{folio}</div>
            </div>
            <div className="oc-meta-box">
              <div className="oc-meta-label">FECHA</div>
              <div className="oc-meta-value">{fecha}</div>
            </div>
          </div>
          <div className="oc-meta-box oc-meta-wide">
            <div className="oc-meta-label">MÉTODO / FORMA DE PAGO</div>
            <div className="oc-meta-value">{metodoPago} / {formaPago}</div>
          </div>
        </div>
      </div>

      <table className="oc-table">
        <thead>
          <tr>
            <th>CLAVE SAT</th>
            <th>MATERIAL / DESCRIPCIÓN</th>
            <th>CANTIDAD</th>
            <th>PRECIO UNITARIO</th>
            <th>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((linea: LineaCalculada | null, i) => (
            <tr key={i}>
              <td>{linea?.claveSat || ''}</td>
              <td className="oc-td-material">{linea?.material || ''}</td>
              <td>{linea ? `${fmtCantidad(linea.cantidadKg)} ${linea.unidad}` : ''}</td>
              <td>{linea ? fmtPrecio(precioDe(linea)) : ''}</td>
              <td className="oc-td-importe">{linea ? fmtImporte(importeDe(linea)) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="oc-total-row">
            <td colSpan={3} className="oc-total-label">SUBTOTAL</td>
            <td colSpan={2} className="oc-td-importe">{fmtImporte(totales.subtotal)}</td>
          </tr>
          <tr className="oc-total-row">
            <td colSpan={3} className="oc-total-label">IVA 16%</td>
            <td colSpan={2} className="oc-td-importe">{fmtImporte(totales.iva)}</td>
          </tr>
          <tr className="oc-total-row">
            <td colSpan={3} className="oc-total-label">IVA RET.</td>
            <td colSpan={2} className="oc-td-importe">{fmtImporte(totales.ivaRetenido)}</td>
          </tr>
          <tr className="oc-total-row">
            <td colSpan={3} className="oc-total-label">TOTAL</td>
            <td colSpan={2} className="oc-td-importe">{fmtImporte(totales.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="oc-letras">IMPORTE EN LETRAS SON: {numeroALetras(totales.total)}</div>

      <div className="oc-notas-label">Notas / Condiciones Comerciales:</div>
      <div className="oc-notas">
        <div>* Pago: contra recepción de documentos (factura comercial, tickets de peso).</div>
        <div>* Se tomará como peso final el que resulte al momento que el cliente reciba el mismo.</div>
        <div>* Recolección: recogido en planta. El vendedor corre con los gastos de maniobra de carga.</div>
      </div>

      <div className="oc-firmas">
        <div className="oc-firma-line">FIRMA COMPRADOR</div>
        <div className="oc-firma-line">FIRMA VENDEDOR</div>
      </div>

      <div className="oc-foot">SIDELL Scrap Metal LLC</div>
      <div className="oc-bar" />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaPrint.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/OrdenDirectaPrint.tsx dashboard/src/components/OrdenDirectaPrint.test.tsx
git commit -m "feat: add OrdenDirectaPrint component (compra/reventa document)"
```

---

### Task 7: `OrdenDirectaForm` component

**Files:**
- Create: `dashboard/src/components/OrdenDirectaForm.tsx`
- Test: `dashboard/src/components/OrdenDirectaForm.test.tsx`

**Interfaces:**
- Consumes: `type { CatalogoOrdenDirecta }` from `@/lib/ordenesDirectasCatalogo`; `calcularOrden`, `construirFolio`, `type LineaCaptura` from `@/lib/ordenDirectaCalculos`; `OrdenDirectaPrint` (default export) from `./OrdenDirectaPrint`.
- Produces: `OrdenDirectaForm` default export, no props (self-contained, fetches its own catalog via `/api/ordenes-directas/catalogo`). Consumed by Task 8 (`page.tsx`).

- [ ] **Step 1: Write the failing tests**

```tsx
// dashboard/src/components/OrdenDirectaForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OrdenDirectaForm from './OrdenDirectaForm';

const CATALOGO = {
  materiales: [{ material: 'ANTIMONIO', claveSat: '11191610' }],
  entidadesCompra: [{ nombre: 'ELSY GUADALUPE SOSA CHAVEZ', rfc: 'AIDC780612P9A', direccion: 'CALLE 6', regimen: 'P.F.' }],
  entidadesReventa: [{ nombre: 'ALVARO RESENDIZ GALLEGOS', rfc: 'REGA5602198E6', direccion: 'CALLE 22', regimen: 'P.F.' }],
  proveedores: ['RODRIGO CALDERA'],
  metodosPago: ['PPD'],
  formasPago: ['99-POR DEFINIR'],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ catalogo: CATALOGO, stale: false }),
  } as Response);
});

async function llenarFormularioMinimo() {
  await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'RODRIGO CALDERA' } });
  fireEvent.change(screen.getByLabelText(/entidad.*compra/i), { target: { value: 'ELSY GUADALUPE SOSA CHAVEZ' } });
  fireEvent.change(screen.getByLabelText(/entidad.*reventa/i), { target: { value: 'ALVARO RESENDIZ GALLEGOS' } });
  fireEvent.change(screen.getByLabelText(/folio/i), { target: { value: '696' } });
  fireEvent.change(screen.getByLabelText(/material/i), { target: { value: 'ANTIMONIO' } });
  fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '1830' } });
  fireEvent.change(screen.getByLabelText(/precio neto/i), { target: { value: '41' } });
}

describe('OrdenDirectaForm', () => {
  it('carga el catálogo y llena los dropdowns', async () => {
    render(<OrdenDirectaForm />);
    await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'RODRIGO CALDERA' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ELSY GUADALUPE SOSA CHAVEZ' })).toBeInTheDocument();
  });

  it('checkbox "Entra a Monterrey" cambia el segundo segmento del folio', async () => {
    render(<OrdenDirectaForm />);
    await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/folio/i), { target: { value: '696' } });
    expect(screen.getByText('OC.696/Directo')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/entra a monterrey/i));
    fireEvent.change(screen.getByLabelText(/consecutivo.*monterrey/i), { target: { value: 'E641' } });
    expect(screen.getByText('OC.696/E641')).toBeInTheDocument();
  });

  it('captura una línea y calcula el total en vivo', async () => {
    render(<OrdenDirectaForm />);
    await llenarFormularioMinimo();
    // precioNeto=41, retención NO por default → precioUnitario = 41/1.16 = 35.344828
    // importeCompra = 1830 * 35.344828 ≈ 64681
    await waitFor(() => expect(screen.getByText('64681')).toBeInTheDocument());
  });

  it('genera y muestra ambos documentos al presionar "Generar documentos"', async () => {
    render(<OrdenDirectaForm />);
    await llenarFormularioMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documentos/i }));
    expect(screen.getByText('DOCUMENTO DE COMPRA')).toBeInTheDocument();
    expect(screen.getByText('DOCUMENTO DE REVENTA')).toBeInTheDocument();
  });

  it('botón "Editar" regresa al formulario sin perder los datos capturados', async () => {
    render(<OrdenDirectaForm />);
    await llenarFormularioMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByDisplayValue('RODRIGO CALDERA')).toBeInTheDocument();
  });

  it('error al cargar catálogo muestra mensaje y reintentar', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network'));
    render(<OrdenDirectaForm />);
    await waitFor(() => expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: FAIL — `Cannot find module './OrdenDirectaForm'`

- [ ] **Step 3: Implement**

```tsx
// dashboard/src/components/OrdenDirectaForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import OrdenDirectaPrint from './OrdenDirectaPrint';
import { calcularOrden, construirFolio, type LineaCaptura } from '@/lib/ordenDirectaCalculos';
import type { CatalogoOrdenDirecta } from '@/lib/ordenesDirectasCatalogo';

interface LineaFormState {
  material: string;
  cantidadKg: string;
  unidad: string;
  precioNeto: string;
}

const lineaVacia = (): LineaFormState => ({ material: '', cantidadKg: '', unidad: 'KGM', precioNeto: '' });

export default function OrdenDirectaForm() {
  const [catalogo, setCatalogo] = useState<CatalogoOrdenDirecta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [folioConsecutivo, setFolioConsecutivo] = useState('');
  const [entraMty, setEntraMty] = useState(false);
  const [folioMty, setFolioMty] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [proveedor, setProveedor] = useState('');
  const [entidadCompraNombre, setEntidadCompraNombre] = useState('');
  const [entidadReventaNombre, setEntidadReventaNombre] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [retencion, setRetencion] = useState<'SI' | 'NO'>('NO');
  const [margenPorKg, setMargenPorKg] = useState('0');
  const [lineas, setLineas] = useState<LineaFormState[]>([lineaVacia()]);
  const [mostrarImpresion, setMostrarImpresion] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ordenes-directas/catalogo');
      if (!res.ok) throw new Error('fetch failed');
      const body = (await res.json()) as { catalogo: CatalogoOrdenDirecta | null };
      if (!body.catalogo) throw new Error('sin catálogo');
      setCatalogo(body.catalogo);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineasCaptura: LineaCaptura[] = useMemo(
    () =>
      lineas.map((l) => ({
        material: l.material,
        claveSat: catalogo?.materiales.find((m) => m.material === l.material)?.claveSat || '',
        cantidadKg: l.cantidadKg.trim() === '' ? null : Number(l.cantidadKg),
        unidad: l.unidad,
        precioNeto: l.precioNeto.trim() === '' ? null : Number(l.precioNeto),
      })),
    [lineas, catalogo]
  );

  const calculo = useMemo(
    () => calcularOrden(lineasCaptura, retencion, Number(margenPorKg) || 0),
    [lineasCaptura, retencion, margenPorKg]
  );

  const folio = construirFolio(folioConsecutivo, entraMty, folioMty);
  const entidadCompra = catalogo?.entidadesCompra.find((e) => e.nombre === entidadCompraNombre);
  const entidadReventa = catalogo?.entidadesReventa.find((e) => e.nombre === entidadReventaNombre);
  const puedeGenerar = Boolean(proveedor && entidadCompra && entidadReventa && calculo.lineas.length > 0);

  function actualizarLinea(i: number, campo: keyof LineaFormState, valor: string) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, lineaVacia()]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (loading) return <p>cargando…</p>;

  if (error) {
    return (
      <div>
        <p>No se pudieron cargar los catálogos.</p>
        <button type="button" onClick={load}>Reintentar</button>
      </div>
    );
  }

  if (mostrarImpresion && entidadCompra && entidadReventa) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button type="button" onClick={() => setMostrarImpresion(false)}>← Editar</button>
        </div>
        <div className="oc-print-area">
          <button type="button" onClick={() => window.print()}>Imprimir / Guardar PDF (Compra)</button>
          <OrdenDirectaPrint
            lado="compra"
            folio={folio}
            fecha={fecha}
            proveedor={proveedor}
            entidad={entidadCompra}
            metodoPago={metodoPago}
            formaPago={formaPago}
            lineas={calculo.lineas}
            totales={calculo.compra}
          />
          <button type="button" onClick={() => window.print()}>Imprimir / Guardar PDF (Reventa)</button>
          <OrdenDirectaPrint
            lado="reventa"
            folio={folio}
            fecha={fecha}
            proveedor={proveedor}
            entidad={entidadReventa}
            metodoPago={metodoPago}
            formaPago={formaPago}
            lineas={calculo.lineas}
            totales={calculo.reventa}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--cream)' }}>
      <div>
        <label htmlFor="folio-consecutivo">Folio consecutivo</label>
        <input id="folio-consecutivo" value={folioConsecutivo} onChange={(e) => setFolioConsecutivo(e.target.value)} />

        <label htmlFor="entra-mty">
          <input
            id="entra-mty"
            type="checkbox"
            checked={entraMty}
            onChange={(e) => setEntraMty(e.target.checked)}
          />
          Entra a Monterrey
        </label>

        {entraMty && (
          <>
            <label htmlFor="folio-mty">Consecutivo de Monterrey</label>
            <input id="folio-mty" value={folioMty} onChange={(e) => setFolioMty(e.target.value)} />
          </>
        )}

        <div>{folio}</div>

        <label htmlFor="fecha">Fecha</label>
        <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

        <label htmlFor="proveedor">Proveedor</label>
        <select id="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {catalogo?.proveedores.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <label htmlFor="entidad-compra">Entidad emisora (compra)</label>
        <select id="entidad-compra" value={entidadCompraNombre} onChange={(e) => setEntidadCompraNombre(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {catalogo?.entidadesCompra.map((e) => (
            <option key={e.nombre} value={e.nombre}>{e.nombre}</option>
          ))}
        </select>

        <label htmlFor="entidad-reventa">Entidad emisora (reventa)</label>
        <select id="entidad-reventa" value={entidadReventaNombre} onChange={(e) => setEntidadReventaNombre(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {catalogo?.entidadesReventa.map((e) => (
            <option key={e.nombre} value={e.nombre}>{e.nombre}</option>
          ))}
        </select>

        <label htmlFor="metodo-pago">Método de pago</label>
        <select id="metodo-pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {catalogo?.metodosPago.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <label htmlFor="forma-pago">Forma de pago</label>
        <select id="forma-pago" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {catalogo?.formasPago.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <label htmlFor="retencion">Retención IVA</label>
        <select id="retencion" value={retencion} onChange={(e) => setRetencion(e.target.value as 'SI' | 'NO')}>
          <option value="NO">NO</option>
          <option value="SI">SI</option>
        </select>

        <label htmlFor="margen">Margen por kg (reventa)</label>
        <input id="margen" type="number" step="0.01" value={margenPorKg} onChange={(e) => setMargenPorKg(e.target.value)} />
      </div>

      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Cantidad (kg)</th>
            <th>Precio neto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i}>
              <td>
                <label htmlFor={`material-${i}`}>Material</label>
                <select
                  id={`material-${i}`}
                  value={l.material}
                  onChange={(e) => actualizarLinea(i, 'material', e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {catalogo?.materiales.map((m) => (
                    <option key={m.material} value={m.material}>{m.material}</option>
                  ))}
                </select>
              </td>
              <td>
                <label htmlFor={`cantidad-${i}`}>Cantidad</label>
                <input
                  id={`cantidad-${i}`}
                  type="number"
                  value={l.cantidadKg}
                  onChange={(e) => actualizarLinea(i, 'cantidadKg', e.target.value)}
                />
              </td>
              <td>
                <label htmlFor={`precio-${i}`}>Precio neto</label>
                <input
                  id={`precio-${i}`}
                  type="number"
                  value={l.precioNeto}
                  onChange={(e) => actualizarLinea(i, 'precioNeto', e.target.value)}
                />
              </td>
              <td>
                <button type="button" onClick={() => quitarLinea(i)}>Quitar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={agregarLinea}>+ Agregar línea</button>

      <div>
        <div>Subtotal compra: {Math.round(calculo.compra.subtotal)}</div>
        <div>Total compra: {Math.round(calculo.compra.total)}</div>
        <div>Subtotal reventa: {Math.round(calculo.reventa.subtotal)}</div>
        <div>Total reventa: {Math.round(calculo.reventa.total)}</div>
      </div>

      <button type="button" disabled={!puedeGenerar} onClick={() => setMostrarImpresion(true)}>
        Generar documentos
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/OrdenDirectaForm.tsx dashboard/src/components/OrdenDirectaForm.test.tsx
git commit -m "feat: add OrdenDirectaForm (capture, live calc, print both documents)"
```

---

### Task 8: Wire into `page.tsx` navigation

**Files:**
- Modify: `dashboard/src/app/page.tsx`

**Interfaces:**
- Consumes: `OrdenDirectaForm` (default export) from `@/components/OrdenDirectaForm`.

- [ ] **Step 1: Add the import**

In `dashboard/src/app/page.tsx`, next to the existing `OrdenesCompra` import (currently line 8):

```tsx
import OrdenesCompra from '@/components/OrdenesCompra';
import OrdenDirectaForm from '@/components/OrdenDirectaForm';
```

- [ ] **Step 2: Extend `SectionId` and add the sidebar entry**

Change line 20 from:
```tsx
type SectionId = 'resumen' | 'operaciones' | 'pipeline' | 'compras' | 'ordenes';
```
to:
```tsx
type SectionId = 'resumen' | 'operaciones' | 'pipeline' | 'compras' | 'ordenes' | 'ordenes-directas';
```

Add a new entry to the `SECTIONS` array, right after the existing `'ordenes'` entry (currently ends at line 82):

```tsx
  {
    id: 'ordenes-directas',
    label: 'OC Directa',
    sub: 'Compra y reventa a proveedor individual',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3v18M17 3v18" />
        <path d="M3 8h4M17 8h4M3 16h4M17 16h4" />
      </svg>
    ),
  },
```

- [ ] **Step 3: Add the count entry**

In the `counts` object (currently around line 139-145), add:

```tsx
  const counts: Record<SectionId, number> = {
    resumen: data.rows.length,
    operaciones: data.rows.length,
    pipeline: data.rows.filter((r) => r.pipeline).length,
    compras: comprasRows.length,
    ordenes: ordenesCount,
    'ordenes-directas': 0,
  };
```

- [ ] **Step 4: Render the section**

Right after the existing `{section === 'ordenes' && <OrdenesCompra onCountChange={setOrdenesCount} />}` line (currently line 258):

```tsx
        {section === 'ordenes-directas' && <OrdenDirectaForm />}
```

- [ ] **Step 5: Type-check and run the full test suite**

Run: `cd dashboard && npm run test`
Expected: all suites PASS, including the pre-existing ones (no regressions).

Run: `cd dashboard && npm run build`
Expected: build succeeds with no TypeScript errors (this catches any `SectionId` exhaustiveness mismatch).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/page.tsx
git commit -m "feat: wire OC Directa into dashboard navigation"
```

---

### Task 9: Manual verification

**Files:** none (manual QA pass, no code changes)

- [ ] **Step 1: Start the dev server**

Run: `cd dashboard && npm run dev`

- [ ] **Step 2: Add a `CONCEPTOS`-shaped catalog tab to the logística spreadsheet**

Before this feature can show real data, the spreadsheet at `OC_SPREADSHEET_ID` needs a `CONCEPTOS` tab with the layout parsed by Task 3 (`CONCEPTO`/`CLAVE SAT` columns, `METODOS DE PAGO`, `FORMAS DE PAGO`, two `EMISOR`-prefixed blocks with `RFC`/`DIRECCION`/`REGIMEN`, `PROVEEDOR` column). This is a manual spreadsheet edit by the user — flag it as a pending manual step if not already done, same as the header-alignment step noted in the existing `OrdenesCompra` history.

- [ ] **Step 3: Walk the golden path in the browser**

- Open the dashboard, sign in, click "OC Directa" in the sidebar.
- Fill folio `696`, leave "Entra a Monterrey" unchecked → confirm displayed folio reads `OC.696/Directo`.
- Select proveedor `RODRIGO CALDERA` (or whatever the real catalog has), entidad de compra, entidad de reventa, método/forma de pago.
- Add a line: material `ALUMINIO 1100 TRASTE` (or equivalent), cantidad `7485`, precio neto `43`.
- Confirm the live total matches the value computed from `OC696 RODRIGO CALDERA.xlsx` cell `H21` (≈ `277461`) for compra, and cell `Q21` (≈ `277686`, with whatever margen-per-kg value is entered) for reventa.
- Click "Generar documentos" → confirm both `DOCUMENTO DE COMPRA` and `DOCUMENTO DE REVENTA` render with correct fiscal data, folio, and `IMPORTE EN LETRAS`.
- Click "Imprimir / Guardar PDF" for each and confirm the print preview isolates only that document (sidebar/buttons hidden), matching the existing `OrdenPrint` print behavior.
- Click "← Editar" and confirm the form still has all previously entered values.
- Check the "Entra a Monterrey" box, type an MTY consecutive (e.g. `E641`), confirm folio updates to `OC.696/E641`.

- [ ] **Step 4: Report results to the user**

Summarize what worked and what (if anything) didn't match the Excel reference, in particular flag the corrected margin semantics (flat per-kg amount, not a percentage) so the user can confirm this matches their intent before relying on it.
