# Generar Orden de Compra desde la instrucción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generar Orden de Compra" button to the pipeline detail drawer (`OpDrawer`), visible only on the `instruccion` stage of Compras operations, that opens the existing OC form pre-filled with proveedor/material and writes the resulting folio back to the pipeline record's `noPO` field.

**Architecture:** Reuse the existing `OrdenDirectaForm` (today only reachable from the standalone "Órdenes Directas" tab) inside a new full-screen modal (`GenerarOcModal`). The modal fetches its own `consecutivoSugerido` the same way `OrdenesDirectas.tsx` already does. `OrdenDirectaForm` gains two prefill props and its `onGuardado` callback now carries the generated folio, so the modal can hand it to `OpDrawer`, which PATCHes the pipeline record's `noPO`.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Vitest + Testing Library.

## Global Constraints

- No API route changes — only existing `/api/pipeline/{opId}` PATCH and `/api/ordenes-directas/archivos` GET are used, both already implemented.
- No new dependencies.
- Follow existing inline-style patterns (`var(--...)` CSS custom properties) already used in `OpDrawer.tsx` / `OrdenDirectaForm.tsx` / `OrdenesDirectas.tsx` — no CSS modules, no Tailwind.
- Button/label text in Spanish, matching the rest of the app ("Generar Orden de Compra", "Cerrar").

---

### Task 1: `OrdenDirectaForm` — prefill props + folio in `onGuardado`

**Files:**
- Modify: `dashboard/src/components/OrdenDirectaForm.tsx:95-101` (props interface), `:103` (function signature), `:112` (proveedor state), `:122-126` (lineas state), `:233` (onGuardado call)
- Test: `dashboard/src/components/OrdenDirectaForm.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `OrdenDirectaFormProps` gains `proveedorInicial?: string`, `materialInicial?: string`; `onGuardado?: (folio: string) => void` (was `() => void`). Later tasks (`GenerarOcModal`) rely on exactly these three prop names and the folio-carrying callback.

- [ ] **Step 1: Write the failing tests**

Add to `dashboard/src/components/OrdenDirectaForm.test.tsx`, inside the existing `describe('OrdenDirectaForm', ...)` block (after the last `it(...)`, before the closing `});`):

```tsx
  it('precarga proveedor y material vía proveedorInicial/materialInicial (nueva orden)', async () => {
    render(<OrdenDirectaForm credential="c" proveedorInicial="RODRIGO CALDERA" materialInicial="ANTIMONIO" />);
    await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
    expect(screen.getByDisplayValue('RODRIGO CALDERA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ANTIMONIO')).toBeInTheDocument();
  });

  it('onGuardado recibe el folio generado al guardar en Dropbox', async () => {
    const onGuardado = vi.fn();
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes('/guardar')) return { ok: true, json: async () => ({ ok: true, path: '/OC/x.xlsx' }) };
      return { ok: true, json: async () => ({ catalogo: CATALOGO, stale: false }) };
    });
    render(<OrdenDirectaForm credential="c" onGuardado={onGuardado} />);
    await llenarFormularioMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar en dropbox/i }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith('OC.696/Directo'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: FAIL — first new test fails because `getByDisplayValue('RODRIGO CALDERA')`/`'ANTIMONIO'` find nothing (props don't exist yet); second fails because `onGuardado` is called with no arguments (`toHaveBeenCalledWith('OC.696/Directo')` fails).

- [ ] **Step 3: Implement the prop plumbing**

In `dashboard/src/components/OrdenDirectaForm.tsx`, replace the props interface (currently lines 95-101):

```tsx
interface OrdenDirectaFormProps {
  credential: string;
  ordenInicial?: OrdenDirectaDatos;
  pathOriginal?: string;
  consecutivoSugerido?: string;
  onGuardado?: () => void;
}
```

with:

```tsx
interface OrdenDirectaFormProps {
  credential: string;
  ordenInicial?: OrdenDirectaDatos;
  pathOriginal?: string;
  consecutivoSugerido?: string;
  proveedorInicial?: string;
  materialInicial?: string;
  onGuardado?: (folio: string) => void;
}
```

Replace the function signature (currently line 103):

```tsx
export default function OrdenDirectaForm({ credential, ordenInicial, pathOriginal, consecutivoSugerido, onGuardado }: OrdenDirectaFormProps) {
```

with:

```tsx
export default function OrdenDirectaForm({ credential, ordenInicial, pathOriginal, consecutivoSugerido, proveedorInicial, materialInicial, onGuardado }: OrdenDirectaFormProps) {
```

Replace the `proveedor` state initializer (currently line 112):

```tsx
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor ?? '');
```

with:

```tsx
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor ?? proveedorInicial ?? '');
```

Replace the `lineas` state initializer (currently lines 122-126):

```tsx
  const [lineas, setLineas] = useState<LineaFormState[]>(
    ordenInicial?.lineas.length
      ? ordenInicial.lineas.map((l) => ({ material: l.material, cantidadKg: String(l.cantidadKg), unidad: l.unidad, precioNeto: String(l.precioNeto) }))
      : [lineaVacia()]
  );
```

with:

```tsx
  const [lineas, setLineas] = useState<LineaFormState[]>(
    ordenInicial?.lineas.length
      ? ordenInicial.lineas.map((l) => ({ material: l.material, cantidadKg: String(l.cantidadKg), unidad: l.unidad, precioNeto: String(l.precioNeto) }))
      : [{ ...lineaVacia(), material: materialInicial ?? '' }]
  );
```

Replace the `onGuardado` call inside `guardarEnDropbox` (currently line 233):

```tsx
      setGuardadoOk(true);
      onGuardado?.();
```

with:

```tsx
      setGuardadoOk(true);
      onGuardado?.(folio);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: PASS (all tests, including the two new ones)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/OrdenDirectaForm.tsx dashboard/src/components/OrdenDirectaForm.test.tsx
git commit -m "feat: OrdenDirectaForm acepta proveedor/material inicial y devuelve folio al guardar"
```

---

### Task 2: `GenerarOcModal` component

**Files:**
- Create: `dashboard/src/components/GenerarOcModal.tsx`
- Test: `dashboard/src/components/GenerarOcModal.test.tsx`

**Interfaces:**
- Consumes: `OrdenDirectaForm` from Task 1 — props `credential`, `proveedorInicial`, `materialInicial`, `consecutivoSugerido`, `onGuardado: (folio: string) => void`.
- Produces: `GenerarOcModal` component with props `{ credential: string; proveedorInicial: string; materialInicial: string; onClose: () => void; onGenerado: (folio: string) => void }`. Task 3 (`OpDrawer`) imports this default export and these exact prop names.

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/components/GenerarOcModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GenerarOcModal from './GenerarOcModal';

vi.mock('./OrdenDirectaForm', () => ({
  default: (props: any) => (
    <div
      data-testid="odf"
      data-consecutivo={props.consecutivoSugerido}
      data-proveedor={props.proveedorInicial}
      data-material={props.materialInicial}
    >
      <button onClick={() => props.onGuardado('OC.699/Directo')}>simular guardado</button>
    </div>
  ),
}));

const ARCHIVOS = [
  { nombre: 'a', path: '/oc/a.xlsx', consecutivo: '698', proveedor: 'X', pendienteMty: false, modificado: '' },
  { nombre: 'b', path: '/oc/b.xlsx', consecutivo: '650', proveedor: 'Y', pendienteMty: false, modificado: '' },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ archivos: ARCHIVOS }),
  } as Response);
});

describe('GenerarOcModal', () => {
  it('pasa proveedorInicial y materialInicial al formulario', () => {
    render(<GenerarOcModal credential="c" proveedorInicial="JAVIER V." materialInicial="6063 PAINTED" onClose={() => {}} onGenerado={() => {}} />);
    const odf = screen.getByTestId('odf');
    expect(odf).toHaveAttribute('data-proveedor', 'JAVIER V.');
    expect(odf).toHaveAttribute('data-material', '6063 PAINTED');
  });

  it('calcula consecutivo sugerido como max+1 de archivos existentes', async () => {
    render(<GenerarOcModal credential="c" proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('odf')).toHaveAttribute('data-consecutivo', '699'));
  });

  it('click en el backdrop llama onClose', () => {
    const onClose = vi.fn();
    render(<GenerarOcModal credential="c" proveedorInicial="X" materialInicial="Y" onClose={onClose} onGenerado={() => {}} />);
    fireEvent.click(screen.getByTestId('odf').parentElement!.parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it('click en "Cerrar" llama onClose', () => {
    const onClose = vi.fn();
    render(<GenerarOcModal credential="c" proveedorInicial="X" materialInicial="Y" onClose={onClose} onGenerado={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('delega el guardado del formulario a onGenerado con el folio', () => {
    const onGenerado = vi.fn();
    render(<GenerarOcModal credential="c" proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={onGenerado} />);
    fireEvent.click(screen.getByText('simular guardado'));
    expect(onGenerado).toHaveBeenCalledWith('OC.699/Directo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/components/GenerarOcModal.test.tsx`
Expected: FAIL with "Failed to resolve import ./GenerarOcModal" (file doesn't exist yet)

- [ ] **Step 3: Implement `GenerarOcModal.tsx`**

Create `dashboard/src/components/GenerarOcModal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import OrdenDirectaForm from './OrdenDirectaForm';

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  zIndex: 60,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  overflowY: 'auto',
  padding: '40px 20px',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--black)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: 24,
  width: '100%',
  maxWidth: 900,
};

const closeBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 3,
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--cream-dim)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  marginBottom: 16,
};

interface Props {
  credential: string;
  proveedorInicial: string;
  materialInicial: string;
  onClose: () => void;
  onGenerado: (folio: string) => void;
}

export default function GenerarOcModal({ credential, proveedorInicial, materialInicial, onClose, onGenerado }: Props) {
  const [consecutivoSugerido, setConsecutivoSugerido] = useState('');

  useEffect(() => {
    let cancelado = false;
    fetch('/api/ordenes-directas/archivos', { headers: { Authorization: `Bearer ${credential}` } })
      .then((res) => (res.ok ? res.json() : { archivos: [] }))
      .then((body: { archivos?: { consecutivo: string }[] }) => {
        if (cancelado) return;
        const nums = (body.archivos || []).map((a) => Number(a.consecutivo)).filter(Number.isFinite);
        setConsecutivoSugerido(nums.length ? String(Math.max(...nums) + 1) : '');
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [credential]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} style={closeBtn}>
          ← Cerrar
        </button>
        <OrdenDirectaForm
          credential={credential}
          proveedorInicial={proveedorInicial}
          materialInicial={materialInicial}
          consecutivoSugerido={consecutivoSugerido}
          onGuardado={onGenerado}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/components/GenerarOcModal.test.tsx`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/GenerarOcModal.tsx dashboard/src/components/GenerarOcModal.test.tsx
git commit -m "feat: agrega GenerarOcModal (overlay con OrdenDirectaForm precargado)"
```

---

### Task 3: Wire button + PATCH into `OpDrawer`

**Files:**
- Modify: `dashboard/src/components/OpDrawer.tsx`
- Test: `dashboard/src/components/OpDrawer.test.tsx`

**Interfaces:**
- Consumes: `GenerarOcModal` from Task 2 — `{ credential, proveedorInicial, materialInicial, onClose, onGenerado }`.
- Produces: nothing new consumed elsewhere — this is the top of the chain.

- [ ] **Step 1: Write the failing tests**

Add to the top of `dashboard/src/components/OpDrawer.test.tsx`, after the existing imports (after line 4, before the `const row = ...` block):

```tsx
vi.mock('./GenerarOcModal', () => ({
  default: (props: any) => (
    <div data-testid="oc-modal">
      <button onClick={() => props.onGenerado('OC.700/Directo')}>simular generado</button>
    </div>
  ),
}));
```

Add inside `describe('OpDrawer', ...)`, after the last existing `it(...)` (after the `'"Guardar cambios" hace PATCH...'` test, before the closing `});`):

```tsx
  it('muestra botón "Generar Orden de Compra" solo en etapa instrucción', () => {
    renderDrawer({ etapa: 'instruccion' });
    expect(screen.getByRole('button', { name: /generar orden de compra/i })).toBeInTheDocument();
  });

  it('no muestra botón "Generar Orden de Compra" en otras etapas', () => {
    renderDrawer({ etapa: 'recoleccion' });
    expect(screen.queryByRole('button', { name: /generar orden de compra/i })).not.toBeInTheDocument();
  });

  it('abre el modal de generar OC y al generar hace PATCH con noPO = folio', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true, record: {} }),
    } as any);
    const onSaved = vi.fn();
    renderDrawer({ etapa: 'instruccion' }, { onSaved } as any);

    fireEvent.click(screen.getByRole('button', { name: /generar orden de compra/i }));
    expect(screen.getByTestId('oc-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('simular generado'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.fields.noPO).toBe('OC.700/Directo');
  });
```

Note: `renderDrawer`'s `extra` param spreads onto the rendered props, so passing `{ onSaved } as any` as the second argument overrides the default no-op `onSaved` from `renderDrawer`'s own JSX (see helper at lines 17-20).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: FAIL — button not found (doesn't exist yet) on all three new tests.

- [ ] **Step 3: Implement the button, modal wiring, and PATCH**

In `dashboard/src/components/OpDrawer.tsx`, add the import (after line 7, the `matchOrden` import):

```tsx
import GenerarOcModal from './GenerarOcModal';
```

Add a new state variable alongside the others (after line 73, `const [saving, setSaving] = useState(false);`):

```tsx
  const [showOcModal, setShowOcModal] = useState(false);
```

Add a new function after `guardarCambios` (after line 157, the closing `}` of `guardarCambios`, before the `return (` on line 159):

```tsx
  async function guardarNoPO(folio: string) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/pipeline/${encodeURIComponent(record!.opId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa: record!.etapa,
          estatusEtapa: record!.estatusEtapa,
          fields: { ...ruteo, ...trabajos, contrato, noPO: folio },
          expectedValues: recordToValues(record!),
          credential,
        }),
      });
      const body = await res.json();
      if (res.status === 200 && body.ok) {
        setNoPO(folio);
        onSaved(record!.opId, body.record);
        setShowOcModal(false);
      } else if (res.status === 409) {
        setError('La operación cambió en otra sesión (conflicto). Recarga.');
      } else {
        setError(body.message || 'No se pudo guardar.');
      }
    } finally {
      setSaving(false);
    }
  }
```

Add the button inside the `esCompras` block, right after the `noPO` input's helper text and before the `Ruta` label (insert after line 219, the closing `)}` of the `ordenMatch` hint, before line 221's `<label style={labelStyle} htmlFor="ruta">Ruta</label>`):

```tsx
            {record.etapa === 'instruccion' && (
              <button type="button" onClick={() => setShowOcModal(true)} style={{ ...primaryBtn, marginTop: 14 }}>
                Generar Orden de Compra
              </button>
            )}

```

Render the modal at the end of the component, right after the closing `</aside>` and before the closing `</>` (insert after line 329, `</aside>`, before line 330 `</>`):

```tsx
        {showOcModal && (
          <GenerarOcModal
            credential={credential}
            proveedorInicial={row.clienteOProveedor}
            materialInicial={row.material}
            onClose={() => setShowOcModal(false)}
            onGenerado={guardarNoPO}
          />
        )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: PASS (all tests, including the three new ones)

- [ ] **Step 5: Run the full test suite**

Run: `cd dashboard && npx vitest run`
Expected: PASS — no regressions in other suites (`OrdenesDirectas.test.tsx`, `OrdenesCompra.test.tsx`, etc. are unaffected by these changes)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/OpDrawer.tsx dashboard/src/components/OpDrawer.test.tsx
git commit -m "feat: botón Generar Orden de Compra en etapa instrucción del drawer"
```
