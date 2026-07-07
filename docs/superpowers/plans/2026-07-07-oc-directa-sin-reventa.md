# OC Directa: modo "sin reventa" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "sin reventa" toggle to the OC Directa form so compras that don't get resold to another fiscal entity can be generated without a reventa entity, margin, or second PDF/image.

**Architecture:** All work happens inside the existing `dashboard/` Next.js app (`dashboard/src/components/OrdenDirectaForm.tsx`, `OrdenDirectaPrint.tsx`, and `dashboard/src/app/api/ordenes-directas/guardar/route.ts`). No new data model, no new route, no new xlsx-writing code — `ocDirectaXlsx.ts` already tolerates an empty reventa entity name, and the workbook's "OC" tab already recalculates itself via spreadsheet formulas that reference the `ORDEN DE COMPRA` sheet. The only structural change is swapping the template file for the version that includes that "OC" tab.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Vitest + Testing Library, ExcelJS.

## Global Constraints

- Repo for all code changes: `dashboard/` (its own git repo, branch `master` — distinct from the outer `Cotizador` repo).
- Run tests from `dashboard/`: `npx vitest run <path>`.
- `sinReventa` is never persisted as a separate field — it is always inferred from `entidadReventaNombre` being empty (spec section 2, "Fuera de alcance").
- Retención IVA stays visible/usable regardless of `sinReventa` (spec section 2).
- Reference spec: `docs/superpowers/specs/2026-07-07-oc-directa-sin-reventa-design.md` (outer repo).

---

### Task 1: Swap the xlsx template

**Files:**
- Modify (binary replace): `dashboard/templates/PLANTILLA OC.xlsx`
- Source file: `PLANTILLA OC.xlsx` (outer repo root, untracked)
- Test: `dashboard/src/lib/ocDirectaXlsx.test.ts` (existing, unmodified — used to verify the swap didn't break cell layout)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing new — `generarXlsx`/`parseXlsx` in `dashboard/src/lib/ocDirectaXlsx.ts` keep the same cell references (`G2`, `C4`, `L4`, `G10`, `H11`, `E16`/`N16`, `E17`/`N17`, `J18`, `S21`, rows `21..33`) because the `ORDEN DE COMPRA` sheet layout in the new template file is unchanged — only a new `OC` tab was added alongside it.

- [ ] **Step 1: Copy the new template over the old one**

```bash
cp "/c/Users/jesus/Documents/Cotizador/PLANTILLA OC.xlsx" "/c/Users/jesus/Documents/Cotizador/dashboard/templates/PLANTILLA OC.xlsx"
```

- [ ] **Step 2: Run the existing round-trip test to confirm the swap didn't break cell layout**

Run: `cd dashboard && npx vitest run src/lib/ocDirectaXlsx.test.ts`
Expected: all tests PASS (same as before the swap — this proves `generarXlsx`/`parseXlsx` still read/write the right cells in the new file).

- [ ] **Step 3: Commit**

```bash
cd dashboard
git add templates/"PLANTILLA OC.xlsx"
git commit -m "feat: agrega hoja OC (vista simple) a la plantilla xlsx de OC Directa"
```

---

### Task 2: `OrdenDirectaPrint` — optional `entidadContraria` with proveedor fallback

**Files:**
- Modify: `dashboard/src/components/OrdenDirectaPrint.tsx`
- Test: `dashboard/src/components/OrdenDirectaPrint.test.tsx`

**Interfaces:**
- Consumes: `EntidadFiscal` type from `dashboard/src/lib/ordenDirectaCalculos.ts` (unchanged).
- Produces: `OrdenDirectaPrintProps.entidadContraria` becomes `EntidadFiscal | undefined`. Callers (Task 3) may now omit it; the component falls back to showing `proveedor` in the two spots that used to read `entidadContraria.nombre`.

- [ ] **Step 1: Write the failing test**

Add to `dashboard/src/components/OrdenDirectaPrint.test.tsx`, inside the `describe('OrdenDirectaPrint', ...)` block:

```tsx
  it('sin entidadContraria: usa el proveedor como fallback en "EMITIDO PARA" y en la firma', () => {
    render(
      <OrdenDirectaPrint
        lado="compra"
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
    expect(screen.getAllByText('RODRIGO CALDERA')).toHaveLength(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaPrint.test.tsx -t "sin entidadContraria"`
Expected: FAIL — TypeScript error (`entidadContraria` is required) or the two "RODRIGO CALDERA" spots not found (component crashes reading `entidadContraria.nombre` of `undefined`).

- [ ] **Step 3: Make `entidadContraria` optional with a proveedor fallback**

In `dashboard/src/components/OrdenDirectaPrint.tsx`, change the props interface:

```tsx
interface OrdenDirectaPrintProps {
  lado: 'compra' | 'reventa';
  folio: string;
  fecha: string;
  proveedor: string;
  entidad: EntidadFiscal;
  entidadContraria?: EntidadFiscal;
  metodoPago: string;
  formaPago: string;
  lineas: LineaCalculada[];
  totales: TotalesLado;
}
```

Change the function signature and add the fallback right after the existing `filas`/`precioDe`/`importeDe` computations:

```tsx
export default function OrdenDirectaPrint({
  lado, folio, fecha, proveedor, entidad, entidadContraria, metodoPago, formaPago, lineas, totales,
}: OrdenDirectaPrintProps) {
  const filas = [...lineas, ...Array(Math.max(0, MIN_FILAS - lineas.length)).fill(null)];
  const precioDe = (l: LineaCalculada) => (lado === 'compra' ? l.precioUnitarioCompra : l.precioUnitarioReventa);
  const importeDe = (l: LineaCalculada) => (lado === 'compra' ? l.importeCompra : l.importeReventa);
  const nombreContraria = entidadContraria?.nombre ?? proveedor;
```

Replace the two usages:

```tsx
          <span className="ocd-v">{nombreContraria}</span>
```

```tsx
          <div className="ocd-firma-nombre">{nombreContraria}</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaPrint.test.tsx`
Expected: all tests PASS, including the new one.

- [ ] **Step 5: Commit**

```bash
cd dashboard
git add src/components/OrdenDirectaPrint.tsx src/components/OrdenDirectaPrint.test.tsx
git commit -m "feat: entidadContraria opcional en OrdenDirectaPrint, fallback a proveedor"
```

---

### Task 3: `OrdenDirectaForm` — "Sin reventa" toggle

**Files:**
- Modify: `dashboard/src/components/OrdenDirectaForm.tsx`
- Test: `dashboard/src/components/OrdenDirectaForm.test.tsx`

**Interfaces:**
- Consumes: `OrdenDirectaPrint` with optional `entidadContraria` (Task 2).
- Produces: the `imagenes` object sent to `POST /api/ordenes-directas/guardar` now has `reventa?: string` (Task 4 must accept this as optional). The `orden.entidadReventaNombre` sent in that body is `''` whenever `sinReventa` is true.

- [ ] **Step 1: Write the failing tests**

Add to `dashboard/src/components/OrdenDirectaForm.test.tsx`, inside `describe('OrdenDirectaForm', ...)`:

```tsx
  it('"Sin reventa": oculta entidad reventa y margen, permite generar sin ellos', async () => {
    render(<OrdenDirectaForm credential="test-credential" />);
    await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/sin reventa/i));
    expect(screen.queryByLabelText(/entidad.*reventa/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/margen/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'RODRIGO CALDERA' } });
    fireEvent.change(screen.getByLabelText(/entidad.*compra/i), { target: { value: 'ELSY GUADALUPE SOSA CHAVEZ' } });
    fireEvent.change(screen.getByLabelText(/folio/i), { target: { value: '696' } });
    fireEvent.change(screen.getByLabelText(/material/i), { target: { value: 'ANTIMONIO' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '1830' } });
    fireEvent.change(screen.getByLabelText(/precio neto/i), { target: { value: '41' } });

    fireEvent.click(screen.getByRole('button', { name: /generar documentos/i }));
    expect(screen.getByRole('button', { name: /imprimir.*compra/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /imprimir.*reventa/i })).not.toBeInTheDocument();
  });

  it('"Sin reventa": guardar en Dropbox manda imagenes.reventa undefined y entidadReventaNombre vacío', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).includes('/guardar')) return { ok: true, json: async () => ({ ok: true, path: '/OC/x.xlsx' }) };
      return { ok: true, json: async () => ({ catalogo: CATALOGO, stale: false }) };
    });
    render(<OrdenDirectaForm credential="c" />);
    await waitFor(() => expect(screen.getByLabelText(/proveedor/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/sin reventa/i));
    fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'RODRIGO CALDERA' } });
    fireEvent.change(screen.getByLabelText(/entidad.*compra/i), { target: { value: 'ELSY GUADALUPE SOSA CHAVEZ' } });
    fireEvent.change(screen.getByLabelText(/folio/i), { target: { value: '696' } });
    fireEvent.change(screen.getByLabelText(/material/i), { target: { value: 'ANTIMONIO' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '1830' } });
    fireEvent.change(screen.getByLabelText(/precio neto/i), { target: { value: '41' } });
    fireEvent.click(screen.getByRole('button', { name: /generar documentos/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar en dropbox/i }));
    await waitFor(() => expect(screen.getByText(/guardado ✓/i)).toBeInTheDocument());

    const guardarCall = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/guardar'));
    const body = JSON.parse(guardarCall[1].body);
    expect(body.orden.entidadReventaNombre).toBe('');
    expect(body.imagenes.compra).toBe('QUFBQQ==');
    expect(body.imagenes.reventa).toBeUndefined();
  });

  it('editar orden sin entidadReventaNombre: arranca en modo "Sin reventa"', async () => {
    const orden = {
      folioConsecutivo: '696', entraMty: false, folioMty: '', fecha: '2026-07-03',
      proveedor: 'RODRIGO CALDERA', entidadCompraNombre: 'ELSY GUADALUPE SOSA CHAVEZ',
      entidadReventaNombre: '', metodoPago: 'PPD', formaPago: '99-POR DEFINIR',
      retencion: 'NO' as const, margenPorKg: 0,
      lineas: [{ material: 'ANTIMONIO', cantidadKg: 1830, unidad: 'KGM', precioNeto: 41 }],
    };
    render(<OrdenDirectaForm credential="c" ordenInicial={orden} pathOriginal="/OC/x.xlsx" />);
    await waitFor(() => expect(screen.getByDisplayValue('696')).toBeInTheDocument());
    expect(screen.getByLabelText(/sin reventa/i)).toBeChecked();
    expect(screen.queryByLabelText(/entidad.*reventa/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: the 3 new tests FAIL (no "sin reventa" checkbox exists yet); the pre-existing tests still PASS.

- [ ] **Step 3: Add the `sinReventa` state and checkbox**

In `dashboard/src/components/OrdenDirectaForm.tsx`, add state right after the existing `retencion`/`margenPorKg` state declarations (around line 117-118):

```tsx
  const [retencion, setRetencion] = useState<'SI' | 'NO'>(ordenInicial?.retencion ?? 'NO');
  const [margenPorKg, setMargenPorKg] = useState(String(ordenInicial?.margenPorKg ?? '0'));
  const [sinReventa, setSinReventa] = useState(
    ordenInicial ? !ordenInicial.entidadReventaNombre.trim() : false
  );
```

Add a handler near `actualizarLinea`/`agregarLinea` (around line 179-185):

```tsx
  function alternarSinReventa(checked: boolean) {
    setSinReventa(checked);
    if (checked) {
      setEntidadReventaNombre('');
      setMargenPorKg('0');
    }
  }
```

Add the checkbox in the field grid, right after the "Entra a Monterrey" checkbox block (after line 336's closing `)}` — i.e. right before the `{entraMty && (...)}` block or right after it, same grid):

```tsx
          <label
            htmlFor="sin-reventa"
            style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 8 }}
          >
            <input
              id="sin-reventa"
              type="checkbox"
              checked={sinReventa}
              onChange={(e) => alternarSinReventa(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--orange)' }}
            />
            Sin reventa
          </label>
```

- [ ] **Step 4: Hide entidad-reventa and margen fields when `sinReventa`**

Wrap the existing "Entidad emisora (reventa)" `<label>` block in a conditional:

```tsx
          {!sinReventa && (
            <label htmlFor="entidad-reventa" style={labelStyle}>
              Entidad emisora (reventa)
              <select
                id="entidad-reventa"
                value={entidadReventaNombre}
                onChange={(e) => setEntidadReventaNombre(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Seleccionar —</option>
                {catalogo?.entidadesReventa.map((e) => (
                  <option key={e.nombre} value={e.nombre}>{e.nombre}</option>
                ))}
              </select>
            </label>
          )}
```

Wrap the existing "Margen por kg (reventa)" `<label>` block the same way:

```tsx
          {!sinReventa && (
            <label htmlFor="margen" style={labelStyle}>
              Margen por kg (reventa)
              <input
                id="margen"
                type="number"
                step="0.01"
                value={margenPorKg}
                onChange={(e) => setMargenPorKg(e.target.value)}
                style={inputStyle}
              />
            </label>
          )}
```

- [ ] **Step 5: Relax `puedeGenerar` and the impresión-view guard**

Find `const puedeGenerar = Boolean(proveedor && entidadCompra && entidadReventa && calculo.lineas.length > 0);` and change it to:

```tsx
  const puedeGenerar = Boolean(proveedor && entidadCompra && (sinReventa || entidadReventa) && calculo.lineas.length > 0);
```

Find `if (mostrarImpresion && entidadCompra && entidadReventa) {` and change it to:

```tsx
  if (mostrarImpresion && entidadCompra && (sinReventa || entidadReventa)) {
```

- [ ] **Step 6: Render only the compra doc/button when `sinReventa`**

Replace the existing impresión-view header buttons block (the `<div>` containing "← Editar", "Imprimir / Guardar PDF (Compra)", "Imprimir / Guardar PDF (Reventa)", "Guardar en Dropbox") with:

```tsx
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <button type="button" onClick={() => setMostrarImpresion(false)} style={ghostBtn}>
            ← Editar
          </button>
          <button type="button" onClick={() => imprimir('compra')} style={primaryBtn}>
            Imprimir / Guardar PDF (Compra)
          </button>
          {!sinReventa && (
            <button type="button" onClick={() => imprimir('reventa')} style={primaryBtn}>
              Imprimir / Guardar PDF (Reventa)
            </button>
          )}
          <button type="button" onClick={guardarEnDropbox} disabled={guardando} style={primaryBtn}>
            {guardando ? 'Guardando…' : 'Guardar en Dropbox'}
          </button>
          {guardadoOk && !guardando && (
            <span role="status" style={{ color: '#7dc98f', fontSize: 13, fontWeight: 700 }}>Guardado ✓</span>
          )}
          {errorGuardar && <span role="alert" style={{ color: 'var(--orange)', fontSize: 12 }}>{errorGuardar}</span>}
        </div>
```

Replace the existing print-area block (the `<div className="oc-print-area">` containing the compra and reventa `OrdenDirectaPrint` docs) — pass `entidadContraria` conditionally and wrap the reventa doc:

```tsx
        <div className="oc-print-area">
          <div className="ocd-print-doc" data-doc="compra" ref={compraRef}>
            <OrdenDirectaPrint
              lado="compra"
              folio={folio}
              fecha={fecha}
              proveedor={proveedor}
              entidad={entidadCompra}
              entidadContraria={sinReventa ? undefined : entidadReventa}
              metodoPago={metodoPago}
              formaPago={formaPago}
              lineas={calculo.lineas}
              totales={calculo.compra}
            />
          </div>
          {!sinReventa && entidadReventa && (
            <div className="ocd-print-doc" data-doc="reventa" ref={reventaRef}>
              <OrdenDirectaPrint
                lado="reventa"
                folio={folio}
                fecha={fecha}
                proveedor={proveedor}
                entidad={entidadReventa}
                entidadContraria={entidadCompra}
                metodoPago={metodoPago}
                formaPago={formaPago}
                lineas={calculo.lineas}
                totales={calculo.reventa}
              />
            </div>
          )}
        </div>
```

- [ ] **Step 7: Skip capturing/sending the reventa image when `sinReventa`**

Replace the existing `guardarEnDropbox` function:

```tsx
  async function guardarEnDropbox() {
    setGuardando(true);
    setGuardadoOk(false);
    setErrorGuardar(null);
    try {
      const orden: OrdenDirectaDatos = {
        folioConsecutivo, entraMty, folioMty, fecha, proveedor,
        entidadCompraNombre, entidadReventaNombre: sinReventa ? '' : entidadReventaNombre,
        metodoPago, formaPago, retencion,
        margenPorKg: Number(margenPorKg) || 0,
        lineas: lineasCaptura
          .filter((l) => l.material && l.cantidadKg !== null && l.precioNeto !== null)
          .map((l) => ({ material: l.material, cantidadKg: l.cantidadKg as number, unidad: l.unidad, precioNeto: l.precioNeto as number })),
      };
      const compra = await capturar(compraRef.current);
      const reventa = sinReventa ? undefined : await capturar(reventaRef.current);
      const res = await fetch('/api/ordenes-directas/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
        body: JSON.stringify({ orden, imagenes: { compra, reventa }, pathOriginal: pathActual }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || 'no se pudo guardar');
      setPathActual(body.path);
      setGuardadoOk(true);
      onGuardado?.();
    } catch (err) {
      setErrorGuardar((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/OrdenDirectaForm.test.tsx`
Expected: all tests PASS, including the 3 new ones.

- [ ] **Step 9: Commit**

```bash
cd dashboard
git add src/components/OrdenDirectaForm.tsx src/components/OrdenDirectaForm.test.tsx
git commit -m "feat: toggle 'sin reventa' en OC Directa"
```

---

### Task 4: Relax `POST /api/ordenes-directas/guardar` to accept an optional reventa image

**Files:**
- Modify: `dashboard/src/app/api/ordenes-directas/guardar/route.ts`
- Test: `dashboard/src/app/api/ordenes-directas/guardar/route.test.ts`

**Interfaces:**
- Consumes: request body shaped like `{ orden: OrdenDirectaDatos; imagenes: { compra: string; reventa?: string }; pathOriginal?: string }` (produced by Task 3).
- Produces: same `{ ok: boolean; path?: string; error?: string }` response shape as before — unchanged.

- [ ] **Step 1: Write the failing test**

Add to `dashboard/src/app/api/ordenes-directas/guardar/route.test.ts`:

```ts
  it('sin reventa: sube solo 1 imagen, no exige imagenes.reventa', async () => {
    const { POST } = await import('./route');
    const orden = { ...ORDEN, entidadReventaNombre: '' };
    const res = await POST(req({ orden, imagenes: { compra: IMAGENES.compra } }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    const paths = (uploadFile as any).mock.calls.map((c: any[]) => c[0]);
    expect(paths).toEqual([
      '/OC/OC696 RODRIGO CALDERA.xlsx',
      '/OC/OC696 RODRIGO CALDERA COMPRA.png',
    ]);
  });

  it('validación: sin entidad de compra → 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(req({ orden: { ...ORDEN, entidadCompraNombre: '' }, imagenes: IMAGENES }));
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run tests to verify the new "sin reventa" test fails**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/guardar/route.test.ts`
Expected: FAIL on the "sin reventa" test with a 400 (current `validar()` still requires `entidadReventaNombre`, and the body-completeness check still requires `imagenes.reventa`). The "sin entidad de compra" test should already PASS (existing `validar()` already checks `entidadCompraNombre`).

- [ ] **Step 3: Relax the body type and validation**

In `dashboard/src/app/api/ordenes-directas/guardar/route.ts`, change the body interface:

```ts
interface GuardarBody {
  orden: OrdenDirectaDatos;
  imagenes: { compra: string; reventa?: string };
  pathOriginal?: string;
}
```

Change `validar()`:

```ts
function validar(orden: OrdenDirectaDatos): string | null {
  if (!orden.folioConsecutivo?.trim()) return 'folio requerido';
  if (!orden.proveedor?.trim()) return 'proveedor requerido';
  if (!orden.entidadCompraNombre?.trim()) return 'entidad de compra requerida';
  if (!orden.lineas?.length) return 'al menos una línea';
  if (orden.lineas.length > MAX_LINEAS) return `máximo ${MAX_LINEAS} líneas`;
  return null;
}
```

Change the body-completeness check:

```ts
  const body = (await request.json().catch(() => null)) as GuardarBody | null;
  if (!body?.orden || !body.imagenes?.compra) {
    return Response.json({ ok: false, error: 'body incompleto' }, { status: 400 });
  }
```

Change the upload block to make the reventa upload conditional:

```ts
    const xlsx = await generarXlsx(body.orden);
    await uploadFile(xlsxPath, xlsx);
    await uploadFile(`${folder}/${nombreImagen(body.orden, 'compra')}`, Buffer.from(body.imagenes.compra, 'base64'));
    if (body.imagenes.reventa) {
      await uploadFile(`${folder}/${nombreImagen(body.orden, 'reventa')}`, Buffer.from(body.imagenes.reventa, 'base64'));
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/app/api/ordenes-directas/guardar/route.test.ts`
Expected: all tests PASS, including both new ones.

- [ ] **Step 5: Commit**

```bash
cd dashboard
git add src/app/api/ordenes-directas/guardar/route.ts src/app/api/ordenes-directas/guardar/route.test.ts
git commit -m "feat: /api/ordenes-directas/guardar acepta orden sin reventa"
```

---

### Task 5: Full verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `cd dashboard && npx vitest run`
Expected: all test files PASS (218+ tests from before this plan, plus the 6 new ones added across Tasks 2-4).

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run: `cd dashboard && npm run dev`, open the dashboard, go to "OC Directa" → "Nueva orden", check the "Sin reventa" checkbox, fill proveedor/entidad compra/folio/one línea, click "Generar documentos" — confirm only the "Imprimir / Guardar PDF (Compra)" button appears (no "Reventa" button), then click "Guardar en Dropbox" and confirm it succeeds. Stop the dev server after.
