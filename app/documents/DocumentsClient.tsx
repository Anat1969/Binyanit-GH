"use client";
import { useState } from "react";
import { CATEGORY_LABEL, type DocCategory, type PlanDocument } from "@/lib/data";

const FILTERS: ("all" | DocCategory)[] = ["all", "binding", "background", "historical", "indirect"];

export default function DocumentsClient({ docs, error }: { docs: PlanDocument[]; error: boolean }) {
  const [filter, setFilter] = useState<"all" | DocCategory>("all");
  const [open, setOpen] = useState<PlanDocument | null>(null);
  const shown = docs.filter((d) => filter === "all" || d.category === filter);

  if (error) {
    return (
      <div className="state bad" role="alert">
        <b>לא ניתן לטעון את רשימת המסמכים</b>
        אפשר לרענן את הדף בעוד מספר דקות.
      </div>
    );
  }
  return (
    <div className="stack" style={{ marginTop: 16 }}>
      <div className="seg" role="group" aria-label="סינון לפי מעמד">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? `הכול (${docs.length})` : `${CATEGORY_LABEL[f]} (${docs.filter((d) => d.category === f).length})`}
          </button>
        ))}
      </div>
      {docs.length === 0 && (
        <div className="state info" data-testid="docs-empty">
          <b>המסמכים טרם הועלו</b>
          הוראות התכנית, התשריט ונספח הבינוי יועלו לכאן לאחר פרסום התכנית לתוקף.
        </div>
      )}
      {docs.length > 0 && shown.length === 0 && <div className="state info">אין מסמכים בקטגוריה זו.</div>}
      {shown.map((d) => (
        <article key={d.id} className="card doc">
          <div className="stack" style={{ minWidth: 0, flex: "1 1 260px" }}>
            <span className="chip" style={{ alignSelf: "flex-start" }}>{CATEGORY_LABEL[d.category]}</span>
            <h2 className="h3">{d.title}</h2>
            {d.description && <p className="muted" style={{ margin: 0 }}>{d.description}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {d.file_url && (
              <>
                <button type="button" className="btn ghost small" onClick={() => setOpen(open?.id === d.id ? null : d)}>
                  {open?.id === d.id ? "סגירת תצוגה" : "תצוגה"}
                </button>
                <a className="btn small" href={d.file_url} download target="_blank" rel="noreferrer">הורדה</a>
              </>
            )}
            {d.source_url && (
              <a className="btn ghost small" href={d.source_url} target="_blank" rel="noreferrer">מקור</a>
            )}
          </div>
          {open?.id === d.id && d.file_url && (
            <iframe className="viewer" src={d.file_url} title={d.title} style={{ flexBasis: "100%" }} />
          )}
        </article>
      ))}
    </div>
  );
}
