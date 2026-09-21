const MATERIALES_POR_CATEGORIA = {
  "Aluminio": [
    "ALUMINIO SERIE 1000",
    "ALUMINIO BLANDO",
    "ALUMINIO 1070",
    "ALUMINIO 1100",
    "ALUMINIO 3003",
    "RECORTES DE ALUMINIO 3003 CON SILICÓN",
    "ALUMINIO SERIE 5000",
    "ALUMINIO SERIE 5000 CON POLIETILENO",
    "ALUMINIO 5052",
    "ALUMINIO 5083",
    "ALUMINIO MIXTO 5000-3000",
    "ALUMINIO MIXTO 5000-6000",
    "ALUMINIO 6061",
    "ALUMINIO 6063 LIMPIO",
    "ALUMINIO 6063 PINTADO",
    "ALUMINIO 95/5",
    "ALUMINIO TAINT TABOR",
    "CHATARRA DE ALUMINIO",
    "CHATARRA MLC",
    "MACIZO",
    "CABLE DE ALUMINIO EC",
    "CABLE TRITURADO",
    "REBABA DE ALUMINIO",
    "RIN DE ALUMINIO",
    "RIN DE ALUMINIO CHICO",
    "RIN DE ALUMINIO GRANDE",
    "RIN DE ALUMINIO CROMADO",
    "RIN DE MOTO",
    "RADIADORES DE ALUMINIO",
    "PERFIL PEDACERÍA",
    "SPRAY",
    "TRASTE",
    "TUBO",
    "BOTE",
    "UBC"
  ],
  "Cobre": [
    "CABLE DE COBRE",
    "COBRE DE 1RA",
    "COBRE BRILLOSO",
    "COBRE DE 2DA / BIRCH / CLIFF",
    "COBRE ESTAÑADO",
    "COBRE REBABA",
    "VARILLAS DE COBRE",
    "COBRE CANDY",
    "RADIADORES DE COBRE/ALUMINIO",
    "RADIADORES DE COBRE/BRONCE"
  ],
  "Bronce": [
    "BRONCE AMARILLO",
    "BRONCE REBABA",
    "BRONCE ROJO"
  ],
  "Otros": [
    "ACERO INOXIDABLE 304",
    "ACERO INOXIDABLE 316",
    "ACERO INOXIDABLE 430",
    "REBABA DE ACERO INOXIDABLE 304",
    "REBABA DE ACERO INOXIDABLE 430",
    "REBABA DE ACERO",
    "PLOMO BLANDO",
    "ANTIMONIO",
    "DIECAST DE ZINC",
    "MAGNESIO",
    "COMPRESORES",
    "MATERIALES VARIOS",
    "CHATARRA GENERAL"
  ]
};

const todosLosMateriales = Object.values(MATERIALES_POR_CATEGORIA).flat();

const optionsMaterialTerrestre = todosLosMateriales;
const optionsMaterialMaritimo  = todosLosMateriales;
const optionsMaterialNacional   = todosLosMateriales;

// Lista oficial de proveedores (Columna A del tarifario de fletes en Google Sheets)
const listaProveedoresColumnaA = [
  "BMTY",
  "BRYANT CERVANTES",
  "CESAR DELGADO",
  "CESAR DELGADO AGS",
  "DAVID BORJA HEREDIA",
  "DIEGO GARZA",
  "EDUARDO PALOMO",
  "ELIAS ESQUIVEL",
  "FAGOR SLP",
  "HIGINIO",
  "HORACIO SERVIN",
  "HUMBERTO SERVIN",
  "JAVIER VILLARREAL",
  "JERONIMO GENERAL METALES",
  "JOSE LUIS MARTINEZ",
  "JRG",
  "LUIS TORRES",
  "MARIO PADILLA",
  "MEINSUR",
  "METAL EUTECTIC",
  "NOEMI",
  "PACO MARTINEZ",
  "RECICLE",
  "RECIMETSA",
  "TOÑO MORADO",
  "TORIBIO",
  "VALENTIN"
];

// Proveedores del bloque "PROVEEDORES ENT. DIR" de la hoja CAT. No aparecen en el
// tarifario de fletes, asi que no tienen origen: la negociacion es siempre DIRECTO ENTREGA.
// DIEGO GARZA queda fuera a proposito: si tiene origen en el tarifario (NASH TX).
const listaProveedoresEntregaDirecta = [
  "CALDERA",
  "JORGE MEDINA",
  "JORGE CARDENAS",
  "LUIS GARCÍA",
  "LUIS ROMO",
  "MARIO VAZQUEZ",
  "MARIELENA MÉNDEZ"
];

function esProveedorEntregaDirecta(proveedor) {
  if (!proveedor) return false;
  const pNorm = proveedor.trim().toUpperCase();
  return listaProveedoresEntregaDirecta.some(p => p.toUpperCase() === pNorm);
}

// Lista oficial de clientes (EXCLUSIVAMENTE Columna D del tarifario de fletes en Google Sheets)
const listaClientesColumnaD = [
  "ALUMINUM DYNAMICS MS",
  "ALUMINUM DYNAMICS SLP",
  "ALUMM",
  "ARZYZ",
  "ARZYZ NL",
  "BMTY",
  "CESAR GARZA",
  "COMERCIALIZADORA REIN",
  "EL TEJON",
  "EL TEJON JAL",
  "EL TEJON SLP",
  "FAGOR RAMOS",
  "FAGOR SLP",
  "FAGOR TEPEJI",
  "INTRAMETCO",
  "JRG MTY",
  "JRG SLP",
  "JRG TEZO",
  "LIZHONG",
  "LUIS TORRES",
  "NIKKEI",
  "OMC",
  "RECICLE",
  "RECIMETSA",
  "REGEN",
  "SCHUPAN",
  "SCHUPAN MI",
  "SCHUPAN OHIO",
  "SIDELL USA",
  "TEMPO",
  "TEXARCANA",
  "TEXARCANA LAR",
  "TEXARCANA TX",
  "TOBI"
];

// Alias para compatibilidad
const listaClientesColumnaC = listaClientesColumnaD;

// Clientes que solo existen para exportacion (segunda columna del sheet, todos "i")
const listaClientesExportacionExtra = [
  "ALA IBNTERNATIONAL",
  "ARDOUR WORLD LIMITED",
  "CNA",
  "COREMET TRADING, INC",
  "GMI",
  "GREEN METALS",
  "INTERNATIONAL MATERIALS",
  "KATAMAN",
  "MADHU MULTI TRADING",
  "NOVELIS",
  "ORYX",
  "REINOXMETAL",
  "ROYCE CORP",
  "TANGENT",
  "UCIN"
];

// Clasificacion i/n del sheet: "i" = internacional (exportacion), "n" = nacional.
// Las claves van normalizadas (trim + mayusculas).
const CLIENTES_TIPO = {
  // Internacionales (exportacion: maritimo y terrestre)
  "ALUMINUM DYNAMICS MS": "i",
  "INTRAMETCO": "i",
  "OMC": "i",
  "REGEN": "i",
  "SCHUPAN": "i",
  "SCHUPAN MI": "i",
  "SCHUPAN OHIO": "i",
  "SIDELL USA": "i",
  "TEMPO": "i",
  "TEXARCANA": "i",
  "TEXARCANA LAR": "i",
  "TEXARCANA TX": "i",
  // Nacionales
  "ALUMINUM DYNAMICS SLP": "n",
  "ALUMM": "n",
  "ARZYZ": "n",
  "ARZYZ NL": "n",
  "BMTY": "n",
  "CESAR GARZA": "n",
  "COMERCIALIZADORA REIN": "n",
  "EL TEJON": "n",
  "EL TEJON JAL": "n",
  "EL TEJON SLP": "n",
  "FAGOR RAMOS": "n",
  "FAGOR SLP": "n",
  "FAGOR TEPEJI": "n",
  "JRG MTY": "n",
  "JRG SLP": "n",
  "JRG TEZO": "n",
  "LUIS TORRES": "n",
  "NIKKEI": "n",
  "RECICLE": "n",
  "RECIMETSA": "n",
  "TOBI": "n"
};

// Los extras de exportacion se marcan "i" sin repetirlos a mano
listaClientesExportacionExtra.forEach(c => { CLIENTES_TIPO[c.trim().toUpperCase()] = "i"; });

function tipoCliente(cliente) {
  if (!cliente) return null;
  return CLIENTES_TIPO[cliente.trim().toUpperCase()] || null;
}

// Sin clasificacion => se deja pasar en ambas modalidades (no perder clientes nuevos del tarifario)
function esClienteExportacion(cliente) {
  return tipoCliente(cliente) !== "n";
}

function esClienteNacional(cliente) {
  return tipoCliente(cliente) !== "i";
}

// Lista oficial de destinos (Columna F del tarifario de fletes en Google Sheets)
const listaDestinosColumnaF = [
  "AGUASCALIENTES, AGS",
  "APODACA, NL",
  "CD.MITRAS, N.L.",
  "COLUMBUS, MS",
  "GRAL. ESCOBÉDO, NL",
  "HUBBARD, OHIO",
  "KALAMAZOO, MI",
  "LA LADRILLERA, NL.",
  "LAREDO, TX",
  "NASH, TX",
  "PESQUERÍA, NL",
  "POZA RICA, VER.",
  "RAMOS ARIZPE, COAH",
  "RUSSELLVILLE, KY",
  "SALINAS VICTORIA, NL",
  "SAN JOSE DEL VERDE, JAL",
  "SAN LUIS POTOSÍ, SLP",
  "TEPEJI, HIDALGO",
  "TEXARKANA, TX",
  "TEZOYUCA, EDOMEX",
  "TLAJOMULCO DE ZUÑIGA, JAL",
  "TLAQUEPAQUE, JAL"
];

// Alias para compatibilidad
const listaDestinosColumnaD = listaDestinosColumnaF;

function esDestinoNacional(destino) {
  if (!destino) return false;
  const dUpper = destino.toUpperCase();
  const esInternacional =
    dUpper.includes(', TX') ||
    dUpper.includes(', KY') ||
    dUpper.includes(', MS') ||
    dUpper.includes(', MI') ||
    dUpper.includes(', OHIO') ||
    dUpper.includes('ALABAMA') ||
    dUpper.includes('MICHIGAN') ||
    dUpper.includes('USA') ||
    dUpper.includes('KOREA') ||
    dUpper.includes('CHINA') ||
    dUpper.includes('INDIA') ||
    dUpper.includes('PAKISTAN') ||
    dUpper.includes('TURKEY') ||
    dUpper.includes('ROTTERDAM') ||
    dUpper.includes('ANTWERP') ||
    dUpper.includes('CÁDIZ');
  return !esInternacional;
}

function clienteTieneDestinoNacional(cliente) {
  if (!cliente) return false;
  const cNorm = cliente.trim().toUpperCase();
  const clientesConDestinoNacionalList = [
    "ALA GROUP", "ALRETECH", "ALUM POZA RICA", "ALUMINUM DYNAMICS CONSTRUCTION ENTRANCE",
    "ARZYZ", "CNA", "COMERCIALIZADORA REIN", "COREMET", "CUPRITA", "EL TEJON", "GMI",
    "GREEN METALS", "GWECO", "INFINITY METALS", "INTERNATIONAL MATERIALS", "INTRAMETCO",
    "JRG", "METALES HAUS", "NASA", "NIKKEI", "NOVELIS", "OMC", "RECICLE", "RECIMETSA",
    "RECMAT", "REGEN", "REINOXMETAL", "ROYCE", "SIDELL SCRAP", "TANGENT", "TOBI", "UCIN",
    "VENUS", "WF TRADING"
  ];
  return clientesConDestinoNacionalList.includes(cNorm);
}

function esDestinoExportacion(destino) {
  return !esDestinoNacional(destino);
}

if (typeof window !== 'undefined') {
  window.MATERIALES_POR_CATEGORIA = MATERIALES_POR_CATEGORIA;
  window.esDestinoNacional = esDestinoNacional;
  window.esDestinoExportacion = esDestinoExportacion;
  window.clienteTieneDestinoNacional = clienteTieneDestinoNacional;
  window.esClienteNacional = esClienteNacional;
  window.esClienteExportacion = esClienteExportacion;
  window.CLIENTES_TIPO = CLIENTES_TIPO;
  window.tipoCliente = tipoCliente;
  window.esProveedorEntregaDirecta = esProveedorEntregaDirecta;
  window.listaProveedoresEntregaDirecta = listaProveedoresEntregaDirecta;
}

// Exclusivamente los proveedores del Google Sheet (columna A + hoja CAT)
const optionsProveedorTerrestre = [...listaProveedoresColumnaA, ...listaProveedoresEntregaDirecta];
const optionsProveedorMaritimo  = [...listaProveedoresColumnaA, ...listaProveedoresEntregaDirecta];
const optionsProveedorNacional   = [...listaProveedoresColumnaA, ...listaProveedoresEntregaDirecta];

// Catalogo completo: Columna D + los clientes que solo existen para exportacion
const listaClientesTodos = [...listaClientesColumnaD, ...listaClientesExportacionExtra];

// Clientes en Venta Terrestre (Exportación) — solo los marcados "i"
const optionsClientesTerrestre = listaClientesTodos.filter(esClienteExportacion).sort();

// Clientes en Venta Marítimo (Exportación) — solo los marcados "i"
const optionsClientesMaritimo  = listaClientesTodos.filter(esClienteExportacion).sort();

// Clientes en Venta Nacional — solo los marcados "n"
const optionsClientesNacional = listaClientesTodos.filter(esClienteNacional).sort();

// Destinos por modalidad (Nacional vs. Exportación)
const optionsDestinoNacional   = listaDestinosColumnaD.filter(esDestinoNacional);
const optionsDestinoTerrestre = listaDestinosColumnaD.filter(esDestinoExportacion);
const optionsDestinoMaritimo  = ["ALGECIRAS", "BUSAN, KOREA", "CHENNAI PORT, INDIA", "DAMAIYU PORT, CHINA", "HARBOUR ROTTERDAM", "HOUSTON, TX", "LAEM CHABANG", "LIANHUASHAN, CHINA", "MUNDRA, INDIA", "NEW ORLEANS", "NHAVA SHEVA PORT", "OITA", "PORT QASIM, PAKISTAN", "SAN ROQUE, CÁDIZ", "SAVANNAH OR NEW ORLE", "PUERTO DE BILBAO – E", "QASIM PORT, PAKISTAN", "YILPORT GEBZE TURKEY", "ANTWERP", "MUNDRA", "NHAVA SHEVA", "SANTOS, BZ", "LAREDO, TX", "HUASHAN, CHINA", "JAPENESE PORT"].filter(esDestinoExportacion);
