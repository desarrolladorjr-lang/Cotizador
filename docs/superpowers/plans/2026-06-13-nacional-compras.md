# Modo "Compras" en Nacional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un tercer modo "Compras" al toggle del tab Nacional (junto a Back to Back / Simular) que oculta Cliente, agrega 2 checkboxes informativos (Para Inventarios, Intención de Venta) y permite comprar el mismo material a varios proveedores con cargas individuales por proveedor.

**Architecture:** Apps Script (`Codigo.gs`) expone `doPost` (guarda tratos). Frontend single-file React-via-CDN en `deploy/index.html`. Nuevo estado `modoCompras` controla un tercer botón del toggle (solo visible en Nacional), oculta el selector Cliente, reemplaza el bloque Proveedor/Cargas por una lista dinámica `comprasProveedores`, y agrega 2 checkboxes. Al guardar, `proveedor`/`cargas` se concatenan/suman y se agregan 2 columnas nuevas (V, W) al final de la fila.

**Tech Stack:** Google Apps Script, React (UMD CDN, sin build), Tailwind CDN. Sin framework de tests — verificación manual en navegador y en el editor de Apps Script.

**Spec:** `docs/superpowers/specs/2026-06-13-nacional-compras-design.md`

**Nota de testing:** Este proyecto no tiene framework de tests automatizados. Cada tarea termina con verificación manual concreta (qué abrir, qué hacer, qué resultado esperar).

---

### Task 1: doPost — columnas V/W (Para Inventarios, Intención Venta)

**Files:**
- Modify: `Codigo.gs:36-59` (array `row`, rama no-inventarios)

- [ ] **Step 1: Agregar las 2 columnas al final del array row**

En `Codigo.gs`, reemplazar:

```javascript
      row = [
        data.fecha,
        data.usuario,
        data.cliente,
        data.proveedor,
        data.cargas,
        data.material,
        data.destino,
        data.porcentajeFijacion,
        data.fixPrice,
        data.precioVenta,
        data.tcHoy,
        data.tcSeguro,
        data.fleteNac,
        data.cruceInt,
        data.precioTopeCompra,
        data.ppProv,
        data.status,
        data.utilidadNeta,
        data.tipoCompra,
        data.notas,
        data.contrato || ''
      ];
```

por:

```javascript
      row = [
        data.fecha,
        data.usuario,
        data.cliente,
        data.proveedor,
        data.cargas,
        data.material,
        data.destino,
        data.porcentajeFijacion,
        data.fixPrice,
        data.precioVenta,
        data.tcHoy,
        data.tcSeguro,
        data.fleteNac,
        data.cruceInt,
        data.precioTopeCompra,
        data.ppProv,
        data.status,
        data.utilidadNeta,
        data.tipoCompra,
        data.notas,
        data.contrato || '',
        data.paraInventarios ? 'Sí' : '',
        data.intencionVenta ? 'Sí' : ''
      ];
```

(La rama `inventarios` NO se toca.)

- [ ] **Step 2: Agregar encabezados en las hojas destino (manual)**

En el spreadsheet, en las hojas `Terrestre`, `Marítimo` y `Nacional`, escribir los encabezados **"Para Inventarios"** (col V) y **"Intención Venta"** (col W) en la fila de encabezados. (Una sola vez.)

- [ ] **Step 3: Verificación manual (editor Apps Script)**

1. Pegar el `Codigo.gs` actualizado en el proyecto Apps Script ligado al spreadsheet.
2. Deploy → Manage deployments → editar deployment existente → New version → Deploy.
3. Enviar un POST de prueba (no-inventarios) con `"paraInventarios": true, "intencionVenta": false`.
4. Esperado: fila nueva con `Sí` en col **V** y vacío en col **W**.
5. Enviar un POST sin esos campos → ambas columnas quedan vacías (sin error).

- [ ] **Step 4: Commit**

```bash
git add Codigo.gs
git commit -m "feat: doPost guarda flags Para Inventarios e Intencion Venta"
```

---

### Task 2: Estado nuevo y helpers en frontend

**Files:**
- Modify: `deploy/index.html:293` (bloque de estado Compra Directa)

- [ ] **Step 1: Agregar el estado nuevo**

En `deploy/index.html`, tras la línea `const [contrato, setContrato] = useState('');` (línea ~293), agregar:

```javascript
          const [modoCompras, setModoCompras] = useState(false);
          const [paraInventarios, setParaInventarios] = useState(false);
          const [intencionVenta, setIntencionVenta] = useState(false);
          const [comprasProveedores, setComprasProveedores] = useState([
            { proveedor: optionsProveedorNacional[0], cargas: "1" }
          ]);
```

- [ ] **Step 2: Agregar helpers para la lista dinámica**

Justo después del estado anterior, agregar:

```javascript
          const updateComprasProveedor = (i, field, value) => {
            setComprasProveedores(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
          };
          const addComprasProveedor = () => {
            setComprasProveedores(prev => [...prev, { proveedor: optionsProveedorNacional[0], cargas: "1" }]);
          };
          const removeComprasProveedor = (i) => {
            setComprasProveedores(prev => prev.filter((_, idx) => idx !== i));
          };
```

- [ ] **Step 3: Verificación**

Abrir `deploy/index.html` en el navegador (login). La app carga sin errores en consola (F12). Aún no hay UI nueva — solo confirmar que no rompió.

- [ ] **Step 4: Commit**

```bash
git add deploy/index.html
git commit -m "feat: estado y helpers de modo Compras en frontend"
```

---

### Task 3: Tercer botón "Compras" en el toggle + reset al cambiar de tab

**Files:**
- Modify: `deploy/index.html:940-974` (Mode Toggle)
- Modify: `deploy/index.html:417-450` (useEffect de reset por `activeTab`)

- [ ] **Step 1: Reemplazar el toggle de 2 botones por 3 (Compras solo en Nacional)**

En `deploy/index.html`, reemplazar:

```javascript
                  {/* Mode Toggle: Back to Back / Simular */}
                  <div className="flex">
                    <button
                      onClick={() => {
                        setModoSimulador(false);
                        if (tabPendientes.length === 0) fetchPendientes();
                        setCompraDirecta(true);
                      }}
                      disabled={cargandoPendientes}
                      className={`flex-1 py-2 rounded-l-lg text-[9px] font-black uppercase tracking-wide transition-colors border ${
                        compraDirecta && !modoSimulador
                          ? 'text-white z-10 relative'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                      style={compraDirecta && !modoSimulador ? { backgroundColor: '#ff6600', borderColor: '#ea580c' } : {}}
                    >
                      {cargandoPendientes ? 'Cargando...' : 'Back to Back'}
                    </button>
                    <button
                      onClick={() => {
                        setCompraDirecta(false);
                        setCruceInt("0");
                        setRutaIntSelect('');
                        setModoSimulador(true);
                      }}
                      className={`flex-1 py-2 rounded-r-lg -ml-px text-[9px] font-black uppercase tracking-wide transition-colors border ${
                        modoSimulador
                          ? 'text-white z-10 relative'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                      style={modoSimulador ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}}
                    >
                      Simular
                    </button>
                  </div>
```

por:

```javascript
                  {/* Mode Toggle: Back to Back / Simular / Compras */}
                  <div className="flex">
                    <button
                      onClick={() => {
                        setModoSimulador(false);
                        setModoCompras(false);
                        if (tabPendientes.length === 0) fetchPendientes();
                        setCompraDirecta(true);
                      }}
                      disabled={cargandoPendientes}
                      className={`flex-1 py-2 rounded-l-lg text-[9px] font-black uppercase tracking-wide transition-colors border ${
                        compraDirecta && !modoSimulador && !modoCompras
                          ? 'text-white z-10 relative'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                      style={compraDirecta && !modoSimulador && !modoCompras ? { backgroundColor: '#ff6600', borderColor: '#ea580c' } : {}}
                    >
                      {cargandoPendientes ? 'Cargando...' : 'Back to Back'}
                    </button>
                    <button
                      onClick={() => {
                        setCompraDirecta(false);
                        setModoCompras(false);
                        setCruceInt("0");
                        setRutaIntSelect('');
                        setModoSimulador(true);
                      }}
                      className={`flex-1 py-2 -ml-px text-[9px] font-black uppercase tracking-wide transition-colors border ${activeTab !== 'nacional' ? 'rounded-r-lg' : ''} ${
                        modoSimulador
                          ? 'text-white z-10 relative'
                          : 'text-gray-500 bg-transparent border-gray-700'
                      }`}
                      style={modoSimulador ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}}
                    >
                      Simular
                    </button>
                    {activeTab === 'nacional' && (
                      <button
                        onClick={() => {
                          setCompraDirecta(false);
                          setModoSimulador(false);
                          setCruceInt("0");
                          setRutaIntSelect('');
                          setModoCompras(true);
                        }}
                        className={`flex-1 py-2 rounded-r-lg -ml-px text-[9px] font-black uppercase tracking-wide transition-colors border ${
                          modoCompras
                            ? 'text-white z-10 relative'
                            : 'text-gray-500 bg-transparent border-gray-700'
                        }`}
                        style={modoCompras ? { backgroundColor: '#16a34a', borderColor: '#15803d' } : {}}
                      >
                        Compras
                      </button>
                    )}
                  </div>
```

- [ ] **Step 2: Resetear modoCompras y sus campos al cambiar de tab**

En `deploy/index.html`, dentro del `useEffect` de reset por `activeTab` (línea ~417), reemplazar:

```javascript
          useEffect(() => {
            setModoSimulador(false);
            setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo('');
            setCargandoPendientes(false);
            setCruceInt("0");
            setRutaIntSelect('');
            if (activeTab === 'inventarios') {
              setCompraDirecta(false);
              return;
            }
```

por:

```javascript
          useEffect(() => {
            setModoSimulador(false);
            setModoCompras(false);
            setParaInventarios(false);
            setIntencionVenta(false);
            setComprasProveedores([{ proveedor: optionsProveedorNacional[0], cargas: "1" }]);
            setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo('');
            setCargandoPendientes(false);
            setCruceInt("0");
            setRutaIntSelect('');
            if (activeTab === 'inventarios') {
              setCompraDirecta(false);
              return;
            }
```

- [ ] **Step 3: Verificación manual (navegador)**

1. Abrir `deploy/index.html`, login.
2. Tab Nacional → debe verse el tercer botón "Compras" (verde) a la derecha de "Simular".
3. Click "Compras" → botón queda resaltado en verde, "Back to Back"/"Simular" quedan apagados.
4. Tab Terrestre y Marítimo → solo 2 botones (Back to Back / Simular), sin "Compras".
5. Click "Back to Back" desde Compras → vuelve a resaltarse naranja, sin errores en consola.

- [ ] **Step 4: Commit**

```bash
git add deploy/index.html
git commit -m "feat: tercer boton Compras en toggle de Nacional"
```

---

### Task 4: Checkboxes "Para Inventarios" / "Intención de Venta"

**Files:**
- Modify: `deploy/index.html:980-991` (zona tras el aviso "Sin pendientes", antes del selector Cliente)

- [ ] **Step 1: Insertar los checkboxes**

En `deploy/index.html`, después del bloque:

```javascript
                  {compraDirecta && tabPendientes.length === 0 && !cargandoPendientes && (
                    <div className="text-yellow-400 text-[10px] font-bold text-center bg-yellow-900 border border-yellow-700 rounded-lg p-2">
                      Sin pendientes para esta modalidad
                    </div>
                  )}
```

agregar:

```javascript
                  {modoCompras && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-300">
                        <input type="checkbox" checked={paraInventarios} onChange={e => setParaInventarios(e.target.checked)} className="w-4 h-4 accent-green-600" />
                        Para Inventarios
                      </label>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-300">
                        <input type="checkbox" checked={intencionVenta} onChange={e => setIntencionVenta(e.target.checked)} className="w-4 h-4 accent-green-600" />
                        Intención de Venta
                      </label>
                    </div>
                  )}
```

- [ ] **Step 2: Verificación manual (navegador)**

1. Tab Nacional → "Compras" → aparecen los 2 checkboxes "Para Inventarios" / "Intención de Venta", ambos sin marcar.
2. Marcar y desmarcar cada uno, sin errores en consola.
3. Cambiar a "Back to Back" o "Simular" → los checkboxes desaparecen.

- [ ] **Step 3: Commit**

```bash
git add deploy/index.html
git commit -m "feat: checkboxes Para Inventarios e Intencion de Venta en modo Compras"
```

---

### Task 5: Ocultar selector Cliente en modo Compras

**Files:**
- Modify: `deploy/index.html:986-991`

- [ ] **Step 1: Envolver el bloque Cliente en condicional**

En `deploy/index.html`, reemplazar:

```javascript
                  <div>
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
                    <select value={cliente} onChange={e => setCliente(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none">
                      {currentClientes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
```

por:

```javascript
                  {!modoCompras && (
                    <div>
                      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
                      <select value={cliente} onChange={e => setCliente(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none">
                        {currentClientes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
```

- [ ] **Step 2: Verificación manual (navegador)**

1. Tab Nacional → "Compras" → el selector "Cliente" no aparece.
2. Cambiar a "Back to Back" o "Simular" → el selector "Cliente" reaparece normalmente.

- [ ] **Step 3: Commit**

```bash
git add deploy/index.html
git commit -m "feat: ocultar selector Cliente en modo Compras"
```

---

### Task 6: Bloque multi-proveedor (reemplaza Proveedor + Cargas) y visualKg

**Files:**
- Modify: `deploy/index.html:562-564` (`numCargas`/`visualKg`)
- Modify: `deploy/index.html:1222-1259` (grid Proveedor / Cargas en "Datos Informativos")

- [ ] **Step 1: Calcular total de cargas de Compras y ajustar visualKg**

En `deploy/index.html`, reemplazar:

```javascript
          // VISUALIZACIÓN: Ahora 1 carga = 19,500 kg
          const numCargas = Number(cargas) || 0;
          const visualKg = numCargas * (activeTab === 'nacional' ? 24500 : 19500);
```

por:

```javascript
          // VISUALIZACIÓN: Ahora 1 carga = 19,500 kg
          const numCargas = Number(cargas) || 0;
          const comprasTotalCargas = comprasProveedores.reduce((sum, r) => sum + (Number(r.cargas) || 0), 0);
          const visualKg = (modoCompras ? comprasTotalCargas : numCargas) * (activeTab === 'nacional' ? 24500 : 19500);
```

- [ ] **Step 2: Envolver el grid Proveedor/Cargas en condicional y agregar lista multi-proveedor**

En `deploy/index.html`, reemplazar:

```javascript
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Proveedor</label>
                        <select value={proveedor} onChange={e => setProveedor(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                          {currentProveedor.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        {activeTab === 'maritimo' ? (
                          <>
                            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                              Cap. Contenedor — <span className="font-black text-white">{capacidadCNT} TON</span>
                            </label>
                            <input
                              type="range"
                              min="5" max="30" step="1"
                              value={capacidadCNT}
                              onChange={e => setCapacidadCNT(Number(e.target.value))}
                              className="w-full accent-orange-500 cursor-pointer"
                              style={{ accentColor: '#ff6600' }}
                            />
                            <div className="flex justify-between text-[9px] text-gray-600 font-bold mt-0.5">
                              <span>5T</span><span>30T</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cargas</label>
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.5" value={cargas} onChange={e => setCargas(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors" />
                              <div className="bg-gray-800 text-gray-400 px-2 py-2 rounded border border-gray-700 text-[10px] font-black text-center leading-tight">
                                {visualKg.toLocaleString()} <br/>KG
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
```

por:

```javascript
                    {modoCompras ? (
                      <div className="space-y-2 mt-2">
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proveedores y Cargas</label>
                        {comprasProveedores.map((row, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <select value={row.proveedor} onChange={e => updateComprasProveedor(i, 'proveedor', e.target.value)} className="flex-1 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                              {optionsProveedorNacional.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="number" step="0.5" value={row.cargas} onChange={e => updateComprasProveedor(i, 'cargas', e.target.value)} className="w-24 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors" />
                            {comprasProveedores.length > 1 && (
                              <button onClick={() => removeComprasProveedor(i)} className="text-red-400 hover:text-red-300 font-black text-sm px-2">✕</button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center justify-between">
                          <button onClick={addComprasProveedor} className="text-[10px] font-black uppercase tracking-wider text-green-400 hover:text-green-300">+ Agregar proveedor</button>
                          <div className="bg-gray-800 text-gray-400 px-2 py-2 rounded border border-gray-700 text-[10px] font-black text-center leading-tight">
                            {visualKg.toLocaleString()} KG
                          </div>
                        </div>
                      </div>
                    ) : (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Proveedor</label>
                        <select value={proveedor} onChange={e => setProveedor(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                          {currentProveedor.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        {activeTab === 'maritimo' ? (
                          <>
                            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                              Cap. Contenedor — <span className="font-black text-white">{capacidadCNT} TON</span>
                            </label>
                            <input
                              type="range"
                              min="5" max="30" step="1"
                              value={capacidadCNT}
                              onChange={e => setCapacidadCNT(Number(e.target.value))}
                              className="w-full accent-orange-500 cursor-pointer"
                              style={{ accentColor: '#ff6600' }}
                            />
                            <div className="flex justify-between text-[9px] text-gray-600 font-bold mt-0.5">
                              <span>5T</span><span>30T</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cargas</label>
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.5" value={cargas} onChange={e => setCargas(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors" />
                              <div className="bg-gray-800 text-gray-400 px-2 py-2 rounded border border-gray-700 text-[10px] font-black text-center leading-tight">
                                {visualKg.toLocaleString()} <br/>KG
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    )}
```

- [ ] **Step 3: Verificación manual (navegador)**

1. Tab Nacional → "Compras" → en "Datos Informativos" aparece "Proveedores y Cargas" con 1 fila (proveedor + cargas) y el contador de KG totales.
2. Click "+ Agregar proveedor" → aparece una segunda fila con su propio selector y cantidad, y un botón "✕" en ambas filas.
3. Cambiar cargas de cada fila → el contador de KG (a la derecha del botón "+ Agregar proveedor") se actualiza con la suma × 24500.
4. Click "✕" en una fila → la elimina; con 1 fila restante el botón "✕" desaparece.
5. Cambiar a "Back to Back" o "Simular" → vuelve el grid normal Proveedor/Cargas (o Cap. Contenedor en Marítimo, sin tocar ese tab).

- [ ] **Step 4: Commit**

```bash
git add deploy/index.html
git commit -m "feat: bloque multi-proveedor en modo Compras"
```

---

### Task 7: Payload — enviar datos de Compras

**Files:**
- Modify: `deploy/index.html:713-737` (objeto `payload` en `handleGuardarCotizacion`)

- [ ] **Step 1: Actualizar el payload**

En `deploy/index.html`, reemplazar:

```javascript
              const payload = {
                credential: credToken,
                fecha: new Date().toLocaleString('es-MX'),
                usuario: usuario.email,
                modalidad: activeTab === 'terrestre' ? 'Terrestre' : activeTab === 'maritimo' ? 'Marítimo' : 'Nacional',
                cliente, 
                proveedor,
                cargas: Number(cargas), 
                material, 
                destino, 
                porcentajeFijacion: Number(porcentajeFijacion),
                fixPrice: Number(fixPrice),
                precioVenta, 
                tcHoy: Number(tcHoy), 
                tcSeguro: Number(tcSeguro.toFixed(2)), 
                fleteNac: Number(fleteNac), 
                cruceInt: Number(cruceInt),
                precioTopeCompra: Number(precioTopeCompra.toFixed(2)), 
                ppProv: Number(Number(ppProv).toFixed(2)), 
                status: status === 'good' ? 'Aprobado' : status === 'warning' ? 'Apretado' : 'Pérdida',
                utilidadNeta: Number(utilidadNeta.toFixed(2)),
                tipoCompra: compraDirecta ? 'Back to Back' : 'Compra Inventarios',
                notas,
                contrato: compraDirecta ? contrato : ''
              };
```

por:

```javascript
              const payload = {
                credential: credToken,
                fecha: new Date().toLocaleString('es-MX'),
                usuario: usuario.email,
                modalidad: activeTab === 'terrestre' ? 'Terrestre' : activeTab === 'maritimo' ? 'Marítimo' : 'Nacional',
                cliente: modoCompras ? '' : cliente,
                proveedor: modoCompras
                  ? comprasProveedores.map(r => `${r.proveedor}: ${r.cargas}`).join(', ')
                  : proveedor,
                cargas: modoCompras
                  ? comprasProveedores.reduce((sum, r) => sum + (Number(r.cargas) || 0), 0)
                  : Number(cargas),
                material, 
                destino, 
                porcentajeFijacion: Number(porcentajeFijacion),
                fixPrice: Number(fixPrice),
                precioVenta, 
                tcHoy: Number(tcHoy), 
                tcSeguro: Number(tcSeguro.toFixed(2)), 
                fleteNac: Number(fleteNac), 
                cruceInt: Number(cruceInt),
                precioTopeCompra: Number(precioTopeCompra.toFixed(2)), 
                ppProv: Number(Number(ppProv).toFixed(2)), 
                status: status === 'good' ? 'Aprobado' : status === 'warning' ? 'Apretado' : 'Pérdida',
                utilidadNeta: Number(utilidadNeta.toFixed(2)),
                tipoCompra: compraDirecta ? 'Back to Back' : modoCompras ? 'Compra Mercado' : 'Compra Inventarios',
                notas,
                contrato: compraDirecta ? contrato : '',
                paraInventarios: modoCompras ? paraInventarios : false,
                intencionVenta: modoCompras ? intencionVenta : false
              };
```

- [ ] **Step 2: Verificación end-to-end**

1. Con `Codigo.gs` redeployado (Task 1) y encabezados V/W agregados en la hoja `Nacional`.
2. Abrir la app → Tab Nacional → "Compras".
3. Marcar "Para Inventarios", dejar "Intención de Venta" sin marcar.
4. Agregar 2 proveedores con cargas distintas (ej. CALDERA: 2, LALO RECICLE: 1.5).
5. Completar el resto del formulario (% Fijación, Fix Price, etc.) y "¿A cuánto lo cerraste?".
6. Click **Guardar Trato**.
7. Esperado en la hoja `Nacional`: fila nueva con:
   - Col C (Cliente) vacía.
   - Col D (Proveedor) = `"CALDERA: 2, LALO RECICLE: 1.5"`.
   - Col E (Cargas) = `3.5`.
   - Col S (Tipo Compra) = `Compra Mercado`.
   - Col U (Contrato) vacía.
   - Col V (Para Inventarios) = `Sí`.
   - Col W (Intención Venta) = vacío.
8. Repetir guardando en modo "Back to Back" → col V y W vacías, sin afectar el resto del flujo existente.

- [ ] **Step 3: Commit**

```bash
git add deploy/index.html
git commit -m "feat: payload de modo Compras (multi-proveedor y flags)"
```

---

## Self-Review notes

- **Cobertura spec:** toggle 3 botones solo Nacional (Task 3) ✓ · checkboxes Para Inventarios/Intención Venta (Task 4) ✓ · cliente oculto (Task 5) ✓ · multi-proveedor + visualKg (Task 6) ✓ · payload con concatenado/suma/flags/tipoCompra (Task 7) ✓ · columnas V/W backend + headers manuales (Task 1) ✓ · reset al cambiar tab (Task 3 step 2) ✓.
- **Consistencia de nombres:** `modoCompras`, `paraInventarios`, `intencionVenta`, `comprasProveedores`, `updateComprasProveedor`/`addComprasProveedor`/`removeComprasProveedor`, `comprasTotalCargas` usados igual en todas las tareas.
- **Hooks:** el componente destructura `useState`/`useEffect` directamente (sin prefijo `React.`), igual que el resto del archivo — todos los snippets usan ese estilo.
- **Terrestre/Marítimo intactos:** Task 3 condiciona el tercer botón a `activeTab === 'nacional'`; Task 6 mantiene el grid original (incluido Cap. Contenedor de Marítimo) en la rama `else`.
