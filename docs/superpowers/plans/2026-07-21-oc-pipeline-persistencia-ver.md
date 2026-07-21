# OC Pipeline: Persistencia + Botón "Ver Orden de Compra" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the OC generated from `OcSimpleForm` (Pipeline Compras) to Dropbox as JSON keyed by `opId`, and swap the drawer's "Generar Orden de Compra" button for "Ver Orden de Compra" once one exists — reopening the full document.

**Architecture:** Two new API routes (`GET /api/oc-pipeline/[opId]`, `POST /api/oc-pipeline/guardar`) reuse the existing `dropboxClient.ts` to read/write a JSON file per pipeline record (`<DROPBOX_FOLDER>/Pipeline/<opId>.json`). `OpDrawer.tsx` checks for an existing file on mount and decides which button to render; `OcSimpleForm.tsx` gains an `ordenInicial` prop so the same component can open directly into the read/edit document view instead of the blank capture form.

**Tech Stack:** Next.js App Router route handlers, React (client components), Vitest + Testing Library, existing `dropboxClient.ts` (Dropbox HTTP API).

## Global Constraints

- Auth pattern for both new routes: `Authorization: Bearer <credential>` header + `verifyGoogleCredential` from `@/lib/verifyGoogleToken` (exact pattern used in `dashboard/src/app/api/ordenes-directas/abrir/route.ts` and `.../guardar/route.ts`).
- Dropbox folder: `${process.env.DROPBOX_FOLDER || '/Ordenes de Compra'}/Pipeline/<opId>.json` — no new env vars.
- No PNG snapshot — only JSON of `OrdenCompra` (from `@/lib/ordenesShared`), re-rendered live via `<OrdenPrint>`.
- `OcSimpleForm.tsx` stays network-free (per `2026-07-21-generar-oc-desde-instruccion-design.md`); all `fetch` calls for persistence live in `OpDrawer.tsx`.
- Every existing test file touched must keep passing — `OpDrawer.test.tsx` in particular needs its fetch mocking reworked because a new `GET` fires on every mount of a Compras row (see Task 5).

---

### Task 1: `GET /api/oc-pipeline/[opId]` route

**Files:**
- Create: `dashboard/src/app/api/oc-pipeline/[opId]/route.ts`
- Test: `dashboard/src/app/api/oc-pipeline/[opId]/route.test.ts`

**Interfaces:**
- Consumes: `downloadFile(path: string): Promise<Buffer>` from `@/lib/dropboxClient`; `verifyGoogleCredential(token: string): Promise<{email: string} | null>` from `@/lib/verifyGoogleToken`; `OrdenCompra` type from `@/lib/ordenesShared`.
- Produces: `GET` handler `(request: Request, { params }: { params: { opId: string } }) => Promise<Response>`. Response body `{ orden: OrdenCompra | null, error?: string }`. Status 200 (found), 401 (no auth), 404 (`no_encontrada`), 422 (`formato_no_reconocido`), 503 (Dropbox error). Consumed by `OpDrawer.tsx` in Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/app/api/oc-pipeline/[opId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verifyGoogleToken', () => ({ verifyGoogleCredential: vi.fn() }));
vi.mock('@/lib/dropboxClient', () => ({ downloadFile: vi.fn() }));

import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import { downloadFile } from '@/lib/dropboxClient';

const ORDEN = {
  numero: 'P700', fecha: '2026-07-01', proveedor: 'ACME', negociacion: 'RECOLECCION',
  estatus: '', lineas: [{ material: 'Alum', embalaje: 'Tarima', cantidadKg: 100, precioUnitario: 10, importe: 1000 }],
  total: 1000,
};

const req = (auth = 'Bearer tok') =>
  new Request('http://localhost/api/oc-pipeline/Compras:3', { headers: { Authorization: auth } });

describe('GET /api/oc-pipeline/[opId]', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (verifyGoogleCredential as any).mockResolvedValue({ email: 'a@b.com' });
    process.env.DROPBOX_FOLDER = '/OC';
  });

  it('401 sin token', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://localhost/x'), { params: { opId: 'Compras:3' } });
    expect(res.status).toBe(401);
  });

  it('descarga y parsea el JSON de la carpeta Pipeline', async () => {
    (downloadFile as any).mockResolvedValue(Buffer.from(JSON.stringify(ORDEN)));
    const { GET } = await import('./route');
    const res = await GET(req(), { params: { opId: 'Compras:3' } });
    const body = await res.json();
    expect(downloadFile).toHaveBeenCalledWith('/OC/Pipeline/Compras:3.json');
    expect(body.orden).toEqual(ORDEN);
  });

  it('archivo no existe → 404 no_encontrada', async () => {
    (downloadFile as any).mockRejectedValue(new Error('dropbox_download_error: {"error_summary":"path/not_found/.."}'));
    const { GET } = await import('./route');
    const res = await GET(req(), { params: { opId: 'Compras:3' } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('no_encontrada');
  });

  it('otro error de Dropbox → 503', async () => {
    (downloadFile as any).mockRejectedValue(new Error('dropbox_token_error: boom'));
    const { GET } = await import('./route');
    const res = await GET(req(), { params: { opId: 'Compras:3' } });
    expect(res.status).toBe(503);
  });

  it('JSON corrupto → 422 formato_no_reconocido', async () => {
    (downloadFile as any).mockResolvedValue(Buffer.from('no es json'));
    const { GET } = await import('./route');
    const res = await GET(req(), { params: { opId: 'Compras:3' } });
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/oc-pipeline/[opId]/route.test.ts`
Expected: FAIL — `./route` module does not exist.

- [ ] **Step 3: Write the route**

```ts
// dashboard/src/app/api/oc-pipeline/[opId]/route.ts
import { downloadFile } from '@/lib/dropboxClient';
import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import type { OrdenCompra } from '@/lib/ordenesShared';

export const dynamic = 'force-dynamic';

const FOLDER = () => `${process.env.DROPBOX_FOLDER || '/Ordenes de Compra'}/Pipeline`;

export async function GET(request: Request, { params }: { params: { opId: string } }) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !(await verifyGoogleCredential(header.slice(7)))) {
    return Response.json({ orden: null, error: 'no autorizado' }, { status: 401 });
  }

  const path = `${FOLDER()}/${params.opId}.json`;
  let buffer: Buffer;
  try {
    buffer = await downloadFile(path);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('not_found')) {
      return Response.json({ orden: null, error: 'no_encontrada' }, { status: 404 });
    }
    return Response.json({ orden: null, error: message }, { status: 503 });
  }

  try {
    const orden = JSON.parse(buffer.toString('utf-8')) as OrdenCompra;
    return Response.json({ orden });
  } catch {
    return Response.json({ orden: null, error: 'formato_no_reconocido' }, { status: 422 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run "src/app/api/oc-pipeline/[opId]/route.test.ts"`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add "dashboard/src/app/api/oc-pipeline/[opId]/route.ts" "dashboard/src/app/api/oc-pipeline/[opId]/route.test.ts"
git commit -m "feat: GET /api/oc-pipeline/[opId] -- lee OC guardada de Dropbox"
```

---

### Task 2: `POST /api/oc-pipeline/guardar` route

**Files:**
- Create: `dashboard/src/app/api/oc-pipeline/guardar/route.ts`
- Test: `dashboard/src/app/api/oc-pipeline/guardar/route.test.ts`

**Interfaces:**
- Consumes: `uploadFile(path: string, data: Buffer): Promise<void>`, `dropboxConfigurado(): boolean` from `@/lib/dropboxClient`; `verifyGoogleCredential` from `@/lib/verifyGoogleToken`; `OrdenCompra` from `@/lib/ordenesShared`.
- Produces: `POST` handler `(request: Request) => Promise<Response>`. Body in: `{ opId: string; orden: OrdenCompra }`. Body out: `{ ok: boolean; error?: string }`. Status 200/400/401/503. Consumed by `OpDrawer.tsx` in Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
// dashboard/src/app/api/oc-pipeline/guardar/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/verifyGoogleToken', () => ({ verifyGoogleCredential: vi.fn() }));
vi.mock('@/lib/dropboxClient', () => ({ uploadFile: vi.fn(), dropboxConfigurado: vi.fn(() => true) }));

import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import { uploadFile, dropboxConfigurado } from '@/lib/dropboxClient';

const ORDEN = {
  numero: 'P700', fecha: '2026-07-01', proveedor: 'ACME', negociacion: 'RECOLECCION',
  estatus: '', lineas: [{ material: 'Alum', embalaje: 'Tarima', cantidadKg: 100, precioUnitario: 10, importe: 1000 }],
  total: 1000,
};

const req = (body: unknown, auth = 'Bearer tok') =>
  new Request('http://localhost/api/oc-pipeline/guardar', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/oc-pipeline/guardar', () => {
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

  it('sube el JSON con la ruta opId.json dentro de Pipeline', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ opId: 'Compras:3', orden: ORDEN }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(uploadFile).toHaveBeenCalledWith('/OC/Pipeline/Compras:3.json', Buffer.from(JSON.stringify(ORDEN)));
  });

  it('sin opId → 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ opId: '', orden: ORDEN }));
    expect(res.status).toBe(400);
  });

  it('sin numero → 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ opId: 'Compras:3', orden: { ...ORDEN, numero: '' } }));
    expect(res.status).toBe(400);
  });

  it('sin lineas → 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ opId: 'Compras:3', orden: { ...ORDEN, lineas: [] } }));
    expect(res.status).toBe(400);
  });

  it('Dropbox no configurado → 503', async () => {
    (dropboxConfigurado as any).mockReturnValue(false);
    const { POST } = await import('./route');
    const res = await POST(req({ opId: 'Compras:3', orden: ORDEN }));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/app/api/oc-pipeline/guardar/route.test.ts`
Expected: FAIL — `./route` module does not exist.

- [ ] **Step 3: Write the route**

```ts
// dashboard/src/app/api/oc-pipeline/guardar/route.ts
import { uploadFile, dropboxConfigurado } from '@/lib/dropboxClient';
import { verifyGoogleCredential } from '@/lib/verifyGoogleToken';
import type { OrdenCompra } from '@/lib/ordenesShared';

export const dynamic = 'force-dynamic';

const FOLDER = () => `${process.env.DROPBOX_FOLDER || '/Ordenes de Compra'}/Pipeline`;

interface GuardarBody {
  opId?: string;
  orden?: OrdenCompra;
}

function validar(body: GuardarBody | null): string | null {
  if (!body?.opId?.trim()) return 'opId requerido';
  if (!body.orden?.numero?.trim()) return 'numero requerido';
  if (!body.orden?.proveedor?.trim()) return 'proveedor requerido';
  if (!body.orden?.lineas?.length) return 'al menos una línea';
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
  const invalido = validar(body);
  if (invalido) return Response.json({ ok: false, error: invalido }, { status: 400 });

  const path = `${FOLDER()}/${body!.opId}.json`;
  try {
    await uploadFile(path, Buffer.from(JSON.stringify(body!.orden)));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/app/api/oc-pipeline/guardar/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/oc-pipeline/guardar/route.ts dashboard/src/app/api/oc-pipeline/guardar/route.test.ts
git commit -m "feat: POST /api/oc-pipeline/guardar -- persiste OC pipeline en Dropbox"
```

---

### Task 3: `OcSimpleForm.tsx` — `ordenInicial` prop + `onGenerado(orden)`

**Files:**
- Modify: `dashboard/src/components/OcSimpleForm.tsx`
- Test: `dashboard/src/components/OcSimpleForm.test.tsx`

**Interfaces:**
- Consumes: `OrdenCompra`, `OrdenLinea`, `parseNumero` from `@/lib/ordenesShared` (unchanged import, `OrdenCompra` now also used in the props type).
- Produces: `OcSimpleFormProps` gains `ordenInicial?: OrdenCompra`; `onGenerado` signature changes from `(numero: string) => void` to `(orden: OrdenCompra) => void`. Consumed by `GenerarOcModal.tsx` (Task 4) and `OpDrawer.tsx` (Task 5).

- [ ] **Step 1: Write the failing tests**

Add to `dashboard/src/components/OcSimpleForm.test.tsx` (replace the existing "al generar..." test and add two new ones — full updated file):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OcSimpleForm from './OcSimpleForm';
import type { OrdenCompra } from '@/lib/ordenesShared';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(window, 'print').mockImplementation(() => {});
});

function llenarMinimo() {
  fireEvent.change(screen.getByLabelText('N° de OC'), { target: { value: 'P055' } });
  fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '20000' } });
  fireEvent.change(screen.getByLabelText(/precio unitario/i), { target: { value: '72.50' } });
}

const ORDEN_GUARDADA: OrdenCompra = {
  numero: 'P900', fecha: '2026-07-01', proveedor: 'ACME', negociacion: 'RECOLECCION', estatus: '',
  lineas: [{ material: 'Alum', embalaje: 'Tarima', cantidadKg: 100, precioUnitario: 10, importe: 1000 }],
  total: 1000,
};

describe('OcSimpleForm', () => {
  it('precarga proveedor y material desde las props', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    expect(screen.getByLabelText(/proveedor/i)).toHaveValue('CESAR DELGADO');
    expect(screen.getByLabelText(/material/i)).toHaveValue('CABLE');
  });

  it('calcula importe de línea y total en vivo', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    llenarMinimo();
    expect(screen.getByText('1,450,000')).toBeInTheDocument();
  });

  it('cantidad o precio vacío no rompe el total (importe de esa línea no cuenta)', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    fireEvent.change(screen.getByLabelText('N° de OC'), { target: { value: 'P055' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '20000' } });
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('agrega y quita líneas', () => {
    render(<OcSimpleForm proveedorInicial="X" materialInicial="Y" onGenerado={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }));
    expect(screen.getAllByLabelText(/^material/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /quitar/i })[0]);
    expect(screen.getAllByLabelText(/^material/i)).toHaveLength(1);
  });

  it('botón "Generar documento" deshabilitado sin datos mínimos', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    expect(screen.getByRole('button', { name: /generar documento/i })).toBeDisabled();
    llenarMinimo();
    expect(screen.getByRole('button', { name: /generar documento/i })).not.toBeDisabled();
  });

  it('al generar muestra el documento OrdenPrint y llama onGenerado con la orden completa', () => {
    const onGenerado = vi.fn();
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={onGenerado} />);
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    expect(screen.getByText('ORDEN DE COMPRA')).toBeInTheDocument();
    expect(screen.getByText('P055')).toBeInTheDocument();
    expect(onGenerado).toHaveBeenCalledWith(
      expect.objectContaining({ numero: 'P055', proveedor: 'CESAR DELGADO', total: 1450000 })
    );
  });

  it('"← Editar" regresa a captura sin perder los datos', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText('N° de OC')).toHaveValue('P055');
  });

  it('botón "Imprimir / Guardar PDF" llama window.print', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
    expect(window.print).toHaveBeenCalled();
  });

  it('con ordenInicial arranca directo en la vista de documento', () => {
    render(<OcSimpleForm proveedorInicial="ACME" materialInicial="Alum" ordenInicial={ORDEN_GUARDADA} onGenerado={() => {}} />);
    expect(screen.getByText('ORDEN DE COMPRA')).toBeInTheDocument();
    expect(screen.getByText('P900')).toBeInTheDocument();
    expect(screen.queryByLabelText('N° de OC')).not.toBeInTheDocument();
  });

  it('con ordenInicial, "← Editar" precarga los campos y regenerar llama onGenerado con los datos actualizados', () => {
    const onGenerado = vi.fn();
    render(<OcSimpleForm proveedorInicial="ACME" materialInicial="Alum" ordenInicial={ORDEN_GUARDADA} onGenerado={onGenerado} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText('N° de OC')).toHaveValue('P900');
    fireEvent.change(screen.getByLabelText(/^proveedor/i), { target: { value: 'ACME CORP' } });
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    expect(onGenerado).toHaveBeenCalledWith(expect.objectContaining({ numero: 'P900', proveedor: 'ACME CORP' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OcSimpleForm.test.tsx`
Expected: FAIL — `onGenerado` still called with a string; `ordenInicial` prop not recognized (TS error) and new-view test fails since component ignores the prop.

- [ ] **Step 3: Update `OcSimpleForm.tsx`**

Replace the props interface, component signature, state initialization, and `generar`/document-view block:

```tsx
interface OcSimpleFormProps {
  proveedorInicial: string;
  materialInicial: string;
  ordenInicial?: OrdenCompra;
  onGenerado: (orden: OrdenCompra) => void;
}

export default function OcSimpleForm({ proveedorInicial, materialInicial, ordenInicial, onGenerado }: OcSimpleFormProps) {
  const [numero, setNumero] = useState(ordenInicial?.numero ?? '');
  const [fecha, setFecha] = useState(() => ordenInicial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [negociacion, setNegociacion] = useState(ordenInicial?.negociacion ?? '');
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor ?? proveedorInicial);
  const [lineas, setLineas] = useState<LineaFormState[]>(() =>
    ordenInicial
      ? ordenInicial.lineas.map((l) => ({
          material: l.material,
          embalaje: l.embalaje,
          cantidadKg: l.cantidadKg === null ? '' : String(l.cantidadKg),
          precioUnitario: l.precioUnitario === null ? '' : String(l.precioUnitario),
        }))
      : [lineaVacia(materialInicial)]
  );
  const [mostrarDocumento, setMostrarDocumento] = useState(Boolean(ordenInicial));
```

(the `useMemo` blocks for `lineasCalculadas`/`total` and the field mutators stay exactly as they are)

```tsx
  function construirOrden(): OrdenCompra {
    return { numero, fecha, proveedor, negociacion, estatus: '', lineas: lineasCalculadas, total };
  }

  function generar() {
    setMostrarDocumento(true);
    onGenerado(construirOrden());
  }

  if (mostrarDocumento) {
    const orden = construirOrden();
    return (
```

(the rest of the `mostrarDocumento` JSX block and the capture-form JSX below it are unchanged)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OcSimpleForm.test.tsx`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/OcSimpleForm.tsx dashboard/src/components/OcSimpleForm.test.tsx
git commit -m "feat: OcSimpleForm acepta ordenInicial y onGenerado recibe la orden completa"
```

---

### Task 4: `GenerarOcModal.tsx` — forward `ordenInicial`

**Files:**
- Modify: `dashboard/src/components/GenerarOcModal.tsx`
- Test: `dashboard/src/components/GenerarOcModal.test.tsx`

**Interfaces:**
- Consumes: `OcSimpleForm` (Task 3's new props); `OrdenCompra` type from `@/lib/ordenesShared`.
- Produces: `Props` gains `ordenInicial?: OrdenCompra`; `onGenerado: (orden: OrdenCompra) => void`. Consumed by `OpDrawer.tsx` (Task 5).

- [ ] **Step 1: Write the failing tests**

Full updated `dashboard/src/components/GenerarOcModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GenerarOcModal from './GenerarOcModal';
import type { OrdenCompra } from '@/lib/ordenesShared';

vi.mock('./OcSimpleForm', () => ({
  default: (props: any) => (
    <div data-testid="ocf" data-proveedor={props.proveedorInicial} data-material={props.materialInicial}>
      {props.ordenInicial && <span data-testid="orden-inicial-numero">{props.ordenInicial.numero}</span>}
      <button onClick={() => props.onGenerado({ numero: 'P055', fecha: '2026-01-01', proveedor: 'X', negociacion: '', estatus: '', lineas: [], total: 0 })}>
        simular generado
      </button>
    </div>
  ),
}));

const ORDEN_GUARDADA: OrdenCompra = {
  numero: 'P900', fecha: '2026-07-01', proveedor: 'ACME', negociacion: '', estatus: '', lineas: [], total: 0,
};

describe('GenerarOcModal', () => {
  it('pasa proveedorInicial y materialInicial al formulario', () => {
    render(<GenerarOcModal proveedorInicial="JAVIER V." materialInicial="6063 PAINTED" onClose={() => {}} onGenerado={() => {}} />);
    const ocf = screen.getByTestId('ocf');
    expect(ocf).toHaveAttribute('data-proveedor', 'JAVIER V.');
    expect(ocf).toHaveAttribute('data-material', '6063 PAINTED');
  });

  it('pasa ordenInicial a OcSimpleForm cuando se provee', () => {
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" ordenInicial={ORDEN_GUARDADA} onClose={() => {}} onGenerado={() => {}} />);
    expect(screen.getByTestId('orden-inicial-numero')).toHaveTextContent('P900');
  });

  it('sin ordenInicial no renderiza el span de prueba', () => {
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={() => {}} />);
    expect(screen.queryByTestId('orden-inicial-numero')).not.toBeInTheDocument();
  });

  it('click en el backdrop llama onClose', () => {
    const onClose = vi.fn();
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={onClose} onGenerado={() => {}} />);
    fireEvent.click(screen.getByTestId('ocf').parentElement!.parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it('click en "Cerrar" llama onClose', () => {
    const onClose = vi.fn();
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={onClose} onGenerado={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('delega el guardado del formulario a onGenerado con la orden completa', () => {
    const onGenerado = vi.fn();
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={onGenerado} />);
    fireEvent.click(screen.getByText('simular generado'));
    expect(onGenerado).toHaveBeenCalledWith(expect.objectContaining({ numero: 'P055' }));
  });

  it('muestra error cuando se pasa la prop error', () => {
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={() => {}} error="La operación cambió en otra sesión (conflicto). Recarga." />);
    expect(screen.getByText(/cambió en otra sesión/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/GenerarOcModal.test.tsx`
Expected: FAIL — `ordenInicial` not forwarded, no `orden-inicial-numero` testid rendered.

- [ ] **Step 3: Update `GenerarOcModal.tsx`**

```tsx
'use client';

import OcSimpleForm from './OcSimpleForm';
import type { OrdenCompra } from '@/lib/ordenesShared';

// ...(styles unchanged)...

interface Props {
  proveedorInicial: string;
  materialInicial: string;
  ordenInicial?: OrdenCompra;
  onClose: () => void;
  onGenerado: (orden: OrdenCompra) => void;
  error?: string | null;
}

export default function GenerarOcModal({ proveedorInicial, materialInicial, ordenInicial, onClose, onGenerado, error }: Props) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} style={closeBtn}>
          ← Cerrar
        </button>
        {error && (
          <p style={{ color: '#d9534f', fontFamily: 'var(--font-mono)', fontSize: 12.5, marginTop: 14 }}>{error}</p>
        )}
        <OcSimpleForm
          proveedorInicial={proveedorInicial}
          materialInicial={materialInicial}
          ordenInicial={ordenInicial}
          onGenerado={onGenerado}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/GenerarOcModal.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/GenerarOcModal.tsx dashboard/src/components/GenerarOcModal.test.tsx
git commit -m "feat: GenerarOcModal reenvia ordenInicial a OcSimpleForm"
```

---

### Task 5: `OpDrawer.tsx` — check on mount, swap button, persist on generate

**Files:**
- Modify: `dashboard/src/components/OpDrawer.tsx`
- Test: `dashboard/src/components/OpDrawer.test.tsx`

**Interfaces:**
- Consumes: `GET /api/oc-pipeline/[opId]` (Task 1), `POST /api/oc-pipeline/guardar` (Task 2), `GenerarOcModal` new props (Task 4), `OrdenCompra` from `@/lib/ordenesShared` (already imported).
- Produces: nothing new consumed elsewhere — this is the top-level integration.

- [ ] **Step 1: Write the failing tests**

Full updated `dashboard/src/components/OpDrawer.test.tsx`:

```tsx
// dashboard/src/components/OpDrawer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import OpDrawer from './OpDrawer';

vi.mock('./GenerarOcModal', () => ({
  default: (props: any) => (
    <div data-testid="oc-modal">
      {props.error && <p>{props.error}</p>}
      {props.ordenInicial && <p>ordenInicial: {props.ordenInicial.numero}</p>}
      <button
        onClick={() =>
          props.onGenerado({
            numero: 'P700', fecha: '2026-07-01', proveedor: 'ACME', negociacion: '', estatus: '', lineas: [], total: 0,
          })
        }
      >
        simular generado
      </button>
    </div>
  ),
}));

const row = {
  tipo: 'Compras', fecha: '19/06/2026', usuario: 'jesus', clienteOProveedor: 'ACME', material: 'Alum',
  cargas: 2, status: null, raw: [], rowIndex: 3, opId: 'Compras:3',
  pipeline: { opId: 'Compras:3', contrato: '', track: 'compras', etapa: 'recoleccion', estatusEtapa: 'en_ruta',
    noPO: '', noSDL: 'SDL-1', noEntrada: '', estatusPago: '', mesCierre: '', notas: '', editadoPor: '', editadoFecha: '', rowIndex: 3 },
} as any;

const ORDEN_GUARDADA = {
  numero: 'P900', fecha: '2026-07-01', proveedor: 'ACME', negociacion: 'RECOLECCION', estatus: '',
  lineas: [{ material: 'Alum', embalaje: 'Tarima', cantidadKg: 100, precioUnitario: 10, importe: 1000 }],
  total: 1000,
};

const PATCH_OK = { ok: true, status: 200, json: async () => ({ ok: true, record: {} }) } as any;
const GET_NO_OC = { ok: false, status: 404, json: async () => ({ orden: null, error: 'no_encontrada' }) } as any;
const GUARDAR_OK = { ok: true, status: 200, json: async () => ({ ok: true }) } as any;

function mockFetch(opts: { patch?: any; getOc?: any; guardarOc?: any } = {}) {
  const patch = opts.patch ?? PATCH_OK;
  const getOc = opts.getOc ?? GET_NO_OC;
  const guardarOc = opts.guardarOc ?? GUARDAR_OK;
  return vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any = {}) => {
    const method = (init.method || 'GET') as string;
    const href = String(url);
    if (method === 'GET' && href.includes('/api/oc-pipeline/')) return getOc;
    if (method === 'POST' && href.includes('/api/oc-pipeline/guardar')) return guardarOc;
    return patch;
  });
}

function patchBody(fetchSpy: ReturnType<typeof vi.spyOn>) {
  const call = fetchSpy.mock.calls.find(([, init]: any) => init?.method === 'PATCH')!;
  return JSON.parse((call[1] as RequestInit).body as string);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockFetch();
});

function renderDrawer(pipelineOverrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const r = { ...row, pipeline: { ...row.pipeline, ...pipelineOverrides } };
  return render(<OpDrawer row={r} credential="c" onClose={() => {}} onSaved={() => {}} {...extra} />);
}

describe('OpDrawer', () => {
  it('renders the timeline with the current stage highlighted', () => {
    render(<OpDrawer row={row} credential="c" onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/recoleccion · en_ruta/i)).toBeInTheDocument();
  });

  it('advances the stage via PATCH and calls onSaved on success', async () => {
    const updated = { ...row.pipeline, etapa: 'ingreso', estatusEtapa: 'directa_venta' };
    mockFetch({ patch: { ok: true, status: 200, json: async () => ({ ok: true, record: updated }) } });
    const onSaved = vi.fn();
    render(<OpDrawer row={row} credential="c" onClose={() => {}} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: /avanzar/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Compras:3', updated));
  });

  it('shows a conflict message on 409', async () => {
    mockFetch({ patch: { ok: false, status: 409, json: async () => ({ ok: false, reason: 'conflict' }) } });
    render(<OpDrawer row={row} credential="c" onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /avanzar/i }));
    await waitFor(() => expect(screen.getByText(/cambió|conflicto/i)).toBeInTheDocument());
  });

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

  it('ofrece dropdown de contrato back-to-back en op de Compras y lo manda al guardar', async () => {
    const fetchSpy = mockFetch();
    renderDrawer({ etapa: 'instruccion', contrato: '' }, { contratosVenta: ['CT-1042', 'CT-2000'] });
    fireEvent.change(screen.getByLabelText('Contrato ligado'), { target: { value: 'CT-1042' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(patchBody(fetchSpy).fields.contrato).toBe('CT-1042'));
  });

  it('muestra el counterpart ligado', () => {
    renderDrawer({ etapa: 'instruccion' }, { counterpart: { tipo: 'Terrestre', cliente: 'ACME', contrato: 'CT-1042' } });
    expect(screen.getByText(/ligado a Terrestre/i)).toBeInTheDocument();
  });

  it('sub-estatus al avanzar es dropdown enum en etapa ingreso', () => {
    renderDrawer({ etapa: 'recoleccion' });
    const sel = screen.getByLabelText('Sub-estatus al avanzar') as HTMLSelectElement;
    expect(sel.tagName).toBe('SELECT');
    expect([...sel.options].map((o) => o.value)).toEqual(['', 'bodega', 'directa_venta']);
  });

  it('"Guardar cambios" hace PATCH con etapa actual y fields de ruteo', async () => {
    const fetchSpy = mockFetch();
    renderDrawer({ etapa: 'instruccion' });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'bodega' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => {
      const body = patchBody(fetchSpy);
      expect(body.etapa).toBe('instruccion');
      expect(body.fields.ruta).toBe('bodega');
    });
  });

  it('muestra botón "Generar Orden de Compra" solo en etapa instrucción cuando no hay OC guardada', async () => {
    renderDrawer({ etapa: 'instruccion' });
    await waitFor(() => expect(screen.getByRole('button', { name: /generar orden de compra/i })).toBeInTheDocument());
  });

  it('no muestra botón "Generar Orden de Compra" en otras etapas', async () => {
    renderDrawer({ etapa: 'recoleccion' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /generar orden de compra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver orden de compra/i })).not.toBeInTheDocument();
  });

  it('abre el modal de generar OC y al generar hace PATCH con noPO = numero y guarda el documento', async () => {
    const fetchSpy = mockFetch();
    const onSaved = vi.fn();
    renderDrawer({ etapa: 'instruccion' }, { onSaved });

    await waitFor(() => expect(screen.getByRole('button', { name: /generar orden de compra/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /generar orden de compra/i }));
    expect(screen.getByTestId('oc-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('simular generado'));
    await waitFor(() => expect(patchBody(fetchSpy).fields.noPO).toBe('P700'));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([url, init]: any) => init?.method === 'POST' && String(url).includes('/api/oc-pipeline/guardar'));
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body).toEqual({ opId: 'Compras:3', orden: { numero: 'P700', fecha: '2026-07-01', proveedor: 'ACME', negociacion: '', estatus: '', lineas: [], total: 0 } });
    });
  });

  it('si el PATCH de noPO falla (409), muestra el error dentro del modal, lo mantiene abierto y NO intenta guardar el documento', async () => {
    const fetchSpy = mockFetch({ patch: { ok: false, status: 409, json: async () => ({ ok: false, reason: 'conflict' }) } });
    renderDrawer({ etapa: 'instruccion' });

    await waitFor(() => expect(screen.getByRole('button', { name: /generar orden de compra/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /generar orden de compra/i }));
    expect(screen.getByTestId('oc-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('simular generado'));
    const ocModal = screen.getByTestId('oc-modal');
    await waitFor(() => expect(within(ocModal).getByText(/cambió|conflicto/i)).toBeInTheDocument());
    expect(screen.getByTestId('oc-modal')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([url, init]: any) => init?.method === 'POST' && String(url).includes('/api/oc-pipeline/guardar'))).toBe(false);
  });

  it('si el PATCH de noPO tiene éxito, el modal permanece abierto para poder imprimir (no se auto-cierra)', async () => {
    mockFetch();
    renderDrawer({ etapa: 'instruccion' });

    await waitFor(() => expect(screen.getByRole('button', { name: /generar orden de compra/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /generar orden de compra/i }));
    expect(screen.getByTestId('oc-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('simular generado'));
    await waitFor(() => expect(screen.getByTestId('oc-modal')).toBeInTheDocument());
  });

  it('limpia un error de guardado previo (advance/guardarCambios) antes de abrir el modal de OC', async () => {
    mockFetch({ patch: { ok: false, status: 409, json: async () => ({ ok: false, reason: 'conflict' }) } });
    renderDrawer({ etapa: 'instruccion' });

    fireEvent.click(screen.getByRole('button', { name: /avanzar/i }));
    await waitFor(() => expect(screen.getByText(/cambió|conflicto/i)).toBeInTheDocument());

    await waitFor(() => expect(screen.getByRole('button', { name: /generar orden de compra/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /generar orden de compra/i }));
    const ocModal = screen.getByTestId('oc-modal');
    expect(within(ocModal).queryByText(/cambió|conflicto/i)).not.toBeInTheDocument();
  });

  it('muestra botón "Ver Orden de Compra" si ya existe una OC guardada para este opId', async () => {
    mockFetch({ getOc: { ok: true, status: 200, json: async () => ({ orden: ORDEN_GUARDADA }) } });
    renderDrawer({ etapa: 'instruccion' });
    await waitFor(() => expect(screen.getByRole('button', { name: /ver orden de compra/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^generar orden de compra$/i })).not.toBeInTheDocument();
  });

  it('"Ver Orden de Compra" sigue visible fuera de la etapa instrucción', async () => {
    mockFetch({ getOc: { ok: true, status: 200, json: async () => ({ orden: ORDEN_GUARDADA }) } });
    renderDrawer({ etapa: 'recoleccion' });
    await waitFor(() => expect(screen.getByRole('button', { name: /ver orden de compra/i })).toBeInTheDocument());
  });

  it('abre el modal con la orden guardada al hacer clic en "Ver Orden de Compra"', async () => {
    mockFetch({ getOc: { ok: true, status: 200, json: async () => ({ orden: ORDEN_GUARDADA }) } });
    renderDrawer({ etapa: 'instruccion' });
    await waitFor(() => expect(screen.getByRole('button', { name: /ver orden de compra/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ver orden de compra/i }));
    expect(screen.getByText('ordenInicial: P900')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: FAIL — no `GET /api/oc-pipeline` call happens, no "Ver Orden de Compra" button exists, `guardarNoPO` still sends only `noPO` PATCH without the follow-up guardar POST.

- [ ] **Step 3: Update `OpDrawer.tsx`**

Import changes (top of file):

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { FeedRow } from '@/lib/normalizeFeed';
import { recordToValues, type PipelineRecord, type Etapa } from '@/lib/pipelineSchema';
import { etapasFor, transicionesValidas, estatusOpciones, estatusLabel, modalidadDesdeOrigen } from '@/lib/pipelineMachine';
import { matchOrden, type OrdenCompra } from '@/lib/ordenesShared';
import GenerarOcModal from './GenerarOcModal';
```

New state + effect, placed right after the existing `useState` block (after current line `const [showOcModal, setShowOcModal] = useState(false);`, still before the `if (!record) return (...)` guard):

```tsx
  const [showOcModal, setShowOcModal] = useState(false);
  const [ocExistente, setOcExistente] = useState<OrdenCompra | null>(null);

  useEffect(() => {
    if (!record || record.track !== 'compras') return;
    let cancelado = false;
    fetch(`/api/oc-pipeline/${encodeURIComponent(record.opId)}`, {
      headers: { Authorization: `Bearer ${credential}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelado && body?.orden) setOcExistente(body.orden as OrdenCompra);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.opId, record?.track, credential]);
```

Replace `guardarNoPO` (renamed `guardarOc`, takes the full `orden`):

```tsx
  async function guardarOc(orden: OrdenCompra) {
    setError(null);
    setSaving(true);
    let noPOGuardado = false;
    try {
      const res = await fetch(`/api/pipeline/${encodeURIComponent(record!.opId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa: record!.etapa,
          estatusEtapa: record!.estatusEtapa,
          fields: { ...ruteo, ...trabajos, contrato, noPO: orden.numero },
          expectedValues: recordToValues(record!),
          credential,
        }),
      });
      const body = await res.json();
      if (res.status === 200 && body.ok) {
        setNoPO(orden.numero);
        onSaved(record!.opId, body.record);
        noPOGuardado = true;
      } else if (res.status === 409) {
        setError('La operación cambió en otra sesión (conflicto). Recarga.');
      } else {
        setError(body.message || 'No se pudo guardar.');
      }
    } finally {
      setSaving(false);
    }
    if (!noPOGuardado) return;

    try {
      const res = await fetch('/api/oc-pipeline/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
        body: JSON.stringify({ opId: record!.opId, orden }),
      });
      const body = await res.json();
      if (body.ok) {
        setOcExistente(orden);
      } else {
        setError(body.error || 'No se pudo guardar el documento.');
      }
    } catch {
      setError('No se pudo guardar el documento.');
    }
  }
```

Replace the button block (currently `{record.etapa === 'instruccion' && (<button ...>Generar Orden de Compra</button>)}`):

```tsx
            {ocExistente ? (
              <button type="button" onClick={() => { setError(null); setShowOcModal(true); }} style={{ ...primaryBtn, marginTop: 14 }}>
                Ver Orden de Compra
              </button>
            ) : record.etapa === 'instruccion' ? (
              <button type="button" onClick={() => { setError(null); setShowOcModal(true); }} style={{ ...primaryBtn, marginTop: 14 }}>
                Generar Orden de Compra
              </button>
            ) : null}
```

Replace the modal render at the bottom:

```tsx
      {showOcModal && (
        <GenerarOcModal
          proveedorInicial={row.clienteOProveedor}
          materialInicial={row.material}
          ordenInicial={ocExistente ?? undefined}
          onClose={() => setShowOcModal(false)}
          onGenerado={guardarOc}
          error={error}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: PASS (18 tests)

- [ ] **Step 5: Run the full test suite**

Run: `cd dashboard && npx vitest run`
Expected: PASS, no regressions in unrelated files.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/OpDrawer.tsx dashboard/src/components/OpDrawer.test.tsx
git commit -m "feat: OpDrawer checa OC guardada al montar, alterna Generar/Ver y persiste al generar"
```

---

## Manual verification (after Task 5)

1. `cd dashboard && npm run dev`, abrir un op de Compras en etapa `instruccion` sin OC generada → ver botón "Generar Orden de Compra".
2. Generar una OC → confirmar que el botón "Imprimir / Guardar PDF" sigue funcionando y el modal no se autocierra.
3. Cerrar el modal, cerrar y reabrir el drawer (o recargar la página) → el botón ahora dice "Ver Orden de Compra".
4. Avanzar el op a la siguiente etapa, reabrir el drawer → "Ver Orden de Compra" sigue visible.
5. Clic en "Ver Orden de Compra" → se abre el mismo documento con los datos capturados originalmente.
6. Revisar en Dropbox (`/Ordenes de Compra/Pipeline/`) que existe `<opId>.json` con el contenido esperado.
