// Splits plan text into typed segments so the viewer can emphasize numbers, units and section references
// and mark search matches. Pure function, unit tested.

export type Seg = { t: string; k: "text" | "num" | "param" | "ref" | "hit" };

const PARAMS = ['מ"ר', "מ״ר", "מטר", "מ'", "מ׳", "קומות", "קומה", 'יח"ד', "יח״ד", "דונם", "%", "אחוז", "תכסית", "גובה"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TOKEN = new RegExp(
  [
    "(\\d+(?:\\.\\d+){1,4}[א-ת]?(?:\\.\\d+)?)", // section refs like 4.1.2 or 4.1.2ג.3
    "(\\d+(?:[.,]\\d+)?)", // plain numbers
    `(${PARAMS.map(esc).join("|")})`, // parameters and units
  ].join("|"),
  "g",
);

function typed(text: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ t: text.slice(last, m.index), k: "text" });
    out.push({ t: m[0], k: m[1] ? "ref" : m[2] ? "num" : "param" });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), k: "text" });
  return out;
}

/** Search terms are matched as substrings, so Hebrew prefixes (ה, ו, ב, ל...) still match. */
export function segments(text: string, terms: string[]): Seg[] {
  const clean = terms.map((t) => t.trim()).filter((t) => t.length >= 2);
  if (!clean.length) return typed(text);
  const re = new RegExp(`(${clean.map(esc).join("|")})`, "g");
  const out: Seg[] = [];
  text.split(re).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) out.push({ t: part, k: "hit" });
    else out.push(...typed(part));
  });
  return out;
}

export function matches(text: string, terms: string[]): boolean {
  const clean = terms.map((t) => t.trim()).filter((t) => t.length >= 2);
  return clean.length > 0 && clean.every((t) => text.includes(t));
}
