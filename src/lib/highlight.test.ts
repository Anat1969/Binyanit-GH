import { describe, expect, it } from "vitest";
import { matches, segments } from "./highlight";

describe("plan text highlighting", () => {
  it("marks section references, numbers and parameters", () => {
    const s = segments('לפי סעיף 4.1.2ג.3 תותר תוספת של 25 מ"ר ו-2 קומות', []);
    expect(s.find((x) => x.k === "ref")?.t).toBe("4.1.2ג.3");
    expect(s.filter((x) => x.k === "num").map((x) => x.t)).toEqual(["25", "2"]);
    expect(s.filter((x) => x.k === "param").map((x) => x.t)).toEqual(['מ"ר', "קומות"]);
    expect(s.map((x) => x.t).join("")).toBe('לפי סעיף 4.1.2ג.3 תותר תוספת של 25 מ"ר ו-2 קומות');
  });
  it("marks search hits inside words, keeping the full text", () => {
    const s = segments("הקצאה לצרכי ציבור בקומת הקרקע", ["קרקע"]);
    expect(s.filter((x) => x.k === "hit").map((x) => x.t)).toEqual(["קרקע"]);
    expect(s.map((x) => x.t).join("")).toBe("הקצאה לצרכי ציבור בקומת הקרקע");
  });
  it("requires every term to match", () => {
    expect(matches("הקצאה לצרכי ציבור בקומת הקרקע", ["הקצאה", "קרקע"])).toBe(true);
    expect(matches("הקצאה לצרכי ציבור", ["הקצאה", "קרקע"])).toBe(false);
    expect(matches("טקסט", ["א"])).toBe(false);
  });
});
