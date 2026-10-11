# התחדשות בניינית אשדוד – תכנית 603-0972307

אתר ציבורי בעברית (RTL) לבדיקת פוטנציאל תכנוני ראשוני לפי תכנית ההתחדשות הבניינית של אשדוד.
Next.js 15 (App Router) + Supabase (פרויקט משותף cultura-GH) + Vercel.

## עיקרון־על
- כל מספר מחושב רק ב-`src/engine` (מנוע כללים דטרמיניסטי עם בדיקות). ה-LLM רק מסביר ועונה מתוך הוראות התכנית, עם סעיפים.
- כל תוצאה מסומנת: פוטנציאל תכנוני ראשוני, לא זכויות מוקנות, כפוף לשיקול דעת הוועדה (7.2.1, 6.1.3).
- פרמטרים מספריים של התכנית: רק ב-`src/engine/config.ts`. שינוי כלל = שינוי config + בדיקה ב-`engine.test.ts`.

## מבנה
- `src/engine` – מנוע הכללים ובדיקות (טבלה 5, 4.1.2, הקצאה לציבור, חריגים, מכסות רובעים).
- `src/content/plan-sections.ts` – קורפוס הסוכן. כרגע נוסח עבודה מתוך תקציר הכללים; להחליף בנוסח המאושר.
- `src/content/plan-meta.ts` – פרטי התכנית. `approvalDate` ריק עד אימות ברשומות.
- `app/api/*` – geocode (Nominatim), lookup (PostGIS RPC), layers, qa, explain, checks, quarters, status.
- `scripts/import-kml.mjs` – המרת KML/GeoJSON מהתשריט ל-SQL עבור `binyanit_layers`.

## Supabase
- כל הטבלאות בקידומת `binyanit_` (פרויקט משותף). RLS פעיל: קריאה ציבורית למסמכים, שכבות ומכסות; הוספה אנונימית בלבד ל-address_checks ו-qa_logs; אין כתיבה אחרת דרך anon.
- פונקציות: `binyanit_lookup(lon, lat)`, `binyanit_layer_geojson(kind)`.
- מלכודת: כלי ה-SQL של Supabase MCP נתקע על שאילתות מרובות שורות. לשלוח כל פקודה בשורה אחת.
- הסביבה בענן לא מגיעה ל-supabase.co; נתונים דרך כלי ה-SQL.

## הנחות פרשנות במנוע (לאימות מול ההוראות)
- "35 מ"ר ליח"ד" בקומה המורחבת מחושב לפי יח"ד בקומה טיפוסית (יח"ד ÷ קומות).
- מבנה קטן: שטח קומה × מספר קומות ≤ 400 מ"ר.
- תכסית 60% ברחוב כלל עירוני, 70% ברחוב פעיל / ציר הסעת המונים.
- גובה משוער: 3.3 מ' לקומה (תצוגה בלבד).

## פריסה
- Vercel: פרויקט binyanit-ashdod (prj_LQx5xXAWXKLTDlzCD1JHMqbdFl0S), אזור icn1 (ליד Supabase בסיאול). כתובת: https://binyanit-ashdod.vercel.app
- קישור Git לפרויקט נכשל ב-500 מה-API, ולכן אין פריסה אוטומטית בדחיפה. פריסה: create_deployment עם gitSource {org: Anat1969, repo: Binyanit-GH, ref: הענף}.
- אימות חי: Vercel sandbox עם curl (הסביבה בענן לא מגיעה ל-vercel.app).

## בדיקות
- `npm test` – vitest (מנוע, אחזור, סיכום).
- `npx next build && npx playwright test` – כל הכפתורים, דסקטופ ונייד, עם מוקים ל-API.

## שלב 2
- משיכה אוטומטית של נתוני בניין.
- טעינת שכבות התשריט (גבול, סיווג רחובות, אזורים מיוחדים, קידוחים, רובעים).
- העלאת מסמכי התכנית לטבלה `binyanit_plan_documents`.
