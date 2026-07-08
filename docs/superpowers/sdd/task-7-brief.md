### Task 7: AuthGate component + page wiring

**Files:**
- Create: `dashboard/src/components/AuthGate.tsx`
- Test: `dashboard/src/components/AuthGate.test.tsx`
- Modify: `dashboard/src/app/page.tsx`

**Interfaces:**
- Consumes: `FeedTable` from `@/components/FeedTable`
- Produces: `AuthGate({ children }: { children: React.ReactNode }): JSX.Element`, default export. Renders `children` once `window.google` calls back with a credential; otherwise renders a sign-in button container.

- [ ] **Step 1: Write failing test**

`dashboard/src/components/AuthGate.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AuthGate from './AuthGate';

describe('AuthGate', () => {
  beforeEach(() => {
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }: { callback: (r: { credential: string }) => void }) => {
            (window as any).__gsiCallback = callback;
          }),
          renderButton: vi.fn(),
          disableAutoSelect: vi.fn(),
        },
      },
    };
  });

  it('shows the sign-in button before login', () => {
    render(<AuthGate><p>contenido secreto</p></AuthGate>);
    expect(screen.queryByText('contenido secreto')).not.toBeInTheDocument();
  });

  it('renders children after a credential callback fires', () => {
    render(<AuthGate><p>contenido secreto</p></AuthGate>);
    const fakeJwt = `header.${btoa(JSON.stringify({ email: 'a@b.com', name: 'A' }))}.sig`;
    act(() => {
      (window as any).__gsiCallback({ credential: fakeJwt });
    });
    expect(screen.getByText('contenido secreto')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AuthGate.tsx**

`dashboard/src/components/AuthGate.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = '65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com';

interface GoogleUser {
  email: string;
  name: string;
}

function decodeJwt(credential: string): GoogleUser {
  const payload = credential.split('.')[1];
  const json = atob(payload);
  return JSON.parse(json);
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) return;
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response: { credential: string }) => {
        setUser(decodeJwt(response.credential));
      },
    });

    if (buttonRef.current) {
      google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large' });
    }
  }, [user]);

  if (user) {
    return <>{children}</>;
  }

  return <div ref={buttonRef} />;
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run src/components/AuthGate.test.tsx
```
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire page.tsx (polling + AuthGate + FeedTable)**

`dashboard/src/app/page.tsx`:
```tsx
'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import FeedTable from '@/components/FeedTable';
import type { FeedRow } from '@/lib/normalizeFeed';

interface FeedResponse {
  rows: FeedRow[];
  errors: { sheetName: string; error: string }[];
  stale: boolean;
}

const POLL_MS = 45_000;

export default function Page() {
  const [data, setData] = useState<FeedResponse>({ rows: [], errors: [], stale: false });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch('/api/feed');
      const body = (await res.json()) as FeedResponse;
      if (!cancelled) {
        setData(body);
        setUpdatedAt(new Date());
      }
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <AuthGate>
        <main style={{ padding: 24 }}>
          <h1>Dashboard Cotizador</h1>
          {updatedAt && <p>última actualización: {updatedAt.toLocaleTimeString()}</p>}
          <FeedTable rows={data.rows} errors={data.errors} stale={data.stale} />
        </main>
      </AuthGate>
    </>
  );
}
```

- [ ] **Step 6: Run full suite, confirm everything still passes**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npx vitest run
```
Expected: PASS, all test files.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add src/components/AuthGate.tsx src/components/AuthGate.test.tsx src/app/page.tsx && git commit -m "feat: gate dashboard behind Google Sign-In and poll /api/feed"
```

---

