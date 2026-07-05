# Palimpsest

**Layered maps of the UK — overlay, compare, scroll through time.**

A palimpsest is a manuscript scraped clean and written over, the old text still
showing through. So is Britain. This tool puts research layers — Norse
settlements today, sewer networks or Roman roads tomorrow — over modern and
historical base maps, with an NLS-style compare viewer for spotting routes,
patterns and settlement logic.

**Live:** https://samcousinsgb.github.io/palimpsest/

## Features

- **Three view modes** — single map; **side by side** (two panes locked to a
  pixel-identical view via Leaflet.Sync, independent base maps and layers on
  each); **swipe** (draggable divider, NLS-style).
- **Linked crosshair** — in side-by-side, hovering one pane mirrors a crosshair
  onto the other at the exact same coordinate, so you can pin precisely where a
  point on one map falls on the other.
- **25 base maps** in three groups, every URL probe-verified to serve real
  tiles over Merseyside:
  - *Street & general* — OpenStreetMap, OSM Humanitarian, OSM France, OSM
    Germany, CyclOSM, ÖPNVKarte transit, Carto Light / Light-no-labels / Dark /
    Voyager, Esri Street, Esri Light Gray.
  - *Terrain, relief & aerial* — Esri Satellite, OpenTopoMap, Esri Topographic /
    National Geographic / Shaded Relief / Terrain / Physical / Ocean.
  - *Historical (NLS)* — OS 1-inch 1885–1900, Bartholomew GB half-inch ~1900,
    Bartholomew GB half-inch 1940s, OS 1:10,560 1940s–60s, and OS 1:1,250 town
    plans 1940s–60s (street-level detail — individual buildings).

  Zoom is capped so no base map is magnified more than one level past its native
  detail — this keeps both panes at a real, matching scale in side-by-side
  rather than blowing a low-detail historical sheet up into blur next to a crisp
  modern one. The coarser of the two panes governs. For deep, street-level
  history, the OS 1:1,250 layer carries detail to the highest zooms.
- **Modular layer library** — every layer is a self-contained folder under
  `layers/`. Add a folder, add one line to the registry, done.
- **Timeline** — any layer that declares a time field gets a year slider
  automatically. Scroll through the evolution of whatever the layer records.
- **UK-scoped** — the map is bounded to the British Isles by design.
- No build step, no framework. Vanilla JS + Leaflet, hosted on GitHub Pages.

## Layer modules

| Module | Contents |
|---|---|
| [norse-settlements](layers/norse-settlements/) | 53 Norse place-name settlements across Merseyside, Wirral and west Lancashire, coloured by Old Norse element, with etymologies, certainty ratings and a first-attestation timeline. |

## Running locally

Any static file server works (`fetch` of local JSON needs http, not `file://`):

```
npx http-server -p 8080
```

## Adding a layer module

1. Create `layers/<your-id>/` containing `layer.json` (+ `data.geojson` for
   vector layers, and ideally a `README.md` documenting sources).
2. Add `<your-id>` to `layers/registry.json`.

### Manifest schema (`layer.json`)

```jsonc
{
  "id": "my-layer",
  "name": "Display name",
  "description": "Shown in the sidebar.",
  "type": "geojson",              // or "tile"
  "data": "data.geojson",         // geojson layers
  "url": "https://.../{z}/{x}/{y}.png",  // tile layers instead of data
  "attribution": "Source credit",

  // optional — categorical styling
  "styleBy": "group",             // feature property to colour by
  "style": {
    "default": { "color": "#c8a24b" },
    "categories": { "someValue": { "color": "#d64545", "label": "Legend text" } }
  },

  // optional — map a property to fill opacity (e.g. confidence)
  "fillBy": { "field": "certainty", "values": { "high": 0.85, "possible": 0.1 } },
  "legendNote": "Free text under the legend.",
  "markers": { "radius": 7 },

  // optional — popup rows, in order; empty label = title row
  "popup": [ { "field": "name", "label": "" }, { "field": "notes", "label": "Notes" } ],

  // optional — declaring this activates the timeline for the layer.
  // Features where properties[field] <= slider year are shown; undated features always show.
  "time": { "field": "attested", "label": "First documented by year", "min": 1080, "max": 1300 }
}
```

Numeric years work today; the field is generic, so a future module can use any
monotonic value (year, decade, epoch).

### Tooling

`tools/geocode.mjs` turns a places file (see `tools/places-norse.json` for the
shape) into a module GeoJSON via Nominatim, with a wrong-county sanity guard
and rate-limit compliance:

```
node tools/geocode.mjs tools/places-my-layer.json layers/my-layer/data.geojson
```

## Roadmap

- Georeferenced historical overlays (tithe maps, estate plans) as tile modules
- More NLS base sheets (6-inch 1888–1913, 25-inch) — Scotland-only or behind
  MapTiler API keys in NLS's free set, so they need a key wired in
- OpenHistoricalMap as a time-aware base layer (vector tiles — needs MapLibre
  GL + the Leaflet bridge)
- Line/polygon modules (Roman roads, drainage and sewer networks, hundred boundaries)
- Time *ranges* per feature (existed from–to) alongside the current attested-by model
- Permalink state (mode, layers, year, viewport in the URL hash)
- Opacity slider per layer
