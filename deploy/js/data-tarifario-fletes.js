// Tarifario Completo de Fletes (Terrestres / Nacionales / Internacionales)
// Fuentes: Google Sheets de Tarifas de Fletes

const TARIFARIO_FLETES = [
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "ALUMINUM DYNAMICS MS", d: "COLUMBUS, MS", costo: 3150, moneda: "USD" },
  { co: "ELIAS ESQUIVEL", o: "NEZAHUALCÓYOTL, CDMX", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 38860, moneda: "MXP" },
  { co: "VALENTIN", o: "TLACHALOYA, EDO.MEX.", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 38860, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "ARZYZ NL", d: "APODACA, NL", costo: 7000, moneda: "MXP" },
  { co: "MEINSUR", o: "MÉRIDA, YUC.", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 61480, moneda: "MXP" },
  { co: "CESAR DELGADO AGS", o: "AGUASCALIENTES, AGS", cd: "REGEN", d: "LAREDO, TX", costo: 1900, moneda: "USD" },
  { co: "MEINSUR", o: "MÉRIDA, YUC.", cd: "TOBI", d: "GRAL. ESCOBÉDO, NL", costo: 61480, moneda: "MXP" },
  { co: "EDUARDO PALOMO", o: "TLACHALOYA, EDO.MEX.", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 38860, moneda: "MXP" },
  { co: "CESAR DELGADO", o: "TLAQUEPAQUE, JAL", cd: "JRG SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 24360, moneda: "MXP" },
  { co: "CESAR DELGADO AGS", o: "AGUASCALIENTES, AGS", cd: "OMC", d: "LAREDO, TX", costo: 1900, moneda: "USD" },
  { co: "JOSE LUIS MARTINEZ", o: "LA PIEDAD, QRO", cd: "SIDELL USA", d: "LAREDO, TX", costo: 35000, moneda: "MXP" },
  { co: "JOSE LUIS MARTINEZ", o: "LA PIEDAD, QRO", cd: "REGEN", d: "LAREDO, TX", costo: 35000, moneda: "MXP" },
  { co: "METAL EUTECTIC", o: "SANTA CATARINA, NL", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 11020, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "SIDELL USA", d: "LAREDO, TX", costo: 1000, moneda: "USD" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "TOBI", d: "GRAL. ESCOBÉDO, NL", costo: 7000, moneda: "MXP" },
  { co: "HORACIO SERVIN", o: "ZAPOTE DEL VALLE, JAL.", cd: "REGEN", d: "LAREDO, TX", costo: 2450, moneda: "USD" },
  { co: "DIEGO GARZA", o: "NASH TX", cd: "TEXARCANA", d: "TEXARKANA, TX", costo: 875, moneda: "USD" },
  { co: "PACO MARTINEZ", o: "GRAL. ESCOBÉDO, NL", cd: "REGEN", d: "LAREDO, TX", costo: 920, moneda: "USD" },
  { co: "METAL EUTECTIC", o: "SANTA CATARINA, NL", cd: "INTRAMETCO", d: "LAREDO, TX", costo: 985, moneda: "USD" },
  { co: "VALENTIN", o: "TLACHALOYA, EDO.MEX.", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 31320, moneda: "MXP" },
  { co: "RECICLE", o: "AGUASCALIENTES, AGS", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 30160, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "REGEN", d: "LAREDO, TX", costo: 920, moneda: "USD" },
  { co: "JOSE LUIS MARTINEZ", o: "LA PIEDAD, QRO", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 17400, moneda: "MXP" },
  { co: "HORACIO SERVIN", o: "ZAPOTE DEL VALLE, JAL.", cd: "INTRAMETCO", d: "LAREDO, TX", costo: 2450, moneda: "USD" },
  { co: "HORACIO SERVIN", o: "ZAPOTE DEL VALLE, JAL.", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 35960, moneda: "MXP" },
  { co: "JAVIER VILLARREAL", o: "PESQUERÍA, NL.", cd: "JRG MTY", d: "APODACA, NL", costo: 9280, moneda: "MXP" },
  { co: "CESAR DELGADO", o: "TLAQUEPAQUE, JAL", cd: "JRG MTY", d: "APODACA, NL", costo: 35960, moneda: "MXP" },
  { co: "HUMBERTO SERVIN", o: "TLAJOMULCO DE ZUÑIGA, JAL.", cd: "JRG MTY", d: "APODACA, NL", costo: 35960, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "JRG MTY", d: "APODACA, NL", costo: 11020, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "INTRAMETCO", d: "LAREDO, TX", costo: 920, moneda: "USD" },
  { co: "CESAR DELGADO", o: "TLAQUEPAQUE, JAL", cd: "JRG TEZO", d: "TEZOYUCA, EDOMEX", costo: 33060, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "OMC", d: "LAREDO, TX", costo: 920, moneda: "USD" },
  { co: "JAVIER VILLARREAL", o: "PESQUERÍA, NL.", cd: "OMC", d: "LAREDO, TX", costo: 17500, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "TEXARCANA TX", d: "TEXARKANA, TX", costo: 3150, moneda: "USD" },
  { co: "FAGOR SLP", o: "SAN LUIS POTOSÍ, SLP", cd: "JRG SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 6380, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "FAGOR TEPEJI", d: "TEPEJI, HIDALGO", costo: 30740, moneda: "MXP" },
  { co: "LUIS TORRES", o: "GRAL. ESCOBÉDO, NL", cd: "REGEN", d: "LAREDO, TX", costo: 920, moneda: "USD" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "COMERCIALIZADORA REIN", d: "SAN JOSE DEL VERDE, JAL", costo: 30160, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "CESAR GARZA", d: "LA LADRILLERA, NL.", costo: 9280, moneda: "MXP" },
  { co: "CESAR DELGADO", o: "TLAQUEPAQUE, JAL", cd: "FAGOR SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 24940, moneda: "MXP" },
  { co: "TOÑO MORADO", o: "SAN LUIS POTOSÍ, SLP", cd: "ALUMM", d: "POZA RICA, VER.", costo: 56260, moneda: "MXP" },
  { co: "HUMBERTO SERVIN", o: "TLAQUEPAQUE, JAL", cd: "JRG SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 24940, moneda: "MXP" },
  { co: "JRG", o: "APODACA, NL", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 5500, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 26100, moneda: "MXP" },
  { co: "CESAR DELGADO", o: "TLAQUEPAQUE, JAL", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 24940, moneda: "MXP" },
  { co: "RECIMETSA", o: "SAN LUIS POTOSÍ, SLP", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 26100, moneda: "MXP" },
  { co: "TORIBIO", o: "IXTAPALUCA, EDO. MEX.", cd: "FAGOR TEPEJI", d: "TEPEJI, HIDALGO", costo: 20300, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "LUIS TORRES", d: "CD.MITRAS, N.L.", costo: 7500, moneda: "MXP" },
  { co: "EDUARDO PALOMO", o: "TLACHALOYA, EDO.MEX.", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 30740, moneda: "MXP" },
  { co: "ELIAS ESQUIVEL", o: "NEZAHUALCÓYOTL, CDMX", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 30740, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "TEXARCANA LAR", d: "LAREDO, TX", costo: 3600, moneda: "USD" },
  { co: "HUMBERTO SERVIN", o: "TLAQUEPAQUE, JAL", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 36540, moneda: "MXP" },
  { co: "JAVIER VILLARREAL", o: "PESQUERÍA, NL.", cd: "SCHUPAN", d: "KALAMAZOO, MI", costo: 5950, moneda: "USD" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "SCHUPAN OHIO", d: "HUBBARD, OHIO", costo: 6000, moneda: "USD" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "NIKKEI", d: "AGUASCALIENTES, AGS", costo: 30160, moneda: "MXP" },
  { co: "MEINSUR", o: "MÉRIDA, YUC.", cd: "ARZYZ", d: "APODACA, NL", costo: 61480, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "RECICLE", d: "AGUASCALIENTES, AGS", costo: 30740, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "FAGOR SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 26680, moneda: "MXP" },
  { co: "TORIBIO", o: "IXTAPALUCA, EDO. MEX.", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 30740, moneda: "MXP" },
  { co: "TORIBIO", o: "IXTAPALUCA, EDO. MEX.", cd: "ARZYZ", d: "APODACA, NL", costo: 38860, moneda: "MXP" },
  { co: "BRYANT CERVANTES", o: "TLAQUEPAQUE, JAL", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 36540, moneda: "MXP" },
  { co: "CESAR DELGADO", o: "TLAQUEPAQUE, JAL", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 36540, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "SCHUPAN MI", d: "KALAMAZOO, MI", costo: 5950, moneda: "USD" },
  { co: "HIGINIO", o: "APODACA, NL", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 9280, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "TEMPO", d: "RUSSELLVILLE, KY", costo: 4675, moneda: "USD" },
  { co: "BRYANT CERVANTES", o: "TLAQUEPAQUE, JAL", cd: "BMTY", d: "GRAL. ESCOBÉDO, NL", costo: 36540, moneda: "MXP" },
  { co: "BMTY", o: "GRAL. ESCOBÉDO, NL", cd: "FAGOR RAMOS", d: "RAMOS ARIZPE, COAH", costo: 30740, moneda: "MXP" },
  { co: "JERONIMO GENERAL METALES", o: "SAN LUIS POTOSÍ, SLP", cd: "EL TEJON SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 16750, moneda: "MXP" },
  { co: "JERONIMO GENERAL METALES", o: "SAN LUIS POTOSÍ, SLP", cd: "EL TEJON JAL", d: "TLAQUEPAQUE, JAL", costo: 16000, moneda: "MXP" },
  { co: "JERONIMO GENERAL METALES", o: "SAN LUIS POTOSÍ, SLP", cd: "RECICLE", d: "AGUASCALIENTES, AGS", costo: 15500, moneda: "MXP" },
  { co: "TORIBIO", o: "IXTAPALUCA, EDO. MEX.", cd: "EL TEJON", d: "TLAJOMULCO DE ZUÑIGA, JAL", costo: 30740, moneda: "MXP" },
  { co: "NOEMI", o: "TLAHUAC, EDO. MEX", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 30740, moneda: "MXP" },
  { co: "MARIO PADILLA", o: "JARDINES DE LA CALERA, JAL.", cd: "ALUMINUM DYNAMICS SLP", d: "SAN LUIS POTOSÍ, SLP", costo: 24940, moneda: "MXP" }
];

// Mapa de Cliente Destino -> Ciudad Destino Predeterminada
const CLIENTES_DESTINOS_MAP = {};
TARIFARIO_FLETES.forEach(r => {
  if (r.cd && r.d) {
    const keyNorm = r.cd.trim().toUpperCase();
    if (!CLIENTES_DESTINOS_MAP[keyNorm]) {
      CLIENTES_DESTINOS_MAP[keyNorm] = r.d;
    }
  }
});

// Mapa de Proveedor / Cliente Origen -> Ciudad Origen Predeterminada
const PROVEEDORES_ORIGENES_MAP = {};
TARIFARIO_FLETES.forEach(r => {
  if (r.co && r.o) {
    const keyNorm = r.co.trim().toUpperCase();
    if (!PROVEEDORES_ORIGENES_MAP[keyNorm]) {
      PROVEEDORES_ORIGENES_MAP[keyNorm] = r.o;
    }
  }
});

// Función de normalización de strings
function normalizarTextoFlete(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();
}

/**
 * Busca en el tarifario el costo de flete según el Origen, Destino y Negociación.
 */
function resolverTarifaFlete({ origen, destino, negociacion, clienteOrigen, clienteDestino }) {
  const coNorm = normalizarTextoFlete(clienteOrigen);
  const cdNorm = normalizarTextoFlete(clienteDestino);
  const negNorm = normalizarTextoFlete(negociacion || '');

  const BODEGA_MTY = "GRAL. ESCOBÉDO, NL";

  // REGLA NUEVA: "Directo entrega" -> Flete es $0
  if (negNorm.includes('DIRECTO ENTREGA') || negNorm === 'DIRECTO ENTREGA') {
    return { costo: 0, moneda: 'MXP', desc: 'Directo entrega (Flete $0)' };
  }

  const tarifario = (typeof window !== 'undefined' && Array.isArray(window.TARIFARIO_FLETES))
    ? window.TARIFARIO_FLETES
    : TARIFARIO_FLETES;

  const provMap = (typeof window !== 'undefined' && window.PROVEEDORES_ORIGENES_MAP)
    ? window.PROVEEDORES_ORIGENES_MAP
    : PROVEEDORES_ORIGENES_MAP;

  const cliMap = (typeof window !== 'undefined' && window.CLIENTES_DESTINOS_MAP)
    ? window.CLIENTES_DESTINOS_MAP
    : CLIENTES_DESTINOS_MAP;

  // 1. Resolver ciudad origen
  let oCiudad = normalizarTextoFlete(origen);
  if (!oCiudad && coNorm && provMap[coNorm]) {
    oCiudad = normalizarTextoFlete(provMap[coNorm]);
  }

  // 2. Resolver ciudad destino
  let dCiudad = normalizarTextoFlete(destino);
  if (!dCiudad && cdNorm && cliMap[cdNorm]) {
    dCiudad = normalizarTextoFlete(cliMap[cdNorm]);
  }

  // 3. Ajustar tramo de consulta según Negociación
  let oConsulta = oCiudad;
  let dConsulta = dCiudad;

  if (negNorm.includes('RECOLECCION MTY') || negNorm.includes('RECOLECCION BMTY') || negNorm === 'RECO MTY' || negNorm.includes('RECO MTY')) {
    dConsulta = normalizarTextoFlete(BODEGA_MTY);
  } else if (negNorm.includes('BMTY ENTREGA') || negNorm.includes('BMTY DESTINO') || negNorm.includes('BMTY ENTRE')) {
    oConsulta = normalizarTextoFlete(BODEGA_MTY);
  } else if (negNorm.includes('CONCEPTO 2')) {
    oConsulta = normalizarTextoFlete(BODEGA_MTY);
  }

  // 4. Si se especificó Cliente Origen Y Cliente Destino
  if (coNorm && cdNorm) {
    const matchAmbos = tarifario.find(r => {
      const matchCO = normalizarTextoFlete(r.co).includes(coNorm) || coNorm.includes(normalizarTextoFlete(r.co));
      const matchCD = normalizarTextoFlete(r.cd).includes(cdNorm) || cdNorm.includes(normalizarTextoFlete(r.cd));
      const matchO = !oConsulta || normalizarTextoFlete(r.o).includes(oConsulta) || oConsulta.includes(normalizarTextoFlete(r.o));
      const matchD = !dConsulta || normalizarTextoFlete(r.d).includes(dConsulta) || dConsulta.includes(normalizarTextoFlete(r.d));
      return matchCO && matchCD && matchO && matchD;
    });
    if (matchAmbos) return matchAmbos;
  }

  // 5. Si solo se especifica destino o negociación
  const matchRuta = tarifario.find(r => {
    const matchCD = cdNorm ? (normalizarTextoFlete(r.cd).includes(cdNorm) || cdNorm.includes(normalizarTextoFlete(r.cd))) : true;
    const matchO = !oConsulta || normalizarTextoFlete(r.o).includes(oConsulta) || oConsulta.includes(normalizarTextoFlete(r.o));
    const matchD = !dConsulta || normalizarTextoFlete(r.d).includes(dConsulta) || dConsulta.includes(normalizarTextoFlete(r.d));
    return matchCD && matchO && matchD;
  });
  if (matchRuta) return matchRuta;

  const matchCiudad = tarifario.find(r => {
    const matchO = !oConsulta || normalizarTextoFlete(r.o).includes(oConsulta) || oConsulta.includes(normalizarTextoFlete(r.o));
    const matchD = !dConsulta || normalizarTextoFlete(r.d).includes(dConsulta) || dConsulta.includes(normalizarTextoFlete(r.d));
    return matchO && matchD;
  });
  if (matchCiudad) return matchCiudad;

  return null;
}

/**
 * Obtiene la lista de destinos únicos disponibles para un cliente específico (Columna D -> Columna F)
 */
function obtenerDestinosPorCliente(cliente) {
  if (!cliente) return [];
  const cNorm = normalizarTextoFlete(cliente);
  const destinosSet = new Set();

  const tarifario = (typeof window !== 'undefined' && Array.isArray(window.TARIFARIO_FLETES))
    ? window.TARIFARIO_FLETES
    : TARIFARIO_FLETES;

  tarifario.forEach(r => {
    if (r.cd && r.d) {
      const cdNorm = normalizarTextoFlete(r.cd);
      if (cdNorm === cNorm || cdNorm.includes(cNorm) || cNorm.includes(cdNorm)) {
        destinosSet.add(r.d);
      }
    }
  });

  return Array.from(destinosSet);
}

/**
 * Actualiza el tarifario de fletes y reconstruye los mapas en tiempo de ejecución
 */
function actualizarTarifarioDinamico(nuevasTarifas) {
  if (!Array.isArray(nuevasTarifas) || nuevasTarifas.length === 0) return;
  window.TARIFARIO_FLETES = nuevasTarifas;
  
  const clientesMap = {};
  const proveedoresMap = {};

  nuevasTarifas.forEach(r => {
    if (r.cd && r.d) {
      const keyNorm = r.cd.trim().toUpperCase();
      if (!clientesMap[keyNorm]) clientesMap[keyNorm] = r.d;
    }
    if (r.co && r.o) {
      const keyNorm = r.co.trim().toUpperCase();
      if (!proveedoresMap[keyNorm]) proveedoresMap[keyNorm] = r.o;
    }
  });

  window.CLIENTES_DESTINOS_MAP = clientesMap;
  window.PROVEEDORES_ORIGENES_MAP = proveedoresMap;
}

if (typeof window !== 'undefined') {
  window.TARIFARIO_FLETES = TARIFARIO_FLETES;
  window.CLIENTES_DESTINOS_MAP = CLIENTES_DESTINOS_MAP;
  window.PROVEEDORES_ORIGENES_MAP = PROVEEDORES_ORIGENES_MAP;
  window.resolverTarifaFlete = resolverTarifaFlete;
  window.obtenerDestinosPorCliente = obtenerDestinosPorCliente;
  window.actualizarTarifarioDinamico = actualizarTarifarioDinamico;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TARIFARIO_FLETES,
    CLIENTES_DESTINOS_MAP,
    PROVEEDORES_ORIGENES_MAP,
    resolverTarifaFlete,
    obtenerDestinosPorCliente,
    actualizarTarifarioDinamico,
    normalizarTextoFlete
  };
}
