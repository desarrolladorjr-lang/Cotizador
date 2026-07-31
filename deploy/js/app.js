const { useState, useEffect } = React;

function App() {
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('usuarioCotizador');
    return saved ? JSON.parse(saved) : null;
  });
  const [errorLogin, setErrorLogin] = useState('');

  const [credToken, setCredToken] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargandoTC, setCargandoTC] = useState(false);

  // Estados de los campos
  const [cliente, setCliente] = useState('OMC');

  const [porcentajeFijacion, setPorcentajeFijacion] = useState("100");
  const [fixPrice, setFixPrice] = useState("2550.00");
  const [tcHoy, setTcHoy] = useState("");

  const [diasCobro, setDiasCobro] = useState("15");

  // Fletes inician en 0 para mantener todo limpio
  const [fleteNac, setFleteNac] = useState("0");
  const [aduanaMex, setAduanaMex] = useState("2308");
  const [cruceInt, setCruceInt] = useState("0");
  const [aduanaUsa, setAduanaUsa] = useState("65");

  const [merma, setMerma] = useState("1");
  const [maniobras, setManiobras] = useState("0.60");
  const [ppProv, setPpProv] = useState("40.00");

  const [material, setMaterial] = useState('UBC');
  const [destino, setDestino] = useState('Laredo, TX');
  const [origenEmbarque, setOrigenEmbarque] = useState('');
  const [rutaNacSelect, setRutaNacSelect] = useState('');
  const [rutaIntSelect, setRutaIntSelect] = useState('');

  const [notas, setNotas] = useState('');
  const [embalaje, setEmbalaje] = useState('');
  const [negociacion, setNegociacion] = useState('');

  // Compras — selectors de ruta flete nacional (Hoja 10)
  const [comprasOrigenFlete, setComprasOrigenFlete] = useState('');
  const [comprasDestinoFlete, setComprasDestinoFlete] = useState('GRAL. ESCOBÉDO, NL');

  const [precioTonNacional, setPrecioTonNacional] = useState("");
  const [precioMxnNacional, setPrecioMxnNacional] = useState("");

  // Maritime container capacity (tons → kg in formula)
  const [capacidadCNT, setCapacidadCNT] = useState(20);

  const [maritimoRow, setMaritimoRow] = useState(null); // fila del tarifario resuelta, para el desglose

  // Arbol de captura de dos niveles. `modalidad` es la hoja y vale '' mientras la
  // eleccion este incompleta (nada elegido, o Exportacion sin submodo).
  const [destinoVenta, setDestinoVenta] = useState('');
  const [modoExport, setModoExport] = useState('');
  const modalidad  = destinoVenta === 'exportacion' ? modoExport : destinoVenta;
  const tieneVenta = modalidad !== '' && modalidad !== 'inventario';

  const [proveedores, setProveedores] = useState([{ proveedor: '', cargas: '1' }]);
  const [tarifario, setTarifario] = useState({ proveedor: '', origen: '', destino: '', equipo: '', tipo: '' });

  // CONFIGURACIÓN GOOGLE SIGN-IN — load script only when no session
  useEffect(() => {
    if (usuario) {
      if (window.google && window.google.accounts) {
        try {
          window.google.accounts.id.cancel();
          window.google.accounts.id.disableAutoSelect();
        } catch (e) {}
      }
      document.querySelectorAll(
        'iframe[src*="accounts.google.com/gsi"], iframe[src*="smartlock"], [id*="credential_picker"], #g_a11y_announcement, div[aria-labelledby*="credential"]'
      ).forEach(el => el.remove());
      return;
    }

    let cancelled = false;
    const GSI_SRC = "https://accounts.google.com/gsi/client";

    const initGoogle = () => {
      if (cancelled || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: "65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      const btn = document.getElementById("buttonDiv");
      if (btn) {
        window.google.accounts.id.renderButton(btn, { theme: "outline", size: "large", width: 320 });
      }
    };

    if (window.google && window.google.accounts) {
      initGoogle();
    } else {
      let script = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', initGoogle);
    }

    return () => { cancelled = true; };
  }, [usuario]);

  const handleCredentialResponse = (response) => {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);

    if (payload.email.endsWith('@sidellscrap.com')) {
      setCredToken(response.credential);
      setUsuario(payload);
      localStorage.setItem('usuarioCotizador', JSON.stringify(payload));
      setErrorLogin('');
      if (window.google) window.google.accounts.id.cancel();

      // Limpieza forzada de cualquier iframe residual de Google
      const googleIframe = document.querySelector('iframe[src*="smartlock"]');
      if (googleIframe) googleIframe.remove();
      const credentialPicker = document.getElementById('credential_picker_container');
      if (credentialPicker) credentialPicker.remove();
    } else {
      setErrorLogin('Acceso denegado. Utiliza un correo de @sidellscrap.com');
    }
  };

  // La fila del tarifario define el ocean freight y si el despacho ya viene incluido.
  useEffect(() => {
    if (modalidad !== 'maritimo' || !tarifario.equipo) {
      setMaritimoRow(null);
      return;
    }
    const row = TARIFARIO_DATA.find(r =>
      r.p === tarifario.proveedor && r.o === tarifario.origen &&
      r.pod === tarifario.destino && r.eq === tarifario.equipo &&
      (tarifario.tipo === '' || r.tipo === tarifario.tipo));
    setMaritimoRow(row || null);
    if (row) {
      const d = calcDespacho(row.pol);
      const tc = Number(tcHoy) || 0;
      // El cruce marítimo suma ocean freight + arrastre + despacho, en USD.
      setCruceInt(tc > 0 ? (row.of + (d.total / tc)).toFixed(2) : row.of.toString());
      // El despacho ya va dentro del cruce, así que aduanaMex no lo vuelve a cobrar.
      setAduanaMex("0");
    }
  }, [modalidad, tarifario, tcHoy]);

  // Un proveedor marítimo "sin tarifario" aparece en el dropdown pero no tiene rutas.
  const sinTarifario = !!tarifario.proveedor
    && !TARIFARIO_DATA.some(r => r.p === tarifario.proveedor);

  // Fuera de marítimo con tarifario, el despacho se cobra aparte.
  useEffect(() => {
    if (modalidad !== 'maritimo' || sinTarifario || !tarifario.proveedor) setAduanaMex("2308");
  }, [modalidad, sinTarifario, tarifario.proveedor]);

  const obtenerTipoDeCambio = async () => {
    setCargandoTC(true);
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      if (data && data.rates && data.rates.MXN) {
        setTcHoy(data.rates.MXN.toFixed(2));
      }
    } catch (error) {
      console.error("Error TC:", error);
      if (!tcHoy) setTcHoy("17.50");
    } finally {
      setCargandoTC(false);
    }
  };

  useEffect(() => {
    if (usuario) {
      obtenerTipoDeCambio();
      // Cancelar el One Tap explícitamente si ya hay sesión
      if (window.google) {
        window.google.accounts.id.cancel();
      }
    }
  }, [usuario]);

  const cargasTotales = proveedores.reduce((s, r) => s + (Number(r.cargas) || 0), 0);

  const CALCULO_VACIO = {
    tcSeguro: 0, capKg: null, precioVenta: 0,
    precioTopeCompra: 0, utilidadNeta: 0, utilidadPorKg: 0, status: '',
  };

  // Sin destino elegido no hay capacidad por carga, asi que no hay nada que calcular.
  const calculo = modalidad === '' ? CALCULO_VACIO : calcularCotizacion({
    modalidad, porcentajeFijacion, fixPrice, tcHoy, diasCobro,
    fleteNac, cruceInt, aduanaMex, aduanaUsa, merma, maniobras, ppProv,
    capacidadCNT, precioTotalMxn: precioMxnNacional, cargasTotales,
  });

  const { tcSeguro, capKg, precioVenta, precioTopeCompra, utilidadNeta, status } = calculo;

  // La compra se captura antes de conocer el destino, asi que los catalogos no se
  // filtran por modalidad: el material se compra en Mexico vaya a donde vaya.
  const opcionesMaterialActual = [...new Set([
    ...optionsMaterialTerrestre, ...optionsMaterialMaritimo, ...optionsMaterialNacional,
  ])].sort();

  const opcionesProveedorActual = [...new Set([
    ...optionsProveedorTerrestre, ...optionsProveedorMaritimo, ...optionsProveedorNacional,
  ])].sort();

  const handleGuardarCotizacion = async () => {
    setGuardando(true);
    try {
      const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOX2dJUvvpRcDkHYstwnezDyyfeIpUtfdnpuwRtZxICOu2AorLT80PvO6LP7wudRGh_A/exec";

      const payload = construirPayload({
        credential: credToken,
        fecha: new Date().toLocaleDateString('es-MX'),
        usuario: usuario.email,
        modalidad, cliente, proveedores,
        material, destino, origenEmbarque,
        porcentajeFijacion, fixPrice, tcHoy,
        fleteNac, cruceInt, ppProv, notas,
        embalaje, negociacion,
        origenFlete: comprasOrigenFlete,
        destinoFlete: comprasDestinoFlete,
        calculo,
      });

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setMensajeExito('✅ ¡Trato guardado exitosamente!');
      setTimeout(() => setMensajeExito(''), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setGuardando(false);
    }
  };

  const fMxn = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  if (!usuario) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans text-gray-100">
        <div className="w-full max-w-sm bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden relative pb-8 p-6 text-center">
          <img src="LOGO_PNG.png" alt="Logo Sidell" className="h-16 mx-auto mb-2 drop-shadow-md object-contain" />
          <h1 className="text-xl font-black text-white tracking-widest uppercase drop-shadow-sm mb-6" style={{ color: '#ff6600' }}>
            Acceso Cotizador
          </h1>
          <p className="text-sm text-gray-400 mb-6 font-bold">
            Inicia sesión con tu correo corporativo para continuar.
          </p>

          <div id="buttonDiv" className="flex justify-center mb-4"></div>

          {errorLogin && (
            <div className="bg-red-900 text-red-400 border border-red-700 text-xs font-bold p-3 rounded-lg mt-4">
              {errorLogin}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans text-gray-100">
      <div className="w-full max-w-sm bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden relative pb-8">

        <div className="px-6 py-5 flex items-center justify-between shadow-md relative z-10" style={{ backgroundColor: '#ff6600' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl drop-shadow-md">📊</span>
            <h1 className="text-xl font-black text-white tracking-widest uppercase drop-shadow-sm">
              Cotizador Sidell
            </h1>
          </div>
          <span className="font-black bg-white px-2 py-1 rounded-md text-xs shadow-sm" style={{ color: '#ff6600' }}>PRO</span>
        </div>

        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <img src={usuario.picture} alt="Perfil" className="w-6 h-6 rounded-full border border-gray-600 flex-shrink-0" />
            <span className="font-bold text-gray-300 truncate">{usuario.email}</span>
          </div>
          <button onClick={() => {
            setUsuario(null);
            localStorage.removeItem('usuarioCotizador');
            if (window.google) window.google.accounts.id.disableAutoSelect();
          }} className="text-red-400 font-bold hover:text-red-300 transition-colors">Salir</button>
        </div>

        <div className="p-6 space-y-5 relative z-10">

          <BloqueCompra
            proveedores={proveedores} setProveedores={setProveedores}
            opcionesProveedor={opcionesProveedorActual}
            material={material} setMaterial={setMaterial}
            opcionesMaterial={opcionesMaterialActual}
            embalaje={embalaje} setEmbalaje={setEmbalaje}
            negociacion={negociacion} setNegociacion={setNegociacion}
            origenFlete={comprasOrigenFlete} setOrigenFlete={setComprasOrigenFlete}
            destinoFlete={comprasDestinoFlete} setDestinoFlete={setComprasDestinoFlete}
            rutaNacSelect={rutaNacSelect} setRutaNacSelect={setRutaNacSelect}
            fleteNac={fleteNac} setFleteNac={setFleteNac}
            ppProv={ppProv} setPpProv={setPpProv}
            capKg={capKg}
          />

          {/* Destino de la venta — segundo nivel del arbol */}
          <div className="space-y-2 bg-gray-900 border border-gray-700 rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta</div>

            <div className="flex">
              {[
                ['inventario',  'Inventario',  '#16a34a'],
                ['nacional',    'Nacional',    '#ff6600'],
                ['exportacion', 'Exportación', '#ff6600'],
              ].map(([val, lbl, color], idx, arr) => (
                <button
                  key={val}
                  onClick={() => { setDestinoVenta(val); if (val !== 'exportacion') setModoExport(''); }}
                  className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wide transition-colors border ${idx === 0 ? 'rounded-l-lg' : idx === arr.length - 1 ? 'rounded-r-lg -ml-px' : '-ml-px'} ${
                    destinoVenta === val ? 'text-white z-10 relative' : 'text-gray-500 bg-transparent border-gray-700 hover:text-gray-300'
                  }`}
                  style={destinoVenta === val ? { backgroundColor: color, borderColor: color } : {}}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {destinoVenta === 'exportacion' && (
              <div className="flex">
                {[['terrestre', 'Terrestre'], ['maritimo', 'Marítimo']].map(([val, lbl], idx, arr) => (
                  <button
                    key={val}
                    onClick={() => setModoExport(val)}
                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wide transition-colors border ${idx === 0 ? 'rounded-l-lg' : 'rounded-r-lg -ml-px'} ${
                      modoExport === val ? 'text-white z-10 relative' : 'text-gray-500 bg-transparent border-gray-700 hover:text-gray-300'
                    }`}
                    style={modoExport === val ? { backgroundColor: '#ff6600', borderColor: '#ea580c' } : {}}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            {destinoVenta === 'exportacion' && modoExport === '' && (
              <p className="text-[9px] text-gray-500 font-bold">Elige terrestre o marítimo para continuar.</p>
            )}
          </div>

          {modalidad === 'nacional' && (
            <VentaNacional
              cliente={cliente} setCliente={setCliente} opcionesCliente={optionsClientesNacional}
              destino={destino} setDestino={setDestino} opcionesDestino={optionsDestinoNacional}
              precioTonMxn={precioTonNacional} setPrecioTonMxn={setPrecioTonNacional}
              precioTotalMxn={precioMxnNacional} setPrecioTotalMxn={setPrecioMxnNacional}
            />
          )}

          {modalidad === 'terrestre' && (
            <VentaTerrestre
              cliente={cliente} setCliente={setCliente} opcionesCliente={optionsClientesTerrestre}
              destino={destino} setDestino={setDestino} opcionesDestino={optionsDestinoTerrestre}
              porcentajeFijacion={porcentajeFijacion} setPorcentajeFijacion={setPorcentajeFijacion}
              fixPrice={fixPrice} setFixPrice={setFixPrice}
              diasCobro={diasCobro} setDiasCobro={setDiasCobro}
              merma={merma} setMerma={setMerma}
              precioVenta={precioVenta}
              tcHoy={tcHoy} setTcHoy={setTcHoy} tcSeguro={tcSeguro}
              cargandoTC={cargandoTC} onActualizarTC={obtenerTipoDeCambio}
              rutaIntSelect={rutaIntSelect} setRutaIntSelect={setRutaIntSelect}
              cruceInt={cruceInt} setCruceInt={setCruceInt}
            />
          )}

          {modalidad === 'maritimo' && (
            <VentaMaritimo
              cliente={cliente} setCliente={setCliente} opcionesCliente={optionsClientesMaritimo}
              destino={destino} setDestino={setDestino} opcionesDestino={optionsDestinoMaritimo}
              origenEmbarque={origenEmbarque} setOrigenEmbarque={setOrigenEmbarque}
              opcionesOrigenEmbarque={[...new Set(TARIFARIO_DATA.map(r => r.o))].sort()}
              porcentajeFijacion={porcentajeFijacion} setPorcentajeFijacion={setPorcentajeFijacion}
              fixPrice={fixPrice} setFixPrice={setFixPrice}
              diasCobro={diasCobro} setDiasCobro={setDiasCobro}
              merma={merma} setMerma={setMerma}
              precioVenta={precioVenta}
              tcHoy={tcHoy} setTcHoy={setTcHoy} tcSeguro={tcSeguro}
              cargandoTC={cargandoTC} onActualizarTC={obtenerTipoDeCambio}
              capacidadCNT={capacidadCNT} setCapacidadCNT={setCapacidadCNT}
              tarifario={tarifario} setTarifario={setTarifario}
              maritimoRow={maritimoRow} setMaritimoRow={setMaritimoRow}
              cruceInt={cruceInt} setCruceInt={setCruceInt}
              sinTarifario={sinTarifario}
            />
          )}

          {modalidad === 'inventario' && (
            <div className="text-center bg-black py-4 rounded-xl border border-green-700">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1 text-green-400">Costo de la Compra</label>
              <div className="text-3xl font-black text-white font-mono tracking-tight">
                {fMxn((Number(ppProv) || 0) * cargasTotales * capKg)}
              </div>
              <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Sin venta ligada — no hay tope</p>
            </div>
          )}

          {tieneVenta && (
          <>
          <div className="w-full h-px bg-gray-700 my-4"></div>

          <div className="text-center bg-black py-4 rounded-xl border shadow-lg" style={{ borderColor: '#ff6600' }}>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#ff6600' }}>Tope Máximo de Compra</label>
            <div className="text-4xl font-black text-white font-mono tracking-tight drop-shadow-md">
              {fMxn(precioTopeCompra)}
            </div>
            <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Límite para 0 ganancia</p>
          </div>

          <div className="mt-4">
            <div className={`mt-4 p-3 rounded-xl text-[10px] uppercase tracking-widest font-black flex flex-col items-center justify-center gap-1.5 shadow-sm transition-colors ${status === 'bad' ? 'bg-red-900 text-red-400 border border-red-700' : status === 'warning' ? 'bg-yellow-900 text-yellow-400 border border-yellow-700' : 'bg-green-900 text-green-400 border border-green-700'}`}>
              {status === 'bad' && <div className="text-xs">⚠️ PÉRDIDA SEGURA</div>}
              {status === 'warning' && <div className="text-xs">⚠️ MARGEN RIESGOSO</div>}
              {status === 'good' && (
                <>
                  <div className="text-xs flex items-center gap-1">✅ APROBADO (GANANCIA)</div>
                  <div className="text-white bg-green-800 px-2 py-1 rounded mt-1 text-center">
                    Total Ref: {fMxn(utilidadNeta)} <br/>
                    <span className="text-[9px] text-green-400 font-normal">{modalidad === 'maritimo' ? `*(Ganancia por contenedor de ${capacidadCNT}T)*` : modalidad === 'nacional' ? '*(Ganancia por camión de 24.5T)*' : '*(Ganancia por camión de 19.5T)*'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          </>
          )}

          <div>
            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows="2" placeholder="Observaciones..." className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white resize-none" />
          </div>

          <button
            onClick={handleGuardarCotizacion}
            disabled={guardando || modalidad === ''}
            className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border"
            style={{
              backgroundColor: (guardando || modalidad === '') ? '#374151' : '#ff6600',
              color: (guardando || modalidad === '') ? '#9ca3af' : '#ffffff',
              borderColor: (guardando || modalidad === '') ? '#4b5563' : '#ea580c'
            }}
          >
            {guardando ? 'Guardando...' : '💾 Guardar Trato'}
          </button>

          {mensajeExito && (
            <div className="absolute inset-x-0 bottom-4 mx-4 bg-green-600 text-white text-center text-xs font-black py-3 rounded-xl shadow-xl animate-bounce border border-green-400 z-50">
              {mensajeExito}
            </div>
          )}

        </div>      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
