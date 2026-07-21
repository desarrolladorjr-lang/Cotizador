# Generar Orden de Compra desde la instrucción (v2 — formato OrdenPrint) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Generar Orden de Compra" flow already wired into `OpDrawer.tsx` (which currently opens the wrong document — `OrdenDirectaForm`, the compra/reventa Dropbox flow) with a simple capture form that produces the actual OC document format (`OrdenPrint.tsx` — N° OC, Negociación, Proveedor, líneas Material/Embalaje/Cantidad/Precio/Importe) and prints/PDFs it. No network calls, no persistence.

**Architecture:** New component `OcSimpleForm.tsx` — pure client-side capture (no fetch), computed totals via `useMemo`, generates an `OrdenCompra` object (existing type from `@/lib/ordenesShared`) and renders it through the existing `OrdenPrint.tsx` component for printing. `GenerarOcModal.tsx` (already built, already reviewed) swaps its child from `OrdenDirectaForm` to `OcSimpleForm` and drops the now-unneeded `credential` prop and consecutivo-fetching `useEffect`. `OrdenDirectaForm.tsx` reverts to its pre-this-feature state (the `proveedorInicial`/`materialInicial`/folio-carrying-`onGuardado` props added by the previous (now superseded) plan have no remaining consumer).

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Vitest + Testing Library.

## Global Constraints

- No API route changes, no network calls anywhere in this new flow — `OcSimpleForm` is pure client-side state + `window.print()`.
- No new dependencies.
- Follow existing inline-style patterns (`var(--...)` CSS custom properties) already used in the codebase — no CSS modules, no Tailwind.
- Reuse the existing `.oc-print-area` / `OrdenPrint.tsx` print pipeline verbatim — do not create a new print stylesheet.
- Button/label text in Spanish, matching the rest of the app.
- No numbering system, no catalog, no history/list for this flow — free-text capture, generate, print, done.

---

### Task 1: Revert `OrdenDirectaForm.tsx` prefill props (dead code after this replacement)

**Files:**
- Modify: `dashboard/src/components/OrdenDirectaForm.tsx:100-102` (props interface), `:105` (function signature), `:114` (proveedor state), `:122-127` (lineas state), `:233-235` (onGuardado call)
- Modify: `dashboard/src/components/OrdenDirectaForm.test.tsx:195-213` (remove the two tests added by the superseded plan)

**Interfaces:**
- Consumes: nothing.
- Produces: `OrdenDirectaForm`'s public props return to their pre-existing shape: `{ credential, ordenInicial?, pathOriginal?, consecutivoSugerido?, onGuardado?: () => void }`. `OrdenesDirectas.tsx` (`onGuardado={load}`) is the only consumer and needs no change either direction — this task only removes what's now unused.

- [ ] **Step 1: Remove the two now-obsolete tests**

In `dashboard/src/components/OrdenDirectaForm.test.tsx`, delete these two `it(...)` blocks (currently lines 195-213, immediately before the `describe` block's closing `});`):

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

Leave the `describe('OrdenDirectaForm', ...) { ... });` wrapper and all other tests untouched.

- [ ] **Step 2: Run the file's tests to confirm the baseline (pre-revert-code) state**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: PASS (13 tests — the component code hasn't changed yet, only the two obsolete tests were removed; nothing references `proveedorInicial`/`materialInicial` in the remaining tests, so this passes before Step 3 too)

- [ ] **Step 3: Revert the component code**

In `dashboard/src/components/OrdenDirectaForm.tsx`, replace the props interface (currently lines 96-103):

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

with:

```tsx
interface OrdenDirectaFormProps {
  credential: string;
  ordenInicial?: OrdenDirectaDatos;
  pathOriginal?: string;
  consecutivoSugerido?: string;
  onGuardado?: () => void;
}
```

Replace the function signature (currently line 105):

```tsx
export default function OrdenDirectaForm({ credential, ordenInicial, pathOriginal, consecutivoSugerido, proveedorInicial, materialInicial, onGuardado }: OrdenDirectaFormProps) {
```

with:

```tsx
export default function OrdenDirectaForm({ credential, ordenInicial, pathOriginal, consecutivoSugerido, onGuardado }: OrdenDirectaFormProps) {
```

Replace the `proveedor` state initializer (currently line 114):

```tsx
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor ?? proveedorInicial ?? '');
```

with:

```tsx
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor ?? '');
```

Replace the `lineas` state initializer (currently lines 122-127):

```tsx
  const [lineas, setLineas] = useState<LineaFormState[]>(
    ordenInicial?.lineas.length
      ? ordenInicial.lineas.map((l) => ({ material: l.material, cantidadKg: String(l.cantidadKg), unidad: l.unidad, precioNeto: String(l.precioNeto) }))
      : [{ ...lineaVacia(), material: materialInicial ?? '' }]
  );
```

with:

```tsx
  const [lineas, setLineas] = useState<LineaFormState[]>(
    ordenInicial?.lineas.length
      ? ordenInicial.lineas.map((l) => ({ material: l.material, cantidadKg: String(l.cantidadKg), unidad: l.unidad, precioNeto: String(l.precioNeto) }))
      : [lineaVacia()]
  );
```

Replace the `onGuardado` call inside `guardarEnDropbox` (currently line 235):

```tsx
      setGuardadoOk(true);
      onGuardado?.(folio);
```

with:

```tsx
      setGuardadoOk(true);
      onGuardado?.();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
cd dashboard
git add src/components/OrdenDirectaForm.tsx src/components/OrdenDirectaForm.test.tsx
git commit -m "revert: quita props proveedorInicial/materialInicial de OrdenDirectaForm (sin uso tras cambio de formato de OC)"
```

---

### Task 2: `OcSimpleForm` component

**Files:**
- Create: `dashboard/src/components/OcSimpleForm.tsx`
- Test: `dashboard/src/components/OcSimpleForm.test.tsx`

**Interfaces:**
- Consumes: `OrdenPrint` (existing, unchanged) from `dashboard/src/components/OrdenPrint.tsx` — `<OrdenPrint orden={orden} />` where `orden: OrdenCompra` (type from `@/lib/ordenesShared`: `{ numero: string; fecha: string; proveedor: string; negociacion: string; estatus: string; lineas: OrdenLinea[]; total: number }`, `OrdenLinea = { material: string; embalaje: string; cantidadKg: number | null; precioUnitario: number | null; importe: number | null }`). `parseNumero` (existing, from `@/lib/ordenesShared`) for parsing numeric input strings the same way the rest of the app does.
- Produces: `OcSimpleForm` default export with props `{ proveedorInicial: string; materialInicial: string; onGenerado: (numero: string) => void }`. Task 3 (`GenerarOcModal`) renders this component with exactly these prop names.

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/components/OcSimpleForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OcSimpleForm from './OcSimpleForm';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(window, 'print').mockImplementation(() => {});
});

function llenarMinimo() {
  fireEvent.change(screen.getByLabelText(/n.*oc/i), { target: { value: 'P055' } });
  fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '20000' } });
  fireEvent.change(screen.getByLabelText(/precio unitario/i), { target: { value: '72.50' } });
}

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
    fireEvent.change(screen.getByLabelText(/n.*oc/i), { target: { value: 'P055' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '20000' } });
    // precio unitario se deja vacío
    expect(screen.getByText('0')).toBeInTheDocument(); // total
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

  it('al generar muestra el documento OrdenPrint y llama onGenerado con el número', () => {
    const onGenerado = vi.fn();
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={onGenerado} />);
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    expect(screen.getByText('ORDEN DE COMPRA')).toBeInTheDocument();
    expect(screen.getByText('P055')).toBeInTheDocument();
    expect(onGenerado).toHaveBeenCalledWith('P055');
  });

  it('"← Editar" regresa a captura sin perder los datos', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText(/n.*oc/i)).toHaveValue('P055');
  });

  it('botón "Imprimir / Guardar PDF" llama window.print', () => {
    render(<OcSimpleForm proveedorInicial="CESAR DELGADO" materialInicial="CABLE" onGenerado={() => {}} />);
    llenarMinimo();
    fireEvent.click(screen.getByRole('button', { name: /generar documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
    expect(window.print).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/components/OcSimpleForm.test.tsx`
Expected: FAIL with "Failed to resolve import ./OcSimpleForm" (file doesn't exist yet)

- [ ] **Step 3: Implement `OcSimpleForm.tsx`**

Create `dashboard/src/components/OcSimpleForm.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import OrdenPrint from './OrdenPrint';
import { parseNumero, type OrdenCompra, type OrdenLinea } from '@/lib/ordenesShared';

interface LineaFormState {
  material: string;
  embalaje: string;
  cantidadKg: string;
  precioUnitario: string;
}

const lineaVacia = (material = ''): LineaFormState => ({ material, embalaje: '', cantidadKg: '', precioUnitario: '' });

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--grey)',
};

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--cream)',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '8px 10px',
  colorScheme: 'dark',
};

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 16,
};

const panelStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: 20,
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 3,
  border: '1px solid var(--orange)',
  background: 'var(--orange)',
  color: 'var(--black)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px',
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
};

const smallGhostBtn: React.CSSProperties = { ...ghostBtn, padding: '6px 10px', fontSize: 11 };

interface OcSimpleFormProps {
  proveedorInicial: string;
  materialInicial: string;
  onGenerado: (numero: string) => void;
}

export default function OcSimpleForm({ proveedorInicial, materialInicial, onGenerado }: OcSimpleFormProps) {
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [negociacion, setNegociacion] = useState('');
  const [proveedor, setProveedor] = useState(proveedorInicial);
  const [lineas, setLineas] = useState<LineaFormState[]>([lineaVacia(materialInicial)]);
  const [mostrarDocumento, setMostrarDocumento] = useState(false);

  const lineasCalculadas: OrdenLinea[] = useMemo(
    () =>
      lineas.map((l) => {
        const cantidadKg = parseNumero(l.cantidadKg);
        const precioUnitario = parseNumero(l.precioUnitario);
        const importe = cantidadKg !== null && precioUnitario !== null ? cantidadKg * precioUnitario : null;
        return { material: l.material, embalaje: l.embalaje, cantidadKg, precioUnitario, importe };
      }),
    [lineas]
  );

  const total = useMemo(
    () => lineasCalculadas.reduce((sum, l) => sum + (l.importe ?? 0), 0),
    [lineasCalculadas]
  );

  const puedeGenerar = Boolean(
    numero.trim() &&
      proveedor.trim() &&
      lineasCalculadas.some((l) => l.material.trim() && l.cantidadKg !== null && l.precioUnitario !== null)
  );

  function actualizarLinea(i: number, campo: keyof LineaFormState, valor: string) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, lineaVacia()]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  function generar() {
    setMostrarDocumento(true);
    onGenerado(numero);
  }

  if (mostrarDocumento) {
    const orden: OrdenCompra = { numero, fecha, proveedor, negociacion, estatus: '', lineas: lineasCalculadas, total };
    return (
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button type="button" onClick={() => setMostrarDocumento(false)} style={ghostBtn}>
            ← Editar
          </button>
          <button type="button" onClick={() => window.print()} style={primaryBtn}>
            Imprimir / Guardar PDF
          </button>
        </div>
        <div className="oc-print-area">
          <OrdenPrint orden={orden} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--cream)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={fieldGridStyle}>
          <label htmlFor="oc-numero" style={labelStyle}>
            N° de OC
            <input id="oc-numero" value={numero} onChange={(e) => setNumero(e.target.value)} style={inputStyle} />
          </label>
          <label htmlFor="oc-fecha" style={labelStyle}>
            Fecha
            <input id="oc-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
          </label>
          <label htmlFor="oc-negociacion" style={labelStyle}>
            Negociación
            <input id="oc-negociacion" value={negociacion} onChange={(e) => setNegociacion(e.target.value)} style={inputStyle} />
          </label>
          <label htmlFor="oc-proveedor" style={labelStyle}>
            Proveedor
            <input id="oc-proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} style={inputStyle} />
          </label>
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                color: 'var(--grey)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Material</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Embalaje</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Cantidad (kg)</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Precio unitario</th>
              <th style={{ padding: '12px 16px', width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <td style={{ padding: '10px 16px' }}>
                  <label htmlFor={`oc-material-${i}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Material {i + 1}
                  </label>
                  <input
                    id={`oc-material-${i}`}
                    value={l.material}
                    onChange={(e) => actualizarLinea(i, 'material', e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <label htmlFor={`oc-embalaje-${i}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Embalaje
                  </label>
                  <input
                    id={`oc-embalaje-${i}`}
                    value={l.embalaje}
                    onChange={(e) => actualizarLinea(i, 'embalaje', e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <label htmlFor={`oc-cantidad-${i}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Cantidad
                  </label>
                  <input
                    id={`oc-cantidad-${i}`}
                    type="number"
                    value={l.cantidadKg}
                    onChange={(e) => actualizarLinea(i, 'cantidadKg', e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <label htmlFor={`oc-precio-${i}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Precio unitario
                  </label>
                  <input
                    id={`oc-precio-${i}`}
                    type="number"
                    value={l.precioUnitario}
                    onChange={(e) => actualizarLinea(i, 'precioUnitario', e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <button type="button" onClick={() => quitarLinea(i)} style={smallGhostBtn}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={agregarLinea} style={ghostBtn}>
            + Agregar línea
          </button>
        </div>
      </div>

      <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
        Total <span>{total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          disabled={!puedeGenerar}
          onClick={generar}
          style={{ ...primaryBtn, opacity: puedeGenerar ? 1 : 0.4, cursor: puedeGenerar ? 'pointer' : 'not-allowed' }}
        >
          Generar documento
        </button>
      </div>
    </div>
  );
}
```

Note on the test `'cantidad o precio vacío no rompe el total'`: it asserts `screen.getByText('0')` for the live total — this only works if `'0'` is unique in the DOM at that point (numero='P055', one line with cantidad filled and precio empty, material/embalaje empty). Verify this during Step 4; if `getByText('0')` matches more than one node, change that assertion to scope it to the total row, e.g. wrap the total in a `data-testid="oc-total-vivo"` span and use `screen.getByTestId('oc-total-vivo')` instead — in that case also change the "calcula importe" test to use the same testid for consistency. Prefer the simplest change that keeps both tests passing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/components/OcSimpleForm.test.tsx`
Expected: PASS (8 tests). If the total-uniqueness issue described above appears, apply the fallback (testid) and rerun until green.

- [ ] **Step 5: Commit**

```bash
cd dashboard
git add src/components/OcSimpleForm.tsx src/components/OcSimpleForm.test.tsx
git commit -m "feat: agrega OcSimpleForm (captura simple -> documento OrdenPrint, sin persistencia)"
```

---

### Task 3: Rewire `GenerarOcModal` and `OpDrawer` to use `OcSimpleForm`

**Files:**
- Modify: `dashboard/src/components/GenerarOcModal.tsx` (whole file — drops fetch/consecutivo/credential, swaps child component)
- Modify: `dashboard/src/components/GenerarOcModal.test.tsx` (whole file — drops archivos-fetch tests, mocks `OcSimpleForm` instead of `OrdenDirectaForm`)
- Modify: `dashboard/src/components/OpDrawer.tsx:371` (drop `credential` prop passed to `GenerarOcModal`)
- Modify: `dashboard/src/components/OpDrawer.test.tsx` (update the `vi.mock('./GenerarOcModal', ...)` mock and the one test asserting the PATCH body's `noPO`, since the value is no longer folio-shaped)

**Interfaces:**
- Consumes: `OcSimpleForm` from Task 2 — `{ proveedorInicial: string; materialInicial: string; onGenerado: (numero: string) => void }`.
- Produces: `GenerarOcModal` props become `{ proveedorInicial: string; materialInicial: string; onClose: () => void; onGenerado: (numero: string) => void; error?: string | null }` (drops `credential`).

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `dashboard/src/components/GenerarOcModal.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GenerarOcModal from './GenerarOcModal';

vi.mock('./OcSimpleForm', () => ({
  default: (props: any) => (
    <div data-testid="ocf" data-proveedor={props.proveedorInicial} data-material={props.materialInicial}>
      <button onClick={() => props.onGenerado('P055')}>simular generado</button>
    </div>
  ),
}));

describe('GenerarOcModal', () => {
  it('pasa proveedorInicial y materialInicial al formulario', () => {
    render(<GenerarOcModal proveedorInicial="JAVIER V." materialInicial="6063 PAINTED" onClose={() => {}} onGenerado={() => {}} />);
    const ocf = screen.getByTestId('ocf');
    expect(ocf).toHaveAttribute('data-proveedor', 'JAVIER V.');
    expect(ocf).toHaveAttribute('data-material', '6063 PAINTED');
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

  it('delega el guardado del formulario a onGenerado con el número', () => {
    const onGenerado = vi.fn();
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={onGenerado} />);
    fireEvent.click(screen.getByText('simular generado'));
    expect(onGenerado).toHaveBeenCalledWith('P055');
  });

  it('muestra error cuando se pasa la prop error', () => {
    render(<GenerarOcModal proveedorInicial="X" materialInicial="Y" onClose={() => {}} onGenerado={() => {}} error="La operación cambió en otra sesión (conflicto). Recarga." />);
    expect(screen.getByText(/cambió en otra sesión/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/GenerarOcModal.test.tsx`
Expected: FAIL — `vi.mock('./OcSimpleForm', ...)` mocks a module that doesn't exist yet as far as `GenerarOcModal.tsx` is concerned (it still imports `OrdenDirectaForm`), so `getByTestId('ocf')` finds nothing.

- [ ] **Step 3: Rewrite `GenerarOcModal.tsx`**

Replace the entire contents of `dashboard/src/components/GenerarOcModal.tsx` with:

```tsx
'use client';

import OcSimpleForm from './OcSimpleForm';

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
  proveedorInicial: string;
  materialInicial: string;
  onClose: () => void;
  onGenerado: (numero: string) => void;
  error?: string | null;
}

export default function GenerarOcModal({ proveedorInicial, materialInicial, onClose, onGenerado, error }: Props) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} style={closeBtn}>
          ← Cerrar
        </button>
        {error && (
          <p style={{ color: '#d9534f', fontFamily: 'var(--font-mono)', fontSize: 12.5, marginTop: 14 }}>{error}</p>
        )}
        <OcSimpleForm proveedorInicial={proveedorInicial} materialInicial={materialInicial} onGenerado={onGenerado} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run `GenerarOcModal` tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/GenerarOcModal.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Update `OpDrawer.tsx` to drop the now-removed `credential` prop**

In `dashboard/src/components/OpDrawer.tsx`, find the `GenerarOcModal` render (currently lines 369-378):

```tsx
      {showOcModal && (
        <GenerarOcModal
          credential={credential}
          proveedorInicial={row.clienteOProveedor}
          materialInicial={row.material}
          onClose={() => setShowOcModal(false)}
          onGenerado={guardarNoPO}
          error={error}
        />
      )}
```

Replace with:

```tsx
      {showOcModal && (
        <GenerarOcModal
          proveedorInicial={row.clienteOProveedor}
          materialInicial={row.material}
          onClose={() => setShowOcModal(false)}
          onGenerado={guardarNoPO}
          error={error}
        />
      )}
```

`guardarNoPO(folio: string)` itself needs no change — it already just takes whatever string it's given and PATCHes it as `noPO`; the value is no longer folio-shaped (`OC.N/Directo`) but a plain OC number (`P055`), which is exactly what `noPO` should hold either way.

- [ ] **Step 6: Update `OpDrawer.test.tsx`'s `GenerarOcModal` mock and the one test asserting a folio-shaped value**

In `dashboard/src/components/OpDrawer.test.tsx`, find the module mock near the top of the file:

```tsx
vi.mock('./GenerarOcModal', () => ({
  default: (props: any) => (
    <div data-testid="oc-modal">
      <button onClick={() => props.onGenerado('OC.700/Directo')}>simular generado</button>
    </div>
  ),
}));
```

Replace `'OC.700/Directo'` with a plain OC number, `'P700'`, in that mock:

```tsx
vi.mock('./GenerarOcModal', () => ({
  default: (props: any) => (
    <div data-testid="oc-modal">
      {props.error && <p>{props.error}</p>}
      <button onClick={() => props.onGenerado('P700')}>simular generado</button>
    </div>
  ),
}));
```

(This also folds in the `error`-rendering the previous fix added to the real mock — check whether your checkout's mock already renders `props.error`; if so, only change the folio string, don't duplicate the `error` line.)

Then find the test asserting the PATCH body (`'abre el modal de generar OC y al generar hace PATCH con noPO = folio'` or similar, and any 409-failure test using `'OC.700/Directo'`) and replace every occurrence of `'OC.700/Directo'` in that test file with `'P700'`, keeping the rest of each assertion (`expect(body.fields.noPO).toBe('P700')`, etc.) otherwise identical.

- [ ] **Step 7: Run `OpDrawer` tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OpDrawer.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 8: Run the full test suite**

Run: `cd dashboard && npx vitest run`
Expected: PASS except the 3 pre-existing, unrelated `PipelineBoard.test.tsx` failures (confirmed pre-dating this feature — reproduce identically at commit `37a09de`, before any of this feature's work). No other regressions.

- [ ] **Step 9: Commit**

```bash
cd dashboard
git add src/components/GenerarOcModal.tsx src/components/GenerarOcModal.test.tsx src/components/OpDrawer.tsx src/components/OpDrawer.test.tsx
git commit -m "feat: GenerarOcModal usa OcSimpleForm en vez de OrdenDirectaForm (formato OC correcto)"
```
