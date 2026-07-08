# Dashboard — Módulo CXC/CXP (Cuentas por Cobrar / Cuentas por Pagar) — Design Spec
Date: 2026-07-08

## Overview

Nuevo módulo de solo lectura en el dashboard CRM (`./dashboard`) que muestra facturas con saldo pendiente de cobro (CXC) y de pago (CXP), leídas desde un spreadsheet distinto al del CRM principal: **EXPORTACIONES 2026** (`14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc`), hojas `MARITIMOS` y `TERRESTRES`.

Construye sobre lo existente: `dashboard/src/lib/sheetsClient.ts` (`getSheetsApi` compartido), y sigue el patrón de spreadsheet externo ya usado en `dashboard/src/lib/ordenesClient.ts` (`OC_SPREADSHEET_ID`).

Audiencia: equipo operativo interno (misma que hoy).

## Alcance

- Dos segmentos: Marítimo y Terrestre (mapean a las hojas `MARITIMOS`/`TERRESTRES` del spreadsheet EXPORTACIONES 2026).
- Por segmento, dos tablas: CXC (facturas por cobrar) y CXP (facturas por pagar), agrupadas y con subtotales.
- Solo lectura. Sin edición, sin escritura a Sheets, sin auditoría.
- Fuera de alcance: alta/baja de filas, edición inline, filtros adicionales (por fecha, por monto), exportar a Excel/PDF.

## Fuente de datos

Spreadsheet: `EXPORTACIONES 2026` (ID `14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc`), **distinto** al spreadsheet del CRM (`SPREADSHEET_ID` en `sheetsClient.ts`). Requiere compartir el spreadsheet como **Viewer** con el `client_email` del service account (paso manual, a cargo del usuario, cuando el código esté listo para probar).

Rangos por hoja:
- `MARITIMOS!A1:BA2000` — cubre CXC (A-AE) y CXP (AO-BA).
- `TERRESTRES!A1:AW2000` — cubre CXC (A-AC) y CXP (AK-AW).

### Columnas reales confirmadas (índice 0-based)

**MARITIMOS — CXC (A-AE, 31 columnas):**
`CLIENT(0) SELLER(1) DATE CONTR(2) CONTRACT(3) MATERIAL(4) SORTING(5) INCOTERM(6) DELIVERY(7) %(8) FIX PRICE(9) LOAD(10) CNT SZ(11) EST WEIGHT(12) REF C.L.(13) LOAD DAY(14) BOOKING(15) DEPARTURE(16) CONTAINER/TRAILER(17) INVOICE(18) DATE(19) MONTH(20) KG(21) PRICE(22) AMOUNT(23) $ TO CASH(24) CXC(25) SHORT WEIGHT(26) LOGISTICS(27) QUALITY(28) OTHER EXPENSES(29) AR(30)`

**MARITIMOS — CXP (AO-BA, 13 columnas):**
`ORIGIN(40) SUPPLIER(41) INV SUP(42) DATE(43) KG SUP(44) %(45) DLR(46) PRICE SUP(47) AMOUNT SUP(48) $ TO CASH(49) DEDUCTED(50) PAYMNT DATE(51) GPROFIT(52)`

**TERRESTRES — CXC (A-AC, 29 columnas):**
`CLIENT(0) SELLER(1) DT CONT(2) CONTRACT(3) MATERIAL(4) SORTING(5) INCOTERM(6) EST WEIGHT(7) %(8) FIX PRICE(9) LOAD(10) LOAD DAY(11) DELIVERY(12) REF SDL(13) CONTAINER/TRAILER(14) INVOICE(15) DATE(16) MONTH(17) KG(18) PRICE(19) AMOUNT(20) $ TO CASH(21) RECIVABLE DATE(22) CXC(23) SHORT WEIGHT(24) LOGISTICS(25) QUALITY(26) OTHER EXPENSES(27) AR(28)`

**TERRESTRES — CXP (AK-AW, 13 columnas):**
`ORIGIN(36) SUPPLIER(37) INV SUP(38) DATE(39) KG SUP(40) %(41) DLR(42) PRICE SUP(43) AMOUNT SUP(44) TO CASH(45) PAYMNT DATE(46) DISCT TO SUP(47) GPROFIT(48)`

Nota: `MARITIMOS` CXP no tiene `DISCT TO SUP` (tiene `DEDUCTED` en su lugar, columna 50). `TERRESTRES` CXP no tiene `DEDUCTED` (tiene `DISCT TO SUP`). El schema documenta esta diferencia por hoja; la UI muestra la columna disponible por segmento y deja vacía la celda si esa hoja no tiene el dato equivalente.

## Filtro: "saldo pendiente"

- **CXC**: fila incluida si `INVOICE` tiene datos **Y** `AR` ≠ 0 y ≠ vacío.
- **CXP**: fila incluida si `INV SUP` tiene datos **Y** `AMOUNT SUP` ≠ `$ TO CASH` (saldo pendiente = `AMOUNT SUP - $ TO CASH`, tratando `$ TO CASH` vacío como 0).

## Arquitectura

- `dashboard/src/lib/cxcCxpClient.ts`: `CXC_CXP_SPREADSHEET_ID`, `fetchCxcCxpSheet(sheetName: 'MARITIMOS' | 'TERRESTRES', api)` — reutiliza `getSheetsApi()` de `sheetsClient.ts`. Sigue el patrón de `SheetFetchResult` (rows + error opcional) de `ordenesClient.ts`.
- `dashboard/src/lib/cxcCxpSchema.ts`: define los 4 bloques de columnas (arriba) como `FieldSchema[]` con índice real por hoja, más `AR_INDEX` / `AMOUNT_SUP_INDEX` / etc. para el filtro.
- `dashboard/src/lib/normalizeCxcCxp.ts`:
  - `filterCxcRows(rows, schema): CxcRow[]` — aplica filtro CXC, agrupa por `CLIENT`, calcula subtotal por cliente y total del segmento.
  - `filterCxpRows(rows, schema): CxpRow[]` — aplica filtro CXP, agrupa por `ORIGIN`, calcula subtotal por origin y total del segmento (usa `CLIENT`/`MATERIAL` de las columnas CXC de la misma fila, ya que son el mismo row del sheet).
- Endpoint `GET /api/cxc-cxp`: fetch fresco en cada llamada (sin cache propio — 15 min de poll + botón manual no justifica una capa de cache adicional). Responde:
  ```ts
  {
    maritimo: { cxc: ClienteGroup[], cxp: OriginGroup[], error?: string },
    terrestre: { cxc: ClienteGroup[], cxp: OriginGroup[], error?: string },
    lastUpdated: string
  }
  ```
  Si una hoja falla, su bloque trae `error` y el resto de la respuesta sigue sirviendo (mismo patrón que `SheetFetchResult`).

## UI

- Nuevo tab superior "CXC/CXP" junto a los tabs existentes del CRM (Terrestre/Marítimo/Nacional/Compras/Inventarios).
- Sub-tabs internos: **Marítimo** / **Terrestre**.
- Cada sub-tab muestra dos tablas apiladas, estilo tabla horizontal agrupada (paleta actual del dashboard, no los colores del mockup de referencia):
  - **Tabla CXC** — agrupada por Cliente: header "CLIENTE: X", filas con columnas `Seller, Contract, Material, Invoice, Date, Amount, $ To Cash, AR`, fila subtotal "Total X: $..." al cierre de cada grupo, fila "Total Segmento: $..." al final de la tabla.
  - **Tabla CXP** — agrupada por Origin: header "ORIGIN: X", filas con columnas `Cliente, Material, Origin, Supplier, Inv Sup, Date, Kg Sup, %, DLR, Price Sup, Amount Sup, To Cash, Paymnt Date, Disct To Sup (o Deducted en Marítimo), GProfit`, subtotal por origin, total de segmento al final.
- Botón "Refrescar" arriba del panel + indicador "última actualización: hace Xm". Poll automático cada 15 minutos mientras el tab esté activo (no cuando está en background).
- Sin filas pendientes en una tabla → mensaje "Sin facturas con saldo pendiente".
- Error de carga (spreadsheet sin compartir, hoja no encontrada, etc.) → banner "No se pudo cargar CXC/CXP: <mensaje>" con botón reintentar, en vez de tabla vacía.

## Manejo de errores

- Falla `GET /api/cxc-cxp` completo (red, auth): banner de error a nivel de módulo, botón reintentar.
- Falla una sola hoja (`MARITIMOS` o `TERRESTRES`): esa sub-tab muestra el banner de error, la otra sigue funcionando normalmente.
- Spreadsheet no compartido con el service account (403 de Sheets API): mismo banner de error, mensaje incluye sugerencia "verificar permisos del spreadsheet".

## Testing

- Unit `cxcCxpSchema.test.ts`: índices correctos por hoja/tipo (Marítimo CXC/CXP, Terrestre CXC/CXP).
- Unit `normalizeCxcCxp.test.ts`:
  - Filtro CXC: incluye fila con invoice+AR≠0, excluye invoice vacío, excluye AR=0/vacío.
  - Filtro CXP: incluye fila con inv sup + amount≠tocash, excluye inv sup vacío, excluye amount=tocash.
  - Agrupación por cliente/origin y cálculo de subtotales/total correctos.
- Unit ruta `GET /api/cxc-cxp`: shape de respuesta, error de una hoja no tumba la respuesta completa.
- Component `CxcCxpPanel.test.tsx`: renderiza sub-tabs Marítimo/Terrestre, cada uno con tabla CXC y CXP agrupadas, botón refrescar dispara refetch, banner de error se muestra cuando corresponde.
- Manual: comparar contra el sheet real que las filas y subtotales mostrados coincidan con las facturas pendientes reales, en ambos segmentos.

## Qué NO cambia / fuera de alcance

- Sin edición ni escritura al spreadsheet EXPORTACIONES 2026.
- Sin filtros adicionales (fecha, monto, búsqueda).
- Sin exportar a Excel/PDF.
- Sin cambios a Cotizador (`Codigo.gs`, `deploy/index.html`) ni al spreadsheet del CRM principal.
- Sin restricción de acceso por email (reutiliza `AuthGate` existente).
