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

/* ---------- Utilidades para registrar pagos ---------- */

/* Quita tildes sin usar normalize(), para que funcione también en el
   motor antiguo de Apps Script (algunos proyectos viejos lo tienen). */
function sinTildes_(s) {
  return String(s == null ? "" : s)
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/[ñ]/g, "n")
    .replace(/[ÁÀÄÂÃ]/g, "A").replace(/[ÉÈËÊ]/g, "E")
    .replace(/[ÍÌÏÎ]/g, "I").replace(/[ÓÒÖÔÕ]/g, "O")
    .replace(/[ÚÙÜÛ]/g, "U").replace(/[Ñ]/g, "N");
}

/* Encabezado normalizado: sin tildes, sin espacios, minúsculas.
   Así "GESTIÓN" se reconoce como "gestion". */
function normHead_(s) {
  return sinTildes_(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Primera columna cuyo encabezado coincide exactamente con alguno
   de los nombres dados (ya normalizados). */
function colByNames_(headers, names) {
  for (var i = 0; i < headers.length; i++) {
    var h = normHead_(headers[i]);
    for (var j = 0; j < names.length; j++) {
      if (h === names[j]) return i;
    }
  }
  return -1;
}

/* Igual que claveManzano() en la app: solo números unidos por "-".
   Evita confundir "M2 - 120" con "M21 - 20". */
function claveMz_(v) {
  var n = String(v == null ? "" : v).match(/\d+/g);
  return n ? n.join("-") : "";
}

/* Todas las filas (índice 0-based dentro de data) con ese manzano.
   `desde` es el índice de la fila de encabezados; se empieza a buscar
   en la siguiente. Así funciona aunque arriba haya filas vacías. */
function filasPorMz_(data, colMz, clave, desde) {
  var out = [];
  var inicio = (typeof desde === "number" ? desde : 0) + 1;
  for (var i = inicio; i < data.length; i++) {
    if (clave && claveMz_(data[i][colMz]) === clave) out.push(i);
  }
  return out;
}

/* Busca la fila de encabezados en las primeras 15 filas: la primera
   que tenga una columna de manzano. Devuelve { idx, headers }.
   Necesario porque en Hoja1 hay filas ocultas/vacías arriba. */
function filaEncabezado_(data) {
  var max = Math.min(data.length, 15);
  for (var i = 0; i < max; i++) {
    var head = data[i] || [];
    if (colByNames_(head, ["manzano", "mazano", "bloque"]) >= 0) {
      return { idx: i, headers: head };
    }
  }
  return { idx: 0, headers: data[0] || [] };
}

/* Nunca sobrescribe una celda con fórmula. */
function setCellSafe_(sh, row, col, val) {
  if (row < 1 || col < 0) return false;
  var cell = sh.getRange(row, col + 1);
  if (String(cell.getFormula() || "").charAt(0) === "=") return false;
  cell.setValue(val);
  return true;
}

/* Diagnóstico de SOLO LECTURA para la acción updatePago.
   Devuelve qué documento y qué pestañas ve el script, qué columnas
   detecta y si encuentra el manzano 22-40. No escribe nada. */
function diagPago_() {
  var out = { ok: true, url: SPREADSHEET_URL };
  try {
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    out.doc = ss.getName();
    out.docId = ss.getId();
    out.tabs = ss.getSheets().map(function (s) { return s.getName(); });

    ["PROPIETARIOS", "Hoja1"].forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (!sh) { out[name] = { existe: false }; return; }
      var d = sh.getDataRange().getValues();
      var enc = filaEncabezado_(d);
      var head = enc.headers;
      var info = {
        existe: true,
        filas: d.length,
        columnas: head.length,
        filaEncabezado: enc.idx + 1,
        headers: head.map(function (h) { return String(h == null ? "" : h); }),
        mz: colByNames_(head, ["manzano", "mazano", "bloque"]),
        estado: colByNames_(head, ["estado", "moroso", "situacionpago", "situacion"]),
        cancelado: colByNames_(head, ["cancelado"]),
        gestion: colByNames_(head, ["gestion", "anio", "year"])
      };
      if (info.mz >= 0) {
        info.filas2240 = filasPorMz_(d, info.mz, "22-40", enc.idx);
        info.muestraMz = d.slice(enc.idx + 1, enc.idx + 6).map(function (r) {
          return String(r[info.mz] == null ? "" : r[info.mz]);
        });
      }
      out[name] = info;
    });
  } catch (err) {
    out.ok = false;
    out.error = String(err);
  }
  return out;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "list";
  if (action === "list") {
    return outJson_(readRows_());
  }
  if (action === "diag") {
    return outJson_(diagPago_());
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
      // El apóstrofo inicial hace que Sheets guarde el texto tal cual
      // (sin convertirlo a fecha/hora, que lo corrompería).
      var txt_ = function (s) {
        s = String(s == null ? "" : s);
        return s.length ? "'" + s : "";
      };
      getTab_().appendRow([
        String(en.id || ""),
        txt_(en.dateLabel),
        txt_(en.time),
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

    if (action === "updatePool") {
      var sheetName = body.sheetName || "PROPIETARIOS";
      var block = String(body.block || "").trim();
      var owner = String(body.owner || "").trim();
      var value = body.value || "";
      
      var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
      var sh = ss.getSheetByName(sheetName);
      if (!sh) return outJson_({ ok: false, error: "No se encuentra la pestaña " + sheetName });
      
      var data = sh.getDataRange().getValues();
      if (data.length < 2) return outJson_({ ok: false, error: "Hoja sin datos" });
      
      var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
      
      var colBlock = -1, colOwner = -1, colPool = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j];
        if (h.indexOf("mazano") >= 0 || h.indexOf("manzano") >= 0 || h.indexOf("bloque") >= 0) { if (colBlock === -1) colBlock = j; }
        if (h.indexOf("propietario") >= 0 || h.indexOf("nombre") >= 0) { if (colOwner === -1) colOwner = j; }
        if (h.indexOf("piscina") >= 0 || h.indexOf("manilla") >= 0) { if (colPool === -1) colPool = j; }
      }
      
      if (colBlock === -1 || colOwner === -1 || colPool === -1) {
        return outJson_({ ok: false, error: "No se encontraron las columnas (Manzano/Propietario/Piscina) en la hoja" });
      }
      
      var norm = function(s) {
        return sinTildes_(s).toLowerCase().replace(/[^a-z0-9]/g, "");
      };
      
      var nBlock = norm(block);
      var nOwner = norm(owner);
      
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        var b = norm(String(data[i][colBlock]));
        var o = norm(String(data[i][colOwner]));
        
        if (b === nBlock && o === nOwner) {
          rowIndex = i + 1; // 1-based index
          break;
        }
      }
      
      if (rowIndex !== -1) {
        // Enviar con apóstrofe si es un número, aunque estos son textos ("Sin Manillas", "5 Manillas Rojas")
        sh.getRange(rowIndex, colPool + 1).setValue(value);
        return outJson_({ ok: true });
      } else {
        return outJson_({ ok: false, error: "Vecino no encontrado en la hoja" });
      }
    }

    /* REGISTRAR PAGO: escribe el mes pagado y el estado en las DOS
       pestañas de una sola vez. La app lo llama con estado VIGENTE
       (pago) o MOROSO (deshacer). Nunca toca una celda con fórmula. */
    if (action === "updatePago") {
      var block = String(body.block || "").trim();
      var estado = String(body.estado || "VIGENTE").trim().toUpperCase();
      var mes = String(body.month || "").trim();
      var anio = String(body.year || "").trim();
      var clave = claveMz_(block);

      if (!clave) return outJson_({ ok: false, error: "Falta el manzano" });
      if (estado !== "VIGENTE" && estado !== "MOROSO") {
        return outJson_({ ok: false, error: "Estado inválido" });
      }
      if (estado === "VIGENTE" && (!mes || !/^\d{4}$/.test(anio))) {
        return outJson_({ ok: false, error: "Faltan mes o año" });
      }

      var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
      var shVec = ss.getSheetByName(String(body.sheetVecinos || "PROPIETARIOS"));
      var shCan = ss.getSheetByName(String(body.sheetCancelado || "Hoja1"));
      if (!shVec || !shCan) {
        return outJson_({ ok: false, error: "No se encuentran las pestañas PROPIETARIOS u Hoja1" });
      }

      var dVec = shVec.getDataRange().getValues();
      var dCan = shCan.getDataRange().getValues();
      if (dVec.length < 2 || dCan.length < 2) {
        return outJson_({ ok: false, error: "Las hojas no tienen datos" });
      }
      var encVec = filaEncabezado_(dVec);
      var encCan = filaEncabezado_(dCan);
      var hVec = encVec.headers, hCan = encCan.headers;

      var mzVec = colByNames_(hVec, ["manzano", "mazano", "bloque"]);
      var esVec = colByNames_(hVec, ["estado", "moroso", "situacionpago", "situacion"]);
      var mzCan = colByNames_(hCan, ["manzano", "mazano", "bloque"]);
      var esCan = colByNames_(hCan, ["estado", "moroso", "situacionpago"]);
      var txtCan = colByNames_(hCan, ["cancelado"]);
      var anioCan = colByNames_(hCan, ["gestion", "anio", "year"]);

      var filasVec = mzVec >= 0 ? filasPorMz_(dVec, mzVec, clave, encVec.idx) : [];
      var filasCan = mzCan >= 0 ? filasPorMz_(dCan, mzCan, clave, encCan.idx) : [];
      if (filasVec.length !== 1 || filasCan.length !== 1) {
        return outJson_({ ok: false, error: "Manzano no encontrado o duplicado (" +
          filasVec.length + "/" + filasCan.length + ")" });
      }
      if (esVec < 0 || esCan < 0) {
        return outJson_({ ok: false, error: "Falta la columna ESTADO en alguna pestaña" });
      }
      if (estado === "VIGENTE" && (txtCan < 0 || anioCan < 0)) {
        return outJson_({ ok: false, error: "Faltan las columnas CANCELADO/GESTIÓN" });
      }

      /* Prevalidar fórmulas ANTES de escribir: si alguna celda destino
         es fórmula, no se modifica nada. */
      var chk = [
        [shVec, filasVec[0] + 1, esVec],
        [shCan, filasCan[0] + 1, esCan]
      ];
      if (estado === "VIGENTE") {
        chk.push([shCan, filasCan[0] + 1, txtCan]);
        chk.push([shCan, filasCan[0] + 1, anioCan]);
      }
      for (var q = 0; q < chk.length; q++) {
        var c = chk[q];
        if (String(c[0].getRange(c[1], c[2] + 1).getFormula() || "").charAt(0) === "=") {
          return outJson_({ ok: false, error: "Una celda destino tiene fórmula; no se escribió nada" });
        }
      }

      if (estado === "VIGENTE") {
        if (!setCellSafe_(shCan, filasCan[0] + 1, txtCan, mes)) {
          return outJson_({ ok: false, error: "No se pudo escribir CANCELADO" });
        }
        if (!setCellSafe_(shCan, filasCan[0] + 1, anioCan, anio)) {
          return outJson_({ ok: false, error: "No se pudo escribir GESTIÓN" });
        }
      }
      setCellSafe_(shCan, filasCan[0] + 1, esCan, estado);
      setCellSafe_(shVec, filasVec[0] + 1, esVec, estado);

      return outJson_({ ok: true, block: block, estado: estado, mes: mes, anio: anio });
    }

    return outJson_({ ok: false, error: "Acción inválida: " + action });
  } catch (err) {
    return outJson_({ ok: false, error: String(err) });
  }
}