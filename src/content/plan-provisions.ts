// The plan's provisions, arranged in the seven chapters of the national plan-instructions format (Mavat).
// Each section shows the verbatim text from binyanit_plan_text when it is loaded, otherwise the working
// summary from plan-sections.ts, marked as such. Nothing here is computed; numbers stay in src/engine.

import type { PlanTextRow } from "@/lib/data";
import { PLAN } from "./plan-meta";
import { PLAN_SECTIONS } from "./plan-sections";

export type ProvisionStatus = "verbatim" | "official" | "working";

export interface ProvisionSection {
  id: string;
  ref: string | null;
  title: string;
  body: string[];
  status: ProvisionStatus;
  source: string;
}

export interface ProvisionChapter {
  no: number;
  title: string;
  lead: string;
  sections: ProvisionSection[];
  link?: { href: string; label: string };
}

export const CHAPTERS: Omit<ProvisionChapter, "sections">[] = [
  { no: 1, title: "זיהוי וסיווג התכנית", lead: "שם התכנית, מספרה, שטחה, סוגה והגוף המאשר." },
  { no: 2, title: "מטרת התכנית ועיקרי הוראותיה", lead: "למה נועדה התכנית ומה היא קובעת." },
  { no: 3, title: "טבלת יעודי קרקע ותאי שטח", lead: "יעודי הקרקע שהתכנית חלה עליהם." },
  { no: 4, title: "יעודי קרקע ושימושים", lead: "מסלולי ההתחדשות, תוספות הבנייה וההנחיות לפי סוג הרחוב.", link: { href: "/check", label: "בדיקת כתובת" } },
  { no: 5, title: "טבלת זכויות והוראות בנייה", lead: "תוספת קומות, מספר קומות מרבי ותכסית.", link: { href: "/check", label: "בדיקת כתובת" } },
  { no: 6, title: "הוראות נוספות", lead: "תנאים והוראות כלליות להיתר." },
  { no: 7, title: "ביצוע התכנית", lead: "חריגים, הוראות מעבר ושיקול דעת הוועדה.", link: { href: "/quarters", label: "מכסות ברובעים" } },
];

export const STATUS_LABEL: Record<ProvisionStatus, string> = {
  verbatim: "נוסח ההוראות",
  official: "מינהל התכנון",
  working: "נוסח עבודה",
};

/** Chapter number from a section reference: "4.1.2" → 4, "טבלה 5" → 5, "7.2.1, 6.1.3" → 7.
 *  Special guidelines marked on the map (תשריט) belong to land uses, chapter 4. */
export function chapterOf(ref: string | null | undefined): number | null {
  if (!ref) return null;
  if (ref.includes("מבוא")) return 2;
  const m = ref.match(/^טבלה\s*([1-7])\b/) ?? ref.match(/^([1-7])(?:\.|$)/) ?? ref.match(/(?:^|\D)([1-7])\.\d/);
  if (m) return Number(m[1]);
  return ref.includes("תשריט") ? 4 : null;
}

function identification(): ProvisionSection[] {
  return [
    {
      id: "ident",
      ref: "1",
      title: "שם התכנית ומספרה",
      body: [
        `${PLAN.officialName}.`,
        `מספר התכנית: ${PLAN.number}. שטח התכנית: ${PLAN.areaDunam.toLocaleString("he-IL")} דונם.`,
        `מוסד התכנון המוסמך: ${PLAN.authority}.`,
        `סטטוס: ${PLAN.status}. ${PLAN.approvalNote} תוקף עד ${PLAN.validUntil}.`,
      ],
      status: "official",
      source: PLAN.dataSource,
    },
  ];
}

/** Groups verbatim rows into sections: each heading opens a section, the rows after it are its body. */
export function sectionsFromRows(rows: PlanTextRow[]): Map<number, ProvisionSection[]> {
  const out = new Map<number, ProvisionSection[]>();
  let cur: (ProvisionSection & { ch: number }) | null = null;
  let lastCh: number | null = null;
  let lastSource = "";
  const flush = () => {
    if (cur && cur.body.length + cur.title.length > 0) {
      const { ch, ...s } = cur;
      out.set(ch, [...(out.get(ch) ?? []), s]);
    }
    cur = null;
  };
  for (const r of rows) {
    if (r.source !== lastSource) {
      flush();
      lastCh = null;
      lastSource = r.source;
    }
    const official = !/הוראות/.test(r.source);
    const fromSource = r.source.includes("מטרות") ? 2 : null;
    const ch: number | null = chapterOf(r.section) ?? lastCh ?? fromSource;
    if (r.kind === "heading" || (cur === null && ch !== null)) {
      flush();
      if (ch === null) continue;
      lastCh = ch;
      const isHead = r.kind === "heading";
      cur = {
        ch,
        id: `r${r.id}`,
        ref: r.section,
        title: (isHead ? (r.title ? `${r.title} ${r.body}` : r.body) : r.title ?? "").trim(),
        body: isHead ? [] : [r.body],
        status: official ? "official" : "verbatim",
        source: r.page != null ? `${r.source}, עמ׳ ${r.page}` : r.source,
      };
    } else if (cur) {
      (cur as ProvisionSection).body.push(r.body);
    }
  }
  flush();
  return out;
}

/** Builds the seven chapters. Verbatim text replaces the working summary chapter by chapter. */
export function buildProvisions(rows: PlanTextRow[]): ProvisionChapter[] {
  const verbatim = sectionsFromRows(rows);
  const working = new Map<number, ProvisionSection[]>();
  for (const s of PLAN_SECTIONS) {
    const ch = chapterOf(s.section);
    if (ch === null) continue;
    working.set(ch, [
      ...(working.get(ch) ?? []),
      { id: s.id, ref: s.section === "מבוא" ? null : s.section, title: s.title, body: [s.text], status: "working", source: "תקציר הכללים" },
    ]);
  }
  return CHAPTERS.map((c) => {
    const v = verbatim.get(c.no) ?? [];
    const hasBinding = v.some((s) => s.status === "verbatim");
    const base = c.no === 1 ? identification() : [];
    const sections = [...base, ...v, ...(hasBinding ? [] : working.get(c.no) ?? [])];
    return { ...c, sections };
  });
}
