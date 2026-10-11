import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/PageHead";
import { Prose } from "@/components/Prose";
import { Reveal } from "@/components/Reveal";
import { PAGE } from "@/content/site";
import { PLAN } from "@/content/plan-meta";
import { STORY } from "@/content/plan-story";
import { DISCLAIMER } from "@/engine/config";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ number: PLAN.number }];
}

export const metadata: Metadata = {
  title: `תכנית ${PLAN.number} במילים פשוטות | התחדשות בניינית אשדוד`,
  description: STORY.deck,
};

const CERTAINTY = { plan: "לפי התכנית", report: "לפי דיווח" } as const;

export default async function PlanPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (number !== PLAN.number) notFound();
  return (
    <article className="wrap section story">
      <PageHead href={PAGE.story.href} kicker={STORY.kicker} title={STORY.title} lead={STORY.deck}>
        <div className="state info" style={{ maxWidth: 760 }}>
          <b>{STORY.status.label}</b>
          <Prose text={STORY.status.text} />
          <div className="cite" style={{ marginTop: 6, whiteSpace: "normal" }}>מקור: {STORY.status.source}</div>
        </div>
      </PageHead>

      <div className="story-grid">
        <nav className="story-toc" aria-label="פרקים">
          <div className="label" style={{ marginBottom: 8 }}>פרקים</div>
          <ol>
            {STORY.chapters.map((c, i) => (
              <li key={c.id}><a href={`#${c.id}`}><span className="num">{i + 1}</span>{c.title}</a></li>
            ))}
          </ol>
          <div className="row-gap" style={{ marginTop: 16 }}>
            <Link href={PAGE.provisions.href} className="btn small ghost">{PAGE.provisions.label}</Link>
            <Link href={PAGE.check.href} className="btn small">{PAGE.check.label}</Link>
          </div>
        </nav>

        <div className="story-body">
          {STORY.chapters.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 3) * 0.04}>
              <section id={c.id} className="card raised stack chapter" aria-labelledby={`${c.id}-t`}>
                <div className="label">פרק {i + 1}</div>
                <h2 id={`${c.id}-t`} className="h2">{c.title}</h2>
                <Prose className="chapter-lead" text={c.lead} />
                {c.paragraphs.map((p, j) => <Prose key={j} text={p} />)}
                {c.table && (
                  <div className="table-wrap">
                    <table className="table rules" data-testid={`table-${c.id}`}>
                      <thead>
                        <tr>{c.table.head.map((h, k) => <th key={k} scope="col">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {c.table.rows.map(([k, ...cells]) => (
                          <tr key={k}>
                            <th scope="row">{k}</th>
                            {cells.map((v, m) => <td key={m}>{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {c.table.note && <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>{c.table.note}</p>}
                  </div>
                )}
                {c.facts && (
                  <div className="facts-row">
                    {c.facts.map((f) => (
                      <div key={f.label} className="fact">
                        <div className="fact-v num">{f.value}</div>
                        <div className="fact-u">{f.unit}</div>
                        <div className="muted" style={{ fontSize: 14 }}>{f.label}</div>
                        <span className={`chip ${f.certainty === "plan" ? "ok" : "warn"}`}>{CERTAINTY[f.certainty]}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="cite" style={{ whiteSpace: "normal" }}>מקורות: {c.sources.join(" · ")}</div>
              </section>
            </Reveal>
          ))}
          <p className="disclaimer">{DISCLAIMER}</p>
        </div>
      </div>
    </article>
  );
}
