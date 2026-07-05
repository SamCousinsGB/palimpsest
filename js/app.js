/* Palimpsest — layered maps of the UK.
   Vanilla JS + Leaflet. No build step. Layer modules live in layers/<id>/
   and are declared in layers/registry.json — see README for the manifest schema. */

"use strict";

// ---------------------------------------------------------------- base maps

// maxNativeZoom = the deepest zoom the tileset actually serves; Leaflet upscales
// past it so historical layers stay visible (blurry) when zoomed in and stay
// aligned with modern panes at every zoom. All layers are EPSG:3857.
const MAX_ZOOM = 19;
const BASES = {
  osm: { name: "OpenStreetMap", group: "Modern",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors", maxNativeZoom: 19 },
  hot: { name: "OSM Humanitarian", group: "Modern",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, Humanitarian OSM Team", maxNativeZoom: 19 },
  cyclosm: { name: "CyclOSM", group: "Modern",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors | CyclOSM", maxNativeZoom: 19 },
  light: { name: "Carto Light", group: "Modern",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO", maxNativeZoom: 20 },
  dark: { name: "Carto Dark", group: "Modern",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO", maxNativeZoom: 20 },
  voyager: { name: "Carto Voyager", group: "Modern",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO", maxNativeZoom: 20 },
  topo: { name: "OpenTopoMap (terrain)", group: "Modern",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)", maxNativeZoom: 17 },
  imagery: { name: "Esri Satellite", group: "Modern",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics", maxNativeZoom: 19 },
  esritopo: { name: "Esri Topographic", group: "Modern",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri", maxNativeZoom: 19 },
  esristreet: { name: "Esri Street", group: "Modern",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri", maxNativeZoom: 19 },
  esrinatgeo: { name: "Esri National Geographic", group: "Modern",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, National Geographic", maxNativeZoom: 16 },
  esrigray: { name: "Esri Light Gray", group: "Modern",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri", maxNativeZoom: 16 },
  nls1inch: { name: "OS 1-inch 1885–1900", group: "Historical (NLS)",
    url: "https://mapseries-tilesets.s3.amazonaws.com/1inch_2nd_ed/{z}/{x}/{y}.png",
    attribution: "Historical map &copy; National Library of Scotland", maxNativeZoom: 15 },
  nlsbart: { name: "Bartholomew GB ½-inch ~1900", group: "Historical (NLS)",
    url: "https://mapseries-tilesets.s3.amazonaws.com/bartholomew_great_britain/{z}/{x}/{y}.png",
    attribution: "Historical map &copy; National Library of Scotland", maxNativeZoom: 15 },
  nls10k: { name: "OS 1:10,560 1940s–60s", group: "Historical (NLS)",
    url: "https://mapseries-tilesets.s3.amazonaws.com/os/britain10knatgrid/{z}/{x}/{y}.png",
    attribution: "Historical map &copy; National Library of Scotland", maxNativeZoom: 15 },
};

const UK_BOUNDS = L.latLngBounds([49.4, -11.2], [61.2, 2.6]);
const START = { center: [53.65, -2.95], zoom: 9 }; // Merseyside / SW Lancashire

// ---------------------------------------------------------------- state

const maps = { a: null, b: null };
const baseLayers = { a: null, b: null };
let mode = "single"; // single | dual | swipe
let modules = []; // { id, dir, manifest, data, on:{a,b}, leaflet:{a,b}, fitted }
let swipeX = null;

const timeline = { enabled: false, year: null, min: null, max: null };

const $ = (sel) => document.querySelector(sel);
const mapsEl = $("#maps");
const mapBEl = $("#map-b");
const dividerEl = $("#swipe-divider");

// ---------------------------------------------------------------- maps

function makeMap(id) {
  const map = L.map(id, {
    maxBounds: UK_BOUNDS.pad(0.1),
    maxBoundsViscosity: 1.0, // hard, identical wall on both panes — no differential drift
    minZoom: 5,
    maxZoom: MAX_ZOOM,
    zoomControl: id === "map-a",
  }).setView(START.center, START.zoom);
  return map;
}

function setBase(side, key) {
  const map = maps[side];
  if (!map) return;
  if (baseLayers[side]) map.removeLayer(baseLayers[side]);
  const b = BASES[key];
  baseLayers[side] = L.tileLayer(b.url, {
    attribution: b.attribution,
    maxNativeZoom: b.maxNativeZoom,
    maxZoom: MAX_ZOOM,
  }).addTo(map);
}

// Leaflet.Sync keeps the two panes locked to an identical view (center + zoom),
// bidirectionally. With equal-sized panes and identical map options this is
// pixel-accurate at every zoom level.
function attachSync() {
  maps.a.sync(maps.b);
  maps.b.sync(maps.a);
}

function ensureMapB() {
  if (maps.b) return;
  mapBEl.hidden = false;
  maps.b = makeMap("map-b");
  setBase("b", $("#base-b").value);
  attachSync();
  // start the right pane with the same overlays as the left
  for (const mod of modules) {
    if (mod.on.a && !mod.on.b) {
      mod.on.b = true;
      updateModuleLayer(mod, "b");
    }
  }
}

// ---------------------------------------------------------------- modes

function setMode(next) {
  mode = next;
  document.querySelectorAll("#mode-switch button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === next);
  });
  mapsEl.className = "mode-" + next;

  const compare = next !== "single";
  $("#base-b-row").hidden = !compare;
  $("#base-a-label").textContent = compare ? "Left" : "Map";
  mapBEl.hidden = !compare;
  dividerEl.hidden = next !== "swipe";
  $("#dual-divider").hidden = next !== "dual";
  mapBEl.style.clipPath = "";

  if (compare) ensureMapB();

  requestAnimationFrame(() => {
    maps.a.invalidateSize();
    if (maps.b && compare) {
      maps.b.invalidateSize();
      maps.b.setView(maps.a.getCenter(), maps.a.getZoom(), { animate: false });
    }
    if (next === "swipe") {
      if (swipeX == null) swipeX = mapsEl.getBoundingClientRect().width / 2;
      applySwipe();
    }
  });

  renderLayerList();
}

function applySwipe() {
  const w = mapsEl.getBoundingClientRect().width;
  swipeX = Math.min(Math.max(swipeX, 40), w - 40);
  dividerEl.style.left = swipeX - 2 + "px";
  mapBEl.style.clipPath = `inset(0 0 0 ${swipeX}px)`;
}

function initSwipeDrag() {
  let dragging = false;
  dividerEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    dividerEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  dividerEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    swipeX = e.clientX - mapsEl.getBoundingClientRect().left;
    applySwipe();
  });
  dividerEl.addEventListener("pointerup", () => (dragging = false));
  window.addEventListener("resize", () => {
    if (mode === "swipe") applySwipe();
    maps.a.invalidateSize();
    if (maps.b) maps.b.invalidateSize();
  });
}

// ---------------------------------------------------------------- modules

async function loadRegistry() {
  const reg = await (await fetch("layers/registry.json")).json();
  for (const id of reg.modules) {
    try {
      const manifest = await (await fetch(`layers/${id}/layer.json`)).json();
      modules.push({
        id,
        dir: `layers/${id}/`,
        manifest,
        data: null,
        on: { a: false, b: false },
        leaflet: { a: null, b: null },
        fitted: false,
      });
    } catch (err) {
      console.error(`failed to load layer module "${id}"`, err);
    }
  }
  renderLayerList();
}

async function ensureData(mod) {
  if (mod.data || mod.manifest.type !== "geojson") return;
  mod.data = await (await fetch(mod.dir + mod.manifest.data)).json();
}

function styleFor(mod, feature) {
  const m = mod.manifest;
  const st = m.style || {};
  const cat = st.categories && m.styleBy ? st.categories[feature.properties[m.styleBy]] : null;
  const color = (cat && cat.color) || (st.default && st.default.color) || "#c8a24b";
  let fillOpacity = 0.85;
  if (m.fillBy) {
    const v = m.fillBy.values[feature.properties[m.fillBy.field]];
    if (v != null) fillOpacity = v;
  }
  return {
    radius: (m.markers && m.markers.radius) || 6,
    color,
    weight: 2,
    opacity: 0.95,
    fillColor: color,
    fillOpacity,
  };
}

function popupHtml(mod, feature) {
  const p = feature.properties;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = "";
  for (const spec of mod.manifest.popup || []) {
    const val = p[spec.field];
    if (val == null || val === "") continue;
    if (!spec.label) html += `<div class="popup-title">${esc(val)}</div>`;
    else html += `<div class="popup-field"><b>${esc(spec.label)}:</b> ${esc(val)}</div>`;
  }
  return html || `<div class="popup-title">${esc(p.name || mod.manifest.name)}</div>`;
}

function timeVisible(mod, feature) {
  const t = mod.manifest.time;
  if (!t || !timeline.enabled) return true;
  const v = feature.properties[t.field];
  if (v == null) return true; // undated features always shown
  return v <= timeline.year;
}

function buildLayer(mod) {
  const m = mod.manifest;
  if (m.type === "tile") {
    return L.tileLayer(m.url, {
      attribution: m.attribution,
      opacity: m.opacity || 1,
      maxNativeZoom: m.maxNativeZoom,
      maxZoom: MAX_ZOOM,
    });
  }
  return L.geoJSON(mod.data, {
    attribution: m.attribution,
    filter: (f) => timeVisible(mod, f),
    pointToLayer: (f, latlng) => L.circleMarker(latlng, styleFor(mod, f)),
    style: (f) => styleFor(mod, f),
    onEachFeature: (f, layer) => layer.bindPopup(popupHtml(mod, f), { maxWidth: 320 }),
  });
}

async function updateModuleLayer(mod, side) {
  const map = maps[side];
  if (!map) return;
  if (mod.leaflet[side]) {
    map.removeLayer(mod.leaflet[side]);
    mod.leaflet[side] = null;
  }
  if (!mod.on[side]) return;
  await ensureData(mod);
  const layer = buildLayer(mod);
  layer.addTo(map);
  mod.leaflet[side] = layer;
  if (!mod.fitted && mod.manifest.type === "geojson" && layer.getBounds().isValid()) {
    mod.fitted = true;
    maps.a.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 11 });
  }
}

async function toggleModule(mod, side) {
  mod.on[side] = !mod.on[side];
  await updateModuleLayer(mod, side);
  updateTimelineBar();
  renderLegend();
  renderLayerList();
}

// ---------------------------------------------------------------- timeline

function timedActiveModules() {
  return modules.filter((m) => m.manifest.time && (m.on.a || m.on.b));
}

function updateTimelineBar() {
  const timed = timedActiveModules();
  const bar = $("#timeline");
  if (!timed.length) {
    bar.hidden = true;
    timeline.enabled = false;
    $("#tl-enable").checked = false;
    return;
  }
  timeline.min = Math.min(...timed.map((m) => m.manifest.time.min));
  timeline.max = Math.max(...timed.map((m) => m.manifest.time.max));
  if (timeline.year == null || timeline.year > timeline.max || timeline.year < timeline.min) {
    timeline.year = timeline.max;
  }
  const slider = $("#tl-slider");
  slider.min = timeline.min;
  slider.max = timeline.max;
  slider.value = timeline.year;
  slider.disabled = !timeline.enabled;
  $("#tl-title").textContent =
    timed.length === 1 && timed[0].manifest.time.label
      ? timed[0].manifest.time.label
      : "Timeline";
  $("#tl-year").textContent = timeline.enabled ? `≤ ${timeline.year} AD` : "all time";
  bar.hidden = false;
}

function rebuildTimedLayers() {
  for (const mod of timedActiveModules()) {
    for (const side of ["a", "b"]) {
      if (mod.on[side]) updateModuleLayer(mod, side);
    }
  }
}

// ---------------------------------------------------------------- sidebar UI

function renderLayerList() {
  const box = $("#layer-list");
  box.innerHTML = "";
  for (const mod of modules) {
    const item = document.createElement("div");
    item.className = "layer-item";

    const head = document.createElement("div");
    head.className = "layer-head";
    const name = document.createElement("span");
    name.className = "layer-name";
    name.textContent = mod.manifest.name;
    head.appendChild(name);

    if (mode === "single") {
      const btn = document.createElement("button");
      btn.className = "on-off" + (mod.on.a ? " active" : "");
      btn.textContent = mod.on.a ? "On" : "Off";
      btn.onclick = () => toggleModule(mod, "a");
      head.appendChild(btn);
    } else {
      const wrap = document.createElement("div");
      wrap.className = "side-toggles";
      for (const [side, label] of [["a", "L"], ["b", "R"]]) {
        const btn = document.createElement("button");
        btn.className = mod.on[side] ? "active" : "";
        btn.textContent = label;
        btn.title = (side === "a" ? "left" : "right") + " map";
        btn.onclick = () => toggleModule(mod, side);
        wrap.appendChild(btn);
      }
      head.appendChild(wrap);
    }
    item.appendChild(head);

    if (mod.manifest.description) {
      const desc = document.createElement("p");
      desc.className = "layer-desc";
      desc.textContent = mod.manifest.description;
      item.appendChild(desc);
    }
    box.appendChild(item);
  }
}

function renderLegend() {
  const active = modules.filter(
    (m) => (m.on.a || m.on.b) && m.manifest.style && m.manifest.style.categories
  );
  const panel = $("#legend-panel");
  const box = $("#legend");
  box.innerHTML = "";
  panel.hidden = !active.length;
  for (const mod of active) {
    for (const [, cat] of Object.entries(mod.manifest.style.categories)) {
      const row = document.createElement("div");
      row.className = "legend-row";
      const sw = document.createElement("span");
      sw.className = "legend-swatch";
      sw.style.background = cat.color;
      row.appendChild(sw);
      row.appendChild(document.createTextNode(cat.label));
      box.appendChild(row);
    }
    if (mod.manifest.legendNote) {
      const note = document.createElement("p");
      note.className = "legend-note";
      note.textContent = mod.manifest.legendNote;
      box.appendChild(note);
    }
  }
}

// ---------------------------------------------------------------- boot

function initBaseSelects() {
  const groups = {};
  for (const [key, b] of Object.entries(BASES)) (groups[b.group] ||= []).push([key, b]);
  for (const [side, sel] of [["a", $("#base-a")], ["b", $("#base-b")]]) {
    for (const [gname, items] of Object.entries(groups)) {
      const og = document.createElement("optgroup");
      og.label = gname;
      for (const [key, b] of items) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = b.name;
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    sel.value = side === "a" ? "osm" : "nls1inch";
    sel.onchange = () => setBase(side, sel.value);
  }
}

function initTimelineControls() {
  $("#tl-enable").onchange = (e) => {
    timeline.enabled = e.target.checked;
    updateTimelineBar();
    rebuildTimedLayers();
  };
  $("#tl-slider").oninput = (e) => {
    timeline.year = +e.target.value;
    $("#tl-year").textContent = `≤ ${timeline.year} AD`;
    rebuildTimedLayers();
  };
}

function init() {
  initBaseSelects();
  maps.a = makeMap("map-a");
  setBase("a", $("#base-a").value);
  document.querySelectorAll("#mode-switch button").forEach((btn) => {
    btn.onclick = () => setMode(btn.dataset.mode);
  });
  initSwipeDrag();
  initTimelineControls();
  loadRegistry();
}

init();
