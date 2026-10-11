import { FAQ, type FaqItem } from "@/content/faq";
import { PLAN_SECTIONS, type PlanSection } from "@/content/plan-sections";
import type { PlanTextRow } from "./data";

const PREFIXES = ["וה", "שה", "וב", "ול", "ומ", "כש", "מה", "בה", "לה", "ה", "ו", "ב", "ל", "מ", "ש", "כ"];
const STOP = new Set(["של", "את", "על", "עם", "או", "גם", "זה", "זו", "מה", "איך", "האם", "אם", "כל", "יש", "אין", "לא", "כן", "הוא", "היא", "אני", "אתה", "לי", "כמה"]);

export function normalize(word: string): string {
  let w = word.replace(/["'״׳]/g, "").replace(/[ךםןףץ]$/, (ch) => ({ ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" })[ch] as string);
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      w = w.slice(p.length);
      break;
    }
  }
  return w.replace(/(ות|ים)$/, (m) => (w.length > 4 ? "" : m));
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[֐-׿a-z0-9.]+/g) ?? [])
    .filter((t) => !STOP.has(t))
    .map(normalize)
    .filter((t) => t.length > 1);
}

interface Indexed<T> {
  doc: T;
  tf: Map<string, number>;
  len: number;
}

function buildIndex<T>(docs: T[], text: (d: T) => string) {
  const items: Indexed<T>[] = docs.map((doc) => {
    const toks = tokenize(text(doc));
    const tf = new Map<string, number>();
    toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    return { doc, tf, len: toks.length };
  });
  const df = new Map<string, number>();
  items.forEach((it) => it.tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const avg = items.reduce((s, i) => s + i.len, 0) / items.length;
  return { items, df, avg, n: items.length };
}

function search<T>(index: ReturnType<typeof buildIndex<T>>, query: string, k: number) {
  const q = [...new Set(tokenize(query))];
  const { items, df, avg, n } = index;
  const k1 = 1.4;
  const b = 0.75;
  return items
    .map((it) => {
      let score = 0;
      for (const t of q) {
        const f = it.tf.get(t);
        if (!f) continue;
        const idf = Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * it.len) / avg));
      }
      return { doc: it.doc, score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}

const SECTION_INDEX = buildIndex(PLAN_SECTIONS, (d) => `${d.title} ${d.title} ${d.text} ${d.section}`);
// Questions and their phrasings weigh three times the answer text.
const FAQ_INDEX = buildIndex(FAQ, (d) => `${d.q} ${d.q} ${d.q} ${d.alt.join(" ")} ${d.alt.join(" ")} ${d.alt.join(" ")} ${d.a}`);

export interface Hit {
  section: PlanSection;
  score: number;
}

export function retrieve(query: string, k = 4): Hit[] {
  return search(SECTION_INDEX, query, k).map((h) => ({ section: h.doc, score: h.score }));
}

/** BM25 over the verbatim plan text rows (built per call; the text changes rarely and is small). */
export function retrieveRows(rows: PlanTextRow[], query: string, k = 5): PlanTextRow[] {
  const usable = rows.filter((r) => r.body.length > 20);
  if (!usable.length) return [];
  const index = buildIndex(usable, (r) => `${r.section ?? ""} ${r.title ?? ""} ${r.body}`);
  const q = [...new Set(tokenize(query))];
  // With few rows IDF is flat, so also accept rows that share at least two distinct query terms.
  return search(index, query, k * 3)
    .filter((h) => h.score > 1.5 || q.filter((t) => index.items.find((it) => it.doc === h.doc)!.tf.has(t)).length >= 2)
    .slice(0, k)
    .map((h) => h.doc);
}

export const FAQ_MIN_SCORE = 6.5;

/** Best pre-written answer for a question, or null when no answer is a confident match. */
export function matchFaq(query: string): { item: FaqItem; score: number } | null {
  const [best] = search(FAQ_INDEX, query, 1);
  return best && best.score >= FAQ_MIN_SCORE ? { item: best.doc, score: best.score } : null;
}

export function sectionsById(ids: string[]): PlanSection[] {
  return ids.map((id) => PLAN_SECTIONS.find((s) => s.id === id)).filter((s): s is PlanSection => Boolean(s));
}

/** Questions asking the agent to compute rights for a specific building are refused and redirected to the engine. */
export function asksForComputation(q: string): boolean {
  const personal = /(שלי|שלנו|בבניין|לבניין|הבניין|בכתובת|ברחוב\s+\S+\s+\d+|\d+\s*(קומות|דירות|יח"?ד|מ"?ר))/;
  const compute = /(כמה|חשב|תחשב|לחשב|מה\s+ה?זכויות|מה\s+אפשר\s+להוסיף|כמה\s+קומות|כמה\s+מטר)/;
  return compute.test(q) && personal.test(q);
}
