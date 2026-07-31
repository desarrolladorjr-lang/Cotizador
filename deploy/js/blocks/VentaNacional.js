// Venta nacional: precio en pesos, sin tipo de cambio ni logística internacional.
// El precio por tonelada es una ayuda de captura: llena el total a 24.5 ton por carga.
function VentaNacional({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino,
  precioTonMxn, setPrecioTonMxn,
  precioTotalMxn, setPrecioTotalMxn,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Nacional</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)} className={selCls + " truncate"}>
            {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value)} className={selCls + " truncate"}>
            {opcionesDestino.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-black p-3 rounded-xl border border-gray-700 space-y-2">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio x Ton (MXN) — opcional</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-gray-500 font-bold">$</span>
            <input type="number" step="0.01" value={precioTonMxn}
                   onChange={e => {
                     const val = e.target.value;
                     setPrecioTonMxn(val);
                     setPrecioTotalMxn(val === '' ? '' : (Number(val) * 24.5).toFixed(2));
                   }}
                   placeholder="0.00"
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-gray-300 font-mono font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio Total MXN</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
            <input type="number" step="0.01" value={precioTotalMxn}
                   onChange={e => { setPrecioTotalMxn(e.target.value); setPrecioTonMxn(''); }}
                   placeholder="0.00"
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none focus:border-white" />
          </div>
          <div className="text-[9px] text-gray-500 font-bold mt-1">Total del embarque completo, no por carga.</div>
        </div>
      </div>
    </div>
  );
}
