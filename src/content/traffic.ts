// Traffic and connectivity appendix of plan 603-0972307, as layers extracted from the signed PDF.
// Layer names follow the site's terms (STREET_CLASS_LABEL); the sheet's own wording is kept in `sheet`.
// Data: public/data/traffic (scripts/traffic/extract.py + split.mjs). Sheet coordinates, not EPSG:2039.

export const TRAFFIC_DOC = {
  title: "נספח תנועה וקישוריות",
  file: "603-0972307_תנועה_נספח קישוריות - חתום לאישור.pdf",
  editor: "קראוס-חן הנדסת תנועה",
  date: "10.7.2025",
  scale: "1:5000",
  status: "חתום לאישור",
  viewBox: [0, 0, 3488, 2239] as const,
  // 1 pt on a 1:5000 sheet = 0.0254 / 72 * 5000 m
  metersPerUnit: (0.0254 / 72) * 5000,
  // The sheet is not drawn north-up; angle of the north arrow on the sheet, degrees clockwise.
  northRotation: 56.5,
  // Approval stamp of the Southern District Committee on the sheet. Its decision-date field shows
  // 01/01/1901, a default value, so the stamp is not treated as a decision date.
  stamp: "חותמת הוועדה המחוזית דרום, חתומה 26.8.2026",
};

export type TrafficLayerId =
  | "active"
  | "mtan_existing"
  | "mtan_proposed"
  | "arterial"
  | "local_existing"
  | "local_proposed"
  | "renewal"
  | "boundary"
  | "excluded"
  | "cadastre"
  | "cadastre_light"
  | "lbl_block"
  | "lbl_parcel";

export type LayerStatus = "קיים" | "מוצע" | "מנחה" | "לבירור";

export type Swatch = "solid" | "dash" | "hatch" | "zig" | "block" | "thin" | "text";

export interface TrafficLayer {
  id: TrafficLayerId;
  group: TrafficGroupId;
  name: string;
  sheet?: string; // wording on the sheet legend, when it differs from the site's term
  sub?: string;
  fill: string | null;
  stroke: string | null;
  swatch: Swatch;
  sample?: string;
  status?: LayerStatus;
  defaultOn: boolean;
}

export type TrafficGroupId = "rights" | "network" | "areas" | "base";

export const TRAFFIC_GROUPS: { id: TrafficGroupId; title: string; note?: string }[] = [
  { id: "rights", title: "סיווג שמשפיע על הזכויות", note: "טבלה 5, 4.1.2" },
  { id: "network", title: "רשת הרחובות" },
  { id: "areas", title: "אזורים" },
  { id: "base", title: "גבולות ורקע" },
];

export const TRAFFIC_LAYERS: TrafficLayer[] = [
  { id: "active", status: "מוצע", group: "rights", name: "רחוב עם חזית פעילה", sheet: "רחוב פעיל", sub: "עירוב שימושים", fill: "#8a00b8", stroke: "#8a00b8", swatch: "dash", defaultOn: true },
  { id: "mtan_existing", status: "קיים", group: "rights", name: "ציר הסעת המונים קיים", sheet: 'ציר מתע"ן', sub: "לפי התכנית הכוללנית", fill: "#00b8b8", stroke: null, swatch: "solid", defaultOn: true },
  { id: "mtan_proposed", status: "מוצע", group: "rights", name: "ציר הסעת המונים מוצע", sheet: 'ציר מתע"ן', sub: "לפי התכנית הכוללנית", fill: "#00a8a8", stroke: "#00a8a8", swatch: "zig", defaultOn: true },
  { id: "arterial", status: "קיים", group: "network", name: "דרך עורקית או רחוב מאסף", sub: "כולל כיכרות", fill: "#e60000", stroke: null, swatch: "solid", defaultOn: true },
  { id: "local_existing", status: "קיים", group: "network", name: "רחוב מקומי קיים", fill: "#17b817", stroke: "#17b817", swatch: "solid", defaultOn: true },
  { id: "local_proposed", status: "מוצע", group: "network", name: "רחוב מקומי מוצע", sub: "קישוריות חדשה", fill: "#e000e0", stroke: "#e000e0", swatch: "zig", defaultOn: true },
  { id: "renewal", status: "מנחה", group: "areas", name: "אזור לאיתור מתחמי התחדשות עירונית", fill: null, stroke: "#f08000", swatch: "hatch", defaultOn: true },
  { id: "excluded", status: "לבירור", group: "areas", name: "שטח מסומן באפור", sub: "אין לו פריט במקרא הגיליון", fill: "#7a7b7d", stroke: null, swatch: "block", defaultOn: true },
  { id: "boundary", group: "base", name: "גבול התכנית", fill: "#006edd", stroke: null, swatch: "solid", defaultOn: true },
  { id: "cadastre", group: "base", name: "חלקות, מגרשים ומבנים", sub: "רקע קדסטרי", fill: "#2a302d", stroke: "#2a302d", swatch: "thin", defaultOn: true },
  { id: "cadastre_light", group: "base", name: "קווי רקע משניים", fill: null, stroke: "#9aa49e", swatch: "thin", defaultOn: true },
  { id: "lbl_block", group: "base", name: "מספרי גושים", sub: "מוצגים בהגדלה", fill: null, stroke: null, swatch: "text", sample: "2018", defaultOn: true },
  { id: "lbl_parcel", group: "base", name: "מספרי חלקות", sub: "מוצגים בהגדלה גבוהה", fill: null, stroke: null, swatch: "text", sample: "43", defaultOn: false },
];

// Bottom to top.
export const TRAFFIC_ORDER: TrafficLayerId[] = [
  "excluded", "cadastre_light", "cadastre", "renewal", "local_existing", "local_proposed",
  "mtan_existing", "mtan_proposed", "arterial", "active", "boundary", "lbl_block", "lbl_parcel",
];

// Page copy. Facts from the sheet are marked as such; interpretations are marked as assessments.
export const TRAFFIC_COPY = {
  kicker: `${TRAFFIC_DOC.title} · תכנית 603-0972307`,
  title: "איזה רחוב, כמה קומות",
  deck: "סוג הרחוב שהבניין פונה אליו משנה את הזכויות. ברחוב עם חזית פעילה ובציר הסעת המונים מותרות יותר קומות ותכסית גדולה יותר. המפה מציגה את רשת הרחובות כפי שהיא מסומנת בנספח התנועה של התכנית.",
  read: [
    {
      title: "מה משנה את הזכויות",
      text: "רחוב עם חזית פעילה וציר הסעת המונים. בהריסה ובנייה מחדש מוסיפים בהם קומה אחת יותר מברחוב כלל עירוני, והתכסית עולה מ-60% ל-70%. בחיזוק ומיגון, קומת קרקע עם שימושים פעילים ברחוב כזה מזכה בקומה נוספת. על ציר הסעת המונים יש פטור מהקצאה לציבור.",
      sources: "טבלה 5, 4.1.2",
    },
    {
      title: "מה מוסיף הקשר",
      text: "דרכים עורקיות, רחובות מאספים ורחובות מקומיים מראים איך הרובע מחובר. רחוב מקומי מוצע הוא קישור חדש שהנספח מציע. בבדיקת הכתובת באתר, רחוב שאינו פעיל ואינו ציר הסעת המונים מחושב כרחוב כלל עירוני.",
      sources: "נספח התנועה",
    },
    {
      title: "מה עוד מסומן",
      text: "קו כתום מקווקו תוחם אזורים לאיתור מתחמים להתחדשות עירונית. ייתכן שאלה האזורים שבתשריט מסומנים כהנחיות מיוחדות ב׳ (הערכה, לא אומתה). שטחים מסומנים באפור בגיליון בלי פריט במקרא, ולכן משמעותם לא מוצגת כאן עד בירור מול עורך הנספח.",
      sources: "מקרא הגיליון",
    },
  ],
  limits: [
    "המפה מוצגת בקואורדינטות הגיליון ואינה מקושרת לרשת ישראל החדשה. אי אפשר לאתר בה כתובת, ואין להסתמך עליה למדידה.",
    "השכבות חולצו אוטומטית מקובץ ה-PDF הווקטורי לפי צבעי המקרא. ייתכנו קטעים חסרים או שגויים.",
    "בדרך כלל נספח תנועה הוא מסמך מנחה. סיווג הרחוב לצורך הזכויות נקבע בתשריט ובהוראות, ומעמד הנספח בתכנית הזו לא אומת באתר.",
    "בגיליון חותמת אישור של הוועדה המחוזית, אבל שדה תאריך ההחלטה בה לא מולא. לא אומת שזו הגרסה הסופית שפורסמה.",
    "שמות הרחובות שבגיליון אינם ניתנים לחילוץ, כי הגופן העברי בקובץ ממופה שגוי. לכן אין חיפוש לפי שם רחוב.",
    'ציר הסעת המונים קיים ומוצע מצוירים באותו צבע. ההפרדה ביניהם נעשתה לפי צורת השרטוט (רצועה רציפה מול ריבועים וזיגזג), וטעונה אימות מול הגיליון.',
  ],
  next: "בשלב הבא המפה תקושר לרשת ישראל החדשה לפי מספרי הגושים שבגיליון. אז בדיקת הכתובת תוכל לזהות לבד אם הבניין פונה לרחוב עם חזית פעילה או לציר הסעת המונים.",
};
