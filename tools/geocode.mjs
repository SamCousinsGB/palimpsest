// Geocode a places file against Nominatim and emit a module GeoJSON.
// Usage: node tools/geocode.mjs tools/places-norse.json layers/norse-settlements/data.geojson
// Respects Nominatim's 1 req/sec policy. A result further than 20km from the
// place's fallback coordinate is treated as a wrong match and the fallback kept.

import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node tools/geocode.mjs <places.json> <out.geojson>");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const kmBetween = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const { places } = JSON.parse(readFileSync(inPath, "utf8"));
const features = [];

for (const p of places) {
  let coord = p.fallback;
  let source = "fallback";
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gb&limit=1&q=" +
      encodeURIComponent(p.q);
    const res = await fetch(url, {
      headers: { "User-Agent": "palimpsest-map/0.1 (samcousinsgb@gmail.com)" },
    });
    if (res.ok) {
      const hits = await res.json();
      if (hits.length) {
        const got = [parseFloat(hits[0].lat), parseFloat(hits[0].lon)];
        const km = kmBetween(got, p.fallback);
        if (km <= 20) {
          coord = got;
          source = "nominatim";
        } else {
          console.warn(`  ! ${p.name}: hit ${km.toFixed(1)}km from expected — keeping fallback`);
        }
      } else {
        console.warn(`  ! ${p.name}: no result — keeping fallback`);
      }
    } else {
      console.warn(`  ! ${p.name}: HTTP ${res.status} — keeping fallback`);
    }
  } catch (e) {
    console.warn(`  ! ${p.name}: ${e.message} — keeping fallback`);
  }
  console.log(`${source === "nominatim" ? "ok" : "--"} ${p.name} [${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}]`);

  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [Number(coord[1].toFixed(5)), Number(coord[0].toFixed(5))] },
    properties: {
      name: p.name,
      group: p.group,
      element: p.element,
      etymology: p.etymology,
      certainty: p.certainty,
      attested: p.attested,
      attestedForm: p.attestedForm,
      notes: p.notes || undefined,
      geocode: source,
    },
  });
  await sleep(1100);
}

writeFileSync(outPath, JSON.stringify({ type: "FeatureCollection", features }, null, 1));
console.log(`\nwrote ${features.length} features to ${outPath}`);
