import { describe, expect, it } from "vitest";
import { FAQ } from "@/content/faq";
import { asksForComputation, matchFaq, normalize, retrieve, retrieveRows, sectionsById } from "./retrieval";

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
    // shares only the generic word "תכנית" with the exclusions answer
    expect(matchFaq("מה מטרות התכנית לחיזוק מבנים בפני רעידות אדמה?")).toBeNull();
  });

  it("every answer cites at least one section and links to existing sections", () => {
    for (const f of FAQ) {
      expect(f.a).toMatch(/\(|סעיף|טבלה/);
      expect(sectionsById(f.sections)).toHaveLength(f.sections.length);
    }
  });
});

describe("verbatim plan text retrieval", () => {
  const row = (id: number, body: string, section: string | null = null) => ({ id, ord: id, kind: "para" as const, section, title: null, body, page: 1, source: "הוראות התכנית" });
  const rows = [
    row(1, "בקומת הקרקע תותר הקצאה של שטח לצרכי ציבור בהיקף של 30 אחוז משטח הקומה", "4.1.2ה"),
    row(2, "גובה הבניין לא יעלה על מספר הקומות המרבי הקבוע בטבלה 5", "5"),
    row(3, "קצר"),
  ];
  it("finds the matching paragraph", () => {
    expect(retrieveRows(rows, "הקצאה לצרכי ציבור בקומת הקרקע")[0].id).toBe(1);
  });
  it("ignores unrelated questions and very short rows", () => {
    expect(retrieveRows(rows, "מזג אוויר")).toHaveLength(0);
    expect(retrieveRows([row(3, "קצר")], "קצר")).toHaveLength(0);
  });
});

describe("verbatim retrieval with few rows", () => {
  const row = (id: number, body: string) => ({ id, ord: id, kind: "para" as const, section: null, title: null, body, page: null, source: "מטרות התכנית" });
  it("finds objectives when every row shares the vocabulary", () => {
    const rows = [
      row(1, "תכנית עירונית להתחדשות בניינים טעונים חיזוק ומיגון, אשדוד"),
      row(2, "קביעת הוראות לחיזוק מבנים בפני רעידות אדמה ומיגונם, ומיגון מבנים קיימים תוך הוספת שימושים"),
      row(3, "קביעת תחולת תכנית זו לגבי מבנים בעיר"),
    ];
    expect(retrieveRows(rows, "מה הוראות החיזוק בפני רעידות אדמה?").map((r) => r.id)).toContain(2);
  });
});
