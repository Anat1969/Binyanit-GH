import { describe, expect, it } from "vitest";
import {
  DEMOLISH_ADD_FLOORS,
  DEMOLISH_MAX_FLOORS,
  InputError,
  computeDemolish,
  computePotential,
  computeProtection,
  computeRetrofit,
  estimateNewUnits,
  floorBand,
  isSmallBuilding,
  publicAllocation,
  validateInput,
  type BuildingInput,
  type SiteContext,
} from "./index";

const building = (o: Partial<BuildingInput> = {}): BuildingInput => ({
  existingFloors: 4,
  existingUnits: 16,
  typicalFloorArea: 400,
  groundFloor: "pilotis",
  retrofitNeeded: true,
  protectedSpaces: "none",
  residential: true,
  plotArea: 2000,
  frontageLength: 30,
  activeGroundUses: false,
  relocateGroundFloorUnits: false,
  newWing: false,
  publicEducation: "none",
  exclusions: {},
  ...o,
});

const site = (o: Partial<SiteContext> = {}): SiteContext => ({
  inPlan: true,
  streetClass: "cityWide",
  publicAllocationZone: false,
  urbanRenewalSearchZone: false,
  wellRadius: false,
  quarter: "ג",
  quarterQuota: null,
  ...o,
});

describe("floor band", () => {
  it.each([
    [1, "2"],
    [2, "2"],
    [3, "3"],
    [4, "4-5"],
    [5, "4-5"],
    [6, "6+"],
    [9, "6+"],
  ])("%i floors -> band %s", (f, band) => expect(floorBand(f)).toBe(band));
});

describe("Table 5 – demolish + rebuild, every row", () => {
  // existing floors, band, city-wide add, active/transit add, city-wide max, active/transit max
  const rows: [number, number, number, number, number][] = [
    [2, 4, 5, 8, 10],
    [3, 5, 6, 10, 12],
    [4, 6, 7, 13, 15],
    [5, 6, 7, 13, 15],
    [6, 6, 7, 16, 16],
    [8, 6, 7, 16, 16],
  ];
  it.each(rows)(
    "existing %i floors: add %i/%i, max %i/%i",
    (floors, addCity, addActive, maxCity, maxActive) => {
      // 3 units per floor, 300 m2: never a "small building" (2 x 300 > 400)
      const b = building({ existingFloors: floors, existingUnits: floors * 3, typicalFloorArea: 300 });
      const expanded = 300 + 35 * 3;

      const city = computeDemolish(b, site({ streetClass: "cityWide" }));
      expect(city.addedFullFloors).toBe(addCity);
      expect(city.maxFloors).toBe(maxCity);
      expect(city.coveragePct).toBe(60);
      expect(city.expandedFloorArea).toBe(expanded);
      expect(city.totalRights).toBeCloseTo(expanded * (floors + addCity), 1);

      for (const sc of ["activeFrontage", "massTransit"] as const) {
        const act = computeDemolish(b, site({ streetClass: sc }));
        expect(act.addedFullFloors).toBe(addActive);
        expect(act.maxFloors).toBe(maxActive);
        expect(act.coveragePct).toBe(70);
        expect(act.totalRights).toBeCloseTo(expanded * (floors + addActive), 1);
      }
    },
  );

  it("config table matches the plan values", () => {
    expect(DEMOLISH_ADD_FLOORS).toEqual({
      cityWide: { "2": 4, "3": 5, "4-5": 6, "6+": 6 },
      activeOrTransit: { "2": 5, "3": 6, "4-5": 7, "6+": 7 },
    });
    expect(DEMOLISH_MAX_FLOORS).toEqual({
      cityWide: { "2": 8, "3": 10, "4-5": 13, "6+": 16 },
      activeOrTransit: { "2": 10, "3": 12, "4-5": 15, "6+": 16 },
    });
  });

  it("expanded floor = floor area + 35 m2 per unit; rights = expanded x (existing + added)", () => {
    const r = computeDemolish(building(), site());
    // 16 units / 4 floors = 4 per floor -> 400 + 140 = 540; floors 4 + 6 = 10
    expect(r.expandedFloorArea).toBe(540);
    expect(r.totalRights).toBe(5400);
    expect(r.addedArea).toBe(5400 - 1600);
    expect(r.m2PerUnit).toBe(35);
  });

  it("+1 calculation floor for 2 kindergarten classes or 3 daycare classes", () => {
    for (const ed of ["kindergarten2", "daycare3"] as const) {
      const r = computeDemolish(building({ publicEducation: ed }), site());
      expect(r.addedFullFloors).toBe(7);
      expect(r.totalRights).toBe(540 * 11);
      expect(r.floorSteps.some((s) => s.label.includes("גן"))).toBe(true);
    }
  });

  it("states the unit mix requirement (20% <=55 m2, 10% <=80 m2)", () => {
    const r = computeDemolish(building(), site());
    expect(r.notes.some((n) => n.text.includes("20%") && n.text.includes("55") && n.text.includes("10%") && n.text.includes("80"))).toBe(true);
  });

  it("coverage limits the footprint and spreads rights into full floors + partial roof", () => {
    // plot 600 x 60% = 360 < 540 expanded -> 5400 / 360 = 15 floors exactly
    const r = computeDemolish(building({ plotArea: 600 }), site());
    expect(r.resultingFloors).toBe(15);
    expect(r.notes.some((n) => n.text.includes("תכסית"))).toBe(true);
    expect(r.notes.some((n) => n.text.includes("מעל המרבי"))).toBe(true);
    // plot 700 x 60% = 420 -> 12.857 floors -> 13 storeys (12 full + partial)
    const r2 = computeDemolish(building({ plotArea: 700 }), site());
    expect(r2.resultingFloors).toBe(13);
  });

  it("non-residential: demolish route is not defined", () => {
    const r = computeDemolish(building({ residential: false }), site());
    expect(r.blockers.length).toBeGreaterThan(0);
  });
});

describe("Retrofit + protection (4.1.2)", () => {
  it("city-wide: 2 full floors + partial roof (70%), +25 m2 per unit", () => {
    const r = computeRetrofit(building(), site());
    expect(r.m2PerUnit).toBe(25);
    expect(r.addedFullFloors).toBe(2);
    expect(r.partialRoofFraction).toBe(0.7);
    // expanded = 400 + 25*4 = 500; added = 16*25 + 2.7*500 = 400 + 1350
    expect(r.expandedFloorArea).toBe(500);
    expect(r.addedArea).toBe(1750);
    expect(r.resultingFloors).toBe(4 + 2 + 1);
  });

  it("active / transit street: +1 full floor only with active ground uses", () => {
    expect(computeRetrofit(building(), site({ streetClass: "activeFrontage" })).addedFullFloors).toBe(2);
    expect(computeRetrofit(building({ activeGroundUses: true }), site({ streetClass: "activeFrontage" })).addedFullFloors).toBe(3);
    expect(computeRetrofit(building({ activeGroundUses: true }), site({ streetClass: "massTransit" })).addedFullFloors).toBe(3);
    expect(computeRetrofit(building({ activeGroundUses: true }), site({ streetClass: "cityWide" })).addedFullFloors).toBe(2);
  });

  it("+1 floor if the ground floor is built", () => {
    expect(computeRetrofit(building({ groundFloor: "built" }), site()).addedFullFloors).toBe(3);
  });

  it("buildings of 6+ floors: +1 floor, +1 more when relocating ground-floor units", () => {
    const six = building({ existingFloors: 6, existingUnits: 24 });
    expect(computeRetrofit(six, site()).addedFullFloors).toBe(3);
    expect(computeRetrofit({ ...six, relocateGroundFloorUnits: true }, site()).addedFullFloors).toBe(4);
    // relocation alone does nothing below 6 floors
    expect(computeRetrofit(building({ relocateGroundFloorUnits: true }), site()).addedFullFloors).toBe(2);
  });

  it("all bonuses stack", () => {
    const b = building({ existingFloors: 7, existingUnits: 28, groundFloor: "built", activeGroundUses: true, relocateGroundFloorUnits: true });
    expect(computeRetrofit(b, site({ streetClass: "massTransit" })).addedFullFloors).toBe(2 + 1 + 1 + 1 + 1);
  });

  it("blocked when the building does not need earthquake retrofit", () => {
    const res = computePotential(building({ retrofitNeeded: false }), site());
    const r = res.routes.find((x) => x.route === "retrofit")!;
    expect(r.eligible).toBe(false);
  });

  it("retrofit status is derived from the permit year, not chosen", () => {
    const old = computePotential(building({ retrofitNeeded: undefined, permitYear: 1972 }), site());
    expect(old.routes[1].eligible).toBe(true);
    expect(old.input.retrofitNeeded).toBe(true);
    const newer = computePotential(building({ retrofitNeeded: true, permitYear: 1985 }), site());
    expect(newer.routes[1].eligible).toBe(false);
    expect(newer.routes[1].blockers[0].text).toContain("1985");
    expect(computePotential(building({ permitYear: 1980 }), site()).routes[1].eligible).toBe(false);
  });

  it("requires a permit year or an explicit retrofit status", () => {
    expect(validateInput(building({ retrofitNeeded: undefined }))).toContain("יש להזין את שנת היתר הבנייה");
    expect(validateInput(building({ permitYear: 85 })).length).toBe(1);
  });

  it("non-residential: +2 floors, no per-unit addition", () => {
    const r = computeRetrofit(building({ residential: false, existingUnits: 0 }), site());
    expect(r.addedFullFloors).toBe(2);
    expect(r.partialRoofFraction).toBe(0);
    expect(r.m2PerUnit).toBe(0);
    expect(r.addedArea).toBe(800);
  });
});

describe("Protection only (4.1.2)", () => {
  it("1 full floor + partial roof, +13 m2 per unit", () => {
    const r = computeProtection(building(), site());
    expect(r.m2PerUnit).toBe(13);
    expect(r.addedFullFloors).toBe(1);
    expect(r.partialRoofFraction).toBe(0.7);
    // expanded = 400 + 13*4 = 452; added = 16*13 + 1.7*452 = 208 + 768.4
    expect(r.expandedFloorArea).toBe(452);
    expect(r.addedArea).toBe(976.4);
  });

  it("+1 floor only for a built ground floor converted to active uses on active / transit streets", () => {
    const yes = building({ groundFloor: "built", activeGroundUses: true });
    expect(computeProtection(yes, site({ streetClass: "activeFrontage" })).addedFullFloors).toBe(2);
    expect(computeProtection(yes, site({ streetClass: "massTransit" })).addedFullFloors).toBe(2);
    expect(computeProtection(yes, site({ streetClass: "cityWide" })).addedFullFloors).toBe(1);
    expect(computeProtection(building({ groundFloor: "pilotis", activeGroundUses: true }), site({ streetClass: "activeFrontage" })).addedFullFloors).toBe(1);
    expect(computeProtection(building({ groundFloor: "built", activeGroundUses: false }), site({ streetClass: "activeFrontage" })).addedFullFloors).toBe(1);
  });

  it("not relevant when all units already have protected spaces", () => {
    expect(computeProtection(building({ protectedSpaces: "full" }), site()).blockers.length).toBe(1);
    expect(computeProtection(building({ protectedSpaces: "partial" }), site()).blockers.length).toBe(0);
  });

  it("non-residential: +1 floor", () => {
    const r = computeProtection(building({ residential: false, existingUnits: 0 }), site());
    expect(r.addedFullFloors).toBe(1);
    expect(r.partialRoofFraction).toBe(0);
  });
});

describe("Small buildings (<=2 floors, <=400 m2)", () => {
  const small = building({ existingFloors: 2, existingUnits: 4, typicalFloorArea: 180 });
  it("detects small buildings", () => {
    expect(isSmallBuilding(small)).toBe(true);
    expect(isSmallBuilding(building({ existingFloors: 2, typicalFloorArea: 201 }))).toBe(false);
    expect(isSmallBuilding(building({ existingFloors: 3, typicalFloorArea: 100 }))).toBe(false);
  });
  it("+25 m2 per unit only, no floors, no new units; demolish blocked", () => {
    const p = computeProtection(small, site());
    const r = computeRetrofit(small, site());
    for (const x of [p, r]) {
      expect(x.m2PerUnit).toBe(25);
      expect(x.addedFullFloors).toBe(0);
      expect(x.partialRoofFraction).toBe(0);
      expect(x.addedArea).toBe(100);
      expect(x.addsUnits).toBe(false);
    }
    expect(computeDemolish(small, site()).blockers.length).toBe(1);
  });
});

describe("Public allocation in marked zones", () => {
  const zone = site({ publicAllocationZone: true });

  it("not applicable outside the zone", () => {
    expect(publicAllocation("demolish", building(), site(), 500, 5000).applies).toBe(false);
  });
  it("30% of ground floor", () => {
    const p = publicAllocation("demolish", building(), zone, 500, 10000);
    expect(p.required).toBe(true);
    expect(p.area).toBe(150);
  });
  it("minimum 50 m2", () => {
    expect(publicAllocation("demolish", building(), zone, 100, 10000).area).toBe(50);
  });
  it("maximum 15% of rights (overrides the minimum)", () => {
    expect(publicAllocation("demolish", building(), zone, 500, 600).area).toBe(90);
    expect(publicAllocation("demolish", building(), zone, 100, 200).area).toBe(30);
  });
  it("exemption 1: ground floor not vacated and no new wing", () => {
    const p = publicAllocation("retrofit", building({ newWing: false }), zone, 500, 5000);
    expect(p.required).toBe(false);
    expect(p.exemption).toContain("אגף");
    expect(publicAllocation("retrofit", building({ newWing: true }), zone, 500, 5000).required).toBe(true);
  });
  it("exemption 2: frontage shorter than 15 m", () => {
    expect(publicAllocation("demolish", building({ frontageLength: 14.9 }), zone, 500, 5000).required).toBe(false);
    expect(publicAllocation("demolish", building({ frontageLength: 15 }), zone, 500, 5000).required).toBe(true);
  });
  it("exemption 3: well protection radius", () => {
    expect(publicAllocation("demolish", building(), { ...zone, wellRadius: true }, 500, 5000).exemption).toContain("קידוח");
  });
  it("exemption 4: mass-transit axis", () => {
    expect(publicAllocation("demolish", building(), { ...zone, streetClass: "massTransit" }, 500, 5000).exemption).toContain("הסעת המונים");
    expect(publicAllocation("demolish", building(), { ...zone, streetClass: "activeFrontage" }, 500, 5000).required).toBe(true);
  });
});

describe("Exclusions and global state", () => {
  it.each([
    [{ slatedForDemolition: true }, "7.2"],
    [{ approvedPinuiBinui: true }, "7.2"],
    [{ tama38Transition: true }, "7.2.4"],
  ])("%o blocks every route", (exclusions, section) => {
    const res = computePotential(building({ exclusions }), site());
    expect(res.globalBlockers[0].section).toBe(section);
    expect(res.routes.every((r) => !r.eligible)).toBe(true);
  });

  it("out of plan blocks every route", () => {
    const res = computePotential(building(), site({ inPlan: false }));
    expect(res.routes.every((r) => !r.eligible)).toBe(true);
  });

  it("unknown plan boundary adds an assumption but does not block", () => {
    const res = computePotential(building(), site({ inPlan: null }));
    expect(res.assumptions[0]).toContain("גבול התכנית");
    expect(res.routes.every((r) => r.eligible)).toBe(true);
  });

  it("returns routes in display order and always carries the disclaimer", () => {
    const res = computePotential(building(), site());
    expect(res.routes.map((r) => r.route)).toEqual(["protection", "retrofit", "demolish"]);
    expect(res.disclaimer).toContain("7.2.1");
    expect(res.disclaimer).toContain("6.1.3");
  });

  it("urban-renewal search zone adds a note to every route", () => {
    const res = computePotential(building(), site({ urbanRenewalSearchZone: true }));
    expect(res.routes.every((r) => r.notes.some((n) => n.text.includes("ב׳")))).toBe(true);
  });

  it("exhausted quarter quota blocks routes that add units", () => {
    const res = computePotential(building(), site({ quarter: "ח", quarterQuota: { threshold: 100, used: 100 } }));
    expect(res.routes.every((r) => !r.eligible)).toBe(true);
    const small = computePotential(building({ existingFloors: 2, existingUnits: 4, typicalFloorArea: 180 }), site({ quarter: "ח", quarterQuota: { threshold: 100, used: 100 } }));
    expect(small.routes.find((r) => r.route === "protection")!.eligible).toBe(true);
  });

  it("unknown quarter usage is a note, not a blocker", () => {
    const res = computePotential(building(), site({ quarter: "ד", quarterQuota: { threshold: 1200, used: null } }));
    expect(res.routes.every((r) => r.eligible)).toBe(true);
    expect(res.routes[0].notes.some((n) => n.text.includes("1,200"))).toBe(true);
  });
});

describe("Input validation", () => {
  it("rejects impossible input", () => {
    expect(validateInput(building({ existingFloors: 0 }))).not.toHaveLength(0);
    expect(validateInput(building({ typicalFloorArea: -1 }))).not.toHaveLength(0);
    expect(validateInput(building({ plotArea: 0 }))).not.toHaveLength(0);
    expect(validateInput(building({ existingUnits: 2.5 }))).not.toHaveLength(0);
    expect(() => computePotential(building({ existingFloors: 0 }), site())).toThrow(InputError);
  });
  it("accepts a valid building", () => {
    expect(validateInput(building())).toHaveLength(0);
  });
});

describe("new apartments per existing apartment (indicative)", () => {
  // 4 floors x 400 m2, 16 units -> 4 per floor, city-wide street
  it("protection: 1.7 expanded floors of 452 m2 -> 8 new units", () => {
    const b = building();
    const e = estimateNewUnits(computeProtection(b, site()), b, 95);
    expect(e.returnedArea).toBe(1808);
    expect(e.saleableArea).toBe(768.4);
    expect(e.newUnits).toBe(8);
    expect(e.perExistingUnit).toBe(0.5);
    expect(e.residentsStay).toBe(true);
  });

  it("retrofit: 2.7 expanded floors of 500 m2 -> 14 new units", () => {
    const b = building();
    const e = estimateNewUnits(computeRetrofit(b, site()), b, 95);
    expect(e.saleableArea).toBe(1350);
    expect(e.newUnits).toBe(14);
    expect(e.perExistingUnit).toBe(0.88);
  });

  it("demolish: rights less returned apartments (existing + 35 m2 each)", () => {
    const b = building();
    const e = estimateNewUnits(computeDemolish(b, site()), b, 95);
    expect(e.returnedArea).toBe(2160);
    expect(e.realizableRights).toBe(5400);
    expect(e.saleableArea).toBe(3240);
    expect(e.newUnits).toBe(34);
    expect(e.perExistingUnit).toBe(2.13);
    expect(e.residentsStay).toBe(false);
  });

  it("demolish: rights above the maximum floor count are not counted", () => {
    const b = building({ plotArea: 500 }); // footprint 300 -> 18 floors needed, max 13
    const e = estimateNewUnits(computeDemolish(b, site()), b, 95);
    expect(e.realizableRights).toBe(3900);
    expect(e.newUnits).toBe(18);
  });

  it("public allocation is deducted", () => {
    const b = building();
    const r = computeDemolish(b, site({ publicAllocationZone: true }));
    expect(r.publicAllocation.area).toBe(162);
    expect(estimateNewUnits(r, b, 95).newUnits).toBe(32);
  });

  it("small building and non-residential: no new units", () => {
    const small = building({ existingFloors: 2, existingUnits: 4, typicalFloorArea: 150 });
    expect(estimateNewUnits(computeRetrofit(small, site()), small).newUnits).toBe(0);
    const office = building({ residential: false, existingUnits: 0 });
    expect(estimateNewUnits(computeRetrofit(office, site()), office).newUnits).toBe(0);
  });

  it("average apartment area is clamped to a sane range", () => {
    const b = building();
    const r = computeRetrofit(b, site());
    expect(estimateNewUnits(r, b, 10).newUnits).toBe(Math.floor(1350 / 40));
    expect(estimateNewUnits(r, b, 0).newUnits).toBe(14);
  });
});
