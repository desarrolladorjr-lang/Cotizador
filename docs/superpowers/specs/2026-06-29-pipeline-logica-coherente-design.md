# Pipeline — Lógica coherente (entrada, back-to-back, sub-estatus) — Design Spec
Date: 2026-06-29

## Overview

Corrige tres inconsistencias de la lógica del Pipeline detectadas tras Pieza A, manteniendo
coherencia con la app en deploy y la hoja `Pipeline`. No cambia la máquina de etapas.

## Problemas y decisiones

### 1. Entrada asimétrica → entrada simétrica (auto-crear ambos)
- **Antes:** Compras se auto-creaba en `feed/route.ts` (`instruccion/pendiente`); Ventas requería
  click "Iniciar seguimiento" (`promote` → `cerrada/ganada`). Dos modelos de entrada.
- **Decisión:** auto-crear también los ops de Ventas (`Terrestre/Marítimo/Nacional`) en el feed.
  Ventas arranca en `cerrada/ganada` (la cotización ya ocurrió en el Cotizador). El botón
  "Iniciar seguimiento" y `promote` quedan como fallback (no se removieron).
- **Sheet/Codigo.gs:** sin cambios.

### 2. Liga back-to-back por contrato
- **Hecho clave:** las filas de Compras NO tienen `contrato` (Codigo.gs no lo escribe); las de
  Ventas sí (col U / índice 20). `PipelineRecord.contrato` ya existía y persiste vía sync por-nombre.
- **Decisión:**
  - `FeedRow.contrato` se lee de col U para Ventas (`''` en Compras/Inventarios).
  - Al auto-crear un op de Ventas, su `contrato` se copia desde la fila → lado Ventas queda ligado solo.
  - En el OpDrawer de un op **Compras**, dropdown "Contrato ligado" poblado con los contratos
    distintos de Ventas; al guardar persiste en `contrato` del record.
  - Liga = match por `contrato` no vacío entre tracks. El drawer muestra el counterpart
    ("↔ ligado a Terrestre · ACME · contrato CT-1042"). `PipelineBoard` computa `contratosVenta`
    y `counterpartFor` y los pasa al drawer.
- **Sheet/Codigo.gs:** sin cambios (usa la columna `Contrato` del schema Pipeline).

### 3. Sub-estatus enum (no texto libre)
- **Antes:** `estatusEtapa` era `<input>` libre, pero `capturaRequerida` dispara según strings
  exactos (`bodega`, `directa_venta`, `interno`). Frágil: había que teclear el valor exacto.
- **Decisión:** `estatusOpciones(track, etapa)` define el enum cerrado por etapa
  (`compras/ingreso → [bodega, directa_venta]`, `ventas/asignada → [interno, externo]`,
  resto `[]` = texto libre). El OpDrawer renderiza `<select>` cuando hay enum, `<input>` si no.

## Fuera de alcance
- Etapa `cotizacion` muerta (no se tocó; Ventas sigue arrancando en `cerrada`).
- `modalidad` ruteo redundante con `tipo` de venta.
- Cambios a Codigo.gs / hojas fuente.

## Testing
- `normalizeFeed`: lee `contrato` de col U en Ventas, vacío en Compras.
- `feed/route`: auto-crea Ventas con `track=ventas, etapa=cerrada, contrato`.
- `pipelineMachine`: `estatusOpciones` por etapa; valores de captura presentes en su enum.
- `OpDrawer`: dropdown contrato manda `fields.contrato`; counterpart visible; sub-estatus es `<select>` en ingreso.
- `PipelineBoard`: pasa `contratosVenta`/`counterpart`.
- Suite completa: 115/115 verde, `tsc --noEmit` limpio.
