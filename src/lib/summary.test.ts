import { describe, expect, it } from "vitest";
import { computePotential, estimateNewUnits } from "@/engine";
import { floorsPhrase, summarize, summaryBlocks, unitsVerdict } from "./summary";

const rep = computePotential(
  { existingFloors: 4, existingUnits: 16, typicalFloorArea: 400, groundFloor: "pilotis", retrofitNeeded: false, protectedSpaces: "none", residential: true, plotArea: 2000 },
  { inPlan: true, streetClass: "cityWide", publicAllocationZone: false, urbanRenewalSearchZone: false, wellRadius: false, quarter: null },
);

describe("summary", () => {
  it("one line per route, with blockers for ineligible routes", () => {
    const s = summarize(rep);
    expect(s).toHaveLength(3);
    expect(s[1]).toContain("לא זמין");
    expect(s[0]).toContain("13");
    expect(s[2]).toContain("5,400");
  });
  it("phrases floors as full + partial", () => {
    expect(floorsPhrase(rep.routes[0])).toBe("קומה מלאה אחת וקומת גג חלקית (70%)");
  });
  it("units verdict: best route, with relocation on demolish", () => {
    const v = unitsVerdict(rep.routes.map((r) => estimateNewUnits(r, rep.input, 95)));
    expect(v.title).toBe("המסלול שמוסיף הכי הרבה דירות: הריסה ובנייה מחדש");
    expect(v.text).toContain("34");
    expect(v.text).toContain("מתפנים");
  });
  it("units verdict: demolish vs retrofit gap", () => {
    const r2 = computePotential({ ...rep.input, retrofitNeeded: true }, rep.site);
    const v = unitsVerdict(r2.routes.map((r) => estimateNewUnits(r, r2.input, 95)));
    expect(v.title).toContain("פינוי זמני");
    expect(v.text).toContain("הפרש של 20");
  });
});

describe("summaryBlocks", () => {
  it("one block per route, values match the engine output", () => {
    const blocks = summaryBlocks(rep);
    expect(blocks.map((b) => b.title)).toEqual(rep.routes.map((r) => r.title));
    expect(blocks[1].eligible).toBe(false);
    expect(blocks[0].items.find((i) => i.label === 'תוספת ליח"ד')?.value).toBe('13 מ"ר');
    expect(blocks[2].items.find((i) => i.label === "סך זכויות")?.value).toContain("5,400");
    expect(blocks.every((b) => b.items.length > 0)).toBe(true);
  });
});
