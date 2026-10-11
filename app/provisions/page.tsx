import type { Metadata } from "next";
import Link from "next/link";
import { PLAN } from "@/content/plan-meta";
import { buildProvisions } from "@/content/plan-provisions";
import { DISCLAIMER } from "@/engine/config";
import { getPlanText } from "@/lib/data";
import ProvisionsClient from "./ProvisionsClient";
import { PageHead } from "@/components/PageHead";
import { Prose } from "@/components/Prose";
import { PAGE } from "@/content/site";

export const metadata: Metadata = {
  title: `הוראות תכנית ${PLAN.number} | התחדשות בניינית אשדוד`,
  description: "הוראות התכנית בשבעה פרקים, עם חיפוש בתוך התכנית והפניה לסעיפים.",
};
export const revalidate = 300;

export default async function Page() {
  const { data, error } = await getPlanText();
  const chapters = buildProvisions(data);
  const hasVerbatim = chapters.some((c) => c.sections.some((s) => s.status === "verbatim"));
  return (
    <article className="wrap section provisions">
      <PageHead
        href={PAGE.provisions.href}
        kicker={<>תכנית מס׳ <span className="num">{PLAN.number}</span> · אשדוד</>}
        title={PLAN.officialName.replace(/, אשדוד$/, "")}
        lead="הוראות התכנית בשבעה פרקים. אפשר לחפש מילה או מספר סעיף, או לפתוח פרק ואז סעיף."
      >
        <div className="state info" style={{ maxWidth: 760 }}>
          <b>מה מחייב</b>
          <Prose text={`${PLAN.number} · ${PLAN.status}. ${PLAN.approvalNote}`} />
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
      </PageHead>

      <ProvisionsClient chapters={chapters} />

      <div className="row-gap" style={{ marginTop: 24 }}>
        <Link href={PAGE.qa.href} className="btn small">{PAGE.qa.label}</Link>
        <Link href={PAGE.story.href} className="btn ghost small">{PAGE.story.label}</Link>
      </div>
      <p className="disclaimer">{DISCLAIMER}</p>
    </article>
  );
}
