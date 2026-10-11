// Converts a KML or GeoJSON file into SQL inserts for public.binyanit_layers.
// Usage:
//   node scripts/import-kml.mjs <file.kml|file.geojson> <kind> [--replace] [--class=activeFrontage] > layer.sql
// kind: plan_boundary | street_class | public_allocation_zone | urban_renewal_search_zone | well_radius | quarter
// For street_class, each feature needs properties.class (cityWide|activeFrontage|massTransit) or --class.
// For quarter, the feature name is the quarter letter (e.g. "ג").
// Run the output through the Supabase SQL editor. Keep each statement on one line.
import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";

const KINDS = ["plan_boundary", "street_class", "public_allocation_zone", "urban_renewal_search_zone", "well_radius", "quarter"];
const [file, kind, ...flags] = process.argv.slice(2);
if (!file || !KINDS.includes(kind)) {
  console.error(`usage: node scripts/import-kml.mjs <file> <${KINDS.join("|")}> [--replace] [--class=...]`);
  process.exit(1);
}
const raw = readFileSync(file, "utf8");
const fc = file.toLowerCase().endsWith(".kml") ? kml(new DOMParser().parseFromString(raw, "text/xml")) : JSON.parse(raw);
const forcedClass = flags.find((f) => f.startsWith("--class="))?.split("=")[1];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const out = [];
if (flags.includes("--replace")) out.push(`delete from public.binyanit_layers where kind = ${q(kind)};`);
let n = 0;
for (const f of fc.features ?? []) {
  if (!f.geometry) continue;
  const props = { ...(f.properties ?? {}) };
  if (kind === "street_class") props.class = forcedClass ?? props.class ?? "cityWide";
  const name = props.name ?? null;
  delete props.styleUrl;
  delete props.styleHash;
  const geom = JSON.stringify({ ...f.geometry, coordinates: dropZ(f.geometry.coordinates), geometries: f.geometry.geometries?.map((g) => ({ ...g, coordinates: dropZ(g.coordinates) })) });
  out.push(
    `insert into public.binyanit_layers (kind, name, props, geom) values (${q(kind)}, ${name == null ? "null" : q(name)}, ${q(JSON.stringify(props))}::jsonb, extensions.st_force2d(extensions.st_setsrid(extensions.st_geomfromgeojson(${q(geom)}), 4326)));`,
  );
  n++;
}
function dropZ(c) {
  if (!Array.isArray(c)) return c;
  return typeof c[0] === "number" ? c.slice(0, 2) : c.map(dropZ);
}
console.log(out.join("\n"));
console.error(`${n} features -> ${kind}`);
