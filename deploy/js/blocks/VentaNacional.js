// Venta nacional: precio en pesos (MXN x KG), sin tipo de cambio ni logística internacional.
function VentaNacional({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino, destinoBloqueado,
  precioKgNacional, setPrecioKgNacional,
  setPrecioTonMxn, setPrecioMxnNacional,
  cargasTotales,
  merma, setMerma,
  rutaNacSelect, setRutaNacSelect,
  fleteNac, setFleteNac,
  infoFleteResuelto
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";

  const cargas = Number(cargasTotales) || 1;
  const kgTotales = cargas * 24500;

  const handleKgChange = (val) => {
    setPrecioKgNacional(val);
    if (val === "" || isNaN(val)) {
      setPrecioTonMxn("");
      setPrecioMxnNacional("");
    } else {
      const numKg = Number(val);
      setPrecioTonMxn((numKg * 1000).toString());
      setPrecioMxnNacional((numKg * kgTotales).toString());
    }
  };

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Nacional</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)} className={selCls + " truncate"}>
            <option value="">— Cliente —</option>
            {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} className={selCls + " truncate"}>
            <option value="">— Destino —</option>
            {opcionesDestino.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 bg-black p-3 rounded-xl border border-gray-700 items-end">
        <div className="col-span-2">
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Venta (MXN x KG)</label>
          <div className="relative flex items-center">
            <span className="absolute left-2 text-green-500 font-bold text-sm">$</span>
            <input type="number" step="0.01" value={precioKgNacional}
                   onChange={e => handleKgChange(e.target.value)}
                   placeholder="0.00"
                   className="w-full bg-transparent border-b border-gray-700 py-2 pl-6 text-green-400 font-mono font-bold text-base outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 text-center" title="Porcentaje estimado de merma">Merma</label>
          <div className="relative flex items-center">
            <input type="number" step="0.1" value={merma} onChange={e => setMerma(e.target.value)}
                   placeholder="0.0"
                   className="w-full bg-transparent border-b border-gray-700 py-2 pr-6 text-white font-mono font-bold text-base outline-none focus:border-white text-center" />
            <span className="absolute right-2 text-gray-400 font-bold text-xs">%</span>
          </div>
        </div>
      </div>

      <BloqueFleteNacional
        rutaNacSelect={rutaNacSelect} setRutaNacSelect={setRutaNacSelect}
        fleteNac={fleteNac} setFleteNac={setFleteNac}
        infoFleteResuelto={infoFleteResuelto}
      />
    </div>
  );
}
