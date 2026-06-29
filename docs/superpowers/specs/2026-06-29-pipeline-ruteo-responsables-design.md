# Pipeline — Ruteo logístico y visibilidad por trabajo (Pieza A) — Design Spec
Date: 2026-06-29

## Overview

Enriquece el Pipeline de **Compras** del dashboard con la dimensión logística que hoy no está modelada: la rama por la que viaja una operación (directa vs bodega, export terrestre/marítimo vs nacional, destino Monterrey→inventarios, 1 o 2 recolecciones) y los **trabajos** que distintas personas ejecutan en cada rama (cargas, entrada, ticket+lista de empaque).

El modelo es **pull, no push**: nadie asigna trabajo. Cada persona (Bruno, Ely, Jorge, Carlos) ve los ops que le corresponden mediante **filtros sobre el board existente** y agarra lo suyo. Al ejecutar un trabajo lo **marca hecho y captura su dato**, quedando trazado quién y cuándo.

Construye directo sobre lo existente: `dashboard/src/lib/pipelineSchema.ts`, `pipelineMachine.ts`, `pipelineClient.ts`, `PATCH /api/pipeline/[opId]`, `PipelineBoard.tsx`, `OpDrawer.tsx` (ver specs 2026-06-19-dashboard-feed y 2026-06-20-dashboard-crm-modulos).

Esta es la **Pieza A** de un trabajo mayor. La **Pieza B** (jerarquía contrato→pedidos→cargas, desglose de tonelaje) es un ciclo separado posterior y queda fuera de alcance aquí.

## Alcance

- Solo afecta el **track Compras** del Pipeline. Ventas no cambia.
- Captura de ruteo y trabajos ocurre **en el dashboard** (al dar seguimiento al op), no en el Cotizador. `Codigo.gs` y `deploy/` no se tocan.
- La máquina de etapas (`instruccion→oc_enviada→recoleccion→ingreso→cxp`) **no cambia**; los trabajos viven dentro de etapas existentes.
- Sin restricción de acceso por persona/email: la visibilidad es por **filtros** (chips), no por permisos.

## Modelo de datos

Se extiende `PipelineRecord` / `PIPELINE_SCHEMA` con columnas nuevas al final de la hoja `Pipeline` (mismo patrón flat existente). Dos grupos.

### A) Ruteo (captura manual, default derivado)

| campo | valores | default derivado |
|---|---|---|
| `ruta` | `directa` \| `bodega` | vacío — el operador elige |
| `modalidad` | `export_terrestre` \| `export_maritimo` \| `nacional` | de la fila origen si se puede inferir; si no, `nacional` |
| `destino` | `monterrey` \| `otro` | `monterrey` si la fila origen trae flag `paraInventarios` = Sí; si no, `otro` |
| `recolecciones` | `1` \| `2` | `1` |

Los defaults se calculan en el cliente (`OpDrawer`) la primera vez que se abre un op sin ruteo previo, a partir de los campos ya disponibles en `FeedRow`/`PipelineRecord`. Son sugerencias: siempre editables, nunca bloquean.

### B) Trabajos (hecho + dato + por + fecha)

| trabajo | aplica cuando | dato | quién (pull) |
|---|---|---|---|
| `cargas` | `modalidad` = `export_terrestre` | `cargasNum` (nº cargas hechas) | Bruno |
| `entrada` | `ruta` = `bodega` **o** `destino` = `monterrey` | `noEntrada` (campo ya existente) | Ely (bodega) / Bruno (Monterrey) |
| `ticketEmpaque` | `ruta` = `directa` | nota opcional (`ticketEmpaqueNota`) | Jorge / Carlos |

Columnas nuevas por trabajo:
- `cargasHecho`, `cargasNum`, `cargasPor`, `cargasFecha`
- `entradaHecho`, `entradaPor`, `entradaFecha` (el dato es el `noEntrada` ya existente, no se duplica)
- `ticketEmpaqueHecho`, `ticketEmpaqueNota`, `ticketEmpaquePor`, `ticketEmpaqueFecha`

`*Hecho` se almacena como `'Sí'`/`''` (mismo criterio booleano-en-texto que `paraInventarios`). `*Por` = email; `*Fecha` = ISO timestamp.

Total nuevo: 4 (ruteo) + 11 (trabajos) = 15 columnas planas nuevas en `Pipeline`.

### Esquema (orden en la hoja)

Los campos nuevos se insertan **antes** de `editadoPor`/`editadoFecha`, que se reubican al final del array y de la hoja para que la auditoría global quede siempre en las dos últimas columnas (paso manual de reordenar encabezados, una sola vez). Orden nuevo:

```
opId, contrato, track, etapa, estatusEtapa, noPO, noSDL, noEntrada,
estatusPago, mesCierre, notas,
ruta, modalidad, destino, recolecciones,
cargasHecho, cargasNum, cargasPor, cargasFecha,
entradaHecho, entradaPor, entradaFecha,
ticketEmpaqueHecho, ticketEmpaqueNota, ticketEmpaquePor, ticketEmpaqueFecha,
editadoPor, editadoFecha
```

`recordToValues` y `PipelineRecord` se actualizan en consecuencia. Como `recordToValues` deriva del orden de `PIPELINE_SCHEMA`, el `expectedValues` (snapshot de concurrencia) sigue funcionando sin lógica adicional.

## Trabajos dentro de etapas

Los trabajos no son etapas nuevas; se relacionan con etapas existentes:
- `cargas` ↔ etapa `recoleccion`
- `entrada` y `ticketEmpaque` ↔ etapa `ingreso`

Esta relación es informativa (guía qué mostrar en el drawer); la máquina de transiciones no la fuerza. Un op puede marcar un trabajo hecho estando en cualquier etapa donde el drawer lo muestre.

## UI — OpDrawer

El drawer (`OpDrawer.tsx`) hoy captura `estatusEtapa`, `noSDL`, `noEntrada` al avanzar. Se extiende con dos bloques, sin romper el avance lineal.

### Bloque Ruteo (siempre visible para ops de Compras)

- 4 selectores: `ruta`, `modalidad`, `destino`, `recolecciones`.
- Prellenados con el default derivado la primera vez; editables siempre.
- Se guardan vía el PATCH existente (van en `fields`); no requieren avanzar de etapa.

### Bloque Trabajos (condicional según ruteo)

- Renderiza solo los trabajos que aplican a la rama actual (tabla de Modelo de datos §B):
  - `modalidad = export_terrestre` → trabajo `cargas`.
  - `ruta = bodega` o `destino = monterrey` → trabajo `entrada`.
  - `ruta = directa` → trabajo `ticketEmpaque`.
- Cada trabajo: checkbox **Hecho** + input de su dato (`cargas`→nº, `entrada`→`noEntrada`, `ticketEmpaque`→nota opcional).
- Si ya está hecho, muestra "✓ hecho por &lt;email&gt; · &lt;fecha&gt;" (de `*Por`/`*Fecha`).

### Guardado

- Botón existente **"Guardar y avanzar a &lt;etapa&gt;"** sigue igual.
- Nuevo botón **"Guardar cambios"** (sin avanzar): PATCH con `etapa = etapa actual`, registrando ruteo/trabajos sin transición. El backend ya permite quedarse en la misma etapa.
- Ambos usan `PATCH /api/pipeline/[opId]` existente.

## UI — PipelineBoard (filtros)

En `PipelineBoard.tsx`, **solo en track Compras**, se agrega una fila de **chips de filtro** multi-toggle bajo los pills Compras/Ventas. Ninguno activo = ver todo.

| chip | muestra ops donde | para |
|---|---|---|
| **Cargas terrestre** | `modalidad = export_terrestre` y `cargasHecho` vacío | Bruno |
| **Entrada bodega** | `ruta = bodega` y `entradaHecho` vacío | Ely |
| **Entrada Monterrey** | `destino = monterrey` y `entradaHecho` vacío | Bruno |
| **Ticket+empaque** | `ruta = directa` y `ticketEmpaqueHecho` vacío | Jorge / Carlos |
| **2ª recolección** | `recolecciones = 2` | quien recolecta |

Lógica:
- Filtro puro front sobre `trackRows` (mismo enfoque que el filtro de track actual). Sin endpoint nuevo.
- Varios chips activos = **unión (OR)**. Un op puede caer en varios chips.
- "Pendiente" = `*Hecho` vacío; al marcarse hecho, el op sale del chip.
- Chips solo en Compras; Ventas sin cambios.
- Kanban y Tabla siguen igual; los filtros solo reducen el conjunto de tarjetas/filas visible.

## Backend

`PATCH /api/pipeline/[opId]/route.ts` ya arma `candidate = {...current, ...fields, etapa, estatusEtapa}`, así que los campos nuevos fluyen por `fields` con cambios mínimos.

### Cambios

- **`pipelineSchema.ts`:** agregar las 15 columnas a `PIPELINE_SCHEMA`, `PipelineRecord` y (vía orden de schema) `recordToValues`.
- **Estampado por-trabajo (server-side, en la ruta PATCH):** antes de persistir, para cada trabajo `t` en `{cargas, entrada, ticketEmpaque}`, si `fields[t+'Hecho']` pasa de vacío (en `current`) a marcado (`'Sí'`), fijar en el `candidate`:
  - `<t>Por = verified.email`
  - `<t>Fecha = new Date().toISOString()`

  Se estampa en el **servidor** con el email del JWT verificado (no se confía en `*Por`/`*Fecha` que mande el cliente; si vienen en `fields`, se ignoran/sobrescriben). Si `*Hecho` ya estaba marcado y no cambia, no se re-estampa.
- **`pipelineMachine.ts` — `capturaRequerida`:** al marcar un trabajo hecho, exigir su dato:
  - marcar `cargasHecho` requiere `cargasNum` no vacío.
  - marcar `entradaHecho` requiere `noEntrada` no vacío.
  - `ticketEmpaqueHecho` no requiere dato (nota opcional).

  Reusa el mecanismo de validación → respuesta **422** existente. La firma de `capturaRequerida` se amplía si hace falta para considerar los `*Hecho` entrantes (o se agrega una validación hermana invocada desde la ruta; decisión de implementación, sin cambiar el contrato 422 hacia el cliente).
- **`etapasFor` / transiciones:** sin cambios.

## Manejo de errores (todo reuso)

- **Conflicto concurrente** → 409; el drawer avisa "cambió en otra sesión, recarga" (ya existe). El snapshot `expectedValues` cubre las columnas nuevas automáticamente.
- **Falta dato de trabajo** → 422, mensaje "falta &lt;campo&gt;" (ya existe).
- **Sheets API falla** → 503; el drawer no cierra, el usuario reintenta (ya existe).
- **Default derivado incorrecto** (ej. `modalidad` mal inferida): no bloquea; el operador corrige el selector a mano antes de guardar.

## Persistencia / auditoría

- Misma hoja `Pipeline`, mismo compare-con-snapshot (`expectedValues`) para concurrencia.
- `editadoPor`/`editadoFecha` global se mantiene (último que tocó el op).
- Los `*Por`/`*Fecha` por-trabajo son auditoría adicional, específica de cada trabajo. No se versiona historial; solo el último que marcó cada trabajo.

## Testing

- **Unit `pipelineSchema.test.ts`:** `recordToValues` incluye los campos nuevos en el orden correcto; longitud de fila correcta; `recordToValues` redondea-trip con `PipelineRecord`.
- **Unit `pipelineMachine.test.ts`:** la validación de captura exige `cargasNum` al marcar `cargasHecho`, `noEntrada` al marcar `entradaHecho`, y nada para `ticketEmpaqueHecho`; no exige nada si el `*Hecho` no cambia.
- **Unit ruta PATCH (`[opId]/route.test.ts`):** estampa `<t>Por`/`<t>Fecha` solo cuando `*Hecho` pasa vacío→marcado; usa `verified.email`, ignora `*Por`/`*Fecha` del cliente; 422 si falta dato del trabajo; 409 en conflicto; 200 en éxito guardando los campos de ruteo.
- **Component `OpDrawer.test.tsx`:** el bloque ruteo prellena defaults derivados (terrestre→`export_terrestre`, `paraInventarios`→`destino=monterrey`); el bloque trabajos renderiza solo los trabajos de la rama actual; marcar Hecho + "Guardar cambios" dispara PATCH con el `fields` correcto y `etapa = actual`.
- **Component `PipelineBoard.test.tsx`:** los chips filtran `trackRows` por trabajo pendiente; varios chips = unión; chips visibles solo en Compras.
- **Manual:** dar seguimiento a un op real por cada rama (export_terrestre, bodega, directa, monterrey); confirmar que las columnas nuevas (incluidas `*Por`/`*Fecha`) aparecen en la hoja `Pipeline` real; marcar un trabajo hecho desde dos pestañas para confirmar que la segunda recibe conflicto (409).

## Pasos manuales (una vez)

- Reordenar/agregar encabezados en la hoja `Pipeline`: insertar las 15 columnas nuevas y reubicar `editadoPor`/`editadoFecha` al final, en el orden de `PIPELINE_SCHEMA`.

## Qué NO cambia / fuera de alcance

- **Pieza B** (contrato→pedidos→cargas, desglose de tonelaje): ciclo separado posterior.
- Cotizador (`Codigo.gs`, `deploy/`): sin tocar; el ruteo se captura en el dashboard.
- Track **Ventas**: sin cambios.
- Sin restricción de acceso por persona/email (visibilidad por chips, no permisos).
- Sin métricas/reportes de productividad por persona.
- Sin historial versionado de auditoría (solo último editor por trabajo).
