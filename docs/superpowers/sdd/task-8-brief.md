### Task 8: Deploy setup docs

**Files:**
- Create: `dashboard/docs/deploy.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Write deploy doc**

`dashboard/docs/deploy.md`:
```markdown
# Deploy — Dashboard Feed

## 1. Service account (una sola vez)

1. Google Cloud Console → IAM & Admin → Service Accounts → crear uno nuevo.
2. Generar key JSON, copiar el contenido completo (es el valor de `GOOGLE_SERVICE_ACCOUNT_KEY`).
3. Abrir el spreadsheet `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` → Compartir → agregar el `client_email` de la service account con permiso **Viewer**.

## 2. Google Sign-In origin

1. Google Cloud Console → APIs & Services → Credentials → editar el OAuth client `65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com`.
2. Agregar el dominio de Vercel (ej. `https://dashboard-cotizador.vercel.app`) a "Authorized JavaScript origins".

## 3. Vercel

1. `vercel link` (o importar el repo `dashboard/` desde el dashboard de Vercel).
2. Settings → Environment Variables → agregar `GOOGLE_SERVICE_ACCOUNT_KEY` con el JSON completo de la key (una sola línea).
3. Deploy.

## 4. Verificación post-deploy

- Abrir la URL de Vercel, confirmar que aparece el botón de Google Sign-In.
- Tras login, confirmar que la tabla carga filas reales del spreadsheet.
- Subir una cotización de prueba en Cotizador y confirmar que aparece en el feed dentro de 60s.
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/jesus/Documents/Cotizador/dashboard" && git add docs/deploy.md && git commit -m "docs: add deploy instructions for service account, OAuth origin, and Vercel"
```
