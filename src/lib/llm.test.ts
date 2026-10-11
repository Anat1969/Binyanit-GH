import { describe, expect, it } from "vitest";
import { groundedAnswer } from "./llm";

const src = 'באזורים המסומנים תידרש הקצאה: 30% משטח קומת הקרקע, לא פחות מ-50 מ"ר ולא יותר מ-15% מהזכויות. חזית קצרה מ-15 מטר.';

describe("grounding guard", () => {
  it("accepts an answer whose numbers all come from the sources and that cites a section", () => {
    expect(groundedAnswer('נדרשת הקצאה של 30% מקומת הקרקע, לפחות 50 מ"ר (4.1.2).', src, "מתי יש הקצאה?", ["4.1.2"])).toBe(true);
  });
  it("rejects invented numbers", () => {
    expect(groundedAnswer('לבניין שלך מותרים 640 מ"ר נוספים (4.1.2).', src, "כמה מותר?", ["4.1.2"])).toBe(false);
    expect(groundedAnswer("מותרות 9 קומות (4.1.2).", src, "כמה קומות?", ["4.1.2"])).toBe(false);
  });
  it("rejects answers without a section citation", () => {
    expect(groundedAnswer("נדרשת הקצאה של 30% מקומת הקרקע.", src, "מתי?", ["4.1.2"])).toBe(false);
  });
  it("allows numbers from the question and the discretion sections", () => {
    expect(groundedAnswer("בבניין בן 4 קומות חלות הוראות הסעיף (4.1.2, 7.2.1).", src, "בניין בן 4 קומות", ["4.1.2"])).toBe(true);
  });
});

describe("grounding guard, unnumbered sources", () => {
  const src = "קביעת הוראות לחיזוק מבנים בפני רעידות אדמה ומיגונם";
  it("accepts a citation by source name", () => {
    expect(groundedAnswer("התכנית קובעת הוראות לחיזוק מבנים בפני רעידות אדמה (מטרות התכנית).", src, "", ["מטרות התכנית (מינהל התכנון)"])).toBe(true);
  });
  it("still rejects an answer with no citation", () => {
    expect(groundedAnswer("התכנית קובעת הוראות לחיזוק מבנים.", src, "", ["מטרות התכנית (מינהל התכנון)"])).toBe(false);
  });
});
