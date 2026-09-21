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
  query: "",
  tab: "all",        // all | vigente | mora
  selected: null,
  view: "directorio", // directorio | bitacora | form
  cobranzaIdx: 0     // número elegido en el recordatorio (si hay varios)
};

var CACHE_KEY = "rde_cache_v1";
var BITACORA_KEY = "rde_bitacora_v1";
var SESSION_KEY = "rde_session_v1";

/* ---------------- Botón atrás del teléfono (Android) ----------------
   Patrón más usado en PWAs: un "centinela" de historial intercepta el
   botón atrás. Si hay overlays o una vista secundaria abierta, regresa
   dentro de la app; en la pantalla principal avisa (discreto) que hay
   que presionar atrás otra vez para salir. */
var backGuard = { armed: false, last: 0 };

function rearmBackGuard() {
  try { window.history.pushState({ rdeGuard: 1 }, ""); } catch (e) { /* sin historial */ }
}

function onBackPressed() {
  // 1) Cerrar el overlay más profundo que esté abierto.
  if (!$("loginOverlay").hidden) { closeLogin(); return; }
  if (!$("cobranzaOverlay").hidden) { closeCobranza(); return; }
  if (!$("phoneSheet").hidden) { closePhoneSheet(); return; }
  if (!$("detailOverlay").hidden) { closeDetail(); return; }

  // 2) Si se está en una vista secundaria, volver a la principal.
  if (state.view !== "directorio") { switchView("directorio"); return; }

  // 3) Pantalla principal: aviso de doble atrás para salir.
  var now = Date.now();
  if (!backGuard.armed || now - backGuard.last > 2200) {
    backGuard.armed = true;
    backGuard.last = now;
    toast("Para salir, presiona atrás otra vez");
    rearmBackGuard();
    return;
  }

  // Segundo atrás dentro de la ventana: salir de la app.
  backGuard.armed = false;
  if (history.length > 1) history.back();
}

function setupBackButton() {
  window.addEventListener("popstate", function () {
    rearmBackGuard();
    onBackPressed();
  });
  rearmBackGuard();
}

/* ---------------- Instalación PWA ---------------- */
var deferredPrompt = null;

function setupInstallPrompt() {
  var btn = $("installBtn");
  if (!btn) return;

  // Ya está instalada como app: no mostrar el botón.
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;

  // Chrome/Android/Desktop avisan que se puede instalar.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener("click", function () {
    vib(10);
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      if (choice.outcome === "accepted") {
        toast("Instalando aplicación…");
        btn.hidden = true;
      } else {
        toast("Puedes instalar desde el menú ⋮ del navegador");
      }
      deferredPrompt = null;
    });
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    btn.hidden = true;
    toast("Aplicación instalada");
  });
}

/* ---------------- Sesión de administración ---------------- */
function getSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (s && s.user && s.role) return s;
  } catch (e) { /* ignorar */ }
  return null;
}

function setSession(user, role) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, role: role, ts: Date.now() }));
  } catch (e) { /* ignorar */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignorar */ }
}

function isAdmin() {
  var s = getSession();
  return !!(s && s.role === "admin");
}

function openLogin() {
  var s = getSession();
  $("loginError").hidden = true;
  $("loginForm").hidden = !!s;
  $("loginSession").hidden = !s;
  if (s) {
    $("sessionUser").textContent = "Sesión iniciada: " + s.user;
  } else {
    $("loginUser").value = "";
    $("loginPass").value = "";
    setTimeout(function () { $("loginUser").focus(); }, 80);
  }
  $("loginOverlay").hidden = false;
  document.body.classList.add("locked");
}

function closeLogin() {
  $("loginOverlay").hidden = true;
  document.body.classList.remove("locked");
}

/* Pantalla de inicio: bloquea la app hasta iniciar sesión */
function showGate() {
  $("gateError").hidden = true;
  $("gateUser").value = "";
  $("gatePass").value = "";
  $("loginScreen").hidden = false;
  document.body.classList.add("locked");
  setTimeout(function () { $("gateUser").focus(); }, 90);
}

function hideGate() {
  $("loginScreen").hidden = true;
  document.body.classList.remove("locked");
}

function ensureGate() {
  if (getSession()) hideGate(); else showGate();
}

function onLoginSuccess(match) {
  setSession(match.user, match.role);
  closeLogin();
  hideGate();
  toast(match.role === "admin" ? "Sesión de administrador iniciada" : "Sesión iniciada");
  refreshSessionTag();
  refreshAdminView();
  if (!$("viewBitacora").hidden) renderBitacora($("bitToday").checked);
  if (state.selected) openDetail(state.selected);
}

function roleOfUser(user, rol) {
  var u = normalizeText(user);
  var r = normalizeText(rol);
  if (/admin/.test(u) || /admin/.test(r)) return "admin";
  return r || "usuario";
}

function doLogin(user, pass, cb) {
  loadViaJSONP(APP_CONFIG.SHEET_USERS || "Usuarios", function (err, result) {
    if (err) { cb(new Error("No se pudo leer los usuarios. Revisa la conexión.")); return; }
    var idxU = 0, idxP = 1, idxR = -1;
    result.cols.forEach(function (c, i) {
      var n = normalizeText(c);
      if (/usu|nombre/.test(n) && !/cont/.test(n)) idxU = i;
      if (/cont|clave|pass/.test(n)) idxP = i;
      if (/rol|permiso|tipo/.test(n)) idxR = i;
    });
    var uNorm = normalizeText(user);
    var pNorm = normalizeText(pass);
    var candidates = [result.cols.slice()].concat(result.rows.slice());
    var match = null;
    candidates.forEach(function (row) {
      if (!row || row.length < 2) return;
      if (normalizeText(row[idxU]) === uNorm && normalizeText(row[idxP]) === pNorm) {
        match = {
          user: String(row[idxU] == null ? "" : row[idxU]).trim() || user,
          role: roleOfUser(row[idxU], row[idxR] != null && row.length > idxR ? String(row[idxR]) : "")
        };
      }
    });
    if (!match) { cb(new Error("Usuario o contraseña incorrectos.")); return; }
    cb(null, match);
  });
}

/* ---------------- Elementos ---------------- */
var $ = function (id) { return document.getElementById(id); };

/* ---------------- Columnas conocidas ---------------- */
var COLUMN_RULES = [
  { key: "block",    aliases: ["mazano", "manzano", "bloque", "nro manzano", "nro mazano", "manzano no"], matchAny: ["mazo", "manz", "bloque"] },
  { key: "owner",    aliases: ["propietario", "propietarios", "propietario(s)", "propietario (s)"], matchAny: ["propiet", "propietario", "nombre propiet"] },
  { key: "phone",    aliases: ["no celular", "no telefono", "celular", "telefono", "cel", "cel.", "numero de celular"], matchAny: ["celular", "telefono", "cel", "movil"] },
  { key: "plate",    aliases: ["placa", "placa vehiculo", "placa del vehiculo", "placa veh", "matricula", "patente"], matchAny: ["placa", "matric", "patente", "vehic", "veh"] },
  { key: "location",  aliases: ["ubicacion", "ubicacion gps", "gps", "coordenadas", "coordenada", "latitud", "longitud", "lat, long"], matchAny: ["ubicacion", "gps", "coordenad", "mapa"] },
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
          if (!hit && n) {
            var nf = n;
            if (nf.indexOf(frag) !== -1 && rule.key === "block" && nf.indexOf("mazo") !== -1) hit = true;
            if (nf.indexOf(frag) !== -1 && (rule.key === "owner" || rule.key === "phone" || rule.key === "plate" || rule.key === "location")) hit = true;
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

  return { statusIdx: statusIdx, blockIdx: map.block, ownerIdx: map.owner, phoneIdx: map.phone, plateIdx: map.plate, locationIdx: map.location, extras: extras };
}

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
    var location = collapseSpaces(cell(m.locationIdx));
    var phones = extractPhones(cell(m.phoneIdx), APP_CONFIG.COUNTRY_CODE);
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
      location: location,
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
    "/gviz/tq?tqx=out:json;responseHandler:" + cbName +
    "&headers=1&rnd=" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
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
    "/gviz/tq?tqx=out:csv&headers=1&rnd=" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  if (APP_CONFIG.SHEET_NAME) url += "&sheet=" + encodeURIComponent(APP_CONFIG.SHEET_NAME);
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

/* Descarga la hoja en CRUDO por su gid. A diferencia de gviz, este
   export NO convierte los datos por tipo de columna: si la columna
   CELULAR está como número, Google borra las casillas con guiones o
   espacios (ej. "71616102 - 75015599") en gviz, pero aquí se
   conservan intactas. Es el método principal de lectura. */
function loadViaRawCSV(cb) {
  var gid = APP_CONFIG.SHEET_GID;
  if (!gid) { cb(new Error("sin gid")); return; }
  var url = "https://docs.google.com/spreadsheets/d/" + APP_CONFIG.SPREADSHEET_ID +
    "/export?format=csv&gid=" + encodeURIComponent(gid) +
    "&rnd=" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
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

function loadData() {
  if (state.loading) return;
  state.loading = true;
  var line = $("countLine");
  if (line && !state.loaded) line.textContent = "Cargando…";

  // 1) Export crudo por gid (conserva telefonos con guiones/espacios).
  // 2) gviz JSONP (fallback). 3) gviz CSV (fallback). 4) copia local.
  loadViaRawCSV(function (err, result) {
    if (!err) {
      finalize(result);
      return;
    }
    loadViaJSONP(APP_CONFIG.SHEET_NAME, function (err2, result2) {
      if (!err2) {
        finalize(result2);
        return;
      }
      loadViaExportCSV(function (err3, result3) {
        if (err3) {
          var cache = loadCache();
          if (cache) {
            state.rows = cache.rows;
            state.loaded = true;
            afterLoad();
          } else {
            showNetError();
          }
          state.loading = false;
          return;
        }
        finalize(result3);
      });
    });
  });

  function finalize(result) {
    var rows = buildRows(result.cols, result.rows);
    state.rows = rows;
    state.loaded = true;
    cacheRows(rows);
    hideNetError();
    afterLoad();
    state.loading = false;
  }
}

function showNetError() {
  var el = $("netError");
  var line = $("countLine");
  if (line) line.textContent = "Sin conexión";
  if (el) el.hidden = false;
}

function hideNetError() {
  var el = $("netError");
  if (el) el.hidden = true;
}

function afterLoad() {
  state.loaded = true;
  renderSummary();
  applyFilters();
  buildOwnerList();
  refreshAdminView();
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
  if ($("tabAll")) $("tabAll").textContent = " Todos (" + c.total + ") ";
  if ($("tabVig")) $("tabVig").textContent = " Vigentes (" + c.vig + ") ";
  if ($("tabMora")) $("tabMora").textContent = " En mora (" + c.mora + ") ";
}

/* ---------------- Filtros ---------------- */
function filteredRows() {
  var nq = normalizeText(state.query);
  var rows = state.rows;

  if (state.tab === "vigente") rows = rows.filter(function (r) { return r.status === "vigente"; });
  else if (state.tab === "mora") rows = rows.filter(function (r) { return r.status === "mora"; });

  if (!nq) return rows;

  return rows.filter(function (r) {
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

  if (!wrap || !empty) return;
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
  block.textContent = formatBlockLabel(r.block);
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

  $("dtBlock").textContent = formatBlockLabel(r.block) || "—";

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

  var locWrap = $("dtMapWrap");
  if (r.location) {
    var q = encodeURIComponent(r.location);
    var frame = $("dtMapFrame");
    frame.src = "https://maps.google.com/maps?q=" + q + "&z=17&output=embed";
    $("dtMapLink").href = "https://www.google.com/maps?q=" + q;
    locWrap.hidden = false;
  } else {
    locWrap.hidden = true;
    $("dtMapFrame").src = "";
  }

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
    addBitacora({ owner: r.ownerName, name: "", block: r.block, plate: r.plates.join(", "), via: "directorio" });
  };

  var admin = isAdmin();
  $("dtCobrar").hidden = !(admin && (r.status === "mora" || r.status === "vigente"));
  $("dtCobrar").className = "btn " + (r.status === "mora" ? "btn-cobranza" : "btn-cobranza-vig");
  $("dtCobrarLabel").textContent = r.status === "mora" ? "Enviar recordatorio de cobranza" : "Recordatorio de pago";

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
  window.open("https://wa.me/" + number, "_blank");
}

/* ---------------- Recordatorios de pago (solo administración) ---------------- */
function greetingNow() {
  var h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function cobranzaText(r) {
  var saludo = greetingNow();
  var nombre = String(r.ownerName || "").trim();
  var block = formatBlockLabel(r.block);
  var line1 = saludo + ", " + (nombre ? nombre + ", " : "") + "vecino de Rosas del Este" +
    (block ? " (" + block + ")" : "") + ".";

  return line1 + "\n\n" +
    "Le recordamos desde la Administración que sus expensas se encuentran pendientes. " +
    "Le invitamos a regularizar su pago a la brevedad para mantenerse al día con sus obligaciones.\n\n" +
    "Puede realizar su pago mediante el QR adjunto.\n\n" +
    "Le recordamos que estar al día con las expensas no solo evita recargos, " +
    "sino que le permite gozar de todos los beneficios de la urbanización y, además, " +
    "aporta a la plusvalía y al mantenimiento del valor de su vivienda dentro de Rosas del Este.\n\n" +
    "Si ya regularizó su situación, por favor ignore este mensaje.\n\n" +
    "¡Gracias por su atención!\n\n" +
    "Administración Rosas del Este Zona Sur";
}

function recordatorioText(r) {
  var saludo = greetingNow();
  var nombre = String(r.ownerName || "").trim() || "vecino";
  var block = formatBlockLabel(r.block);
  var line1 = saludo + ", estimado " + nombre + " de Rosas del Este" +
    (block ? " (" + block + ")" : "") + ".";

  return line1 + "\n\n" +
    "Le enviamos este recordatorio para que pueda realizar el pago de sus expensas mediante el QR adjunto.\n\n" +
    "Si usted ya realizó el pago, por favor ignore este mensaje. " +
    "¡Muchas gracias por su puntualidad y que tenga un excelente día!\n\n" +
    "Administración Rosas del Este Zona Sur";
}

var qrReady = false;

function loadQr() {
  var wrap = $("cobranzaQrWrap");
  var img = $("cobranzaQr");
  var path = APP_CONFIG.QR_IMAGE || "";
  qrReady = false;
  if (!path) { wrap.hidden = true; return; }
  img.onload = function () { qrReady = true; wrap.hidden = false; };
  img.onerror = function () { qrReady = false; wrap.hidden = true; };
  img.src = path;
}

function renderNumChips(r) {
  var box = $("cobranzaNums");
  var nums = r && r.phones && r.phones.length ? r.phones : [];
  if (nums.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
  box.innerHTML = "";
  nums.forEach(function (num, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "num-chip" + (i === 0 ? " active" : "");
    b.setAttribute("data-idx", String(i));
    b.textContent = formatPhoneDisplay(num);
    box.appendChild(b);
  });
  box.hidden = false;
  state.cobranzaIdx = 0;
}

function refreshCobranzaRecip() {
  var r = state.selected;
  if (!r) return;
  var mora = r.status === "mora";
  var idx = Math.min(state.cobranzaIdx || 0, (r.phones || []).length - 1);
  var num = r.phones && r.phones.length ? r.phones[idx] : null;
  var tel = num != null ? formatPhoneDisplay(num) : "Sin número registrado";
  var nombre = r.ownerName || "Vecino";
  $("cobranzaRecip").textContent = (mora ? "Cobranza · " : "Pago · ") + nombre +
    (r.block ? " · " + formatBlockLabel(r.block) : "") + " · " + tel;
}

var numChipsBound = false;
function bindNumChips() {
  if (numChipsBound) return;
  numChipsBound = true;
  $("cobranzaNums").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest(".num-chip") : null;
    if (!t) return;
    var idx = parseInt(t.getAttribute("data-idx"), 10);
    if (isNaN(idx)) return;
    state.cobranzaIdx = idx;
    Array.prototype.forEach.call(t.parentNode.children, function (c) {
      c.classList.remove("active");
    });
    t.classList.add("active");
    refreshCobranzaRecip();
    vib(6);
  });
}

function openCobranza() {
  var r = state.selected;
  if (!r) return;
  var mora = r.status === "mora";
  $("cobranzaTitle").textContent = mora ? "Recordatorio de cobranza" : "Recordatorio de pago";
  $("cobranzaMsg").value = mora ? cobranzaText(r) : recordatorioText(r);
  renderNumChips(r);
  refreshCobranzaRecip();
  loadQr();
  $("cobranzaOverlay").hidden = false;
  document.body.classList.add("locked");
  vib(10);
}

function closeCobranza() {
  $("cobranzaOverlay").hidden = true;
  if (state.selected == null) {
    document.body.classList.remove("locked");
  } else if ($("detailOverlay").hidden) {
    document.body.classList.remove("locked");
    state.selected = null;
  }
}

function copyCobranza() {
  var msg = $("cobranzaMsg").value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function () { toast("Mensaje copiado"); });
  } else {
    toast("No se pudo copiar en este navegador");
  }
}

function waDigits(r, idx) {
  idx = idx || 0;
  return r && r.phonesDial && r.phonesDial[idx]
    ? r.phonesDial[idx]
    : (r && r.phones && r.phones[idx] ? toDialNumber(r.phones[idx], APP_CONFIG.COUNTRY_CODE) : "");
}

function openWaFallback(dial, msg) {
  window.open("https://wa.me/" + dial + "?text=" + encodeURIComponent(msg), "_blank");
  toast("Adjunta el QR guardado en WhatsApp");
}

function sendCobranzaWA() {
  var r = state.selected;
  var dial = waDigits(r, state.cobranzaIdx);
  if (!dial) { toast("Sin número de WhatsApp para este vecino"); return; }
  var msg = $("cobranzaMsg").value;

  var canShare = typeof navigator.share === "function" && typeof navigator.canShare === "function";
  if (canShare && qrReady) {
    fetch(APP_CONFIG.QR_IMAGE)
      .then(function (res) { if (!res.ok) throw new Error("http"); return res.blob(); })
      .then(function (blob) {
        var file = new File([blob], "qr_pago.png", { type: blob.type || "image/png" });
        var data = { files: [file], text: msg };
        if (!navigator.canShare(data)) throw new Error("noshare");
        return navigator.share(data);
      })
      .then(function () { /* enviado o cancelado por el usuario */ })
      .catch(function (e) {
        if (e && e.name === "AbortError") return;
        openWaFallback(dial, msg);
      });
    return;
  }
  openWaFallback(dial, msg);
}

function saveQrImage() {
  var path = APP_CONFIG.QR_IMAGE;
  if (!path) { toast("No hay imagen QR configurada"); return; }
  fetch(path)
    .then(function (res) { if (!res.ok) throw new Error("http"); return res.blob(); })
    .then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "qr_pago.png";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
      toast("QR descargado");
    })
    .catch(function () { toast("No se pudo descargar el QR"); });
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
    var list = raw ? JSON.parse(raw) : [];
    var dirty = false;
    list.forEach(function (e) {
      if (!e.id) {
        e.id = (Number(e.ts) || Date.now()).toString(36) + "-legacy";
        dirty = true;
      }
      if (e.owner === undefined) { e.owner = ""; dirty = true; }
      if (e.note === undefined) { e.note = ""; dirty = true; }
    });
    if (dirty) setBitacora(list);
    return list;
  } catch (e) { return []; }
}

function setBitacora(list) {
  try { localStorage.setItem(BITACORA_KEY, JSON.stringify(list)); } catch (e) { /* ignorar */ }
}

/* ---------------- Bitácora (local + sincronizada) ----------------
   La bitácora se guarda en el dispositivo (para funcionar offline)
   y además se sincroniza con el web app de Google Apps Script
   (ver server/Bitacora.gs y BITACORA_URL en config.js). Si no hay
   URL configurada, la app funciona igual pero solo en ese celular. */
var BITACORA_URL_CACHED = undefined;

function bitacoraURL() {
  if (BITACORA_URL_CACHED === undefined) {
    BITACORA_URL_CACHED = String((APP_CONFIG.BITACORA_URL || "")).replace(/\/+$/, "");
  }
  return BITACORA_URL_CACHED;
}

var PENDING_KEY = "rde_pending_v1";

function getPending() {
  try {
    var raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function setPending(q) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(q)); } catch (e) { /* ignorar */ }
}

/* Borrados pendientes: si el guardia borra un registro sin internet,
   el borrado se anota aquí para NO revivir el registro al sincronizar
   y para enviarlo al servidor cuando haya conexión. */
var DELETED_KEY = "rde_deleted_v1";

function getDeleted() {
  try {
    var raw = localStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function setDeleted(list) {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(list)); } catch (e) { /* ignorar */ }
}

function addBitacora(data) {
  var st = nowStamp();
  var entry = {
    id: st.ts.toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36),
    ts: st.ts,
    time: st.time,
    dateLabel: st.dateLabel,
    block: data.block || "",
    owner: data.owner || "",
    name: data.name || "",
    plate: data.plate || "",
    note: data.note || "",
    via: data.via || "manual"
  };
  var list = getBitacora();
  list.unshift(entry);
  setBitacora(list);
  renderBitacora();
  toast("Ingreso registrado " + st.time);
  var q = getPending();
  q.push(entry);
  setPending(q);
  flushPending();
}

function removeBitacora(id) {
  if (!id) return;
  if (typeof confirm === "function" && !confirm("¿Eliminar este registro de la bitácora?")) return;
  setBitacora(getBitacora().filter(function (e) { return e.id !== id; }));
  setPending(getPending().filter(function (e) { return e.id !== id; }));
  renderBitacora($("bitToday").checked);
  toast("Registro eliminado");
  var dels = getDeleted();
  if (dels.indexOf(id) === -1) dels.push(id);
  setDeleted(dels);
  flushDeletes();
}

/* Envía al servidor los borrados pendientes, de a uno. Los que fallan
   (sin red) se mantienen en la lista para reintentar en el próximo ciclo. */
var deleting = false;

function flushDeletes() {
  var url = bitacoraURL();
  if (!url || deleting) return;
  var dels = getDeleted();
  if (!dels.length) return;
  deleting = true;
  var id = dels[0];
  fetch(url, {
    method: "POST",
    body: JSON.stringify({ action: "delete", id: id }),
    cache: "no-store"
  }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (j) {
    if (!j || !j.ok) throw new Error("no ok");
    setDeleted(getDeleted().filter(function (x) { return x !== id; }));
    deleting = false;
    flushDeletes();
  }).catch(function () {
    deleting = false;
  });
}

/* ---------------- Sincronización entre dispositivos ---------------- */
var syncing = false;

function pickRemote(x, keys, fallback) {
  for (var i = 0; i < keys.length; i++) {
    var v = x[keys[i]];
    if (v !== undefined && v !== null && String(v) !== "") return String(v);
  }
  return fallback || "";
}

function remoteTime(v) {
  var s = String(v || "");
  if (s.indexOf("T") !== -1) {
    var t = s.split("T")[1] || "";
    t = t.replace(/Z$/, "").split(".")[0];
    return t;
  }
  return s;
}

function remoteDate(v) {
  var s = String(v || "");
  var part = s.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(part)) {
    var d = part.split("-");
    return d[2] + "/" + d[1] + "/" + d[0];
  }
  return s;
}

function remoteTs(x) {
  var n = Number(x.ts);
  if (!isNaN(n) && n > 0) return n;
  var s = String(x.id || "").split("-")[0];
  var bn = parseInt(s, 36);
  return isNaN(bn) ? Date.now() : bn;
}

function normalizeRemote(x) {
  var e = x || {};
  var id = String(e.id || "");
  if (!id) id = String(e.ID || "");
  return {
    id: id,
    ts: remoteTs(e),
    time: remoteTime(pickRemote(e, ["hora", "time", "HORA", "Hora"])),
    dateLabel: remoteDate(pickRemote(e, ["fecha", "dateLabel", "FECHA", "Fecha"])),
    block: pickRemote(e, ["manzano", "block", "MANZANO"]),
    owner: pickRemote(e, ["propietario", "owner", "PROPIETARIO"]),
    name: pickRemote(e, ["visitante", "name", "VISITANTE"]),
    plate: pickRemote(e, ["placa", "plate", "PLACA"]),
    note: pickRemote(e, ["nota", "note", "NOTA"]),
    via: pickRemote(e, ["origen", "via", "ORIGEN"], "manual")
  };
}

var flushing = false;
function flushPending() {
  var url = bitacoraURL();
  if (!url || flushing) return;
  var q = getPending();
  if (!q.length) return;
  flushing = true;
  var sent = [];
  var failed = [];
  var i = 0;
  (function next() {
    if (i >= q.length) {
      var sentMap = {};
      sent.forEach(function (s) { sentMap[s] = 1; });
      setPending(getPending().filter(function (e) { return !sentMap[e.id]; }));
      flushing = false;
      updateSyncStatus(failed.length ? false : true);
      return;
    }
    var entry = q[i];
    fetch(url, {
      method: "POST",
      body: JSON.stringify({ action: "add", entry: entry }),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.ok) throw new Error("no ok");
      sent.push(entry.id);
      i++;
      next();
    }).catch(function () {
      failed.push(entry.id);
      i++;
      next();
    });
  })();
}

function fetchRemote(onDone) {
  var url = bitacoraURL();
  if (!url) { updateSyncStatus(null); if (onDone) onDone(); return; }
  if (syncing) { if (onDone) onDone(); return; }
  syncing = true;
  fetch(url + (url.indexOf("?") === -1 ? "?" : "&") + "action=list&rnd=" + Date.now(), { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (list) {
      if (!Array.isArray(list)) throw new Error("formato");
      var byId = {};
      var delsById = {};
      getDeleted().forEach(function (id) { delsById[id] = 1; });
      getBitacora().forEach(function (x) { if (x.id) byId[x.id] = x; });
      list.forEach(function (x) {
        var e = normalizeRemote(x);
        if (e.id && !byId[e.id] && !delsById[e.id]) byId[e.id] = e;
      });
      var merged = Object.keys(byId).map(function (k) { return byId[k]; });
      merged.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      setBitacora(merged);
      renderBitacora($("bitToday") ? $("bitToday").checked : undefined);
      updateSyncStatus(true);
    })
    .catch(function () { updateSyncStatus(false); })
    .then(function () {
      syncing = false;
      if (onDone) onDone();
    });
}

function syncBitacora() {
  flushPending();
  flushDeletes();
  if (bitacoraURL()) fetchRemote();
  else updateSyncStatus(null);
}

function updateSyncStatus(mode) {
  var el = $("bitSync");
  if (!el) return;
  if (mode === null) {
    el.className = "sync-pill sync-none";
    el.textContent = "Local";
    el.title = "Sin URL de sincronización (js/config.js > BITACORA_URL)";
  } else if (mode) {
    el.className = "sync-pill sync-ok";
    el.textContent = "En línea";
    el.title = "Sincronizado con todos los dispositivos";
  } else {
    el.className = "sync-pill sync-off";
    el.textContent = "Sin conexión";
    el.title = "Se reintentará automáticamente";
  }
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
    empty.innerHTML = "Aún no hay registros.<br>Usa <strong>Registro</strong> o la ficha de un vecino.";
    wrap.appendChild(empty);
    return;
  }

  var frag = document.createDocumentFragment();
  var lastDay = null;
  list.forEach(function (e) {
    if (e.dateLabel !== lastDay) {
      lastDay = e.dateLabel;
      var day = document.createElement("div");
      day.className = "bit-dayhead";
      day.textContent = dayHeaderLabel(e.dateLabel);
      frag.appendChild(day);
    }
    var item = document.createElement("div");
    item.className = "bit-item";

    var time = document.createElement("div");
    time.className = "bit-time";
    time.textContent = e.dateLabel + " · " + e.time;
    item.appendChild(time);

    var who = document.createElement("div");
    who.className = "bit-who";
    who.innerHTML = (e.block ? "<span class='chip chip-block chip-xs'>" + escapeHTML(e.block) + "</span> " : "") +
      "<strong>" + escapeHTML(e.owner || e.name || "Ingreso externo") + "</strong>";
    if (e.owner && e.name) {
      var vis = document.createElement("span");
      vis.className = "bit-via";
      vis.innerHTML = "Visitante: <strong>" + escapeHTML(e.name) + "</strong>";
      who.appendChild(vis);
    }
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

    if (e.note) {
      var note = document.createElement("div");
      note.className = "bit-note";
      note.innerHTML = "Nota: <span>" + escapeHTML(e.note) + "</span>";
      item.appendChild(note);
    }

    if (isAdmin()) {
      var del = document.createElement("button");
      del.type = "button";
      del.className = "bit-del";
      del.setAttribute("aria-label", "Eliminar registro");
      del.innerHTML = svgTrash();
      del.addEventListener("click", function () { removeBitacora(e.id); });
      item.appendChild(del);
    }

    frag.appendChild(item);
  });
  wrap.appendChild(frag);
}

function exportBitacoraCSV() {
  var list = getBitacora();
  if (!list.length) { toast("No hay registros para exportar"); return; }
  var esc = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
  var csvProp = function (e) { return e.owner || (e.via === "directorio" ? e.name : ""); };
  var csvVis = function (e) { return e.owner ? e.name : (e.via === "directorio" ? "" : e.name); };
  var lines = [["Fecha", "Hora", "Manzano", "Propietario", "Visitante", "Placa", "Nota", "Origen"].map(esc).join(",")];
  list.forEach(function (e) {
    lines.push([e.dateLabel, e.time, e.block, csvProp(e), csvVis(e), e.plate, e.note, e.via].map(esc).join(","));
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
  $("viewAdmin").hidden = view !== "admin";

  var nav = document.querySelectorAll("#bottomNav .nav-item");
  nav.forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-view") === view);
  });

  $("badgeBitacora").hidden = true;

  if (view === "bitacora") {
    syncBitacora();
    renderBitacora($("bitToday").checked);
  } else if (view === "directorio") {
    var inp = $("searchInput");
    inp.focus();
    inp.select();
  } else if (view === "admin") {
    refreshAdminView();
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

/* ---------------- Envío en bloque (solo admin) ---------------- */
var bulk = { list: [], idx: 0, type: "" };

function adminCounts() {
  var mora = 0, vig = 0;
  state.rows.forEach(function (r) {
    if (r.status === "mora") mora++;
    else if (r.status === "vigente") vig++;
  });
  return { mora: mora, vig: vig };
}

function refreshAdminView() {
  var adm = $("navAdmin");
  if (adm) adm.hidden = !isAdmin();
  var c = adminCounts();
  $("admCountMora").textContent = String(c.mora);
  $("admCountVig").textContent = String(c.vig);
  if ($("viewAdmin") && !$("viewAdmin").hidden) {
    if (bulk.list.length === 0) $("admQueue").hidden = true;
  }
}

function startBulk(type) {
  var list = [];
  state.rows.forEach(function (r) {
    if (r.status === (type === "mora" ? "mora" : "vigente")) list.push(r);
  });
  bulk = { list: list, idx: 0, type: type };
  if (list.length === 0) { toast(type === "mora" ? "No hay residentes EN MORA" : "No hay residentes VIGENTES"); return; }
  $("admQueue").hidden = false;
  renderBulk();
  vib(10);
}

function renderBulk() {
  var n = bulk.list.length;
  var i = bulk.idx;
  if (n === 0) return;
  var r = bulk.list[i];
  $("admProgress").textContent = "Mensaje " + (i + 1) + " de " + n;
  var tel = r.phones && r.phones.length ? formatPhoneDisplay(r.phones[0]) : "Sin número";
  $("admRecip").textContent = (r.status === "mora" ? "Cobranza · " : "Pago · ") + (r.ownerName || "Vecino") +
    (r.block ? " · " + formatBlockLabel(r.block) : "") + " · " + tel;
  var txt = r.status === "mora" ? cobranzaText(r) : recordatorioText(r);
  $("admMsg").value = txt;
  $("admPrev").disabled = i === 0;
  $("admNext").disabled = i >= n - 1;
}

function bulkNext() {
  if (bulk.list.length && bulk.idx < bulk.list.length - 1) { bulk.idx++; renderBulk(); vib(6); }
}

function bulkPrev() {
  if (bulk.idx > 0) { bulk.idx--; renderBulk(); vib(6); }
}

function bulkOpen() {
  var r = bulk.list[bulk.idx];
  if (!r) return;
  state.selected = r;
  openCobranza();
}

function closeBulk() {
  bulk = { list: [], idx: 0, type: "" };
  $("admQueue").hidden = true;
  state.selected = null;
}

/* ---------------- Formulario manual ---------------- */
function lookupOwner(propName) {
  var nq = normalizeText(propName);
  if (!nq) return { name: propName, block: "" };
  var hit = null, part = null;
  state.rows.forEach(function (r) {
    if (normalizeText(r.ownerName) === nq) hit = r;
    if (!part && (r.ownerParts || []).some(function (p) { return normalizeText(p) === nq; })) part = r;
  });
  var r = hit || part;
  return r ? { name: r.ownerName, block: r.block } : { name: propName, block: "" };
}

function buildOwnerList() {
  var dl = $("ownerList");
  dl.innerHTML = "";
  var seen = {};
  state.rows.forEach(function (r) {
    var candidates = [r.ownerName].concat(r.ownerParts || []);
    candidates.forEach(function (n) {
      n = collapseSpaces(n);
      if (!n || seen[n]) return;
      seen[n] = 1;
      var o = document.createElement("option");
      o.value = n;
      dl.appendChild(o);
    });
  });
}

function submitManualEntry(ev) {
  ev.preventDefault();
  var prop = lookupOwner(collapseSpaces($("formPropietario").value));
  var visitor = collapseSpaces($("formVisitante").value);
  var plate = collapseSpaces($("formPlaca").value).toUpperCase();
  var note = collapseSpaces($("formNota").value);

  if (!visitor && !prop.name && !plate) {
    toast("Escribe al menos un dato");
    return;
  }
  addBitacora({
    block: prop.block,
    owner: prop.name || "",
    name: visitor,
    plate: plate,
    note: note,
    via: "manual"
  });
  ev.target.reset();
  switchView("bitacora");
}

/* ---------------- Init ---------------- */
function sessionLabel() {
  var s = getSession();
  if (!s) return "";
  return " · " + s.user + (s.role === "admin" ? " · Admin" : "");
}

function refreshSessionTag() {
  var verEl = $("appVer");
  if (verEl) verEl.textContent = "v" + (APP_CONFIG.APP_VERSION || "?") + sessionLabel();
}

function init() {
  // fecha y hora del día
  var days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function renderToday() {
    var d = new Date();
    $("todayLabel").textContent =
      days[d.getDay()] + ", " + d.getDate() + " de " + months[d.getMonth()] +
      " · " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  renderToday();
  setInterval(renderToday, 30000);

  refreshSessionTag();

  // instalación PWA
  setupInstallPrompt();

  // botón atrás del teléfono (Android)
  setupBackButton();

  // búsqueda
  var searchInput = $("searchInput");
  var searchClear = $("searchClear");
  function syncSearchClear() { searchClear.hidden = !state.query; }
  searchInput.addEventListener("input", function (e) {
    state.query = e.target.value;
    syncSearchClear();
    applyFilters();
  });
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { this.value = ""; state.query = ""; syncSearchClear(); applyFilters(); }
  });
  searchClear.addEventListener("click", function () {
    searchInput.value = "";
    state.query = "";
    syncSearchClear();
    applyFilters();
    searchInput.focus();
  });
  syncSearchClear();

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

  // cierre de overlays
  $("dtClose").addEventListener("click", closeDetail);
  $("bitClose").addEventListener("click", function () { switchView("directorio"); });
  $("formClose").addEventListener("click", function () { switchView("directorio"); });
  $("newEntryBtn").addEventListener("click", function () { switchView("form"); });

  // envío en bloque (solo administración)
  $("admClose").addEventListener("click", function () { closeBulk(); switchView("directorio"); });
  $("admBulkMora").addEventListener("click", function () { startBulk("mora"); });
  $("admBulkVig").addEventListener("click", function () { startBulk("vigente"); });
  $("admQueueClose").addEventListener("click", closeBulk);
  $("admPrev").addEventListener("click", bulkPrev);
  $("admNext").addEventListener("click", bulkNext);
  $("admOpen").addEventListener("click", bulkOpen);

  // acceso de administración (tocar la versión o el logo)
  var verEl = $("appVer");
  if (verEl) verEl.addEventListener("click", openLogin);
  $("logoImg").addEventListener("click", openLogin);
  $("loginCancel").addEventListener("click", closeLogin);
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var user = $("loginUser").value.trim();
    var pass = $("loginPass").value;
    if (!user || !pass) { $("loginError").textContent = "Ingresa usuario y contraseña."; $("loginError").hidden = false; return; }
    $("loginError").hidden = true;
    doLogin(user, pass, function (err, match) {
      if (err) { $("loginError").textContent = err.message; $("loginError").hidden = false; return; }
      onLoginSuccess(match);
    });
  });
  $("sessionLogout").addEventListener("click", function () {
    clearSession();
    closeLogin();
    showGate();
  });

  // pantalla de inicio (login obligatorio)
  $("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var user = $("gateUser").value.trim();
    var pass = $("gatePass").value;
    if (!user || !pass) { $("gateError").textContent = "Ingresa usuario y contraseña."; $("gateError").hidden = false; return; }
    $("gateError").hidden = true;
    doLogin(user, pass, function (err, match) {
      if (err) { $("gateError").textContent = err.message; $("gateError").hidden = false; return; }
      onLoginSuccess(match);
    });
  });

  // mensaje de cobranza
  $("dtCobrar").addEventListener("click", openCobranza);
  $("cobranzaCancel").addEventListener("click", closeCobranza);
  $("cobranzaCopy").addEventListener("click", copyCobranza);
  $("cobranzaWa").addEventListener("click", sendCobranzaWA);
  $("cobranzaQrSave").addEventListener("click", saveQrImage);
  bindNumChips();

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

  loadData();

  // reintento manual o automático cuando la conexión vuelve
  var netRetry = $("netRetry");
  if (netRetry) netRetry.addEventListener("click", loadData);
  window.addEventListener("online", function () {
    if (!state.loaded) loadData();
  });

  if (APP_CONFIG.AUTO_REFRESH_MIN && APP_CONFIG.AUTO_REFRESH_MIN > 0) {
    setInterval(function () { loadData(); }, APP_CONFIG.AUTO_REFRESH_MIN * 60000);
  }

  // sincronización de la bitácora: cada minuto y al volver a la app
  syncBitacora();
  setInterval(function () { syncBitacora(); }, 60000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) syncBitacora();
  });

  // volver arriba
  var toTopBtn = $("toTopBtn");
  function syncToTopBtn() {
    toTopBtn.classList.toggle("show", window.scrollY > 300);
  }
  toTopBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", syncToTopBtn, { passive: true });
  syncToTopBtn();

  // registro del service worker (mantiene la versión actualizada)
  if (navigator.serviceWorker) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
      reg.update();
      reg.addEventListener("updatefound", function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", function () {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      setInterval(function () { reg.update(); }, 30 * 60000);
    }).catch(function () { /* offline no requerido */ });

    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (hadController) window.location.reload();
    });
  }

  // bloqueo de la app: sin sesión no se puede usar
  ensureGate();
}

document.addEventListener("DOMContentLoaded", init);