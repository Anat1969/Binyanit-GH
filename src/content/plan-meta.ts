export const PLAN = {
  number: "603-0972307",
  name: "תכנית התחדשות בניינית – אשדוד",
  nameEn: "Building Renewal Plan 603-0972307 – Ashdod",
  authority: "הוועדה המחוזית לתכנון ולבנייה מחוז דרום",
  status: "אושרה למתן תוקף",
  officialName: "תכנית עירונית להתחדשות בניינים טעונים חיזוק ומיגון, אשדוד",
  // Source for dates and quantities: Planning Administration, Xplan service (record of plan 603-0972307).
  approvalDate: "31.5.2026" as string | null, // publication in Reshumot (pl_date_8)
  approvalHearing: "20.4.2026", // approval hearing (pl_date7)
  validUntil: "31.5.2031",
  approvalNote: "פורסמה למתן תוקף ברשומות ב-31.5.2026, לפי נתוני מינהל התכנון.",
  validityYears: 5,
  areaDunam: 11242,
  unitsAuthorised: 22565,
  unitsAdded: 13627,
  mavatUrl: "https://mavat.iplan.gov.il/SV4/1/6005137288/310",
  dataSource: "מינהל התכנון, שירות Xplan",
  replaces: 'חלופה עירונית לתמ"א 38',
  routes: ["מיגון בלבד", "חיזוק ומיגון", "הריסה ובנייה מחדש"],
};

export const QUARTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב", "יג", "טו", "יז"];

export const STREET_CLASS_LABEL = {
  cityWide: "רחוב כלל עירוני",
  activeFrontage: "רחוב עם חזית פעילה",
  massTransit: "ציר הסעת המונים",
} as const;
