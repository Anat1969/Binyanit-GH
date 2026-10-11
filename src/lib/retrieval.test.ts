import { describe, expect, it } from "vitest";
import { FAQ } from "@/content/faq";
import { asksForComputation, matchFaq, normalize, retrieve, sectionsById } from "./retrieval";

describe("retrieval", () => {
  it("strips Hebrew prefixes and final letters", () => {
    expect(normalize("והקומות")).toBe(normalize("קומות"));
    expect(normalize("לרחוב")).toBe("רחוב");
  });
  it("finds the public allocation section", () => {
    expect(retrieve("מתי יש פטור מהקצאה לצרכי ציבור?")[0].section.id).toBe("public");
  });
  it("finds the TAMA 38 transition section", () => {
    expect(retrieve("הוראות מעבר תמ\"א 38").map((h) => h.section.id)).toContain("tama38");
  });
  it("finds table 5 for max floors questions", () => {
    expect(retrieve("מספר קומות מרבי בהריסה ובנייה").map((h) => h.section.id)).toContain("table5");
  });
  it("returns nothing for unrelated questions", () => {
    expect(retrieve("מזג אוויר בפריז")).toHaveLength(0);
  });
});

describe("computation refusal", () => {
  it.each([
    "כמה קומות אפשר להוסיף לבניין שלי?",
    "תחשב לי זכויות לבניין של 4 קומות",
    "מה הזכויות בכתובת הרצל 12",
  ])("refuses: %s", (q) => expect(asksForComputation(q)).toBe(true));
  it.each(["מה התנאים למסלול חיזוק ומיגון?", "מתי יש פטור מהקצאה לצרכי ציבור?"])("answers: %s", (q) =>
    expect(asksForComputation(q)).toBe(false),
  );
});

describe("pre-written answers", () => {
  it.each([
    ["מתי יש פטור מהקצאה לצרכי ציבור?", "public"],
    ["מה ההבדל בין המסלולים?", "routes"],
    ["מה זו קומת גג חלקית", "partial-roof"],
    ["האם הזכויות מובטחות לי?", "vested"],
    ["כמה זמן התכנית בתוקף", "validity"],
    ["מה קורה עם בקשת תמ\"א 38 שהגשנו?", "tama38"],
    ["איזה תמהיל דירות צריך", "unit-mix"],
    ["מה מקבלים על גן ילדים בפרויקט", "education"],
    ["מה התכסית בהריסה ובנייה", "coverage"],
  ])("%s -> %s", (q, id) => expect(matchFaq(q)?.item.id).toBe(id));

  it("no confident answer for unrelated questions", () => {
    expect(matchFaq("מזג אוויר בפריז")).toBeNull();
    expect(matchFaq("מה שעות הפתיחה של הבנק")).toBeNull();
  });

  it("every answer cites at least one section and links to existing sections", () => {
    for (const f of FAQ) {
      expect(f.a).toMatch(/\(|סעיף|טבלה/);
      expect(sectionsById(f.sections)).toHaveLength(f.sections.length);
    }
  });
});
