// Celda de concepto del desglose: etiqueta arriba, importe abajo.
const Celda = ({ label, valor, accent, destacado }) => (
  <div className={"rounded-lg px-2 py-1.5 border " + (destacado ? 'bg-gray-900' : 'bg-black border-gray-800')}
       style={destacado ? { borderColor: accent } : undefined}>
    <div className="text-[8px] font-black uppercase tracking-wider leading-tight" style={{ color: destacado ? accent : '#9ca3af' }}>{label}</div>
    <div className="font-mono font-black whitespace-nowrap text-[11px]" style={{ color: destacado ? accent : '#e5e7eb' }}>{valor}</div>
  </div>
);

// La fecha viene en ISO ('YYYY-MM-DD'); se parte a mano porque new Date('YYYY-MM-DD')
// la interpreta en UTC y en México se veria un dia antes.
const fechaTarifario = () => {
  const iso = typeof TARIFARIO_ACTUALIZADO === 'string' ? TARIFARIO_ACTUALIZADO : '';
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return '—';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)}/${MESES[Number(m) - 1]}/${a}`;
};

// Desglose de solo lectura del tarifario marítimo. Replica las columnas del xlsx.
function DesgloseMaritimo({ row, tc, accent }) {
  if (!row) return null;

  const d = calcDespacho(row.pol);
  const numTc = Number(tc) || 0;

  // El tarifario captura el despacho en MXN; aquí se muestra en USD al T.C. banco.
  const usd = n => numTc > 0 ? 'USD ' + Math.round(n / numTc).toLocaleString('es-MX') : '—';

  return (
    <div className="bg-black rounded-xl border border-gray-700 p-3 mt-2">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Desglose — {row.pol}</span>
        <span className="text-[9px] font-bold text-gray-600 font-mono">T.C. {numTc > 0 ? numTc.toFixed(2) : '—'}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <Celda label="Ocean Freight" valor={'USD ' + row.of.toLocaleString('es-MX')} accent={accent} destacado />
        <Celda label="Pedimento"     valor={usd(d.ped)}  accent={accent} />
        <Celda label="Maniobras"     valor={usd(d.man)}  accent={accent} />
        <Celda label="Honorarios"    valor={usd(d.hon)}  accent={accent} />
        <Celda label="Validación"    valor={usd(d.val)}  accent={accent} />
        <Celda label="Servicio COVE" valor={usd(d.cove)} accent={accent} />
      </div>

      <div className="h-px bg-gray-700 my-2"></div>

      <div className="grid grid-cols-2 gap-1.5">
        <Celda label="Total AA"  valor={usd(d.totalAA)} accent={accent} />
        <Celda label="Arrastre"  valor={usd(d.arr)}     accent={accent} />
        <Celda label="Arrastre + Despacho" valor={usd(d.total)} accent={accent} />
        <Celda label="Ocean + Arrastre + Despacho" valor={usd((row.of * numTc) + d.total)} accent={accent} destacado />
      </div>

      <div className="text-[8px] text-gray-600 font-bold leading-tight pt-1.5">Despacho convertido de MXN a T.C. banco</div>
      <div className="text-[8px] text-gray-600 font-bold leading-tight pt-0.5">Tarifario actualizado: {fechaTarifario()}</div>
    </div>
  );
}

function VentaMaritimo({
  cliente, setCliente, opcionesCliente,
  destino, setDestino, opcionesDestino,
  origenEmbarque, setOrigenEmbarque, opcionesOrigenEmbarque,
  porcentajeFijacion, setPorcentajeFijacion,
  fixPrice, setFixPrice,
  diasCobro, setDiasCobro,
  merma, setMerma,
  precioVenta,
  tcHoy, setTcHoy, tcSeguro, cargandoTC, onActualizarTC,
  capacidadCNT, setCapacidadCNT,
  tarifario, setTarifario,
  maritimoRow, setMaritimoRow,
  cruceInt, setCruceInt,
  sinTarifario,
  rutaNacSelect, setRutaNacSelect,
  fleteNac, setFleteNac,
}) {
  const selCls = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none";
  const selMini = "w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none truncate focus:border-white appearance-none";

  const t = tarifario;
  const destinos = [...new Set(TARIFARIO_DATA.map(r => r.pod))].sort();
  // POD -> país, para mostrar el país junto al destino en el selector
  const paisPorDestino = {};
  TARIFARIO_DATA.forEach(r => { if (r.pod && r.pais && !paisPorDestino[r.pod]) paisPorDestino[r.pod] = r.pais; });
  const origenes = t.destino
    ? [...new Set(TARIFARIO_DATA.filter(r => r.pod === t.destino).map(r => r.o))].sort()
    : [];
  const puertos = (t.destino && t.origen)
    ? [...new Set(TARIFARIO_DATA.filter(r => r.pod === t.destino && r.o === t.origen).map(r => r.pol))].sort()
    : [];
  const proveedores = (t.destino && t.origen && t.pol)
    ? [...new Set([...TARIFARIO_DATA.filter(r => r.pod === t.destino && r.o === t.origen && r.pol === t.pol).map(r => r.p), ...TARIFARIO_PROVEEDORES_EXTRA])].sort()
    : (t.destino && t.origen)
    ? [...new Set([...TARIFARIO_DATA.filter(r => r.pod === t.destino && r.o === t.origen).map(r => r.p), ...TARIFARIO_PROVEEDORES_EXTRA])].sort()
    : TARIFARIO_PROVEEDORES_EXTRA;
  const equipos = (t.destino && t.origen && t.proveedor)
    ? [...new Set(TARIFARIO_DATA.filter(r => r.pod === t.destino && r.o === t.origen && (t.pol ? r.pol === t.pol : true) && r.p === t.proveedor).map(r => r.eq))].sort()
    : [];
  const filas = (t.destino && t.origen && t.proveedor && t.equipo)
    ? TARIFARIO_DATA.filter(r => r.pod === t.destino && r.o === t.origen && (t.pol ? r.pol === t.pol : true) && r.p === t.proveedor && r.eq === t.equipo)
    : [];
  const tipos = [...new Set(filas.filter(r => r.tipo !== null).map(r => r.tipo))].sort();

  return (
    <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-xl p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta — Marítimo</div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
        <select value={cliente} onChange={e => setCliente(e.target.value)} className={selCls + " truncate"}>
          <option value="">— Cliente —</option>
          {opcionesCliente.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Ocean Freight</label>

        {/* 1. Destino (POD) */}
        <select value={t.destino}
                onChange={e => setTarifario({ destino: e.target.value, origen: '', pol: '', proveedor: '', equipo: '', tipo: '' })}
                className={selMini}>
          <option value="">— Destino (POD) —</option>
          {destinos.map(d => (
            <option key={d} value={d}>
              {paisPorDestino[d] ? `${d} — ${paisPorDestino[d]}` : d}
            </option>
          ))}
        </select>

        {/* 2. Origen */}
        {t.destino && (
          <select value={t.origen}
                  onChange={e => setTarifario({ ...t, origen: e.target.value, pol: '', proveedor: '', equipo: '', tipo: '' })}
                  className={selMini}>
            <option value="">— Origen —</option>
            {origenes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}

        {/* 3. Puerto (POL) - Columna D */}
        {t.origen && puertos.length > 0 && (
          <select value={t.pol}
                  onChange={e => setTarifario({ ...t, pol: e.target.value, proveedor: '', equipo: '', tipo: '' })}
                  className={selMini}>
            <option value="">— Puerto de Salida (POL) —</option>
            {puertos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {/* 4. Proveedor */}
        {t.origen && (
          <select value={t.proveedor}
                  onChange={e => setTarifario({ ...t, proveedor: e.target.value, equipo: '', tipo: '' })}
                  className={selMini}>
            <option value="">— Proveedor —</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {sinTarifario && (
          <p className="text-[9px] text-gray-500 leading-tight">Sin tarifario. Captura el ocean freight manual (USD) abajo; el despacho va en Aduana MX.</p>
        )}

        {/* 5. Equipo */}
        {!sinTarifario && t.proveedor && (
          <select value={t.equipo}
                  onChange={e => setTarifario({ ...t, equipo: e.target.value, tipo: '' })}
                  className={selMini}>
            <option value="">— Equipo —</option>
            {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        )}

        {/* 6. Tipo */}
        {tipos.length > 0 && t.equipo && (
          <select value={t.tipo} onChange={e => setTarifario({ ...t, tipo: e.target.value })} className={selMini}>
            <option value="">— Tipo —</option>
            {tipos.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        )}

        <div className="relative">
          <span className="absolute left-2 top-2 font-bold text-xs" style={{ color: '#ff6600' }}>$</span>
          <input type="number" value={cruceInt}
                 onChange={e => {
                   setCruceInt(e.target.value);
                   // Editar el cruce a mano invalida la selección del tarifario.
                   if (TARIFARIO_DATA.some(r => r.p === t.proveedor)) {
                     setTarifario({ proveedor: '', origen: '', destino: '', equipo: '', tipo: '' });
                     setMaritimoRow(null);
                   }
                 }}
                 className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
        </div>

        <DesgloseMaritimo row={maritimoRow} tc={tcHoy} accent="#ff6600" />
      </div>

      <div>
        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
          Cap. Contenedor — <span className="font-black text-white">{capacidadCNT} TON</span>
        </label>
        <input type="range" min="5" max="30" step="1" value={capacidadCNT}
               onChange={e => setCapacidadCNT(Number(e.target.value))}
               className="w-full cursor-pointer" style={{ accentColor: '#ff6600' }} />
        <div className="flex justify-between text-[9px] text-gray-600 font-bold mt-0.5"><span>5T</span><span>30T</span></div>
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
