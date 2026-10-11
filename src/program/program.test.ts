import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toCsv } from "./csv";
import { DATA_ERRORS, PROGRAM, capacityOf, legendFor, pageHref, rovaSlidePage, validate } from "./data";

const geo = JSON.parse(readFileSync("public/data/rovaim.geojson", "utf8"));

describe("program data", () => {
  it("is valid and has 14 rovaim", () => {
    expect(DATA_ERRORS).toEqual([]);
    expect(PROGRAM.rovaim).toHaveLength(14);
  });
  it("matches the appendix totals (page 4, 14)", () => {
    expect(PROGRAM.totals.existing_units_for_renewal).toBe(22565);
    expect(PROGRAM.totals.added_units_max_5y).toBe(5000);
    expect(PROGRAM.totals.added_units_realistic).toBe(7415);
    expect(PROGRAM.meta.methodology.full_capacity_units).toBe(13627);
    expect(PROGRAM.totals.added_population_max_5y).toBe(19005);
    expect(PROGRAM.totals.children_max_5y).toBe(462);
  });
  it("resolves group carrying capacity for y, ya, yg", () => {
    for (const id of ["y", "ya", "yg"]) {
      const r = PROGRAM.rovaim.find((x) => x.id === id)!;
      const { cap, viaGroup } = capacityOf(r);
      expect(viaGroup?.id).toBe("y-ya-yg");
      expect(cap?.class).toBe("positive");
      expect(cap?.balance).toBe(0);
    }
  });
  it("has null capacity for rovaim under 50 added units", () => {
    for (const r of PROGRAM.rovaim.filter((x) => x.added_max_5y < 50 && !x.group)) expect(capacityOf(r).cap).toBeNull();
  });
  it("finds each rova's own slide page", () => {
    const pages = Object.fromEntries(PROGRAM.rovaim.map((r) => [r.id, rovaSlidePage(r)]));
    expect(pages).toMatchObject({ a: 6, b: 7, g: 8, d: 9, h: 10, v: 11, ch: 12, y: 13, ya: 13, yg: 13, z: null, t: null, tv: null, "mar-tzafon": null });
  });
  it("legend and links", () => {
    expect(legendFor("positive")?.color).toBe("#00B050");
    expect(legendFor("none")?.stroke).toBe("#C00000");
    expect(pageHref(16)).toBe("/docs/program-appendix.pdf#page=16");
  });
  it("one polygon per rova, all approximate", () => {
    const ids = (geo as { features: { properties: { id: string; approximate: boolean } }[] }).features.map((f) => f.properties.id).sort();
    expect(ids).toEqual(PROGRAM.rovaim.map((r) => r.id).sort());
    expect((geo as { features: { properties: { approximate: boolean } }[] }).features.every((f) => f.properties.approximate)).toBe(true);
  });
  it("validation reports broken data", () => {
    expect(validate(null)).not.toHaveLength(0);
    expect(validate({ meta: {}, totals: {}, rovaim: [] })).not.toHaveLength(0);
  });
});

describe("csv", () => {
  it("escapes and prefixes a BOM", () => {
    const csv = toCsv(["רובע", "הערה"], [['רובע א\'', 'כולל "מרכאות", ופסיק']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"כולל ""מרכאות"", ופסיק"');
  });
});
