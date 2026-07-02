# Órdenes de Compra en Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva sección "Órdenes de Compra" en el dashboard: lista órdenes leídas de la hoja `COMPRAS` del spreadsheet de logística y muestra cada OC con el formato exacto del sheet, con botón Imprimir / Guardar PDF.

**Architecture:** Next.js App Router (`dashboard/`). Nuevo módulo `ordenesClient.ts` lee `COMPRAS!A1:Z1000` del spreadsheet `17oB7...` con el `getSheetsApi()` existente, mapea columnas por encabezado y agrupa filas por `ORDEN`. Nuevo route `GET /api/ordenes` (sin auth, igual que `/api/feed` y `/api/pipeline`: AuthGate protege del lado cliente) con cache TTL 25s. Frontend: sección `ordenes` en el sidebar, componente lista `OrdenesCompra` y componente presentacional `OrdenPrint` (réplica visual del sheet) + CSS `@media print`.

**Tech Stack:** Next.js 14, React 18, googleapis (JWT service account), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-02-ordenes-compra-dashboard-design.md`

## Global Constraints

- Spreadsheet OC: `17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM`, hoja `COMPRAS`.
- Encabezados reales de `COMPRAS` (fila 1, ¡algunos con espacio final!): `ORDEN`, `FECHA `, `ESTATUS`, `PROVEEDOR`, `MATERIAL`, `EMBALAJE`, `KG OC`, `NEGOCIACION`, `PRECIO PACTADO`. Mapear por nombre normalizado (`trim().toLowerCase()`), nunca por posición fija.
- Filas con columna `ORDEN` vacía se ignoran.
- `importe = cantidadKg × precioUnitario`; solo si ambos son numéricos, si no `null`.
- Formatos: cantidad `8,000.00` (2 decimales, comas), precio `$69.00`, importe `552,000` (0 decimales, comas).
- GET routes de este proyecto no llevan token (auth solo en client con AuthGate); `/api/ordenes` sigue ese patrón.
- Todos los comandos se corren desde `dashboard/` (`npm run test` = `vitest run`).
- Commits frecuentes, mensajes en español estilo repo (`feat:`, `docs:`...), con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `ordenesClient.ts` — parsing y agrupación

**Files:**
- Create: `dashboard/src/lib/ordenesClient.ts`
- Test: `dashboard/src/lib/ordenesClient.test.ts`

**Interfaces:**
- Consumes: `getSheetsApi`, `SheetsApi` de `@/lib/sheetsClient`.
- Produces (usado por Task 2 y Task 3/4):

```ts
export const OC_SPREADSHEET_ID = '17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM';
export interface OrdenLinea {
  material: string;
  embalaje: string;
  cantidadKg: number | null;
  precioUnitario: number | null;
  importe: number | null;
}
export interface OrdenCompra {
  numero: string;
  fecha: string;
  proveedor: string;
  negociacion: string;
  estatus: string;
  lineas: OrdenLinea[];
  total: number;
}
export function parseNumero(value: string | undefined): number | null;
export function parseOrdenes(rows: string[][]): OrdenCompra[];
export async function fetchOrdenes(api?: SheetsApi): Promise<OrdenCompra[]>;
```

- [ ] **Step 1: Write the failing tests**

Crear `dashboard/src/lib/ordenesClient.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { parseNumero, parseOrdenes, fetchOrdenes, OC_SPREADSHEET_ID } from './ordenesClient';

const HEADER = [
  'ORDEN', 'FECHA ', 'ESTATUS', 'PROVEEDOR', 'MATERIAL', 'EMBALAJE', 'KG OC',
  'NEGOCIACION', 'F. CARGA', 'F. ENTREGA', 'DESTINO ', 'CLIENTE', 'DESTINO F',
  'CONTRATO', 'PRECIO PACTADO',
];

// Filas estilo sheet real: P022 con 3 materiales, filas sin ORDEN, otra orden P021.
const ROWS: string[][] = [
  HEADER,
  ['P022', '8 abril, 2026', 'ENTREGADO', 'CESAR DELGADO', 'PERFIL S/P', 'PACAS', '8,000.00', 'RECOLECCION', '', '', '', '', '', '', '$69.00'],
  ['P022', '8 abril, 2026', 'ENTREGADO', 'CESAR DELGADO', 'CABLE', 'PACAS', '8,000.00', 'RECOLECCION', '', '', '', '', '', '', '$77.00'],
  ['P022', '8 abril, 2026', 'ENTREGADO', 'CESAR DELGADO', 'RIN', 'PACAS', '8,000.00', 'RECOLECCION', '', '', '', '', '', '', '$62.50'],
  ['', '', 'ENTREGADO', 'VALENTIN', 'BOTE', '', '25,000.00', 'MTY', '', '', '', '', '', '', '$37.80'],
  ['P021', '1 abril, 2026', 'PENDIENTE', 'VALENTIN', 'BOTE', '', '25,000.00', 'MTY', '', '', '', '', '', '', ''],
];

describe('parseNumero', () => {
  it('parsea miles con comas y decimales', () => {
    expect(parseNumero('8,000.00')).toBe(8000);
  });
  it('parsea precios con $', () => {
    expect(parseNumero('$37.80')).toBe(37.8);
  });
  it('vacío o no numérico → null', () => {
    expect(parseNumero('')).toBeNull();
    expect(parseNumero(undefined)).toBeNull();
    expect(parseNumero('N/A')).toBeNull();
  });
});

describe('parseOrdenes', () => {
  it('agrupa filas por ORDEN e ignora filas sin ORDEN', () => {
    const ordenes = parseOrdenes(ROWS);
    expect(ordenes.map((o) => o.numero)).toEqual(['P022', 'P021']); // desc
    const p022 = ordenes[0];
    expect(p022.lineas).toHaveLength(3);
    expect(p022.proveedor).toBe('CESAR DELGADO');
    expect(p022.fecha).toBe('8 abril, 2026');
    expect(p022.negociacion).toBe('RECOLECCION');
    expect(p022.estatus).toBe('ENTREGADO');
  });

  it('calcula importe y total', () => {
    const p022 = parseOrdenes(ROWS)[0];
    expect(p022.lineas[0].importe).toBe(552000); // 8000 * 69
    expect(p022.total).toBe(552000 + 616000 + 500000);
  });

  it('línea sin precio → importe null y no suma al total', () => {
    const p021 = parseOrdenes(ROWS)[1];
    expect(p021.lineas[0].importe).toBeNull();
    expect(p021.total).toBe(0);
  });

  it('mapea por encabezado aunque columnas estén reordenadas', () => {
    const reordered = [
      ['PROVEEDOR', 'ORDEN', 'MATERIAL', 'KG OC', 'PRECIO PACTADO', 'FECHA ', 'NEGOCIACION', 'ESTATUS', 'EMBALAJE'],
      ['CESAR', 'P001', 'CABLE', '1,000.00', '$10.00', '1 enero, 2026', 'MTY', 'ENTREGADO', 'PACAS'],
    ];
    const [o] = parseOrdenes(reordered);
    expect(o.numero).toBe('P001');
    expect(o.lineas[0].importe).toBe(10000);
  });

  it('sin filas → lista vacía', () => {
    expect(parseOrdenes([])).toEqual([]);
    expect(parseOrdenes([HEADER])).toEqual([]);
  });
});

describe('fetchOrdenes', () => {
  it('lee COMPRAS del spreadsheet OC y parsea', async () => {
    const get = vi.fn().mockResolvedValue({ data: { values: ROWS } });
    const api = { spreadsheets: { values: { get } } } as any;
    const ordenes = await fetchOrdenes(api);
    expect(get).toHaveBeenCalledWith({
      spreadsheetId: OC_SPREADSHEET_ID,
      range: `'COMPRAS'!A1:Z1000`,
    });
    expect(ordenes).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/ordenesClient.test.ts`
Expected: FAIL — `Cannot find module './ordenesClient'` (o equivalente).

- [ ] **Step 3: Write implementation**

Crear `dashboard/src/lib/ordenesClient.ts`:

```ts
import { getSheetsApi, type SheetsApi } from './sheetsClient';

// Spreadsheet de logística (distinto al principal): hoja COMPRAS es la fuente
// de las órdenes de compra que el sheet "ORDEN DE COMPRA" arma con VLOOKUP/FILTER.
export const OC_SPREADSHEET_ID = '17oB7NfMh6q5s5Gw3N9Z9FRegVWOC615zKp1Md7n6JsM';
const OC_SHEET_NAME = 'COMPRAS';

export interface OrdenLinea {
  material: string;
  embalaje: string;
  cantidadKg: number | null;
  precioUnitario: number | null;
  importe: number | null;
}

export interface OrdenCompra {
  numero: string;
  fecha: string;
  proveedor: string;
  negociacion: string;
  estatus: string;
  lineas: OrdenLinea[];
  total: number;
}

// "8,000.00" → 8000, "$37.80" → 37.8, ""/no numérico → null
export function parseNumero(value: string | undefined): number | null {
  const cleaned = String(value ?? '').replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const normLabel = (s: unknown) => String(s ?? '').trim().toLowerCase();

// Etiquetas del sheet real (algunas traen espacio final; normLabel lo absorbe).
const LABELS = {
  orden: 'orden',
  fecha: 'fecha',
  estatus: 'estatus',
  proveedor: 'proveedor',
  material: 'material',
  embalaje: 'embalaje',
  cantidadKg: 'kg oc',
  negociacion: 'negociacion',
  precio: 'precio pactado',
} as const;

export function parseOrdenes(rows: string[][]): OrdenCompra[] {
  if (rows.length < 2) return [];
  const header = rows[0] || [];
  const idx: Record<keyof typeof LABELS, number> = {} as Record<keyof typeof LABELS, number>;
  for (const [key, label] of Object.entries(LABELS) as [keyof typeof LABELS, string][]) {
    idx[key] = header.findIndex((cell) => normLabel(cell) === label);
  }
  const get = (r: string[], key: keyof typeof LABELS): string => {
    const c = idx[key];
    return c >= 0 ? (r[c] || '').trim() : '';
  };

  const byNumero = new Map<string, OrdenCompra>();
  for (const r of rows.slice(1)) {
    if (!r) continue;
    const numero = get(r, 'orden');
    if (!numero) continue;

    let orden = byNumero.get(numero);
    if (!orden) {
      // Encabezado de la orden = primera fila del grupo (equivale a los VLOOKUP del sheet).
      orden = {
        numero,
        fecha: get(r, 'fecha'),
        proveedor: get(r, 'proveedor'),
        negociacion: get(r, 'negociacion'),
        estatus: get(r, 'estatus'),
        lineas: [],
        total: 0,
      };
      byNumero.set(numero, orden);
    }

    const cantidadKg = parseNumero(get(r, 'cantidadKg'));
    const precioUnitario = parseNumero(get(r, 'precio'));
    const importe = cantidadKg !== null && precioUnitario !== null ? cantidadKg * precioUnitario : null;
    orden.lineas.push({
      material: get(r, 'material'),
      embalaje: get(r, 'embalaje'),
      cantidadKg,
      precioUnitario,
      importe,
    });
    if (importe !== null) orden.total += importe;
  }

  // Descendente por número (numeric-aware: P021 < P022 < P100).
  return [...byNumero.values()].sort((a, b) =>
    b.numero.localeCompare(a.numero, undefined, { numeric: true })
  );
}

export async function fetchOrdenes(api?: SheetsApi): Promise<OrdenCompra[]> {
  const sheets = api || (await getSheetsApi());
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: OC_SPREADSHEET_ID,
    range: `'${OC_SHEET_NAME}'!A1:Z1000`,
  });
  return parseOrdenes((res.data.values as string[][]) || []);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/ordenesClient.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Run full suite (regresiones)**

Run: `cd dashboard && npm run test`
Expected: PASS todo.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/ordenesClient.ts dashboard/src/lib/ordenesClient.test.ts
git commit -m "feat(dashboard): ordenesClient — lee y agrupa órdenes de compra del doc logística

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: API route `GET /api/ordenes`

**Files:**
- Create: `dashboard/src/app/api/ordenes/route.ts`
- Test: `dashboard/src/app/api/ordenes/route.test.ts`

**Interfaces:**
- Consumes: `fetchOrdenes`, `OrdenCompra` de `@/lib/ordenesClient`; `createTtlCache` de `@/lib/feedCache`.
- Produces: `GET /api/ordenes` → `200 { ordenes: OrdenCompra[] }`; error de Sheets sin cache → `503 { ordenes: [], error: string }`; con cache stale → `200 { ordenes, stale: true }`.

- [ ] **Step 1: Write the failing tests**

Crear `dashboard/src/app/api/ordenes/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ordenesClient', () => ({
  fetchOrdenes: vi.fn(),
}));

import { fetchOrdenes } from '@/lib/ordenesClient';
import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

const ORDEN = {
  numero: 'P022',
  fecha: '8 abril, 2026',
  proveedor: 'CESAR DELGADO',
  negociacion: 'RECOLECCION',
  estatus: 'ENTREGADO',
  lineas: [{ material: 'CABLE', embalaje: 'PACAS', cantidadKg: 8000, precioUnitario: 77, importe: 616000 }],
  total: 616000,
};

describe('GET /api/ordenes', () => {
  it('regresa las órdenes', async () => {
    (fetchOrdenes as any).mockResolvedValue([ORDEN]);
    const res = await GET();
    const body = await res.json();
    expect(body.ordenes).toHaveLength(1);
    expect(body.ordenes[0].numero).toBe('P022');
  });

  it('cachea: segunda llamada no vuelve a leer Sheets', async () => {
    (fetchOrdenes as any).mockResolvedValue([ORDEN]);
    await GET();
    await GET();
    expect(fetchOrdenes).toHaveBeenCalledTimes(1);
  });

  it('error de Sheets con cache previa → sirve stale', async () => {
    // La cache del módulo ya tiene datos por los tests anteriores.
    (fetchOrdenes as any).mockRejectedValue(new Error('boom'));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ordenes[0].numero).toBe('P022');
  });
});
```

Nota: la cache TTL vive a nivel módulo (igual que `/api/feed`); los tests están ordenados para aprovecharla. El caso "error sin cache → 503" no se puede aislar sin resetear módulos; cubierto implícitamente por el código (misma forma que `/api/feed`, ya probado ahí).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/ordenes/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write implementation**

Crear `dashboard/src/app/api/ordenes/route.ts`:

```ts
import { fetchOrdenes, type OrdenCompra } from '@/lib/ordenesClient';
import { createTtlCache } from '@/lib/feedCache';

// Reads Google Sheets per request — never prerender/cache at build time.
export const dynamic = 'force-dynamic';

const cache = createTtlCache<OrdenCompra[]>(25_000);

export async function GET() {
  const cached = cache.get();
  if (cached) return Response.json({ ordenes: cached, stale: false });

  try {
    const ordenes = await fetchOrdenes();
    cache.set(ordenes);
    return Response.json({ ordenes, stale: false });
  } catch (err) {
    const stale = cache.getStale();
    if (stale) return Response.json({ ordenes: stale, stale: true });
    return Response.json(
      { ordenes: [], error: (err as Error).message, stale: true },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/app/api/ordenes/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/ordenes
git commit -m "feat(dashboard): GET /api/ordenes con cache TTL y fallback stale

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `OrdenPrint` — formato OC réplica del sheet + CSS print

**Files:**
- Create: `dashboard/src/components/OrdenPrint.tsx`
- Create: `dashboard/public/logo-oc.png` (copia de `LOGO_PNG.png` de la raíz del repo)
- Modify: `dashboard/src/app/globals.css` (agregar estilos `.oc-*` y `@media print` al final)
- Test: `dashboard/src/components/OrdenPrint.test.tsx`

**Interfaces:**
- Consumes: `OrdenCompra`, `OrdenLinea` de `@/lib/ordenesClient`.
- Produces: `<OrdenPrint orden={OrdenCompra} />` — componente presentacional puro (sin fetch, sin estado). Usado por Task 4.

Referencia visual (PDF exportado de la hoja `ORDEN DE COMPRA`): barra naranja arriba y abajo, logo SIDELL en caja negra a la izquierda, título "ORDEN DE COMPRA" con línea naranja + "DOCUMENTO DE MATERIALES" a la derecha, cajas N° DE OC / FECHA / NEGOCIACIÓN, proveedor en caja gris con borde izquierdo naranja, tabla con header negro, mínimo 8 filas (vacías solo con línea), "**** PRECIO EN DLLS", caja de condiciones, pie "SIDELL Scrap Metal LLC".

- [ ] **Step 1: Copiar el logo**

```bash
cp LOGO_PNG.png dashboard/public/logo-oc.png
```

- [ ] **Step 2: Write the failing test**

Crear `dashboard/src/components/OrdenPrint.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrdenPrint from './OrdenPrint';
import type { OrdenCompra } from '@/lib/ordenesClient';

const ORDEN: OrdenCompra = {
  numero: 'P022',
  fecha: '8 abril, 2026',
  proveedor: 'CESAR DELGADO',
  negociacion: 'RECOLECCION',
  estatus: 'ENTREGADO',
  lineas: [
    { material: 'PERFIL S/P', embalaje: 'PACAS', cantidadKg: 8000, precioUnitario: 69, importe: 552000 },
    { material: 'CABLE', embalaje: 'PACAS', cantidadKg: 8000, precioUnitario: 77, importe: 616000 },
  ],
  total: 1168000,
};

describe('OrdenPrint', () => {
  it('muestra encabezado de la orden', () => {
    render(<OrdenPrint orden={ORDEN} />);
    expect(screen.getByText('P022')).toBeInTheDocument();
    expect(screen.getByText('8 abril, 2026')).toBeInTheDocument();
    expect(screen.getByText('CESAR DELGADO')).toBeInTheDocument();
    expect(screen.getByText('RECOLECCION')).toBeInTheDocument();
  });

  it('formatea cantidad, precio e importe como el sheet', () => {
    render(<OrdenPrint orden={ORDEN} />);
    expect(screen.getAllByText('8,000.00')).toHaveLength(2);
    expect(screen.getByText('$69.00')).toBeInTheDocument();
    expect(screen.getByText('552,000')).toBeInTheDocument();
  });

  it('rellena hasta 8 filas mínimo', () => {
    const { container } = render(<OrdenPrint orden={ORDEN} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(8);
  });

  it('línea con importe null se muestra vacía', () => {
    const conNull: OrdenCompra = {
      ...ORDEN,
      lineas: [{ material: 'BOTE', embalaje: '', cantidadKg: 25000, precioUnitario: null, importe: null }],
      total: 0,
    };
    render(<OrdenPrint orden={conNull} />);
    expect(screen.getByText('BOTE')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('incluye condiciones fijas y pie', () => {
    render(<OrdenPrint orden={ORDEN} />);
    expect(screen.getByText(/inspección de calidad en báscula/)).toBeInTheDocument();
    expect(screen.getByText('SIDELL Scrap Metal LLC')).toBeInTheDocument();
    expect(screen.getByText('**** PRECIO EN DLLS')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/components/OrdenPrint.test.tsx`
Expected: FAIL — `Cannot find module './OrdenPrint'`.

- [ ] **Step 4: Write the component**

Crear `dashboard/src/components/OrdenPrint.tsx`:

```tsx
import type { OrdenCompra, OrdenLinea } from '@/lib/ordenesClient';

const MIN_FILAS = 8;

const fmtCantidad = (n: number | null) =>
  n === null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPrecio = (n: number | null) =>
  n === null ? '' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtImporte = (n: number | null) =>
  n === null ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const CONDICIONES = [
  '* El material está sujeto a inspección de calidad en báscula.',
  '* Se aplicarán mermas según el porcentaje de impurezas detectadas.',
  '* Horario de recepción: Lunes a Viernes de 8:00 AM a 4:00 PM.',
];

export default function OrdenPrint({ orden }: { orden: OrdenCompra }) {
  const filas: (OrdenLinea | null)[] = [
    ...orden.lineas,
    ...Array(Math.max(0, MIN_FILAS - orden.lineas.length)).fill(null),
  ];

  return (
    <div className="oc-sheet">
      <div className="oc-bar" />
      <div className="oc-head">
        <div className="oc-head-left">
          <img src="/logo-oc.png" alt="SIDELL Scrap Metal" className="oc-logo" />
          <div className="oc-emitido-label">EMITIDO A (PROVEEDOR)</div>
          <div className="oc-proveedor">{orden.proveedor}</div>
        </div>
        <div className="oc-head-right">
          <h2 className="oc-title">ORDEN DE COMPRA</h2>
          <div className="oc-subtitle">DOCUMENTO DE MATERIALES</div>
          <div className="oc-meta-row">
            <div className="oc-meta-box">
              <div className="oc-meta-label">N° DE OC</div>
              <div className="oc-meta-value">{orden.numero}</div>
            </div>
            <div className="oc-meta-box">
              <div className="oc-meta-label">FECHA</div>
              <div className="oc-meta-value">{orden.fecha}</div>
            </div>
          </div>
          <div className="oc-meta-box oc-meta-wide">
            <div className="oc-meta-label">NEGOCIACIÓN</div>
            <div className="oc-meta-value">{orden.negociacion}</div>
          </div>
        </div>
      </div>

      <table className="oc-table">
        <thead>
          <tr>
            <th>MATERIAL / DESCRIPCIÓN</th>
            <th>EMBALAJE</th>
            <th>CANTIDAD</th>
            <th>PRECIO UNITARIO</th>
            <th>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((linea, i) => (
            <tr key={i}>
              <td className="oc-td-material">{linea?.material || ''}</td>
              <td>{linea?.embalaje || ''}</td>
              <td>{fmtCantidad(linea?.cantidadKg ?? null)}</td>
              <td>{fmtPrecio(linea?.precioUnitario ?? null)}</td>
              <td className="oc-td-importe">{fmtImporte(linea?.importe ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="oc-dlls">**** PRECIO EN DLLS</div>
      <div className="oc-notas-label">Notas / Condiciones Comerciales:</div>
      <div className="oc-notas">
        {CONDICIONES.map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>

      <div className="oc-foot">SIDELL Scrap Metal LLC</div>
      <div className="oc-bar" />
    </div>
  );
}
```

- [ ] **Step 5: Agregar estilos al final de `dashboard/src/app/globals.css`**

```css
/* ===== Orden de Compra (réplica del sheet, siempre fondo claro) ===== */
.oc-sheet {
  background: #fff;
  color: #1a1a1a;
  max-width: 820px;
  margin: 0 auto;
  padding: 0 0 4px;
  font-family: Arial, Helvetica, sans-serif;
}
.oc-bar { height: 10px; background: #f0690a; }
.oc-head { display: flex; justify-content: space-between; gap: 24px; padding: 28px 40px 8px; }
.oc-head-left { display: flex; flex-direction: column; }
.oc-logo { width: 130px; height: auto; background: #0a0a0a; padding: 10px; }
.oc-emitido-label { font-size: 10px; color: #555; margin-top: 12px; letter-spacing: 0.04em; }
.oc-proveedor {
  margin-top: 8px; padding: 10px 16px; font-size: 20px; letter-spacing: 0.06em;
  background: #f2f2f2; border-left: 4px solid #f0690a; min-width: 220px;
}
.oc-head-right { width: 320px; }
.oc-title {
  font-size: 18px; font-weight: 700; letter-spacing: 0.04em; margin: 0;
  border-bottom: 3px solid #f0690a; padding-bottom: 4px;
}
.oc-subtitle { font-size: 10px; color: #777; margin: 6px 0 16px; letter-spacing: 0.06em; }
.oc-meta-row { display: flex; }
.oc-meta-box { border: 1px solid #ccc; padding: 6px 10px; flex: 1; }
.oc-meta-wide { margin-top: 10px; }
.oc-meta-label { font-size: 9px; color: #777; letter-spacing: 0.05em; }
.oc-meta-value { font-size: 14px; font-weight: 700; margin-top: 2px; }
.oc-table { width: calc(100% - 80px); margin: 28px 40px 0; border-collapse: collapse; }
.oc-table th {
  background: #0a0a0a; color: #fff; font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; padding: 8px 10px; text-align: center;
}
.oc-table td {
  border-bottom: 1px solid #d9d9d9; padding: 8px 10px; font-size: 12px;
  text-align: center; height: 26px;
}
.oc-td-material { text-align: left; font-weight: 700; }
.oc-td-importe { font-weight: 700; }
.oc-dlls { margin: 24px 40px 0; font-size: 11px; font-weight: 700; }
.oc-notas-label { margin: 4px 40px 0; font-size: 11px; font-weight: 700; }
.oc-notas {
  margin: 6px 40px 0; border: 1px solid #ccc; padding: 10px 14px;
  font-size: 11px; line-height: 1.6; width: fit-content; color: #333;
}
.oc-foot {
  margin: 36px 40px 8px; padding-top: 6px; border-top: 1px solid #ddd;
  font-size: 10px; color: #888;
}

/* Al imprimir: solo la hoja OC, colores exactos, tamaño carta */
@media print {
  body * { visibility: hidden; }
  .oc-print-area, .oc-print-area * { visibility: visible; }
  .oc-print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .oc-sheet { max-width: none; }
  .oc-bar, .oc-table th, .oc-logo, .oc-proveedor {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}
@page { size: letter; margin: 12mm; }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenPrint.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/OrdenPrint.tsx dashboard/src/components/OrdenPrint.test.tsx dashboard/public/logo-oc.png dashboard/src/app/globals.css
git commit -m "feat(dashboard): OrdenPrint — formato OC réplica del sheet con CSS print

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `OrdenesCompra` — lista, buscador y selección

**Files:**
- Create: `dashboard/src/components/OrdenesCompra.tsx`
- Test: `dashboard/src/components/OrdenesCompra.test.tsx`

**Interfaces:**
- Consumes: `OrdenCompra` de `@/lib/ordenesClient`; `OrdenPrint` (Task 3); `GET /api/ordenes` (Task 2).
- Produces: `<OrdenesCompra onCountChange={(n: number) => void} />` — hace su propio fetch. `onCountChange` reporta el número de órdenes al padre (contador del nav, Task 5).

- [ ] **Step 1: Write the failing tests**

Crear `dashboard/src/components/OrdenesCompra.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OrdenesCompra from './OrdenesCompra';
import type { OrdenCompra } from '@/lib/ordenesClient';

const ORDENES: OrdenCompra[] = [
  {
    numero: 'P022', fecha: '8 abril, 2026', proveedor: 'CESAR DELGADO', negociacion: 'RECOLECCION',
    estatus: 'ENTREGADO', total: 552000,
    lineas: [{ material: 'PERFIL S/P', embalaje: 'PACAS', cantidadKg: 8000, precioUnitario: 69, importe: 552000 }],
  },
  {
    numero: 'P021', fecha: '1 abril, 2026', proveedor: 'VALENTIN', negociacion: 'MTY',
    estatus: 'PENDIENTE', total: 945000,
    lineas: [{ material: 'BOTE', embalaje: '', cantidadKg: 25000, precioUnitario: 37.8, importe: 945000 }],
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ordenes: ORDENES, stale: false }),
  } as Response);
});

describe('OrdenesCompra', () => {
  it('carga y lista las órdenes', async () => {
    render(<OrdenesCompra onCountChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('P022')).toBeInTheDocument());
    expect(screen.getByText('VALENTIN')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/ordenes');
  });

  it('reporta el conteo al padre', async () => {
    const onCountChange = vi.fn();
    render(<OrdenesCompra onCountChange={onCountChange} />);
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(2));
  });

  it('filtra por buscador (proveedor o número)', async () => {
    render(<OrdenesCompra onCountChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('P022')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'valentin' } });
    expect(screen.queryByText('P022')).not.toBeInTheDocument();
    expect(screen.getByText('P021')).toBeInTheDocument();
  });

  it('clic en orden muestra la OC y botón imprimir; volver regresa a la lista', async () => {
    render(<OrdenesCompra onCountChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('P022')).toBeInTheDocument());
    fireEvent.click(screen.getByText('P022'));
    expect(screen.getByText('ORDEN DE COMPRA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(screen.getByText('P021')).toBeInTheDocument();
  });

  it('error de fetch muestra mensaje y reintentar', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network'));
    render(<OrdenesCompra onCountChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OrdenesCompra.test.tsx`
Expected: FAIL — `Cannot find module './OrdenesCompra'`.

- [ ] **Step 3: Write the component**

Crear `dashboard/src/components/OrdenesCompra.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import OrdenPrint from './OrdenPrint';
import type { OrdenCompra } from '@/lib/ordenesClient';

const fmtTotal = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function OrdenesCompra({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seleccionada, setSeleccionada] = useState<OrdenCompra | null>(null);
  const [busqueda, setBusqueda] = useState('');

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ordenes');
      const body = (await res.json()) as { ordenes: OrdenCompra[] };
      setOrdenes(body.ordenes || []);
      onCountChange((body.ordenes || []).length);
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

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ordenes;
    return ordenes.filter(
      (o) => o.numero.toLowerCase().includes(q) || o.proveedor.toLowerCase().includes(q)
    );
  }, [ordenes, busqueda]);

  if (loading) return <p>cargando…</p>;

  if (error) {
    return (
      <div>
        <p>No se pudieron cargar las órdenes.</p>
        <button type="button" onClick={load}>Reintentar</button>
      </div>
    );
  }

  if (seleccionada) {
    return (
      <div>
        <div className="oc-actions" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button type="button" onClick={() => setSeleccionada(null)}>← Volver a la lista</button>
          <button type="button" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <div className="oc-print-area">
          <OrdenPrint orden={seleccionada} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Buscar por número o proveedor…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: 16, padding: '8px 12px', width: 320 }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--grey)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <th style={{ padding: '8px 10px' }}>N° OC</th>
            <th style={{ padding: '8px 10px' }}>Fecha</th>
            <th style={{ padding: '8px 10px' }}>Proveedor</th>
            <th style={{ padding: '8px 10px' }}>Negociación</th>
            <th style={{ padding: '8px 10px' }}>Estatus</th>
            <th style={{ padding: '8px 10px' }}>Materiales</th>
            <th style={{ padding: '8px 10px' }}>Total (DLLS)</th>
          </tr>
        </thead>
        <tbody>
          {filtradas.map((o) => (
            <tr
              key={o.numero}
              onClick={() => setSeleccionada(o)}
              style={{ cursor: 'pointer', borderTop: '1px solid var(--line)' }}
            >
              <td style={{ padding: '10px', fontWeight: 700, color: 'var(--orange)' }}>{o.numero}</td>
              <td style={{ padding: '10px' }}>{o.fecha}</td>
              <td style={{ padding: '10px' }}>{o.proveedor}</td>
              <td style={{ padding: '10px' }}>{o.negociacion}</td>
              <td style={{ padding: '10px' }}>{o.estatus}</td>
              <td style={{ padding: '10px' }}>{o.lineas.length}</td>
              <td style={{ padding: '10px' }}>{fmtTotal(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtradas.length === 0 && <p>Sin órdenes que coincidan.</p>}
    </div>
  );
}
```

Nota: el dashboard no define clases CSS de tabla (FeedTable usa estilos inline con las CSS vars de `globals.css`); esta tabla sigue ese mismo patrón con `var(--line)`, `var(--grey)`, `var(--orange)`. El contenedor exterior del componente debe llevar `style={{ fontFamily: 'var(--font-body)', color: 'var(--cream)' }}` como FeedTable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenesCompra.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/OrdenesCompra.tsx dashboard/src/components/OrdenesCompra.test.tsx
git commit -m "feat(dashboard): sección Órdenes de Compra — lista, buscador y vista imprimible

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Integración en `page.tsx` + verificación manual

**Files:**
- Modify: `dashboard/src/app/page.tsx` (SECTIONS, SectionId, counts, render)

**Interfaces:**
- Consumes: `<OrdenesCompra onCountChange={...} />` (Task 4).
- Produces: sección `ordenes` visible en el sidebar con contador.

- [ ] **Step 1: Agregar la sección**

En `dashboard/src/app/page.tsx`:

1. Import: `import OrdenesCompra from '@/components/OrdenesCompra';`
2. Ampliar el tipo: `type SectionId = 'resumen' | 'operaciones' | 'pipeline' | 'compras' | 'ordenes';`
3. Agregar al final del array `SECTIONS`:

```tsx
  {
    id: 'ordenes',
    label: 'Órdenes de Compra',
    sub: 'Formatos OC para proveedores',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 13h6M9 17h6" />
      </svg>
    ),
  },
```

4. En `DashboardContent`, estado para el contador:

```tsx
const [ordenesCount, setOrdenesCount] = useState(0);
```

5. En `counts`: `ordenes: ordenesCount,`
6. En el render del `<main>`, junto a las otras secciones:

```tsx
{section === 'ordenes' && <OrdenesCompra onCountChange={setOrdenesCount} />}
```

- [ ] **Step 2: Run full suite**

Run: `cd dashboard && npm run test`
Expected: PASS todo (incluidos los tests existentes de page/AuthGate si los hay).

- [ ] **Step 3: Verificación manual**

1. `cd dashboard && npm run dev` (requiere `GOOGLE_SERVICE_ACCOUNT_KEY` en `.env.local` — ya configurado para el resto del dashboard).
2. Abrir `http://localhost:3000`, login, clic en "Órdenes de Compra".
3. Verificar: lista muestra P022 (y demás órdenes reales), buscador filtra.
4. Clic en P022 → comparar lado a lado contra el PDF del sheet (barra naranja, logo, cajas, tabla, condiciones, pie).
5. "Imprimir / Guardar PDF" → vista previa solo muestra la hoja OC (sin sidebar), colores presentes.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/page.tsx
git commit -m "feat(dashboard): integra sección Órdenes de Compra en el sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
