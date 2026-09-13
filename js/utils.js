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

/* Convierte "M21 - 21", "M21-01" o "M22 _03" en "Manzano 21 - Lote 21". */
function formatBlockLabel(value) {
  if (value == null) return "";
  var s = collapseSpaces(String(value)).replace(/[\u2013\u2014\-_\/]+/g, "-");
  var m = /^[^\d]*(\d+)\s*-\s*(\d+)/.exec(s);
  if (m) return "Manzano " + m[1] + " - Lote " + m[2];
  var n = /^[^\d]*(\d+)/.exec(s);
  if (n) return "Manzano " + n[1];
  return s;
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
/* Extrae todos los números (7+ dígitos) de la casilla CELULAR,
   reconstruyendo números escritos con espacios o guiones internos
   (ej. "7603 6960 - 7903 9893", "76-036-960", "59171234567").
   Si countryCode viene dado (ej. "591"), lo quita para guardar el
   número local (sin prefijo). */
function extractPhones(value, countryCode) {
  if (value == null) return [];
  var raw = String(value);
  var cc = String(countryCode || "");
  var re = /(\d+)/g;
  var groups = [];
  var m;
  while ((m = re.exec(raw)) !== null) {
    groups.push({ d: m[1], start: m.index, end: m.index + m[1].length });
  }

  var out = [];
  var i = 0;
  while (i < groups.length) {
    var s = "";
    var j = i;
    var formed = null;
    while (j < groups.length) {
      if (j > i) {
        var gap = groups[j].start - groups[j - 1].end;
        if (gap > 4) break; // demasiado separados: son números distintos
      }
      s += groups[j].d;
      var local = s;
      if (cc && local.length > cc.length && local.indexOf(cc) === 0) local = local.slice(cc.length);
      if (local.length >= 7 && local.length <= 10) { formed = local; break; }
      j++;
    }
    if (formed) {
      if (out.indexOf(formed) === -1) out.push(formed);
      i = j + 1; // salta los grupos ya usados
    } else {
      i++;
    }
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