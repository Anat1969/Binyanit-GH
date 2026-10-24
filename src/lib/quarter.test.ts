import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUARTER_KEY, quarterAt, type QuarterFC } from "./quarter";
import { QUARTERS } from "@/content/plan-meta";

const fc = JSON.parse(readFileSync("public/data/rovaim.geojson", "utf8")) as QuarterFC;

describe("quarterAt", () => {
  it("every polygon maps to a known quarter key", () => {
    for (const f of fc.features) expect(QUARTER_KEY[f.properties.id]).toBeTruthy();
    for (const [id, k] of Object.entries(QUARTER_KEY)) if (id !== "mar-tzafon") expect(QUARTERS).toContain(k);
  });
  it("a point inside a polygon gets that polygon's quarter", () => {
    for (const f of fc.features.slice(0, 5)) {
      const ring = (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]) as number[][];
      // Centroid of the vertices is inside these convex-ish Voronoi cells.
      const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const hit = quarterAt(lon, lat, fc)!;
      expect(hit.method).toBe("inside");
      expect(hit.key).toBe(QUARTER_KEY[f.properties.id]);
    }
  });
  it("never returns unknown: a point outside all polygons gets the nearest quarter", () => {
    const hit = quarterAt(34.5, 31.79, fc)!;
    expect(hit.method).toBe("nearest");
    expect(hit.key).toBeTruthy();
    expect(hit.distanceM).toBeGreaterThan(0);
  });
});
