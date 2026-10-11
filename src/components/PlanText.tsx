"use client";
import { useDeferredValue, useMemo, useState } from "react";
import type { PlanTextRow } from "@/lib/data";
import { matches, segments } from "@/lib/highlight";

function Rich({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {segments(text, terms).map((s, i) =>
        s.k === "text" ? <span key={i}>{s.t}</span> : <mark key={i} className={`pt-${s.k}`}>{s.t}</mark>,
      )}
    </>
  );
}

export function PlanText({ rows, error }: { rows: PlanTextRow[]; error: boolean }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const terms = useMemo(() => dq.split(/\s+/).filter((t) => t.length >= 2), [dq]);
  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))], [rows]);
  const shown = useMemo(
    () => (terms.length ? rows.filter((r) => matches(`${r.section ?? ""} ${r.title ?? ""} ${r.body}`, terms)) : rows),
    [rows, terms],
  );

  return (
    <section className="card stack plan-text" aria-labelledby="pt-title" data-testid="plan-text">
      <div className="label">נוסח מלא</div>
      <h2 id="pt-title" className="h2">הוראות התכנית, מילה במילה</h2>
      {error && <div className="state bad" role="alert"><b>לא ניתן לטעון את הנוסח</b>אפשר לרענן את הדף בעוד מספר דקות.</div>}
      {!error && rows.length === 0 && (
        <div className="state info" data-testid="plan-text-empty">
          <b>הנוסח טרם נטען</b>
          תמלול הוראות התכנית יוצג כאן לאחר העלאת קובץ ההוראות בדף המסמכים.
        </div>
      )}
      {rows.length > 0 && (
        <>
          <label className="field">
            <span>חיפוש לפי מילות מפתח</span>
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder='לדוגמה: קומת קרקע, תכסית, 4.1.2' name="plan-search" />
          </label>
          <div className="muted" style={{ fontSize: 13 }} aria-live="polite">
            {terms.length ? `${shown.length} קטעים מתאימים מתוך ${rows.length}` : `${rows.length} קטעים · מקורות: ${sources.join(" · ")}`}
          </div>
          <div className="pt-body">
            {terms.length > 0 && shown.length === 0 && <div className="state info">לא נמצאו קטעים עם כל המילים שחיפשת.</div>}
            {shown.slice(0, 400).map((r, i) => {
              const prev = shown[i - 1];
              return (
                <div key={r.id}>
                  {(!prev || prev.source !== r.source) && <div className="label pt-source">{r.source}</div>}
                  {r.kind === "heading" ? (
                    <h3 className="pt-h">
                      {r.section && <span className="pt-ref">{r.section}</span>}
                      <Rich text={r.title ? `${r.title} ${r.body}` : r.body} terms={terms} />
                    </h3>
                  ) : (
                    <p className={`pt-p ${r.kind === "item" ? "pt-item" : ""}`}>
                      {r.section && <span className="pt-ref">{r.section}</span>}
                      <Rich text={r.body} terms={terms} />
                      {r.page != null && <span className="cite"> · עמ׳ {r.page}</span>}
                    </p>
                  )}
                </div>
              );
            })}
            {shown.length > 400 && <div className="muted">מוצגים 400 קטעים ראשונים. אפשר לצמצם בחיפוש.</div>}
          </div>
        </>
      )}
    </section>
  );
}
