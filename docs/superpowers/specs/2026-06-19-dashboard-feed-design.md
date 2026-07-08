# Dashboard — Feed en Vivo (v1) — Design Spec
Date: 2026-06-19

## Overview

Dashboard separado de Cotizador que muestra en vivo todo lo subido a las 5 hojas del spreadsheet (Terrestre, Marítimo, Nacional, Compras, Inventarios). Primera pieza de un sistema más grande (después vendrán status tracking de órdenes y métricas/gráficas agregadas — specs separados, fuera de alcance aquí).

Audiencia: equipo operativo interno.

## Alcance

- App nueva, independiente de Cotizador (deploy aparte, no modifica `Codigo.gs` ni `deploy/index.html`).
- Lee las 5 hojas del spreadsheet `12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A` (mismo ID que usa `doPost` en Codigo.gs).
- Solo lectura. No escribe nada al sheet.
- Fuera de alcance: status tracking (pendiente→confirmado), métricas/gráficas agregadas, restricción de acceso por email, edición de datos desde el dashboard.

## Arquitectura

- **Stack:** Next.js, deploy en Vercel, proyecto nuevo separado de Cotizador.
- **Backend:** API route `/api/feed` en el mismo proyecto Next.js. Usa Google Sheets API v4 con credenciales de service account (JSON key guardado en env var de Vercel, nunca expuesto al cliente).
- **Frontend:** página React (misma app) hace `fetch('/api/feed')` cada 30-60s (polling), renderiza tabla.
- **Auth:** Google Sign-In, mismo `client_id` que usa Cotizador (`65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com`) — agregar el dominio de Vercel a "Authorized JavaScript origins" en Google Cloud Console. Sin restricción de email: cualquier cuenta Google puede entrar (igual que Cotizador hoy).

## Datos / Sheets

- Service account necesita permiso "Viewer" sobre el spreadsheet (paso manual único: compartir el sheet con el email del service account).
- `/api/feed` lee las 5 hojas vía `spreadsheets.values.get` (una llamada por hoja, o un `batchGet` para las 5 en una sola request).
- Cada hoja normaliza sus filas a una estructura común:
  ```ts
  {
    tipo: 'Terrestre' | 'Marítimo' | 'Nacional' | 'Compras' | 'Inventarios',
    fecha: string,
    usuario: string,
    clienteOProveedor: string,
    material: string,
    cargas: number,
    status: string | null,
    raw: Record<string, any> // todas las columnas originales, para el detalle expandido
  }
  ```
- Las 5 listas normalizadas se combinan en un solo array, ordenado por `fecha` descendente.
- Respuesta cacheada en memoria del proceso serverless por 20-25s, para que múltiples usuarios refrescando a la vez no disparen una llamada nueva a Sheets API por cada uno (cuota).

## Feed (UI)

- Tabla única con todas las filas mezcladas de las 5 hojas.
- Columna **Tipo** identifica el origen (Terrestre/Marítimo/Nacional/Compras/Inventarios).
- Columnas visibles: Fecha, Usuario, Cliente/Proveedor, Material, Cargas, Status (vacío si la hoja no tiene status).
- Click en una fila expande (o abre modal) con todas las columnas originales de esa hoja (`raw`).
- Filtro por Tipo (tabs o dropdown arriba de la tabla).
- Indicador "última actualización: hace Xs" visible siempre.

## Data flow

1. Usuario sube cotización/compra en Cotizador (sin cambios ahí) → `doPost` escribe en el sheet, como hoy.
2. Dashboard hace polling a `/api/feed` cada 30-60s.
3. `/api/feed`: si hay cache válido (<25s), lo devuelve; si no, llama Sheets API, normaliza, cachea, devuelve.
4. Frontend recibe JSON, renderiza tabla, actualiza timestamp.

## Manejo de errores

- Si falla la lectura de una hoja específica, esa hoja se omite del feed combinado (no rompe las demás) y se muestra un indicador visual tipo "Marítimo no disponible" cerca del filtro de Tipo.
- Si falla el login con Google, se muestra la pantalla de login (mismo patrón visual que Cotizador).
- Si Sheets API devuelve error de cuota/rate limit, el endpoint devuelve el último dato cacheado (aunque esté vencido) junto con un flag `stale: true`; el frontend muestra aviso "datos desactualizados".

## Testing

- Manual: subir una cotización real en Cotizador y confirmar que aparece en el feed dentro de la ventana de refresh (≤60s).
- Verificar login Google funciona en el dominio de Vercel.
- Simular fallo de una hoja (nombre mal escrito / sin permiso) y confirmar que el resto del feed sigue funcionando.
- Verificar que el filtro por Tipo funciona y el detalle expandido muestra todas las columnas originales.

## Qué NO cambia / fuera de alcance

- Cotizador (`Codigo.gs`, `deploy/index.html`) sin modificar.
- Sin restricción de acceso por email (cualquier cuenta Google entra).
- Sin status tracking de órdenes (spec futuro).
- Sin métricas/gráficas agregadas (spec futuro).
- Sin escritura desde el dashboard hacia el sheet.
