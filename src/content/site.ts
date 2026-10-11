import { PLAN } from "./plan-meta";

/** One source for page names: the nav, the page headers, the flow strip and every button use these labels. */
export interface SitePage {
  href: string;
  label: string;
  /** What the visitor gets on the page, in one line. */
  blurb: string;
}
export interface SiteGroup {
  id: string;
  label: string;
  pages: SitePage[];
}

export const HOME: SitePage = { href: "/", label: "ראשי", blurb: "שלושת המסלולים ומפת האתר" };

export const PAGE = {
  story: { href: `/plan/${PLAN.number}`, label: "התכנית בקצרה", blurb: "מה התכנית קובעת, במילים פשוטות" },
  provisions: { href: "/provisions", label: "הוראות התכנית", blurb: "הנוסח בשבעה פרקים, עם חיפוש בתוך התכנית" },
  qa: { href: "/qa", label: "שאלות על התכנית", blurb: "תשובות מוכנות, עם הפניה לסעיפים" },
  check: { href: "/check", label: "בדיקת כתובת", blurb: "פוטנציאל תכנוני ראשוני לבניין מסוים" },
  sheet: { href: "/sheet", label: "מפת התשריט", blurb: "אילו שכבות של התכנית חלות בכל מקום" },
  traffic: { href: "/traffic", label: "רחובות ותנועה", blurb: "סיווג הרחובות שקובע את תוספת הקומות" },
  program: { href: "/program", label: "צורכי ציבור", blurb: "כושר נשיאה, חינוך וקהילה בכל רובע" },
  quarters: { href: "/quarters", label: "מכסות ברובעים", blurb: "סף יחידות הדיור בכל רובע ומימושו" },
  documents: { href: "/documents", label: "מסמכים", blurb: "כל מסמכי התכנית, לפי מעמדם" },
} satisfies Record<string, SitePage>;

/** Logical order of the visitor's path: understand the plan, check a building, read the maps, see the quarters, go to the sources. */
export const GROUPS: SiteGroup[] = [
  { id: "plan", label: "התכנית", pages: [PAGE.story, PAGE.provisions, PAGE.qa] },
  { id: "building", label: "הבניין שלי", pages: [PAGE.check] },
  { id: "maps", label: "מפות", pages: [PAGE.sheet, PAGE.traffic] },
  { id: "quarters", label: "רובעים", pages: [PAGE.program, PAGE.quarters] },
  { id: "sources", label: "מקורות", pages: [PAGE.documents] },
];

export const FLOW: SitePage[] = [HOME, ...GROUPS.flatMap((g) => g.pages)];

/** The page a path belongs to (a quarter page belongs to "צורכי ציבור"). */
export function pageOf(path: string): SitePage | undefined {
  if (path === "/") return HOME;
  return FLOW.find((p) => p.href !== "/" && (path === p.href || path.startsWith(p.href + "/") || (p.href.startsWith("/plan/") && path.startsWith("/plan"))));
}

export function groupOf(href: string): SiteGroup | undefined {
  return GROUPS.find((g) => g.pages.some((p) => p.href === href));
}
