// Pulls building data out of the text of uploaded documents (building permit, survey map,
// land registry extract). Deterministic patterns only; every value keeps the quote it came from
// so the user can check it before computing.

export type ExtractKey =
  | "permitYear"
  | "existingFloors"
  | "existingUnits"
  | "typicalFloorArea"
  | "plotArea"
  | "frontageLength"
  | "groundFloor"
  | "gush"
  | "helka";

export interface Extracted {
  key: ExtractKey;
  value: string;
  quote: string;
  source: string; // file name
}

export const EXTRACT_LABEL: Record<ExtractKey, string> = {
  permitYear: "שנת היתר הבנייה",
  existingFloors: "קומות קיימות",
  existingUnits: 'יח"ד קיימות',
  typicalFloorArea: 'שטח קומה טיפוסית (מ"ר)',
  plotArea: 'שטח מגרש (מ"ר)',
  frontageLength: "אורך חזית (מ׳)",
  groundFloor: "קומת קרקע",
  gush: "גוש",
  helka: "חלקה",
};

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const GAP = String.raw`[^\d\n]{0,25}?`;

const PATTERNS: { key: ExtractKey; re: RegExp; ok?: (n: number) => boolean }[] = [
  { key: "plotArea", re: new RegExp(String.raw`שטח\s*(?:ה)?מגרש${GAP}${NUM}`), ok: (n) => n >= 100 && n <= 50_000 },
  { key: "plotArea", re: new RegExp(String.raw`שטח\s*(?:ה)?חלקה${GAP}${NUM}`), ok: (n) => n >= 100 && n <= 50_000 },
  { key: "plotArea", re: new RegExp(String.raw`שטח\s*רשום${GAP}${NUM}`), ok: (n) => n >= 100 && n <= 50_000 },
  { key: "typicalFloorArea", re: new RegExp(String.raw`שטח\s*(?:ה)?קומה(?:\s*ה?טיפוסית)?${GAP}${NUM}`), ok: (n) => n >= 40 && n <= 5000 },
  { key: "existingFloors", re: new RegExp(String.raw`(?:מס(?:פר|'|׳)?\s*(?:ה)?קומות|קומות\s*מעל\s*(?:ה)?קרקע)${GAP}${NUM}`), ok: (n) => Number.isInteger(n) && n >= 1 && n <= 40 },
  { key: "existingFloors", re: new RegExp(String.raw`${NUM}\s*קומות`), ok: (n) => Number.isInteger(n) && n >= 1 && n <= 40 },
  { key: "existingUnits", re: new RegExp(String.raw`(?:מס(?:פר|'|׳)?\s*(?:ה)?(?:יח["״]?ד|יחידות\s*(?:ה)?דיור|דירות))${GAP}${NUM}`), ok: (n) => Number.isInteger(n) && n >= 1 && n <= 400 },
  { key: "existingUnits", re: new RegExp(String.raw`${NUM}\s*(?:יח["״]ד|יחידות\s*דיור|דירות)`), ok: (n) => Number.isInteger(n) && n >= 1 && n <= 400 },
  { key: "frontageLength", re: new RegExp(String.raw`(?:אורך\s*)?(?:ה)?חזית${GAP}${NUM}\s*(?:מ['׳]?|מטר)`), ok: (n) => n >= 3 && n <= 500 },
  { key: "gush", re: /גוש\s*:?\s*(\d{3,6})/ },
  { key: "helka", re: /חלקה\s*:?\s*(\d{1,4})(?!\d)/ },
];

const YEAR = String.raw`(19[3-9]\d|20[0-3]\d)`;
const PERMIT_YEAR = [
  new RegExp(String.raw`היתר[^\n]{0,60}?\d{1,2}[./-]\d{1,2}[./-]${YEAR}`),
  new RegExp(String.raw`היתר[^\n]{0,60}?(?:משנת|בשנת|שנת)\s*${YEAR}`),
  new RegExp(String.raw`(?:תאריך\s*(?:מתן\s*)?(?:ה)?היתר|שנת\s*(?:ה)?היתר|שנת\s*בנייה|שנת\s*בניה|שנת\s*הקמה)${GAP}${YEAR}`),
];

/** Hebrew PDFs often store text in visual order. Reverse the line, then restore digit / latin runs. */
export function logicalOrder(line: string): string {
  const rev = [...line].reverse().join("");
  return rev.replace(/[0-9A-Za-z.,:/-]+/g, (run) => [...run].reverse().join(""));
}

function looksVisual(line: string) {
  return /(שרגמ|תומוק|רתיה|חטש|הקלח|שוג|ד"חי|תוריד)/.test(line);
}

const num = (s: string) => Number(s.replace(/,/g, ""));

export function extractFields(text: string, source: string): Extracted[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((l) => (looksVisual(l) ? logicalOrder(l) : l));
  const out: Extracted[] = [];
  const seen = new Set<ExtractKey>();
  const push = (key: ExtractKey, value: string, quote: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, value, quote: quote.slice(0, 140), source });
  };
  for (const line of lines) {
    for (const p of PATTERNS) {
      if (seen.has(p.key)) continue;
      const m = line.match(p.re);
      if (!m) continue;
      const v = num(m[1]);
      if (p.ok && !p.ok(v)) continue;
      push(p.key, String(v), line);
    }
    if (!seen.has("permitYear")) {
      for (const re of PERMIT_YEAR) {
        const m = line.match(re);
        if (m) {
          push("permitYear", m[1], line);
          break;
        }
      }
    }
    if (!seen.has("groundFloor")) {
      if (/קומת\s*עמודים|קומה\s*מפולשת|עמודים\s*מפולשת/.test(line)) push("groundFloor", "pilotis", line);
      else if (/קומת\s*קרקע\s*(?:בנויה|למגורים)|דירות\s*בקומת\s*(?:ה)?קרקע/.test(line)) push("groundFloor", "built", line);
    }
  }
  return out;
}

/** Merge results from several files; the first file that yields a field wins. */
export function mergeExtracted(lists: Extracted[][]): Extracted[] {
  const out = new Map<ExtractKey, Extracted>();
  for (const l of lists) for (const e of l) if (!out.has(e.key)) out.set(e.key, e);
  return [...out.values()];
}
