# נספח התנועה באתר: אפיון ותכנית עבודה

מקור: "נספח תנועה 603-0972307 למפה חיה – אפיון ותכנית עבודה" (ענת, 11.10.2026), מותאם למבנה האתר.
נספח: `603-0972307_תנועה_נספח קישוריות - חתום לאישור.pdf`, קראוס-חן הנדסת תנועה, 10.7.2025, 1:5000.

## הבעיה

הנספח עצמו אינו המטרה. המטרה היא לחבר אותו לזכויות: סוג הרחוב קובע תוספת קומות ותכסית (טבלה 5, 4.1.2). רחובות עם חזית פעילה וצירי הסעת המונים מסומנים בנספח כשכבות נפרדות, ולכן הנספח הוא מקור אפשרי לשכבת `street_class` שבדיקת הכתובת צריכה.

במצגת לפורום התכנון: ברחבי העיר 3 קומות במסלול חיזוק ומיגון, ברחוב פעיל ובציר מתע"ן 4. במנוע (`src/engine/config.ts`): 2 קומות מלאות וקומת גג חלקית, ועוד קומה ברחוב פעיל או בציר כשקומת הקרקע משמשת לשימושים פעילים. נראה שזו אותה ספירה כשקומת הגג נספרת כקומה; לאמת מול ההוראות לפני כל שינוי במנוע.

## מה קיים באתר

- `/traffic`: מפת הגיליון בשכבות, בשמות האתר (`src/content/traffic.ts`), עם מצב לכל שכבה, איתור גוש ומגבלות.
- `/check`: כשסיווג הרחוב לא נמצא בשכבות, בוחרים ידנית, עם קישור למפה.
- צינור קיים לשכבת רחובות: `scripts/import-kml.mjs <file> street_class --class=activeFrontage` כותב ל-`binyanit_layers`, ו-`binyanit_lookup` מחזיר `street_class` לפי מרחק (ברירת מחדל 35 מ', או `props.buffer_m`).

לכן אין צורך באפליקציה נפרדת: מספיק להפיק GeoJSON ממוקם ולטעון אותו לצינור הקיים.

## שכבות

הזיהוי לפי הצבע המדויק בקובץ. ציר מתע"ן קיים ומוצע באותו צבע; ההפרדה לפי צורה (רצועה רציפה מול ריבועים וזיגזג).

| מזהה | שם באתר | נוסח הגיליון | RGB | קטעים | גאומטריה | מצב | יעד באתר |
| --- | --- | --- | --- | --- | --- | --- | --- |
| active | רחוב עם חזית פעילה | רחוב פעיל | 138,0,184 | 5,888 | קו | מוצע | `street_class` / activeFrontage |
| mtan_existing | ציר הסעת המונים קיים | ציר מתע"ן קיים לפי כוללנית | 0,255,255 | 6 | קו | קיים | `street_class` / massTransit |
| mtan_proposed | ציר הסעת המונים מוצע | ציר מתע"ן מוצע לפי כוללנית | 0,255,255 | 926 | קו | מוצע | `street_class` / massTransit (לאמת) |
| arterial | דרך עורקית או רחוב מאסף | דרך עורקית / רחוב מאסף (כולל כיכרות) | 255,0,0 | 119 | קו | קיים | תצוגה |
| local_existing | רחוב מקומי קיים | | 0,255,0 | 730 | קו | קיים | תצוגה |
| local_proposed | רחוב מקומי מוצע | | 255,0,255 | 2,133 | קו | מוצע | תצוגה |
| renewal | אזור לאיתור מתחמי התחדשות עירונית | אזורים לאיתור מתחמים להתחדשות עירונית | 255,128,0 | 955 | פוליגון | מנחה | אולי `urban_renewal_search_zone` (לאמת) |
| boundary | גבול התכנית | | 0,110,222 | 86 | פוליגון | | השוואה ל-`plan_boundary` מ-Xplan |
| excluded | שטח מסומן באפור | ללא פריט במקרא | רסטר | 5 אזורים | פוליגון | לבירור | אין |
| cadastre | חלקות, מגרשים ומבנים | | שחור | 35,886 | קו | רקע | ייחוס גאוגרפי |
| labels | מספרי גושים / חלקות | | טקסט | 88 / 6,675 | נקודה | רקע | נקודות בקרה |

מספר הקטעים הוא מספר קטעי שרטוט ב-PDF, לא מספר רחובות.

## חלופות

| חלופה | יתרון | חיסרון | מתי |
| --- | --- | --- | --- |
| א. מפת גיליון (קיימת ב-/traffic) | מוכנה, נאמנה לנספח החתום | אין מיקום אמיתי | עיון והכוונה |
| ב. חילוץ + ייחוס גאוגרפי | עצמאית, משתמשת בנתונים הקיימים | דיוק 1:5000, רחובות מפוצלים לקטעים | אם קובץ המקור מתעכב |
| ג. קובץ מקור מהיועץ (DWG/SHP) | דיוק מלא, שמות רחובות | תלוי ביועץ | לכל שימוש שנוגע בזכויות |

המלצה: לבקש את קובץ המקור, ובמקביל להריץ את ב'. לחישוב זכויות בבדיקת הכתובת רק ג' או שכבת התשריט מ-Xplan; ב' מסומנת באתר כהכוונה.

## ייחוס גאוגרפי (חלופה ב')

1. שכבת גושים של אשדוד ב-EPSG:2039 (GovMap או המרכז למיפוי ישראל).
2. התאמת 88 תוויות הגוש בגיליון (`public/data/traffic/labels.json`, גודל 2.8) למרכזי הגושים.
3. טרנספורמציה אפינית בריבועים פחותים, השמטת חריגים (שארית מעל פי 3 מהחציון), התאמה חוזרת.
4. יעד: RMSE עד 3 מ'. עצירה אם פחות מ-12 גושים הותאמו. קו בעובי 0.72 נקודות הוא כ-1.3 מ' בשטח.
5. בדיקה חזותית: קדסטר הגיליון מעל החלקות הרשמיות. סטייה שיטתית בפינה: פולינום מסדר 1 או 2.
6. חלופה ידנית: 8 עד 12 נקודות בקרה בצמתים ב-QGIS Georeferencer.

## מודל נתונים

GeoJSON ב-WGS84 לכל שכבה, ובטעינה ל-`binyanit_layers` עם `props`:

| שדה | דוגמה |
| --- | --- |
| class | activeFrontage (רק ל-`street_class`) |
| layer_id | active |
| layer_name | רחוב פעיל |
| status | מוצע |
| street_name | מצירוף לשכבת הרחובות העירונית, הקרוב בטווח 15 מ' |
| source | נספח תנועה, קראוס-חן |
| source_date | 2025-07-10 |
| geo_method | gush-affine |
| rmse_m | 2.1 |
| buffer_m | 35 |

קטעים סמוכים של אותו רחוב מאוחדים לקו אחד (linemerge), כדי שלחיצה תחזיר רחוב.

שינוי נדרש ב-/check כשהמקור הוא הנספח: התגית "מהתשריט" צריכה להפוך ל"מנספח התנועה" לפי `props.source`, כדי לא להציג הכוונה כנתון סטטוטורי.

## פתוח לבירור

- מעמד הנספח (מנחה או מחייב), והיחס לסימון הרחובות בתשריט. זו השאלה הקובעת.
- השטחים באפור: לברר עם קראוס-חן (תכניות מאושרות אחרות? מחוץ לתחולה?).
- ציר מתע"ן מוצע: האם מזכה כבר עכשיו בזכויות של ציר הסעת המונים.
- כיכרות נשארו בשכבת הדרכים העורקיות.
- שמות רחובות: הגופן ממופה שגוי, השמות יגיעו מצירוף לשכבה עירונית.
- חותמת הוועדה המחוזית חתומה 26.8.2026, שדה תאריך ההחלטה 01/01/1901 (ברירת מחדל). לאמת שזו הגרסה הסופית.

## צעדים

- [ ] לבקש מקראוס-חן את קובץ המקור ואת משמעות השטחים באפור
- [ ] לברר את מעמד הנספח מול הוראות התכנית
- [ ] להוריד גושים, חלקות ורחובות של אשדוד ב-EPSG:2039
- [ ] להריץ ייחוס ולבדוק מול יעד 3 מ'
- [ ] לטעון את active ו-mtan כ-`street_class` עם `props.source`, ולעדכן את התגית ב-/check
- [ ] להוסיף ל-/traffic מפת MapLibre ממוקמת לצד מפת הגיליון

## פרומפט ביצוע ל-Claude Code

להריץ בריפו Binyanit-GH, אחרי שהקבצים gush.geojson, parcels.geojson ו-streets.geojson (EPSG:2039) נוספו ל-`data/georef/` (לא ל-public).

```text
Run first: uipro init --ai claude

Read CLAUDE.md and docs/TRAFFIC_SPEC.md. Distill the task, map the data flow, then build in this order.

1. scripts/traffic/georef.py
   - Match gush labels (size 2.8) in public/data/traffic/labels.json to gush centroids in data/georef/gush.geojson.
   - Least-squares affine sheet -> EPSG:2039; drop residuals > 3x median; refit.
   - Write scripts/traffic/georef.json (6 params, RMSE m, residual per gush). Stop and report if RMSE > 3 m
     or fewer than 12 matched gushes.

2. scripts/traffic/to_geojson.py
   - Parse public/data/traffic/layers.json paths (relative m/l/c/z), flatten curves, apply the transform, reproject to WGS84.
   - Stroke -> LineString, fill -> Polygon; linemerge segments per layer.
   - Properties per docs/TRAFFIC_SPEC.md (data model). street_name: nearest street in streets.geojson within 15 m.
   - Output public/data/traffic/geo/<layer>.geojson. Vectorize excluded.png with the same transform.

3. Load into Supabase via the existing pipeline:
   node scripts/import-kml.mjs public/data/traffic/geo/active.geojson street_class --class=activeFrontage
   node scripts/import-kml.mjs public/data/traffic/geo/mtan_existing.geojson street_class --class=massTransit
   (mtan_proposed only after the open question in the spec is resolved). Send each SQL statement on one line.

4. /check: when the street_class hit has props.source of the traffic appendix, show the chip
   "מנספח התנועה" instead of "מהתשריט". Add a test.

5. /traffic: add a MapLibre view (same basemap and fallback as /program) with the georeferenced layers,
   toggle to the sheet view, click a street for name, class, status, source and date. Hebrew, RTL, no icons,
   clear loading / empty / outside-plan states.

6. npm test, npx next build && npx playwright test (desktop and mobile). Commit, push, deploy per CLAUDE.md.
```
