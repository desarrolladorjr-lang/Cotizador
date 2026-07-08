# Ligar N° Contrato en Back to Back — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En modo Back to Back, el usuario elige el n° de contrato (col D de la hoja fuente) y se guarda en una nueva columna U de la hoja de cotización.

**Architecture:** Apps Script (`Codigo.gs`) expone `doGet` (lee pendientes) y `doPost` (guarda tratos). Frontend single-file React-via-CDN en `deploy/index.html`. El contrato fluye: `doGet` lo devuelve → frontend lo muestra en 3er dropdown → `payload` → `doPost` lo escribe en col U.

**Tech Stack:** Google Apps Script, React (UMD CDN, sin build), Tailwind CDN. Sin framework de tests — verificación manual en navegador y en el editor de Apps Script.

**Spec:** `docs/superpowers/specs/2026-06-04-contrato-back-to-back-design.md`

**Nota de testing:** Este proyecto no tiene framework de tests automatizados. Cada tarea termina con verificación manual concreta (qué abrir, qué hacer, qué resultado esperar).

---

### Task 1: doGet devuelve n° contrato

**Files:**
- Modify: `Codigo.gs:82-129` (bloques TERRESTRES y MARÍTIMO dentro de `doGet`)

- [ ] **Step 1: Agregar contrato al bloque TERRESTRES**

En `Codigo.gs`, dentro del loop de TERRESTRES (aprox. líneas 93-102), reemplazar:

```javascript
      for (var i = headerRowT + 1; i < dataT.length; i++) {
        var row = dataT[i];
        var client = row[0], material = row[4], estWeight = row[7];
        if (!client || client === 'INVENTARIO' || estWeight <= 1) continue;
        var key = client + '|' + material;
        if (!seenT[key]) {
          seenT[key] = true;
          result.terrestre.push({ client: String(client), material: String(material) });
        }
      }
```

por:

```javascript
      for (var i = headerRowT + 1; i < dataT.length; i++) {
        var row = dataT[i];
        var client = row[0], contrato = row[3], material = row[4], estWeight = row[7];
        if (!client || client === 'INVENTARIO' || estWeight <= 1) continue;
        var key = client + '|' + material + '|' + contrato;
        if (!seenT[key]) {
          seenT[key] = true;
          result.terrestre.push({ client: String(client), material: String(material), contrato: String(contrato) });
        }
      }
```

- [ ] **Step 2: Agregar contrato al bloque MARÍTIMO**

Dentro del loop de MARÍTIMO (aprox. líneas 118-127), reemplazar:

```javascript
      for (var i = headerRowM + 1; i < dataM.length; i++) {
        var row = dataM[i];
        var client = row[0], material = row[4], estWeight = row[12];
        if (!client || client === 'INVENTARIO' || estWeight <= 1) continue;
        var key = client + '|' + material;
        if (!seenM[key]) {
          seenM[key] = true;
          result.maritimo.push({ client: String(client), material: String(material) });
        }
      }
```

por:

```javascript
      for (var i = headerRowM + 1; i < dataM.length; i++) {
        var row = dataM[i];
        var client = row[0], contrato = row[3], material = row[4], estWeight = row[12];
        if (!client || client === 'INVENTARIO' || estWeight <= 1) continue;
        var key = client + '|' + material + '|' + contrato;
        if (!seenM[key]) {
          seenM[key] = true;
          result.maritimo.push({ client: String(client), material: String(material), contrato: String(contrato) });
        }
      }
```

- [ ] **Step 3: Verificación manual (editor Apps Script)**

1. Pegar el `Codigo.gs` actualizado en el proyecto Apps Script ligado al spreadsheet `14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc`.
2. Deploy → Manage deployments → editar deployment existente → New version → Deploy.
3. Abrir la URL del Web App (GET) en el navegador.
4. Esperado: JSON `{ "terrestre": [...], "maritimo": [...] }` donde cada item tiene **3 campos**: `client`, `material`, `contrato`. Verificar que `contrato` trae el valor de la columna D.

- [ ] **Step 4: Commit**

```bash
git add Codigo.gs
git commit -m "feat: doGet devuelve n contrato (col D) en pendientes"
```

---

### Task 2: doPost guarda contrato en columna U

**Files:**
- Modify: `Codigo.gs:37-59` (array `row` de la rama no-inventarios)

- [ ] **Step 1: Agregar data.contrato al final del array row**

En `Codigo.gs`, en el `else` (rama no-inventarios), reemplazar el cierre del array:

```javascript
        data.utilidadNeta,
        data.tipoCompra,
        data.notas
      ];
```

por:

```javascript
        data.utilidadNeta,
        data.tipoCompra,
        data.notas,
        data.contrato || ''
      ];
```

(La rama `inventarios` NO se toca.)

- [ ] **Step 2: Agregar encabezado en las hojas destino (manual)**

En el spreadsheet, en las hojas `Terrestre`, `Marítimo` y `Nacional`, escribir el encabezado **"N° Contrato"** en la celda **U** de la fila de encabezados. (Una sola vez.)

- [ ] **Step 3: Verificación manual (POST de prueba)**

1. Re-deploy del Web App (New version) con el `Codigo.gs` actualizado.
2. Desde el frontend (o un POST manual) enviar un payload no-inventarios que incluya `"contrato": "TEST-123"`.
3. Esperado: en la hoja correspondiente aparece una fila nueva con `TEST-123` en la columna **U**.
4. Enviar un payload sin `contrato` → col U queda vacía (sin error).

- [ ] **Step 4: Commit**

```bash
git add Codigo.gs
git commit -m "feat: doPost escribe n contrato en columna U"
```

---

### Task 3: Estado `contrato` en frontend

**Files:**
- Modify: `deploy/index.html:289-293` (bloque de estado Compra Directa)

- [ ] **Step 1: Agregar el estado**

En `deploy/index.html`, tras la línea `const [errorPendientes, setErrorPendientes] = useState('');` (línea ~293), agregar:

```javascript
          const [contrato, setContrato] = useState('');
```

- [ ] **Step 2: Verificación**

Abrir `deploy/index.html` en el navegador. La app carga sin errores en consola (F12). Aún no hay UI nueva — solo confirmar que no rompió.

- [ ] **Step 3: Commit**

```bash
git add deploy/index.html
git commit -m "feat: estado contrato en frontend"
```

---

### Task 4: Lista de contratos derivada + auto-select/reset

**Files:**
- Modify: `deploy/index.html:735-737` (zona de `currentClientes`, derivaciones)
- Modify: `deploy/index.html` (agregar `useEffect` cerca de los demás efectos)

- [ ] **Step 1: Derivar currentContratos**

En `deploy/index.html`, justo después de la definición de `currentClientes` (línea ~737), agregar:

```javascript
          const currentContratos = compraDirecta && tabPendientes.length > 0
            ? [...new Set(tabPendientes
                .filter(p => p.material === material && p.client === cliente)
                .map(p => p.contrato))]
            : [];
```

- [ ] **Step 2: Auto-select / reset del contrato**

Agregar un `useEffect` junto a los demás efectos del componente (p.ej. cerca de la línea 405). Pegar:

```javascript
          React.useEffect(() => {
            if (!compraDirecta) { setContrato(''); return; }
            const lista = tabPendientes
              .filter(p => p.material === material && p.client === cliente)
              .map(p => p.contrato);
            const unicos = [...new Set(lista)];
            if (unicos.length === 1) setContrato(unicos[0]);
            else setContrato('');
          }, [compraDirecta, cliente, material, activeTab]);
```

- [ ] **Step 3: Verificación**

Recargar la app. En consola (F12) no debe haber errores. (El dropdown se agrega en Task 5; aquí solo se valida que las derivaciones no rompen el render.)

- [ ] **Step 4: Commit**

```bash
git add deploy/index.html
git commit -m "feat: derivar contratos y auto-select en back to back"
```

---

### Task 5: Dropdown N° Contrato en la UI

**Files:**
- Modify: `deploy/index.html:888-906` (grid Material/Destino — agregar bloque después)

- [ ] **Step 1: Insertar el dropdown**

En `deploy/index.html`, después del `</div>` que cierra el grid `grid-cols-2` de Material/Destino (línea ~906), insertar:

```javascript
                  {compraDirecta && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span className="text-gray-400">N° Contrato</span>
                        <span className="font-black" style={{ color: '#ff6600' }}>● PENDIENTE</span>
                      </label>
                      <select value={contrato} onChange={e => setContrato(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none">
                        <option value="">— Selecciona contrato —</option>
                        {currentContratos.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
```

- [ ] **Step 2: Verificación manual (navegador)**

1. Abrir `deploy/index.html`. Iniciar sesión.
2. Tab Terrestre o Marítimo → activar **Back to Back** (espera carga de pendientes).
3. Elegir un material y cliente que existan en pendientes.
4. Esperado: aparece el dropdown "N° Contrato ● PENDIENTE" con los contratos de ese cliente+material. Si hay 1 solo, queda auto-seleccionado.
5. Desactivar Back to Back → el dropdown desaparece y `contrato` se limpia.

- [ ] **Step 3: Commit**

```bash
git add deploy/index.html
git commit -m "feat: dropdown N contrato en modo back to back"
```

---

### Task 6: Enviar contrato en el payload

**Files:**
- Modify: `deploy/index.html:707-708` (objeto `payload`)

- [ ] **Step 1: Agregar contrato al payload**

En `deploy/index.html`, en el objeto `payload` dentro de `handleGuardarCotizacion`, tras la línea `tipoCompra: compraDirecta ? 'Back to Back' : 'Compra Inventarios',` (línea ~707), agregar:

```javascript
                contrato: compraDirecta ? contrato : '',
```

- [ ] **Step 2: Verificación end-to-end**

1. Con el Web App ya redeployado (Tasks 1-2) y la hoja con encabezado en col U:
2. Abrir la app → Back to Back → elegir cliente+material+contrato → completar el trato → **Guardar**.
3. Esperado: mensaje "✅ ¡Trato guardado exitosamente!" y, en la hoja `Terrestre`/`Marítimo`, fila nueva con el n° de contrato elegido en la columna **U** y `Back to Back` en col S.
4. Guardar un trato en modo normal (no Back to Back) → col U vacía.

- [ ] **Step 3: Commit**

```bash
git add deploy/index.html
git commit -m "feat: enviar n contrato en payload de guardado"
```

---

## Self-Review notes

- **Cobertura spec:** doGet contrato (Task 1) ✓ · doPost col U (Task 2) ✓ · encabezado manual (Task 2 step 2) ✓ · estado (Task 3) ✓ · derivación + auto-select + reset (Task 4) ✓ · dropdown (Task 5) ✓ · payload (Task 6) ✓.
- **Reset en cambio de tab:** cubierto por el `useEffect` de Task 4 (dependencia `activeTab`).
- **Consistencia de nombres:** `contrato`/`setContrato`, `currentContratos`, `data.contrato` usados igual en todas las tareas.
- **`React.useEffect`:** el archivo usa React por CDN (UMD); los hooks se acceden vía `React.useEffect` o el destructuring existente al inicio del componente. Si el componente ya hace `const { useState, useEffect } = React;`, usar `useEffect` sin prefijo para igualar el estilo local.
