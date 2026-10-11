import { describe, expect, it } from "vitest";
import { extractFields, logicalOrder, mergeExtracted } from "./extract";

const permit = `מדינת ישראל - הוועדה המקומית לתכנון ובנייה אשדוד
היתר בנייה מס' 1234 מיום 12/05/1974
גוש 2075 חלקה 41
שטח המגרש: 1,520 מ"ר
בניין מגורים בן 4 קומות מעל קומת עמודים מפולשת
מספר יח"ד: 16
שטח קומה טיפוסית 412.5 מ"ר
אורך חזית המגרש 32 מ'`;

const get = (xs: ReturnType<typeof extractFields>, k: string) => xs.find((x) => x.key === k)?.value;

describe("extractFields", () => {
  it("reads the main fields from a permit", () => {
    const xs = extractFields(permit, "permit.pdf");
    expect(get(xs, "permitYear")).toBe("1974");
    expect(get(xs, "plotArea")).toBe("1520");
    expect(get(xs, "existingFloors")).toBe("4");
    expect(get(xs, "existingUnits")).toBe("16");
    expect(get(xs, "typicalFloorArea")).toBe("412.5");
    expect(get(xs, "frontageLength")).toBe("32");
    expect(get(xs, "groundFloor")).toBe("pilotis");
    expect(get(xs, "gush")).toBe("2075");
    expect(get(xs, "helka")).toBe("41");
    expect(xs.every((x) => x.quote.length > 0 && x.source === "permit.pdf")).toBe(true);
  });

  it("handles text stored in visual (reversed) order", () => {
    const visual = logicalOrder('שטח המגרש: 1,520 מ"ר');
    expect(visual).not.toContain("מגרש");
    expect(get(extractFields(visual, "x.pdf"), "plotArea")).toBe("1520");
  });

  it("ignores implausible values", () => {
    expect(get(extractFields("שטח המגרש 12 מ\"ר", "x"), "plotArea")).toBeUndefined();
    expect(get(extractFields("בניין בן 400 קומות", "x"), "existingFloors")).toBeUndefined();
  });

  it("first file wins on merge", () => {
    const a = extractFields("שטח המגרש 900 מ\"ר", "a");
    const b = extractFields("שטח המגרש 1000 מ\"ר\nמספר יח\"ד 8", "b");
    const m = mergeExtracted([a, b]);
    expect(get(m, "plotArea")).toBe("900");
    expect(get(m, "existingUnits")).toBe("8");
  });
});
