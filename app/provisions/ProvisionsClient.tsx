"use client";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { STATUS_LABEL, type ProvisionChapter, type ProvisionSection, type ProvisionStatus } from "@/content/plan-provisions";
import { matches, segments } from "@/lib/highlight";

const CHIP: Record<ProvisionStatus, string> = { verbatim: "ok", official: "ok", working: "warn" };
const EXAMPLES = ["קומת קרקע", "תכסית", "מרחב מוגן", "חזית פעילה", "4.1.2"];

function Rich({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {segments(text, terms).map((s, i) =>
        s.k === "text" ? <span key={i}>{s.t}</span> : <mark key={i} className={`pt-${s.k}`}>{s.t}</mark>,
      )}
    </>
  );
}

const haystack = (s: ProvisionSection) => `${s.ref ?? ""} ${s.title} ${s.body.join(" ")}`;

export default function ProvisionsClient({ chapters }: { chapters: ProvisionChapter[] }) {
  const [openCh, setOpenCh] = useState<number | null>(null);
  const [openSec, setOpenSec] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const terms = useMemo(() => dq.split(/\s+/).filter((t) => t.length >= 2), [dq]);
  const searching = terms.length > 0;

  // While searching, every chapter with a hit is open and shows only the sections that match.
  const shown = useMemo(
    () =>
      searching
        ? chapters
            .map((c) => ({ ...c, sections: c.sections.filter((s) => matches(haystack(s), terms)) }))
            .filter((c) => c.sections.length > 0)
        : chapters,
    [chapters, terms, searching],
  );
  const hits = shown.reduce((n, c) => n + c.sections.length, 0);
  const total = chapters.reduce((n, c) => n + c.sections.length, 0);

  const toggleCh = (no: number) => {
    setOpenCh((v) => (v === no ? null : no));
    setOpenSec(null);
  };

  return (
    <div className="stack" style={{ maxWidth: 960 }}>
      <section role="search" className="card stack prov-search" aria-label="חיפוש בהוראות התכנית">
        <h2 className="h3" id="plan-search-t">חיפוש בתוך התכנית</h2>
        <label className="field">
          <span className="sr-only">מילות חיפוש</span>
          <input
            id="plan-search"
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="מילה, ביטוי או מספר סעיף"
            name="plan-search"
            autoComplete="off"
          />
        </label>
        <div className="row-between">
          <div className="row-gap">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" className="tchip" aria-pressed={q === e} onClick={() => setQ(q === e ? "" : e)}>
                {e}
              </button>
            ))}
          </div>
          <span className="muted" aria-live="polite" style={{ fontSize: "var(--fs-s)" }} data-testid="prov-count">
            {searching ? `${hits} סעיפים מתאימים מתוך ${total}` : `${total} סעיפים בשבעה פרקים`}
          </span>
        </div>
      </section>

      {searching && hits === 0 && (
        <div className="state info" data-testid="prov-none">
          <b>לא נמצאו סעיפים עם כל המילים שחיפשת</b>
          אפשר לנסות מילה אחת, או לשאול בדף <Link href="/qa">שאלות על התכנית</Link>.
        </div>
      )}

      <ol className="prov" aria-label="פרקי ההוראות">
        {shown.map((c) => {
          const open = searching || openCh === c.no;
          return (
            <li key={c.no} className="prov-ch card" data-open={open}>
              <h2 className="prov-h">
                <button type="button" className="prov-btn" aria-expanded={open} aria-controls={`ch-${c.no}`} onClick={() => !searching && toggleCh(c.no)}>
                  <span className="prov-no num">{c.no}</span>
                  <span className="prov-t">
                    <span className="prov-title">{c.title}</span>
                    <span className="prov-lead">{c.lead}</span>
                  </span>
                  <span className="prov-count">
                    {searching ? `${c.sections.length} תוצאות` : c.sections.length ? `${c.sections.length} סעיפים` : "טרם נטען"}
                  </span>
                </button>
              </h2>
              {open && (
                <div id={`ch-${c.no}`} className="prov-body">
                  {c.sections.length === 0 && (
                    <div className="state info"><b>אין עדיין נוסח לפרק זה</b>הפרק יוצג לאחר טעינת נוסח ההוראות המלא.</div>
                  )}
                  <ul className="prov-secs">
                    {c.sections.map((s) => {
                      const so = searching || openSec === s.id;
                      return (
                        <li key={s.id} className="prov-sec plan-text" data-open={so}>
                          <button type="button" className="prov-sbtn" aria-expanded={so} aria-controls={`sec-${s.id}`} onClick={() => !searching && setOpenSec(so ? null : s.id)}>
                            {s.ref && <span className="pt-ref">{s.ref}</span>}
                            <span className="prov-stitle"><Rich text={s.title} terms={terms} /></span>
                          </button>
                          {so && (
                            <div id={`sec-${s.id}`} className="prov-detail stack">
                              {s.body.map((p, i) => <p key={i} className="pt-p"><Rich text={p} terms={terms} /></p>)}
                              <div className="row-gap">
                                <span className={`chip ${CHIP[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                                <span className="cite" style={{ whiteSpace: "normal" }}>מקור: {s.source}</span>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {c.link && !searching && <Link href={c.link.href} className="btn small" style={{ marginTop: 12 }}>{c.link.label}</Link>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
