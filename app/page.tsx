import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { PLAN } from "@/content/plan-meta";
import { DISCLAIMER } from "@/engine/config";

const ROUTES = [
  {
    title: "מיגון בלבד",
    m2: '13 מ"ר ליח"ד',
    body: "תוספת מרחב מוגן לכל דירה, קומה מלאה אחת וקומת גג חלקית.",
  },
  {
    title: "חיזוק ומיגון",
    m2: '25 מ"ר ליח"ד',
    body: "חיזוק המבנה מפני רעידות אדמה, שתי קומות מלאות וקומת גג חלקית, ותוספות לפי מצב הבניין והרחוב.",
  },
  {
    title: "הריסה ובנייה מחדש",
    m2: '35 מ"ר ליח"ד',
    body: "בניין חדש בקומה טיפוסית מורחבת, עם תוספת קומות לפי סיווג הרחוב ומספר הקומות הקיים (טבלה 5).",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <Reveal>
            <div className="stack">
              <div className="label">תכנית {PLAN.number} · {PLAN.replaces}</div>
              <h1 className="display">התחדשות בניינית באשדוד</h1>
              <p className="lead">
                התכנית מאפשרת לחדש בניין בודד בשלושה מסלולים. כאן אפשר לבדוק מה הפוטנציאל התכנוני הראשוני של בניין
                מסוים, לקרוא את מסמכי התכנית ולשאול שאלות על ההוראות.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
                <Link href="/check" className="btn">בדיקת כתובת</Link>
                <Link href="/qa" className="btn ghost">שאלה על התכנית</Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="facts" aria-label="נתוני התכנית">
              <div>
                <div className="label">מספר תכנית</div>
                <div className="v num">{PLAN.number}</div>
              </div>
              <div>
                <div className="label">סטטוס</div>
                <div className="v">{PLAN.status}</div>
              </div>
              <div>
                <div className="label">מועד אישור</div>
                <div className="v">{PLAN.approvalDate ?? "2026"}</div>
                <small className="muted">{PLAN.approvalDate ? "" : "תאריך הפרסום ברשומות יוזן לאחר אימות"}</small>
              </div>
              <div>
                <div className="label">תוקף</div>
                <div className="v">{PLAN.validityYears} שנים</div>
                <small className="muted">מיום תחילת התוקף</small>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack">
          <div className="label">שלושה מסלולים</div>
          <h2 className="h2">מה התכנית מאפשרת</h2>
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            {ROUTES.map((r, i) => (
              <Reveal key={r.title} delay={0.05 * i}>
                <article className="card raised stack" style={{ height: "100%" }}>
                  <div className="label">מסלול {i + 1}</div>
                  <h3 className="h3">{r.title}</h3>
                  <div className="big">{r.m2}</div>
                  <p className="muted" style={{ margin: 0 }}>{r.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid grid-2">
          <div className="card stack">
            <div className="label">איך זה עובד</div>
            <ol style={{ margin: 0, paddingInlineStart: 20 }}>
              <li>מאתרים את הכתובת על המפה.</li>
              <li>המערכת בודקת את סיווג הרחוב והאזורים המיוחדים לפי התשריט.</li>
              <li>ממלאים את נתוני הבניין הקיים.</li>
              <li>מנוע הכללים מחשב את שלושת המסלולים, עם הפניה לסעיפים.</li>
              <li>מורידים קובץ פוטנציאל.</li>
            </ol>
          </div>
          <div className="card stack">
            <div className="label">חשוב לדעת</div>
            <p className="disclaimer" style={{ margin: 0 }}>{DISCLAIMER}</p>
            <p className="muted" style={{ margin: 0 }}>
              המספרים מחושבים במנוע כללים קבוע ובדוק. הבינה המלאכותית באתר רק מסבירה את התוצאה ועונה על שאלות מתוך
              הוראות התכנית, ואינה מחשבת זכויות.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
