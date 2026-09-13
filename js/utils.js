/*
 * ============================================================
 *  UTILIDADES: parser CSV, normalización de texto,
 *  extracción de teléfonos y placas.
 * ============================================================
 */

/* ---------- Normalización de texto para búsquedas ---------- */
function normalizeText(value) {
  if (value == null) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quita acentos
    .replace(/[^a-z0-9]/g, "");        // quita espacios, guiones, puntos...
}

function collapseSpaces(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toTitleCase(value) {
  var s = collapseSpaces(value);
  return s.replace(/\w\S*/g, function (t) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  });
}

/* ---------- Parser CSV compatible con RFC 4180 ---------- */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  var i = 0;

  while (i < text.length) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
      i++; continue;
    }
    field += ch; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(function (r) {
    return r.some(function (c) { return String(c).trim() !== ""; });
  });
}

/* ---------- Teléfonos ---------- */
/* Extrae todos los números (7+ dígitos) que haya en la casilla,
   sin importar si están separados por " - ", espacios, "/", ","...
   Si countryCode viene dado (ej. "591"), lo quita para guardar el
   número local (sin prefijo). */
function extractPhones(value, countryCode) {
  if (value == null) return [];
  var raw = String(value);
  var cc = String(countryCode || "");
  var out = [];
  var re = /(\d{7,14})/g;
  var m;
  while ((m = re.exec(raw)) !== null) {
    var d = m[1];
    if (cc && d.indexOf(cc) === 0 && d.length > cc.length) d = d.slice(cc.length);
    if (d.length >= 7 && out.indexOf(d) === -1) out.push(d);
  }
  return out;
}

/* Convierte un número local a formato internacional para marcar. */
function toDialNumber(raw, countryCode) {
  var d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 11 && d.indexOf(countryCode) === 0) return d;
  if (d.length === 10) return d;
  if (d.length === 9 && d.charAt(0) === "0") return countryCode + d.slice(1);
  if (d.length >= 7 && d.length <= 9) return countryCode + d;
  return d;
}

function formatPhoneDisplay(digits) {
  if (!digits) return "";
  if (digits.length === 8) return digits.slice(0, 4) + " " + digits.slice(4);
  if (digits.length >= 9) return digits.slice(0, 3) + " " + digits.slice(3, 7) + " " + digits.slice(7);
  return digits;
}

/* ---------- Placas de vehículo ---------- */
function extractPlates(value) {
  if (value == null) return [];
  var raw = String(value).toUpperCase();
  var tokens = raw.split(/[\s,;/]+/);
  var out = [];
  tokens.forEach(function (t) {
    t = t.trim();
    if (t.length >= 3 && /[A-Z0-9]/.test(t) && out.indexOf(t) === -1) out.push(t);
  });
  return out;
}

/* ---------- Fechas / hora ---------- */
function pad2(n) { return (n < 10 ? "0" : "") + n; }

function nowStamp() {
  return {
    ts: Date.now(),
    date: new Date(),
    time: pad2(new Date().getHours()) + ":" + pad2(new Date().getMinutes()) + ":" + pad2(new Date().getSeconds()),
    dateLabel: pad2(new Date().getDate()) + "/" + pad2(new Date().getMonth() + 1) + "/" + new Date().getFullYear()
  };
}

function isToday(ts) {
  var d = new Date(ts);
  var n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function sameDateKey(ts) {
  var d = new Date(ts);
  return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
}

function escapeHTML(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Estado (VIGENTE / EN MORA) ---------- */
function statusOf(value) {
  var s = String(value == null ? "" : value).trim().toLowerCase();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/mor|adeuda|debe/.test(s)) return "mora";
  if (/vigente|al dia|ok$|^ok/.test(s)) return "vigente";
  return "otro";
}

function statusLabel(value) {
  var s = String(value == null ? "" : value).trim();
  return s ? s : "Sin estado";
}