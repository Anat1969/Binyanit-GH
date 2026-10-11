// Assigns a point to an Ashdod quarter from the quarter polygons (public/data/rovaim.geojson).
// Every point gets a quarter: inside a polygon it is exact to the polygon layer; otherwise the
// nearest polygon is used and the result is marked as nearest.

type Ring = number[][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
export type QuarterFC = { features: { geometry: Geometry; properties: { id: string; name: string } }[] };

/** Polygon id -> quarter key used by the engine and by binyanit_quarter_counters. */
export const QUARTER_KEY: Record<string, string> = {
  a: "א", b: "ב", g: "ג", d: "ד", h: "ה", v: "ו", z: "ז", ch: "ח", t: "ט",
  y: "י", ya: "יא", yg: "יג", tv: "טו", "mar-tzafon": 'מע"ר צפון',
};

export interface QuarterHit {
  key: string;
  name: string;
  method: "inside" | "nearest";
  distanceM: number;
}

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygons(g: Geometry): Ring[][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

// Metres per degree near Ashdod (31.8°N).
const MX = 94_600;
const MY = 111_000;

function segDist(px: number, py: number, a: number[], b: number[]) {
  const ax = a[0] * MX, ay = a[1] * MY, bx = b[0] * MX, by = b[1] * MY;
  const x = px * MX, y = py * MY;
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

export function quarterAt(lon: number, lat: number, fc: QuarterFC): QuarterHit | null {
  let best: QuarterHit | null = null;
  for (const f of fc.features) {
    const key = QUARTER_KEY[f.properties.id] ?? f.properties.name;
    for (const poly of polygons(f.geometry)) {
      const [outer, ...holes] = poly;
      if (inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h))) {
        return { key, name: f.properties.name, method: "inside", distanceM: 0 };
      }
      for (let i = 1; i < outer.length; i++) {
        const d = segDist(lon, lat, outer[i - 1], outer[i]);
        if (!best || d < best.distanceM) best = { key, name: f.properties.name, method: "nearest", distanceM: Math.round(d) };
      }
    }
  }
  return best;
}
