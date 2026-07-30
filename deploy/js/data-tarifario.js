// Proveedores sin tarifas cargadas: aparecen en el dropdown pero no tienen rutas aún
const TARIFARIO_PROVEEDORES_EXTRA = ['RAD', 'MAERSK', 'CMA CGM'];

const TARIFARIO_DATA = [
  // GWT — MÉRIDA (PROGRESO)
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Bilbao',pais:'España',nav:'CMA',tt:'38-45 días',via:'Caucedo/Rotterdam',eq:"20' DC",tipo:null,of:2701,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Bilbao',pais:'España',nav:'CMA',tt:'38-45 días',via:'Caucedo/Rotterdam',eq:"40' HC",tipo:null,of:2874,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Algeciras',pais:'España',nav:'CMA',tt:'46 días',via:'Tánger',eq:"20' DC",tipo:null,of:2229,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Algeciras',pais:'España',nav:'CMA',tt:'46 días',via:'Tánger',eq:"40' HC",tipo:null,of:2345,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Santos',pais:'Brasil',nav:'CMA',tt:'42 días',via:'Kingston',eq:"20' DC",tipo:null,of:1510,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Santos',pais:'Brasil',nav:'CMA',tt:'42 días',via:'Kingston',eq:"40' HC",tipo:null,of:1805,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Barranquilla',pais:'Colombia',nav:'CMA',tt:'20 días',via:'Kingston/Cartagena',eq:"20' DC",tipo:null,of:1502,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Barranquilla',pais:'Colombia',nav:'CMA',tt:'20 días',via:'Kingston/Cartagena',eq:"40' HC",tipo:null,of:2114,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Manzanillo PA',pais:'Panamá',nav:'CMA',tt:'15 días',via:'Kingston',eq:"20' DC",tipo:null,of:1727,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Manzanillo PA',pais:'Panamá',nav:'CMA',tt:'15 días',via:'Kingston',eq:"40' HC",tipo:null,of:2539,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Incheon',pais:'Korea',nav:'CMA',tt:'71-74 días',via:'Kingston/Ningbo',eq:"20' DC",tipo:null,of:1590,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Incheon',pais:'Korea',nav:'CMA',tt:'71-74 días',via:'Kingston/Ningbo',eq:"40' HC",tipo:null,of:1575,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Busan',pais:'Korea',nav:'CMA',tt:'60 días',via:'Kingston',eq:"20' DC",tipo:null,of:1360,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Busan',pais:'Korea',nav:'CMA',tt:'60 días',via:'Kingston',eq:"40' HC",tipo:null,of:1210,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Gaoming',pais:'China',nav:'CMA',tt:'50-57 días',via:'Kingston/Shekou',eq:"20' DC",tipo:null,of:1460,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Gaoming',pais:'China',nav:'CMA',tt:'50-57 días',via:'Kingston/Shekou',eq:"40' HC",tipo:null,of:1335,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Laem Chabang',pais:'Tailandia',nav:'CMA',tt:'47-69 días',via:'Singapore',eq:"20' DC",tipo:null,of:1785,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Laem Chabang',pais:'Tailandia',nav:'CMA',tt:'47-69 días',via:'Singapore',eq:"40' HC",tipo:null,of:1835,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Ningbo',pais:'China',nav:'CMA',tt:'61 días',via:'Kingston',eq:"20' DC",tipo:null,of:1460,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Ningbo',pais:'China',nav:'CMA',tt:'61 días',via:'Kingston',eq:"40' HC",tipo:null,of:1335,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Osaka',pais:'Japón',nav:'CMA',tt:'59-65 días',via:'Kingston/Busan',eq:"20' DC",tipo:null,of:2447,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Osaka',pais:'Japón',nav:'CMA',tt:'59-65 días',via:'Kingston/Busan',eq:"40' HC",tipo:null,of:1652,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Pasir Gudang',pais:'Malasia',nav:'CMA',tt:'49-53 días',via:'Kingston/Singapore',eq:"20' DC",tipo:null,of:1735,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Pasir Gudang',pais:'Malasia',nav:'CMA',tt:'49-53 días',via:'Kingston/Singapore',eq:"40' HC",tipo:null,of:1685,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Yokohama',pais:'Japón',nav:'CMA',tt:'57 días',via:'Kingston/Singapore',eq:"20' DC",tipo:null,of:2732,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Yokohama',pais:'Japón',nav:'CMA',tt:'57 días',via:'Kingston/Singapore',eq:"40' HC",tipo:null,of:1677,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Nhava Sheva',pais:'India',nav:'CMA',tt:'61-70 días',via:'Kingston/Singapore',eq:"20' DC",tipo:null,of:2775,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Nhava Sheva',pais:'India',nav:'CMA',tt:'61-70 días',via:'Kingston/Singapore',eq:"40' HC",tipo:null,of:2410,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Mundra',pais:'India',nav:'CMA',tt:'67-73 días',via:'Kingston/Singapore',eq:"20' DC",tipo:null,of:2396,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Mundra',pais:'India',nav:'CMA',tt:'67-73 días',via:'Kingston/Singapore',eq:"40' HC",tipo:null,of:2110,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Chennai',pais:'India',nav:'CMA',tt:'60 días',via:'Kingston/Singapore',eq:"20' DC",tipo:null,of:3130,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Chennai',pais:'India',nav:'CMA',tt:'60 días',via:'Kingston/Singapore',eq:"40' HC",tipo:null,of:3085,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Rotterdam',pais:'Países Bajos',nav:'CMA',tt:'25-29 días',via:'Caucedo',eq:"20' DC",tipo:null,of:1970,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Rotterdam',pais:'Países Bajos',nav:'CMA',tt:'25-29 días',via:'Caucedo',eq:"40' HC",tipo:null,of:2108,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Antwerp',pais:'Bélgica',nav:'CMA',tt:'34 días',via:'Caucedo',eq:"20' DC",tipo:null,of:1801,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'Antwerp',pais:'Bélgica',nav:'CMA',tt:'34 días',via:'Caucedo',eq:"40' HC",tipo:null,of:1855,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'New Orleans',pais:'USA',nav:'MAERSK',tt:'10 días',via:'Directo',eq:"20' DC",tipo:null,of:1594,dlo:14,dld:14},
  {p:'GWT',o:'Mérida',pol:'Progreso',pod:'New Orleans',pais:'USA',nav:'MAERSK',tt:'10 días',via:'Directo',eq:"40' HC",tipo:null,of:1644,dlo:14,dld:14},
  // GWT — QUERÉTARO (ALTAMIRA)
  {p:'GWT',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'45-49 días',via:'Rotterdam',eq:"20' DC",tipo:'Full',of:2908.8,dlo:14,dld:14},
  {p:'GWT',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'45-49 días',via:'Rotterdam',eq:"40' HC",tipo:'Full',of:3089.8,dlo:14,dld:14},
  {p:'GWT',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'45-49 días',via:'Rotterdam',eq:"20' DC",tipo:'Sencillo',of:3568.8,dlo:14,dld:14},
  {p:'GWT',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'45-49 días',via:'Rotterdam',eq:"40' HC",tipo:'Sencillo',of:3749.8,dlo:14,dld:14},
  // GWT — MEXICALI (ENSENADA)
  {p:'GWT',o:'Mexicali',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"20' DC",tipo:'Full',of:1770,dlo:21,dld:14},
  {p:'GWT',o:'Mexicali',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"40' HC",tipo:'Full',of:1750,dlo:21,dld:14},
  {p:'GWT',o:'Mexicali',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"20' DC",tipo:'Sencillo',of:2190,dlo:21,dld:14},
  {p:'GWT',o:'Mexicali',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"40' HC",tipo:'Sencillo',of:2170,dlo:21,dld:14},
  // GWT — TIJUANA (ENSENADA)
  {p:'GWT',o:'Tijuana',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"20' DC",tipo:'Full',of:1477,dlo:21,dld:14},
  {p:'GWT',o:'Tijuana',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"40' HC",tipo:'Full',of:1453,dlo:21,dld:14},
  {p:'GWT',o:'Tijuana',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"20' DC",tipo:'Sencillo',of:1777,dlo:21,dld:14},
  {p:'GWT',o:'Tijuana',pol:'Ensenada',pod:'Busan',pais:'Korea',nav:'CMA',tt:'63-72 días',via:'Manzanillo',eq:"40' HC",tipo:'Sencillo',of:1753,dlo:21,dld:14},
  // AMERICARGO — GUADALAJARA (ALTAMIRA)
  {p:'AMERICARGO',o:'Guadalajara',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"20' DC",tipo:'Full',of:3378,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Guadalajara',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"40' HC",tipo:'Full',of:3648,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Guadalajara',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"20' DC",tipo:'Sencillo',of:4364,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Guadalajara',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"40' HC",tipo:'Sencillo',of:4634,dlo:21,dld:14},
  // AMERICARGO — MONTERREY (ALTAMIRA)
  {p:'AMERICARGO',o:'Monterrey',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"20' DC",tipo:'Full',of:2554,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Monterrey',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"40' HC",tipo:'Full',of:2824,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Monterrey',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"20' DC",tipo:'Sencillo',of:3128,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Monterrey',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"40' HC",tipo:'Sencillo',of:3396,dlo:21,dld:14},
  // AMERICARGO — QUERÉTARO (ALTAMIRA)
  {p:'AMERICARGO',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"20' DC",tipo:'Full',of:3378,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"40' HC",tipo:'Full',of:3648,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"20' DC",tipo:'Sencillo',of:4387,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Querétaro',pol:'Altamira',pod:'Algeciras',pais:'España',nav:'CMA',tt:'30 días',via:'Cartagena',eq:"40' HC",tipo:'Sencillo',of:4657,dlo:21,dld:14},
  // AMERICARGO — MÉRIDA (PROGRESO)
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Busan',pais:'Korea',nav:'MAERSK',tt:'45 días',via:'Directo',eq:"20' DC",tipo:null,of:850,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Busan',pais:'Korea',nav:'MAERSK',tt:'45 días',via:'Directo',eq:"40' HC",tipo:null,of:850,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Nhava Sheva',pais:'India',nav:'CMA CGM',tt:'90 días',via:'Kingston',eq:"40' HC",tipo:null,of:2395,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Mundra',pais:'India',nav:'CMA CGM',tt:'90 días',via:'Kingston',eq:"40' HC",tipo:null,of:2070,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Rotterdam',pais:'Países Bajos',nav:'CMA CGM',tt:'30 días',via:'Caucedo',eq:"40' HC",tipo:null,of:1931.2,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Algeciras',pais:'España',nav:'CMA CGM',tt:'27 días',via:'Kingston',eq:"40' HC",tipo:null,of:2211.2,dlo:21,dld:14},
  {p:'AMERICARGO',o:'Mérida',pol:'Progreso',pod:'Damaiyu',pais:'China',nav:'MSC',tt:'45 días',via:'Ningbo',eq:"40' HC",tipo:null,of:5551,dlo:21,dld:14},
];

// Despacho + arrastre por puerto de salida (MXN). Fuente: TARIFARIO MENSUAL SIDELL LOGISTICS.xlsx
// Los valores dependen solo del POL: el xlsx repite los mismos dos juegos en sus 72 filas.
const DESPACHO_POR_POL = {
  'Progreso': { ped: 846,  man: 2678, hon: 4500, val: 300, cove: 150, arr: 4500 },
  '_default': { ped: 1010, man: 2900, hon: 5000, val: 300, cove: 150, arr: 0    }, // Altamira / Ensenada
};

// Desglose + totales de despacho para un POL. Las sumas se calculan, no se hardcodean.
function calcDespacho(pol) {
  const d = DESPACHO_POR_POL[pol] || DESPACHO_POR_POL['_default'];
  const totalAA = d.ped + d.man + d.hon + d.val + d.cove;  // xlsx col W = SUM(R:V)
  return { ...d, totalAA, total: totalAA + d.arr };         // xlsx col Z = R+S+T+U+V+X
}
