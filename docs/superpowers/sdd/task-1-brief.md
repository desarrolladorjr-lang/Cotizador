### Task 1: Scaffold project

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.js`
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/vitest.setup.ts`
- Create: `dashboard/.env.local.example`
- Create: `dashboard/.gitignore`
- Create: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/page.tsx`
- Create: `dashboard/src/app/globals.css`

**Interfaces:**
- Produces: working Next.js dev server (`npm run dev`), Vitest runner (`npm test`), path alias `@/*` → `dashboard/src/*`.

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir -p "C:/Users/jesus/Documents/Cotizador/dashboard/src/app"
```

`dashboard/package.json`:
```json
{
  "name": "dashboard-feed",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "googleapis": "^144.0.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`dashboard/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

`dashboard/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
```

`dashboard/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

`dashboard/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`dashboard/.env.local.example`:
```
GOOGLE_SERVICE_ACCOUNT_KEY={"client_email":"...","private_key":"..."}
```

`dashboard/.gitignore`:
```
node_modules
.next
.env.local
```

`dashboard/src/app/globals.css`:
```css
body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f5; }
```

`dashboard/src/app/layout.tsx`:
```tsx
import './globals.css';

export const metadata = { title: 'Dashboard Cotizador' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

`dashboard/src/app/page.tsx` (placeholder, replaced in Task 7):
```tsx
export default function Page() {
  return <main>Dashboard en construcción</main>;
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && npm install
```
Expected: installs without errors, creates `node_modules` and `package-lock.json`.

- [ ] **Step 3: Init git repo and commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git init && git add -A && git commit -m "chore: scaffold Next.js dashboard project"
```

---

