# Pipeline — Ruteo logístico y visibilidad por trabajo (Pieza A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender el track Compras del Pipeline del dashboard con ruteo logístico (ruta/modalidad/destino/recolecciones) y trabajos marcables (cargas/entrada/ticket+empaque) con dato + quién/cuándo, más filtros pull por trabajo en el board.

**Architecture:** Se agregan 15 columnas planas a la hoja `Pipeline` y a `PipelineRecord`. La captura ocurre en `OpDrawer` (dos bloques nuevos), el estampado de quién/cuándo se hace server-side en la ruta `PATCH /api/pipeline/[opId]`, y la visibilidad por trabajo son filtros front en `PipelineBoard`. La máquina de etapas no cambia.

**Tech Stack:** Next.js 14 (App Router), TypeScript, googleapis (Google Sheets), Vitest + @testing-library/react.

## Global Constraints

- Solo afecta el track **Compras**; Ventas no se toca.
- No tocar Cotizador (`Codigo.gs`, `deploy/`).
- La máquina `instruccion→oc_enviada→recoleccion→ingreso→cxp` no cambia.
- `*Hecho` se persiste como `'Sí'` (marcado) o `''` (no). `*Por` = email del JWT verificado. `*Fecha` = `new Date().toISOString()`.
- Estampado de `*Por`/`*Fecha` es **server-side**; ignorar cualquier `*Por`/`*Fecha` que mande el cliente.
- Tests corren con `npm test` (`vitest run`) desde `dashboard/`.
- Commits frecuentes, uno por tarea.

## Orden de columnas en la hoja `Pipeline` (referencia)

| # | Col | key | # | Col | key |
|---|-----|-----|---|-----|-----|
| 1 | A | opId | 15 | O | recolecciones |
| 2 | B | contrato | 16 | P | cargasHecho |
| 3 | C | track | 17 | Q | cargasNum |
| 4 | D | etapa | 18 | R | cargasPor |
| 5 | E | estatusEtapa | 19 | S | cargasFecha |
| 6 | F | noPO | 20 | T | entradaHecho |
| 7 | G | noSDL | 21 | U | entradaPor |
| 8 | H | noEntrada | 22 | V | entradaFecha |
| 9 | I | estatusPago | 23 | W | ticketEmpaqueHecho |
| 10 | J | mesCierre | 24 | X | ticketEmpaqueNota |
| 11 | K | notas | 25 | Y | ticketEmpaquePor |
| 12 | L | ruta | 26 | Z | ticketEmpaqueFecha |
| 13 | M | modalidad | 27 | AA | editadoPor |
| 14 | N | destino | 28 | AB | editadoFecha |

`editadoPor`/`editadoFecha` se mueven al final (antes estaban en L/M). **Paso manual previo a desplegar:** reordenar/insertar encabezados en la hoja real para que coincidan con esta tabla.

---

### Task 1: Schema + client — nuevas columnas en lectura/escritura

**Files:**
- Modify: `dashboard/src/lib/pipelineSchema.ts`
- Modify: `dashboard/src/lib/pipelineClient.ts`
- Test: `dashboard/src/lib/pipelineSchema.test.ts`
- Test: `dashboard/src/lib/pipelineClient.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `PIPELINE_SCHEMA: PipelineField[]` con 28 entradas en el orden de la tabla de arriba.
  - `PipelineRecord` con campos nuevos: `ruta: string`, `modalidad: string`, `destino: string`, `recolecciones: string`, `cargasHecho: string`, `cargasNum: string`, `cargasPor: string`, `cargasFecha: string`, `entradaHecho: string`, `entradaPor: string`, `entradaFecha: string`, `ticketEmpaqueHecho: string`, `ticketEmpaqueNota: string`, `ticketEmpaquePor: string`, `ticketEmpaqueFecha: string`.
  - `recordToValues(record): string[]` devuelve 28 strings en orden de schema (sin cambios de firma).
  - `parsePipelineRows(rows): Map<string, PipelineRecord>` lee las 28 columnas.

- [ ] **Step 1: Escribir el test que falla (schema)**

En `dashboard/src/lib/pipelineSchema.test.ts`, agregar:

```ts
import { describe, it, expect } from 'vitest';
import { PIPELINE_SCHEMA, recordToValues, type PipelineRecord } from './pipelineSchema';

describe('PIPELINE_SCHEMA con ruteo y trabajos', () => {
  it('tiene 28 columnas, audit al final', () => {
    expect(PIPELINE_SCHEMA.length).toBe(28);
    expect(PIPELINE_SCHEMA[27].key).toBe('editadoFecha');
    expect(PIPELINE_SCHEMA[26].key).toBe('editadoPor');
    expect(PIPELINE_SCHEMA.map((f) => f.key)).toContain('ruta');
    expect(PIPELINE_SCHEMA.map((f) => f.key)).toContain('ticketEmpaqueFecha');
  });

  it('recordToValues serializa los 28 campos en orden', () => {
    const rec = {
      opId: 'Compras:5', contrato: 'C1', track: 'compras', etapa: 'ingreso',
      estatusEtapa: '', noPO: '', noSDL: '', noEntrada: 'E9', estatusPago: '',
      mesCierre: '', notas: '', ruta: 'bodega', modalidad: 'export_terrestre',
      destino: 'otro', recolecciones: '2', cargasHecho: 'Sí', cargasNum: '4',
      cargasPor: 'a@b.c', cargasFecha: '2026-06-29T00:00:00.000Z',
      entradaHecho: '', entradaPor: '', entradaFecha: '',
      ticketEmpaqueHecho: '', ticketEmpaqueNota: '', ticketEmpaquePor: '',
      ticketEmpaqueFecha: '', editadoPor: 'a@b.c',
      editadoFecha: '2026-06-29T00:00:00.000Z', rowIndex: 7,
    } as PipelineRecord;
    const vals = recordToValues(rec);
    expect(vals.length).toBe(28);
    expect(vals[11]).toBe('bodega');      // L = ruta
    expect(vals[15]).toBe('Sí');          // P = cargasHecho
    expect(vals[27]).toBe('2026-06-29T00:00:00.000Z'); // AB = editadoFecha
  });
});
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd dashboard && npx vitest run src/lib/pipelineSchema.test.ts`
Expected: FAIL (length es 13, no 28).

- [ ] **Step 3: Actualizar `pipelineSchema.ts`**

Reemplazar `PIPELINE_SCHEMA` y `PipelineRecord` para incluir los campos nuevos en el orden de la tabla. `PIPELINE_SCHEMA`:

```ts
export const PIPELINE_SCHEMA: PipelineField[] = [
  { key: 'opId', label: 'opId', index: 0 },
  { key: 'contrato', label: 'Contrato', index: 1 },
  { key: 'track', label: 'Track', index: 2 },
  { key: 'etapa', label: 'Etapa', index: 3 },
  { key: 'estatusEtapa', label: 'Estatus Etapa', index: 4 },
  { key: 'noPO', label: 'No PO', index: 5 },
  { key: 'noSDL', label: 'No SDL', index: 6 },
  { key: 'noEntrada', label: 'No Entrada', index: 7 },
  { key: 'estatusPago', label: 'Estatus Pago', index: 8 },
  { key: 'mesCierre', label: 'Mes Cierre', index: 9 },
  { key: 'notas', label: 'Notas', index: 10 },
  { key: 'ruta', label: 'Ruta', index: 11 },
  { key: 'modalidad', label: 'Modalidad', index: 12 },
  { key: 'destino', label: 'Destino', index: 13 },
  { key: 'recolecciones', label: 'Recolecciones', index: 14 },
  { key: 'cargasHecho', label: 'Cargas Hecho', index: 15 },
  { key: 'cargasNum', label: 'Cargas Num', index: 16 },
  { key: 'cargasPor', label: 'Cargas Por', index: 17 },
  { key: 'cargasFecha', label: 'Cargas Fecha', index: 18 },
  { key: 'entradaHecho', label: 'Entrada Hecho', index: 19 },
  { key: 'entradaPor', label: 'Entrada Por', index: 20 },
  { key: 'entradaFecha', label: 'Entrada Fecha', index: 21 },
  { key: 'ticketEmpaqueHecho', label: 'Ticket Empaque Hecho', index: 22 },
  { key: 'ticketEmpaqueNota', label: 'Ticket Empaque Nota', index: 23 },
  { key: 'ticketEmpaquePor', label: 'Ticket Empaque Por', index: 24 },
  { key: 'ticketEmpaqueFecha', label: 'Ticket Empaque Fecha', index: 25 },
  { key: 'editadoPor', label: 'Editado Por', index: 26 },
  { key: 'editadoFecha', label: 'Editado Fecha', index: 27 },
];
```

Y `PipelineRecord` (agregar los 15 campos nuevos como `string`, entre `notas` y `editadoPor`):

```ts
export interface PipelineRecord {
  opId: string;
  contrato: string;
  track: Track;
  etapa: Etapa;
  estatusEtapa: string;
  noPO: string;
  noSDL: string;
  noEntrada: string;
  estatusPago: string;
  mesCierre: string;
  notas: string;
  ruta: string;
  modalidad: string;
  destino: string;
  recolecciones: string;
  cargasHecho: string;
  cargasNum: string;
  cargasPor: string;
  cargasFecha: string;
  entradaHecho: string;
  entradaPor: string;
  entradaFecha: string;
  ticketEmpaqueHecho: string;
  ticketEmpaqueNota: string;
  ticketEmpaquePor: string;
  ticketEmpaqueFecha: string;
  editadoPor: string;
  editadoFecha: string;
  rowIndex: number;
}
```

`recordToValues` no cambia (deriva de `PIPELINE_SCHEMA`).

- [ ] **Step 4: Correr el test del schema, verificar que pasa**

Run: `cd dashboard && npx vitest run src/lib/pipelineSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir el test que falla (client parse)**

En `dashboard/src/lib/pipelineClient.test.ts`, agregar:

```ts
import { parsePipelineRows } from './pipelineClient';

describe('parsePipelineRows con columnas de ruteo', () => {
  it('lee ruta, trabajos y audit al final', () => {
    const header = new Array(28).fill('h');
    const row = [
      'Compras:5', 'C1', 'compras', 'ingreso', '', '', '', 'E9', '', '', '',
      'bodega', 'export_terrestre', 'otro', '2',
      'Sí', '4', 'a@b.c', '2026-06-29T00:00:00.000Z',
      '', '', '', '', '', '', '',
      'a@b.c', '2026-06-29T00:00:00.000Z',
    ];
    const map = parsePipelineRows([header, row]);
    const rec = map.get('Compras:5')!;
    expect(rec.ruta).toBe('bodega');
    expect(rec.cargasHecho).toBe('Sí');
    expect(rec.cargasNum).toBe('4');
    expect(rec.editadoFecha).toBe('2026-06-29T00:00:00.000Z');
    expect(rec.rowIndex).toBe(2);
  });
});
```

- [ ] **Step 6: Correr el test del client, verificar que falla**

Run: `cd dashboard && npx vitest run src/lib/pipelineClient.test.ts`
Expected: FAIL (`rec.ruta` undefined; editadoFecha lee índice viejo).

- [ ] **Step 7: Actualizar `pipelineClient.ts`**

Cambiar `LAST_COL`:

```ts
const LAST_COL = 'AB'; // 28 columns A..AB
```

Reemplazar el cuerpo de `map.set(...)` dentro de `parsePipelineRows`:

```ts
    map.set(r[0], {
      opId: r[0] || '',
      contrato: r[1] || '',
      track: (r[2] as Track) || 'compras',
      etapa: (r[3] as Etapa) || 'instruccion',
      estatusEtapa: r[4] || '',
      noPO: r[5] || '',
      noSDL: r[6] || '',
      noEntrada: r[7] || '',
      estatusPago: r[8] || '',
      mesCierre: r[9] || '',
      notas: r[10] || '',
      ruta: r[11] || '',
      modalidad: r[12] || '',
      destino: r[13] || '',
      recolecciones: r[14] || '',
      cargasHecho: r[15] || '',
      cargasNum: r[16] || '',
      cargasPor: r[17] || '',
      cargasFecha: r[18] || '',
      entradaHecho: r[19] || '',
      entradaPor: r[20] || '',
      entradaFecha: r[21] || '',
      ticketEmpaqueHecho: r[22] || '',
      ticketEmpaqueNota: r[23] || '',
      ticketEmpaquePor: r[24] || '',
      ticketEmpaqueFecha: r[25] || '',
      editadoPor: r[26] || '',
      editadoFecha: r[27] || '',
      rowIndex: i + 2,
    });
```

En `emptyRecord`, agregar los campos nuevos con default `''` (entre `notas` y `editadoPor`):

```ts
    notas: '',
    ruta: '',
    modalidad: '',
    destino: '',
    recolecciones: '',
    cargasHecho: '',
    cargasNum: '',
    cargasPor: '',
    cargasFecha: '',
    entradaHecho: '',
    entradaPor: '',
    entradaFecha: '',
    ticketEmpaqueHecho: '',
    ticketEmpaqueNota: '',
    ticketEmpaquePor: '',
    ticketEmpaqueFecha: '',
    editadoPor: editor,
```

En `ensurePipelineRecord`, corregir el append para no duplicar las columnas de audit (antes agregaba `editadoPor`/`editadoFecha` extra; `recordToValues` ya las incluye):

```ts
  const values = recordToValues(record);
```

- [ ] **Step 8: Correr toda la suite de lib, verificar verde**

Run: `cd dashboard && npx vitest run src/lib`
Expected: PASS (schema + client + machine existentes).

- [ ] **Step 9: Commit**

```bash
cd dashboard && git add src/lib/pipelineSchema.ts src/lib/pipelineClient.ts src/lib/pipelineSchema.test.ts src/lib/pipelineClient.test.ts
git commit -m "feat(pipeline): columnas de ruteo y trabajos en schema y client"
```

---

### Task 2: Validación de captura por trabajo

**Files:**
- Modify: `dashboard/src/lib/pipelineMachine.ts`
- Test: `dashboard/src/lib/pipelineMachine.test.ts`

**Interfaces:**
- Consumes: `PipelineRecord` (Task 1).
- Produces: `export function trabajoCapturaFaltante(current: PipelineRecord, candidate: PipelineRecord): string[]` — devuelve las keys de dato faltante cuando un `*Hecho` pasó de vacío (en `current`) a `'Sí'` (en `candidate`). Reglas: `cargasHecho`→requiere `cargasNum`; `entradaHecho`→requiere `noEntrada`; `ticketEmpaqueHecho`→sin requisito.

- [ ] **Step 1: Escribir el test que falla**

En `dashboard/src/lib/pipelineMachine.test.ts`, agregar:

```ts
import { trabajoCapturaFaltante } from './pipelineMachine';
import type { PipelineRecord } from './pipelineSchema';

function rec(p: Partial<PipelineRecord>): PipelineRecord {
  return {
    opId: 'Compras:1', contrato: '', track: 'compras', etapa: 'ingreso',
    estatusEtapa: '', noPO: '', noSDL: '', noEntrada: '', estatusPago: '',
    mesCierre: '', notas: '', ruta: '', modalidad: '', destino: '',
    recolecciones: '', cargasHecho: '', cargasNum: '', cargasPor: '',
    cargasFecha: '', entradaHecho: '', entradaPor: '', entradaFecha: '',
    ticketEmpaqueHecho: '', ticketEmpaqueNota: '', ticketEmpaquePor: '',
    ticketEmpaqueFecha: '', editadoPor: '', editadoFecha: '', rowIndex: 2,
    ...p,
  };
}

describe('trabajoCapturaFaltante', () => {
  it('exige cargasNum al marcar cargasHecho', () => {
    const out = trabajoCapturaFaltante(rec({}), rec({ cargasHecho: 'Sí' }));
    expect(out).toEqual(['cargasNum']);
  });
  it('no exige nada si cargasNum viene lleno', () => {
    const out = trabajoCapturaFaltante(rec({}), rec({ cargasHecho: 'Sí', cargasNum: '3' }));
    expect(out).toEqual([]);
  });
  it('exige noEntrada al marcar entradaHecho', () => {
    const out = trabajoCapturaFaltante(rec({}), rec({ entradaHecho: 'Sí' }));
    expect(out).toEqual(['noEntrada']);
  });
  it('ticketEmpaque no requiere dato', () => {
    const out = trabajoCapturaFaltante(rec({}), rec({ ticketEmpaqueHecho: 'Sí' }));
    expect(out).toEqual([]);
  });
  it('no exige nada si el Hecho ya estaba marcado antes', () => {
    const out = trabajoCapturaFaltante(rec({ cargasHecho: 'Sí' }), rec({ cargasHecho: 'Sí' }));
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd dashboard && npx vitest run src/lib/pipelineMachine.test.ts`
Expected: FAIL (`trabajoCapturaFaltante` no existe).

- [ ] **Step 3: Implementar `trabajoCapturaFaltante`**

Agregar al final de `dashboard/src/lib/pipelineMachine.ts`:

```ts
import type { PipelineRecord } from './pipelineSchema';

// Trabajos cuya marca "Hecho" exige capturar un dato. ticketEmpaque no exige.
const TRABAJO_REQUISITO: Record<string, string | null> = {
  cargasHecho: 'cargasNum',
  entradaHecho: 'noEntrada',
  ticketEmpaqueHecho: null,
};

// Keys de dato faltante cuando un *Hecho pasa de vacío a 'Sí'.
export function trabajoCapturaFaltante(current: PipelineRecord, candidate: PipelineRecord): string[] {
  const faltan: string[] = [];
  for (const [hechoKey, datoKey] of Object.entries(TRABAJO_REQUISITO)) {
    const antes = String((current as unknown as Record<string, unknown>)[hechoKey] ?? '').trim();
    const ahora = String((candidate as unknown as Record<string, unknown>)[hechoKey] ?? '').trim();
    const reciénMarcado = !antes && ahora === 'Sí';
    if (reciénMarcado && datoKey) {
      const dato = String((candidate as unknown as Record<string, unknown>)[datoKey] ?? '').trim();
      if (!dato) faltan.push(datoKey);
    }
  }
  return faltan;
}
```

Nota: `import type { Track, Etapa }` ya existe al inicio del archivo; agregar `PipelineRecord` a un import nuevo como se muestra (o fusionarlo al import de tipos existente).

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd dashboard && npx vitest run src/lib/pipelineMachine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add src/lib/pipelineMachine.ts src/lib/pipelineMachine.test.ts
git commit -m "feat(pipeline): validacion de captura por trabajo (trabajoCapturaFaltante)"
```

---

### Task 3: Estampado server-side + wiring en la ruta PATCH

**Files:**
- Modify: `dashboard/src/app/api/pipeline/[opId]/route.ts`
- Test: `dashboard/src/app/api/pipeline/[opId]/route.test.ts`

**Interfaces:**
- Consumes: `trabajoCapturaFaltante` (Task 2), `PipelineRecord` (Task 1).
- Produces: comportamiento HTTP: estampa `<t>Por`/`<t>Fecha` cuando `*Hecho` pasa vacío→`'Sí'`; ignora `*Por`/`*Fecha` entrantes del cliente; 422 si falta dato de trabajo; 409 conflicto; 200 éxito.

- [ ] **Step 1: Escribir el test que falla**

Revisar primero el patrón de mocking del archivo de test existente (cómo mockea `fetchPipeline`/`updatePipelineRecord`/`verifyGoogleCredential`). Agregar casos siguiendo ese patrón. Casos a cubrir:

```ts
// Asumiendo el mismo setup de mocks que los tests existentes en este archivo:
// - verifyGoogleCredential → { email: 'op@sidel.com' }
// - fetchPipeline → Map con un record current conocido
// - updatePipelineRecord → captura el `candidate` recibido

it('estampa cargasPor/cargasFecha al marcar cargasHecho', async () => {
  // current: cargasHecho '', candidate envía cargasHecho 'Sí' + cargasNum '4'
  const res = await PATCH(req({
    etapa: 'ingreso', estatusEtapa: '',
    fields: { cargasHecho: 'Sí', cargasNum: '4', cargasPor: 'HACKER', cargasFecha: 'X' },
    expectedValues: currentValues,
  }), { params: { opId: 'Compras:1' } });
  expect(res.status).toBe(200);
  const saved = updateSpy.mock.calls[0][0] as PipelineRecord;
  expect(saved.cargasPor).toBe('op@sidel.com'); // email del JWT, no 'HACKER'
  expect(saved.cargasFecha).not.toBe('X');
  expect(saved.cargasFecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

it('devuelve 422 si marca cargasHecho sin cargasNum', async () => {
  const res = await PATCH(req({
    etapa: 'ingreso', estatusEtapa: '',
    fields: { cargasHecho: 'Sí' },
    expectedValues: currentValues,
  }), { params: { opId: 'Compras:1' } });
  expect(res.status).toBe(422);
});

it('no re-estampa si cargasHecho ya estaba marcado', async () => {
  // current ya trae cargasHecho 'Sí' + cargasPor 'prev@x.com'
  const res = await PATCH(req({
    etapa: 'ingreso', estatusEtapa: '',
    fields: { notas: 'editado' },
    expectedValues: currentValuesConCargas,
  }), { params: { opId: 'Compras:1' } });
  expect(res.status).toBe(200);
  const saved = updateSpy.mock.calls[0][0] as PipelineRecord;
  expect(saved.cargasPor).toBe('prev@x.com');
});

it('guarda campos de ruteo sin avanzar etapa', async () => {
  const res = await PATCH(req({
    etapa: 'instruccion', estatusEtapa: '', // misma etapa que current
    fields: { ruta: 'bodega', modalidad: 'export_terrestre' },
    expectedValues: currentValues,
  }), { params: { opId: 'Compras:1' } });
  expect(res.status).toBe(200);
  const saved = updateSpy.mock.calls[0][0] as PipelineRecord;
  expect(saved.ruta).toBe('bodega');
});
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd dashboard && npx vitest run "src/app/api/pipeline/[opId]/route.test.ts"`
Expected: FAIL (estampado/422 de trabajo aún no implementados).

- [ ] **Step 3: Implementar el wiring en la ruta**

En `route.ts`, importar el helper y `PIPELINE_SCHEMA` no hace falta; sí `trabajoCapturaFaltante`:

```ts
import { esTransicionValida, capturaRequerida, trabajoCapturaFaltante } from '@/lib/pipelineMachine';
```

Tras construir `candidate` (que ya hace `{...current, ...fields, etapa, estatusEtapa}`), y **antes** de la validación de `capturaRequerida`, agregar: (a) limpiar `*Por`/`*Fecha` que vengan del cliente tomándolos siempre de `current`, y (b) estampar los recién marcados.

```ts
  // Audit por-trabajo: el cliente NO controla *Por/*Fecha. Parten de `current`.
  const TRABAJOS = [
    { hecho: 'cargasHecho', por: 'cargasPor', fecha: 'cargasFecha' },
    { hecho: 'entradaHecho', por: 'entradaPor', fecha: 'entradaFecha' },
    { hecho: 'ticketEmpaqueHecho', por: 'ticketEmpaquePor', fecha: 'ticketEmpaqueFecha' },
  ] as const;

  const ahora = new Date().toISOString();
  const c = candidate as unknown as Record<string, string>;
  const cur = current as unknown as Record<string, string>;
  for (const t of TRABAJOS) {
    // Siempre arrancar de los valores persistidos (ignora lo que mande el cliente).
    c[t.por] = cur[t.por] || '';
    c[t.fecha] = cur[t.fecha] || '';
    const reciénMarcado = !(cur[t.hecho] || '').trim() && (c[t.hecho] || '').trim() === 'Sí';
    if (reciénMarcado) {
      c[t.por] = verified.email;
      c[t.fecha] = ahora;
    }
  }

  const faltaTrabajo = trabajoCapturaFaltante(current, candidate);
  if (faltaTrabajo.length > 0) {
    return Response.json({ ok: false, message: `falta ${faltaTrabajo.join(', ')}` }, { status: 422 });
  }
```

La validación existente de `capturaRequerida` (etapas) se mantiene tal cual debajo.

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd dashboard && npx vitest run "src/app/api/pipeline/[opId]/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add "src/app/api/pipeline/[opId]/route.ts" "src/app/api/pipeline/[opId]/route.test.ts"
git commit -m "feat(pipeline): estampado server-side de trabajos y 422 por dato faltante"
```

---

### Task 4: OpDrawer — bloques de ruteo y trabajos + "Guardar cambios"

**Files:**
- Modify: `dashboard/src/components/OpDrawer.tsx`
- Test: `dashboard/src/components/OpDrawer.test.tsx`

**Interfaces:**
- Consumes: `PipelineRecord` (Task 1); `PATCH /api/pipeline/[opId]` (Task 3).
- Produces: UI de captura. Helper local `defaultsRuteo(record, row): { ruta; modalidad; destino; recolecciones }`.

**Defaults derivados:**
- `modalidad`: si `row.tipo` (o material/origen) indica terrestre → `export_terrestre`; marítimo → `export_maritimo`; si no se puede inferir → `nacional`. (En Compras la fila no distingue claramente; usar `nacional` salvo señal explícita. Implementar como: `'nacional'` por defecto.)
- `destino`: `row.pipeline?... ` no aplica; usar el flag de inventarios de la fila origen si está disponible en `FeedRow`; si `row.paraInventarios === 'Sí'` → `monterrey`, si no → `otro`. Si `FeedRow` no expone ese flag, default `otro`.
- `ruta`: default `''` (obliga a elegir).
- `recolecciones`: default `'1'`.

- [ ] **Step 1: Escribir el test que falla**

En `dashboard/src/components/OpDrawer.test.tsx`, agregar (siguiendo el setup de render existente del archivo):

```ts
it('muestra selectores de ruteo prellenados con defaults', () => {
  renderDrawer({ etapa: 'recoleccion', ruta: '', modalidad: '', destino: '', recolecciones: '' });
  expect(screen.getByLabelText('Ruta')).toBeInTheDocument();
  expect((screen.getByLabelText('Recolecciones') as HTMLSelectElement).value).toBe('1');
});

it('renderiza trabajo cargas solo si modalidad export_terrestre', () => {
  renderDrawer({ etapa: 'recoleccion', modalidad: 'export_terrestre' });
  expect(screen.getByText(/Cargas/i)).toBeInTheDocument();
  expect(screen.queryByText(/Ticket/i)).not.toBeInTheDocument();
});

it('"Guardar cambios" hace PATCH con etapa actual y fields de ruteo', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true, record: {} }), { status: 200 }) as any,
  );
  renderDrawer({ etapa: 'instruccion' });
  fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'bodega' } });
  fireEvent.click(screen.getByText('Guardar cambios'));
  await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
  expect(body.etapa).toBe('instruccion');
  expect(body.fields.ruta).toBe('bodega');
});
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: FAIL (no existen los selectores ni el botón).

- [ ] **Step 3: Implementar los bloques en `OpDrawer.tsx`**

Agregar estado y helper cerca del inicio del componente:

```tsx
const [ruteo, setRuteo] = useState(() => defaultsRuteo(record, row));
const [trabajos, setTrabajos] = useState<Partial<PipelineRecord>>({});

function defaultsRuteo(rec: PipelineRecord | undefined, r: FeedRow) {
  return {
    ruta: rec?.ruta || '',
    modalidad: rec?.modalidad || 'nacional',
    destino: rec?.destino || 'otro',
    recolecciones: rec?.recolecciones || '1',
  };
}
```

Definir qué trabajos aplican según `ruteo`:

```tsx
const muestraCargas = ruteo.modalidad === 'export_terrestre';
const muestraEntrada = ruteo.ruta === 'bodega' || ruteo.destino === 'monterrey';
const muestraTicket = ruteo.ruta === 'directa';
```

Render del bloque Ruteo (tras el header, antes de la lista de etapas). Cada `select` con `aria-label` igual a su `label`:

```tsx
<div style={{ marginTop: 8 }}>
  <label style={labelStyle} htmlFor="ruta">Ruta</label>
  <select id="ruta" aria-label="Ruta" style={inputStyle} value={ruteo.ruta}
    onChange={(e) => setRuteo((s) => ({ ...s, ruta: e.target.value }))}>
    <option value="">—</option>
    <option value="directa">Directa</option>
    <option value="bodega">Bodega</option>
  </select>

  <label style={labelStyle} htmlFor="modalidad">Modalidad</label>
  <select id="modalidad" aria-label="Modalidad" style={inputStyle} value={ruteo.modalidad}
    onChange={(e) => setRuteo((s) => ({ ...s, modalidad: e.target.value }))}>
    <option value="export_terrestre">Export terrestre</option>
    <option value="export_maritimo">Export marítimo</option>
    <option value="nacional">Nacional</option>
  </select>

  <label style={labelStyle} htmlFor="destino">Destino</label>
  <select id="destino" aria-label="Destino" style={inputStyle} value={ruteo.destino}
    onChange={(e) => setRuteo((s) => ({ ...s, destino: e.target.value }))}>
    <option value="monterrey">Monterrey (inventarios)</option>
    <option value="otro">Otro</option>
  </select>

  <label style={labelStyle} htmlFor="recolecciones">Recolecciones</label>
  <select id="recolecciones" aria-label="Recolecciones" style={inputStyle} value={ruteo.recolecciones}
    onChange={(e) => setRuteo((s) => ({ ...s, recolecciones: e.target.value }))}>
    <option value="1">1</option>
    <option value="2">2</option>
  </select>
</div>
```

Render del bloque Trabajos (condicional). Ejemplo para cargas (replicar para entrada/ticket con sus campos):

```tsx
{muestraCargas && (
  <div style={{ marginTop: 16 }}>
    <label style={labelStyle}>
      <input type="checkbox"
        checked={(trabajos.cargasHecho ?? record.cargasHecho) === 'Sí'}
        onChange={(e) => setTrabajos((t) => ({ ...t, cargasHecho: e.target.checked ? 'Sí' : '' }))} />
      {' '}Cargas hechas
    </label>
    <input style={inputStyle} placeholder="Nº cargas"
      defaultValue={record.cargasNum}
      onChange={(e) => setTrabajos((t) => ({ ...t, cargasNum: e.target.value }))} />
    {record.cargasPor && (
      <div style={{ color: 'var(--grey)', fontSize: 11, marginTop: 4 }}>
        ✓ hecho por {record.cargasPor} · {record.cargasFecha}
      </div>
    )}
  </div>
)}
```

Para `entrada`: checkbox `entradaHecho` + input que escribe `noEntrada` (reusa el campo existente). Para `ticketEmpaque`: checkbox `ticketEmpaqueHecho` + input `ticketEmpaqueNota` (sin requisito).

Agregar función `guardarCambios` (PATCH a la etapa actual, sin avanzar) y su botón:

```tsx
async function guardarCambios() {
  setError(null);
  setSaving(true);
  try {
    const res = await fetch(`/api/pipeline/${encodeURIComponent(record!.opId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etapa: record!.etapa,
        estatusEtapa: record!.estatusEtapa,
        fields: { ...ruteo, ...trabajos },
        expectedValues: recordToValues(record!),
        credential,
      }),
    });
    const body = await res.json();
    if (res.status === 200 && body.ok) { onSaved(record!.opId, body.record); onClose(); }
    else if (res.status === 409) setError('La operación cambió en otra sesión (conflicto). Recarga.');
    else if (res.status === 422) setError(body.message || 'Falta capturar un dato.');
    else setError(body.message || 'No se pudo guardar.');
  } finally { setSaving(false); }
}
```

```tsx
<button onClick={guardarCambios} disabled={saving} style={{ ...ghostBtn, marginTop: 14 }}>
  {saving ? 'Guardando…' : 'Guardar cambios'}
</button>
```

En `advance()` (avance de etapa existente), incluir también ruteo+trabajos en `fields`:

```tsx
        fields: { ...fields, ...ruteo, ...trabajos },
```

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add src/components/OpDrawer.tsx src/components/OpDrawer.test.tsx
git commit -m "feat(pipeline): bloques de ruteo y trabajos en OpDrawer + guardar cambios"
```

---

### Task 5: PipelineBoard — chips de filtro por trabajo

**Files:**
- Modify: `dashboard/src/components/PipelineBoard.tsx`
- Test: `dashboard/src/components/PipelineBoard.test.tsx`

**Interfaces:**
- Consumes: `FeedRow` con `row.pipeline: PipelineRecord` (Task 1).
- Produces: filtro front sobre `trackRows`. Helper local `opMatchesChip(record, chipId): boolean`.

**Chips (ids):** `cargas_terrestre`, `entrada_bodega`, `entrada_monterrey`, `ticket_empaque`, `recoleccion_2`.

| chipId | condición (sobre `record`) |
|---|---|
| `cargas_terrestre` | `modalidad==='export_terrestre' && cargasHecho!=='Sí'` |
| `entrada_bodega` | `ruta==='bodega' && entradaHecho!=='Sí'` |
| `entrada_monterrey` | `destino==='monterrey' && entradaHecho!=='Sí'` |
| `ticket_empaque` | `ruta==='directa' && ticketEmpaqueHecho!=='Sí'` |
| `recoleccion_2` | `recolecciones==='2'` |

- [ ] **Step 1: Escribir el test que falla**

En `dashboard/src/components/PipelineBoard.test.tsx`, agregar (siguiendo el setup de render existente; `rows` con `pipeline` poblado):

```ts
it('chips solo aparecen en track Compras', () => {
  renderBoard({ track: 'compras' });
  expect(screen.getByText('Cargas terrestre')).toBeInTheDocument();
});

it('filtra ops por chip de trabajo pendiente', () => {
  // dos rows compras: una export_terrestre sin cargasHecho, otra nacional
  renderBoard({ track: 'compras', rows: [terrestrePend, nacional] });
  fireEvent.click(screen.getByText('Cargas terrestre'));
  expect(screen.getByText(terrestrePend.material)).toBeInTheDocument();
  expect(screen.queryByText(nacional.material)).not.toBeInTheDocument();
});

it('varios chips activos = union (OR)', () => {
  renderBoard({ track: 'compras', rows: [terrestrePend, directaPend] });
  fireEvent.click(screen.getByText('Cargas terrestre'));
  fireEvent.click(screen.getByText('Ticket+empaque'));
  expect(screen.getByText(terrestrePend.material)).toBeInTheDocument();
  expect(screen.getByText(directaPend.material)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd dashboard && npx vitest run src/components/PipelineBoard.test.tsx`
Expected: FAIL (chips no existen).

- [ ] **Step 3: Implementar chips en `PipelineBoard.tsx`**

Agregar estado y helper:

```tsx
const [chips, setChips] = useState<Set<string>>(new Set());

const CHIPS: { id: string; label: string }[] = [
  { id: 'cargas_terrestre', label: 'Cargas terrestre' },
  { id: 'entrada_bodega', label: 'Entrada bodega' },
  { id: 'entrada_monterrey', label: 'Entrada Monterrey' },
  { id: 'ticket_empaque', label: 'Ticket+empaque' },
  { id: 'recoleccion_2', label: '2ª recolección' },
];

function opMatchesChip(p: PipelineRecord, id: string): boolean {
  switch (id) {
    case 'cargas_terrestre': return p.modalidad === 'export_terrestre' && p.cargasHecho !== 'Sí';
    case 'entrada_bodega': return p.ruta === 'bodega' && p.entradaHecho !== 'Sí';
    case 'entrada_monterrey': return p.destino === 'monterrey' && p.entradaHecho !== 'Sí';
    case 'ticket_empaque': return p.ruta === 'directa' && p.ticketEmpaqueHecho !== 'Sí';
    case 'recoleccion_2': return p.recolecciones === '2';
    default: return false;
  }
}

function toggleChip(id: string) {
  setChips((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}
```

Derivar las filas visibles a partir de `trackRows` (aplicar solo si hay chips activos y es Compras):

```tsx
const visibleRows = useMemo(() => {
  if (track !== 'compras' || chips.size === 0) return trackRows;
  return trackRows.filter((r) => r.pipeline && [...chips].some((id) => opMatchesChip(r.pipeline!, id)));
}, [trackRows, chips, track]);
```

Reemplazar los usos de `trackRows` en el render del kanban/tabla por `visibleRows` (incluyendo el chequeo `trackRows.length === 0` → mantener para "sin operaciones" del track; usar `visibleRows` para el contenido).

Render de la fila de chips (solo Compras), tras la fila de pills existente:

```tsx
{track === 'compras' && (
  <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
    {CHIPS.map((c) => (
      <button key={c.id} onClick={() => toggleChip(c.id)}
        aria-pressed={chips.has(c.id)} style={pill(chips.has(c.id))}>
        {c.label}
      </button>
    ))}
  </div>
)}
```

Reset de chips al cambiar de track (para no arrastrar filtros de Compras a Ventas): en el `onClick` del pill Ventas, agregar `setChips(new Set())`.

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd dashboard && npx vitest run src/components/PipelineBoard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite, verificar verde**

Run: `cd dashboard && npm test`
Expected: PASS (toda la suite).

- [ ] **Step 6: Commit**

```bash
cd dashboard && git add src/components/PipelineBoard.tsx src/components/PipelineBoard.test.tsx
git commit -m "feat(pipeline): chips de filtro por trabajo en el board"
```

---

## Verificación manual (tras todas las tareas)

1. **Paso manual de hoja:** en la hoja `Pipeline` real, insertar/reordenar encabezados según la tabla de columnas (15 nuevas + `editadoPor`/`editadoFecha` al final, cols A..AB).
2. `cd dashboard && npm run dev`. Abrir el dashboard, track Compras.
3. Dar "Iniciar seguimiento" a una op; abrir el drawer: confirmar bloque Ruteo con defaults.
4. Por cada rama, confirmar que aparece el trabajo correcto y que "Guardar cambios" persiste:
   - `modalidad=export_terrestre` → trabajo Cargas; marcar Hecho con nº → fila en hoja trae `cargasHecho=Sí`, `cargasPor`=tu email, `cargasFecha`.
   - `ruta=bodega` → Entrada; marcar sin `noEntrada` → error 422 visible.
   - `ruta=directa` → Ticket+empaque; marcar Hecho (sin dato) → ok.
   - `destino=monterrey` → Entrada.
5. Activar chips: confirmar que filtran y que un op marcado Hecho sale del chip.
6. Editar la misma op desde dos pestañas → la segunda en guardar recibe conflicto (toast/error).

## Self-Review

- **Cobertura del spec:** Modelo de datos §A/§B → Task 1. Trabajos-dentro-de-etapas (sin cambiar máquina) → respetado (Task 1/2, no se toca `etapasFor`). Validación captura por trabajo → Task 2. Estampado server-side + errores 409/422/503 → Task 3 (503 ya existente en `updatePipelineRecord`). OpDrawer ruteo+trabajos+"Guardar cambios" → Task 4. Chips de filtro (OR, solo Compras) → Task 5. Pasos manuales (reordenar encabezados) → sección Verificación manual + Global Constraints. Fuera de alcance (Pieza B, Cotizador, Ventas, permisos) → respetado.
- **Sin placeholders:** todos los steps traen código real y comandos con resultado esperado.
- **Consistencia de tipos:** `PipelineRecord` con los 15 campos string usados igual en Tasks 1–5; `trabajoCapturaFaltante(current, candidate)` definida en Task 2 y consumida en Task 3; keys `cargasHecho/cargasNum/...` idénticas en schema, client, machine, route, drawer y board; chip ids consistentes en Task 5.
