### Task 6: FeedTable component

**Files:**
- Create: `dashboard/src/components/FeedTable.tsx`
- Test: `dashboard/src/components/FeedTable.test.tsx`

**Interfaces:**
- Consumes: `FeedRow` type from `@/lib/normalizeFeed`
- Produces: `FeedTable({ rows, errors, stale }: { rows: FeedRow[]; errors: { sheetName: string; error: string }[]; stale: boolean }): JSX.Element`, default export

- [ ] **Step 1: Write failing test**

`dashboard/src/components/FeedTable.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedTable from './FeedTable';
import type { FeedRow } from '@/lib/normalizeFeed';

const rows: FeedRow[] = [
  { tipo: 'Terrestre', fecha: '2026-06-19', usuario: 'jesus', clienteOProveedor: 'ACME', material: 'Maiz', cargas: 2, status: 'Pendiente', raw: ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'] },
  { tipo: 'Compras', fecha: '2026-06-18', usuario: 'ana', clienteOProveedor: 'CALDERA', material: 'Sorgo', cargas: 3, status: null, raw: ['2026-06-18', 'ana', 'CALDERA', '3', 'Sorgo'] },
];

describe('FeedTable', () => {
  it('renders one row per feed entry', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} />);
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('CALDERA')).toBeInTheDocument();
  });

  it('filters by tipo', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compras' }));
    expect(screen.queryByText('ACME')).not.toBeInTheDocument();
    expect(screen.getByText('CALDERA')).toBeInTheDocument();
  });

  it('expands a row to show raw columns on click', () => {
    render(<FeedTable rows={rows} errors={[]} stale={false} />);
    fireEvent.click(screen.getByText('ACME'));
    expect(screen.getByText('Prov1')).toBeInTheDocument();
  });

  it('shows an unavailable indicator for sheets that failed to load', () => {
    render(<FeedTable rows={rows} errors={[{ sheetName: 'Marítimo', error: 'denied' }]} stale={false} />);
    expect(screen.getByText(/Marítimo no disponible/i)).toBeInTheDocument();
  });

  it('shows a stale data warning', () => {
    render(<FeedTable rows={rows} errors={[]} stale={true} />);
    expect(screen.getByText(/datos desactualizados/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/FeedTable.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement FeedTable.tsx**

`dashboard/src/components/FeedTable.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import type { FeedRow } from '@/lib/normalizeFeed';

const TIPOS = ['Todos', 'Terrestre', 'Marítimo', 'Nacional', 'Compras', 'Inventarios'] as const;

export default function FeedTable({
  rows,
  errors,
  stale,
}: {
  rows: FeedRow[];
  errors: { sheetName: string; error: string }[];
  stale: boolean;
}) {
  const [filtro, setFiltro] = useState<typeof TIPOS[number]>('Todos');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const visibleRows = useMemo(
    () => (filtro === 'Todos' ? rows : rows.filter((r) => r.tipo === filtro)),
    [rows, filtro]
  );

  return (
    <div>
      {stale && <p role="alert">⚠️ datos desactualizados</p>}
      {errors.map((e) => (
        <p key={e.sheetName} role="alert">
          {e.sheetName} no disponible
        </p>
      ))}
      <div>
        {TIPOS.map((tipo) => (
          <button key={tipo} onClick={() => setFiltro(tipo)} aria-pressed={filtro === tipo}>
            {tipo}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Cliente/Proveedor</th>
            <th>Material</th>
            <th>Cargas</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => (
            <>
              <tr key={i} onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}>
                <td>{row.tipo}</td>
                <td>{row.fecha}</td>
                <td>{row.usuario}</td>
                <td>{row.clienteOProveedor}</td>
                <td>{row.material}</td>
                <td>{row.cargas}</td>
                <td>{row.status || ''}</td>
              </tr>
              {expandedIndex === i && (
                <tr>
                  <td colSpan={7}>{row.raw.join(' | ')}</td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/FeedTable.test.tsx
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/FeedTable.tsx src/components/FeedTable.test.tsx && git commit -m "feat: add FeedTable component with filter, expand, and error/stale indicators"
```

---

