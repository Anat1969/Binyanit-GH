// Split the traffic-appendix extraction (scripts/traffic/extract.py output) into static files
// for /traffic. The cadastre background is large, so it is a separate file loaded after the rest.
// Usage: node scripts/traffic/split.mjs <extract-out-dir>
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/traffic/split.mjs <extract-out-dir>");
const out = "public/data/traffic";
mkdirSync(out, { recursive: true });

const layers = JSON.parse(readFileSync(join(src, "layers.json"), "utf8"));
const { cadastre, cadastre_light, ...main } = layers;
writeFileSync(join(out, "layers.json"), JSON.stringify(main));
writeFileSync(join(out, "cadastre.json"), JSON.stringify({ cadastre, cadastre_light }));
copyFileSync(join(src, "labels.json"), join(out, "labels.json"));
copyFileSync(join(src, "excluded.png"), join(out, "excluded.png"));
const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log("wrote", out);
