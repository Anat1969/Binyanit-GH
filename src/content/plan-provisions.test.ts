import { describe, expect, it } from "vitest";
import type { PlanTextRow } from "@/lib/data";
import { buildProvisions, chapterOf } from "./plan-provisions";
import { PLAN_SECTIONS } from "./plan-sections";

const row = (id: number, p: Partial<PlanTextRow>): PlanTextRow => ({
  id, ord: id, kind: "para", section: null, title: null, body: "", page: null, source: "הוראות התכנית", ...p,
});

describe("plan provisions", () => {
  it("maps section references to chapters", () => {
    expect(chapterOf("4.1.2")).toBe(4);
    expect(chapterOf("4.1.2, טבלה 5")).toBe(4);
    expect(chapterOf("טבלה 5")).toBe(5);
    expect(chapterOf("7.2.1, 6.1.3")).toBe(7);
    expect(chapterOf("6")).toBe(6);
    expect(chapterOf("מבוא")).toBe(2);
    expect(chapterOf("תשריט: הנחיות מיוחדות ב׳")).toBe(4);
    expect(chapterOf(null)).toBeNull();
  });

  it("builds seven chapters and places every working section", () => {
    const ch = buildProvisions([]);
    expect(ch.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ch[0].sections[0].status).toBe("official");
    expect(ch[3].sections.some((s) => s.id === "searchzone")).toBe(true);
    expect(ch[4].sections.map((s) => s.id)).toEqual(["table5"]);
    expect(ch[6].sections.map((s) => s.id)).toEqual(["exclusions", "tama38", "discretion"]);
    expect(ch[2].sections).toEqual([]);
    expect(ch.flatMap((c) => c.sections).filter((s) => s.status === "working")).toHaveLength(PLAN_SECTIONS.length);
  });

  it("puts the Planning Administration goals under chapter 2 next to the working text", () => {
    const src = "מטרות התכנית (מינהל התכנון)";
    const ch = buildProvisions([
      row(1, { kind: "heading", body: "תכנית עירונית", source: src }),
      row(2, { body: "קביעת הוראות לחיזוק", source: src }),
      row(3, { kind: "item", body: "1. קביעת תחולה", source: src }),
    ]);
    const s = ch[1].sections[0];
    expect(s).toMatchObject({ title: "תכנית עירונית", body: ["קביעת הוראות לחיזוק", "1. קביעת תחולה"], status: "official" });
    expect(ch[1].sections.some((x) => x.status === "working")).toBe(true);
  });

  it("verbatim provisions replace the working summary in their chapter only", () => {
    const ch = buildProvisions([
      row(1, { kind: "heading", section: "7.2", title: "חריגים", body: "", page: 30 }),
      row(2, { kind: "item", section: "7.2.1", body: "א. הוראה" }),
      row(3, { kind: "heading", section: "7.3", body: "הוראות מעבר" }),
    ]);
    expect(ch[6].sections.map((s) => s.title)).toEqual(["חריגים", "הוראות מעבר"]);
    expect(ch[6].sections[0]).toMatchObject({ ref: "7.2", body: ["א. הוראה"], status: "verbatim", source: "הוראות התכנית, עמ׳ 30" });
    expect(ch[6].sections.every((s) => s.status === "verbatim")).toBe(true);
    expect(ch[3].sections.every((s) => s.status === "working")).toBe(true);
  });
});
