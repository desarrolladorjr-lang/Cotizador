# OC Directa — Historial en Dropbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every OC Directa as an `.xlsx` (official template, formulas intact) plus two PNG snapshots in Dropbox — the single source of truth — with a dashboard list that can open, edit, and re-save any order, including the async MTY-consecutivo flow.

**Architecture:** A thin Dropbox HTTP client (refresh-token auth) plus an ExcelJS module that writes/reads only the template's input cells. Three authenticated API routes (list / open / save) sit between the browser and Dropbox. The existing `OrdenDirectaForm` gains save-to-Dropbox (client captures the two rendered print documents to PNG with html2canvas) and a new `OrdenesDirectas` list container becomes the section's entry point.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Vitest, ExcelJS (new dep), html2canvas (new dep), Dropbox HTTP API v2. No Dropbox SDK — plain `fetch`.

## Global Constraints

- **NO writes to Google Sheets.** The logística spreadsheet stays read-only (catalogs). Explicit user requirement.
- Dropbox env vars (already configured in Vercel prod+preview): `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_FOLDER` (default `/Ordenes de Compra`).
- File naming: xlsx `OC<consecutivo> <PROVEEDOR>.xlsx`, pending suffix ` - PENDIENTE MTY` before `.xlsx`; images `OC<consecutivo> <PROVEEDOR> COMPRA.png` / `… REVENTA.png` (images never carry the pending suffix).
- Template at `dashboard/templates/PLANTILLA OC.xlsx` (already in repo). Max 13 material lines (template rows 21–33).
- Folio pending form: `OC.<n>/PENDIENTE` when `entraMty && folioMty` empty.
- All new routes use the `Authorization: Bearer` + `verifyGoogleCredential` pattern from `dashboard/src/app/api/ordenes-directas/catalogo/route.ts`.
- All commands run from `dashboard/` (nested git repo). Test runner: `npm run test` (= `vitest run`).

---

### Task 1: `dropboxClient` — Dropbox HTTP client

**Files:**
- Create: `dashboard/src/lib/dropboxClient.ts`
- Test: `dashboard/src/lib/dropboxClient.test.ts`

**Interfaces:**
- Consumes: nothing (env vars + fetch).
- Produces: `dropboxConfigurado(): boolean`, `uploadFile(path: string, data: Buffer): Promise<void>`, `listFolder(folder: string): Promise<DropboxEntry[]>`, `downloadFile(path: string): Promise<Buffer>`, `deleteFile(path: string): Promise<void>`, `type DropboxEntry = { name: string; pathLower: string; serverModified: string }`. Consumed by Tasks 4–6.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/lib/dropboxClient.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ENV = {
  DROPBOX_APP_KEY: 'key',
  DROPBOX_APP_SECRET: 'secret',
  DROPBOX_REFRESH_TOKEN: 'refresh',
};

function mockFetchSequence(responses: { ok?: boolean; status?: number; json?: unknown; buffer?: ArrayBuffer }[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json ?? {},
      arrayBuffer: async () => r.buffer ?? new ArrayBuffer(0),
      text: async () => JSON.stringify(r.json ?? {}),
    });
  }
  return fn;
}

describe('dropboxClient', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, ENV);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DROPBOX_APP_KEY;
    delete process.env.DROPBOX_APP_SECRET;
    delete process.env.DROPBOX_REFRESH_TOKEN;
  });

  it('dropboxConfigurado false sin env vars', async () => {
    delete process.env.DROPBOX_APP_KEY;
    const { dropboxConfigurado } = await import('./dropboxClient');
    expect(dropboxConfigurado()).toBe(false);
  });

  it('uploadFile pide token una vez y lo reutiliza (cache)', async () => {
    const fetchMock = mockFetchSequence([
      { json: { access_token: 'tok', expires_in: 14400 } }, // oauth
      { json: {} }, // upload 1
      { json: {} }, // upload 2
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { uploadFile } = await import('./dropboxClient');
    await uploadFile('/x/a.txt', Buffer.from('a'));
    await uploadFile('/x/b.txt', Buffer.from('b'));
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 token + 2 uploads
    const [tokenUrl] = fetchMock.mock.calls[0];
    expect(String(tokenUrl)).toContain('api.dropboxapi.com/oauth2/token');
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1];
    expect(String(uploadUrl)).toContain('content.dropboxapi.com/2/files/upload');
    const apiArg = JSON.parse((uploadInit.headers as Record<string, string>)['Dropbox-API-Arg']);
    expect(apiArg).toEqual({ path: '/x/a.txt', mode: 'overwrite', mute: true });
  });

  it('listFolder pagina con continue', async () => {
    const fetchMock = mockFetchSequence([
      { json: { access_token: 'tok', expires_in: 14400 } },
      { json: { entries: [{ '.tag': 'file', name: 'a.xlsx', path_lower: '/f/a.xlsx', server_modified: '2026-07-03T00:00:00Z' }], has_more: true, cursor: 'c1' } },
      { json: { entries: [{ '.tag': 'file', name: 'b.xlsx', path_lower: '/f/b.xlsx', server_modified: '2026-07-03T01:00:00Z' }], has_more: false } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { listFolder } = await import('./dropboxClient');
    const entries = await listFolder('/f');
    expect(entries.map((e) => e.name)).toEqual(['a.xlsx', 'b.xlsx']);
  });

  it('deleteFile no lanza en 409 (not_found)', async () => {
    const fetchMock = mockFetchSequence([
      { json: { access_token: 'tok', expires_in: 14400 } },
      { ok: false, status: 409, json: { error_summary: 'path_lookup/not_found/..' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { deleteFile } = await import('./dropboxClient');
    await expect(deleteFile('/f/nope.xlsx')).resolves.toBeUndefined();
  });

  it('sin configurar lanza dropbox_no_configurado', async () => {
    delete process.env.DROPBOX_REFRESH_TOKEN;
    const { uploadFile } = await import('./dropboxClient');
    await expect(uploadFile('/x', Buffer.from(''))).rejects.toThrow('dropbox_no_configurado');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/dropboxClient.test.ts`
Expected: FAIL — `Cannot find module './dropboxClient'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/lib/dropboxClient.ts
export interface DropboxEntry {
  name: string;
  pathLower: string;
  serverModified: string;
}

let tokenCache: { token: string; expiraMs: number } | null = null;

function config() {
  const key = process.env.DROPBOX_APP_KEY;
  const secret = process.env.DROPBOX_APP_SECRET;
  const refresh = process.env.DROPBOX_REFRESH_TOKEN;
  if (!key || !secret || !refresh) return null;
  return { key, secret, refresh };
}

export function dropboxConfigurado(): boolean {
  return config() !== null;
}

async function getAccessToken(): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error('dropbox_no_configurado');
  if (tokenCache && Date.now() < tokenCache.expiraMs) return tokenCache.token;

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${cfg.key}:${cfg.secret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.refresh }),
  });
  if (!res.ok) throw new Error(`dropbox_token_error: ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  // Renueva 60 s antes de expirar para no usar un token al borde.
  tokenCache = { token: body.access_token, expiraMs: Date.now() + (body.expires_in - 60) * 1000 };
  return tokenCache.token;
}

export async function uploadFile(path: string, data: Buffer): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(data),
  });
  if (!res.ok) throw new Error(`dropbox_upload_error: ${await res.text()}`);
}

export async function listFolder(folder: string): Promise<DropboxEntry[]> {
  const token = await getAccessToken();
  const entries: DropboxEntry[] = [];

  let res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  if (!res.ok) throw new Error(`dropbox_list_error: ${await res.text()}`);
  let body = (await res.json()) as {
    entries: { '.tag': string; name: string; path_lower: string; server_modified?: string }[];
    has_more: boolean;
    cursor?: string;
  };

  for (;;) {
    for (const e of body.entries) {
      if (e['.tag'] === 'file') {
        entries.push({ name: e.name, pathLower: e.path_lower, serverModified: e.server_modified || '' });
      }
    }
    if (!body.has_more) break;
    res = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: body.cursor }),
    });
    if (!res.ok) throw new Error(`dropbox_list_error: ${await res.text()}`);
    body = await res.json();
  }
  return entries;
}

export async function downloadFile(path: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path }) },
  });
  if (!res.ok) throw new Error(`dropbox_download_error: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFile(path: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  // 409 = no existe: borrar algo ya borrado no es error para nuestro flujo.
  if (!res.ok && res.status !== 409) throw new Error(`dropbox_delete_error: ${await res.text()}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/dropboxClient.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dropboxClient.ts src/lib/dropboxClient.test.ts
git commit -m "feat: add Dropbox HTTP client (refresh-token auth, upload/list/download/delete)"
```

---

### Task 2: folio `/PENDIENTE` en `construirFolio`

**Files:**
- Modify: `dashboard/src/lib/ordenDirectaCalculos.ts` (función `construirFolio`)
- Test: `dashboard/src/lib/ordenDirectaCalculos.test.ts` (ampliar `describe('construirFolio')`)

**Interfaces:**
- Produces: `construirFolio(consecutivo, entraMty, folioMty)` ahora devuelve `OC.<n>/PENDIENTE` cuando `entraMty === true` y `folioMty` vacío (antes producía `OC.<n>/`). Firma sin cambios. Consumido por el formulario existente y Tasks 3/6.

- [ ] **Step 1: Add the failing test**

Añadir dentro del `describe('construirFolio')` existente:

```ts
  it('entrando a MTY sin consecutivo aún: segundo segmento PENDIENTE', () => {
    expect(construirFolio('696', true, '')).toBe('OC.696/PENDIENTE');
    expect(construirFolio('696', true, '   ')).toBe('OC.696/PENDIENTE');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/lib/ordenDirectaCalculos.test.ts`
Expected: FAIL — recibe `'OC.696/'`

- [ ] **Step 3: Implement**

Reemplazar el cuerpo de `construirFolio`:

```ts
export function construirFolio(consecutivo: string, entraMty: boolean, folioMty: string): string {
  const segundo = entraMty ? (folioMty.trim() || 'PENDIENTE') : 'Directo';
  return `OC.${consecutivo.trim()}/${segundo}`;
}
```

- [ ] **Step 4: Run full suite (el formulario ya usa esta función)**

Run: `cd dashboard && npm run test`
Expected: PASS completo. (El test del formulario que verifica `OC.696/Directo` y `OC.696/E641` no cambia.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ordenDirectaCalculos.ts src/lib/ordenDirectaCalculos.test.ts
git commit -m "feat: folio muestra /PENDIENTE cuando entra a MTY sin consecutivo"
```

---

### Task 3: `ocDirectaXlsx` — generar/parsear Excel + nombres de archivo

**Files:**
- Create: `dashboard/src/lib/ocDirectaXlsx.ts`
- Test: `dashboard/src/lib/ocDirectaXlsx.test.ts`
- Modify: `dashboard/package.json` (dep `exceljs`)

**Interfaces:**
- Consumes: `construirFolio` de `./ordenDirectaCalculos`; plantilla `dashboard/templates/PLANTILLA OC.xlsx` (ya en el repo).
- Produces (consumido por Tasks 5, 6, 7, 8):

```ts
export interface OrdenDirectaDatos {
  folioConsecutivo: string;
  entraMty: boolean;
  folioMty: string;
  fecha: string;
  proveedor: string;
  entidadCompraNombre: string;
  entidadReventaNombre: string;
  metodoPago: string;
  formaPago: string;
  retencion: 'SI' | 'NO';
  margenPorKg: number;
  lineas: { material: string; cantidadKg: number; unidad: string; precioNeto: number }[];
}
export const MAX_LINEAS = 13;
export async function generarXlsx(orden: OrdenDirectaDatos): Promise<Buffer>;
export async function parseXlsx(buffer: Buffer): Promise<OrdenDirectaDatos>;
export function nombreArchivo(orden: Pick<OrdenDirectaDatos, 'folioConsecutivo' | 'proveedor' | 'entraMty' | 'folioMty'>): string;
export function nombreImagen(orden: Pick<OrdenDirectaDatos, 'folioConsecutivo' | 'proveedor'>, lado: 'compra' | 'reventa'): string;
export function parseNombre(nombre: string): { consecutivo: string; proveedor: string; pendienteMty: boolean } | null;
```

- [ ] **Step 1: Install exceljs**

Run: `cd dashboard && npm install exceljs`
Expected: added to dependencies without errors.

- [ ] **Step 2: Write the failing tests**

```ts
// dashboard/src/lib/ocDirectaXlsx.test.ts
import { describe, it, expect } from 'vitest';
import {
  generarXlsx, parseXlsx, nombreArchivo, nombreImagen, parseNombre,
  MAX_LINEAS, type OrdenDirectaDatos,
} from './ocDirectaXlsx';

const ORDEN: OrdenDirectaDatos = {
  folioConsecutivo: '696',
  entraMty: true,
  folioMty: 'E641',
  fecha: '2026-07-03',
  proveedor: 'RODRIGO CALDERA',
  entidadCompraNombre: 'ELSY GUADALUPE SOSA CHAVEZ',
  entidadReventaNombre: 'ALVARO RESENDIZ GALLEGOS',
  metodoPago: 'PPD',
  formaPago: '99-POR DEFINIR',
  retencion: 'NO',
  margenPorKg: 0.03,
  lineas: [
    { material: 'ALUMINIO 1100 TRASTE', cantidadKg: 7485, unidad: 'KGM', precioNeto: 43 },
    { material: 'ANTIMONIO', cantidadKg: 1830, unidad: 'KGM', precioNeto: 41 },
  ],
};

describe('generarXlsx + parseXlsx (round-trip)', () => {
  it('lo que se escribe se lee igual', async () => {
    const buffer = await generarXlsx(ORDEN);
    const leida = await parseXlsx(buffer);
    expect(leida.folioConsecutivo).toBe('696');
    expect(leida.entraMty).toBe(true);
    expect(leida.folioMty).toBe('E641');
    expect(leida.proveedor).toBe('RODRIGO CALDERA');
    expect(leida.entidadCompraNombre).toBe('ELSY GUADALUPE SOSA CHAVEZ');
    expect(leida.entidadReventaNombre).toBe('ALVARO RESENDIZ GALLEGOS');
    expect(leida.metodoPago).toBe('PPD');
    expect(leida.formaPago).toBe('99-POR DEFINIR');
    expect(leida.retencion).toBe('NO');
    expect(leida.margenPorKg).toBe(0.03);
    expect(leida.lineas).toEqual(ORDEN.lineas);
  });

  it('folio Directo y PENDIENTE se descomponen bien', async () => {
    const directo = await parseXlsx(await generarXlsx({ ...ORDEN, entraMty: false, folioMty: '' }));
    expect(directo.entraMty).toBe(false);
    expect(directo.folioMty).toBe('');

    const pendiente = await parseXlsx(await generarXlsx({ ...ORDEN, folioMty: '' }));
    expect(pendiente.entraMty).toBe(true);
    expect(pendiente.folioMty).toBe('');
  });

  it('rechaza más de MAX_LINEAS', async () => {
    const muchas = Array(MAX_LINEAS + 1).fill(ORDEN.lineas[0]);
    await expect(generarXlsx({ ...ORDEN, lineas: muchas })).rejects.toThrow('max_lineas');
  });

  it('editar reduce líneas: las filas sobrantes quedan vacías', async () => {
    const con2 = await generarXlsx(ORDEN);
    // Simula edición: misma plantilla pero ahora 1 línea. Al parsear no debe arrastrar la segunda.
    const con1 = await generarXlsx({ ...ORDEN, lineas: [ORDEN.lineas[0]] });
    const leida = await parseXlsx(con1);
    expect(leida.lineas).toHaveLength(1);
    expect(con2).not.toEqual(con1);
  });
});

describe('nombres de archivo', () => {
  it('sin pendiente', () => {
    expect(nombreArchivo(ORDEN)).toBe('OC696 RODRIGO CALDERA.xlsx');
  });
  it('pendiente MTY lleva sufijo', () => {
    expect(nombreArchivo({ ...ORDEN, folioMty: '' })).toBe('OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx');
  });
  it('imagenes sin sufijo pendiente', () => {
    expect(nombreImagen(ORDEN, 'compra')).toBe('OC696 RODRIGO CALDERA COMPRA.png');
    expect(nombreImagen(ORDEN, 'reventa')).toBe('OC696 RODRIGO CALDERA REVENTA.png');
  });
  it('parseNombre round-trip', () => {
    expect(parseNombre('OC696 RODRIGO CALDERA.xlsx')).toEqual({ consecutivo: '696', proveedor: 'RODRIGO CALDERA', pendienteMty: false });
    expect(parseNombre('OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx')).toEqual({ consecutivo: '696', proveedor: 'RODRIGO CALDERA', pendienteMty: true });
    expect(parseNombre('otra cosa.xlsx')).toBeNull();
    expect(parseNombre('OC696 X.png')).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/ocDirectaXlsx.test.ts`
Expected: FAIL — `Cannot find module './ocDirectaXlsx'`

- [ ] **Step 4: Implement**

```ts
// dashboard/src/lib/ocDirectaXlsx.ts
import ExcelJS from 'exceljs';
import path from 'path';
import { construirFolio } from './ordenDirectaCalculos';

export interface OrdenDirectaDatos {
  folioConsecutivo: string;
  entraMty: boolean;
  folioMty: string;
  fecha: string;
  proveedor: string;
  entidadCompraNombre: string;
  entidadReventaNombre: string;
  metodoPago: string;
  formaPago: string;
  retencion: 'SI' | 'NO';
  margenPorKg: number;
  lineas: { material: string; cantidadKg: number; unidad: string; precioNeto: number }[];
}

export const MAX_LINEAS = 13; // filas 21..33 de la plantilla
const FILA_INICIO = 21;
const HOJA = 'ORDEN DE COMPRA';
const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'PLANTILLA OC.xlsx');

export async function generarXlsx(orden: OrdenDirectaDatos): Promise<Buffer> {
  if (orden.lineas.length > MAX_LINEAS) throw new Error('max_lineas');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.getWorksheet(HOJA);
  if (!ws) throw new Error('plantilla_sin_hoja');

  ws.getCell('G2').value = construirFolio(orden.folioConsecutivo, orden.entraMty, orden.folioMty);
  ws.getCell('C4').value = orden.entidadCompraNombre;
  ws.getCell('L4').value = orden.entidadReventaNombre;
  ws.getCell('G10').value = orden.entidadReventaNombre;
  ws.getCell('H11').value = orden.proveedor;
  ws.getCell('E16').value = orden.metodoPago;
  ws.getCell('N16').value = orden.metodoPago;
  ws.getCell('E17').value = orden.formaPago;
  ws.getCell('N17').value = orden.formaPago;
  ws.getCell('J18').value = orden.retencion;
  ws.getCell('S21').value = orden.margenPorKg;

  for (let i = 0; i < MAX_LINEAS; i++) {
    const fila = FILA_INICIO + i;
    const linea = orden.lineas[i];
    ws.getCell(`D${fila}`).value = linea ? linea.cantidadKg : null;
    ws.getCell(`E${fila}`).value = linea ? linea.unidad : null;
    ws.getCell(`F${fila}`).value = linea ? linea.material : null;
    ws.getCell(`J${fila}`).value = linea ? linea.precioNeto : null;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

const texto = (v: ExcelJS.CellValue): string => (v === null || v === undefined ? '' : String(v).trim());
const numero = (v: ExcelJS.CellValue): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== undefined && v !== '' ? n : null;
};

export async function parseXlsx(buffer: Buffer): Promise<OrdenDirectaDatos> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(HOJA);
  if (!ws) throw new Error('formato_no_reconocido');

  const folio = texto(ws.getCell('G2').value);
  const m = folio.match(/^OC\.(.+?)\/(.+)$/);
  if (!m) throw new Error('formato_no_reconocido');
  const [, consecutivo, segundo] = m;
  const entraMty = segundo !== 'Directo';
  const folioMty = entraMty && segundo !== 'PENDIENTE' ? segundo : '';

  const lineas: OrdenDirectaDatos['lineas'] = [];
  for (let i = 0; i < MAX_LINEAS; i++) {
    const fila = FILA_INICIO + i;
    const material = texto(ws.getCell(`F${fila}`).value);
    const cantidadKg = numero(ws.getCell(`D${fila}`).value);
    const precioNeto = numero(ws.getCell(`J${fila}`).value);
    if (!material || cantidadKg === null || precioNeto === null) continue;
    lineas.push({ material, cantidadKg, unidad: texto(ws.getCell(`E${fila}`).value) || 'KGM', precioNeto });
  }

  return {
    folioConsecutivo: consecutivo,
    entraMty,
    folioMty,
    // La plantilla usa =NOW() para la fecha: no es recuperable. Al editar se propone hoy.
    fecha: new Date().toISOString().slice(0, 10),
    proveedor: texto(ws.getCell('H11').value),
    entidadCompraNombre: texto(ws.getCell('C4').value),
    entidadReventaNombre: texto(ws.getCell('L4').value),
    metodoPago: texto(ws.getCell('E16').value),
    formaPago: texto(ws.getCell('E17').value),
    retencion: texto(ws.getCell('J18').value) === 'SI' ? 'SI' : 'NO',
    margenPorKg: numero(ws.getCell('S21').value) ?? 0,
    lineas,
  };
}

const base = (o: Pick<OrdenDirectaDatos, 'folioConsecutivo' | 'proveedor'>) =>
  `OC${o.folioConsecutivo.trim()} ${o.proveedor.trim()}`;

export function nombreArchivo(
  o: Pick<OrdenDirectaDatos, 'folioConsecutivo' | 'proveedor' | 'entraMty' | 'folioMty'>
): string {
  const pendiente = o.entraMty && !o.folioMty.trim();
  return `${base(o)}${pendiente ? ' - PENDIENTE MTY' : ''}.xlsx`;
}

export function nombreImagen(
  o: Pick<OrdenDirectaDatos, 'folioConsecutivo' | 'proveedor'>,
  lado: 'compra' | 'reventa'
): string {
  return `${base(o)} ${lado === 'compra' ? 'COMPRA' : 'REVENTA'}.png`;
}

export function parseNombre(nombre: string): { consecutivo: string; proveedor: string; pendienteMty: boolean } | null {
  const m = nombre.match(/^OC(\S+) (.+?)( - PENDIENTE MTY)?\.xlsx$/i);
  if (!m) return null;
  return { consecutivo: m[1], proveedor: m[2], pendienteMty: Boolean(m[3]) };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/ocDirectaXlsx.test.ts`
Expected: PASS (8 tests). Nota: usan la plantilla real del repo — sin mocks.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ocDirectaXlsx.ts src/lib/ocDirectaXlsx.test.ts package.json package-lock.json
git commit -m "feat: generar/parsear xlsx de OC Directa sobre la plantilla oficial + convención de nombres"
```

---

### Task 4: route `GET /api/ordenes-directas/archivos`

**Files:**
- Create: `dashboard/src/app/api/ordenes-directas/archivos/route.ts`
- Test: `dashboard/src/app/api/ordenes-directas/archivos/route.test.ts`

**Interfaces:**
- Consumes: `listFolder` (Task 1), `parseNombre` (Task 3), `createTtlCache` de `@/lib/feedCache`, `verifyGoogleCredential` de `@/lib/verifyGoogleToken`.
- Produces: `GET` → `{ archivos: ArchivoOC[], stale: boolean }` donde `ArchivoOC = { nombre, path, consecutivo, proveedor, pendienteMty, modificado }`. Consumido por Task 8.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/app/api/ordenes-directas/archivos/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verifyGoogleToken', () => ({ verifyGoogleCredential: vi.fn() }));
vi.mock('@/lib/dropboxClient', () => ({ listFolder: vi.fn() }));

import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import { listFolder } from '@/lib/dropboxClient';

const ENTRIES = [
  { name: 'OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx', pathLower: '/oc/oc696 rodrigo caldera - pendiente mty.xlsx', serverModified: '2026-07-03T10:00:00Z' },
  { name: 'OC695 CESAR DELGADO.xlsx', pathLower: '/oc/oc695 cesar delgado.xlsx', serverModified: '2026-07-01T10:00:00Z' },
  { name: 'OC696 RODRIGO CALDERA COMPRA.png', pathLower: '/oc/x.png', serverModified: '' }, // no-xlsx: fuera
  { name: 'notas.xlsx', pathLower: '/oc/notas.xlsx', serverModified: '' }, // xlsx sin convención: fuera
];

const req = () => new Request('http://localhost/api/ordenes-directas/archivos', {
  headers: { Authorization: 'Bearer tok' },
});

describe('GET /api/ordenes-directas/archivos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (verifyGoogleCredential as any).mockResolvedValue({ email: 'a@b.com' });
  });

  it('401 sin token', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/x'));
    expect(res.status).toBe(401);
  });

  it('lista solo xlsx con convención, orden descendente por consecutivo', async () => {
    (listFolder as any).mockResolvedValue(ENTRIES);
    const { GET } = await import('./route');
    const body = await (await GET(req())).json();
    expect(body.archivos.map((a: any) => a.consecutivo)).toEqual(['696', '695']);
    expect(body.archivos[0].pendienteMty).toBe(true);
    expect(body.archivos[0].proveedor).toBe('RODRIGO CALDERA');
  });

  it('error de Dropbox sin cache → 503', async () => {
    (listFolder as any).mockRejectedValue(new Error('boom'));
    const { GET } = await import('./route');
    const res = await GET(req());
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/archivos/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/app/api/ordenes-directas/archivos/route.ts
import { listFolder } from '@/lib/dropboxClient';
import { parseNombre } from '@/lib/ocDirectaXlsx';
import { createTtlCache } from '@/lib/feedCache';
import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';

export const dynamic = 'force-dynamic';

const FOLDER = () => process.env.DROPBOX_FOLDER || '/Ordenes de Compra';

export interface ArchivoOC {
  nombre: string;
  path: string;
  consecutivo: string;
  proveedor: string;
  pendienteMty: boolean;
  modificado: string;
}

const cache = createTtlCache<ArchivoOC[]>(15_000);

async function autorizado(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  return (await verifyGoogleCredential(header.slice(7))) !== null;
}

export async function GET(request: Request) {
  if (!(await autorizado(request))) {
    return Response.json({ archivos: [], error: 'no autorizado' }, { status: 401 });
  }

  const cached = cache.get();
  if (cached) return Response.json({ archivos: cached, stale: false });

  try {
    const entries = await listFolder(FOLDER());
    const archivos: ArchivoOC[] = [];
    for (const e of entries) {
      const info = parseNombre(e.name);
      if (!info) continue;
      archivos.push({
        nombre: e.name,
        path: e.pathLower,
        consecutivo: info.consecutivo,
        proveedor: info.proveedor,
        pendienteMty: info.pendienteMty,
        modificado: e.serverModified,
      });
    }
    archivos.sort((a, b) => b.consecutivo.localeCompare(a.consecutivo, undefined, { numeric: true }));
    cache.set(archivos);
    return Response.json({ archivos, stale: false });
  } catch (err) {
    const stale = cache.getStale();
    if (stale) return Response.json({ archivos: stale, stale: true });
    return Response.json({ archivos: [], error: (err as Error).message, stale: true }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/archivos/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ordenes-directas/archivos
git commit -m "feat: route que lista las OC Directa guardadas en Dropbox"
```

---

### Task 5: route `POST /api/ordenes-directas/abrir`

**Files:**
- Create: `dashboard/src/app/api/ordenes-directas/abrir/route.ts`
- Test: `dashboard/src/app/api/ordenes-directas/abrir/route.test.ts`

**Interfaces:**
- Consumes: `downloadFile` (Task 1), `parseXlsx` (Task 3), `verifyGoogleCredential`.
- Produces: `POST { path }` → `{ orden: OrdenDirectaDatos }` | 401 | 422 `formato_no_reconocido` | 503. Consumido por Task 8.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/app/api/ordenes-directas/abrir/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verifyGoogleToken', () => ({ verifyGoogleCredential: vi.fn() }));
vi.mock('@/lib/dropboxClient', () => ({ downloadFile: vi.fn() }));
vi.mock('@/lib/ocDirectaXlsx', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  parseXlsx: vi.fn(),
}));

import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import { downloadFile } from '@/lib/dropboxClient';
import { parseXlsx } from '@/lib/ocDirectaXlsx';

const req = (body: unknown, auth = 'Bearer tok') =>
  new Request('http://localhost/api/ordenes-directas/abrir', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/ordenes-directas/abrir', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (verifyGoogleCredential as any).mockResolvedValue({ email: 'a@b.com' });
  });

  it('401 sin token', async () => {
    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('descarga, parsea y responde la orden', async () => {
    (downloadFile as any).mockResolvedValue(Buffer.from('xlsx'));
    (parseXlsx as any).mockResolvedValue({ proveedor: 'RODRIGO CALDERA' });
    const { POST } = await import('./route');
    const res = await POST(req({ path: '/oc/oc696.xlsx' }));
    const body = await res.json();
    expect(downloadFile).toHaveBeenCalledWith('/oc/oc696.xlsx');
    expect(body.orden.proveedor).toBe('RODRIGO CALDERA');
  });

  it('xlsx que no sigue la plantilla → 422', async () => {
    (downloadFile as any).mockResolvedValue(Buffer.from('x'));
    (parseXlsx as any).mockRejectedValue(new Error('formato_no_reconocido'));
    const { POST } = await import('./route');
    const res = await POST(req({ path: '/oc/raro.xlsx' }));
    expect(res.status).toBe(422);
  });

  it('error de Dropbox → 503', async () => {
    (downloadFile as any).mockRejectedValue(new Error('dropbox_download_error'));
    const { POST } = await import('./route');
    const res = await POST(req({ path: '/oc/x.xlsx' }));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/abrir/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement**

```ts
// dashboard/src/app/api/ordenes-directas/abrir/route.ts
import { downloadFile } from '@/lib/dropboxClient';
import { parseXlsx } from '@/lib/ocDirectaXlsx';
import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !(await verifyGoogleCredential(header.slice(7)))) {
    return Response.json({ orden: null, error: 'no autorizado' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { path?: string } | null;
  if (!body?.path) return Response.json({ orden: null, error: 'path requerido' }, { status: 400 });

  let buffer: Buffer;
  try {
    buffer = await downloadFile(body.path);
  } catch (err) {
    return Response.json({ orden: null, error: (err as Error).message }, { status: 503 });
  }

  try {
    const orden = await parseXlsx(buffer);
    return Response.json({ orden });
  } catch {
    return Response.json({ orden: null, error: 'formato_no_reconocido' }, { status: 422 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/abrir/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ordenes-directas/abrir
git commit -m "feat: route que abre una OC Directa desde su xlsx en Dropbox"
```

---

### Task 6: route `POST /api/ordenes-directas/guardar` + bundling de la plantilla

**Files:**
- Create: `dashboard/src/app/api/ordenes-directas/guardar/route.ts`
- Test: `dashboard/src/app/api/ordenes-directas/guardar/route.test.ts`
- Modify: `dashboard/next.config.js` (incluir `templates/` en el bundle serverless)

**Interfaces:**
- Consumes: `uploadFile`, `deleteFile`, `dropboxConfigurado` (Task 1); `generarXlsx`, `nombreArchivo`, `nombreImagen`, `parseNombre`, `MAX_LINEAS`, `type OrdenDirectaDatos` (Task 3); `verifyGoogleCredential`.
- Produces: `POST { orden, imagenes: { compra, reventa }, pathOriginal? }` → `{ ok: true, path }` | 400 validación | 401 | 503 Dropbox. Consumido por Task 7.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/app/api/ordenes-directas/guardar/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verifyGoogleToken', () => ({ verifyGoogleCredential: vi.fn() }));
vi.mock('@/lib/dropboxClient', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  dropboxConfigurado: vi.fn(() => true),
}));
vi.mock('@/lib/ocDirectaXlsx', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generarXlsx: vi.fn(async () => Buffer.from('xlsx')),
}));

import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import { uploadFile, deleteFile, dropboxConfigurado } from '@/lib/dropboxClient';

const ORDEN = {
  folioConsecutivo: '696', entraMty: true, folioMty: 'E641', fecha: '2026-07-03',
  proveedor: 'RODRIGO CALDERA', entidadCompraNombre: 'ELSY', entidadReventaNombre: 'ALVARO',
  metodoPago: 'PPD', formaPago: '99', retencion: 'NO', margenPorKg: 0.03,
  lineas: [{ material: 'ANTIMONIO', cantidadKg: 1830, unidad: 'KGM', precioNeto: 41 }],
};
const IMAGENES = { compra: Buffer.from('png1').toString('base64'), reventa: Buffer.from('png2').toString('base64') };

const req = (body: unknown, auth = 'Bearer tok') =>
  new Request('http://localhost/api/ordenes-directas/guardar', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/ordenes-directas/guardar', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (verifyGoogleCredential as any).mockResolvedValue({ email: 'a@b.com' });
    (dropboxConfigurado as any).mockReturnValue(true);
    process.env.DROPBOX_FOLDER = '/OC';
  });

  it('401 sin token', async () => {
    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('sube xlsx + 2 imágenes con los nombres correctos', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ orden: ORDEN, imagenes: IMAGENES }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    const paths = (uploadFile as any).mock.calls.map((c: any[]) => c[0]);
    expect(paths).toEqual([
      '/OC/OC696 RODRIGO CALDERA.xlsx',
      '/OC/OC696 RODRIGO CALDERA COMPRA.png',
      '/OC/OC696 RODRIGO CALDERA REVENTA.png',
    ]);
  });

  it('renombrado (era PENDIENTE, ahora completa): borra el xlsx anterior', async () => {
    const { POST } = await import('./route');
    await POST(req({
      orden: ORDEN,
      imagenes: IMAGENES,
      pathOriginal: '/OC/OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx',
    }));
    expect(deleteFile).toHaveBeenCalledWith('/OC/OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx');
  });

  it('mismo nombre: no borra nada', async () => {
    const { POST } = await import('./route');
    await POST(req({ orden: ORDEN, imagenes: IMAGENES, pathOriginal: '/OC/OC696 RODRIGO CALDERA.xlsx' }));
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('validación: sin líneas completas → 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ orden: { ...ORDEN, lineas: [] }, imagenes: IMAGENES }));
    expect(res.status).toBe(400);
  });

  it('Dropbox no configurado → 503', async () => {
    (dropboxConfigurado as any).mockReturnValue(false);
    const { POST } = await import('./route');
    const res = await POST(req({ orden: ORDEN, imagenes: IMAGENES }));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/guardar/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the route**

```ts
// dashboard/src/app/api/ordenes-directas/guardar/route.ts
import { uploadFile, deleteFile, dropboxConfigurado } from '@/lib/dropboxClient';
import {
  generarXlsx, nombreArchivo, nombreImagen, parseNombre, MAX_LINEAS,
  type OrdenDirectaDatos,
} from '@/lib/ocDirectaXlsx';
import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';

export const dynamic = 'force-dynamic';

const FOLDER = () => process.env.DROPBOX_FOLDER || '/Ordenes de Compra';

interface GuardarBody {
  orden: OrdenDirectaDatos;
  imagenes: { compra: string; reventa: string };
  pathOriginal?: string;
}

function validar(orden: OrdenDirectaDatos): string | null {
  if (!orden.folioConsecutivo?.trim()) return 'folio requerido';
  if (!orden.proveedor?.trim()) return 'proveedor requerido';
  if (!orden.entidadCompraNombre?.trim() || !orden.entidadReventaNombre?.trim()) return 'entidades requeridas';
  if (!orden.lineas?.length) return 'al menos una línea';
  if (orden.lineas.length > MAX_LINEAS) return `máximo ${MAX_LINEAS} líneas`;
  return null;
}

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !(await verifyGoogleCredential(header.slice(7)))) {
    return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 });
  }
  if (!dropboxConfigurado()) {
    return Response.json({ ok: false, error: 'dropbox_no_configurado' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as GuardarBody | null;
  if (!body?.orden || !body.imagenes?.compra || !body.imagenes?.reventa) {
    return Response.json({ ok: false, error: 'body incompleto' }, { status: 400 });
  }
  const invalido = validar(body.orden);
  if (invalido) return Response.json({ ok: false, error: invalido }, { status: 400 });

  const folder = FOLDER();
  const xlsxPath = `${folder}/${nombreArchivo(body.orden)}`;

  try {
    const xlsx = await generarXlsx(body.orden);
    await uploadFile(xlsxPath, xlsx);
    await uploadFile(`${folder}/${nombreImagen(body.orden, 'compra')}`, Buffer.from(body.imagenes.compra, 'base64'));
    await uploadFile(`${folder}/${nombreImagen(body.orden, 'reventa')}`, Buffer.from(body.imagenes.reventa, 'base64'));

    // Si la orden se renombró (consecutivo/proveedor/estatus), limpia los archivos anteriores.
    if (body.pathOriginal && body.pathOriginal.toLowerCase() !== xlsxPath.toLowerCase()) {
      await deleteFile(body.pathOriginal);
      const anterior = parseNombre(body.pathOriginal.split('/').pop() || '');
      if (anterior && (anterior.consecutivo !== body.orden.folioConsecutivo.trim() ||
          anterior.proveedor.toUpperCase() !== body.orden.proveedor.trim().toUpperCase())) {
        const viejo = { folioConsecutivo: anterior.consecutivo, proveedor: anterior.proveedor };
        await deleteFile(`${folder}/${nombreImagen(viejo, 'compra')}`);
        await deleteFile(`${folder}/${nombreImagen(viejo, 'reventa')}`);
      }
    }

    return Response.json({ ok: true, path: xlsxPath });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
```

- [ ] **Step 4: Bundle the template for serverless**

En `dashboard/next.config.js`, agregar (o fusionar con lo existente):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/ordenes-directas/guardar': ['./templates/**'],
    },
  },
};

module.exports = nextConfig;
```

(Leer el archivo actual primero y fusionar — no sobrescribir opciones existentes.)

- [ ] **Step 5: Run tests + build**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/guardar/route.test.ts && npm run build`
Expected: PASS (6 tests) y build limpio.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ordenes-directas/guardar next.config.js
git commit -m "feat: route guardar OC Directa (xlsx + 2 PNG a Dropbox, renombrado limpio)"
```

---

### Task 7: `OrdenDirectaForm` — guardar en Dropbox, edición, límite 13 líneas

**Files:**
- Modify: `dashboard/src/components/OrdenDirectaForm.tsx`
- Test: `dashboard/src/components/OrdenDirectaForm.test.tsx` (ampliar)
- Modify: `dashboard/package.json` (dep `html2canvas`)

**Interfaces:**
- Consumes: `MAX_LINEAS`, `type OrdenDirectaDatos` de `@/lib/ocDirectaXlsx`; `html2canvas` (nuevo dep); route de Task 6.
- Produces: props nuevas — `ordenInicial?: OrdenDirectaDatos`, `pathOriginal?: string`, `consecutivoSugerido?: string`, `onGuardado?: () => void`. Consumido por Task 8.

- [ ] **Step 1: Install html2canvas**

Run: `cd dashboard && npm install html2canvas`

- [ ] **Step 2: Add failing tests**

Añadir al final del `describe('OrdenDirectaForm')` existente (y agregar el mock de html2canvas arriba del archivo, junto a los otros mocks):

```tsx
vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({ toDataURL: () => 'data:image/png;base64,QUFBQQ==' })),
}));
```

```tsx
  it('precarga datos con ordenInicial (modo edición)', async () => {
    const orden = {
      folioConsecutivo: '696', entraMty: true, folioMty: '', fecha: '2026-07-03',
      proveedor: 'RODRIGO CALDERA', entidadCompraNombre: 'ELSY GUADALUPE SOSA CHAVEZ',
      entidadReventaNombre: 'ALVARO RESENDIZ GALLEGOS', metodoPago: 'PPD', formaPago: '99-POR DEFINIR',
      retencion: 'NO' as const, margenPorKg: 0.03,
      lineas: [{ material: 'ANTIMONIO', cantidadKg: 1830, unidad: 'KGM', precioNeto: 41 }],
    };
    render(<OrdenDirectaForm credential="c" ordenInicial={orden} pathOriginal="/OC/x.xlsx" />);
    await waitFor(() => expect(screen.getByDisplayValue('696')).toBeInTheDocument());
    expect(screen.getByDisplayValue('RODRIGO CALDERA')).toBeInTheDocument();
    expect(screen.getByText('OC.696/PENDIENTE')).toBeInTheDocument();
  });

  it('usa consecutivoSugerido en modo nueva', async () => {
    render(<OrdenDirectaForm credential="c" consecutivoSugerido="697" />);
    await waitFor(() => expect(screen.getByDisplayValue('697')).toBeInTheDocument());
  });

  it('guardar en Dropbox manda orden + imágenes + pathOriginal y llama onGuardado', async () => {
    const onGuardado = vi.fn();
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes('/guardar')) return { ok: true, json: async () => ({ ok: true, path: '/OC/x.xlsx' }) };
      return { ok: true, json: async () => ({ catalogo: CATALOGO, stale: false }) };
    });
    render(<OrdenDirectaForm credential="c" onGuardado={onGuardado} pathOriginal="/OC/viejo.xlsx" />);
    await llenarFormularioMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar en dropbox/i }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
    const guardarCall = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/guardar'));
    const body = JSON.parse(guardarCall[1].body);
    expect(body.orden.proveedor).toBe('RODRIGO CALDERA');
    expect(body.imagenes.compra).toBe('QUFBQQ==');
    expect(body.imagenes.reventa).toBe('QUFBQQ==');
    expect(body.pathOriginal).toBe('/OC/viejo.xlsx');
  });

  it('límite de 13 líneas: botón agregar se desactiva', async () => {
    render(<OrdenDirectaForm credential="c" />);
    await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
    const boton = screen.getByRole('button', { name: /agregar línea/i });
    for (let i = 0; i < 12; i++) fireEvent.click(boton); // 1 inicial + 12 = 13
    expect(boton).toBeDisabled();
  });
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: FAIL en los 4 tests nuevos (props inexistentes / botón inexistente).

- [ ] **Step 4: Implement the form changes**

En `dashboard/src/components/OrdenDirectaForm.tsx`:

1. Imports nuevos:

```tsx
import { useRef } from 'react'; // añadir a la línea de imports de react
import html2canvas from 'html2canvas';
import { MAX_LINEAS, type OrdenDirectaDatos } from '@/lib/ocDirectaXlsx';
```

2. Props:

```tsx
interface OrdenDirectaFormProps {
  credential: string;
  ordenInicial?: OrdenDirectaDatos;
  pathOriginal?: string;
  consecutivoSugerido?: string;
  onGuardado?: () => void;
}
```

3. Estado inicial desde `ordenInicial` (reemplazar los `useState` correspondientes):

```tsx
export default function OrdenDirectaForm({ credential, ordenInicial, pathOriginal, consecutivoSugerido, onGuardado }: OrdenDirectaFormProps) {
  // ...
  const [folioConsecutivo, setFolioConsecutivo] = useState(ordenInicial?.folioConsecutivo ?? consecutivoSugerido ?? '');
  const [entraMty, setEntraMty] = useState(ordenInicial?.entraMty ?? false);
  const [folioMty, setFolioMty] = useState(ordenInicial?.folioMty ?? '');
  const [fecha, setFecha] = useState(() => ordenInicial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor ?? '');
  const [entidadCompraNombre, setEntidadCompraNombre] = useState(ordenInicial?.entidadCompraNombre ?? '');
  const [entidadReventaNombre, setEntidadReventaNombre] = useState(ordenInicial?.entidadReventaNombre ?? '');
  const [metodoPago, setMetodoPago] = useState(ordenInicial?.metodoPago ?? '');
  const [formaPago, setFormaPago] = useState(ordenInicial?.formaPago ?? '');
  const [retencion, setRetencion] = useState<'SI' | 'NO'>(ordenInicial?.retencion ?? 'NO');
  const [margenPorKg, setMargenPorKg] = useState(String(ordenInicial?.margenPorKg ?? '0'));
  const [lineas, setLineas] = useState<LineaFormState[]>(
    ordenInicial?.lineas.length
      ? ordenInicial.lineas.map((l) => ({ material: l.material, cantidadKg: String(l.cantidadKg), unidad: l.unidad, precioNeto: String(l.precioNeto) }))
      : [lineaVacia()]
  );
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const compraRef = useRef<HTMLDivElement>(null);
  const reventaRef = useRef<HTMLDivElement>(null);
```

4. `agregarLinea` con límite:

```tsx
  function agregarLinea() {
    setLineas((prev) => (prev.length >= MAX_LINEAS ? prev : [...prev, lineaVacia()]));
  }
```

y en el botón: `<button type="button" onClick={agregarLinea} disabled={lineas.length >= MAX_LINEAS} style={ghostBtn}>+ Agregar línea</button>`

5. Función guardar (dentro del componente):

```tsx
  async function capturar(el: HTMLElement | null): Promise<string> {
    if (!el) throw new Error('documento no renderizado');
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    return canvas.toDataURL('image/png').split(',')[1];
  }

  async function guardarEnDropbox() {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const orden: OrdenDirectaDatos = {
        folioConsecutivo, entraMty, folioMty, fecha, proveedor,
        entidadCompraNombre, entidadReventaNombre, metodoPago, formaPago, retencion,
        margenPorKg: Number(margenPorKg) || 0,
        lineas: lineasCaptura
          .filter((l) => l.material && l.cantidadKg !== null && l.precioNeto !== null)
          .map((l) => ({ material: l.material, cantidadKg: l.cantidadKg as number, unidad: l.unidad, precioNeto: l.precioNeto as number })),
      };
      const [compra, reventa] = await Promise.all([capturar(compraRef.current), capturar(reventaRef.current)]);
      const res = await fetch('/api/ordenes-directas/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
        body: JSON.stringify({ orden, imagenes: { compra, reventa }, pathOriginal }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || 'no se pudo guardar');
      onGuardado?.();
    } catch (err) {
      setErrorGuardar((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }
```

6. En la vista de documentos generados: envolver cada `OrdenDirectaPrint` con su ref y agregar el botón guardar junto a "← Editar":

```tsx
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <button type="button" onClick={() => setMostrarImpresion(false)} style={ghostBtn}>← Editar</button>
          <button type="button" onClick={() => imprimir('compra')} style={primaryBtn}>Imprimir / Guardar PDF (Compra)</button>
          <button type="button" onClick={() => imprimir('reventa')} style={primaryBtn}>Imprimir / Guardar PDF (Reventa)</button>
          <button type="button" onClick={guardarEnDropbox} disabled={guardando} style={primaryBtn}>
            {guardando ? 'Guardando…' : 'Guardar en Dropbox'}
          </button>
          {errorGuardar && <span role="alert" style={{ color: 'var(--orange)', fontSize: 12 }}>{errorGuardar}</span>}
        </div>
```

y los wrappers:

```tsx
          <div className="ocd-print-doc" data-doc="compra" ref={compraRef}>
            <OrdenDirectaPrint ... />
          </div>
          <div className="ocd-print-doc" data-doc="reventa" ref={reventaRef}>
            <OrdenDirectaPrint ... />
          </div>
```

- [ ] **Step 5: Run form tests + full suite**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx && npm run test`
Expected: PASS todo (los tests previos del formulario no cambian de comportamiento).

- [ ] **Step 6: Commit**

```bash
git add src/components/OrdenDirectaForm.tsx src/components/OrdenDirectaForm.test.tsx package.json package-lock.json
git commit -m "feat: guardar OC Directa en Dropbox desde el formulario (xlsx + 2 PNG), modo edición, límite 13 líneas"
```

---

### Task 8: `OrdenesDirectas` lista + wiring en `page.tsx`

**Files:**
- Create: `dashboard/src/components/OrdenesDirectas.tsx`
- Test: `dashboard/src/components/OrdenesDirectas.test.tsx`
- Modify: `dashboard/src/app/page.tsx`

**Interfaces:**
- Consumes: routes de Tasks 4/5, `OrdenDirectaForm` (Task 7).
- Produces: `OrdenesDirectas({ credential, onPendientesChange })` — default export. `page.tsx` lo monta para la sección `ordenes-directas` y usa `onPendientesChange` para el contador del nav.

- [ ] **Step 1: Write the failing tests**

```tsx
// dashboard/src/components/OrdenesDirectas.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OrdenesDirectas from './OrdenesDirectas';

const ARCHIVOS = [
  { nombre: 'OC696 RODRIGO CALDERA - PENDIENTE MTY.xlsx', path: '/oc/a.xlsx', consecutivo: '696', proveedor: 'RODRIGO CALDERA', pendienteMty: true, modificado: '2026-07-03T10:00:00Z' },
  { nombre: 'OC695 CESAR DELGADO.xlsx', path: '/oc/b.xlsx', consecutivo: '695', proveedor: 'CESAR DELGADO', pendienteMty: false, modificado: '2026-07-01T10:00:00Z' },
];

const ORDEN = {
  folioConsecutivo: '696', entraMty: true, folioMty: '', fecha: '2026-07-03',
  proveedor: 'RODRIGO CALDERA', entidadCompraNombre: 'ELSY', entidadReventaNombre: 'ALVARO',
  metodoPago: 'PPD', formaPago: '99', retencion: 'NO', margenPorKg: 0,
  lineas: [{ material: 'ANTIMONIO', cantidadKg: 1830, unidad: 'KGM', precioNeto: 41 }],
};

const CATALOGO = {
  materiales: [{ material: 'ANTIMONIO', claveSat: '11191610' }],
  entidadesCompra: [{ nombre: 'ELSY', rfc: 'X', direccion: 'X', regimen: 'X' }],
  entidadesReventa: [{ nombre: 'ALVARO', rfc: 'Y', direccion: 'Y', regimen: 'Y' }],
  proveedores: ['RODRIGO CALDERA'],
  metodosPago: ['PPD'],
  formasPago: ['99'],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
    const u = String(url);
    if (u.includes('/archivos')) return { ok: true, json: async () => ({ archivos: ARCHIVOS, stale: false }) } as Response;
    if (u.includes('/abrir')) return { ok: true, json: async () => ({ orden: ORDEN }) } as Response;
    if (u.includes('/catalogo')) return { ok: true, json: async () => ({ catalogo: CATALOGO, stale: false }) } as Response;
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
});

describe('OrdenesDirectas', () => {
  it('lista archivos con badge de pendiente y reporta pendientes', async () => {
    const onPendientesChange = vi.fn();
    render(<OrdenesDirectas credential="c" onPendientesChange={onPendientesChange} />);
    await waitFor(() => expect(screen.getByText('OC696')).toBeInTheDocument());
    expect(screen.getByText('OC695')).toBeInTheDocument();
    expect(screen.getByText(/PENDIENTE MTY/)).toBeInTheDocument();
    expect(onPendientesChange).toHaveBeenCalledWith(1);
  });

  it('clic en fila abre el formulario precargado', async () => {
    render(<OrdenesDirectas credential="c" onPendientesChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('OC696')).toBeInTheDocument());
    fireEvent.click(screen.getByText('OC696'));
    await waitFor(() => expect(screen.getByDisplayValue('696')).toBeInTheDocument());
    expect(screen.getByDisplayValue('RODRIGO CALDERA')).toBeInTheDocument();
  });

  it('nueva orden sugiere consecutivo max+1', async () => {
    render(<OrdenesDirectas credential="c" onPendientesChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('OC696')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /nueva orden/i }));
    await waitFor(() => expect(screen.getByDisplayValue('697')).toBeInTheDocument());
  });

  it('error al listar muestra mensaje y reintentar', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 503, json: async () => ({ archivos: [] }) });
    render(<OrdenesDirectas credential="c" onPendientesChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OrdenesDirectas.test.tsx`
Expected: FAIL — `Cannot find module './OrdenesDirectas'`

- [ ] **Step 3: Implement the list container**

```tsx
// dashboard/src/components/OrdenesDirectas.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import OrdenDirectaForm from './OrdenDirectaForm';
import type { OrdenDirectaDatos } from '@/lib/ocDirectaXlsx';

interface ArchivoOC {
  nombre: string;
  path: string;
  consecutivo: string;
  proveedor: string;
  pendienteMty: boolean;
  modificado: string;
}

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nueva' }
  | { tipo: 'editar'; orden: OrdenDirectaDatos; path: string };

export default function OrdenesDirectas({
  credential,
  onPendientesChange,
}: {
  credential: string;
  onPendientesChange: (n: number) => void;
}) {
  const [archivos, setArchivos] = useState<ArchivoOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [busqueda, setBusqueda] = useState('');

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ordenes-directas/archivos', {
        headers: { Authorization: `Bearer ${credential}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const body = (await res.json()) as { archivos: ArchivoOC[] };
      setArchivos(body.archivos || []);
      onPendientesChange((body.archivos || []).filter((a) => a.pendienteMty).length);
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

  async function abrir(archivo: ArchivoOC) {
    setAbriendo(archivo.path);
    try {
      const res = await fetch('/api/ordenes-directas/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
        body: JSON.stringify({ path: archivo.path }),
      });
      const body = await res.json();
      if (!res.ok || !body.orden) throw new Error(body.error || 'no se pudo abrir');
      setVista({ tipo: 'editar', orden: body.orden, path: archivo.path });
    } catch {
      setError(true);
    } finally {
      setAbriendo(null);
    }
  }

  const consecutivoSugerido = useMemo(() => {
    const nums = archivos.map((a) => Number(a.consecutivo)).filter(Number.isFinite);
    return nums.length ? String(Math.max(...nums) + 1) : '';
  }, [archivos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return archivos;
    return archivos.filter((a) => a.consecutivo.includes(q) || a.proveedor.toLowerCase().includes(q));
  }, [archivos, busqueda]);

  if (vista.tipo === 'nueva' || vista.tipo === 'editar') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setVista({ tipo: 'lista' })}
          style={{ marginBottom: 16, padding: '8px 14px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--cream-dim)', borderRadius: 3, cursor: 'pointer' }}
        >
          ← Volver a la lista
        </button>
        <OrdenDirectaForm
          credential={credential}
          ordenInicial={vista.tipo === 'editar' ? vista.orden : undefined}
          pathOriginal={vista.tipo === 'editar' ? vista.path : undefined}
          consecutivoSugerido={vista.tipo === 'nueva' ? consecutivoSugerido : undefined}
          onGuardado={() => {
            setVista({ tipo: 'lista' });
            load();
          }}
        />
      </div>
    );
  }

  if (loading) return <p style={{ color: 'var(--cream-dim)' }}>cargando…</p>;

  if (error) {
    return (
      <div style={{ color: 'var(--cream)' }}>
        <p>No se pudieron cargar las órdenes.</p>
        <button type="button" onClick={load}>Reintentar</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--cream)' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Buscar por folio o proveedor…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ padding: '8px 12px', width: 320, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--cream)' }}
        />
        <button
          type="button"
          onClick={() => setVista({ tipo: 'nueva' })}
          style={{ padding: '8px 16px', background: 'var(--orange)', border: '1px solid var(--orange)', color: 'var(--black)', fontWeight: 700, borderRadius: 3, cursor: 'pointer' }}
        >
          + Nueva orden
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--grey)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <th style={{ padding: '8px 10px' }}>Folio</th>
            <th style={{ padding: '8px 10px' }}>Proveedor</th>
            <th style={{ padding: '8px 10px' }}>Estatus</th>
            <th style={{ padding: '8px 10px' }}>Modificado</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((a) => (
            <tr key={a.path} onClick={() => abrir(a)} style={{ cursor: 'pointer', borderTop: '1px solid var(--line)', opacity: abriendo === a.path ? 0.5 : 1 }}>
              <td style={{ padding: '10px', fontWeight: 700, color: 'var(--orange)' }}>OC{a.consecutivo}</td>
              <td style={{ padding: '10px' }}>{a.proveedor}</td>
              <td style={{ padding: '10px' }}>
                {a.pendienteMty ? (
                  <span style={{ padding: '3px 8px', borderRadius: 3, background: 'var(--orange-soft)', color: 'var(--orange)', fontSize: 11, fontWeight: 700 }}>
                    PENDIENTE MTY
                  </span>
                ) : (
                  <span style={{ color: 'var(--grey)', fontSize: 12 }}>Completa</span>
                )}
              </td>
              <td style={{ padding: '10px', color: 'var(--cream-dim)' }}>
                {a.modificado ? new Date(a.modificado).toLocaleString('es-MX') : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtrados.length === 0 && <p style={{ color: 'var(--cream-dim)' }}>Sin órdenes guardadas.</p>}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `page.tsx`**

En `dashboard/src/app/page.tsx`:

1. Reemplazar el import `OrdenDirectaForm` por `OrdenesDirectas`:

```tsx
import OrdenesDirectas from '@/components/OrdenesDirectas';
```

2. Estado nuevo junto a `ordenesCount`: `const [pendientesMty, setPendientesMty] = useState(0);`

3. En `counts`: `'ordenes-directas': pendientesMty,`

4. Mostrar badge cuando hay pendientes (reemplazar la condición actual `s.id !== 'ordenes-directas'`):

```tsx
{(s.id !== 'ordenes-directas' || counts[s.id] > 0) && <span className="nav-count">{counts[s.id]}</span>}
```

5. Render de la sección (reemplaza el `<OrdenDirectaForm credential={user.credential} />` actual):

```tsx
{section === 'ordenes-directas' && (
  <OrdenesDirectas credential={user.credential} onPendientesChange={setPendientesMty} />
)}
```

- [ ] **Step 5: Run all tests + build**

Run: `cd dashboard && npm run test && npm run build`
Expected: PASS completo, build limpio.

- [ ] **Step 6: Commit**

```bash
git add src/components/OrdenesDirectas.tsx src/components/OrdenesDirectas.test.tsx src/app/page.tsx
git commit -m "feat: lista de OC Directa desde Dropbox con edición y contador de pendientes MTY"
```

---

### Task 9: Verificación manual

**Files:** ninguno (QA manual)

- [ ] **Step 1: Deploy preview** (`vercel` desde `dashboard/`) — las env vars de Dropbox ya están en preview.

- [ ] **Step 2: Flujo Mérida**
- Nueva orden → capturar datos con "Entra a Monterrey" marcado, consecutivo MTY vacío → Generar documentos → confirmar folio `OC.<n>/PENDIENTE` en ambos documentos → "Guardar en Dropbox".
- Verificar en Dropbox: `OC<n> <PROVEEDOR> - PENDIENTE MTY.xlsx` + `… COMPRA.png` + `… REVENTA.png`.
- Abrir el xlsx en Excel: fórmulas recalculan (precio unitario, totales, importe en letras vía hoja Pesos), datos correctos.

- [ ] **Step 3: Flujo MTY**
- En el dashboard, lista muestra la orden con badge `PENDIENTE MTY` y el contador del sidebar en 1.
- Abrir la orden → escribir consecutivo MTY (ej. `E641`) → Generar documentos → folio `OC.<n>/E641` → Guardar en Dropbox.
- Verificar en Dropbox: el archivo ` - PENDIENTE MTY.xlsx` desapareció; existe `OC<n> <PROVEEDOR>.xlsx`; PNGs sobrescritos con el folio nuevo.

- [ ] **Step 4: Edición**
- Abrir una orden completa, cambiar una cantidad, guardar → xlsx sobrescrito con el valor nuevo (verificar en Excel).

- [ ] **Step 5: Reportar resultados al usuario** — qué funcionó, cualquier divergencia, y recordar regenerar el app secret de Dropbox (quedó expuesto en el chat) actualizando después `DROPBOX_APP_SECRET` en Vercel.
