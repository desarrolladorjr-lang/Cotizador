// Rutas de flete nacional con precio cerrado. Conviven con el par origen/destino:
// la ruta es el atajo frecuente, origen/destino cubre el resto del tarifario.
const RUTAS_FLETE_NAC = [
  { name: "MID - MTY",       cost: 61480 },
  { name: "GDL - MTY",       cost: 35960 },
  { name: "MEX / TOL - MTY", cost: 38860 },
  { name: "PUE - MTY",       cost: 49300 },
  { name: "QRO - MTY",       cost: 35380 },
];

function SelectorMaterialCustom({ material, setMaterial, opcionesMaterial }) {
  const [abierto, setAbierto] = React.useState(false);
  const [filtroCategoria, setFiltroCategoria] = React.useState('TODOS');
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const categorias = typeof window !== 'undefined' && window.MATERIALES_POR_CATEGORIA
    ? window.MATERIALES_POR_CATEGORIA
    : { "General": opcionesMaterial || [] };

  let catActual = null;
  for (const [cat, items] of Object.entries(categorias)) {
    if (items.includes(material)) { catActual = cat; break; }
  }

  const coloresCat = {
    "Aluminio": { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500", pill: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
    "Cobre":    { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500", pill: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
    "Bronce":   { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500", pill: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
    "Otros":    { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500", pill: "bg-sky-500/20 text-sky-300 border-sky-500/40" }
  };

  const seleccionar = (m) => {
    setMaterial(m);
    setAbierto(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Material</label>
      
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs flex items-center justify-between outline-none focus:border-amber-500 hover:border-gray-500 transition-colors"
      >
        <span className="truncate">
          {material ? (
            <span className="text-white font-bold text-xs">{material}</span>
          ) : (
            <span className="text-gray-500">— Selecciona Material —</span>
          )}
        </span>
        <span className="text-gray-400 text-[10px] ml-1">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1 w-full bg-gray-950 border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-96 flex flex-col">
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-900/90 border-b border-gray-800 text-[10px]">
            <button
              type="button"
              onClick={() => setFiltroCategoria('TODOS')}
              className={`px-2 py-1 rounded font-bold uppercase transition-all ${
                filtroCategoria === 'TODOS' ? 'bg-amber-500 text-black shadow' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              Todos
            </button>
            {Object.entries(categorias).map(([cat, list]) => {
              const col = coloresCat[cat] || { text: 'text-gray-300', pill: 'bg-gray-800 text-gray-300' };
              const act = filtroCategoria === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCategoria(cat)}
                  className={`px-2 py-1 rounded font-bold uppercase border transition-all ${
                    act ? `${col.pill} border-current font-extrabold` : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  {cat} ({list.length})
                </button>
              );
            })}
          </div>

          <div className="overflow-y-auto p-2 space-y-3 flex-1">
            {Object.entries(categorias).map(([cat, list]) => {
              if (filtroCategoria !== 'TODOS' && filtroCategoria !== cat) return null;
              
              const listFiltrada = list;
              if (listFiltrada.length === 0) return null;

              const col = coloresCat[cat] || { text: 'text-gray-300', bg: 'bg-gray-800', border: 'border-gray-600' };

              return (
                <div key={cat} className="space-y-1">
                  <div className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded border-l-4 ${col.bg} ${col.text} ${col.border} flex items-center justify-between`}>
                    <span>{cat}</span>
                    <span className="text-[9px] opacity-75 font-mono">({listFiltrada.length})</span>
                  </div>

                  <div className="grid grid-cols-1 gap-0.5 pl-1">
                    {listFiltrada.map(m => {
                      const esSel = material === m;
                      return (
                        <div
                          key={m}
                          onClick={() => seleccionar(m)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                            esSel
                              ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }`}
                        >
                          <span>{m}</span>
                          {esSel && <span className="text-amber-400 font-bold text-xs">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Bloque de compra. Igual en las cuatro modalidades: el material se compra siempre
// del mismo modo; lo que cambia por modalidad es cómo se vende.
function BloqueCompra({
  proveedores, setProveedores, opcionesProveedor,
  material, setMaterial, opcionesMaterial,
  embalaje, setEmbalaje,
  negociacion, setNegociacion,
  ppProv, setPpProv,
  capKg,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none";

  // El destino de venta define los kg por carga. Sin destino no hay total honesto que
  // mostrar, así que se oculta en vez de suponer una capacidad.
  const cargasTotales = proveedores.reduce((s, r) => s + (Number(r.cargas) || 0), 0);
  const kg = capKg === null ? null : cargasTotales * capKg;
  const totalCompra = kg === null ? null : (Number(ppProv) || 0) * kg;

  const actualizar = (i, campo, valor) => {
    setProveedores(proveedores.map((r, j) => j === i ? { ...r, [campo]: valor } : r));
  };
  const agregar = () => setProveedores([...proveedores, { proveedor: opcionesProveedor[0] || '', cargas: '1' }]);
  const quitar = i => setProveedores(proveedores.filter((_, j) => j !== i));

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Compra</div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proveedores y Cargas</label>
          {kg !== null && (
            <span className="text-[10px] font-mono font-bold text-gray-300 bg-black px-2 py-0.5 rounded border border-gray-700">
              {kg.toLocaleString()} KG ({Math.round(kg * 2.20462).toLocaleString()} LB)
            </span>
          )}
        </div>
        {proveedores.map((row, i) => {
          const provNorm = row.proveedor ? row.proveedor.trim().toUpperCase() : '';
          const origProv = typeof window !== 'undefined' && window.PROVEEDORES_ORIGENES_MAP ? window.PROVEEDORES_ORIGENES_MAP[provNorm] : null;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <select value={row.proveedor} onChange={e => actualizar(i, 'proveedor', e.target.value)} className={"flex-1 " + selCls}>
                  <option value="">— Proveedor —</option>
                  {opcionesProveedor.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" step="0.5" value={row.cargas} onChange={e => actualizar(i, 'cargas', e.target.value)}
                       className="w-20 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white" />
                {proveedores.length > 1 && (
                  <button onClick={() => quitar(i)} className="text-red-400 hover:text-red-300 font-black text-sm px-2">✕</button>
                )}
              </div>
              {origProv && (
                <div className="text-[10px] text-gray-400 font-medium pl-1 flex items-center gap-1">
                  <span>📍 Origen Proveedor:</span>
                  <span className="text-emerald-400 font-bold">{origProv}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SelectorMaterialCustom
        material={material}
        setMaterial={setMaterial}
        opcionesMaterial={opcionesMaterial}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Embalaje</label>
          <select value={embalaje} onChange={e => setEmbalaje(e.target.value)} className={selCls}>
            <option value="">— Embalaje —</option>
            {["PACAS", "JUMBOS", "GAYLORD"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Negociación</label>
          <select value={negociacion} onChange={e => setNegociacion(e.target.value)} className={selCls}>
            <option value="">— Negociación —</option>
            {["RECOLECCION DIRECTA", "RECOLECCION BMTY", "DIRECTO ENTREGA", "BMTY ENTREGA", "BMTY DIRECTA"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function BloqueFleteNacional({
  fleteNac, setFleteNac,
  infoFleteResuelto = null
}) {
  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-gray-800">
      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">COSTO FLETE NAC. (MXN)</label>
      
      {infoFleteResuelto && (
        infoFleteResuelto.existe ? (
          <div className="text-[10px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/50 p-2 rounded-lg truncate">
            ✓ {infoFleteResuelto.desc || 'Tarifa encontrada en tarifario'}
          </div>
        ) : (
          <div className="text-[10px] font-bold text-amber-400 bg-amber-950/50 border border-amber-600/60 p-2 rounded-lg">
            {infoFleteResuelto.desc || '⚠️ Ruta no registrada en el tarifario — Ingresa el flete manualmente'}
          </div>
        )
      )}

      <div className="relative">
        <span className="absolute left-2.5 top-2 text-gray-400 font-bold text-xs">$</span>
        <input type="number" value={fleteNac}
               onChange={e => setFleteNac(e.target.value)}
               className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
      </div>
    </div>
  );
}
