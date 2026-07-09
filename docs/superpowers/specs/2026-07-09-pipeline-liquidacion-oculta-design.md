# Pipeline — Ocultar tarjetas liquidadas (CxP/CxC) — Design

**Fecha:** 2026-07-09
**Estado:** Aprobado (pendiente de plan)

## Objetivo

Hoy una operación de Compras que llega a la etapa `cxp` (o de Ventas a `cxc`) se queda plantada ahí para siempre — no hay forma de saber, desde el kanban, si ya se pagó o cobró. El módulo separado `/api/cxc-cxp` (lee la hoja `EXPORTACIONES 2026`, tabs `MARITIMOS`/`TERRESTRES`) ya sabe distinguir saldo pendiente de saldo liquidado, pero no está conectado al Pipeline.

Este cambio cruza ambos módulos por `contrato` y oculta del kanban/tabla cualquier tarjeta en `cxp`/`cxc` cuyo contrato ya no tenga saldo pendiente en esa hoja. No se borra ni modifica nada en Google Sheets — es un filtro de lectura en `/api/feed`.

## Alcance

Aplica únicamente a tarjetas en:
- track `compras`, etapa `cxp`
- track `ventas`, etapa `cxc`

Cualquier otra etapa no se toca.

## Regla de decisión (por contrato)

La hoja EXPORTACIONES ya filtra internamente saldo cero al construir `CxcTable`/`CxpTable` (`buildCxcTable` descarta si `ar` es 0/vacío; `buildCxpTable` descarta si `amountSup === toCash`). Esto solo sirve para saber qué está *pendiente*, no para distinguir "ya se pagó" de "nunca hubo dato ahí" — ambos casos quedan ausentes de la tabla filtrada.

Se necesita una segunda pasada, sin el filtro de saldo, que solo verifique existencia de fila (columna `invoice`/`invSup` no vacía + `contract` no vacío). Con eso se arman dos sets por segmento combinado (maritimo + terrestre):

- **vistos**: contrato aparece en al menos una fila cruda (columna invoice/invSup no vacía).
- **pendientes**: contrato aparece en la tabla ya filtrada (`CxcTable`/`CxpTable`, saldo > 0).

Regla final por tarjeta:

| Situación | Resultado |
|---|---|
| contrato en pendientes | visible |
| contrato en vistos, no en pendientes | **oculta** (liquidado) |
| contrato no está en vistos (sin dato) | visible (no se puede confirmar) |

Compras (`cxp`) usa el set de CXP; Ventas (`cxc`) usa el set de CXC. Comparación de contrato: `trim().toLowerCase()` en ambos lados (mismo criterio que usa hoy `normLabel` en `pipelineClient.ts`) para evitar falsos negativos por espacios/mayúsculas.

## Cambios por archivo

### `dashboard/src/lib/cxcCxpSchema.ts`
Agregar `contract: number` a `CxpFieldIndex`. Valor `3` en ambos segmentos (misma columna que usa `CXC_SCHEMA[...].contract` — es la misma fila de la hoja, solo se leía un subconjunto de columnas antes).

### `dashboard/src/lib/normalizeCxcCxp.ts`
- Agregar `contract: string` a `CxpRow`, poblado desde `schema.contract` en `buildCxpTable`.
- Nueva función `buildContractStatus(rows: string[][], segmento: Segmento): { vistosCxc: Set<string>; pendientesCxc: Set<string>; vistosCxp: Set<string>; pendientesCxp: Set<string> }`. Recorre `dataRows` una vez (sin aplicar el filtro de saldo), usando los mismos schemas (`CXC_SCHEMA`, `CXP_SCHEMA`) para ubicar columnas. Los sets de "pendientes" pueden derivarse reutilizando `buildCxcTable`/`buildCxpTable` ya existentes (recorrer sus `grupos[].rows[].contract`) en vez de duplicar lógica de filtrado — solo la parte "vistos" es código nuevo.

### `dashboard/src/lib/pipelineLiquidacion.ts` (nuevo)
Función pura `estaLiquidado(record: PipelineRecord, status: ContractStatus): boolean` — aplica la tabla de decisión de arriba, ignora records fuera de etapa `cxp`/`cxc`. `ContractStatus` es el combinado de ambos segmentos (maritimo ∪ terrestre) devuelto por `buildContractStatus`.

### `dashboard/src/app/api/feed/route.ts`
Después de `attachPipeline(...)`:
1. Llama `fetchAllCxcCxpSheets()` (misma función que usa `/api/cxc-cxp`) envuelta en `try/catch` — si falla, se omite el filtro y todas las tarjetas quedan visibles (degradación segura, igual patrón que ya usa esta ruta para el resto).
2. Construye `ContractStatus` combinando MARITIMOS + TERRESTRES.
3. Filtra `joined.rows` quitando las que `estaLiquidado(row.pipeline, status)` sea `true`.

Cache TTL existente (25 s) de `/api/feed` cubre este resultado ya filtrado — no se necesita cache adicional.

## Errores y degradación

- Hoja EXPORTACIONES no disponible / error de red → no se filtra nada (todas visibles), igual que hoy si Pipeline sheet falla. No debe tumbar `/api/feed`.
- Contrato vacío en `PipelineRecord` (`record.contrato === ''`) → nunca se considera "visto", queda visible siempre (no hay como cruzarlo).

## Fuera de alcance

- No se modifica `estatusPago` ni ninguna columna en la hoja Pipeline.
- No hay forma de "volver a mostrar" una tarjeta oculta desde la UI (si se necesita, se revisa directo en la hoja EXPORTACIONES).
- No aplica a ninguna otra etapa del pipeline.
- No cambia el módulo `/api/cxc-cxp` en sí (sigue igual, aparte de exponer `contract` en `CxpRow`).

## Testing

- `normalizeCxcCxp.test.ts`: `buildContractStatus` — contrato con saldo pendiente → en `pendientes`; contrato con fila pero saldo cero → en `vistos`, no en `pendientes`; contrato ausente → en ninguno; `CxpRow.contract` se puebla igual que `CxcRow.contract` desde la misma columna.
- `pipelineLiquidacion.test.ts`: `estaLiquidado` — casos de la tabla de decisión completa (pendiente/liquidado/sin-dato), y confirma que etapas fuera de `cxp`/`cxc` siempre regresan `false` (nunca se ocultan).
- `feed/route.test.ts`: mock de `fetchAllCxcCxpSheets` — verifica que fila `cxp`/`cxc` liquidada se excluye de la respuesta; verifica que si `fetchAllCxcCxpSheets` lanza error, `/api/feed` sigue respondiendo 200 con todo visible (no rompe la ruta existente).
