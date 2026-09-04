# Stack del proyecto

Dos apps independientes en este repo.

## 1. Cotizador (`deploy/`)

- Frontend: HTML + CSS + JavaScript vanilla (sin framework), PWA (`manifest.json`, iconos).
- Auth: Google Sign-In (id_token), validado server-side contra Google.
- Backend: Google Apps Script (`Codigo.gs`), expuesto como Web App (`doPost`).
- Datos: Google Sheets (spreadsheet "EXPORTACIONES 2026", hoja `LOGÍSTICA`), vía Apps Script (`SpreadsheetApp`) y hoja `Pipeline` para seguimiento (service account con acceso de solo lectura por protección de hoja — ver memoria).
- Tests: Vitest (`deploy/js/*.test.js`: calc, payload, data-tarifario-fletes, correo).
- Deploy: manual a Cloudflare Pages (por el usuario).

## 2. Dashboard (`dashboard/`)

- Framework: Next.js 14 (App/Pages router) + React 18 + TypeScript.
- Datos: Google Sheets vía `googleapis` + `google-auth-library` (misma hoja `LOGÍSTICA`, filtrada por `SEGMENTO`).
- Export/reportes: `exceljs` (xlsx), `jszip`, `html2canvas`.
- Tests: Vitest + Testing Library (`@testing-library/react`, `jsdom`).
- Deploy: Vercel.

## Notas de arquitectura (ver memoria del proyecto)
- Dashboard lee la hoja `LOGÍSTICA` (hoja única + columna SEGMENTO); se perdieron datos de contrato y origen de flete al migrar de 5 hojas a 1.
- Hoja `Pipeline` está protegida contra escritura del service account → seguimiento sale vacío.
- Cache-busting: subir `?v=` en `deploy/index.html` al cambiar cualquier JS de `deploy/`.
