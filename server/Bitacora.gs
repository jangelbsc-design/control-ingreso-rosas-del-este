/**
 * ================================================================
 *  BITÁCORA SYNCHRONIZED - WEB APP DE GOOGLE APPS SCRIPT
 *  Urbanización Rosas del Este
 * ================================================================
 *  Este script hace que la bitácora de la app se guarde en tu hoja
 *  de cálculo y se comparta en TIEMPO REAL con todos los celulares.
 *
 *  INSTALACIÓN (una sola vez, ~5 minutos):
 *  1) Abre tu hoja de cálculo de los vecinos.
 *  2) Menú: Extensiones -> Apps Script (o "Herramientas > Editor
 *     de secuencias"). Se abre el editor.
 *  3) BORRA todo lo que haya (para que quede vacío) y PEGA este
 *     archivo completo (desde /**** hasta la última línea).
 *  4) Guarda (Ctrl+G / ícono de disquete). La pestaña se llamará
 *     "Bitacora" (o lo que quieras, no importa).
 *  5) DEPLOYAR como Web App:
 *     - Botón "Implementar" (Deploy) -> Nueva implementación.
 *     - Tipo: "Aplicación web" (Web app).
 *     - "Ejecutar como": que diga **Yo** / "(Tu cuenta)".
 *     - "Quién puede acceder": **(Cualquier persona)** / Anyone.
 *     - Clic en "Implementar". Autoriza (elige tu cuenta y
 *       "Avanzado -> Ir a ... (no seguro)" -> Permitir).
 *  6) Copia la URL que termina en  /exec  (la primera de la
 *     ventana que aparece). Cuidado: usa la de "Aplicación web",
 *     NO la de "Prueba de desarrollo" si pide accounts.google.com.
 *  7) Pega esa URL en  js/config.js  como  BITACORA_URL  y sube
 *     el cambio (git push).
 *
 *  La app creará automáticamente una pestaña llamada "BITACORA"
 *  en tu hoja con las columnas:
 *  ID · FECHA · HORA · MANZANO · PROPIETARIO · VISITANTE ·
 *  PLACA · NOTA · ORIGEN
 * ================================================================
 */

var TAB = "BITACORA";
var HEADERS = ["ID", "FECHA", "HORA", "MANZANO", "PROPIETARIO", "VISITANTE", "PLACA", "NOTA", "ORIGEN"];

function getTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(0);
  } else {
    // Asegura el encabezado si falta (hoja recién creada a mano)
    var first = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0].join("");
    if (first.length === 0) sh.appendRow(HEADERS);
  }
  return sh;
}

function readRows_() {
  var sh = getTab_();
  var values = sh.getDataRange().getValues();
  var out = [];
  if (!values.length) return out;
  var headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === "") continue; // fila vacía
    var o = {};
    for (var k = 0; k < headers.length; k++) {
      o[String(headers[k]).trim().toLowerCase()] = values[i][k];
    }
    out.push(o);
  }
  out.sort(function (a, b) {
    var na = Number(a.ts || a.id || 0), nb = Number(b.ts || b.id || 0);
    if (isNaN(na)) na = 0;
    if (isNaN(nb)) nb = 0;
    return nb - na;
  });
  return out;
}

function outJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "list";
  if (action === "list") {
    return outJson_(readRows_());
  }
  return outJson_({ ok: false, error: "Acción inválida: " + action });
}

function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    } catch (er) {
      body = {};
    }
    var action = body.action || "add";

    if (action === "add") {
      var en = body.entry || {};
      getTab_().appendRow([
        String(en.id || ""),
        String(en.dateLabel || ""),
        String(en.time || ""),
        String(en.block || ""),
        String(en.owner || ""),
        String(en.name || ""),
        String(en.plate || ""),
        String(en.note || ""),
        String(en.via || "manual")
      ]);
      return outJson_({ ok: true });
    }

    if (action === "delete") {
      var id = String(body.id || "").trim();
      if (!id) return outJson_({ ok: false, error: "Falta id" });
      var sh = getTab_();
      var values = sh.getDataRange().getValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][0]).trim() === id) {
          sh.deleteRow(i + 1);
        }
      }
      return outJson_({ ok: true });
    }

    return outJson_({ ok: false, error: "Acción inválida: " + action });
  } catch (err) {
    return outJson_({ ok: false, error: String(err) });
  }
}