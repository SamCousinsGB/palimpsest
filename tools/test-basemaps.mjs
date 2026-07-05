// Probe candidate base-map tile URLs over a UK point and report which actually
// serve image tiles. Run: node tools/test-basemaps.mjs
const LAT = 53.41, LON = -2.98; // Liverpool

const tile = (z) => {
  const n = 2 ** z;
  const x = Math.floor(((LON + 180) / 360) * n);
  const latRad = (LAT * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
};

const fill = (url, z) => {
  const { x, y } = tile(z);
  return url
    .replace("{s}", "a")
    .replace("{z}", z)
    .replace("{x}", x)
    .replace("{y}", y)
    .replace("{r}", "");
};

const C = [
  // modern
  ["OSM", "https://tile.openstreetmap.org/{z}/{x}/{y}.png", 12],
  ["OSM HOT", "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", 12],
  ["CyclOSM", "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", 12],
  ["Carto Light", "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", 12],
  ["Carto Dark", "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", 12],
  ["Carto Voyager", "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", 12],
  ["OpenTopoMap", "https://a.tile.opentopomap.org/{z}/{x}/{y}.png", 12],
  ["Esri Imagery", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", 12],
  ["Esri Topo", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", 12],
  ["Esri Street", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", 12],
  ["Esri NatGeo", "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}", 12],
  ["Esri LightGray", "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", 12],
  ["Wikimedia", "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png", 12],
  // historical (NLS)
  ["NLS OS 1-inch 1885-1900", "https://mapseries-tilesets.s3.amazonaws.com/1inch_2nd_ed/{z}/{x}/{y}.png", 12],
  ["NLS OS 6-inch 1888-1913", "https://mapseries-tilesets.s3.amazonaws.com/os/6inch/{z}/{x}/{y}.png", 12],
  ["NLS OS 25-inch GB", "https://mapseries-tilesets.s3.amazonaws.com/25_inch/{z}/{x}/{y}.png", 15],
  ["NLS OS 1-inch 7th 1955-61", "https://mapseries-tilesets.s3.amazonaws.com/os_1_inch_7th/{z}/{x}/{y}.png", 12],
  ["NLS GB 1900s bartholomew", "https://mapseries-tilesets.s3.amazonaws.com/bartholomew_great_britain/{z}/{x}/{y}.png", 10],
  ["NLS OS 1:25k 1937-61", "https://mapseries-tilesets.s3.amazonaws.com/OS_1-25k/{z}/{x}/{y}.png", 13],
];

for (const [name, url, z] of C) {
  const full = fill(url, z);
  try {
    const res = await fetch(full, { headers: { "User-Agent": "palimpsest-map/0.2" } });
    const ct = res.headers.get("content-type") || "";
    const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    const ok = res.ok && ct.startsWith("image") && buf.length > 200;
    console.log(`${ok ? "OK " : "XX "} ${name.padEnd(28)} ${res.status} ${ct.padEnd(12)} ${buf ? buf.length + "b" : ""}`);
  } catch (e) {
    console.log(`XX  ${name.padEnd(28)} ERR ${e.message}`);
  }
}
