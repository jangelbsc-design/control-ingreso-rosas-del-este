/**
 * ================================================================
 *  API - GOOGLE APPS SCRIPT (ETAPA 1: sin cambios en la app)
 *  Urbanización Rosas del Este
 * ================================================================
 *  Este script es la PUERTA. La app hoy lee el Google Sheets
 *  directamente desde el navegador (gviz JSONP), y eso obliga a que
 *  la hoja esté pública: cualquiera que conozca el ID puede descargar
 *  el directorio completo (nombres, teléfonos, placas y GPS) y la
 *  hoja de USUARIOS con las contraseñas en texto visible.
 *
 *  Este archivo NO cambia la app. Solo crea la puerta del lado del
 *  servidor, lista para que en la etapa 2 la app empiece a usarla.
 *
 *  ---------------------------------------------------------------
 *  INSTALACIÓN (una sola vez, ~6 minutos)
 *  ---------------------------------------------------------------
 *  IMPORTANTE: creá un PROYECTO NUEVO y SEPARADO. No pegues esto
 *  dentro del proyecto de Bitacora.gs: ese script lo usa la app en
 *  producción y redeployarlo podés romper la bitácora.
 *
 *  1) https://script.google.com  ->  "Nuevo proyecto"
 *  2) BORRA el contenido de Code.gs y PEGA este archivo entero.
 *  3) Guardá.
 *  4) Implementar -> Nueva implementación
 *       - Tipo: "Aplicación web"
 *       - Ejecutar como:  Yo / (tu cuenta)
 *       - Quién puede acceder: (Cualquier persona)
 *     (Sí, "cualquier persona": la app vive en una página pública,
 *      así que la puerta NO la pone Apps Script, la pone este código.)
 *  5) Copiá la URL /exec.
 *  6) NO la pongas todavía en js/config.js. Primero probala a mano
 *     (abajo están los tests). La etapa 2 la agrega con bandera.
 *
 *  ---------------------------------------------------------------
 *  PROBAR ANTES DE CONECTAR NADA (etapa 1)
 *  ---------------------------------------------------------------
 *  Ping (abrir en el navegador):
 *    <URL>?action=ping
 *    -> {"ok":true,...}
 *
 *  Login (OBLIGATORIO por POST, nunca por GET):
 *    curl -X POST "<URL>" -H "Content-Type: application/json" ^
 *         -d "{\"action\":\"auth\",\"user\":\"admin\",\"pass\":\"TU_CLAVE\"}"
 *    -> {"ok":true,"token":"...","role":"admin","expires":...}
 *
 *  Por qué POST y no GET: con GET la contraseña viaja en la URL y
 *  queda escrita en el registro de ejecuciones de Apps Script.
 *
 *  OJO, ESTE DATO ES EL QUE MAS SE OLVIDA (leído el 10/10/2026):
 *  el curl de arriba con "Content-Type: application/json" funciona,
 *  pero la app NO puede mandar ese header. Mandar application/json
 *  desde el navegador dispara una petición previa (preflight OPTIONS)
 *  y Apps Script NO la contesta, así que el navegador bloquea el
 *  fetch antes de enviarlo. No es un error del script ni de la URL:
 *  es que la cabecera no está permitida.
 *
 *  La etapa 2 tiene que mandar el mismo JSON con:
 *      Content-Type: text/plain;charset=utf-8
 *  que es un tipo "simple" y por lo tanto no dispara preflight.
 *  El cuerpo sigue siendo JSON y parseBody_() lo sigue leyendo
 *  igual, así que este script no necesita ningún cambio por eso.
 *  Conviene probarlo así desde el navegador, no solo con curl:
 *      fetch(URL, {method:"POST", body: JSON.stringify({action:"ping"})})
 *
 *  Directorio (con token):
 *    curl -X POST "<URL>" -H "Content-Type: application/json" ^
 *         -d "{\"action\":\"directorio\",\"token\":\"<PEGAR_TOKEN>\"}"
 *
 *  Un token vencido o inventado tiene que devolver {"ok":false,"error":"..."}.
 *  Si eso pasa, la puerta sirve.
 *  ---------------------------------------------------------------
 */

var CFG = {
  // Tu documento actual. El script lo abre con permisos de tu cuenta,
  // así que puede leerlo aunque la hoja esté pública.
  SPREADSHEET_ID: "1YdYeE6JLRlP5FsxI9TprBFiQ0lbYEXUO",

  // Pestañas
  TAB_USERS: "Usuarios",          // USUARIO · CONTRASEÑA · [ROL]
  TAB_PROPIETARIOS: "PROPIETARIOS",
  TAB_CANCELADO: "Hoja1",

  // Columnas del aviso CANCELADO (mismas que js/config.js)
  COL_CANCELADO: "CANCELADO",
  COL_CANCELADO_MZ: "MAZANO",     // ojo: con Z, así está en la hoja
  COL_CANCELADO_ANIO: "GESTIÓN",

  // Firmas de tokens. CAMBIÁLAS por algo propio antes de deployar.
  SECRET: "CAMBIAME_POR_UN_STRING_LARGO_Y_ALEATORIO",
  PASS_SALT: "CAMBIAME_OTRO_DISTINTO",

  // Duración de la sesión (12 h = un turno de guardia)
  SESSION_TTL_SEG: 12 * 60 * 60,

  // Freno a fuerza bruta
  MAX_FALLOS: 5,
  BLOQUEO_SEG: 900
};

// ------------------------------------------------------------------
// Entrada
// ------------------------------------------------------------------

function doGet(e) {
  return handle_(e, "GET");
}

function doPost(e) {
  return handle_(e, "POST");
}

function handle_(e, metodo) {
  var accion = "";
  var body = {};

  try {
    if (metodo === "POST") {
      body = parseBody_(e);
      accion = String(body.action || "");
    } else {
      var p = (e && e.parameter) || {};
      accion = String(p.action || "ping");
    }

    if (accion === "ping") return json_({ ok: true, server: "api", ts: Date.now() });

    if (accion === "auth") {
      if (metodo !== "POST") {
        return json_({ ok: false, error: "auth requiere POST" });
      }
      return auth_(body);
    }

    // Todo lo demás exige sesión válida.
    var sesion = verificar_(String(body.token || ""));
    if (!sesion) {
      return json_({ ok: false, error: "sesion invalida o vencida", code: "unauthorized" });
    }

    if (accion === "directorio")   return directorio_();
    if (accion === "cancelado")    return cancelado_();
    if (accion === "quiensoy")     return json_({ ok: true, user: sesion.user, role: sesion.role });

    return json_({ ok: false, error: "accion desconocida: " + accion });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// ------------------------------------------------------------------
// Login
// ------------------------------------------------------------------

function auth_(body) {
  var user = String(body.user || "").trim();
  var pass = String(body.pass || "");
  if (!user || !pass) {
    return json_({ ok: false, error: "faltan datos", code: "bad-request" });
  }

  var llave = "rl|" + user;
  var fallos = Number(CacheService.getScriptCache().get(llave) || 0);
  if (fallos >= CFG.MAX_FALLOS) {
    return json_({
      ok: false,
      error: "demasiados intentos. espera " + Math.round(CFG.BLOQUEO_SEG / 60) + " minutos.",
      code: "blocked"
    });
  }

  var fila = buscarUsuario_(user);
  if (!fila || !passIgual_(pass, fila.pass)) {
    CacheService.getScriptCache().put(llave, String(fallos + 1), CFG.BLOQUEO_SEG);
    return json_({ ok: false, error: "usuario o contraseña incorrectos", code: "bad-credentials" });
  }

  CacheService.getScriptCache().remove(llave);
  return json_({
    ok: true,
    user: fila.user,
    role: fila.role,
    token: firmar_(fila.user, fila.role),
    expires: Date.now() + CFG.SESSION_TTL_SEG * 1000
  });
}

function buscarUsuario_(user) {
  var ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CFG.TAB_USERS);
  if (!sh) return null;

  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return null;

  var h = vals[0].map(function (x) { return String(x).trim().toUpperCase(); });
  var iU = h.indexOf("USUARIO");
  var iP = h.indexOf("CONTRASEÑA") >= 0 ? h.indexOf("CONTRASEÑA") : h.indexOf("CONTRASENA");
  var iR = h.indexOf("ROL");
  if (iU < 0 || iP < 0) return null;

  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][iU]).trim().toLowerCase() === user.toLowerCase()) {
      return {
        user: String(vals[i][iU]).trim(),
        pass: String(vals[i][iP]),
        role: iR >= 0 ? String(vals[i][iR]).trim().toLowerCase() : "ingreso"
      };
    }
  }
  return null;
}

/**
 * Acepta las dos formas para que puedas migrar sin tocar codigo:
 *   - "1234"        -> texto plano (como esta hoy)
 *   - "hmac:xxxxx"  -> hash HMAC-SHA256 con PASS_SALT
 * Cuando cambies la columna a hash, esto sigue funcionando solo.
 */
function passIgual_(pass, guardado) {
  var g = String(guardado || "");
  if (g.indexOf("hmac:") === 0) {
    return igual_(hashPass_(pass), g.slice(5));
  }
  return igual_(String(pass), g);
}

function hashPass_(pass) {
  return Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(String(pass), CFG.PASS_SALT)
  );
}

// ------------------------------------------------------------------
// Tokens
// ------------------------------------------------------------------

function firmar_(user, role) {
  var exp = Date.now() + CFG.SESSION_TTL_SEG * 1000;
  var cuerpo = user + "|" + role + "|" + exp;
  var firma = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(cuerpo, CFG.SECRET)
  );
  return Utilities.base64EncodeWebSafe(cuerpo + "|" + firma);
}

function verificar_(token) {
  if (!token) return null;
  var bruto;
  try {
    bruto = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
  } catch (e) {
    return null;
  }

  var p = bruto.split("|");
  if (p.length !== 4) return null;

  var user = p[0], role = p[1], exp = Number(p[2]), firma = p[3];
  if (!exp || Date.now() > exp) return null;

  var esperado = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(user + "|" + role + "|" + exp, CFG.SECRET)
  );
  if (!igual_(esperado, firma)) return null;   // token falseado

  return { user: user, role: role, expires: exp };
}

function igual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ------------------------------------------------------------------
// Lecturas
// ------------------------------------------------------------------

function directorio_() {
  var datos = leerTabla_(CFG.TAB_PROPIETARIOS);
  if (!datos.ok) return json_(datos);
  return json_({
    ok: true,
    headers: datos.headers,
    rows: datos.rows,
    records: datos.records,
    count: datos.rows.length
  });
}

function cancelado_() {
  var ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CFG.TAB_CANCELADO);
  if (!sh) return json_({ ok: true, cancelado: {} });

  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return json_({ ok: true, cancelado: {} });

  var h = vals[0].map(function (x) { return String(x).trim().toUpperCase(); });
  var iV = h.indexOf(String(CFG.COL_CANCELADO).toUpperCase());
  var iM = h.indexOf(String(CFG.COL_CANCELADO_MZ).toUpperCase());
  var iA = h.indexOf(String(CFG.COL_CANCELADO_ANIO).toUpperCase());
  if (iV < 0) return json_({ ok: true, cancelado: {} });

  var mapa = {};
  for (var i = 1; i < vals.length; i++) {
    var mz = iM >= 0 ? String(vals[i][iM]).trim() : "";
    if (!mz) continue;
    var texto = String(vals[i][iV]).trim();
    var anio = iA >= 0 ? String(vals[i][iA]).trim() : "";
    // Solo junta el año si el texto no trae uno ya.
    if (anio && !/\d{4}/.test(texto)) texto = texto + " " + anio;
    mapa[mz] = texto;
  }
  return json_({ ok: true, cancelado: mapa });
}

function leerTabla_(nombre) {
  var ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(nombre);
  if (!sh) return { ok: false, error: "no existe la pestana " + nombre };

  var vals = sh.getDataRange().getValues();
  if (!vals.length) return { ok: true, headers: [], rows: [], records: [] };

  var headers = vals[0].map(function (x) { return String(x).trim(); });
  var rows = [], records = [];

  for (var i = 1; i < vals.length; i++) {
    var vacia = true;
    for (var k = 0; k < vals[i].length; k++) {
      if (String(vals[i][k]).trim() !== "") { vacia = false; break; }
    }
    if (vacia) continue;

    var fila = [];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var v = vals[i][j] instanceof Date ? formatFecha_(vals[i][j]) : String(vals[i][j]);
      fila.push(v);
      obj[headers[j]] = v;
    }
    rows.push(fila);
    records.push(obj);
  }
  return { ok: true, headers: headers, rows: rows, records: records };
}

function formatFecha_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function parseBody_(e) {
  try {
    return JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return {};
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
