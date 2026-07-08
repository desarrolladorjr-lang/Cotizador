### Task 5: /api/feed route

**Files:**
- Create: `dashboard/src/app/api/feed/route.ts`
- Test: `dashboard/src/app/api/feed/route.test.ts`

**Interfaces:**
- Consumes: `fetchAllSheets` from `@/lib/sheetsClient`, `normalizeFeed`/`NormalizeResult` from `@/lib/normalizeFeed`, `createTtlCache` from `@/lib/feedCache`
- Produces: `GET(): Promise<Response>` returning JSON `{ rows: FeedRow[]; errors: {...}[]; stale: boolean }`

- [ ] **Step 1: Write failing test**

`dashboard/src/app/api/feed/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sheetsClient', () => ({
  fetchAllSheets: vi.fn(),
}));

import { fetchAllSheets } from '@/lib/sheetsClient';

describe('GET /api/feed', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns normalized rows on success', async () => {
    (fetchAllSheets as any).mockResolvedValue([
      {
        sheetName: 'Terrestre',
        rows: [
          ['Fecha', 'Usuario', 'Cliente', 'Proveedor', 'Cargas', 'Material'],
          ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz'],
        ],
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.stale).toBe(false);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].clienteOProveedor).toBe('ACME');
    expect(body.errors).toEqual([]);
  });

  it('falls back to last cached value when the sheets fetch throws and marks stale', async () => {
    (fetchAllSheets as any)
      .mockResolvedValueOnce([
        {
          sheetName: 'Terrestre',
          rows: [['Fecha'], ['2026-06-19', 'jesus', 'ACME', 'Prov1', '2', 'Maiz']],
        },
      ])
      .mockRejectedValueOnce(new Error('quota exceeded'));

    const { GET } = await import('./route');

    const first = await GET();
    const firstBody = await first.json();
    expect(firstBody.stale).toBe(false);

    vi.useFakeTimers();
    vi.advanceTimersByTime(30_000); // past the 25s cache TTL
    const second = await GET();
    const secondBody = await second.json();
    vi.useRealTimers();

    expect(secondBody.stale).toBe(true);
    expect(secondBody.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/app/api/feed/route.test.ts
```
Expected: FAIL — `./route` not found.

- [ ] **Step 3: Implement route.ts**

`dashboard/src/app/api/feed/route.ts`:
```ts
import { fetchAllSheets } from '@/lib/sheetsClient';
import { normalizeFeed, type NormalizeResult } from '@/lib/normalizeFeed';
import { createTtlCache } from '@/lib/feedCache';

const cache = createTtlCache<NormalizeResult>(25_000);

export async function GET() {
  const cached = cache.get();
  if (cached) {
    return Response.json({ ...cached, stale: false });
  }

  try {
    const sheetResults = await fetchAllSheets();
    const normalized = normalizeFeed(sheetResults);
    cache.set(normalized);
    return Response.json({ ...normalized, stale: false });
  } catch (err) {
    const stale = cache.getStale();
    if (stale) {
      return Response.json({ ...stale, stale: true });
    }
    return Response.json(
      { rows: [], errors: [{ sheetName: 'unknown', error: (err as Error).message }], stale: true },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/app/api/feed/route.test.ts
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/app/api/feed/route.ts src/app/api/feed/route.test.ts && git commit -m "feat: add /api/feed route with caching and stale fallback"
```

---

