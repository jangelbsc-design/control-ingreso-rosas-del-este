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
 *  La app usará TU pestaña **bitacora** (en minúsculas, la que ya
 *  creaste). Si no existiera, la crea automáticamente con estas
 *  columnas:
 *  ID · FECHA · HORA · MANZANO · PROPIETARIO · VISITANTE ·
 *  PLACA · NOTA · ORIGEN
 *
 *  IMPORTANTE: el script puede estar suelto (creado desde
 *  script.google.com) o pegado dentro de la hoja. Funciona en
 *  ambos casos porque usa la URL de abajo. Si tu documento es
 *  otro, cambia el ID en SPREADSHEET_URL.
 * ================================================================
 */

var SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1YdYeE6JLRlP5FsxI9TprBFiQ0lbYEXUO/edit";
var TAB = "bitacora";
var HEADERS = ["ID", "FECHA", "HORA", "MANZANO", "PROPIETARIO", "VISITANTE", "PLACA", "NOTA", "ORIGEN"];

function getTab_() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
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

function fmtDate_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  if (typeof v === "string") {
    var part = v.split("T")[0]; // quita hora en ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(part)) {
      var d = part.split("-");
      return d[2] + "/" + d[1] + "/" + d[0];
    }
    return v;
  }
  return String(v || "");
}

function fmtTime_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "HH:mm:ss");
  }
  if (typeof v === "string" && v.indexOf("T") !== -1) {
    var t = v.split("T")[1] || "";
    t = t.replace(/Z$/, "").split(".")[0];
    return t;
  }
  return String(v || "");
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
      var key = String(headers[k]).trim().toLowerCase();
      var v = values[i][k];
      if (key === "fecha") v = fmtDate_(v);
      else if (key === "hora") v = fmtTime_(v);
      o[key] = v;
    }
    out.push(o);
  }
  out.sort(function (a, b) {
    function ts(o) {
      var s = String(o.id || "").split("-")[0];
      if (!s) return 0;
      var n = parseInt(s, 36);
      return isNaN(n) ? 0 : n;
    }
    return ts(b) - ts(a);
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