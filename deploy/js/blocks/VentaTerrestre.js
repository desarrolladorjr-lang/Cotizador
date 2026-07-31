// Rutas de cruce internacional por carretera. Las de MXN se convierten a USD al T.C.
const RUTAS_FLETE_INT = [
  { name: "MTY - LDO TEX",      cost: 17500, currency: 'MXN' },
  { name: "JAL - LDO",          cost: 2450,  currency: 'USD' },
  { name: "QRO - LDO",          cost: 35000, currency: 'MXN' },
  { name: "MTY - MICHIGAN",     cost: 4850,  currency: 'USD' },
  { name: "AGS - LDO",          cost: 1900,  currency: 'USD' },
  { name: "MTY - RUSSVILLE KY", cost: 3750,  currency: 'USD' },
  { name: "MTY - ALABAMA",      cost: 3800,  currency: 'USD' },
  { name: "MTY - TEXARKANA TX", cost: 3000,  currency: 'USD' },
];

function VentaTerrestre({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino,
  porcentajeFijacion, setPorcentajeFijacion,
  fixPrice, setFixPrice,
  diasCobro, setDiasCobro,
  merma, setMerma,
  precioVenta,
  tcHoy, setTcHoy, tcSeguro, cargandoTC, onActualizarTC,
  rutaIntSelect, setRutaIntSelect,
  cruceInt, setCruceInt,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";

  const elegirRuta = val => {
    setRutaIntSelect(val);
    if (val === 'N/A' || val === '') { setCruceInt("0"); return; }
    const r = RUTAS_FLETE_INT.find(x => x.name === val);
    if (!r) return;
    if (r.currency === 'USD') setCruceInt(r.cost.toString());
    else {
      const tc = Number(tcHoy) || 0;
      if (tc > 0) setCruceInt((r.cost / tc).toFixed(2));
    }
  };

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Terrestre</div>

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

      <div className="space-y-2">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Int.</label>
          <select value={rutaIntSelect} onChange={e => elegirRuta(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none">
            <option value="">Ruta / Manual...</option>
            <option value="N/A">N/A (Sin Flete)</option>
            {RUTAS_FLETE_INT.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <span className="absolute left-2 top-2 font-bold text-xs" style={{ color: '#ff6600' }}>$</span>
          <input type="number" value={cruceInt}
                 onChange={e => { setCruceInt(e.target.value); setRutaIntSelect(''); }}
                 className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between items-end mb-1">
            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">T.C. Banco</label>
            <button onClick={onActualizarTC} className="text-[9px] font-bold hover:text-white transition-colors" style={{ color: '#ff6600' }}>
              {cargandoTC ? '⏳...' : '🔄 Act.'}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-2 top-2 text-gray-400 font-bold">$</span>
            <input type="number" step="0.01" value={tcHoy} onChange={e => setTcHoy(e.target.value)}
                   className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ff6600' }}>T.C. Seguro</label>
          <div className="relative">
            <span className="absolute left-2 top-2 font-bold" style={{ color: '#ff6600' }}>$</span>
            <input type="text" readOnly value={tcSeguro > 0 ? tcSeguro.toFixed(2) : "0.00"} title="Cálculo con colchón de riesgo aplicado"
                   className="w-full bg-black border rounded-lg p-2 pl-6 font-mono font-bold text-sm outline-none cursor-not-allowed shadow-inner"
                   style={{ color: '#ff6600', borderColor: '#ff6600' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-black p-3 rounded-xl border border-gray-700">
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">% Fijación</label>
          <div className="relative">
            <input type="number" value={porcentajeFijacion} onChange={e => setPorcentajeFijacion(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white" />
            <span className="absolute right-1 top-1.5 text-gray-400 font-bold">%</span>
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fix Price</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 font-bold" style={{ color: '#ff6600' }}>$</span>
            <input type="number" value={fixPrice} onChange={e => setFixPrice(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-white font-bold text-sm outline-none focus:border-white" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Venta (x KG)</label>
          <div className="relative">
            <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
            <input type="text" readOnly value={precioVenta.toFixed(5)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none cursor-not-allowed" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Días Crédito</label>
          <input type="number" value={diasCobro} onChange={e => setDiasCobro(e.target.value)}
                 className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none text-center focus:border-white" />
        </div>
        <div className="col-span-2">
          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 text-center" title="Porcentaje estimado de basura/tierra">Merma</label>
          <div className="relative">
            <input type="number" step="0.1" value={merma} onChange={e => setMerma(e.target.value)}
                   className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white text-center" />
            <span className="absolute right-3 top-2 text-gray-400 font-bold">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
