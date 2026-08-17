var CLIENT_ID = '65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com';
var DOMINIO_PERMITIDO = 'sidellscrap.com';

// Destino de la captura del cotizador: EXPORTACIONES 2026, hoja LOGÍSTICA.
// Antes eran 5 hojas (Terrestre/Marítimo/Nacional/Compras/Inventarios) en el
// spreadsheet 12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A; ahora todas las
// modalidades escriben la misma fila y se distinguen por la columna SEGMENTO.
var CAPTURA_SPREADSHEET_ID = '14ep3kX8urvZlwHwcdMJZEf6V6aIJWs1ZWxCyNVb-uxc';
var CAPTURA_SHEET_NAME = 'LOGÍSTICA';

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

    var correoVerificado = validarCredencial(data.credential);
    if (!correoVerificado) {
      return ContentService
        .createTextOutput(JSON.stringify({ "error": "No autorizado" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // El autor lo dicta el token, no el cuerpo del POST: data.usuario es suplantable.
    data.usuario = correoVerificado;

    var spreadsheet = SpreadsheetApp.openById(CAPTURA_SPREADSHEET_ID);

    // 1. Una sola hoja para todas las modalidades: la modalidad va en SEGMENTO.
    var sheet = spreadsheet.getSheetByName(CAPTURA_SHEET_NAME);
    if (!sheet) {
      throw new Error('No existe la hoja ' + CAPTURA_SHEET_NAME + ' en el spreadsheet de captura.');
    }

    // 2. La fila sigue el orden exacto de CAPTURA_TITULOS. La captura sin venta
    //    (Inventarios) deja vacío lo que solo existe cuando hay venta. Se acepta
    //    'Compras' porque asi se etiquetaba antes y hay filas viejas con ese valor.
    var conVenta = data.modalidad !== 'Inventarios' && data.modalidad !== 'Compras';
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
      data.tcHoy,
      conVenta ? data.tcSeguro : '',
      data.diasCredito,
      conVenta ? data.porcentajeFijacion : '',
      conVenta ? data.fixPrice : '',
      conVenta ? data.precioVenta : '',
      conVenta ? data.precioTopeCompra : '',
      data.ppProv,
      data.fleteNac,
      data.fleteInt,
      data.oceans,
      data.merma,
      data.status,
      conVenta ? data.utilidadNeta : '',
      data.notas
    ];

    // 3. Escribir en la hoja correcta
    sheet.appendRow(row);

    // Invalidar cache de pendientes — el trato recién guardado puede afectarlos
    CacheService.getScriptCache().remove('pendientes');

    // 4. Enviar el correo
    if (typeof enviarCorreo === "function") {
      enviarCorreo(data);
    }

    return ContentService.createTextOutput(JSON.stringify({"result":"success"})).setMimeType(ContentService.MimeType.JSON);
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
        // Col A (index 0): Proveedor / Cliente Origen (co)
        // Col C (index 2): Origen (o)
        // Col D (index 3): Cliente Destino (cd)
        // Col F (index 5): Destino (d)
        // Col G (index 6): Costo Ruta
        // Col H (index 7): Moneda
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var co = String(row[0] || '').trim();
          var o = String(row[2] || row[1] || '').trim();
          var cd = String(row[3] || '').trim();
          var d = String(row[5] || row[4] || '').trim();
          var costoStr = String(row[6] || '').replace(/[\$,]/g, '').trim();
          var costo = parseFloat(costoStr) || 0;
          var moneda = String(row[7] || 'MXP').trim().toUpperCase();
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
