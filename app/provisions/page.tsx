import type { Metadata } from "next";
import Link from "next/link";
import { PLAN } from "@/content/plan-meta";
import { buildProvisions } from "@/content/plan-provisions";
import { DISCLAIMER } from "@/engine/config";
import { getPlanText } from "@/lib/data";
import ProvisionsClient from "./ProvisionsClient";

export const metadata: Metadata = {
  title: `הוראות תכנית ${PLAN.number} | התחדשות בניינית אשדוד`,
  description: "הוראות התכנית בשבעה פרקים, עם הפניה לסעיפים.",
};
export const revalidate = 300;

export default async function Page() {
  const { data, error } = await getPlanText();
  const chapters = buildProvisions(data);
  const hasVerbatim = chapters.some((c) => c.sections.some((s) => s.status === "verbatim"));
  return (
    <article className="wrap section provisions">
      <header className="story-head stack">
        <div className="label">תכנית מס׳ {PLAN.number} · אשדוד</div>
        <h1 className="h2" style={{ fontWeight: 200 }}>{PLAN.officialName.replace(/, אשדוד$/, "")}</h1>
        <p className="lead" style={{ margin: 0 }}>
          הוראות התכנית בשבעה פרקים. לחיצה על פרק פותחת את הסעיפים שלו, ולחיצה על סעיף פותחת את פרטיו. פתיחת כותרת אחרת סוגרת את הקודמת.
        </p>
        <div className="state info" style={{ maxWidth: 760 }}>
          <b>הוראות התכנית</b>
          {PLAN.number} · {PLAN.status}. {PLAN.approvalNote}
          <div style={{ marginTop: 6 }}>
            המסמך המחייב הוא הוראות התכנית באתר{" "}
            <a href={PLAN.mavatUrl} target="_blank" rel="noopener noreferrer" className="src-link">תכנון זמין</a>.
            דברי ההסבר אינם חלק מהמסמכים הסטטוטוריים.
          </div>
        </div>
        {error && <div className="state bad" role="alert"><b>לא ניתן לטעון את נוסח ההוראות</b>מוצג נוסח העבודה. אפשר לרענן את הדף בעוד מספר דקות.</div>}
        {!error && !hasVerbatim && (
          <div className="state warn" data-testid="provisions-working">
            <b>נוסח ההוראות המלא טרם נטען</b>
            סעיפים המסומנים &quot;נוסח עבודה&quot; הם תקציר כללים, לא הנוסח המחייב. הם יוחלפו בנוסח ההוראות לאחר טעינתו.
          </div>
        )}
      </header>

      <ProvisionsClient chapters={chapters} />

      <div className="row-gap" style={{ marginTop: 24 }}>
        <Link href="/qa" className="btn ghost small">חיפוש בנוסח המלא</Link>
        <Link href={`/plan/${PLAN.number}`} className="btn ghost small">התכנית בקצרה</Link>
      </div>
      <p className="disclaimer">{DISCLAIMER}</p>
    </article>
  );
}
