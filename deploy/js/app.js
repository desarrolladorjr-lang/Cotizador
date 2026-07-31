const { useState, useEffect } = React;

function App() {
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('usuarioCotizador');
    return saved ? JSON.parse(saved) : null;
  });
  const [errorLogin, setErrorLogin] = useState('');

  const [activeTab, setActiveTab] = useState('terrestre');

  const [credToken, setCredToken] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargandoTC, setCargandoTC] = useState(false);

  // Estados de los campos
  const [cliente, setCliente] = useState('OMC');
  const [proveedor, setProveedor] = useState('CALDERA');
  const [cargas, setCargas] = useState("1");

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
  const [rutaNacSelect, setRutaNacSelect] = useState('');
  const [rutaIntSelect, setRutaIntSelect] = useState('');

  const [notas, setNotas] = useState('');
  const [embalaje, setEmbalaje] = useState('');
  const [negociacion, setNegociacion] = useState('');

  // Compra Directa state
  const [compraDirecta, setCompraDirecta] = useState(false);
  const [pendientes, setPendientes] = useState({ terrestre: [], maritimo: [] });
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [errorPendientes, setErrorPendientes] = useState('');
  const [hasFetchedPendientes, setHasFetchedPendientes] = useState(false);
  const [contrato, setContrato] = useState('');
  const [paraInventarios, setParaInventarios] = useState(false);
  const [intencionVenta, setIntencionVenta] = useState(false);
  const [intencionCompra, setIntencionCompra] = useState(false);
  const [comprasProveedores, setComprasProveedores] = useState([
    { proveedor: optionsProveedorNacional[0], cargas: "1" }
  ]);
  const updateComprasProveedor = (i, field, value) => {
    setComprasProveedores(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };
  const [precioMxnNacional, setPrecioMxnNacional] = useState("");
  const [simPrecioMxnNacional, setSimPrecioMxnNacional] = useState("");
  const [precioTonNacional, setPrecioTonNacional] = useState("");
  const [simPrecioTonNacional, setSimPrecioTonNacional] = useState("");
  const [ivNacPrecioTotal, setIvNacPrecioTotal] = useState("");
  const removeComprasProveedor = (i) => {
    setComprasProveedores(prev => prev.filter((_, idx) => idx !== i));
  };

  // Maritime container capacity (tons → kg in formula)
  const [capacidadCNT, setCapacidadCNT] = useState(20);

  // Compras — tipo (radio global) y precio inventario
  const [comprasTipo, setComprasTipo] = useState('');
  const [precioCompraMxnCompras, setPrecioCompraMxnCompras] = useState('');
  const [intencionVentaModalidad, setIntencionVentaModalidad] = useState('');

  // Compras — origen de embarque (display, intencionVenta marítimo) — separado de maritimoOrigen (motor de Ocean Freight)
  const [origenEmbarque, setOrigenEmbarque] = useState('');

  // Compras — selectors de ruta flete nacional (Hoja 10)
  const [comprasOrigenFlete, setComprasOrigenFlete] = useState('');
  const [comprasDestinoFlete, setComprasDestinoFlete] = useState('GRAL. ESCOBÉDO, NL');

  // Maritime ocean freight selectors
  const [maritimoProveedor, setMaritimoProveedor] = useState('');
  const [maritimoOrigen, setMaritimoOrigen] = useState('');
  const [maritimoDestino, setMaritimoDestino] = useState('');
  const [maritimoEquipo, setMaritimoEquipo] = useState('');
  const [maritimoTipo, setMaritimoTipo] = useState('');
  const [maritimoRow, setMaritimoRow] = useState(null); // fila del tarifario resuelta, para el desglose

  // Simulator state
  const [modoSimulador, setModoSimulador] = useState(false);
  // Surtir (usa pendientes, bloqueado a contrato) vs Nuevo (manual, sin pendientes, todo desbloqueado) — solo maritimo/nacional
  const [modoNuevoSurtido, setModoNuevoSurtido] = useState(false);
  const [simPorcentajeFijacion, setSimPorcentajeFijacion] = useState("100");
  const [simFixPrice, setSimFixPrice] = useState("2550.00");
  const [simTcHoy, setSimTcHoy] = useState("");
  const [simCargandoTC, setSimCargandoTC] = useState(false);
  const [simDiasCobro, setSimDiasCobro] = useState("15");
  const [simFleteNac, setSimFleteNac] = useState("0");
  const [simRutaNacSelect, setSimRutaNacSelect] = useState("");
  const [simCruceInt, setSimCruceInt] = useState("0");
  const [simRutaIntSelect, setSimRutaIntSelect] = useState("");
  const [simMerma, setSimMerma] = useState("1");
  const [simManiobras, setSimManiobras] = useState("0.60");
  const [simAduanaMex, setSimAduanaMex] = useState("2308");
  const [simAduanaUsa, setSimAduanaUsa] = useState("65");
  const [simPpProv, setSimPpProv] = useState("40.00");
  const [simTcSeguro, setSimTcSeguro] = useState(0);
  const [simPrecioTopeCompra, setSimPrecioTopeCompra] = useState(0);
  const [simUtilidadNeta, setSimUtilidadNeta] = useState(0);
  const [simStatus, setSimStatus] = useState('good');

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

  useEffect(() => {
    if (!compraDirecta || modoNuevoSurtido) { setContrato(''); return; }
    const matches = tabPendientes.filter(p => p.material === material && p.client === cliente);
    const unicos = [...new Set(matches.map(p => p.contrato))];
    if (unicos.length === 1) {
      setContrato(unicos[0]);
      const m = matches.find(p => p.contrato === unicos[0]);
      if (m) {
        if (m.fijacion) setPorcentajeFijacion(String(m.fijacion));
        if (m.fixPrice) setFixPrice(String(m.fixPrice));
      }
    } else {
      setContrato('');
    }
  }, [compraDirecta, modoNuevoSurtido, cliente, material, activeTab]);

  useEffect(() => {
    setModoSimulador(false);
    setModoNuevoSurtido(false);
    setParaInventarios(false);
    setIntencionVenta(false);
    setIntencionCompra(false);
    setComprasProveedores([{ proveedor: optionsProveedorNacional[0], cargas: "1" }]);
    setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo('');
    setCargandoPendientes(false);
    setCruceInt("0");
    setRutaIntSelect('');
    // Modalidades terrestre/maritimo/nacional arrancan en Back to Back
    setCompraDirecta(true);
    // Fetch si nunca se cargó O si este tab sigue vacío (reintento tras fix de backend)
    if (activeTab !== 'nacional' && activeTab !== 'compras' && !cargandoPendientes) {
      const tabPend = activeTab === 'terrestre' ? pendientes.terrestre : pendientes.maritimo;
      if (!hasFetchedPendientes || tabPend.length === 0) fetchPendientes();
    }
    if (activeTab === 'terrestre') {
      setCliente("OMC");
      setMaterial("UBC");
      setDestino("Laredo, TX");
      setProveedor("CALDERA");
    } else if (activeTab === 'maritimo') {
      setCliente(optionsClientesMaritimo[0]);
      setMaterial(optionsMaterialMaritimo[0]);
      setDestino(optionsDestinoMaritimo[0]);
      setProveedor(optionsProveedorMaritimo[0]);
    } else if (activeTab === 'nacional') {
      setCliente(optionsClientesNacional[0]);
      setMaterial(optionsMaterialNacional[0]);
      setDestino(optionsDestinoNacional[0]);
      setProveedor(optionsProveedorNacional[0]);
      setFixPrice("2550.00");
      setPorcentajeFijacion("100");
    } else if (activeTab === 'compras') {
      setCompraDirecta(false);
      setModoSimulador(false);
      setCliente(optionsClientesNacional[0]);
      setMaterial(optionsMaterialNacional[0]);
      setDestino(optionsDestinoNacional[0]);
      setProveedor(optionsProveedorNacional[0]);
      setComprasTipo('');
      setIntencionVentaModalidad('');
      setPrecioCompraMxnCompras('');
      setIvNacPrecioTotal('');
      setComprasOrigenFlete('');
      setComprasDestinoFlete('');
      setFleteNac("0");
      setComprasProveedores([{ proveedor: optionsProveedorNacional[0], cargas: "1" }]);
    }
  }, [activeTab]);

  // Cuando pendientes cargan o se cambia tab, corregir material/cliente si no existen en pendientes
  useEffect(() => {
    if (!hasFetchedPendientes || !compraDirecta) return;
    const tabPend = activeTab === 'terrestre' ? pendientes.terrestre
                  : activeTab === 'maritimo'  ? pendientes.maritimo
                  : [];
    if (tabPend.length === 0) return;
    const mats = [...new Set(tabPend.map(p => p.material))];
    if (!mats.includes(material)) {
      const newMat = mats[0];
      setMaterial(newMat);
      const newClient = tabPend.find(p => p.material === newMat)?.client;
      if (newClient) setCliente(newClient);
    }
  }, [hasFetchedPendientes, activeTab, material, compraDirecta]);

  useEffect(() => {
    const rows = TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino && r.eq === maritimoEquipo);
    const hasTipo = rows.some(r => r.tipo !== null);
    const match = hasTipo ? rows.find(r => r.tipo === maritimoTipo) : rows[0];
    if (match) {
      const desp = calcDespacho(match.pol);
      const numTc = Number(modoSimulador ? simTcHoy : tcHoy) || 0;
      // Todo en USD: ocean freight + (arrastre + despacho) convertido del MXN del
      // tarifario. Por eso aduanaMex queda en 0: el despacho ya va dentro del cruce.
      const totalUsd = numTc > 0 ? match.of + (desp.total / numTc) : match.of;
      setMaritimoRow(match);
      if (modoSimulador) {
        setSimCruceInt(totalUsd.toFixed(2));
        setSimAduanaMex("0");
        setSimRutaIntSelect('');
      } else {
        setCruceInt(totalUsd.toFixed(2));
        setAduanaMex("0");
        setRutaIntSelect('');
      }
    } else {
      setMaritimoRow(null);
    }
  }, [maritimoProveedor, maritimoOrigen, maritimoDestino, maritimoEquipo, maritimoTipo, modoSimulador, tcHoy, simTcHoy]);

  // Proveedor sin tarifario: se captura el ocean freight a mano, así que se limpia
  // el cruce anterior y se devuelve el despacho a Aduana MX (ya no viene incluido).
  useEffect(() => {
    if (!maritimoProveedor) return;
    if (TARIFARIO_DATA.some(r => r.p === maritimoProveedor)) return;
    if (modoSimulador) {
      setSimCruceInt("0");
      setSimAduanaMex("2308");
      setSimRutaIntSelect('');
    } else {
      setCruceInt("0");
      setAduanaMex("2308");
      setRutaIntSelect('');
    }
  }, [maritimoProveedor, modoSimulador]);

  useEffect(() => {
    if (!modoSimulador) return;
    setSimPorcentajeFijacion("100");
    setSimFixPrice("2550.00");
    setSimTcHoy(tcHoy);
    setSimDiasCobro("15");
    setSimFleteNac("0");
    setSimRutaNacSelect("");
    setSimCruceInt("0");
    setSimRutaIntSelect("");
    setSimMerma("1");
    setSimManiobras("0.60");
    setSimAduanaMex("2308");
    setSimAduanaUsa("65");
    setSimPpProv("40.00");
    setSimPrecioMxnNacional(precioMxnNacional);
    setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo('');
    setMaritimoRow(null);
  }, [modoSimulador]);

  useEffect(() => {
    if (compraDirecta && currentMaterial.length > 0) {
      setMaterial(currentMaterial[0]);
    }
  }, [compraDirecta]);

  useEffect(() => {
    if (compraDirecta && currentClientes.length > 0) {
      setCliente(currentClientes[0]);
    }
  }, [material, compraDirecta]);

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

  const obtenerTipoDeCambioSim = async () => {
    setSimCargandoTC(true);
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      if (data && data.rates && data.rates.MXN) {
        setSimTcHoy(data.rates.MXN.toFixed(2));
      }
    } catch (error) {
      console.error("Error TC sim:", error);
      if (!simTcHoy) setSimTcHoy("17.50");
    } finally {
      setSimCargandoTC(false);
    }
  };

  const fetchPendientes = async () => {
    setCargandoPendientes(true);
    setErrorPendientes('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOX2dJUvvpRcDkHYstwnezDyyfeIpUtfdnpuwRtZxICOu2AorLT80PvO6LP7wudRGh_A/exec";
      const res = await fetch(GOOGLE_SCRIPT_URL, { signal: controller.signal });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      console.log('[Pendientes DEBUG]', data._debug);
      console.log('[Pendientes] terrestre:', data.terrestre?.length, '| maritimo:', data.maritimo?.length);
      setPendientes(data);
      setHasFetchedPendientes(true);
    } catch (err) {
      console.error('fetchPendientes error:', err);
      setErrorPendientes(err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'No se pudieron cargar pendientes');
      setCompraDirecta(false);
    } finally {
      clearTimeout(timeout);
      setCargandoPendientes(false);
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

  // VISUALIZACIÓN: Ahora 1 carga = 19,500 kg
  const numCargas = Number(cargas) || 0;
  const comprasTotalCargas = comprasProveedores.reduce((sum, r) => sum + (Number(r.cargas) || 0), 0);
  const visualKg = (activeTab === 'compras' ? comprasTotalCargas : numCargas) * ((activeTab === 'nacional' || activeTab === 'compras') ? 24500 : 19500);
  const visualLb = visualKg * 2.20462;

  // Cálculos de Venta
  const numFijacion = Number(porcentajeFijacion) || 0;
  const numFixPrice = Number(fixPrice) || 0;
  const precioVenta = Number((((numFijacion / 100) * numFixPrice) / 1000).toFixed(5));
  const simPrecioVenta = Number((((Number(simPorcentajeFijacion) / 100) * Number(simFixPrice)) / 1000).toFixed(5));

  // Cálculo Inventarios

  const [tcSeguro, setTcSeguro] = useState(0);
  const [precioTopeCompra, setPrecioTopeCompra] = useState(0);
  const [utilidadNeta, setUtilidadNeta] = useState(0);
  const [utilidadPorKg, setUtilidadPorKg] = useState(0);
  const [status, setStatus] = useState('good');

  // MOTOR MATEMÁTICO ACTUALIZADO (Cargas 24.5 Nac / 19.5 Int)
  useEffect(() => {
    const numTcHoy = Number(tcHoy) || 0;
    const numDiasCobro = Number(diasCobro) || 0;
    const numFleteNac = Number(fleteNac) || 0;
    const numAduanaMex = Number(aduanaMex) || 0;
    const numCruceInt = Number(cruceInt) || 0;
    const numAduanaUsa = Number(aduanaUsa) || 0;
    const numMerma = Number(merma) || 0;
    const numManiobras = Number(maniobras) || 0;
    const numPpProv = Number(ppProv) || 0;

    const truncar = (num) => Math.trunc(num * 100) / 100;
    const tasaRiesgoAnual = 0.15;
    const margenExtra = 0.10;

    let tcSeguroCalc, ingresoKgMxn, logKg, capKg;

    if (activeTab === 'nacional') {
      capKg = 24500;
      logKg = numFleteNac / 24500;
      ingresoKgMxn = (Number(precioMxnNacional) || 0) / capKg;
      tcSeguroCalc = 0;
    } else if (activeTab === 'compras') {
      if (comprasTipo === 'intencionVenta' && intencionVentaModalidad) {
        if (intencionVentaModalidad === 'nacional') {
          tcSeguroCalc = 0;
          capKg = 24500;
          logKg = numFleteNac / 24500;
          ingresoKgMxn = (Number(ivNacPrecioTotal) || 0) / ((comprasTotalCargas || 1) * 24500);
        } else {
          const colchon = ((numTcHoy * tasaRiesgoAnual / 365) * numDiasCobro) + margenExtra;
          tcSeguroCalc = numTcHoy - colchon;
          capKg = intencionVentaModalidad === 'maritimo' ? (capacidadCNT * 1000) : 19500;
          const costoLogNacKg = numFleteNac / 24500;
          const costoLogIntKg = (numAduanaMex + ((numCruceInt + numAduanaUsa) * tcSeguroCalc)) / capKg;
          logKg = costoLogNacKg + costoLogIntKg;
          ingresoKgMxn = precioVenta * tcSeguroCalc;
        }
      } else {
        tcSeguroCalc = 0;
        capKg = 24500;
        logKg = 0;
        ingresoKgMxn = 0;
      }
    } else {
      const colchon = ((numTcHoy * tasaRiesgoAnual / 365) * numDiasCobro) + margenExtra;
      tcSeguroCalc = numTcHoy - colchon;
      capKg = activeTab === 'maritimo' ? (capacidadCNT * 1000) : 19500;
      const costoLogNacKg = numFleteNac / 24500;
      const costoLogIntKg = (numAduanaMex + ((numCruceInt + numAduanaUsa) * tcSeguroCalc)) / capKg;
      logKg = costoLogNacKg + costoLogIntKg;
      ingresoKgMxn = precioVenta * tcSeguroCalc;
    }

    const tope = (ingresoKgMxn - logKg - numManiobras) * (1 - (numMerma / 100));
    const costoCompraMaterial = truncar((numPpProv / (1 - (numMerma / 100))) + numManiobras);
    const netaKg = truncar(ingresoKgMxn - costoCompraMaterial - logKg);
    const netaTotalReferencia = netaKg * capKg;

    setTcSeguro(tcSeguroCalc);
    setPrecioTopeCompra(tope);
    setUtilidadNeta(netaTotalReferencia);
    setUtilidadPorKg(netaKg);

    if (numPpProv > tope) setStatus('bad');
    else if (numPpProv > tope - 0.5) setStatus('warning');
    else setStatus('good');

  }, [precioVenta, tcHoy, diasCobro, fleteNac, aduanaMex, cruceInt, aduanaUsa, merma, maniobras, ppProv, capacidadCNT, activeTab, precioMxnNacional, ivNacPrecioTotal, comprasTipo, intencionVentaModalidad, comprasTotalCargas]);

  // MOTOR SIMULADOR
  useEffect(() => {
    const numTcHoy = Number(simTcHoy) || 0;
    const numDiasCobro = Number(simDiasCobro) || 0;
    const numFleteNac = Number(simFleteNac) || 0;
    const numAduanaMex = Number(simAduanaMex) || 0;
    const numAduanaUsa = Number(simAduanaUsa) || 0;
    const numCruceInt = Number(simCruceInt) || 0;
    const numMerma = Number(simMerma) || 0;
    const numManiobras = Number(simManiobras) || 0;
    const numPpProv = Number(simPpProv) || 0;

    const tasaRiesgoAnual = 0.15;
    const margenExtra = 0.10;
    const colchon = ((numTcHoy * tasaRiesgoAnual / 365) * numDiasCobro) + margenExtra;
    const tcSeguroCalc = numTcHoy - colchon;

    let logKg, capKg, ingresoKgMxn;
    if (activeTab === 'nacional') {
      logKg = numFleteNac / 24500;
      capKg = 24500;
      ingresoKgMxn = (Number(simPrecioMxnNacional) || 0) / capKg;
    } else if (activeTab === 'compras') {
      capKg = 24500;
      logKg = numFleteNac / 24500;
      ingresoKgMxn = simPrecioVenta * tcSeguroCalc;
    } else {
      capKg = activeTab === 'maritimo' ? (capacidadCNT * 1000) : 19500;
      const costoLogNacKg = numFleteNac / 24500;
      const costoLogIntKg = (numAduanaMex + ((numCruceInt + numAduanaUsa) * tcSeguroCalc)) / capKg;
      logKg = costoLogNacKg + costoLogIntKg;
      ingresoKgMxn = simPrecioVenta * tcSeguroCalc;
    }
    const tope = (ingresoKgMxn - logKg - numManiobras) * (1 - (numMerma / 100));

    const truncar = (num) => Math.trunc(num * 100) / 100;
    const costoCompraMaterial = truncar((numPpProv / (1 - (numMerma / 100))) + numManiobras);
    const netaKg = truncar(ingresoKgMxn - costoCompraMaterial - logKg);
    const netaTotalReferencia = netaKg * capKg;

    setSimTcSeguro(tcSeguroCalc);
    setSimPrecioTopeCompra(tope);
    setSimUtilidadNeta(netaTotalReferencia);

    if (numPpProv > tope) setSimStatus('bad');
    else if (numPpProv > tope - 0.5) setSimStatus('warning');
    else setSimStatus('good');
  }, [simPrecioVenta, simTcHoy, simDiasCobro, simFleteNac, simCruceInt, simAduanaMex, simAduanaUsa, simMerma, simManiobras, simPpProv, activeTab, simPrecioMxnNacional, capacidadCNT]);

  const handleGuardarCotizacion = async () => {
    setGuardando(true);
    try {
      const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOX2dJUvvpRcDkHYstwnezDyyfeIpUtfdnpuwRtZxICOu2AorLT80PvO6LP7wudRGh_A/exec";

      const payload = {
        credential: credToken,
        fecha: new Date().toLocaleDateString('es-MX'),
        usuario: usuario.email,
        modalidad: activeTab === 'terrestre' ? 'Terrestre' : activeTab === 'maritimo' ? 'Marítimo' : activeTab === 'compras' ? 'Compras' : 'Nacional',
        cliente: activeTab === 'compras' ? (comprasTipo === 'intencionVenta' ? cliente : '') : cliente,
        proveedor: activeTab === 'compras'
          ? comprasProveedores.map(r => `${r.proveedor}${r.paraInventario ? ' [INV]' : ''}${r.intencionVenta ? ' [IV]' : ''}${r.intencionCompra ? ' [IC]' : ''}`).join(', ')
          : proveedor,
        cargas: activeTab === 'compras'
          ? comprasProveedores.reduce((sum, r) => sum + (Number(r.cargas) || 0), 0)
          : Number(cargas),
        material,
        destino,
        origenEmbarque: activeTab === 'compras' && intencionVentaModalidad === 'maritimo' ? origenEmbarque : '',
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
        tipoCompra: compraDirecta ? (modoNuevoSurtido ? 'Back to Back (Nuevo)' : 'Back to Back') : activeTab === 'compras' ? 'Compra Mercado' : 'Compra Inventarios',
        notas,
        embalaje,
        negociacion,
        contrato: compraDirecta ? contrato : '',
        paraInventarios: activeTab === 'compras' ? comprasTipo === 'inventario' : false,
        intencionVenta: activeTab === 'compras' ? comprasTipo === 'intencionVenta' : false,
        intencionCompra: activeTab === 'compras' ? comprasTipo === 'intencionCompra' : false,
        origenFlete: activeTab === 'compras' ? comprasOrigenFlete : '',
        destinoFlete: activeTab === 'compras' ? comprasDestinoFlete : '',
        precioCompraMxn: activeTab === 'compras' && comprasTipo === 'inventario' ? Number(precioCompraMxnCompras) || 0 : 0
      };

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

  const tabPendientes = activeTab === 'terrestre' ? pendientes.terrestre : activeTab === 'maritimo' ? pendientes.maritimo : [];

  const currentMaterial = compraDirecta && !modoNuevoSurtido && tabPendientes.length > 0
    ? [...new Set(tabPendientes.map(p => p.material))]
    : activeTab === 'terrestre' ? optionsMaterialTerrestre : activeTab === 'maritimo' ? optionsMaterialMaritimo : optionsMaterialNacional;

  const currentClientes = compraDirecta && !modoNuevoSurtido && tabPendientes.length > 0
    ? [...new Set(tabPendientes.filter(p => p.material === material).map(p => p.client))]
    : activeTab === 'compras'
      ? (intencionVentaModalidad === 'maritimo' ? optionsClientesMaritimo : intencionVentaModalidad === 'terrestre' ? optionsClientesTerrestre : optionsClientesNacional)
      : activeTab === 'terrestre' ? optionsClientesTerrestre : activeTab === 'maritimo' ? optionsClientesMaritimo : optionsClientesNacional;
  const currentContratos = compraDirecta && !modoNuevoSurtido && tabPendientes.length > 0
    ? [...new Set(tabPendientes
        .filter(p => p.material === material && p.client === cliente)
        .map(p => p.contrato))]
    : [];
  const currentDestino = activeTab === 'terrestre' ? optionsDestinoTerrestre : activeTab === 'maritimo' ? optionsDestinoMaritimo : optionsDestinoNacional;
  const currentProveedor = activeTab === 'terrestre' ? optionsProveedorTerrestre : activeTab === 'maritimo' ? optionsProveedorMaritimo : optionsProveedorNacional;

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

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-900 text-xs font-black uppercase tracking-widest relative z-10">
          <button
            onClick={() => setActiveTab('terrestre')}
            className={`flex-1 py-3 text-center transition-colors ${activeTab === 'terrestre' ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
            style={{ borderColor: activeTab === 'terrestre' ? '#ff6600' : 'transparent' }}
          >
            Terrestre
          </button>
          <button
            onClick={() => setActiveTab('maritimo')}
            className={`flex-1 py-3 text-center transition-colors ${activeTab === 'maritimo' ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
            style={{ borderColor: activeTab === 'maritimo' ? '#ff6600' : 'transparent' }}
          >
            Marítimo
          </button>
          <button
            onClick={() => setActiveTab('nacional')}
            className={`flex-1 py-3 text-center transition-colors ${activeTab === 'nacional' ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
            style={{ borderColor: activeTab === 'nacional' ? '#ff6600' : 'transparent' }}
          >
            Nacional
          </button>
          <button
            onClick={() => setActiveTab('compras')}
            className={`flex-1 py-3 text-center transition-colors ${activeTab === 'compras' ? 'text-white border-b-2' : 'text-gray-500 hover:text-gray-300'}`}
            style={{ borderColor: activeTab === 'compras' ? '#16a34a' : 'transparent', color: activeTab === 'compras' ? '#4ade80' : '' }}
          >
            Compras
          </button>

        </div>

        <div className="p-6 space-y-5 relative z-10">

          {/* Mode Toggle: Back to Back / Simular */}
          {activeTab !== 'compras' && (
          <div className="flex">
            <button
              onClick={() => {
                setModoSimulador(false);
                if (activeTab !== 'nacional' && !modoNuevoSurtido && !cargandoPendientes) {
                  const btnPend = activeTab === 'terrestre' ? pendientes.terrestre : pendientes.maritimo;
                  if (!hasFetchedPendientes || btnPend.length === 0) fetchPendientes();
                }
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
              className={`flex-1 py-2 -ml-px rounded-r-lg text-[9px] font-black uppercase tracking-wide transition-colors border ${
                modoSimulador
                  ? 'text-white z-10 relative'
                  : 'text-gray-500 bg-transparent border-gray-700'
              }`}
              style={modoSimulador ? { backgroundColor: '#3b82f6', borderColor: '#2563eb' } : {}}
            >
              Simular
            </button>
          </div>
          )}

          {(activeTab === 'maritimo' || activeTab === 'terrestre') && compraDirecta && !modoSimulador && (
          <div className="flex">
            <button
              onClick={() => {
                setModoNuevoSurtido(false);
                if (!cargandoPendientes) {
                  const btnPend = activeTab === 'terrestre' ? pendientes.terrestre : pendientes.maritimo;
                  if (!hasFetchedPendientes || btnPend.length === 0) fetchPendientes();
                }
              }}
              className={`flex-1 py-1.5 rounded-l-lg text-[9px] font-black uppercase tracking-wide transition-colors border ${
                !modoNuevoSurtido
                  ? 'text-white z-10 relative'
                  : 'text-gray-500 bg-transparent border-gray-700'
              }`}
              style={!modoNuevoSurtido ? { backgroundColor: '#15803d', borderColor: '#166534' } : {}}
            >
              Surtir
            </button>
            <button
              onClick={() => setModoNuevoSurtido(true)}
              className={`flex-1 py-1.5 -ml-px rounded-r-lg text-[9px] font-black uppercase tracking-wide transition-colors border ${
                modoNuevoSurtido
                  ? 'text-white z-10 relative'
                  : 'text-gray-500 bg-transparent border-gray-700'
              }`}
              style={modoNuevoSurtido ? { backgroundColor: '#7c3aed', borderColor: '#6d28d9' } : {}}
            >
              Nuevo
            </button>
          </div>
          )}

          {errorPendientes && (
            <div className="text-red-400 text-[10px] font-bold text-center">{errorPendientes}</div>
          )}

          {activeTab !== 'nacional' && compraDirecta && !modoNuevoSurtido && tabPendientes.length === 0 && !cargandoPendientes && (
            <div className="text-yellow-400 text-[10px] font-bold text-center bg-yellow-900 border border-yellow-700 rounded-lg p-2">
              Sin pendientes para esta modalidad
            </div>
          )}


          {activeTab !== 'compras' && (
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
              <select value={cliente} onChange={e => setCliente(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none">
                {currentClientes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {activeTab === 'compras' && (
            <div className="space-y-3">
              {/* Proveedores y Cargas */}
              <div className="space-y-2">
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Proveedores y Cargas</label>
                {comprasProveedores.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={row.proveedor} onChange={e => updateComprasProveedor(i, 'proveedor', e.target.value)} className="flex-1 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                      {optionsProveedorNacional.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type="number" step="0.5" value={row.cargas} onChange={e => updateComprasProveedor(i, 'cargas', e.target.value)} className="w-20 bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors" />
                    {comprasProveedores.length > 1 && (
                      <button onClick={() => removeComprasProveedor(i)} className="text-red-400 hover:text-red-300 font-black text-sm px-2">✕</button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-end">
                  <div className="bg-gray-800 px-3 py-1.5 rounded border border-gray-700 text-center whitespace-nowrap">
                    <div className="text-white text-[11px] font-black leading-tight">{visualKg.toLocaleString()} KG</div>
                    <div className="text-gray-500 text-[9px] font-bold leading-tight">{Math.round(visualLb).toLocaleString()} LB</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Embalaje</label>
                  <select value={embalaje} onChange={e => setEmbalaje(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                    <option value="">— Embalaje —</option>
                    {["PACAS", "JUMBOS", "GAYLORD"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Negociación</label>
                  <select value={negociacion} onChange={e => setNegociacion(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                    <option value="">— Negociación —</option>
                    {["RECOLECCION DIRECTA", "RECOLECCION BMTY", "DIRECTO ENTREGA", "BMTY ENTREGA", "LAREDO ENTREGA"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Tipo — solo uno seleccionable */}
              <div className="flex">
                {[['inventario','Inventario'],['intencionVenta','Int. Venta'],['intencionCompra','Int. Compra']].map(([val, lbl], idx, arr) => (
                  <button
                    key={val}
                    onClick={() => {
                      setComprasTipo(val);
                      setIntencionVentaModalidad('');
                      if (val === 'inventario') {
                        setComprasOrigenFlete('');
                        setComprasDestinoFlete('GRAL. ESCOBÉDO, NL');
                        setFleteNac("0");
                      } else {
                        setComprasOrigenFlete('');
                        setComprasDestinoFlete('');
                        setFleteNac("0");
                      }
                      setPrecioCompraMxnCompras('');
                    }}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wide transition-colors border ${idx === 0 ? 'rounded-l-lg' : idx === arr.length - 1 ? 'rounded-r-lg -ml-px' : '-ml-px'} ${
                      comprasTipo === val
                        ? 'text-white z-10 relative'
                        : 'text-gray-500 bg-transparent border-gray-700 hover:text-gray-300'
                    }`}
                    style={comprasTipo === val ? { backgroundColor: '#16a34a', borderColor: '#15803d' } : {}}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Campos según tipo */}
              {comprasTipo === 'inventario' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen</label>
                      <select
                        value={comprasOrigenFlete}
                        onChange={e => {
                          const orig = e.target.value;
                          setComprasOrigenFlete(orig);
                          const match = FLETES_NACIONALES_COMPRAS.find(r => r.o === orig && r.d === comprasDestinoFlete);
                          if (match) setFleteNac(match.precio.toString());
                          else setFleteNac("0");
                        }}
                        className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                      >
                        <option value="">— Origen —</option>
                        {[...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.o))].sort().map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
                      <select
                        value={comprasDestinoFlete}
                        onChange={e => {
                          const dest = e.target.value;
                          setComprasDestinoFlete(dest);
                          const match = FLETES_NACIONALES_COMPRAS.find(r => r.o === comprasOrigenFlete && r.d === dest);
                          if (match) setFleteNac(match.precio.toString());
                          else setFleteNac("0");
                        }}
                        className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                      >
                        <option value="">— Destino —</option>
                        {[...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.d))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Nac.</label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-gray-400 font-bold text-xs">$</span>
                      <input type="number" value={fleteNac} onChange={e => { setFleteNac(e.target.value); setComprasDestinoFlete(''); }} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Material</label>
                    <select value={material} onChange={e => setMaterial(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate">
                      {currentMaterial.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio Compra (MXN total)</label>
                    <div className="relative">
                      <span className="absolute left-2 top-2.5 text-green-500 font-bold text-xs">$</span>
                      <input
                        type="number"
                        step="100"
                        value={precioCompraMxnCompras}
                        onChange={e => setPrecioCompraMxnCompras(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black border border-gray-700 rounded-lg p-2.5 pl-6 text-green-400 font-mono font-bold text-sm outline-none focus:border-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(comprasTipo === 'intencionVenta' || comprasTipo === 'intencionCompra') && (
                <div className="space-y-3">
                  {comprasTipo === 'intencionVenta' && (
                    <div className="flex">
                      {[['nacional','Nacional'],['maritimo','Marítimo'],['terrestre','Terrestre']].map(([val,lbl],idx,arr) => (
                        <button
                          key={val}
                          onClick={() => setIntencionVentaModalidad(val)}
                          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wide transition-colors border ${idx === 0 ? 'rounded-l-lg' : idx === arr.length - 1 ? 'rounded-r-lg -ml-px' : '-ml-px'} ${
                            intencionVentaModalidad === val
                              ? 'text-white z-10 relative'
                              : 'text-gray-500 bg-transparent border-gray-700 hover:text-gray-300'
                          }`}
                          style={intencionVentaModalidad === val ? { backgroundColor: '#16a34a', borderColor: '#15803d' } : {}}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad && (
                    <div>
                      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cliente</label>
                      <select value={cliente} onChange={e => setCliente(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none">
                        {currentClientes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'maritimo' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen</label>
                        <select
                          value={origenEmbarque}
                          onChange={e => setOrigenEmbarque(e.target.value)}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                        >
                          <option value="">— Origen —</option>
                          {[...new Set(TARIFARIO_DATA.map(r => r.o))].sort().map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
                        <select
                          value={destino}
                          onChange={e => setDestino(e.target.value)}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                        >
                          {optionsDestinoMaritimo.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'terrestre' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen</label>
                        <select
                          value={comprasOrigenFlete}
                          onChange={e => { setComprasOrigenFlete(e.target.value); setComprasDestinoFlete(''); setFleteNac("0"); }}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                        >
                          <option value="">— Origen —</option>
                          {[...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.o))].sort().map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
                        <select
                          value={destino}
                          onChange={e => setDestino(e.target.value)}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none"
                        >
                          {optionsDestinoTerrestre.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Origen</label>
                        <select
                          value={comprasOrigenFlete}
                          onChange={e => { setComprasOrigenFlete(e.target.value); setComprasDestinoFlete(''); setFleteNac("0"); }}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                        >
                          <option value="">— Origen —</option>
                          {[...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.o))].sort().map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
                        <select
                          value={comprasDestinoFlete}
                          onChange={e => {
                            const dest = e.target.value;
                            setComprasDestinoFlete(dest);
                            const match = FLETES_NACIONALES_COMPRAS.find(r => r.o === comprasOrigenFlete && r.d === dest);
                            if (match) setFleteNac(match.precio.toString());
                            else setFleteNac("0");
                          }}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate"
                        >
                          <option value="">— Destino —</option>
                          {[...new Set(FLETES_NACIONALES_COMPRAS.map(r => r.d))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Material</label>
                    <select value={material} onChange={e => setMaterial(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate">
                      {currentMaterial.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'maritimo' && (
                    <div className="space-y-1.5">
                      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Ocean Freight</label>
                      {(() => {
                        const mProv = [...new Set([...TARIFARIO_DATA.map(r => r.p), ...TARIFARIO_PROVEEDORES_EXTRA])].sort();
                        const mOrig = maritimoProveedor ? [...new Set(TARIFARIO_DATA.filter(r => r.p === maritimoProveedor).map(r => r.o))].sort() : [];
                        const mDest = maritimoOrigen ? [...new Set(TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen).map(r => r.pod))].sort() : [];
                        const mEq   = maritimoDestino ? [...new Set(TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino).map(r => r.eq))].sort() : [];
                        const mRows = maritimoEquipo ? TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino && r.eq === maritimoEquipo) : [];
                        const mTipos = [...new Set(mRows.filter(r => r.tipo !== null).map(r => r.tipo))].sort();
                        const mHasTipo = mTipos.length > 0;
                        const mSinTarifas = !!maritimoProveedor && mOrig.length === 0;
                        const selCls = "w-full bg-black border border-gray-700 rounded-lg p-1.5 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none";
                        return (
                          <>
                            <select value={maritimoProveedor} onChange={e => { setMaritimoProveedor(e.target.value); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); }} className={selCls}>
                              <option value="">— Proveedor —</option>
                              {mProv.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            {mSinTarifas && (
                              <>
                                <p className="text-[9px] text-gray-500 leading-tight">Sin tarifario. Captura el ocean freight manual (USD); el despacho va en Aduana MX.</p>
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 font-bold text-[10px]" style={{ color: '#ff6600' }}>$</span>
                                  <input type="number" value={cruceInt} onChange={e => { setCruceInt(e.target.value); setRutaIntSelect(''); }} className="w-full bg-black border border-gray-700 rounded-lg p-1.5 pl-5 text-white font-bold text-[10px] outline-none focus:border-white" />
                                </div>
                              </>
                            )}
                            {!mSinTarifas && maritimoProveedor && (
                              <select value={maritimoOrigen} onChange={e => { setMaritimoOrigen(e.target.value); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); }} className={selCls}>
                                <option value="">— Origen —</option>
                                {mOrig.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            )}
                            {maritimoOrigen && (
                              <select value={maritimoDestino} onChange={e => { setMaritimoDestino(e.target.value); setMaritimoEquipo(''); setMaritimoTipo(''); }} className={selCls}>
                                <option value="">— Destino —</option>
                                {mDest.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            )}
                            {maritimoDestino && (
                              <select value={maritimoEquipo} onChange={e => { setMaritimoEquipo(e.target.value); setMaritimoTipo(''); }} className={selCls}>
                                <option value="">— Equipo —</option>
                                {mEq.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                              </select>
                            )}
                            {mHasTipo && maritimoEquipo && (
                              <select value={maritimoTipo} onChange={e => setMaritimoTipo(e.target.value)} className={selCls}>
                                <option value="">— Tipo —</option>
                                {mTipos.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            )}
                          </>
                        );
                      })()}
                      <DesgloseMaritimo row={maritimoRow} tc={tcHoy} accent="#ff6600" />
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'terrestre' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Int.</label>
                        <select
                          value={rutaIntSelect}
                          onChange={e => {
                            const val = e.target.value;
                            setRutaIntSelect(val);
                            if (val === 'N/A' || val === '') { setCruceInt("0"); return; }
                            const r = [{ name: "MTY - LDO TEX", cost: 17500, currency: 'MXN' }, { name: "JAL - LDO", cost: 2450, currency: 'USD' }, { name: "QRO - LDO", cost: 35000, currency: 'MXN' }, { name: "MTY - MICHIGAN", cost: 4850, currency: 'USD' }, { name: "AGS - LDO", cost: 1900, currency: 'USD' }, { name: "MTY - RUSSVILLE KY", cost: 3750, currency: 'USD' }, { name: "MTY - ALABAMA", cost: 3800, currency: 'USD' }, { name: "MTY - TEXARKANA TX", cost: 3000, currency: 'USD' }].find(x => x.name === val);
                            if(r) {
                              const numTcHoyActual = Number(tcHoy) || 0;
                              if(r.currency === 'USD') setCruceInt(r.cost.toString());
                              else if(numTcHoyActual > 0) setCruceInt((r.cost/numTcHoyActual).toFixed(2));
                            }
                          }}
                          className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none"
                        >
                          <option value="">Ruta / Manual...</option>
                          <option value="N/A">N/A (Sin Flete)</option>
                          {["MTY - LDO TEX", "JAL - LDO", "QRO - LDO", "MTY - MICHIGAN", "AGS - LDO", "MTY - RUSSVILLE KY", "MTY - ALABAMA", "MTY - TEXARKANA TX"].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2 top-2 font-bold text-xs" style={{ color: '#ff6600' }}>$</span>
                        <input type="number" value={cruceInt} onChange={e => { setCruceInt(e.target.value); setRutaIntSelect(''); }} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
                      </div>
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && (intencionVentaModalidad === 'maritimo' || intencionVentaModalidad === 'terrestre') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">T.C. Banco</label>
                          <button onClick={obtenerTipoDeCambio} className="text-[9px] font-bold flex items-center gap-1 hover:text-white transition-colors" style={{ color: '#ff6600' }}>{cargandoTC ? '⏳...' : '🔄 Act.'}</button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-gray-400 font-bold">$</span>
                          <input type="number" step="0.01" value={tcHoy} onChange={e => setTcHoy(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#ff6600' }}>T.C. Seguro</label>
                        <div className="relative">
                          <span className="absolute left-2 top-2 font-bold" style={{ color: '#ff6600' }}>$</span>
                          <input type="text" readOnly value={tcSeguro > 0 ? tcSeguro.toFixed(2) : "0.00"} className="w-full bg-black border rounded-lg p-2 pl-6 font-mono font-bold text-sm outline-none cursor-not-allowed shadow-inner" style={{ color: '#ff6600', borderColor: '#ff6600' }} title="Cálculo con Colchón de Riesgo Aplicado" />
                        </div>
                      </div>
                    </div>
                  )}
                  {comprasTipo === 'intencionVenta' && intencionVentaModalidad === 'nacional' && (
                    <div className="bg-black p-3 rounded-xl border border-gray-700">
                      <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio Total MXN</label>
                      <div className="relative">
                        <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
                        <input type="number" step="100" value={ivNacPrecioTotal} onChange={e => setIvNacPrecioTotal(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none focus:border-white" placeholder="0.00" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab !== 'compras' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                <span className="text-gray-400">Material</span>
                {activeTab !== 'nacional' && compraDirecta && !modoNuevoSurtido && (
                  <span className="font-black" style={{ color: '#ff6600' }}>● PENDIENTE</span>
                )}
              </label>
              <select value={material} onChange={e => setMaterial(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none truncate">
                {currentMaterial.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Destino</label>
              <select value={destino} onChange={e => setDestino(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white transition-colors appearance-none">
                {currentDestino.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          )}

          {activeTab !== 'nacional' && compraDirecta && !modoNuevoSurtido && (
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

          {((activeTab !== 'compras' && activeTab !== 'nacional') || (activeTab === 'compras' && comprasTipo === 'intencionVenta' && (intencionVentaModalidad === 'maritimo' || intencionVentaModalidad === 'terrestre'))) && (
          <div className="grid grid-cols-2 gap-4 bg-black p-3 rounded-xl border border-gray-700">
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">% Fijación</label>
              <div className="relative">
                <input type="number" value={modoSimulador ? simPorcentajeFijacion : porcentajeFijacion} onChange={e => (modoSimulador ? setSimPorcentajeFijacion : setPorcentajeFijacion)(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white" />
                <span className="absolute right-1 top-1.5 text-gray-400 font-bold">%</span>
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fix Price</label>
              <div className="relative">
                <span className="absolute left-1 top-1.5 font-bold" style={{ color: '#ff6600' }}>$</span>
                <input type="number" value={modoSimulador ? simFixPrice : fixPrice} onChange={e => (modoSimulador ? setSimFixPrice : setFixPrice)(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-white font-bold text-sm outline-none focus:border-white" />
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Venta (x KG)</label>
              <div className="relative">
                <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
                <input type="text" readOnly value={(modoSimulador ? simPrecioVenta : precioVenta).toFixed(5)} className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Días Crédito</label>
              <input type="number" value={modoSimulador ? simDiasCobro : diasCobro} onChange={e => (modoSimulador ? setSimDiasCobro : setDiasCobro)(e.target.value)} className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none text-center focus:border-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 text-center" title="Porcentaje estimado de basura/tierra">Merma</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={modoSimulador ? simMerma : merma}
                  onChange={e => (modoSimulador ? setSimMerma : setMerma)(e.target.value)}
                  className="w-full bg-transparent border-b border-gray-700 p-1.5 text-white font-bold text-sm outline-none focus:border-white text-center"
                />
                <span className="absolute right-3 top-2 text-gray-400 font-bold">%</span>
              </div>
            </div>
          </div>
          )}

          {(activeTab === 'nacional') && (
          <div className="bg-black p-3 rounded-xl border border-gray-700 space-y-2">
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio x Ton (MXN) — opcional</label>
              <div className="relative">
                <span className="absolute left-1 top-1.5 text-gray-500 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={modoSimulador ? simPrecioTonNacional : precioTonNacional}
                  onChange={e => {
                    const val = e.target.value;
                    (modoSimulador ? setSimPrecioTonNacional : setPrecioTonNacional)(val);
                    const total = val === '' ? '' : (Number(val) * 24.5).toFixed(2);
                    (modoSimulador ? setSimPrecioMxnNacional : setPrecioMxnNacional)(total);
                  }}
                  className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-gray-300 font-mono font-bold text-sm outline-none focus:border-white"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Precio Total MXN</label>
              <div className="relative">
                <span className="absolute left-1 top-1.5 text-green-500 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={modoSimulador ? simPrecioMxnNacional : precioMxnNacional}
                  onChange={e => { (modoSimulador ? setSimPrecioMxnNacional : setPrecioMxnNacional)(e.target.value); (modoSimulador ? setSimPrecioTonNacional : setPrecioTonNacional)(''); }}
                  className="w-full bg-transparent border-b border-gray-700 p-1.5 pl-5 text-green-400 font-mono font-bold text-sm outline-none focus:border-white"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          )}

          {activeTab !== 'nacional' && activeTab !== 'compras' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">T.C. Banco</label>
                <button
                  onClick={modoSimulador ? obtenerTipoDeCambioSim : obtenerTipoDeCambio}
                  className="text-[9px] font-bold flex items-center gap-1 hover:text-white transition-colors"
                  style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}
                  title="Actualizar TC de internet"
                >
                  {(modoSimulador ? simCargandoTC : cargandoTC) ? '⏳...' : '🔄 Act.'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-2 top-2 text-gray-400 font-bold">$</span>
                <input type="number" step="0.01" value={modoSimulador ? simTcHoy : tcHoy} onChange={e => (modoSimulador ? setSimTcHoy : setTcHoy)(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}>T.C. Seguro</label>
              <div className="relative">
                <span className="absolute left-2 top-2 font-bold" style={{ color: '#ff6600' }}>$</span>
                <input
                  type="text"
                  readOnly
                  value={(modoSimulador ? simTcSeguro : tcSeguro) > 0 ? (modoSimulador ? simTcSeguro : tcSeguro).toFixed(2) : "0.00"}
                  className="w-full bg-black border rounded-lg p-2 pl-6 font-mono font-bold text-sm outline-none cursor-not-allowed shadow-inner"
                  style={{ color: modoSimulador ? '#3b82f6' : '#ff6600', borderColor: modoSimulador ? '#3b82f6' : '#ff6600' }}
                  title="Cálculo con Colchón de Riesgo Aplicado"
                />
              </div>
            </div>
          </div>
          )}


          {activeTab !== 'compras' && <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Nac.</label>
                {activeTab !== 'compras' && (
                  <select
                    value={modoSimulador ? simRutaNacSelect : rutaNacSelect}
                    onChange={e => {
                      const val = e.target.value;
                      const setRuta = modoSimulador ? setSimRutaNacSelect : setRutaNacSelect;
                      const setFlete = modoSimulador ? setSimFleteNac : setFleteNac;
                      setRuta(val);
                      if (val === 'N/A' || val === '') { setFlete("0"); return; }
                      const r = [{name: "MID - MTY", cost: 61480}, {name: "GDL - MTY", cost: 35960}, {name: "MEX / TOL - MTY", cost: 38860}, {name: "PUE - MTY", cost: 49300}, {name: "QRO - MTY", cost: 35380}].find(x => x.name === val);
                      if(r) setFlete(r.cost.toString());
                    }}
                    className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none"
                  >
                    <option value="">Ruta / Manual...</option>
                    <option value="N/A">N/A (Sin Flete)</option>
                    {["MID - MTY", "GDL - MTY", "MEX / TOL - MTY", "PUE - MTY", "QRO - MTY"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-2 top-2 text-gray-400 font-bold text-xs">$</span>
                <input type="number" value={modoSimulador ? simFleteNac : fleteNac} onChange={e => { (modoSimulador ? setSimFleteNac : setFleteNac)(e.target.value); (modoSimulador ? setSimRutaNacSelect : setRutaNacSelect)(''); if (activeTab === 'compras') { setComprasOrigenFlete(''); setComprasDestinoFlete(''); } }} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
              </div>
            </div>

            {(activeTab !== 'nacional' && activeTab !== 'compras' && (compraDirecta || modoSimulador || activeTab === 'maritimo')) && (
            <div className="space-y-3">
              {activeTab === 'maritimo' ? (
                <div className="space-y-1.5">
                  <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Ocean Freight</label>
                  {(() => {
                    const mProv = [...new Set([...TARIFARIO_DATA.map(r => r.p), ...TARIFARIO_PROVEEDORES_EXTRA])].sort();
                    const mOrig = maritimoProveedor ? [...new Set(TARIFARIO_DATA.filter(r => r.p === maritimoProveedor).map(r => r.o))].sort() : [];
                    const mDest = maritimoOrigen ? [...new Set(TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen).map(r => r.pod))].sort() : [];
                    const mEq   = maritimoDestino ? [...new Set(TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino).map(r => r.eq))].sort() : [];
                    const mRows = maritimoEquipo ? TARIFARIO_DATA.filter(r => r.p === maritimoProveedor && r.o === maritimoOrigen && r.pod === maritimoDestino && r.eq === maritimoEquipo) : [];
                    const mTipos = [...new Set(mRows.filter(r => r.tipo !== null).map(r => r.tipo))].sort();
                    const mHasTipo = mTipos.length > 0;
                    const mSinTarifas = !!maritimoProveedor && mOrig.length === 0;
                    const selCls = "w-full bg-black border border-gray-700 rounded-lg p-1.5 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none";
                    return (
                      <>
                        <select value={maritimoProveedor} onChange={e => { setMaritimoProveedor(e.target.value); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); }} className={selCls}>
                          <option value="">— Proveedor —</option>
                          {mProv.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {mSinTarifas && (
                          <p className="text-[9px] text-gray-500 leading-tight">Sin tarifario. Captura el ocean freight manual (USD) abajo; el despacho va en Aduana MX.</p>
                        )}
                        {!mSinTarifas && maritimoProveedor && (
                          <select value={maritimoOrigen} onChange={e => { setMaritimoOrigen(e.target.value); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); }} className={selCls}>
                            <option value="">— Origen —</option>
                            {mOrig.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )}
                        {maritimoOrigen && (
                          <select value={maritimoDestino} onChange={e => { setMaritimoDestino(e.target.value); setMaritimoEquipo(''); setMaritimoTipo(''); }} className={selCls}>
                            <option value="">— Destino —</option>
                            {mDest.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        )}
                        {maritimoDestino && (
                          <select value={maritimoEquipo} onChange={e => { setMaritimoEquipo(e.target.value); setMaritimoTipo(''); }} className={selCls}>
                            <option value="">— Equipo —</option>
                            {mEq.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                          </select>
                        )}
                        {mHasTipo && maritimoEquipo && (
                          <select value={maritimoTipo} onChange={e => setMaritimoTipo(e.target.value)} className={selCls}>
                            <option value="">— Tipo —</option>
                            {mTipos.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Flete Int.</label>
                  <select
                    value={modoSimulador ? simRutaIntSelect : rutaIntSelect}
                    onChange={e => {
                      const val = e.target.value;
                      const setRuta = modoSimulador ? setSimRutaIntSelect : setRutaIntSelect;
                      const setCruce = modoSimulador ? setSimCruceInt : setCruceInt;
                      const numTcHoyActual = Number(modoSimulador ? simTcHoy : tcHoy) || 0;
                      setRuta(val);
                      if (val === 'N/A' || val === '') { setCruce("0"); return; }
                      const r = [{ name: "MTY - LDO TEX", cost: 17500, currency: 'MXN' }, { name: "JAL - LDO", cost: 2450, currency: 'USD' }, { name: "QRO - LDO", cost: 35000, currency: 'MXN' }, { name: "MTY - MICHIGAN", cost: 4850, currency: 'USD' }, { name: "AGS - LDO", cost: 1900, currency: 'USD' }, { name: "MTY - RUSSVILLE KY", cost: 3750, currency: 'USD' }, { name: "MTY - ALABAMA", cost: 3800, currency: 'USD' }, { name: "MTY - TEXARKANA TX", cost: 3000, currency: 'USD' }].find(x => x.name === val);
                      if(r) {
                        if(r.currency === 'USD') setCruce(r.cost.toString());
                        else if(numTcHoyActual > 0) setCruce((r.cost/numTcHoyActual).toFixed(2));
                      }
                    }}
                    className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-bold text-[10px] outline-none truncate focus:border-white appearance-none"
                  >
                    <option value="">Ruta / Manual...</option>
                    <option value="N/A">N/A (Sin Flete)</option>
                    {["MTY - LDO TEX", "JAL - LDO", "QRO - LDO", "MTY - MICHIGAN", "AGS - LDO", "MTY - RUSSVILLE KY", "MTY - ALABAMA", "MTY - TEXARKANA TX"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              <div className="relative">
                <span className="absolute left-2 top-2 font-bold text-xs" style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}>$</span>
                <input type="number" value={modoSimulador ? simCruceInt : cruceInt} onChange={e => { (modoSimulador ? setSimCruceInt : setCruceInt)(e.target.value); (modoSimulador ? setSimRutaIntSelect : setRutaIntSelect)(''); if(activeTab === 'maritimo' && TARIFARIO_DATA.some(r => r.p === maritimoProveedor)) { setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo(''); setMaritimoRow(null); } }} className="w-full bg-black border border-gray-700 rounded-lg p-2 pl-6 text-white font-bold text-sm outline-none focus:border-white" />
              </div>
            </div>
            )}
          </div>}

          {activeTab === 'maritimo' && (
            <DesgloseMaritimo row={maritimoRow} tc={modoSimulador ? simTcHoy : tcHoy} accent={modoSimulador ? '#3b82f6' : '#ff6600'} />
          )}

          {activeTab !== 'compras' && (
          <div className="mt-8 pt-5 border-t border-dashed border-gray-600">
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
                      <div className="bg-gray-800 px-3 py-1.5 rounded border border-gray-700 text-center whitespace-nowrap">
                        <div className="text-white text-[11px] font-black leading-tight">{visualKg.toLocaleString()} KG</div>
                        <div className="text-gray-500 text-[9px] font-bold leading-tight">{Math.round(visualLb).toLocaleString()} LB</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Embalaje</label>
                <select value={embalaje} onChange={e => setEmbalaje(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                  <option value="">— Embalaje —</option>
                  {["PACAS", "JUMBOS", "GAYLORD"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Negociación</label>
                <select value={negociacion} onChange={e => setNegociacion(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-xs outline-none focus:border-white transition-colors appearance-none">
                  <option value="">— Negociación —</option>
                  {["RECOLECCION DIRECTA", "RECOLECCION BMTY", "DIRECTO ENTREGA", "BMTY ENTREGA", "LAREDO ENTREGA"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
          )}

          {(activeTab !== 'compras' || (comprasTipo === 'intencionVenta' && intencionVentaModalidad)) && (
          <>
          <div className="w-full h-px bg-gray-700 my-4"></div>

          <div className="text-center bg-black py-4 rounded-xl border shadow-lg" style={{ borderColor: modoSimulador ? '#3b82f6' : '#ff6600' }}>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: modoSimulador ? '#3b82f6' : '#ff6600' }}>Tope Máximo de Compra</label>
            <div className="text-4xl font-black text-white font-mono tracking-tight drop-shadow-md">
              {fMxn(modoSimulador ? simPrecioTopeCompra : precioTopeCompra)}
            </div>
            <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Límite para 0 ganancia</p>
          </div>

          <div className="mt-4">
            <label className="block text-white text-xs font-bold uppercase tracking-wider mb-2 text-center">{activeTab === 'compras' ? '¿A cuánto lo compraste?' : '¿A cuánto lo cerraste? (Oferta)'}</label>
            <div className="relative w-2/3 mx-auto">
              <span className="absolute left-4 top-2.5 text-gray-400 font-black text-lg">$</span>
              <input
                type="number" step="0.01" value={modoSimulador ? simPpProv : ppProv} onChange={e => (modoSimulador ? setSimPpProv : setPpProv)(e.target.value)}
                className={`w-full bg-black border-2 rounded-xl p-2 pl-8 text-white font-black text-2xl text-center outline-none shadow-inner transition-colors ${(modoSimulador ? simStatus : status) === 'bad' ? 'border-red-500 focus:border-red-400' : (modoSimulador ? simStatus : status) === 'warning' ? 'border-yellow-500 focus:border-yellow-400' : 'border-green-500 focus:border-green-400'}`}
              />
            </div>

            {(() => {
              const activeStatus = modoSimulador ? simStatus : status;
              const activeUtilidad = modoSimulador ? simUtilidadNeta : utilidadNeta;
              return (
                <div className={`mt-4 p-3 rounded-xl text-[10px] uppercase tracking-widest font-black flex flex-col items-center justify-center gap-1.5 shadow-sm transition-colors ${activeStatus === 'bad' ? 'bg-red-900 text-red-400 border border-red-700' : activeStatus === 'warning' ? 'bg-yellow-900 text-yellow-400 border border-yellow-700' : 'bg-green-900 text-green-400 border border-green-700'}`}>
                  {activeStatus === 'bad' && <div className="text-xs">⚠️ PÉRDIDA SEGURA</div>}
                  {activeStatus === 'warning' && <div className="text-xs">⚠️ MARGEN RIESGOSO</div>}
                  {activeStatus === 'good' && (
                    <>
                      <div className="text-xs flex items-center gap-1">✅ APROBADO (GANANCIA)</div>
                      <div className="text-white bg-green-800 px-2 py-1 rounded mt-1 text-center">
                        Total Ref: {fMxn(activeUtilidad)} <br/>
                        <span className="text-[9px] text-green-400 font-normal">{activeTab === 'maritimo' ? `*(Ganancia por contenedor de ${capacidadCNT}T)*` : activeTab === 'nacional' ? '*(Ganancia por camión de 24.5T)*' : '*(Ganancia por camión de 19.5T)*'}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          </>
          )}

          <div>
            <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows="2" placeholder="Observaciones..." className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-white font-bold text-sm outline-none focus:border-white resize-none" />
          </div>

          {activeTab === 'compras' ? (
          <button
            onClick={handleGuardarCotizacion}
            disabled={guardando || !comprasTipo || (comprasTipo === 'intencionVenta' && !intencionVentaModalidad)}
            className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border"
            style={{
              backgroundColor: (guardando || !comprasTipo || (comprasTipo === 'intencionVenta' && !intencionVentaModalidad)) ? '#374151' : '#16a34a',
              color: (guardando || !comprasTipo || (comprasTipo === 'intencionVenta' && !intencionVentaModalidad)) ? '#9ca3af' : '#ffffff',
              borderColor: (guardando || !comprasTipo || (comprasTipo === 'intencionVenta' && !intencionVentaModalidad)) ? '#4b5563' : '#15803d'
            }}
          >
            {guardando ? 'Guardando...' : '💾 Guardar Compra'}
          </button>
          ) : modoSimulador ? (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setPorcentajeFijacion(simPorcentajeFijacion);
                  setFixPrice(simFixPrice);
                  setTcHoy(simTcHoy || tcHoy);
                  setDiasCobro(simDiasCobro);
                  setFleteNac(simFleteNac);
                  setRutaNacSelect(simRutaNacSelect);
                  setCruceInt(simCruceInt);
                  setRutaIntSelect(simRutaIntSelect);
                  setMerma(simMerma);
                  setManiobras(simManiobras);
                  setAduanaMex(simAduanaMex);
                  setAduanaUsa(simAduanaUsa);
                  setPpProv(simPpProv);
                  setPrecioMxnNacional(simPrecioMxnNacional);
                  setModoSimulador(false);
                  setCompraDirecta(false);
                }}
                className="flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-lg transition-all transform active:scale-95 border text-white"
                style={{ backgroundColor: '#3b82f6', borderColor: '#2563eb' }}
              >
                Usar estos valores
              </button>
              <button
                onClick={() => {
                  setSimPorcentajeFijacion("100");
                  setSimFixPrice("2550.00");
                  setSimTcHoy(tcHoy);
                  setSimDiasCobro("15");
                  setSimFleteNac("0");
                  setSimRutaNacSelect("");
                  setSimCruceInt("0");
                  setSimRutaIntSelect("");
                  setSimMerma("1");
                  setSimManiobras("0.60");
                  setSimAduanaMex("2308");
                  setSimAduanaUsa("65");
                  setSimPpProv("40.00");
                  setSimPrecioMxnNacional("");
                  setMaritimoProveedor(''); setMaritimoOrigen(''); setMaritimoDestino(''); setMaritimoEquipo(''); setMaritimoTipo('');
                  setMaritimoRow(null);
                }}
                className="px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-lg transition-all transform active:scale-95 border text-gray-300 bg-gray-700 border-gray-600"
              >
                Limpiar
              </button>
            </div>
          ) : (
          <button
            onClick={handleGuardarCotizacion}
            disabled={guardando || status === 'bad' || !ppProv}
            className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border"
            style={{
              backgroundColor: guardando || status === 'bad' || !ppProv ? '#374151' : '#ff6600',
              color: guardando || status === 'bad' || !ppProv ? '#9ca3af' : '#ffffff',
              borderColor: guardando || status === 'bad' || !ppProv ? '#4b5563' : '#ea580c'
            }}
          >
            {guardando ? 'Guardando...' : '💾 Guardar Trato'}
          </button>
          )}

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
