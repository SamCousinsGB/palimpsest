// Probe additional tile providers (new sources). Run: node tools/test-more.mjs
const LAT = 53.41, LON = -2.98;
const tile = (z) => {
  const n = 2 ** z;
  const x = Math.floor(((LON + 180) / 360) * n);
  const r = (LAT * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
};
const fill = (url, z) => {
  const { x, y } = tile(z);
  return url.replace("{s}", "a").replace("{z}", z).replace("{x}", x).replace("{y}", y).replace("{r}", "");
};
const C = [
  ["OSM France", "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", 12],
  ["OSM Germany", "https://a.tile.openstreetmap.de/{z}/{x}/{y}.png", 12],
  ["OPNVKarte transit", "https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png", 12],
  ["Esri Ocean", "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", 10],
  ["Esri Physical", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}", 8],
  ["Esri Shaded Relief", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}", 12],
  ["Esri Terrain Base", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}", 12],
  ["Stadia Alidade Smooth", "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png", 12],
  ["Stadia Alidade Dark", "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png", 12],
  ["Stadia Outdoors", "https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}.png", 12],
  ["Stamen Toner", "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png", 12],
  ["Stamen Terrain", "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png", 12],
  ["Stamen Watercolor", "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg", 12],
  ["CartoDB Positron nolabel", "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png", 12],
  ["USGS Imagery Topo", "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}", 12],
];
for (const [name, url, z] of C) {
  try {
    const res = await fetch(fill(url, z), { headers: { "User-Agent": "palimpsest-map/0.3 (samcousinsgb@gmail.com)" } });
    const ct = res.headers.get("content-type") || "";
    const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    const ok = res.ok && ct.startsWith("image") && buf.length > 200;
    console.log(`${ok ? "OK " : "XX "} ${name.padEnd(26)} ${res.status} ${ct.padEnd(11)} ${buf ? buf.length + "b" : ""}`);
  } catch (e) {
    console.log(`XX  ${name.padEnd(26)} ERR ${e.message}`);
  }
}
