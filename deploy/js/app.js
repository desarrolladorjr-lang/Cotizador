const { useState, useEffect, useMemo, useRef } = React;

// Google Sign-In solo sirve para el primer acceso: su id_token dura ~1 hora y
// renovarlo obliga a enseñar la tarjeta de One Tap a media captura. Al entrar, ese
// id_token se canjea en Apps Script por un token de sesion propio (firmado alla,
// 30 dias), y es ese el que viaja en cada guardado.
const SESION_KEY = 'sesionCotizador';

const CLIENT_ID = "65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6FL__1-H4xOrjfu1x4kXwcBRUlAGy-YynrNrcxHk9qmzB4es3Op0Ci8_y6vM4zIBm/exec";

// POST a Apps Script. text/plain, no application/json: asi es "simple request" y el
// navegador no manda preflight (Apps Script no responde OPTIONS). El cuerpo sigue
// llegando como JSON a e.postData.contents.
async function postScript(cuerpo) {
  const respuesta = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(cuerpo)
  });
  // Apps Script responde JSON, pero cuando Google se cae a medias (o la red corta
  // el redirect a googleusercontent) llega una pagina HTML de error que el script
  // nunca vio. Eso reventaba en .json() con "Unexpected token '<'".
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch (_) {
    console.error('Respuesta no-JSON del script:', respuesta.status, texto.slice(0, 500));
    throw new Error(
      'Google respondio una pagina en vez de datos (HTTP ' + respuesta.status + '). ' +
      'Revisa la hoja antes de reintentar: la captura pudo haberse guardado.'
    );
  }
}

// exp del JWT, en milisegundos. null si el token no es legible.
function expiracionDeToken(credential) {
  try {
    const base64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(decodeURIComponent(atob(base64).split('').map(
      c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
    return exp ? exp * 1000 : null;
  } catch (e) {
    return null;
  }
}

// Medio minuto de colchon para que un token no expire entre el chequeo y el POST.
const MARGEN_EXPIRACION_MS = 30000;

// Vale para guardar si trae token de sesion sin vencer (30 dias) o, recien entrado,
// el id_token de Google todavia fresco: el backend acepta los dos.
function sesionVigente(sesion) {
  if (!sesion) return false;
  const alDia = !!sesion.expiraEn && sesion.expiraEn - MARGEN_EXPIRACION_MS > Date.now();
  return alDia && !!(sesion.token || sesion.credential);
}

function leerSesionGuardada() {
  try {
    const sesion = JSON.parse(localStorage.getItem(SESION_KEY));
    if (!sesion || !sesion.perfil) return null;
    // Sesiones guardadas por la version vieja traen solo el id_token y su exp de 1
    // hora. Se conservan: el primer guardado las canjea por token propio.
    return sesion.token || sesion.credential ? sesion : null;
  } catch (e) {
    return null;
  }
}

function guardarSesion(sesion) {
  try {
    localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
  } catch (e) {
    console.error('No se pudo guardar la sesion:', e);
  }
}

function gsiListo() {
  return !!(window.google && window.google.accounts && window.google.accounts.id);
}

function App() {
  const [sesion, setSesion] = useState(leerSesionGuardada);
  const usuario = sesion ? sesion.perfil : null;
  const usuarioEmail = usuario ? usuario.email : '';
  const [errorLogin, setErrorLogin] = useState('');
  // Solo cuando la renovacion silenciosa falla: se pide entrar de nuevo encima del
  // formulario, sin borrar nada de lo capturado.
  const [necesitaReloguear, setNecesitaReloguear] = useState(false);

  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  const gsiInicializadoRef = useRef(false);
  const handleCredentialRef = useRef(null);
  const canjeInicialRef = useRef(false);

  const [guardando, setGuardando] = useState(false);
  const [confirmarPerdida, setConfirmarPerdida] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargandoTC, setCargandoTC] = useState(false);

  // Estados de los campos
  // Cliente y destino arrancan vacios: no hay modalidad elegida al inicio, y sus
  // catalogos son por-modalidad (ver efecto de reset mas abajo).
  const [cliente, setCliente] = useState('');

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
  const [ppProv, setPpProv] = useState("40.00");

  const [material, setMaterial] = useState('UBC');
  const [destino, setDestino] = useState('');
  const [origenEmbarque, setOrigenEmbarque] = useState('');
  const [rutaNacSelect, setRutaNacSelect] = useState('');
  const [rutaIntSelect, setRutaIntSelect] = useState('');

  const [notas, setNotas] = useState('');
  const [embalaje, setEmbalaje] = useState('');
  const [negociacion, setNegociacion] = useState('');

  // Compras — selectors de ruta flete nacional (Hoja 10)
  const [comprasOrigenFlete, setComprasOrigenFlete] = useState('');
  const [comprasDestinoFlete, setComprasDestinoFlete] = useState('GRAL. ESCOBÉDO, NL');

  const [precioKgNacional, setPrecioKgNacional] = useState("");
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

  // Inventario entra a la bodega de MTY, salvo cuando se marca explícitamente
  // como entrega directa: en ese caso no debe cargarse flete ni maniobras.
  const negociacionEfectiva = resolverNegociacionEfectiva(modalidad, negociacion);
  // Las maniobras (0.60 x kg) solo se cobran si la carga pasa por esa bodega.
  const maniobras = maniobrasPorNegociacion(negociacionEfectiva);

  const [proveedores, setProveedores] = useState([{ proveedor: '', cargas: '1' }]);
  const [tarifario, setTarifario] = useState({ destino: '', origen: '', pol: '', proveedor: '', equipo: '', tipo: '' });

  const [tarifarioVersion, setTarifarioVersion] = useState(0);

  // Extrae todos los clientes únicos (Columna D) presentes en el tarifario dinámico activo
  const opcionesClienteDinamicas = useMemo(() => {
    const tarifario = (typeof window !== 'undefined' && Array.isArray(window.TARIFARIO_FLETES))
      ? window.TARIFARIO_FLETES
      : TARIFARIO_FLETES;
    
    const setClis = new Set();
    // 1. Clientes de la Columna D del tarifario de fletes en Google Sheets
    tarifario.forEach(r => {
      if (r.cd) setClis.add(r.cd.trim());
    });

    // 2. Catálogo fijo de la modalidad (nacional = "n", exportación = "i")
    const catalogoModalidad =
      modalidad === 'nacional'  ? optionsClientesNacional :
      modalidad === 'terrestre' ? optionsClientesTerrestre :
      modalidad === 'maritimo'  ? optionsClientesMaritimo : [];
    catalogoModalidad.forEach(c => {
      if (c) setClis.add(c.trim());
    });

    // 3. Un cliente "n" no puede aparecer en exportación ni un "i" en nacional
    const filtroModalidad =
      modalidad === 'nacional' ? window.esClienteNacional :
      (modalidad === 'terrestre' || modalidad === 'maritimo') ? window.esClienteExportacion :
      null;

    const lista = Array.from(setClis);
    return (typeof filtroModalidad === 'function' ? lista.filter(filtroModalidad) : lista).sort();
  }, [modalidad, tarifarioVersion]);

  // Cliente y destino son por-modalidad
  const opcionesClienteActual = opcionesClienteDinamicas;

  const opcionesDestinoActual =
    modalidad === 'nacional'  ? optionsDestinoNacional :
    modalidad === 'terrestre' ? optionsDestinoTerrestre :
    modalidad === 'maritimo'  ? optionsDestinoMaritimo : [];

  // Si el valor actual no vive en el catalogo de la nueva modalidad, no lo dejamos
  // sobrevivir al cambio: llegaria a la hoja equivocada con un valor ilegal.
  useEffect(() => {
    if (!opcionesClienteActual.includes(cliente)) setCliente('');
    if (!opcionesDestinoActual.includes(destino)) setDestino('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalidad]);

  // Obtener destinos específicos del cliente seleccionado en el tarifario
  const destinosFiltradosPorCliente = useMemo(() => {
    if (!cliente || typeof window.obtenerDestinosPorCliente !== 'function') return [];
    return window.obtenerDestinosPorCliente(cliente);
  }, [cliente, tarifarioVersion]);

  // Si hay destinos específicos para el cliente, se usan solo esos; de lo contrario, se usa el catálogo general
  const opcionesDestinoNacionalEfectivas = useMemo(() => {
    const listaBase = destinosFiltradosPorCliente.length > 0
      ? destinosFiltradosPorCliente
      : optionsDestinoNacional;
    return typeof window.esDestinoNacional === 'function'
      ? listaBase.filter(window.esDestinoNacional)
      : listaBase.filter(d => !d.includes(', TX') && !d.includes(', KY') && !d.includes(', MS') && !d.includes(', MI') && !d.includes(', OHIO'));
  }, [destinosFiltradosPorCliente]);

  const opcionesDestinoTerrestreEfectivas =
    destinosFiltradosPorCliente.length > 0
      ? destinosFiltradosPorCliente
      : optionsDestinoTerrestre;

  const opcionesDestinoMaritimoEfectivas =
    destinosFiltradosPorCliente.length > 0
      ? destinosFiltradosPorCliente
      : optionsDestinoMaritimo;

  // Auto-llenado inmediato de Destino al seleccionar Cliente.
  // En maritimo el destino de venta es el POD del tarifario, no el destino del flete
  // nacional: ahi solo se auto-llena el tramo carretero.
  useEffect(() => {
    if (!cliente) return;
    const esMaritimo = modalidad === 'maritimo';
    if (destinosFiltradosPorCliente.length > 0) {
      if (!esMaritimo) setDestino(destinosFiltradosPorCliente[0]);
      setComprasDestinoFlete(destinosFiltradosPorCliente[0]);
    } else {
      const clientNorm = cliente.trim().toUpperCase();
      const destSugerido = window.CLIENTES_DESTINOS_MAP?.[clientNorm];
      if (destSugerido) {
        if (!esMaritimo) setDestino(destSugerido);
        setComprasDestinoFlete(destSugerido);
      }
    }
  }, [cliente]);

  // El bloque maritimo no tiene selector de Destino propio: el destino de venta es el
  // POD elegido en el tarifario. Sin este puente `destino` se quedaba vacio y el boton
  // "Guardar Trato" nunca se habilitaba en exportacion maritima.
  useEffect(() => {
    if (modalidad !== 'maritimo') return;
    setDestino(tarifario.destino || '');
  }, [modalidad, tarifario.destino]);

  // Si la modalidad es Inventario, la bodega destino siempre es General Escobedo
  useEffect(() => {
    if (modalidad === 'inventario') {
      setDestino('GRAL. ESCOBÉDO, NL');
      setComprasDestinoFlete('GRAL. ESCOBÉDO, NL');
    }
  }, [modalidad]);

  // Sincronización dinámica del tarifario desde Google Sheets (Apps Script)
  useEffect(() => {
    try {
      const cache = localStorage.getItem('TARIFARIO_FLETES_CACHE');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Array.isArray(parsed) && parsed.length >= 50 && typeof window.actualizarTarifarioDinamico === 'function') {
          window.actualizarTarifarioDinamico(parsed);
          setTarifarioVersion(v => v + 1);
        } else {
          localStorage.removeItem('TARIFARIO_FLETES_CACHE');
        }
      }
    } catch (err) {}

    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6FL__1-H4xOrjfu1x4kXwcBRUlAGy-YynrNrcxHk9qmzB4es3Op0Ci8_y6vM4zIBm/exec";
    fetch(`${GOOGLE_SCRIPT_URL}?action=getTarifario`)
      .then(res => res.json())
      .then(res => {
        if (res && res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
          if (typeof window.actualizarTarifarioDinamico === 'function') {
            window.actualizarTarifarioDinamico(res.data);
            localStorage.setItem('TARIFARIO_FLETES_CACHE', JSON.stringify(res.data));
            setTarifarioVersion(v => v + 1);
          }
        }
      })
      .catch(() => {});
  }, []);

  const [infoFleteResuelto, setInfoFleteResuelto] = useState(null);

  // Los proveedores de la hoja CAT no tienen origen en el tarifario, así que su
  // negociación por defecto es DIRECTO ENTREGA. Sólo se propone sola cuando el
  // usuario aún no ha elegido negociación, para no pisarle un cambio manual.
  useEffect(() => {
    if (typeof window.esProveedorEntregaDirecta !== 'function') return;
    const hayEntregaDirecta = proveedores.some(r => window.esProveedorEntregaDirecta(r.proveedor));
    if (hayEntregaDirecta && negociacion === '') {
      setNegociacion('DIRECTO ENTREGA');
    }
  }, [proveedores, negociacion]);

  // Auto-cálculo de tarifas de flete (soporta rutas simples de 2 puntos y compuestas de 3 puntos)
  useEffect(() => {
    if (typeof window.resolverTarifaFlete !== 'function') return;

    const proveedorNom = proveedores[0]?.proveedor || '';
    const orig = comprasOrigenFlete || origenEmbarque || '';
    const dest = modalidad === 'inventario' ? 'GRAL. ESCOBÉDO, NL' : (destino || comprasDestinoFlete || '');
    const neg = negociacionEfectiva;

    if (neg === 'DIRECTO ENTREGA') {
      setFleteNac('0');
      setCruceInt('0');
      setInfoFleteResuelto({ costo: 0, moneda: 'MXP', desc: 'Directo entrega (Flete $0)', existe: true });
      return;
    }

    // Si la venta está activa pero no se ha seleccionado Cliente o Destino
    if (modalidad !== 'inventario' && (!cliente || !destino)) {
      const tarifaCompra = proveedorNom ? window.resolverTarifaFlete({
        origen: orig,
        destino: 'GRAL. ESCOBÉDO, NL',
        negociacion: 'RECOLECCION MTY',
        clienteOrigen: proveedorNom,
        clienteDestino: ''
      }) : null;

      if (neg === 'RECOLECCION MTY' || neg === 'RECOLECCION BMTY') {
        if (tarifaCompra) {
          setFleteNac(tarifaCompra.costo.toString());
          setCruceInt('0');
          setInfoFleteResuelto({ ...tarifaCompra, desc: `Flete Recolección Proveedor ➔ Bodega Mty ($${tarifaCompra.costo} MXN)`, existe: true });
          return;
        }
      }

      setFleteNac('0');
      setCruceInt('0');
      setInfoFleteResuelto({
        costo: 0,
        moneda: 'MXP',
        desc: '⚠️ Selecciona Cliente y Destino para calcular la tarifa completa',
        existe: false
      });
      return;
    }

    // 1. Tramo Compra (Proveedor -> Bodega Mty)
    const tarifaCompra = window.resolverTarifaFlete({
      origen: orig,
      destino: 'GRAL. ESCOBÉDO, NL',
      negociacion: 'RECOLECCION MTY',
      clienteOrigen: proveedorNom,
      clienteDestino: ''
    });

    // 2. Tramo Venta (Bodega Mty -> Cliente)
    const tarifaVenta = cliente ? window.resolverTarifaFlete({
      origen: 'GRAL. ESCOBÉDO, NL',
      destino: dest,
      negociacion: 'BMTY DESTINO',
      clienteOrigen: '',
      clienteDestino: cliente
    }) : null;

    // 3. Tramo Directo (Proveedor -> Cliente)
    const tarifaDirecta = window.resolverTarifaFlete({
      origen: orig,
      destino: dest,
      negociacion: neg,
      clienteOrigen: proveedorNom,
      clienteDestino: cliente
    });

    if (neg === 'RECOLECCION DIRECTA') {
      if (tarifaDirecta) {
        setInfoFleteResuelto({ ...tarifaDirecta, existe: true });
        if (tarifaDirecta.moneda === 'MXP') { setFleteNac(tarifaDirecta.costo.toString()); setCruceInt('0'); }
        else { setCruceInt(tarifaDirecta.costo.toString()); setFleteNac('0'); }
      } else {
        setFleteNac('0');
        setCruceInt('0');
        setInfoFleteResuelto({ costo: 0, moneda: 'MXP', desc: '⚠️ Ruta no registrada en el tarifario — Ingresa el flete manualmente', existe: false });
      }
    } else if (neg === 'RECOLECCION MTY' || neg === 'RECOLECCION BMTY' || modalidad === 'inventario') {
      if (tarifaCompra) {
        setInfoFleteResuelto({ ...tarifaCompra, existe: true });
        if (tarifaCompra.moneda === 'MXP') { setFleteNac(tarifaCompra.costo.toString()); setCruceInt('0'); }
        else { setCruceInt(tarifaCompra.costo.toString()); setFleteNac('0'); }
      } else {
        setFleteNac('0');
        setCruceInt('0');
        setInfoFleteResuelto({ costo: 0, moneda: 'MXP', desc: '⚠️ Ruta a Bodega Mty no registrada en el tarifario — Ingresa el flete manualmente', existe: false });
      }
    } else if (neg === 'BMTY ENTREGA' || neg === 'BMTY DESTINO' || neg === 'BMTY DIRECTA') {
      let sumNac = 0;
      let hayTarifa = false;
      let descPartes = [];

      if (tarifaCompra && tarifaCompra.moneda === 'MXP') {
        sumNac += tarifaCompra.costo;
        hayTarifa = true;
        descPartes.push(`Compra: $${tarifaCompra.costo}`);
      }
      if (tarifaVenta) {
        if (tarifaVenta.moneda === 'USD') {
          setCruceInt(tarifaVenta.costo.toString());
          hayTarifa = true;
          descPartes.push(`Venta: $${tarifaVenta.costo} USD`);
        } else if (tarifaVenta.moneda === 'MXP') {
          sumNac += tarifaVenta.costo;
          hayTarifa = true;
          descPartes.push(`Venta: $${tarifaVenta.costo} MXN`);
        }
      }

      if (hayTarifa) {
        setFleteNac(sumNac.toString());
        setInfoFleteResuelto({
          costo: sumNac,
          moneda: 'MXP',
          desc: `BMTY ENTREGA (${descPartes.join(' | ')})`,
          existe: true
        });
      } else {
        setFleteNac('0');
        setCruceInt('0');
        setInfoFleteResuelto({
          costo: 0,
          moneda: 'MXP',
          desc: '⚠️ Ruta no registrada en el tarifario — Ingresa el flete manualmente',
          existe: false
        });
      }
    } else {
      if (tarifaDirecta) {
        setInfoFleteResuelto({ ...tarifaDirecta, existe: true });
        if (tarifaDirecta.moneda === 'MXP') { setFleteNac(tarifaDirecta.costo.toString()); setCruceInt('0'); }
        else { setCruceInt(tarifaDirecta.costo.toString()); setFleteNac('0'); }
      } else {
        setFleteNac('0');
        setCruceInt('0');
        setInfoFleteResuelto({
          costo: 0,
          moneda: 'MXP',
          desc: '⚠️ Ruta no registrada en el tarifario — Ingresa el flete manualmente',
          existe: false
        });
      }
    }
  }, [cliente, destino, negociacion, proveedores, comprasOrigenFlete, comprasDestinoFlete, origenEmbarque, modalidad, tcHoy]);

  // CONFIGURACIÓN GOOGLE SIGN-IN — solo cuando de verdad hay que pedir acceso: al
  // entrar la primera vez, o si la sesion de 30 dias murio. Con sesion abierta el
  // SDK se apaga, que es lo que evita que One Tap salte encima de la captura.
  const pideBoton = !usuario || necesitaReloguear;

  useEffect(() => {
    if (!pideBoton) {
      if (gsiListo()) {
        try {
          window.google.accounts.id.cancel();
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
      if (cancelled || !gsiListo()) return;
      if (!gsiInicializadoRef.current) {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          // Indirecto a proposito: initialize corre una sola vez y el callback debe
          // ver siempre la version actual del handler.
          callback: (resp) => handleCredentialRef.current(resp),
          auto_select: false,
          cancel_on_tap_outside: true
        });
        gsiInicializadoRef.current = true;
      }
      const btn = document.getElementById("buttonDiv");
      if (btn) {
        window.google.accounts.id.renderButton(btn, { theme: "outline", size: "large", width: 320 });
      }
    };

    if (gsiListo()) {
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
  }, [pideBoton]);

  // Canjea lo que haya (id_token recien firmado, o token propio por vencer) por un
  // token de sesion nuevo de 30 dias. Todo por POST: no interviene Google, asi que
  // no aparece ninguna tarjeta encima del formulario.
  const canjearSesion = async (base) => {
    if (!base) return null;
    try {
      const res = await postScript({
        accion: 'sesion',
        sesion: base.token || '',
        credential: base.credential || ''
      });
      if (!res || res.error || !res.sesion) return null;
      const renovada = {
        perfil: base.perfil,
        token: res.sesion,
        expiraEn: res.expiraEn,
        // El id_token ya no hace falta una vez que hay token propio.
        credential: ''
      };
      setSesion(renovada);
      sesionRef.current = renovada;
      guardarSesion(renovada);
      return renovada;
    } catch (e) {
      console.error('No se pudo canjear la sesion:', e);
      return null;
    }
  };

  // Al abrir la app se corre la vigencia hacia adelante: quien entra a diario nunca
  // llega a los 30 dias. Si el canje falla no se toca nada — la sesion guardada
  // sigue sirviendo y el guardado lo reintenta.
  useEffect(() => {
    const actual = sesionRef.current;
    if (!actual || canjeInicialRef.current) return;
    canjeInicialRef.current = true;
    if (!sesionVigente(actual)) {
      // Se avisa al abrir, no despues de capturar todo: pasa una sola vez, al
      // migrar desde la sesion vieja de 1 hora o tras 30 dias sin entrar.
      setErrorLogin('Tu sesión caducó. Vuelve a entrar.');
      setNecesitaReloguear(true);
      return;
    }
    canjearSesion(actual);
  }, [usuarioEmail]);

  const handleCredentialResponse = (response) => {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);

    if (payload.email.endsWith('@sidellscrap.com')) {
      // Este filtro es de conveniencia: quien manda es validarCredencial en Codigo.gs.
      const nuevaSesion = {
        perfil: payload,
        token: '',
        credential: response.credential,
        expiraEn: expiracionDeToken(response.credential),
      };
      setSesion(nuevaSesion);
      sesionRef.current = nuevaSesion;
      guardarSesion(nuevaSesion);
      setErrorLogin('');
      setNecesitaReloguear(false);
      // El id_token dura una hora; se cambia enseguida por el token propio de 30
      // dias. Si el canje falla, la sesion sigue valida esa hora y se reintenta al
      // guardar.
      canjearSesion(nuevaSesion);
      if (gsiListo()) window.google.accounts.id.cancel();

      // Limpieza forzada de cualquier iframe residual de Google
      const googleIframe = document.querySelector('iframe[src*="smartlock"]');
      if (googleIframe) googleIframe.remove();
      const credentialPicker = document.getElementById('credential_picker_container');
      if (credentialPicker) credentialPicker.remove();
    } else {
      setErrorLogin('Acceso denegado. Utiliza un correo de @sidellscrap.com');
    }
  };
  handleCredentialRef.current = handleCredentialResponse;

  // La fila del tarifario define el ocean freight y si el despacho ya viene incluido.
  useEffect(() => {
    if (modalidad !== 'maritimo' || !tarifario.equipo) {
      setMaritimoRow(null);
      return;
    }
    const row = TARIFARIO_DATA.find(r =>
      r.p === tarifario.proveedor && r.o === tarifario.origen &&
      r.pod === tarifario.destino && (!tarifario.pol || r.pol === tarifario.pol) &&
      r.eq === tarifario.equipo &&
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

  // Depende del correo, no del objeto sesion: cada renovacion crea un perfil nuevo y
  // con [usuario] se volvia a pedir el TC, pisando el que el operador hubiera puesto.
  useEffect(() => {
    if (usuarioEmail) obtenerTipoDeCambio();
  }, [usuarioEmail]);

  const cargasTotales = proveedores.reduce((s, r) => s + (Number(r.cargas) || 0), 0);

  const CALCULO_VACIO = {
    tcSeguro: 0, capKg: null, precioVenta: 0,
    precioTopeCompra: 0, utilidadNeta: 0, utilidadPorKg: 0, status: '',
  };

  // Sin destino elegido no hay capacidad por carga, asi que no hay nada que calcular.
  const calculo = modalidad === '' ? CALCULO_VACIO : calcularCotizacion({
    modalidad, porcentajeFijacion, fixPrice, tcHoy, diasCobro,
    fleteNac, cruceInt, aduanaMex, aduanaUsa, merma, maniobras, ppProv,
    capacidadCNT, precioKgMxn: precioKgNacional, precioTotalMxn: precioMxnNacional, cargasTotales,
  });

  const { tcSeguro, capKg, precioVenta, precioTopeCompra, utilidadNeta, utilidadPorKg, status } = calculo;

  // La compra se captura antes de conocer el destino, asi que los catalogos no se
  // filtran por modalidad: el material se compra en Mexico vaya a donde vaya.
  const opcionesMaterialActual = [...new Set([
    ...optionsMaterialTerrestre, ...optionsMaterialMaritimo, ...optionsMaterialNacional,
  ])].sort();

  const opcionesProveedorActual = [...new Set([
    ...optionsProveedorTerrestre, ...optionsProveedorMaritimo, ...optionsProveedorNacional,
  ])].sort();

  // Cerrar arriba del tope de compra es pérdida segura. El color rojo solo se ve si
  // el operador está mirando la tarjeta, así que el guardado pide confirmación
  // explícita antes de mandar el trato al Sheet.
  // Trato guardado: limpia captura para el siguiente. tcHoy queda (es el TC del
  // dia, no del trato) y la sesion tampoco se toca.
  const limpiarFormulario = () => {
    setCliente('');
    setPorcentajeFijacion("100");
    setFixPrice("2550.00");
    setDiasCobro("15");
    setFleteNac("0");
    setAduanaMex("2308");
    setCruceInt("0");
    setAduanaUsa("65");
    setMerma("1");
    setPpProv("40.00");
    setMaterial('UBC');
    setDestino('');
    setOrigenEmbarque('');
    setRutaNacSelect('');
    setRutaIntSelect('');
    setNotas('');
    setEmbalaje('');
    setNegociacion('');
    setComprasOrigenFlete('');
    setComprasDestinoFlete('GRAL. ESCOBÉDO, NL');
    setPrecioKgNacional("");
    setPrecioTonNacional("");
    setPrecioMxnNacional("");
    setCapacidadCNT(20);
    setMaritimoRow(null);
    setDestinoVenta('');
    setModoExport('');
    setProveedores([{ proveedor: '', cargas: '1' }]);
    setTarifario({ destino: '', origen: '', pol: '', proveedor: '', equipo: '', tipo: '' });
    setInfoFleteResuelto(null);
  };

  const handleGuardarCotizacion = async ({ confirmadoPerdida = false } = {}) => {
    if (status === 'bad' && !confirmadoPerdida) {
      setConfirmarPerdida(true);
      return;
    }
    setConfirmarPerdida(false);

    // Antes se cerraba la sesion aqui y se perdia la captura. Ahora solo se pide
    // entrar de nuevo cuando el token propio de 30 dias ya murio, y con el
    // formulario intacto detras del modal.
    let sesionActiva = sesionRef.current;
    if (!sesionVigente(sesionActiva)) {
      setErrorLogin('Tu sesión caducó. Vuelve a entrar: tus datos siguen aquí.');
      setNecesitaReloguear(true);
      return;
    }

    setGuardando(true);
    try {
      const payload = construirPayload({
        credential: sesionActiva.credential || '',
        sesion: sesionActiva.token || '',
        fecha: new Date().toLocaleDateString('es-MX'),
        usuario: sesionActiva.perfil.email,
        modalidad, cliente, proveedores, opcionesProveedor: opcionesProveedorActual,
        material, destino, origenEmbarque,
        porcentajeFijacion, fixPrice, tcHoy,
        fleteNac, cruceInt, ppProv, notas, diasCobro, merma,
        embalaje, negociacion,
        origenFlete: comprasOrigenFlete,
        destinoFlete: comprasDestinoFlete,
        calculo,
      });

      // Sin mode:'no-cors' a proposito: con respuesta opaca el catch nunca ve nada
      // y la app cantaba "guardado" aunque el script devolviera un error.
      const resultado = await postScript(payload);

      // El backend rechazo el token: se pide entrar de nuevo sin borrar la captura.
      if (resultado.sesionInvalida) {
        setErrorLogin('Tu sesión caducó. Vuelve a entrar: tus datos siguen aquí.');
        setNecesitaReloguear(true);
        return;
      }
      if (resultado.error) throw new Error(resultado.error);

      // Si el POST entro con id_token, el script devuelve ya el token de sesion.
      if (resultado.sesion) {
        const renovada = {
          perfil: sesionActiva.perfil,
          token: resultado.sesion,
          expiraEn: resultado.expiraEn,
          credential: ''
        };
        setSesion(renovada);
        sesionRef.current = renovada;
        guardarSesion(renovada);
      }

      // El correo es aviso aparte: si falla, la fila ya quedó y hay que decirlo sin
      // hacerlo pasar por un guardado fallido.
      if (resultado.avisoCorreo) {
        setMensajeExito('⚠️ Guardado, pero el correo no salió. Avisa a sistemas.');
        setTimeout(() => setMensajeExito(''), 8000);
      } else {
        setMensajeExito('✅ ¡Trato guardado exitosamente!');
        setTimeout(() => setMensajeExito(''), 3000);
      }
      limpiarFormulario();
    } catch (error) {
      console.error(error);
      setMensajeExito('❌ No se guardó: ' + (error.message || error));
      setTimeout(() => setMensajeExito(''), 8000);
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
        </div>

        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <img src={usuario.picture} alt="Perfil" className="w-6 h-6 rounded-full border border-gray-600 flex-shrink-0" />
            <span className="font-bold text-gray-300 truncate">{usuario.email}</span>
          </div>
          <button onClick={() => {
            setSesion(null);
            sesionRef.current = null;
            canjeInicialRef.current = false;
            setNecesitaReloguear(false);
            localStorage.removeItem(SESION_KEY);
            // Salir es intencional: sin esto, auto_select volveria a entrar solo.
            if (gsiListo()) window.google.accounts.id.disableAutoSelect();
          }} className="text-red-400 font-bold hover:text-red-300 transition-colors">Salir</button>
        </div>

        {/* Reingreso sin perder la captura: solo aparece si la renovacion silenciosa falla. */}
        {necesitaReloguear && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
              <h2 className="text-sm font-black uppercase tracking-widest text-white mb-2">Sesión caducada</h2>
              <p className="text-xs text-gray-400 mb-4 font-bold">
                Vuelve a entrar con tu correo. Lo que capturaste sigue aquí.
              </p>
              <div id="buttonDiv" className="flex justify-center mb-3"></div>
              {errorLogin && (
                <div className="bg-red-900 text-red-400 border border-red-700 text-xs font-bold p-3 rounded-lg">
                  {errorLogin}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-6 space-y-5 relative z-10">

          <BloqueCompra
            proveedores={proveedores} setProveedores={setProveedores}
            opcionesProveedor={opcionesProveedorActual}
            material={material} setMaterial={setMaterial}
            opcionesMaterial={opcionesMaterialActual}
            embalaje={embalaje} setEmbalaje={setEmbalaje}
            negociacion={negociacion} setNegociacion={setNegociacion}
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
              cliente={cliente} setCliente={setCliente} opcionesCliente={opcionesClienteDinamicas}
              destino={destino} setDestino={setDestino} opcionesDestino={opcionesDestinoNacionalEfectivas}
              precioKgNacional={precioKgNacional} setPrecioKgNacional={setPrecioKgNacional}
              setPrecioTonMxn={setPrecioTonNacional} setPrecioMxnNacional={setPrecioMxnNacional}
              cargasTotales={cargasTotales}
              merma={merma} setMerma={setMerma}
              rutaNacSelect={rutaNacSelect} setRutaNacSelect={setRutaNacSelect}
              fleteNac={fleteNac} setFleteNac={setFleteNac}
              infoFleteResuelto={infoFleteResuelto}
            />
          )}

          {modalidad === 'terrestre' && (
            <VentaTerrestre
              cliente={cliente} setCliente={setCliente} opcionesCliente={opcionesClienteDinamicas}
              destino={destino} setDestino={setDestino} opcionesDestino={opcionesDestinoTerrestreEfectivas}
              porcentajeFijacion={porcentajeFijacion} setPorcentajeFijacion={setPorcentajeFijacion}
              fixPrice={fixPrice} setFixPrice={setFixPrice}
              diasCobro={diasCobro} setDiasCobro={setDiasCobro}
              merma={merma} setMerma={setMerma}
              precioVenta={precioVenta}
              tcHoy={tcHoy} setTcHoy={setTcHoy} tcSeguro={tcSeguro}
              cargandoTC={cargandoTC} onActualizarTC={obtenerTipoDeCambio}
              rutaIntSelect={rutaIntSelect} setRutaIntSelect={setRutaIntSelect}
              cruceInt={cruceInt} setCruceInt={setCruceInt}
              rutaNacSelect={rutaNacSelect} setRutaNacSelect={setRutaNacSelect}
              fleteNac={fleteNac} setFleteNac={setFleteNac}
            />
          )}

          {modalidad === 'maritimo' && (
            <VentaMaritimo
              cliente={cliente} setCliente={setCliente} opcionesCliente={opcionesClienteDinamicas}
              destino={destino} setDestino={setDestino} opcionesDestino={opcionesDestinoMaritimoEfectivas}
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
              rutaNacSelect={rutaNacSelect} setRutaNacSelect={setRutaNacSelect}
              fleteNac={fleteNac} setFleteNac={setFleteNac}
            />
          )}

          {modalidad === 'inventario' && (
            <div className="space-y-4">
              <div className="text-center bg-black py-3 rounded-xl border border-green-700">
                <label className="block text-[10px] font-black uppercase tracking-widest text-green-400">Inventario</label>
              </div>

              <div className="text-center">
                <label className="block text-white text-xs font-black uppercase tracking-widest mb-2">
                  PRECIO DE COMPRA (MXN x KG)
                </label>
                <div className="relative bg-black border-2 border-emerald-500 rounded-2xl p-3 shadow-lg">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={ppProv}
                    onChange={e => setPpProv(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-white font-black text-3xl text-center outline-none font-mono"
                  />
                </div>
              </div>

              <BloqueFleteNacional
                fleteNac={fleteNac} setFleteNac={setFleteNac}
                sinSelect={true}
                infoFleteResuelto={infoFleteResuelto}
              />
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

          <div className="mt-4 text-center">
            <label className="block text-white text-xs font-black uppercase tracking-widest mb-2">
              ¿A CUÁNTO LO CERRASTE? (OFERTA)
            </label>
            <div className={`relative bg-black border-2 rounded-2xl p-3 shadow-lg transition-colors ${status === 'bad' ? 'border-red-500' : 'border-emerald-500'}`}>
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
              <input
                type="number"
                step="0.01"
                value={ppProv}
                onChange={e => setPpProv(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-white font-black text-3xl text-center outline-none font-mono"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className={`p-3 rounded-xl text-[10px] uppercase tracking-widest font-black flex flex-col items-center justify-center gap-1.5 shadow-sm transition-colors ${status === 'bad' ? 'bg-red-900 text-red-400 border border-red-700' : status === 'warning' ? 'bg-yellow-900 text-yellow-400 border border-yellow-700' : 'bg-green-900 text-green-400 border border-green-700'}`}>
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
            onClick={() => handleGuardarCotizacion()}
            disabled={guardando || modalidad === '' || (tieneVenta && (cliente === '' || destino === ''))}
            className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-95 border"
            style={{
              backgroundColor: (guardando || modalidad === '' || (tieneVenta && (cliente === '' || destino === ''))) ? '#374151' : '#ff6600',
              color: (guardando || modalidad === '' || (tieneVenta && (cliente === '' || destino === ''))) ? '#9ca3af' : '#ffffff',
              borderColor: (guardando || modalidad === '' || (tieneVenta && (cliente === '' || destino === ''))) ? '#4b5563' : '#ea580c'
            }}
          >
            {guardando ? 'Guardando...' : '💾 Guardar Trato'}
          </button>

          {confirmarPerdida && (
            <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="w-full bg-gray-800 border-2 border-red-600 rounded-2xl p-5 shadow-2xl text-center">
                <div className="text-3xl mb-2">⚠️</div>
                <h2 className="text-red-400 font-black text-sm uppercase tracking-widest mb-2">
                  Estás cerrando con pérdida
                </h2>
                <p className="text-gray-300 text-xs font-bold mb-3">
                  Ofreciste <span className="text-white font-mono">${Number(ppProv || 0).toFixed(2)}</span> por kg
                  y el límite para no perder es <span className="text-white font-mono">${Number(precioTopeCompra || 0).toFixed(2)}</span>.
                </p>
                <div className="bg-red-900 border border-red-700 text-red-300 rounded-lg py-2 px-3 text-xs font-black mb-4">
                  Pérdida estimada: {fMxn(Math.abs(utilidadNeta))}<br />
                  <span className="text-[9px] font-bold">({fMxn(Math.abs(utilidadPorKg))} por kg)</span>
                </div>
                <p className="text-gray-400 text-[11px] font-bold mb-4">
                  ¿De verdad quieres guardar el trato a ese precio?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmarPerdida(false)}
                    className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-gray-700 text-gray-200 border border-gray-600 active:scale-95 transition-transform"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleGuardarCotizacion({ confirmadoPerdida: true })}
                    className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white border border-red-500 active:scale-95 transition-transform"
                  >
                    Sí, cerrar así
                  </button>
                </div>
              </div>
            </div>
          )}

          {mensajeExito && (
            <div className={`absolute inset-x-0 bottom-4 mx-4 text-white text-center text-xs font-black py-3 rounded-xl shadow-xl animate-bounce border z-50 ${
              mensajeExito.startsWith('❌')
                ? 'bg-red-700 border-red-400'
                : 'bg-green-600 border-green-400'
            }`}>
              {mensajeExito}
            </div>
          )}

        </div>      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
