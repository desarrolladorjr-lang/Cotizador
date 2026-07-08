### Task 4: TTL cache

**Files:**
- Create: `dashboard/src/lib/feedCache.ts`
- Test: `dashboard/src/lib/feedCache.test.ts`

**Interfaces:**
- Produces: `createTtlCache<T>(ttlMs: number): { get(): T | null; getStale(): T | null; set(data: T): void }`

- [ ] **Step 1: Write failing test**

`dashboard/src/lib/feedCache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTtlCache } from './feedCache';

describe('createTtlCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null before anything is set', () => {
    const cache = createTtlCache<string>(1000);
    expect(cache.get()).toBeNull();
  });

  it('returns the value while within TTL', () => {
    const cache = createTtlCache<string>(1000);
    cache.set('hello');
    vi.advanceTimersByTime(500);
    expect(cache.get()).toBe('hello');
  });

  it('returns null from get() once TTL expires, but getStale() still returns it', () => {
    const cache = createTtlCache<string>(1000);
    cache.set('hello');
    vi.advanceTimersByTime(1500);
    expect(cache.get()).toBeNull();
    expect(cache.getStale()).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/feedCache.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement feedCache.ts**

`dashboard/src/lib/feedCache.ts`:
```ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function createTtlCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;

  return {
    get(): T | null {
      if (!entry) return null;
      if (Date.now() - entry.timestamp > ttlMs) return null;
      return entry.data;
    },
    getStale(): T | null {
      return entry ? entry.data : null;
    },
    set(data: T): void {
      entry = { data, timestamp: Date.now() };
    },
  };
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/lib/feedCache.test.ts
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/lib/feedCache.ts src/lib/feedCache.test.ts && git commit -m "feat: add in-memory TTL cache with stale fallback"
```

---

