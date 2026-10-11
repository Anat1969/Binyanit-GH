import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/Reveal";
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
      <header className="story-head stack">
        <div className="label">{STORY.kicker}</div>
        <h1 className="display">{STORY.title}</h1>
        <p className="lead" style={{ margin: 0 }}>{STORY.deck}</p>
        <div className="state info" style={{ maxWidth: 760 }}>
          <b>{STORY.status.label}</b>
          {STORY.status.text}
          <div className="cite" style={{ marginTop: 6, whiteSpace: "normal" }}>מקור: {STORY.status.source}</div>
        </div>
      </header>

      <div className="story-grid">
        <nav className="story-toc" aria-label="פרקים">
          <div className="label" style={{ marginBottom: 8 }}>פרקים</div>
          <ol>
            {STORY.chapters.map((c, i) => (
              <li key={c.id}><a href={`#${c.id}`}><span className="num">{i + 1}</span>{c.title}</a></li>
            ))}
          </ol>
          <Link href="/check" className="btn small" style={{ marginTop: 16 }}>בדיקת כתובת</Link>
        </nav>

        <div className="story-body">
          {STORY.chapters.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 3) * 0.04}>
              <section id={c.id} className="card raised stack chapter" aria-labelledby={`${c.id}-t`}>
                <div className="label">פרק {i + 1}</div>
                <h2 id={`${c.id}-t`} className="h2">{c.title}</h2>
                <p className="chapter-lead">{c.lead}</p>
                {c.paragraphs.map((p, j) => <p key={j} style={{ margin: 0 }}>{p}</p>)}
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
