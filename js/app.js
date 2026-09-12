/*
 * ============================================================
 *  APP: Control de Ingreso - Urbanización Rosas del Este
 *  Búsqueda de vecinos por manzano, nombre, celular o placa.
 * ============================================================
 */

/* ---------------- Estado global ---------------- */
var state = {
  rows: [],          // registros procesados
  loaded: false,
  sourceLabel: "",
  loadedAt: null,
  query: "",
  scope: "all",      // all | block | owner | phone | plate
  tab: "all",        // all | vigente | mora
  selected: null,
  view: "directorio" // directorio | bitacora | form
};

var CACHE_KEY = "rde_cache_v1";
var BITACORA_KEY = "rde_bitacora_v1";

/* ---------------- Elementos ---------------- */
var $ = function (id) { return document.getElementById(id); };

/* ---------------- Columnas conocidas ---------------- */
var COLUMN_RULES = [
  { key: "block",    aliases: ["mazano", "manzano", "bloque", "nro manzano", "nro mazano", "manzano no"], matchAny: ["mazo", "manz", "bloque"] },
  { key: "owner",    aliases: ["propietario", "propietarios", "propietario(s)", "propietario (s)"], matchAny: ["propiet", "propietario", "nombre propiet"] },
  { key: "phone",    aliases: ["no celular", "no telefono", "celular", "telefono", "cel", "cel.", "numero de celular"], matchAny: ["celular", "telefono", "cel", "movil"] },
  { key: "plate",    aliases: ["placa", "placa vehiculo", "placa del vehiculo", "placa veh", "matricula", "patente"], matchAny: ["placa", "matric", "patente", "vehic", "veh"] },
  { key: "moroso",   aliases: ["moroso", "situacion pago", "estado pago"], matchAny: ["moroso"] },
  { key: "estado",   aliases: ["estado", "situacion" ], matchAny: [] }
];

function mapColumns(headers) {
  var map = {};     // key -> index
  var extras = [];  // {label, index}
  var used = [];

  headers.forEach(function (h, i) {
    var n = normalizeText(h);
    var assigned = false;
    COLUMN_RULES.forEach(function (rule) {
      if (assigned) return;
      var hit = rule.aliases.indexOf(n) !== -1;
      if (!hit && rule.matchAny) {
        rule.matchAny.forEach(function (frag) {
          if (!hit && fragments(n)) {
            var nf = n;
            if (nf.indexOf(frag) !== -1 && rule.key === "block" && nf.indexOf("mazo") !== -1) hit = true;
            if (nf.indexOf(frag) !== -1 && (rule.key === "owner" || rule.key === "phone" || rule.key === "plate")) hit = true;
          }
        });
      }
      if (hit) {
        map[rule.key] = i;
        used.push(i);
        assigned = true;
      }
    });
  });

  // Prioridad: si existe columna "moroso" usar esa como estado, sino "estado".
  var statusIdx = map.moroso != null ? map.moroso : map.estado;
  // Si "estado" no es el estado final (caso: tabla detallada con columna MOROSO),
  // mostrarlo como detalle extra en la ficha.
  if (map.estado != null && statusIdx !== map.estado) {
    used = used.filter(function (i) { return i !== map.estado; });
  }

  headers.forEach(function (h, i) {
    if (used.indexOf(i) !== -1) return;
    if (i === statusIdx) return;
    extras.push({ label: collapseSpaces(h) || ("Columna " + (i + 1)), index: i });
  });

  return { statusIdx: statusIdx, blockIdx: map.block, ownerIdx: map.owner, phoneIdx: map.phone, plateIdx: map.plate, extras: extras };
}

function fragments(n) { return n; }

/* ---------------- Procesado de registros ---------------- */
function buildRows(cols, records) {
  var m = mapColumns(cols);
  var cc = String(APP_CONFIG.COUNTRY_CODE || "591");

  var seen = {};
  var rows = [];

  records.forEach(function (rec) {
    var cell = function (idx) {
      return idx == null ? null : rec[idx];
    };

    var blockRaw = cell(m.blockIdx);
    var ownerRaw = cell(m.ownerIdx);
    var statusRaw = cell(m.statusIdx);
    var status = statusOf(statusRaw);
    var phones = extractPhones(cell(m.phoneIdx));
    var plates = extractPlates(cell(m.plateIdx));

    var block = collapseSpaces(blockRaw);
    if (!block && !ownerRaw) return;

    // Deduplicación básica (filas repetidas en la hoja)
    var key = normalizeText(block) + "|" + normalizeText(ownerRaw);
    if (seen[key] && seen[key].found) return;
    seen[key] = { found: true };

    var extra = [];
    m.extras.forEach(function (ex) {
      var v = cell(ex.index);
      if (v != null && String(v).trim() !== "") {
        extra.push({ label: ex.label, value: collapseSpaces(v) });
      }
    });

    rows.push({
      block: block,
      ownerName: collapseSpaces(ownerRaw),
      ownerParts: splitOwners(ownerRaw),
      phones: phones,
      phonesDial: phones.map(function (p) { return toDialNumber(p, cc); }),
      plates: plates,
      statusRaw: statusLabel(statusRaw),
      status: status,
      statusScore: status === "vigente" ? 2 : status === "mora" ? 1 : 0,
      extra: extra,
      searchText: normalizeText([block, ownerRaw, phones.join(" "), plates.join(" "), statusLabel(statusRaw)].join(" "))
    });
  });

  return rows;
}

function splitOwners(raw) {
  if (!raw) return [];
  var parts = String(raw).split(/\s-\s+/);
  var out = [];
  parts.forEach(function (p) {
    p = collapseSpaces(p);
    if (p) out.push(p);
  });
  return out;
}

/* ---------------- Carga de datos ---------------- */
function gvizURL(sheetName, cbName) {
  var url = "https://docs.google.com/spreadsheets/d/" + APP_CONFIG.SPREADSHEET_ID +
    "/gviz/tq?tqx=out:json;responseHandler:" + cbName;
  if (sheetName) url += "&sheet=" + encodeURIComponent(sheetName);
  return url;
}

function loadViaJSONP(sheetName, cb) {
  var cbName = "pi" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  var done = false;
  var cleanup = function () {
    clearTimeout(timer);
    var s = document.getElementById(cbName);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    delete window[cbName];
  };
  var timer = setTimeout(function () {
    if (done) return;
    done = true;
    cleanup();
    cb(new Error("timeout"));
  }, 20000);

  window[cbName] = function (data) {
    if (done) return;
    done = true;
    cleanup();
    try {
      if (!data || data.status !== "ok" || !data.table) throw new Error("respuesta inválida");
      var cols = (data.table.cols || []).map(function (c) { return c.label || c.id; });
      var rows = (data.table.rows || []).map(function (r) {
        return (r.c || []).map(function (c) {
          if (c == null) return null;
          return c.f != null ? c.f : (c.v != null ? c.v : null);
        });
      });
      cb(null, { cols: cols, rows: rows });
    } catch (e) {
      cb(e);
    }
  };

  var s = document.createElement("script");
  s.id = cbName;
  s.src = gvizURL(sheetName, cbName);
  s.async = true;
  s.onerror = function () {
    if (done) return;
    done = true;
    cleanup();
    cb(new Error("script error"));
  };
  document.head.appendChild(s);
}

function loadViaExportCSV(cb) {
  var url = "https://docs.google.com/spreadsheets/d/" + APP_CONFIG.SPREADSHEET_ID +
    "/export?format=csv&gid=0";
  fetch(url, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (text) {
      var rows = parseCSV(text.replace(/^\uFEFF/, ""));
      if (!rows.length) throw new Error("CSV vacío");
      cb(null, { cols: rows[0], rows: rows.slice(1) });
    })
    .catch(function (e) { cb(e); });
}

function cacheRows(rows) {
  if (!APP_CONFIG.OFFLINE_CACHE) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      rows: rows
    }));
  } catch (e) { /* sin espacio */ }
}

function loadCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (d && Array.isArray(d.rows) && d.rows.length) return d;
  } catch (e) { /* ignorar */ }
  return null;
}

function loadData(silent) {
  setStatus("loading", silent);

  var attempt = function (err) {
    if (!err) return;
    loadViaExportCSV(function (err2, result) {
      if (err2) {
        var cache = loadCache();
        if (cache) {
          state.rows = cache.rows;
          state.sourceLabel = "Datos locales · " + new Date(cache.ts).toLocaleString();
          state.loaded = true;
          state.loadedAt = cache.ts;
          afterLoad("cache");
          return;
        }
        setStatus("error", false);
        return;
      }
      finalize(result, "Google Sheets");
    });
  };

  loadViaJSONP(APP_CONFIG.SHEET_NAME, function (err, result) {
    if (!err) {
      finalize(result, "Google Sheets");
      return;
    }
    attempt(err);
  });

  function finalize(result, label) {
    var rows = buildRows(result.cols, result.rows);
    state.rows = rows;
    state.sourceLabel = label;
    state.loaded = true;
    state.loadedAt = Date.now();
    cacheRows(rows);
    afterLoad("live");
  }
}

function afterLoad(how) {
  state.loaded = true;
  renderSummary();
  applyFilters();
  if (how === "live") {
    setStatus("ok", false);
  }
}

/* ---------------- Indicador de estado ---------------- */
function setStatus(kind, silent) {
  var dot = $("statusDot");
  var label = $("statusLabel");
  if (!dot || !label) return;
  switch (kind) {
    case "loading":
      dot.className = "status-dot is-loading";
      label.textContent = "Cargando datos…";
      break;
    case "ok":
      dot.className = "status-dot is-ok";
      label.textContent = "En línea";
      break;
    case "cache":
      dot.className = "status-dot is-cache";
      label.textContent = "Sin conexión (datos guardados)";
      break;
    case "error":
      dot.className = "status-dot is-error";
      label.textContent = "Sin datos · Verifica la hoja";
      break;
  }
}

/* ---------------- Resumen ---------------- */
function counts() {
  var vig = 0, mora = 0;
  state.rows.forEach(function (r) {
    if (r.status === "vigente") vig++;
    else if (r.status === "mora") mora++;
  });
  return { total: state.rows.length, vig: vig, mora: mora };
}

function renderSummary() {
  var c = counts();
  $("tabAll").textContent = " Todos (" + c.total + ") ";
  $("tabVig").textContent = " Vigentes (" + c.vig + ") ";
  $("tabMora").textContent = " En mora (" + c.mora + ") ";
  $("metaInfo").textContent = state.sourceLabel
    ? state.sourceLabel + " · " + new Date(state.loadedAt).toLocaleTimeString()
    : "";
}

/* ---------------- Filtros ---------------- */
function filteredRows() {
  var nq = normalizeText(state.query);
  var rows = state.rows;

  if (state.tab === "vigente") rows = rows.filter(function (r) { return r.status === "vigente"; });
  else if (state.tab === "mora") rows = rows.filter(function (r) { return r.status === "mora"; });

  if (!nq) return rows;

  var scope = state.scope;
  var digits = String(state.query).replace(/\D/g, "");

  return rows.filter(function (r) {
    if (scope === "block") return normalizeText(r.block).indexOf(nq) !== -1;
    if (scope === "owner") return normalizeText(r.ownerName).indexOf(nq) !== -1;
    if (scope === "phone") return r.phones.some(function (p) { return p.indexOf(digits) !== -1; });
    if (scope === "plate") return r.plates.some(function (p) { return normalizeText(p).indexOf(nq) !== -1; });
    return r.searchText.indexOf(nq) !== -1;
  });
}

function applyFilters() {
  if (!state.loaded) return;
  var rows = filteredRows();
  renderCards(rows);
}

/* ---------------- Render tarjetas ---------------- */
function renderCards(rows) {
  var wrap = $("results");
  var empty = $("empty");
  var count = $("countLine");

  if (!count) return;
  if (state.query) {
    count.innerHTML = "<strong>" + rows.length + "</strong> resultado" + (rows.length === 1 ? "" : "s") +
      " para «" + escapeHTML(state.query) + "»";
  } else if (state.tab !== "all") {
    count.innerHTML = "<strong>" + rows.length + "</strong> " +
      (state.tab === "vigente" ? "vigente" : "en mora") +
      (rows.length === 1 ? "" : "s");
  } else {
    var c = counts();
    count.innerHTML = "<strong>" + c.total + "</strong> vecinos";
  }

  wrap.innerHTML = "";

  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  var frag = document.createDocumentFragment();
  rows.forEach(function (r) { frag.appendChild(cardFor(r)); });
  wrap.appendChild(frag);
}

function cardFor(r) {
  var card = document.createElement("article");
  card.className = "card " + (r.status === "mora" ? "card-mora" : "");

  var top = document.createElement("div");
  top.className = "card-top";

  var block = document.createElement("span");
  block.className = "chip chip-block";
  block.textContent = r.block || "—";
  top.appendChild(block);

  top.appendChild(statusPill(r));

  var body = document.createElement("div");
  body.className = "card-body";

  var name = document.createElement("div");
  name.className = "card-name";
  name.textContent = r.ownerName || "Sin nombre";
  body.appendChild(name);

  if (r.plates.length) {
    var pl = document.createElement("div");
    pl.className = "plates-row";
    r.plates.forEach(function (p) {
      var chip = document.createElement("span");
      chip.className = "chip chip-plate";
      chip.textContent = p;
      pl.appendChild(chip);
    });
    body.appendChild(pl);
  }

  if (r.phones.length) {
    var ph = document.createElement("div");
    ph.className = "phones-row";
    r.phones.forEach(function (p, i) {
      var a = document.createElement("button");
      a.type = "button";
      a.className = "chip chip-phone";
      a.textContent = formatPhoneDisplay(p);
      a.title = "Llamar o WhatsApp";
      a.addEventListener("click", function (e) {
        e.stopPropagation();
        openPhoneSheet(p, r.phonesDial[i], r);
      });
      ph.appendChild(a);
    });
    body.appendChild(ph);
  }

  var foot = document.createElement("div");
  foot.className = "card-foot";
  var hint = document.createElement("span");
  hint.className = "card-hint";
  var n = 0;
  if (r.extra.length) n += r.extra.length;
  hint.textContent = (r.plates.length ? r.plates.length + " placa" + (r.plates.length > 1 ? "s" : "") + " · " : "") +
    "Toca para ver ficha";
  foot.appendChild(hint);
  foot.appendChild(arrow());
  body.appendChild(foot);

  card.appendChild(top);
  card.appendChild(body);

  card.addEventListener("click", function () { openDetail(r); });
  return card;
}

function statusPill(r) {
  var s = document.createElement("span");
  s.className = "pill " + (r.status === "vigente" ? "pill-vig" : r.status === "mora" ? "pill-mora" : "pill-otro");
  s.textContent = r.statusRaw || (r.status === "vigente" ? "VIGENTE" : r.status === "mora" ? "EN MORA" : "—");
  return s;
}

function arrow() {
  var i = document.createElement("span");
  i.className = "arrow";
  i.setAttribute("aria-hidden", "true");
  i.textContent = "›";
  return i;
}

/* ---------------- Detalle (ficha del vecino) ---------------- */
function openDetail(r) {
  state.selected = r;
  var ov = $("detailOverlay");
  var vig = r.status === "vigente";

  var banner = $("dtBanner");
  banner.className = "dt-banner " + (vig ? "banner-vig" : r.status === "mora" ? "banner-mora" : "banner-otro");
  banner.innerHTML = "";
  var bTitle = document.createElement("div");
  bTitle.className = "dt-banner-title";
  bTitle.textContent = vig ? "ACCESO AUTORIZADO" : r.status === "mora" ? "EN MORA" : (r.statusRaw || "ESTADO ESPECIAL");
  var bSub = document.createElement("div");
  bSub.className = "dt-banner-sub";
  bSub.textContent = vig
    ? "Vecino al día con la cuota de mantenimiento"
    : r.status === "mora"
      ? "Tiene deudas pendientes · verificar con administración"
      : r.statusRaw;
  banner.appendChild(bTitle);
  banner.appendChild(bSub);

  $("dtBlock").textContent = r.block || "—";

  var nameEl = $("dtName");
  nameEl.innerHTML = "";
  if (r.ownerParts && r.ownerParts.length > 1) {
    var ul = document.createElement("ul");
    ul.className = "dt-owners";
    r.ownerParts.forEach(function (n) {
      var li = document.createElement("li");
      li.textContent = n;
      ul.appendChild(li);
    });
    nameEl.appendChild(ul);
  } else {
    nameEl.textContent = r.ownerName || "Sin nombre";
  }

  var plateBox = $("dtPlates");
  plateBox.innerHTML = "";
  if (r.plates.length) {
    r.plates.forEach(function (p) {
      var pl = document.createElement("div");
      pl.className = "plate-box";
      pl.textContent = p;
      plateBox.appendChild(pl);
    });
  } else {
    var none = document.createElement("div");
    none.className = "plate-empty";
    none.textContent = "Sin placa registrada";
    plateBox.appendChild(none);
  }

  var phoneList = $("dtPhones");
  phoneList.innerHTML = "";
  if (r.phones.length) {
    r.phones.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "phone-row";

      var num = document.createElement("button");
      num.type = "button";
      num.className = "phone-num";
      num.textContent = formatPhoneDisplay(p);
      num.title = "Llamar o WhatsApp";
      num.addEventListener("click", function () { openPhoneSheet(p, r.phonesDial[i], r); });

      var actions = document.createElement("div");
      actions.className = "phone-actions";

      var callBtn = document.createElement("button");
      callBtn.type = "button";
      callBtn.className = "btn btn-dark btn-sm";
      callBtn.textContent = "Llamar";
      callBtn.addEventListener("click", function () { call(r.phonesDial[i]); });

      var waBtn = document.createElement("button");
      waBtn.type = "button";
      waBtn.className = "btn btn-green btn-sm";
      waBtn.textContent = "WhatsApp";
      waBtn.addEventListener("click", function () { whatsapp(r.phonesDial[i], r); });

      actions.appendChild(callBtn);
      actions.appendChild(waBtn);
      row.appendChild(num);
      row.appendChild(actions);
      phoneList.appendChild(row);
    });
  } else {
    var no = document.createElement("div");
    no.className = "phone-empty";
    no.textContent = "Sin número registrado";
    phoneList.appendChild(no);
  }

  var extraList = $("dtExtra");
  extraList.innerHTML = "";
  r.extra.forEach(function (ex) {
    var row = document.createElement("div");
    row.className = "dt-extra-row";
    var l = document.createElement("span");
    l.className = "dt-extra-label";
    l.textContent = ex.label + ":";
    var v = document.createElement("span");
    v.className = "dt-extra-value";
    v.textContent = ex.value;
    row.appendChild(l);
    row.appendChild(v);
    extraList.appendChild(row);
  });

  $("dtLlamar").onclick = function () {
    if (r.phonesDial.length) call(r.phonesDial[0]);
    else toast("No hay número de teléfono registrado");
  };
  $("dtWhatsapp").onclick = function () {
    if (r.phonesDial.length) whatsapp(r.phonesDial[0], r);
    else toast("No hay número de teléfono registrado");
  };
  $("dtCopiar").onclick = function () {
    if (!r.plates.length) { toast("No hay placa que copiar"); return; }
    var text = r.plates.join(", ");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Placa copiada"); });
    } else {
      toast("Placa: " + text);
    }
  };
  $("dtRegistrar").onclick = function () {
    addBitacora({ block: r.block, name: r.ownerName, plate: r.plates.join(", "), via: "directorio" });
  };

  ov.hidden = false;
  document.body.classList.add("locked");
}

function closeDetail() {
  $("detailOverlay").hidden = true;
  document.body.classList.remove("locked");
  state.selected = null;
}

/* ---------------- Acciones externas ---------------- */
function vib(duration) {
  if (navigator.vibrate) {
    try { navigator.vibrate(duration || 12); } catch (e) { /* sin vibración */ }
  }
}

function call(number) {
  if (!number) return;
  vib(12);
  location.href = "tel:+" + number;
}

function whatsapp(number, r) {
  var text = encodeURIComponent(
    "Hola, control de ingreso de la Urbanización Rosas del Este" +
    (r ? " · " + (r.block || "") + " · " + (r.ownerName || "") : "")
  );
  window.open("https://wa.me/" + number + "?text=" + text, "_blank");
}

/* ---------------- Hoja de acciones del teléfono ---------------- */
var phoneSheetState = { dial: "", resident: null };

function openPhoneSheet(number, dial, resident) {
  phoneSheetState.dial = dial || toDialNumber(number, APP_CONFIG.COUNTRY_CODE);
  phoneSheetState.resident = resident || null;
  $("psNumber").textContent = formatPhoneDisplay(String(number).replace(/\D/g, ""));
  $("phoneSheet").hidden = false;
  document.body.classList.add("locked");
  vib(10);
}

function closePhoneSheet() {
  $("phoneSheet").hidden = true;
  if (state.selected == null) document.body.classList.remove("locked");
  phoneSheetState.dial = "";
  phoneSheetState.resident = null;
}

/* ---------------- Bitácora ---------------- */
function getBitacora() {
  try {
    var raw = localStorage.getItem(BITACORA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function setBitacora(list) {
  try { localStorage.setItem(BITACORA_KEY, JSON.stringify(list)); } catch (e) { /* ignorar */ }
}

function addBitacora(data) {
  var st = nowStamp();
  var list = getBitacora();
  list.unshift({
    ts: st.ts,
    time: st.time,
    dateLabel: st.dateLabel,
    block: data.block || "",
    name: data.name || "",
    plate: data.plate || "",
    note: data.note || "",
    via: data.via || "manual"
  });
  setBitacora(list);
  renderBitacora();
  toast("Ingreso registrado " + st.time);
}

function removeBitacora(ts) {
  setBitacora(getBitacora().filter(function (e) { return e.ts !== ts; }));
  renderBitacora();
}

function clearTodayBitacora() {
  var today = sameDateKey(Date.now());
  var list = getBitacora().filter(function (e) { return e.dateLabel !== today; });
  setBitacora(list);
  renderBitacora();
  toast("Bitácora de hoy vaciada");
}

function renderBitacora(filterToday) {
  var list = getBitacora();
  if (filterToday) list = list.filter(function (e) { return e.dateLabel === sameDateKey(Date.now()); });

  var wrap = $("bitList");
  wrap.innerHTML = "";

  var countLine = $("bitCount");
  countLine.textContent = list.length + " registro" + (list.length === 1 ? "" : "s");

  if (!list.length) {
    var empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "Aún no hay registros.<br>Usa <strong>Ingreso</strong> o la ficha de un vecino.";
    wrap.appendChild(empty);
    return;
  }

  var frag = document.createDocumentFragment();
  list.forEach(function (e) {
    var item = document.createElement("div");
    item.className = "bit-item";

    var time = document.createElement("div");
    time.className = "bit-time";
    time.textContent = e.dateLabel + " · " + e.time;
    item.appendChild(time);

    var who = document.createElement("div");
    who.className = "bit-who";
    who.innerHTML = (e.block ? "<span class='chip chip-block chip-xs'>" + escapeHTML(e.block) + "</span> " : "") +
      "<strong>" + escapeHTML(e.name || "Ingreso externo") + "</strong>";
    item.appendChild(who);

    var foot = document.createElement("div");
    foot.className = "bit-foot";
    if (e.plate) {
      var pl = document.createElement("span");
      pl.className = "chip chip-plate chip-xs";
      pl.textContent = e.plate;
      foot.appendChild(pl);
    }
    if (e.via) {
      var v = document.createElement("span");
      v.className = "bit-via";
      v.textContent = e.via === "directorio" ? "desde ficha" : "manual";
      foot.appendChild(v);
    }
    item.appendChild(foot);

    var del = document.createElement("button");
    del.type = "button";
    del.className = "bit-del";
    del.title = "Eliminar registro";
    del.innerHTML = svgTrash();
    del.addEventListener("click", function () { removeBitacora(e.ts); });
    item.appendChild(del);

    frag.appendChild(item);
  });
  wrap.appendChild(frag);
}

function exportBitacoraCSV() {
  var list = getBitacora();
  if (!list.length) { toast("No hay registros para exportar"); return; }
  var esc = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
  var lines = [["Fecha", "Hora", "Manzano", "Nombre", "Placa", "Origen"].map(esc).join(",")];
  list.forEach(function (e) {
    lines.push([e.dateLabel, e.time, e.block, e.name, e.plate, e.via].map(esc).join(","));
  });
  var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bitacora_ingresos_" + sameDateKey(Date.now()).replace(/\//g, "-") + ".csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  toast("CSV descargado");
}

/* ---------------- Vistas (bottom nav) ---------------- */
function switchView(view) {
  state.view = view;
  $("viewDirectorio").hidden = view !== "directorio";
  $("viewBitacora").hidden = view !== "bitacora";
  $("viewForm").hidden = view !== "form";

  var nav = document.querySelectorAll("#bottomNav .nav-item");
  nav.forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-view") === view);
  });

  $("badgeBitacora").hidden = true;

  if (view === "bitacora") {
    renderBitacora($("bitToday").checked);
  } else if (view === "directorio") {
    var inp = $("searchInput");
    inp.focus();
    inp.select();
  }
}

/* ---------------- SVG iconos ---------------- */
function svgTrash() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
}

/* ---------------- Toast ---------------- */
var toastTimer = null;
function toast(msg) {
  var el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
}

/* ---------------- Formulario manual ---------------- */
function submitManualEntry(ev) {
  ev.preventDefault();
  var name = collapseSpaces($("formNombre").value);
  var block = collapseSpaces($("formManzano").value);
  var plate = collapseSpaces($("formPlaca").value).toUpperCase();
  var note = collapseSpaces($("formNota").value);

  if (!name && !block && !plate) {
    toast("Escribe al menos un dato");
    return;
  }
  addBitacora({ block: block, name: name, plate: plate, note: note, via: "manual" });
  ev.target.reset();
  switchView("bitacora");
}

/* ---------------- Instalación PWA ---------------- */
var deferredPrompt = null;
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  deferredPrompt = e;
  var b = $("installBtn");
  b.style.display = "";
  b.addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      b.style.display = "none";
    });
  });
});

/* ---------------- Init ---------------- */
function init() {
  // persianas de estado
  $("statusDot").className = "status-dot is-loading";
  $("statusLabel").textContent = "Cargando datos…";

  // fecha del día
  var d = new Date();
  var days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  $("todayLabel").textContent = days[d.getDay()] + ", " + d.getDate() + " de " + months[d.getMonth()];

  // búsqueda
  $("searchInput").addEventListener("input", function (e) {
    state.query = e.target.value;
    applyFilters();
  });
  $("searchInput").addEventListener("keydown", function (e) {
    if (e.key === "Escape") { this.value = ""; state.query = ""; applyFilters(); }
  });

  document.querySelectorAll(".scope-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.scope = chip.getAttribute("data-scope");
      document.querySelectorAll(".scope-chip").forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      applyFilters();
      $("searchInput").focus();
    });
  });

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      applyFilters();
    });
  });

  // navegación inferior
  document.querySelectorAll("#bottomNav .nav-item").forEach(function (b) {
    b.addEventListener("click", function () { switchView(b.getAttribute("data-view")); });
  });

  // formulario manual
  $("formEntrada").addEventListener("submit", submitManualEntry);

  // bitácora
  $("bitToday").addEventListener("change", function () { renderBitacora(this.checked); });
  $("bitExport").addEventListener("click", exportBitacoraCSV);
  $("bitClear").addEventListener("click", function () {
    if (confirm("¿Vaciar los ingresos de hoy?")) clearTodayBitacora();
  });

  // cierre de overlays
  $("dtClose").addEventListener("click", closeDetail);
  $("bitClose").addEventListener("click", function () { switchView("directorio"); });
  $("formClose").addEventListener("click", function () { switchView("directorio"); });
  $("newEntryBtn").addEventListener("click", function () { switchView("form"); });

  // hoja de acciones del teléfono
  $("psCall").addEventListener("click", function () {
    var dial = phoneSheetState.dial;
    closePhoneSheet();
    call(dial);
  });
  $("psWa").addEventListener("click", function () {
    var dial = phoneSheetState.dial;
    var res = phoneSheetState.resident;
    closePhoneSheet();
    whatsapp(dial, res);
  });
  $("psCancel").addEventListener("click", closePhoneSheet);
  $("phoneSheet").addEventListener("click", function (e) {
    if (e.target === this) closePhoneSheet();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!$("phoneSheet").hidden) { closePhoneSheet(); return; }
      if (!$("detailOverlay").hidden) closeDetail();
    }
  });

  // atajos de teclado
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && state.view === "directorio") {
      e.preventDefault();
      $("searchInput").focus();
    }
  });

  loadData(false);

  if (APP_CONFIG.AUTO_REFRESH_MIN && APP_CONFIG.AUTO_REFRESH_MIN > 0) {
    setInterval(function () { loadData(true); }, APP_CONFIG.AUTO_REFRESH_MIN * 60000);
  }

  // registro del service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* offline no requerido */ });
  }
}

document.addEventListener("DOMContentLoaded", init);