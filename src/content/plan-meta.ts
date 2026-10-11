export const PLAN = {
  number: "603-0972307",
  name: "תכנית התחדשות בניינית – אשדוד",
  nameEn: "Building Renewal Plan 603-0972307 – Ashdod",
  authority: "הוועדה המחוזית לתכנון ולבנייה מחוז דרום",
  status: "אושרה למתן תוקף",
  // Exact date of publication for validity is not loaded yet. Fill it from Reshumot when available.
  approvalDate: null as string | null,
  approvalNote: "אושרה למתן תוקף בוועדה המחוזית דרום בשנת 2026. תאריך הפרסום ברשומות יוזן לאחר אימות.",
  validityYears: 5,
  replaces: 'חלופה עירונית לתמ"א 38',
  routes: ["מיגון בלבד", "חיזוק ומיגון", "הריסה ובנייה מחדש"],
};

export const QUARTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב", "יג", "טו", "יז"];

export const STREET_CLASS_LABEL = {
  cityWide: "רחוב כלל עירוני",
  activeFrontage: "רחוב עם חזית פעילה",
  massTransit: "ציר הסעת המונים",
} as const;
