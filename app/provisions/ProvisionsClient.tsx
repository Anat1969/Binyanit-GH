"use client";
import Link from "next/link";
import { useState } from "react";
import { STATUS_LABEL, type ProvisionChapter, type ProvisionStatus } from "@/content/plan-provisions";

const CHIP: Record<ProvisionStatus, string> = { verbatim: "ok", official: "ok", working: "warn" };

export default function ProvisionsClient({ chapters }: { chapters: ProvisionChapter[] }) {
  const [openCh, setOpenCh] = useState<number | null>(null);
  const [openSec, setOpenSec] = useState<string | null>(null);

  const toggleCh = (no: number) => {
    setOpenCh((v) => (v === no ? null : no));
    setOpenSec(null);
  };

  return (
    <ol className="prov" aria-label="פרקי ההוראות">
      {chapters.map((c) => {
        const open = openCh === c.no;
        return (
          <li key={c.no} className="prov-ch card" data-open={open}>
            <h2 className="prov-h">
              <button type="button" className="prov-btn" aria-expanded={open} aria-controls={`ch-${c.no}`} onClick={() => toggleCh(c.no)}>
                <span className="prov-no num">{c.no}</span>
                <span className="prov-t">
                  <span className="prov-title">{c.title}</span>
                  <span className="prov-lead">{c.lead}</span>
                </span>
                <span className="prov-count num">{c.sections.length ? `${c.sections.length} סעיפים` : "טרם נטען"}</span>
              </button>
            </h2>
            {open && (
              <div id={`ch-${c.no}`} className="prov-body">
                {c.sections.length === 0 && (
                  <div className="state info"><b>אין עדיין נוסח לפרק זה</b>הפרק יוצג לאחר טעינת נוסח ההוראות המלא.</div>
                )}
                <ul className="prov-secs">
                  {c.sections.map((s) => {
                    const so = openSec === s.id;
                    return (
                      <li key={s.id} className="prov-sec" data-open={so}>
                        <button type="button" className="prov-sbtn" aria-expanded={so} aria-controls={`sec-${s.id}`} onClick={() => setOpenSec(so ? null : s.id)}>
                          {s.ref && <span className="pt-ref">{s.ref}</span>}
                          <span className="prov-stitle">{s.title}</span>
                        </button>
                        {so && (
                          <div id={`sec-${s.id}`} className="prov-detail stack">
                            {s.body.map((p, i) => <p key={i} className="pt-p">{p}</p>)}
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
                {c.link && <Link href={c.link.href} className="btn small" style={{ marginTop: 12 }}>{c.link.label}</Link>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
