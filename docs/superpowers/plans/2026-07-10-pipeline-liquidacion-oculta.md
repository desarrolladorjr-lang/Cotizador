# Pipeline — Ocultar tarjetas liquidadas (CxP/CxC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ocultar automáticamente del kanban/tabla del Pipeline cualquier tarjeta en etapa `cxp` (compras) o `cxc` (ventas) cuyo contrato ya no tenga saldo pendiente en la hoja separada EXPORTACIONES 2026 (módulo `/api/cxc-cxp`).

**Architecture:** `/api/feed` ya cruza Feed+Pipeline (`attachPipeline`). Se agrega un tercer cruce de solo lectura contra la hoja EXPORTACIONES: se construye, por segmento (MARITIMOS/TERRESTRES), un `ContractStatus` (sets de contratos "vistos" y "pendientes" para CxC y CxP), se combinan ambos segmentos, y se filtra la lista final con una función pura `estaLiquidado(record, status)`. Nada se escribe en ninguna hoja.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest.

## Global Constraints

- Solo afecta tarjetas con `track === 'compras' && etapa === 'cxp'` o `track === 'ventas' && etapa === 'cxc'`. Cualquier otra etapa nunca se oculta.
- No se modifica ninguna hoja de Google Sheets (Pipeline ni EXPORTACIONES) — es un filtro de lectura en `/api/feed`.
- Comparación de contrato: `contrato.trim().toLowerCase()` en ambos lados (Pipeline y EXPORTACIONES) para evitar falsos negativos por espacios/mayúsculas.
- Si la hoja EXPORTACIONES falla al leerse, no se filtra nada — todas las tarjetas quedan visibles (degradación segura, mismo patrón que el resto de `/api/feed`).
- Si el contrato de una tarjeta nunca aparece en la hoja EXPORTACIONES (ni pagado ni pendiente), la tarjeta se queda visible — ausencia de dato no es igual a "ya pagado".

---

### Task 1: Exponer columna `contract` en el schema CXP

**Files:**
- Modify: `dashboard/src/lib/cxcCxpSchema.ts`
- Test: `dashboard/src/lib/cxcCxpSchema.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `CxpFieldIndex.contract: number` (índice 3 en ambos segmentos — misma columna física que `CXC_SCHEMA[segmento].contract`, la fila de EXPORTACIONES trae ambos lados del contrato).

- [ ] **Step 1: Escribir test que falla**

Agregar al final de `dashboard/src/lib/cxcCxpSchema.test.ts` (dentro del `describe('CXC_SCHEMA / CXP_SCHEMA', ...)` existente, después del último `it`):

```ts
  it('CXP contract usa misma columna que CXC (índice 3) en ambos segmentos', () => {
    expect(CXP_SCHEMA.maritimo.contract).toBe(3);
    expect(CXP_SCHEMA.terrestre.contract).toBe(3);
  });
```

- [ ] **Step 2: Correr test y confirmar que falla**

Run: `cd dashboard && npx vitest run src/lib/cxcCxpSchema.test.ts`
Expected: FAIL — `Property 'contract' does not exist on type 'CxpFieldIndex'` (error de TypeScript) o `undefined` no es `3`.

- [ ] **Step 3: Implementación mínima**

En `dashboard/src/lib/cxcCxpSchema.ts`, modificar la interfaz y las dos entradas de `CXP_SCHEMA`:

```ts
export interface CxpFieldIndex {
  client: number;
  contract: number;
  material: number;
  origin: number;
  supplier: number;
  invSup: number;
  date: number;
  kgSup: number;
  pct: number;
  dlr: number;
  priceSup: number;
  amountSup: number;
  toCash: number;
  paymntDate: number;
  disctToSup: number; // -1 si la hoja no tiene esta columna (usa `deducted` en su lugar)
  deducted: number; // -1 si la hoja no tiene esta columna (usa `disctToSup` en su lugar)
  gprofit: number;
}
```

```ts
export const CXP_SCHEMA: Record<Segmento, CxpFieldIndex> = {
  maritimo: {
    client: 0, contract: 3, material: 4,
    origin: 40, supplier: 41, invSup: 42, date: 43, kgSup: 44, pct: 45, dlr: 46,
    priceSup: 47, amountSup: 48, toCash: 49, paymntDate: 51, disctToSup: -1, deducted: 50, gprofit: 52,
  },
  terrestre: {
    client: 0, contract: 3, material: 4,
    origin: 36, supplier: 37, invSup: 38, date: 39, kgSup: 40, pct: 41, dlr: 42,
    priceSup: 43, amountSup: 44, toCash: 45, paymntDate: 46, disctToSup: 47, deducted: -1, gprofit: 48,
  },
};
```

- [ ] **Step 4: Correr test y confirmar que pasa**

Run: `cd dashboard && npx vitest run src/lib/cxcCxpSchema.test.ts`
Expected: PASS (todos los tests del archivo, incluido el nuevo)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/cxcCxpSchema.ts dashboard/src/lib/cxcCxpSchema.test.ts
git commit -m "feat(cxc-cxp): expone columna contract en schema CXP"
```

---

### Task 2: Exponer `contract` en `CxpRow`

**Files:**
- Modify: `dashboard/src/lib/normalizeCxcCxp.ts`
- Test: `dashboard/src/lib/normalizeCxcCxp.test.ts`

**Interfaces:**
- Consumes: `CXP_SCHEMA[segmento].contract` (Task 1).
- Produces: `CxpRow.contract: string` — cada fila de `CxpTable.grupos[].rows[]` trae su contrato.

- [ ] **Step 1: Escribir test que falla**

En `dashboard/src/lib/normalizeCxcCxp.test.ts`, modificar la fixture `filaCxpTerrestre` (línea ~82) para aceptar `contract` y setear `row[3]`:

```ts
function filaCxpTerrestre(over: Partial<{
  client: string; contract: string; material: string; origin: string; supplier: string; invSup: string;
  date: string; amountSup: string; toCash: string; disctToSup: string;
}> = {}): string[] {
  const row = new Array(49).fill('');
  row[0] = over.client ?? 'INVENTARIO';
  row[3] = over.contract ?? '';
  row[4] = over.material ?? 'BARE 5052';
  row[36] = over.origin ?? 'LAREDO J&G/DIEGO';
  row[37] = over.supplier ?? 'LAMH';
  row[38] = over.invSup ?? '1266';
  row[39] = over.date ?? '10/2/2026';
  row[44] = over.amountSup ?? '$42,078.60';
  row[45] = over.toCash ?? '';
  row[47] = over.disctToSup ?? '';
  return row;
}
```

Agregar al final del `describe('buildCxpTable', ...)` existente:

```ts
  it('expone contract (misma columna que CXC) en cada fila CXP', () => {
    const rows = [[], [], filaCxpTerrestre({ contract: '81628' })];
    const { grupos } = buildCxpTable(rows, 'terrestre');
    expect(grupos[0].rows[0].contract).toBe('81628');
  });
```

- [ ] **Step 2: Correr test y confirmar que falla**

Run: `cd dashboard && npx vitest run src/lib/normalizeCxcCxp.test.ts`
Expected: FAIL — `expected undefined to be '81628'`

- [ ] **Step 3: Implementación mínima**

En `dashboard/src/lib/normalizeCxcCxp.ts`, agregar `contract` a la interfaz `CxpRow` (después de `cliente`):

```ts
export interface CxpRow {
  cliente: string;
  contract: string;
  material: string;
  origin: string;
  supplier: string;
  invSup: string;
  date: string;
  kgSup: number;
  pct: string;
  dlr: string;
  priceSup: number;
  amountSup: number;
  toCash: number;
  paymntDate: string;
  disctToSup: number | null;
  gprofit: number;
  saldoPendiente: number;
}
```

Y en `buildCxpTable`, agregar la línea al construir `cxpRow` (junto a `cliente:`):

```ts
    const cxpRow: CxpRow = {
      cliente: getCell(row, schema.client),
      contract: getCell(row, schema.contract),
      material: getCell(row, schema.material),
```

- [ ] **Step 4: Correr test y confirmar que pasa**

Run: `cd dashboard && npx vitest run src/lib/normalizeCxcCxp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/normalizeCxcCxp.ts dashboard/src/lib/normalizeCxcCxp.test.ts
git commit -m "feat(cxc-cxp): expone contract en CxpRow"
```

---

### Task 3: `buildContractStatus` — sets de contratos vistos/pendientes por segmento

**Files:**
- Modify: `dashboard/src/lib/normalizeCxcCxp.ts`
- Test: `dashboard/src/lib/normalizeCxcCxp.test.ts`

**Interfaces:**
- Consumes: `CXC_SCHEMA`, `CXP_SCHEMA`, `getCell` (ya importados en el archivo), `buildCxcTable`, `buildCxpTable` (mismo archivo).
- Produces:
  - `normContract(s: string): string` — normaliza `trim().toLowerCase()`.
  - `interface ContractStatus { vistosCxc: Set<string>; pendientesCxc: Set<string>; vistosCxp: Set<string>; pendientesCxp: Set<string>; }`
  - `buildContractStatus(rows: string[][], segmento: Segmento): ContractStatus`

- [ ] **Step 1: Escribir tests que fallan**

Agregar al final de `dashboard/src/lib/normalizeCxcCxp.test.ts`:

```ts
import { buildContractStatus } from './normalizeCxcCxp';

describe('buildContractStatus', () => {
  it('contrato con saldo pendiente cae en pendientesCxc y vistosCxc', () => {
    const rows = [[], [], filaTerrestre({ contract: '81628', invoice: 'INV1', ar: '$100.00' })];
    const status = buildContractStatus(rows, 'terrestre');
    expect(status.vistosCxc.has('81628')).toBe(true);
    expect(status.pendientesCxc.has('81628')).toBe(true);
  });

  it('contrato con saldo en cero: visto pero no pendiente (liquidado)', () => {
    const rows = [[], [], filaTerrestre({ contract: '81628', invoice: 'INV1', ar: '$0.00' })];
    const status = buildContractStatus(rows, 'terrestre');
    expect(status.vistosCxc.has('81628')).toBe(true);
    expect(status.pendientesCxc.has('81628')).toBe(false);
  });

  it('contrato ausente de la hoja: ni visto ni pendiente', () => {
    const rows = [[], [], filaTerrestre({ contract: '81628' })];
    const status = buildContractStatus(rows, 'terrestre');
    expect(status.vistosCxc.has('otro-contrato')).toBe(false);
    expect(status.pendientesCxc.has('otro-contrato')).toBe(false);
  });

  it('normaliza espacios/mayúsculas al comparar', () => {
    const rows = [[], [], filaTerrestre({ contract: '  ABC123  ', invoice: 'INV1', ar: '$0.00' })];
    const status = buildContractStatus(rows, 'terrestre');
    expect(status.vistosCxc.has('abc123')).toBe(true);
  });

  it('cxp: contrato con saldo cubierto (amountSup===toCash): visto pero no pendiente', () => {
    const rows = [[], [], filaCxpTerrestre({ contract: '81628', invSup: '1266', amountSup: '$100.00', toCash: '$100.00' })];
    const status = buildContractStatus(rows, 'terrestre');
    expect(status.vistosCxp.has('81628')).toBe(true);
    expect(status.pendientesCxp.has('81628')).toBe(false);
  });

  it('cxp: contrato con saldo pendiente: visto y pendiente', () => {
    const rows = [[], [], filaCxpTerrestre({ contract: '81628', invSup: '1266', amountSup: '$100.00', toCash: '' })];
    const status = buildContractStatus(rows, 'terrestre');
    expect(status.vistosCxp.has('81628')).toBe(true);
    expect(status.pendientesCxp.has('81628')).toBe(true);
  });
});
```

- [ ] **Step 2: Correr test y confirmar que falla**

Run: `cd dashboard && npx vitest run src/lib/normalizeCxcCxp.test.ts`
Expected: FAIL — `buildContractStatus is not a function` / import error.

- [ ] **Step 3: Implementación mínima**

En `dashboard/src/lib/normalizeCxcCxp.ts`, agregar al final del archivo:

```ts
export function normContract(s: string): string {
  return s.trim().toLowerCase();
}

export interface ContractStatus {
  vistosCxc: Set<string>;
  pendientesCxc: Set<string>;
  vistosCxp: Set<string>;
  pendientesCxp: Set<string>;
}

export function buildContractStatus(rows: string[][], segmento: Segmento): ContractStatus {
  const cxcSchema = CXC_SCHEMA[segmento];
  const cxpSchema = CXP_SCHEMA[segmento];
  const dataRows = rows.slice(DATA_START_ROW);

  const vistosCxc = new Set<string>();
  const vistosCxp = new Set<string>();

  for (const row of dataRows) {
    if (!row) continue;
    const contract = normContract(getCell(row, cxcSchema.contract));
    if (!contract) continue;
    if (getCell(row, cxcSchema.invoice)) vistosCxc.add(contract);
    if (getCell(row, cxpSchema.invSup)) vistosCxp.add(contract);
  }

  const pendientesCxc = new Set(
    buildCxcTable(rows, segmento).grupos.flatMap((g) => g.rows.map((r) => normContract(r.contract))),
  );
  const pendientesCxp = new Set(
    buildCxpTable(rows, segmento).grupos.flatMap((g) => g.rows.map((r) => normContract(r.contract))),
  );

  return { vistosCxc, pendientesCxc, vistosCxp, pendientesCxp };
}
```

- [ ] **Step 4: Correr test y confirmar que pasa**

Run: `cd dashboard && npx vitest run src/lib/normalizeCxcCxp.test.ts`
Expected: PASS (todos los tests del archivo)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/normalizeCxcCxp.ts dashboard/src/lib/normalizeCxcCxp.test.ts
git commit -m "feat(cxc-cxp): agrega buildContractStatus (contratos vistos/pendientes)"
```

---

### Task 4: `pipelineLiquidacion.ts` — regla de decisión y combinación de segmentos

**Files:**
- Create: `dashboard/src/lib/pipelineLiquidacion.ts`
- Test: `dashboard/src/lib/pipelineLiquidacion.test.ts`

**Interfaces:**
- Consumes: `normContract`, `type ContractStatus` (Task 3, de `./normalizeCxcCxp`); `type PipelineRecord` (de `./pipelineSchema`).
- Produces:
  - `combineContractStatus(a: ContractStatus, b: ContractStatus): ContractStatus`
  - `estaLiquidado(record: PipelineRecord | null | undefined, status: ContractStatus): boolean`

- [ ] **Step 1: Escribir test que falla**

Crear `dashboard/src/lib/pipelineLiquidacion.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { combineContractStatus, estaLiquidado } from './pipelineLiquidacion';
import type { ContractStatus } from './normalizeCxcCxp';
import type { PipelineRecord } from './pipelineSchema';

function status(over: Partial<ContractStatus> = {}): ContractStatus {
  return {
    vistosCxc: new Set(),
    pendientesCxc: new Set(),
    vistosCxp: new Set(),
    pendientesCxp: new Set(),
    ...over,
  };
}

function record(over: Partial<PipelineRecord> = {}): PipelineRecord {
  return {
    opId: 'Compras:2', contrato: '81628', track: 'compras', etapa: 'cxp', estatusEtapa: '',
    noPO: '', noSDL: '', noEntrada: '', estatusPago: '', mesCierre: '', notas: '',
    ruta: '', modalidad: '', destino: '', recolecciones: '',
    cargasHecho: '', cargasNum: '', cargasPor: '', cargasFecha: '',
    entradaHecho: '', entradaPor: '', entradaFecha: '',
    ticketEmpaqueHecho: '', ticketEmpaqueNota: '', ticketEmpaquePor: '', ticketEmpaqueFecha: '',
    editadoPor: '', editadoFecha: '', rowIndex: 2,
    ...over,
  };
}

describe('estaLiquidado', () => {
  it('compras/cxp con contrato pendiente: false', () => {
    const s = status({ vistosCxp: new Set(['81628']), pendientesCxp: new Set(['81628']) });
    expect(estaLiquidado(record(), s)).toBe(false);
  });

  it('compras/cxp con contrato visto pero no pendiente: true (liquidado)', () => {
    const s = status({ vistosCxp: new Set(['81628']) });
    expect(estaLiquidado(record(), s)).toBe(true);
  });

  it('compras/cxp con contrato nunca visto: false (sin dato, no se puede confirmar)', () => {
    expect(estaLiquidado(record(), status())).toBe(false);
  });

  it('ventas/cxc usa los sets de cxc, no los de cxp', () => {
    const s = status({ vistosCxc: new Set(['ct-1']) });
    expect(estaLiquidado(record({ track: 'ventas', etapa: 'cxc', contrato: 'CT-1' }), s)).toBe(true);
  });

  it('etapa fuera de cxp/cxc nunca se oculta, aunque el contrato esté liquidado', () => {
    const s = status({ vistosCxp: new Set(['81628']) });
    expect(estaLiquidado(record({ etapa: 'ingreso' }), s)).toBe(false);
  });

  it('record null: false', () => {
    expect(estaLiquidado(null, status())).toBe(false);
  });

  it('contrato vacío: false', () => {
    expect(estaLiquidado(record({ contrato: '' }), status())).toBe(false);
  });
});

describe('combineContractStatus', () => {
  it('une los sets de dos segmentos', () => {
    const a = status({ vistosCxp: new Set(['a']) });
    const b = status({ vistosCxp: new Set(['b']) });
    const combined = combineContractStatus(a, b);
    expect(combined.vistosCxp).toEqual(new Set(['a', 'b']));
  });
});
```

- [ ] **Step 2: Correr test y confirmar que falla**

Run: `cd dashboard && npx vitest run src/lib/pipelineLiquidacion.test.ts`
Expected: FAIL — no se puede resolver el módulo `./pipelineLiquidacion` (no existe todavía).

- [ ] **Step 3: Implementación mínima**

Crear `dashboard/src/lib/pipelineLiquidacion.ts`:

```ts
import type { PipelineRecord } from './pipelineSchema';
import { normContract, type ContractStatus } from './normalizeCxcCxp';

export function combineContractStatus(a: ContractStatus, b: ContractStatus): ContractStatus {
  return {
    vistosCxc: new Set([...a.vistosCxc, ...b.vistosCxc]),
    pendientesCxc: new Set([...a.pendientesCxc, ...b.pendientesCxc]),
    vistosCxp: new Set([...a.vistosCxp, ...b.vistosCxp]),
    pendientesCxp: new Set([...a.pendientesCxp, ...b.pendientesCxp]),
  };
}

export function estaLiquidado(record: PipelineRecord | null | undefined, status: ContractStatus): boolean {
  if (!record) return false;
  const contrato = normContract(record.contrato);
  if (!contrato) return false;
  if (record.track === 'compras' && record.etapa === 'cxp') {
    return status.vistosCxp.has(contrato) && !status.pendientesCxp.has(contrato);
  }
  if (record.track === 'ventas' && record.etapa === 'cxc') {
    return status.vistosCxc.has(contrato) && !status.pendientesCxc.has(contrato);
  }
  return false;
}
```

- [ ] **Step 4: Correr test y confirmar que pasa**

Run: `cd dashboard && npx vitest run src/lib/pipelineLiquidacion.test.ts`
Expected: PASS (los 8 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/pipelineLiquidacion.ts dashboard/src/lib/pipelineLiquidacion.test.ts
git commit -m "feat(pipeline): agrega estaLiquidado/combineContractStatus"
```

---

### Task 5: Wire — filtrar tarjetas liquidadas en `/api/feed`

**Files:**
- Modify: `dashboard/src/app/api/feed/route.ts`
- Test: `dashboard/src/app/api/feed/route.test.ts`

**Interfaces:**
- Consumes: `fetchAllCxcCxpSheets` (de `@/lib/cxcCxpClient`, ya existe); `buildContractStatus`, `type ContractStatus` (Task 3); `combineContractStatus`, `estaLiquidado` (Task 4).
- Produces: `/api/feed` responde sin las filas liquidadas (mismo shape de respuesta que hoy, solo con menos `rows`).

- [ ] **Step 1: Escribir tests que fallan**

En `dashboard/src/app/api/feed/route.test.ts`, agregar el mock de `cxcCxpClient` junto a los mocks existentes (arriba del `describe`):

```ts
vi.mock('@/lib/cxcCxpClient', () => ({
  fetchAllCxcCxpSheets: vi.fn().mockResolvedValue([
    { sheetName: 'MARITIMOS', rows: [[], []] },
    { sheetName: 'TERRESTRES', rows: [[], []] },
  ]),
}));
```

Agregar estos dos tests dentro del `describe('GET /api/feed', ...)`, después del último `it` existente:

```ts
  it('oculta fila en etapa cxp cuando el contrato ya no tiene saldo pendiente en EXPORTACIONES', async () => {
    const compraRow = new Array(6).fill('');
    compraRow[0] = '2026-06-19'; compraRow[2] = 'Prov1'; compraRow[4] = 'Maiz';
    (fetchAllSheets as any).mockResolvedValue([
      { sheetName: 'Compras', rows: [['h'], compraRow] },
    ]);

    const { fetchPipeline } = await import('@/lib/pipelineClient');
    const record = {
      opId: 'Compras:2', contrato: '81628', track: 'compras', etapa: 'cxp', estatusEtapa: '',
      noPO: '', noSDL: '', noEntrada: '', estatusPago: '', mesCierre: '', notas: '',
      ruta: '', modalidad: '', destino: '', recolecciones: '',
      cargasHecho: '', cargasNum: '', cargasPor: '', cargasFecha: '',
      entradaHecho: '', entradaPor: '', entradaFecha: '',
      ticketEmpaqueHecho: '', ticketEmpaqueNota: '', ticketEmpaquePor: '', ticketEmpaqueFecha: '',
      editadoPor: '', editadoFecha: '', rowIndex: 2,
    };
    (fetchPipeline as any).mockResolvedValue(new Map([['Compras:2', record]]));

    // fila terrestre CXP: contract col3, invSup col38, amountSup col44, toCash col45 (iguales → liquidado)
    const cxpRow = new Array(46).fill('');
    cxpRow[3] = '81628'; cxpRow[38] = 'SUPINV1'; cxpRow[44] = '$100.00'; cxpRow[45] = '$100.00';
    const { fetchAllCxcCxpSheets } = await import('@/lib/cxcCxpClient');
    (fetchAllCxcCxpSheets as any).mockResolvedValue([
      { sheetName: 'MARITIMOS', rows: [[], []] },
      { sheetName: 'TERRESTRES', rows: [[], [], cxpRow] },
    ]);

    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.json();
    expect(body.rows.find((r: any) => r.opId === 'Compras:2')).toBeUndefined();
  });

  it('si fetchAllCxcCxpSheets falla, no filtra nada (todas las tarjetas visibles)', async () => {
    const compraRow = new Array(6).fill('');
    compraRow[0] = '2026-06-19'; compraRow[2] = 'Prov1'; compraRow[4] = 'Maiz';
    (fetchAllSheets as any).mockResolvedValue([
      { sheetName: 'Compras', rows: [['h'], compraRow] },
    ]);

    const { fetchPipeline } = await import('@/lib/pipelineClient');
    const record = {
      opId: 'Compras:2', contrato: '81628', track: 'compras', etapa: 'cxp', estatusEtapa: '',
      noPO: '', noSDL: '', noEntrada: '', estatusPago: '', mesCierre: '', notas: '',
      ruta: '', modalidad: '', destino: '', recolecciones: '',
      cargasHecho: '', cargasNum: '', cargasPor: '', cargasFecha: '',
      entradaHecho: '', entradaPor: '', entradaFecha: '',
      ticketEmpaqueHecho: '', ticketEmpaqueNota: '', ticketEmpaquePor: '', ticketEmpaqueFecha: '',
      editadoPor: '', editadoFecha: '', rowIndex: 2,
    };
    (fetchPipeline as any).mockResolvedValue(new Map([['Compras:2', record]]));

    const { fetchAllCxcCxpSheets } = await import('@/lib/cxcCxpClient');
    (fetchAllCxcCxpSheets as any).mockRejectedValue(new Error('down'));

    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.json();
    expect(body.rows.find((r: any) => r.opId === 'Compras:2')).toBeDefined();
  });
```

- [ ] **Step 2: Correr test y confirmar que falla**

Run: `cd dashboard && npx vitest run src/app/api/feed/route.test.ts`
Expected: FAIL en el primer test nuevo (`toBeUndefined()` recibe la fila — todavía no se filtra nada).

- [ ] **Step 3: Implementación mínima**

En `dashboard/src/app/api/feed/route.ts`, agregar imports (junto a los existentes):

```ts
import { fetchAllCxcCxpSheets } from '@/lib/cxcCxpClient';
import { buildContractStatus, type ContractStatus } from '@/lib/normalizeCxcCxp';
import { combineContractStatus, estaLiquidado } from '@/lib/pipelineLiquidacion';
```

Agregar constante a nivel de módulo (junto a `const VENTAS_TIPOS = ...` dentro de `GET`, o antes de `GET`, mismo nivel que `cache`):

```ts
const EMPTY_CONTRACT_STATUS: ContractStatus = {
  vistosCxc: new Set(),
  pendientesCxc: new Set(),
  vistosCxp: new Set(),
  pendientesCxp: new Set(),
};
```

Reemplazar la línea final del bloque `try` (la que arma `joined`):

```ts
    const joined: NormalizeResult = { rows: attachPipeline(normalized.rows, records), errors: normalized.errors };
```

por:

```ts
    let contractStatus = EMPTY_CONTRACT_STATUS;
    try {
      const cxcCxpResults = await fetchAllCxcCxpSheets(api);
      contractStatus = cxcCxpResults.reduce((acc, r) => {
        if (!r.rows) return acc;
        const segmento = r.sheetName === 'MARITIMOS' ? 'maritimo' : 'terrestre';
        return combineContractStatus(acc, buildContractStatus(r.rows, segmento));
      }, EMPTY_CONTRACT_STATUS);
    } catch {
      // Hoja EXPORTACIONES no disponible — no se filtra nada, todas las tarjetas quedan visibles.
    }

    const attached = attachPipeline(normalized.rows, records).filter(
      (r) => !estaLiquidado(r.pipeline, contractStatus),
    );
    const joined: NormalizeResult = { rows: attached, errors: normalized.errors };
```

- [ ] **Step 4: Correr test y confirmar que pasa**

Run: `cd dashboard && npx vitest run src/app/api/feed/route.test.ts`
Expected: PASS (todos los tests del archivo, incluidos los preexistentes)

- [ ] **Step 5: Correr la suite completa del dashboard**

Run: `cd dashboard && npx vitest run`
Expected: PASS — ningún test roto en el resto del proyecto.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/api/feed/route.ts dashboard/src/app/api/feed/route.test.ts
git commit -m "feat(pipeline): oculta tarjetas cxp/cxc ya liquidadas en /api/feed"
```

---

## Self-Review Notes

- **Cobertura de spec:** regla de decisión (Task 3+4), scope solo cxp/cxc (Task 4), normalización trim/lowercase (Task 3+4), degradación si falla la hoja (Task 5), exponer `contract` en CxpRow (Task 2), columna schema (Task 1), wiring en `/api/feed` (Task 5). Todo cubierto.
- **Tipos consistentes:** `ContractStatus` definido una vez en `normalizeCxcCxp.ts` (Task 3), reusado sin redefinir en `pipelineLiquidacion.ts` y en `route.ts` — mismo nombre y forma en los tres archivos.
- **Fuera de alcance (de la spec):** no se toca `estatusPago`, no hay botón "volver a mostrar", no se modifica `/api/cxc-cxp` más allá de exponer `contract` en `CxpRow` (cambio de solo-aditivo, no rompe consumidores existentes de ese endpoint).
