"use client";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_LABEL, type DocCategory, type PlanDocument } from "@/lib/data";

const FILTERS: ("all" | DocCategory)[] = ["all", "binding", "background", "historical", "indirect"];
const CATS = Object.keys(CATEGORY_LABEL) as DocCategory[];
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx,.kml,.kmz,.zip";

async function saveDoc(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "השמירה נכשלה";
}

function DocEditor({ d, onDone }: { d: PlanDocument; onDone: (changed: boolean) => void }) {
  const [f, setF] = useState({ title: d.title, category: d.category, description: d.description ?? "" });
  const [state, setState] = useState<{ s: "idle" | "saving" | "error"; msg?: string }>({ s: "idle" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ s: "saving" });
    const err = await saveDoc({ id: d.id, ...f });
    if (err) return setState({ s: "error", msg: err });
    onDone(true);
  }

  async function remove() {
    if (!confirm(`להסיר את "${d.title}" מרשימת המסמכים?`)) return;
    setState({ s: "saving" });
    const res = await fetch(`/api/docs?id=${d.id}`, { method: "DELETE" });
    if (!res.ok) return setState({ s: "error", msg: "ההסרה נכשלה" });
    onDone(true);
  }

  return (
    <form className="stack" style={{ flexBasis: "100%" }} onSubmit={save} data-testid="doc-editor">
      <div className="grid grid-2">
        <label className="field">
          <span>שם המסמך</span>
          <input className="input" name="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        </label>
        <label className="field">
          <span>סיווג</span>
          <select className="select" name="category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DocCategory })}>
            {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>תיאור קצר (רשות)</span>
        <input className="input" name="description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn small" type="submit" disabled={state.s === "saving" || !f.title.trim()}>שמירה</button>
        <button className="btn ghost small" type="button" onClick={() => onDone(false)}>ביטול</button>
        <button className="btn ghost small" type="button" onClick={remove} disabled={state.s === "saving"}>הסרת המסמך</button>
        {state.s === "error" && <span className="chip bad" role="alert">{state.msg}</span>}
      </div>
    </form>
  );
}

type Pending = { key: string; file: File; title: string; category: DocCategory; state: "idle" | "uploading" | "done" | "error"; pct?: number; msg?: string };

function Uploader({ count, onUploaded }: { count: number; onUploaded: () => void }) {
  const [items, setItems] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  function add(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      title: file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim(),
      category: "background" as DocCategory,
      state: "idle" as const,
    }));
    setItems((cur) => [...cur.filter((x) => x.state !== "done"), ...next]);
  }

  const patch = (key: string, p: Partial<Pending>) => setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function uploadAll() {
    setBusy(true);
    let sort = count;
    for (const it of items) {
      if (it.state === "done") continue;
      if (!it.title.trim()) {
        patch(it.key, { state: "error", msg: "חסר שם" });
        continue;
      }
      patch(it.key, { state: "uploading", pct: 0 });
      try {
        const ext = it.file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const blob = await upload(`docs/${Date.now()}.${ext}`, it.file, {
          access: "public",
          handleUploadUrl: "/api/docs/upload",
          onUploadProgress: (p) => patch(it.key, { pct: Math.round(p.percentage) }),
        });
        const err = await saveDoc({ title: it.title, category: it.category, file_url: blob.url, sort: ++sort });
        if (err) throw new Error(err);
        patch(it.key, { state: "done" });
      } catch (e) {
        patch(it.key, { state: "error", msg: e instanceof Error ? e.message : "ההעלאה נכשלה" });
      }
    }
    setBusy(false);
    onUploaded();
  }

  const waiting = items.filter((x) => x.state !== "done").length;

  return (
    <section className={`card raised stack uploader${drag ? " drag" : ""}`} aria-labelledby="up-title" data-testid="upload-form"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      <div className="label" id="up-title">הוספת מסמכים</div>
      <label className="field">
        <span>בחירת קבצים (אפשר כמה יחד, או לגרור לכאן)</span>
        <input className="input" type="file" name="files" multiple accept={ACCEPT}
          onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {items.map((it) => (
        <div key={it.key} className="grid grid-2 pending" data-testid="pending-doc">
          <label className="field">
            <span>שם המסמך באתר</span>
            <input className="input" value={it.title} disabled={it.state === "uploading" || it.state === "done"}
              onChange={(e) => patch(it.key, { title: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <label className="field" style={{ flex: "1 1 140px" }}>
              <span>סיווג</span>
              <select className="select" value={it.category} disabled={it.state === "uploading" || it.state === "done"}
                onChange={(e) => patch(it.key, { category: e.target.value as DocCategory })}>
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            {it.state === "idle" && <button type="button" className="btn ghost small" onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}>ביטול</button>}
            {it.state === "uploading" && <span className="chip">מעלה {it.pct ?? 0}%</span>}
            {it.state === "done" && <span className="chip ok">הועלה</span>}
            {it.state === "error" && <span className="chip bad" role="alert">{it.msg}</span>}
          </div>
        </div>
      ))}
      {waiting > 0 && (
        <div>
          <button className="btn" type="button" onClick={uploadAll} disabled={busy}>
            {busy ? "מעלה" : waiting === 1 ? "העלאת המסמך" : `העלאת ${waiting} המסמכים`}
          </button>
        </div>
      )}
    </section>
  );
}

export default function DocumentsClient({ docs, error }: { docs: PlanDocument[]; error: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | DocCategory>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
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
          <b>עדיין אין מסמכים</b>
          אפשר להוסיף מסמכים בטופס שלמטה.
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
                <button type="button" className="btn ghost small" onClick={() => setOpen(open === d.id ? null : d.id)}>
                  {open === d.id ? "סגירת תצוגה" : "תצוגה"}
                </button>
                <a className="btn small" href={d.file_url} download target="_blank" rel="noreferrer">הורדה</a>
              </>
            )}
            {d.source_url && (
              <a className="btn ghost small" href={d.source_url} target="_blank" rel="noreferrer">מקור</a>
            )}
            <button type="button" className="btn ghost small" aria-expanded={editing === d.id} onClick={() => setEditing(editing === d.id ? null : d.id)}>
              עריכה
            </button>
          </div>
          {editing === d.id && (
            <DocEditor key={d.id + d.title + d.category} d={d} onDone={(changed) => { setEditing(null); if (changed) router.refresh(); }} />
          )}
          {open === d.id && d.file_url && (
            <iframe className="viewer" src={d.file_url} title={d.title} style={{ flexBasis: "100%" }} />
          )}
        </article>
      ))}
      <Uploader count={docs.length} onUploaded={() => router.refresh()} />
    </div>
  );
}
