// Rutas de flete nacional con precio cerrado. Conviven con el par origen/destino:
// la ruta es el atajo frecuente, origen/destino cubre el resto del tarifario.
const RUTAS_FLETE_NAC = [
  { name: "MID - MTY",       cost: 61480 },
  { name: "GDL - MTY",       cost: 35960 },
  { name: "MEX / TOL - MTY", cost: 38860 },
  { name: "PUE - MTY",       cost: 49300 },
  { name: "QRO - MTY",       cost: 35380 },
];

// Bloque de compra. Igual en las cuatro modalidades: el material se compra siempre
// del mismo modo; lo que cambia por modalidad es cómo se vende.
function BloqueCompra({
  proveedores, setProveedores, opcionesProveedor,
  material, setMaterial, opcionesMaterial,
  embalaje, setEmbalaje,
  negociacion, setNegociacion,
  origenFlete, setOrigenFlete,
  destinoFlete, setDestinoFlete,
  rutaNacSelect, setRutaNacSelect,
  fleteNac, setFleteNac,
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

  const origenes = [...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.o))].sort();
  const destinos = [...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.d))].sort();

  // Origen/destino y ruta fija son dos caminos al mismo dato: elegir uno limpia el otro.
  const buscarFlete = (o, d) => {
    setRutaNacSelect('');
    const match = FLETES_NACIONALES_COMPRAS.find(r => r.o === o && r.d === d);
    setFleteNac(match ? match.precio.toString() : "0");
  };

  const elegirRutaNac = val => {
    setRutaNacSelect(val);
    setOrigenFlete('');
    setDestinoFlete('');
    if (val === 'N/A' || val === '') { setFleteNac("0"); return; }
    const r = RUTAS_FLETE_NAC.find(x => x.name === val);
    if (r) setFleteNac(r.cost.toString());
  };

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Compra</div>

      <div className="space-y-2">
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proveedores y Cargas</label>
        {proveedores.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={row.proveedor} onChange={e => actualizar(i, 'proveedor', e.target.value)} className={"flex-1 " + selCls}>
              {opcionesProveedor.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="number" step="0.5" value={row.cargas} onChange={e => actualizar(i, 'cargas', e.target.value)}
                   className="w-20 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white" />
            {proveedores.length > 1 && (
              <button onClick={() => quitar(i)} className="text-red-400 hover:text-red-300 font-black text-sm px-2">✕</button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button onClick={agregar} className="text-[9px] font-black uppercase tracking-wide" style={{ color: '#ff6600' }}>+ Proveedor</button>
          {kg === null ? (
            <div className="text-[9px] text-gray-600 font-bold text-right leading-tight">
              {cargasTotales} carga{cargasTotales === 1 ? '' : 's'}<br />
              <span className="text-gray-700">Elige el destino para ver los KG</span>
            </div>
          ) : (
            <div className="bg-gray-800 px-3 py-1.5 rounded border border-gray-700 text-center whitespace-nowrap">
              <div className="text-white text-[11px] font-black leading-tight">{kg.toLocaleString()} KG</div>
              <div className="text-gray-500 text-[9px] font-bold leading-tight">{Math.round(kg * 2.20462).toLocaleString()} LB</div>
            </div>
          )}
        </div>
      </div>

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
            {["RECOLECCION DIRECTA", "RECOLECCION BMTY", "DIRECTO ENTREGA", "BMTY ENTREGA", "LAREDO ENTREGA"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Material</label>
        <select value={material} onChange={e => setMaterial(e.target.value)} className={selCls + " truncate"}>
          {opcionesMaterial.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen</label>
          <select value={origenFlete}
                  onChange={e => { setOrigenFlete(e.target.value); buscarFlete(e.target.value, destinoFlete); }}
                  className={selCls + " truncate"}>
            <option value="">— Origen —</option>
            {origenes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destinoFlete}
                  onChange={e => { setDestinoFlete(e.target.value); buscarFlete(origenFlete, e.target.value); }}
                  className={selCls + " truncate"}>
            <option value="">— Destino —</option>
            {destinos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Flete Nac.</label>
        <select value={rutaNacSelect} onChange={e => elegirRutaNac(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none">
          <option value="">Ruta / Manual...</option>
          <option value="N/A">N/A (Sin Flete)</option>
          {RUTAS_FLETE_NAC.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <div className="relative">
          <span className="absolute left-2 top-2 text-gray-400 font-bold text-xs">$</span>
          <input type="number" value={fleteNac}
                 onChange={e => { setFleteNac(e.target.value); setOrigenFlete(''); setDestinoFlete(''); setRutaNacSelect(''); }}
                 className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
        </div>
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio de Compra (MXN x KG)</label>
        <div className="relative">
          <span className="absolute left-2 top-2.5 text-green-500 font-bold text-xs">$</span>
          <input type="number" step="0.01" value={ppProv} onChange={e => setPpProv(e.target.value)} placeholder="0.00"
                 className="w-full bg-black border border-gray-700 rounded-lg p-2.5 pl-6 text-green-400 font-mono font-bold text-sm outline-none focus:border-white" />
        </div>
        {totalCompra !== null && (
          <div className="text-[9px] text-gray-500 font-bold mt-1 text-right">
            Total: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalCompra)}
          </div>
        )}
      </div>
    </div>
  );
}
