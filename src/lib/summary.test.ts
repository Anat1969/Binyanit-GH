import { describe, expect, it } from "vitest";
import { computePotential } from "@/engine";
import { floorsPhrase, summarize } from "./summary";

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
});
