import { PLAN_SECTIONS, type PlanSection } from "@/content/plan-sections";

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

interface Indexed {
  doc: PlanSection;
  tf: Map<string, number>;
  len: number;
}

function buildIndex(docs: PlanSection[]) {
  const items: Indexed[] = docs.map((doc) => {
    const toks = tokenize(`${doc.title} ${doc.title} ${doc.text} ${doc.section}`);
    const tf = new Map<string, number>();
    toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    return { doc, tf, len: toks.length };
  });
  const df = new Map<string, number>();
  items.forEach((it) => it.tf.forEach((_, t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const avg = items.reduce((s, i) => s + i.len, 0) / items.length;
  return { items, df, avg, n: items.length };
}

const INDEX = buildIndex(PLAN_SECTIONS);

export interface Hit {
  section: PlanSection;
  score: number;
}

export function retrieve(query: string, k = 4): Hit[] {
  const q = [...new Set(tokenize(query))];
  const { items, df, avg, n } = INDEX;
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
      return { section: it.doc, score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}

/** Questions asking the agent to compute rights for a specific building are refused and redirected to the engine. */
export function asksForComputation(q: string): boolean {
  const personal = /(שלי|שלנו|בבניין|לבניין|הבניין|בכתובת|ברחוב\s+\S+\s+\d+|\d+\s*(קומות|דירות|יח"?ד|מ"?ר))/;
  const compute = /(כמה|חשב|תחשב|לחשב|מה\s+ה?זכויות|מה\s+אפשר\s+להוסיף|כמה\s+קומות|כמה\s+מטר)/;
  return compute.test(q) && personal.test(q);
}
