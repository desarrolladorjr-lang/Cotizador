var CLIENT_ID = '65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com';
var DOMINIO_PERMITIDO = 'sidellscrap.com';

// Destino de la captura del cotizador: EXPORTACIONES 2026, hoja LOGÍSTICA.
// Antes eran 5 hojas (Terrestre/Marítimo/Nacional/Compras/Inventarios) en el
// spreadsheet 12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A; ahora todas las
// modalidades escriben la misma fila y se distinguen por la columna SEGMENTO.
var CAPTURA_SPREADSHEET_ID = '14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc';
var CAPTURA_SHEET_NAME = 'INSTRUCCIONES';

// Orden exacto de las columnas de LOGÍSTICA. Contrato con doPost: si cambia
// aquí, cambia el arreglo `row`.
var CAPTURA_TITULOS = [
  'FECHA ', 'USUARIO', 'SEGMENTO', 'PROVEEDOR', 'CLIENTE', 'DESTINO',
  'CARGAS', 'KG OC', 'MATERIAL', 'EMBALAJE', 'NEGOCIACION',
  'TC. BANCO', 'TC. SEGURO', 'DÍAS CREDITO', '% FIJ', 'FIX P',
  'PC VENTA', 'PC COMPRA', 'PPAC PROV', 'FLETE NAC.', 'FLETE INT.',
  'OCEANS', 'MERMA %', 'ESTATUS', 'UT NETA', 'OBSERVACIONES'
];

// Verifica el id_token de Google Sign-In contra el endpoint de Google.
//
// El cliente ya filtra por dominio en handleCredentialResponse, pero esa comprobacion
// vive en el navegador: la URL de este script es publica y cualquiera puede POSTear
// directo. Esta es la comprobacion que cuenta.
//
// Devuelve el correo verificado, o null si el token no sirve.
function validarCredencial(credential) {
  if (!credential) return null;

  var resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
    { muteHttpExceptions: true }
  );
  // Google devuelve 400 para tokens malformados, con firma invalida o expirados.
  if (resp.getResponseCode() !== 200) return null;

  var info = JSON.parse(resp.getContentText());
  if (info.aud !== CLIENT_ID) return null;
  if (String(info.email_verified) !== 'true') return null;
  if (!info.email || info.email.split('@')[1] !== DOMINIO_PERMITIDO) return null;

  return info.email;
}

// ---------------------------------------------------------------------------
// SESION PROPIA
//
// El id_token de Google dura ~1 hora, y renovarlo obliga a mostrar la tarjeta de
// One Tap: el operador quedaba fuera a media captura. Aqui el id_token se valida
// UNA vez y a cambio se emite un token propio, firmado con HMAC-SHA256 y con
// vigencia larga. Solo este script conoce el secreto, asi que el token no se puede
// fabricar desde el navegador.
// ---------------------------------------------------------------------------

var SESION_DURACION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// El secreto vive en Script Properties, no en el codigo: el codigo se copia a
// mano y acabaria en el repo. Se genera solo la primera vez.
function secretoSesion() {
  var props = PropertiesService.getScriptProperties();
  var secreto = props.getProperty('SESION_SECRETO');
  if (!secreto) {
    secreto = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESION_SECRETO', secreto);
  }
  return secreto;
}

function firmarSesion(texto) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(texto, secretoSesion())
  );
}

// Comparacion sin salida temprana: no revela por donde empieza a fallar la firma.
function igualdadConstante(a, b) {
  if (a.length !== b.length) return false;
  var dif = 0;
  for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function emitirTokenSesion(correo) {
  var cuerpo = Utilities.base64EncodeWebSafe(JSON.stringify({
    email: correo,
    exp: Date.now() + SESION_DURACION_MS
  }));
  return cuerpo + '.' + firmarSesion(cuerpo);
}

// Devuelve el correo del token, o null si la firma no cuadra o ya vencio.
function validarTokenSesion(token) {
  if (!token || typeof token !== 'string') return null;
  var partes = token.split('.');
  if (partes.length !== 2) return null;
  if (!igualdadConstante(partes[1], firmarSesion(partes[0]))) return null;

  var datos;
  try {
    datos = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString()
    );
  } catch (err) {
    return null;
  }
  if (!datos.exp || datos.exp < Date.now()) return null;
  // El dominio se revalida aqui: si alguien sale de la empresa, el token viejo
  // sigue firmado, pero al menos nunca sirve para otro dominio.
  if (!datos.email || datos.email.split('@')[1] !== DOMINIO_PERMITIDO) return null;
  return datos.email;
}

// Resuelve el autor de un POST: primero el token propio (camino normal), y si no
// hay, el id_token de Google (primer acceso o token propio vencido).
// Devuelve { email, tokenNuevo } — tokenNuevo solo cuando se acaba de emitir.
function autenticarPeticion(data) {
  var correo = validarTokenSesion(data.sesion);
  if (correo) return { email: correo, tokenNuevo: null };

  correo = validarCredencial(data.credential);
  if (!correo) return null;
  return { email: correo, tokenNuevo: emitirTokenSesion(correo) };
}

// ---------------------------------------------------------------------------
// AVISO POR CORREO
//
// Cada captura se avisa por correo con todo lo capturado. Las claves salen del
// payload que arma deploy/js/payload.js: si cambian alla, cambian aqui.
//
// La version anterior de esta funcion vivia en OTRO archivo del proyecto de Apps
// Script y leia claves que el cotizador dejo de mandar, asi que la tabla llegaba
// en blanco. Al mudarla aqui, el correo y el payload viajan juntos en el repo.
// ---------------------------------------------------------------------------

// Varios destinatarios: separalos con coma.
var CORREO_DESTINO = 'desarrolladorjr@sidellscrap.com';

// Inventarios compra para bodega propia: no hay venta, y el cotizador manda los
// campos de venta con lo ultimo que hubiera en pantalla. La hoja ya los deja
// vacios (ver el arreglo `row` de doPost) y el correo hace lo mismo. Se acepta
// 'Compras' porque asi se etiquetaba antes.
function esConVenta(modalidad) {
  return modalidad !== 'Inventarios' && modalidad !== 'Compras';
}

// Nacional vende en pesos: no hay indexacion LME (% fijacion / fix price), ni
// tipo de cambio, ni dias de credito. El cotizador manda esos campos con lo
// ultimo que quedo en pantalla, asi que hay que apagarlos aqui o la hoja guarda
// un TC que nadie uso y el tablero lo lee como dato.
function usaFijacionYTc(modalidad) {
  return esConVenta(modalidad) && modalidad !== 'Nacional';
}

// El payload manda 0 en las columnas que la modalidad no usa (fleteInt en
// nacional, oceans en terrestre...). Un 0 en la hoja se lee como dato; vacio no.
function sinCero(valor) {
  return Number(valor) === 0 ? '' : valor;
}

// [clave del payload, etiqueta, tipo, omitirSiCero, soloConVenta, soloConTc].
//
// tipo: texto | numero | moneda | porcentaje.
// omitirSiCero: el payload manda 0 cuando la modalidad no usa el campo (oceans en
//   Terrestre, fleteInt en Nacional…); sin esto el correo enseña "$0.00" en
//   renglones que no aplican.
// soloConVenta: campo que la hoja deja vacío en Inventarios (ver esConVenta).
// soloConTc: campo que Nacional tampoco usa — vende en pesos, sin indexación ni
//   tipo de cambio (ver usaFijacionYTc).
var CORREO_SECCIONES = [
  { titulo: 'Operación', campos: [
    ['fecha', 'Fecha', 'texto'],
    ['usuario', 'Capturó', 'texto'],
    ['modalidad', 'Modalidad', 'texto'],
    ['cliente', 'Cliente', 'texto'],
    ['proveedor', 'Proveedor', 'texto'],
    ['material', 'Material', 'texto'],
    ['cargas', 'Cargas', 'numero'],
    ['kgOc', 'KG OC', 'numero'],
    ['destino', 'Destino', 'texto'],
    ['origenEmbarque', 'Origen de embarque', 'texto'],
    ['embalaje', 'Embalaje', 'texto'],
    ['negociacion', 'Negociación', 'texto']
  ]},
  { titulo: 'Venta', soloConVenta: true, campos: [
    ['precioVenta', 'Precio de venta', 'moneda'],
    ['porcentajeFijacion', '% Fijación', 'porcentaje', false, false, true],
    ['fixPrice', 'Fix Price', 'moneda', false, false, true],
    ['tcHoy', 'TC Banco', 'moneda', false, false, true],
    ['tcSeguro', 'TC Seguro', 'moneda', false, false, true],
    ['diasCredito', 'Días de crédito', 'numero', true, false, true]
  ]},
  { titulo: 'Compra y costos', campos: [
    ['ppProv', 'PPAC Proveedor', 'moneda'],
    ['precioCompraMxn', 'Compra total', 'moneda'],
    ['precioTopeCompra', 'Precio tope de compra', 'moneda', false, true],
    ['fleteNac', 'Flete nacional', 'moneda'],
    ['fleteInt', 'Flete internacional', 'moneda', true],
    ['oceans', 'Oceans', 'moneda', true],
    ['merma', 'Merma', 'porcentaje'],
    ['origenFlete', 'Origen del flete', 'texto'],
    ['destinoFlete', 'Destino del flete', 'texto']
  ]},
  { titulo: 'Resultado', campos: [
    ['status', 'Estatus', 'texto'],
    ['utilidadNeta', 'Utilidad neta', 'moneda', false, true],
    ['tipoCompra', 'Tipo de compra', 'texto'],
    ['contrato', 'N° de contrato', 'texto'],
    ['notas', 'Observaciones', 'texto']
  ]}
];

function correoEscapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 1234.5 -> "1,234.50". Apps Script no trae Intl.NumberFormat confiable.
function correoNumero(n, decimales) {
  var partes = n.toFixed(decimales).split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return partes.join('.');
}

function correoValor(valor, tipo) {
  if (tipo === 'texto') return correoEscapar(valor);
  var n = Number(valor);
  // Un numero que no lo es se muestra tal cual en vez de "NaN".
  if (!isFinite(n)) return correoEscapar(valor);
  if (tipo === 'moneda') return '$' + correoNumero(n, 2);
  if (tipo === 'porcentaje') return correoNumero(n, 2) + ' %';
  return correoNumero(n, n % 1 === 0 ? 0 : 2);
}

// Los campos vacios se omiten (una modalidad no usa los de otra). El 0 sí se
// muestra: "utilidad 0" es un dato, no un hueco.
function correoFilas(data, campos) {
  var conVenta = esConVenta(data.modalidad);
  var conTc = usaFijacionYTc(data.modalidad);
  var filas = '';
  for (var i = 0; i < campos.length; i++) {
    var clave = campos[i][0], etiqueta = campos[i][1], tipo = campos[i][2];
    var valor = data[clave];
    if (valor === undefined || valor === null || valor === '') continue;
    if (campos[i][3] && Number(valor) === 0) continue;
    if (campos[i][4] && !conVenta) continue;
    if (campos[i][5] && !conTc) continue;
    filas +=
      '<tr>' +
      '<td style="padding:6px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;">' +
        correoEscapar(etiqueta) +
      '</td>' +
      '<td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:13px;font-weight:bold;text-align:right;">' +
        correoValor(valor, tipo) +
      '</td>' +
      '</tr>';
  }
  return filas;
}

function construirCuerpoCorreo(data) {
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:560px;">' +
    '<h2 style="color:#ff6600;margin:0 0 2px;font-size:18px;">Nueva cotización — ' +
      correoEscapar(data.modalidad || '') + '</h2>' +
    '<p style="margin:0 0 18px;color:#888;font-size:12px;">' +
      correoEscapar(data.fecha || '') + ' · ' + correoEscapar(data.usuario || '') + '</p>';

  for (var i = 0; i < CORREO_SECCIONES.length; i++) {
    if (CORREO_SECCIONES[i].soloConVenta && !esConVenta(data.modalidad)) continue;
    var filas = correoFilas(data, CORREO_SECCIONES[i].campos);
    if (!filas) continue; // seccion sin nada capturado: no se imprime vacía
    html +=
      '<h3 style="margin:18px 0 6px;font-size:12px;text-transform:uppercase;' +
        'letter-spacing:0.08em;color:#999;">' + correoEscapar(CORREO_SECCIONES[i].titulo) + '</h3>' +
      '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
        filas +
      '</table>';
  }

  return html + '</div>';
}

function asuntoCorreo(data) {
  var partes = [data.modalidad, data.cliente, data.material].filter(function (p) {
    return p !== undefined && p !== null && String(p) !== '';
  });
  return 'Nueva cotización - ' + partes.join(' | ');
}

function enviarCorreo(data) {
  MailApp.sendEmail({
    to: CORREO_DESTINO,
    subject: asuntoCorreo(data),
    htmlBody: construirCuerpoCorreo(data)
  });
}

// Ejecutar a mano desde el editor: manda un correo de prueba con datos ficticios
// para ver el formato sin capturar nada.
function probarCorreo() {
  enviarCorreo({
    fecha: new Date().toLocaleDateString('es-MX'),
    // Literal, no Session.getActiveUser(): eso pide el scope userinfo.email, que
    // el proyecto no tiene y no vale la pena pedir solo para una prueba.
    usuario: 'prueba@' + DOMINIO_PERMITIDO,
    modalidad: 'Terrestre',
    cliente: 'CLIENTE DE PRUEBA',
    proveedor: 'PROVEEDOR DE PRUEBA',
    material: '6063 PAINTED',
    cargas: 2,
    kgOc: 49000,
    destino: 'LAREDO',
    embalaje: 'GAYLORD',
    negociacion: 'RECOLECCION DIRECTA',
    precioVenta: 52.4,
    porcentajeFijacion: 85,
    fixPrice: 1.05,
    tcHoy: 18.5,
    tcSeguro: 18.2,
    diasCredito: 30,
    ppProv: 38.75,
    precioCompraMxn: 1898750,
    precioTopeCompra: 42,
    fleteNac: 1.2,
    merma: 3,
    status: 'Aprobado',
    utilidadNeta: 120000,
    tipoCompra: 'Compra Mercado',
    notas: 'Correo de prueba.'
  });
  Logger.log('Correo de prueba enviado a ' + CORREO_DESTINO);
}

// Ejecutar a mano desde el editor para forzar el consentimiento de
// script.external_request. validarCredencial vive dentro de doPost, que nunca
// corre en el editor, asi que Apps Script no pedia ese permiso por si solo.
function probarPermisos() {
  var codigo = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=xxx',
    { muteHttpExceptions: true }
  ).getResponseCode();
  // 400 es la respuesta correcta: el token es basura a proposito. Lo que importa
  // es que la llamada haya salido sin excepcion de permisos.
  Logger.log('UrlFetchApp OK — Google respondio ' + codigo);
  Logger.log('Hoja destino: ' + (verificarTitulosGoogleSheets() ? 'OK' : 'REVISAR'));
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var auth = autenticarPeticion(data);
    if (!auth) {
      return ContentService
        .createTextOutput(JSON.stringify({ "error": "No autorizado", "sesionInvalida": true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // El autor lo dicta el token, no el cuerpo del POST: data.usuario es suplantable.
    data.usuario = auth.email;

    // Canje puro: el cliente cambia su id_token por el token de sesion al entrar,
    // sin escribir fila. Lo demas del POST se ignora.
    if (data.accion === 'sesion') {
      // Siempre token nuevo: asi el cliente que ya tenia sesion valida corre la
      // vigencia hacia adelante y quien la usa a diario nunca la ve vencer.
      return ContentService
        .createTextOutput(JSON.stringify({
          result: 'success',
          sesion: emitirTokenSesion(auth.email),
          email: auth.email,
          expiraEn: Date.now() + SESION_DURACION_MS
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var spreadsheet = SpreadsheetApp.openById(CAPTURA_SPREADSHEET_ID);

    // 1. Una sola hoja para todas las modalidades: la modalidad va en SEGMENTO.
    var sheet = spreadsheet.getSheetByName(CAPTURA_SHEET_NAME);
    if (!sheet) {
      throw new Error('No existe la hoja ' + CAPTURA_SHEET_NAME + ' en el spreadsheet de captura.');
    }

    // 2. La fila sigue el orden exacto de CAPTURA_TITULOS. La captura sin venta
    //    (Inventarios) deja vacío lo que solo existe cuando hay venta.
    var conVenta = esConVenta(data.modalidad);
    var conTc = usaFijacionYTc(data.modalidad);
    var row = [
      data.fecha,
      data.usuario,
      data.modalidad,
      data.proveedor,
      // En Inventarios el cliente viene con el proveedor repetido, no vacío.
      data.cliente,
      data.destino,
      data.cargas,
      data.kgOc,
      data.material,
      data.embalaje || '',
      data.negociacion || '',
      conTc ? data.tcHoy : '',
      conTc ? data.tcSeguro : '',
      conTc ? sinCero(data.diasCredito) : '',
      conTc ? data.porcentajeFijacion : '',
      conTc ? data.fixPrice : '',
      conVenta ? data.precioVenta : '',
      conVenta ? data.precioTopeCompra : '',
      data.ppProv,
      data.fleteNac,
      sinCero(data.fleteInt),
      sinCero(data.oceans),
      data.merma,
      data.status,
      conVenta ? data.utilidadNeta : '',
      data.notas
    ];

    // 3. Escribir en la hoja correcta
    sheet.appendRow(row);

    // Invalidar cache de pendientes — el trato recién guardado puede afectarlos
    CacheService.getScriptCache().remove('pendientes');

    // 4. Enviar el correo.
    //
    // El correo es aviso, no captura: la fila ya se escribio, asi que un fallo de
    // MailApp (cuota diaria agotada, por ejemplo) no debe tumbar el guardado. Pero
    // tampoco se traga en silencio — antes habia un `typeof enviarCorreo ===
    // "function"` que dejaba de mandar correos sin que nadie se enterara.
    var avisoCorreo = null;
    try {
      enviarCorreo(data);
    } catch (errCorreo) {
      avisoCorreo = 'La captura se guardó, pero el correo no salió: ' + errCorreo;
      Logger.log(avisoCorreo);
    }

    // Si el POST entro con id_token, se devuelve el token de sesion recien emitido
    // para que el cliente lo guarde y ya no vuelva a necesitar a Google.
    var respuesta = { result: "success" };
    if (avisoCorreo) respuesta.avisoCorreo = avisoCorreo;
    if (auth.tokenNuevo) {
      respuesta.sesion = auth.tokenNuevo;
      respuesta.expiraEn = Date.now() + SESION_DURACION_MS;
    }
    return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;

    if (action === 'getTarifario') {
      var ssFletes = SpreadsheetApp.openById('15HLYsai0BYgvZPe7v1PJIfzBsigNDX12wPS_HIaiBkk');
      var sheetFletes = ssFletes.getSheets()[0];
      if (sheetFletes) {
        var data = sheetFletes.getDataRange().getValues();
        var tarifas = [];
        // La fila 0 contiene los encabezados.
        // El Sheet ahora tiene una columna Fecha en A, recorriendo todo una posicion:
        // Col B (index 1): Proveedor / Cliente Origen (co)
        // Col D (index 3): Origen (o)
        // Col E (index 4): Cliente Destino (cd)
        // Col G (index 6): Destino (d)
        // Col H (index 7): Costo Ruta
        // Col I (index 8): Moneda
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var co = String(row[1] || '').trim();
          var o = String(row[3] || row[2] || '').trim();
          var cd = String(row[4] || '').trim();
          var d = String(row[6] || row[5] || '').trim();
          var costoStr = String(row[7] || '').replace(/[\$,]/g, '').trim();
          var costo = parseFloat(costoStr) || 0;
          var moneda = String(row[8] || 'MXP').trim().toUpperCase();
          if (co || cd || o || d) {
            tarifas.push({ co: co, o: o, cd: cd, d: d, costo: costo, moneda: moneda });
          }
        }
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'success', data: tarifas }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var cache = CacheService.getScriptCache();
    var cached = cache.get('pendientes');
    if (cached) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.openById('14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc');
    var allSheetNames = ss.getSheets().map(function(s) { return s.getName(); });
    var result = { terrestre: [], maritimo: [], _debug: { sheets: allSheetNames } };

    // TERRESTRES — CLIENT=col0, MATERIAL=col4
    var sheetT = ss.getSheetByName('TERRESTRES');
    if (sheetT) {
      var dataT = sheetT.getDataRange().getValues();
      var headerRowT = -1;
      for (var i = 0; i < dataT.length; i++) {
        if (String(dataT[i][0]).toUpperCase() === 'CLIENT') { headerRowT = i; break; }
      }
      result._debug.terrestresHeader = headerRowT;
      result._debug.terrestresTotal = dataT.length;
      if (headerRowT >= 0) {
        var seenT = {};
        for (var i = headerRowT + 1; i < dataT.length; i++) {
          var row = dataT[i];
          var client = row[0], contrato = row[3], material = row[4], estWeight = row[7];
          if (!client || String(client).toUpperCase() === 'INVENTARIO') continue;
          if (typeof estWeight === 'number' && !isNaN(estWeight) && estWeight <= 0) continue;
          var key = client + '|' + material + '|' + contrato;
          if (!seenT[key]) {
            seenT[key] = true;
            var fijT = Number(row[8]) || 0;
            if (fijT > 0 && fijT <= 1) fijT = fijT * 100;
            result.terrestre.push({ client: String(client), material: String(material), contrato: String(contrato), fijacion: fijT, fixPrice: Number(row[9]) || 0 });
          }
        }
      }
    }

    // MARÍTIMO — busca nombre exacto y variantes
    var maritimoNames = ['MARÍTIMO', 'MARITIMO', 'Marítimo', 'Maritimo', 'MARITIMA', 'MARÍTIMA'];
    var sheetM = null;
    var foundMaritimoName = '';
    for (var n = 0; n < maritimoNames.length; n++) {
      sheetM = ss.getSheetByName(maritimoNames[n]);
      if (sheetM) { foundMaritimoName = maritimoNames[n]; break; }
    }
    // Si no encontró por nombre exacto, busca cualquier hoja que contenga "MARIT"
    if (!sheetM) {
      for (var n = 0; n < allSheetNames.length; n++) {
        if (allSheetNames[n].toUpperCase().indexOf('MARIT') >= 0) {
          sheetM = ss.getSheetByName(allSheetNames[n]);
          foundMaritimoName = allSheetNames[n];
          break;
        }
      }
    }
    result._debug.maritimoSheetFound = foundMaritimoName || null;

    if (sheetM) {
      var dataM = sheetM.getDataRange().getValues();
      var headerRowM = -1;
      for (var i = 0; i < dataM.length; i++) {
        if (String(dataM[i][0]).toUpperCase() === 'CLIENT') { headerRowM = i; break; }
      }
      result._debug.maritimosHeader = headerRowM;
      result._debug.maritimosTotal = dataM.length;
      if (headerRowM >= 0) {
        var seenM = {};
        for (var i = headerRowM + 1; i < dataM.length; i++) {
          var row = dataM[i];
          var client = row[0], contrato = row[3], material = row[4], estWeight = row[12];
          if (!client || String(client).toUpperCase() === 'INVENTARIO') continue;
          if (typeof estWeight === 'number' && !isNaN(estWeight) && estWeight <= 0) continue;
          var key = client + '|' + material + '|' + contrato;
          if (!seenM[key]) {
            seenM[key] = true;
            var fijM = Number(row[8]) || 0;
            if (fijM > 0 && fijM <= 1) fijM = fijM * 100;
            result.maritimo.push({ client: String(client), material: String(material), contrato: String(contrato), fijacion: fijM, fixPrice: Number(row[9]) || 0 });
          }
        }
      }
    }

    var resultJson = JSON.stringify(result);
    cache.put('pendientes', resultJson, 120); // 2 min — evita re-leer las hojas en cada cambio de tab
    return ContentService
      .createTextOutput(resultJson)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Verifica que la fila 1 de LOGÍSTICA siga siendo la que doPost espera.
// No reescribe la hoja: la hoja es la fuente de verdad y la lleva logística;
// si alguien mueve una columna, esto lo grita en el log en vez de pisarla.
function verificarTitulosGoogleSheets() {
  var sheet = SpreadsheetApp.openById(CAPTURA_SPREADSHEET_ID).getSheetByName(CAPTURA_SHEET_NAME);
  if (!sheet) {
    Logger.log('FALTA la hoja ' + CAPTURA_SHEET_NAME);
    return false;
  }

  var actuales = sheet.getRange(1, 1, 1, CAPTURA_TITULOS.length).getValues()[0];
  var diferencias = [];
  for (var i = 0; i < CAPTURA_TITULOS.length; i++) {
    if (String(actuales[i]).trim() !== String(CAPTURA_TITULOS[i]).trim()) {
      diferencias.push('col ' + (i + 1) + ': hoja="' + actuales[i] + '" esperado="' + CAPTURA_TITULOS[i] + '"');
    }
  }

  if (diferencias.length) {
    Logger.log('Encabezados fuera de sincronía:\n' + diferencias.join('\n'));
    return false;
  }
  Logger.log('Encabezados de ' + CAPTURA_SHEET_NAME + ' OK.');
  return true;
}
