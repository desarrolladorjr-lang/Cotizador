var CLIENT_ID = '65144242856-79jgp1htcetc9g9ht1b3vkl5q3j2uh2b.apps.googleusercontent.com';
var DOMINIO_PERMITIDO = 'sidellscrap.com';

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

    var spreadsheet = SpreadsheetApp.openById('12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A');

    // 1. Determinar la hoja de destino basada en la modalidad
    var sheet;
    if (data.modalidad === 'Marítimo') {
      sheet = spreadsheet.getSheetByName('Marítimo');
    } else if (data.modalidad === 'Nacional') {
      sheet = spreadsheet.getSheetByName('Nacional');
    } else if (data.modalidad === 'inventarios') {
      sheet = spreadsheet.getSheetByName('Inventarios');
    } else if (data.modalidad === 'Compras') {
      sheet = spreadsheet.getSheetByName('Compras');
    } else {
      sheet = spreadsheet.getSheetByName('Terrestre');
    }

    if (!sheet) {
      sheet = spreadsheet.getActiveSheet();
    }

    // 2. Preparar los datos según modalidad
    var row;
    if (data.modalidad === 'inventarios') {
      row = [
        data.fecha,
        data.usuario,
        data.proveedor,
        data.cargas,
        data.material,
        data.fleteNac,
        data.precioCompraMxn,
        data.notas,
        data.embalaje || '',
        data.negociacion || '',
        data.modalidad
      ];
    } else if (data.modalidad === 'Compras') {
      row = [
        data.fecha,
        data.usuario,
        data.proveedor,
        data.cargas,
        data.material,
        data.origenFlete,
        data.destinoFlete,
        data.origenEmbarque || '',
        data.fleteNac,
        '', // fixPrice
        '', // porcentajeFijacion
        '', // precioVenta
        '', // precioTopeCompra
        data.paraInventarios ? 'Sí' : 'No',
        data.intencionVenta ? 'Sí' : 'No',
        data.intencionCompra ? 'Sí' : 'No',
        data.precioCompraMxn || '',
        data.notas,
        data.embalaje || '',
        data.negociacion || '',
        data.modalidad,
        data.tipoCompra
      ];
    } else {
      row = [
        data.fecha,
        data.usuario,
        data.cliente,
        data.proveedor,
        data.cargas,
        data.material,
        data.destino,
        data.porcentajeFijacion,
        data.fixPrice,
        data.precioVenta,
        data.tcHoy,
        data.tcSeguro,
        data.fleteNac,
        data.cruceInt,
        data.precioTopeCompra,
        data.ppProv,
        data.status,
        data.utilidadNeta,
        data.tipoCompra,
        data.notas,
        data.embalaje || '',
        data.negociacion || '',
        data.contrato || '',
        data.paraInventarios ? 'Sí' : 'No',
        data.intencionVenta ? 'Sí' : 'No',
        data.intencionCompra ? 'Sí' : 'No',
        data.modalidad
      ];
    }

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

function sincronizarTitulosGoogleSheets() {
  var spreadsheet = SpreadsheetApp.openById('12-gjHHdqqAVsLsEE3I94MxpE9POpRVTBfMorLByrn-A');
  
  var titulosInventarios = [
    "Fecha", "Usuario", "Proveedor", "Cargas", "Material", "Flete Nacional",
    "Precio Compra MXN", "Notas", "Embalaje", "Negociación", "Segmento"
  ];

  var titulosCompras = [
    "Fecha", "Usuario", "Proveedor", "Cargas", "Material", "Origen Flete",
    "Destino Flete", "Origen Embarque", "Flete Nacional", "Fix Price",
    "Porcentaje Fijación", "Precio Venta", "Precio Tope Compra",
    "Para Inventarios", "Intención Venta", "Intención Compra",
    "Precio Compra MXN", "Notas", "Embalaje", "Negociación", "Segmento", "Tipo Compra"
  ];

  var titulosGenerales = [
    "Fecha", "Usuario", "Cliente", "Proveedor", "Cargas", "Material",
    "Destino", "Porcentaje Fijación", "Fix Price", "Precio Venta", "TC Hoy",
    "TC Seguro", "Flete Nacional", "Cruce Int", "Precio Tope Compra",
    "PP Prov", "Status", "Utilidad Neta", "Tipo Compra", "Notas",
    "Embalaje", "Negociación",
    "Contrato", "Para Inventarios", "Intención Venta", "Intención Compra", "Segmento"
  ];
  
  function setHeaders(sheetName, headers) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1); // Fija la primera fila para que los encabezados no se muevan
  }
  
  setHeaders('Inventarios', titulosInventarios);
  setHeaders('Compras', titulosCompras);
  setHeaders('Marítimo', titulosGenerales);
  setHeaders('Nacional', titulosGenerales);
  setHeaders('Terrestre', titulosGenerales);
  
  Logger.log("Títulos sincronizados correctamente en todas las hojas.");
}
