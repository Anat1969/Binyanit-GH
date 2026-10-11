# שכבות מפת התשריט (/sheet)

מקור: גיליון נספח העזר הגרפי לתשריט, PDF (src.pdf, לא בריפו).

1. `python base.py` – רקע גושים וחלקות (base.png) ותמונת הגיליון המקורי (original.jpg). להמיר ל-public/sheet/base.webp ו-public/sheet/original.jpg.
2. `python svgpaths.py` – שכבות הצבע מוקטורי ה-PDF ל-layers_svg.json, בקואורדינטות הגיליון המסובב (2730×2384).
3. `python build.py` – מוסיף את פוליגון תחום התכנית (planArea) וכותב sheet-layers.json. להעתיק ל-public/data/.

תלויות: pymupdf, numpy, pillow, shapely. הצבעים מזוהים לפי ערכי RGB מדויקים ב-PDF; גיליון חדש עם צבעים אחרים ידרוש עדכון של FILL ו-HATCH.
