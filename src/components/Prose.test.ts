import { describe, expect, it } from "vitest";
import { sentences } from "./Prose";

describe("Prose layout", () => {
  it("puts each sentence on its own and breaks lines after commas", () => {
    expect(sentences("א, ב. ג.")).toEqual([["א,", "ב."], ["ג."]]);
  });
  it("leaves numbers and section references alone", () => {
    expect(sentences("22,565 יח\"ד לפי סעיף 4.1.2 ו-3.3 מ'.")).toEqual([["22,565 יח\"ד לפי סעיף 4.1.2 ו-3.3 מ'."]]);
  });
  it("keeps a colon inside the sentence", () => {
    expect(sentences("מקור: נספח התנועה.")).toEqual([["מקור: נספח התנועה."]]);
  });
});
