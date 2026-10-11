"use client";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORY_LABEL, type DocCategory } from "@/lib/data";

type AdminDoc = {
  id: string;
  title: string;
  category: DocCategory;
  description: string | null;
  file_url: string | null;
  source_url: string | null;
  sort: number;
  published: boolean;
  archived: boolean;
};

const KEY = "binyanit-admin-code";
const CATS = Object.keys(CATEGORY_LABEL) as DocCategory[];

function readCode(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function DocRow({ d, code, onChanged }: { d: AdminDoc; code: string; onChanged: () => void }) {
  const [f, setF] = useState({ title: d.title, category: d.category, description: d.description ?? "", sort: String(d.sort) });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = f.title !== d.title || f.category !== d.category || f.description !== (d.description ?? "") || f.sort !== String(d.sort);

  async function save(extra: Partial<{ published: boolean }> = {}) {
    setState("saving");
    const res = await fetch("/api/admin/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ id: d.id, ...f, sort: Number.parseInt(f.sort, 10) || 0, file_url: d.file_url, source_url: d.source_url, published: d.published, ...extra }),
    });
    setState(res.ok ? "saved" : "error");
    if (res.ok) onChanged();
  }

  async function archive() {
    if (!confirm(`להסיר את "${d.title}" מהספרייה?`)) return;
    const res = await fetch(`/api/admin/docs?id=${d.id}`, { method: "DELETE", headers: { "x-admin-code": code } });
    if (res.ok) onChanged();
    else setState("error");
  }

  return (
    <div className="card stack admin-doc" data-testid="admin-doc">
      <div className="grid grid-2">
        <label className="field">
          <span>שם המסמך</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label className="field">
          <span>מעמד</span>
          <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DocCategory })}>
            {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-2">
        <label className="field">
          <span>תיאור קצר</span>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <label className="field">
          <span>סדר הצגה</span>
          <input className="input num" inputMode="numeric" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn small" disabled={!dirty || state === "saving"} onClick={() => save()}>שמירה</button>
        <button type="button" className="btn ghost small" onClick={() => save({ published: !d.published })}>{d.published ? "הסתרה מהציבור" : "פרסום"}</button>
        <button type="button" className="btn ghost small" onClick={archive}>הסרה</button>
        {d.file_url && <a className="btn ghost small" href={d.file_url} target="_blank" rel="noreferrer">פתיחת הקובץ</a>}
        <span className={`chip ${d.published ? "ok" : "warn"}`}>{d.published ? "מפורסם" : "מוסתר"}</span>
        {state === "saved" && <span className="muted" style={{ fontSize: 13 }}>נשמר</span>}
        {state === "error" && <span className="chip bad">השמירה נכשלה</span>}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [login, setLogin] = useState<"idle" | "checking" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<AdminDoc[] | null>(null);
  const [form, setForm] = useState({ title: "", category: "binding" as DocCategory, description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [up, setUp] = useState<{ state: "idle" | "uploading" | "done" | "error"; pct?: number; msg?: string }>({ state: "idle" });
  const [imp, setImp] = useState<{ state: "idle" | "working" | "done" | "error"; msg?: string }>({ state: "idle" });

  useEffect(() => {
    const c = readCode();
    if (c) {
      setCode(c);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (code) void load(code);
  }, [code]);

  async function load(c: string) {
    const res = await fetch("/api/admin/docs", { headers: { "x-admin-code": c } });
    if (res.status === 401) return signOut();
    setDocs(res.ok ? ((await res.json()) as AdminDoc[]).filter((d) => !d.archived) : []);
  }

  function refresh() {
    void load(code);
    router.refresh();
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLogin("checking");
    const c = input.trim().toUpperCase();
    const res = await fetch("/api/admin/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) });
    if (!res.ok) return setLogin("error");
    try {
      sessionStorage.setItem(KEY, c);
    } catch {
      /* session only */
    }
    setCode(c);
    setLogin("idle");
    setInput("");
  }

  function signOut() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setCode("");
    setDocs(null);
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setUp({ state: "error", msg: "יש לבחור קובץ" });
    const title = form.title.trim() || file.name.replace(/\.[^.]+$/, "");
    setUp({ state: "uploading", pct: 0 });
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const blob = await upload(`docs/${Date.now()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        clientPayload: JSON.stringify({ code }),
        onUploadProgress: (p) => setUp({ state: "uploading", pct: Math.round(p.percentage) }),
      });
      const res = await fetch("/api/admin/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ title, category: form.category, description: form.description, file_url: blob.url, sort: (docs?.length ?? 0) + 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "השמירה נכשלה");
      setUp({ state: "done", msg: `"${title}" הועלה ופורסם` });
      setForm({ title: "", category: form.category, description: "" });
      setFile(null);
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err) {
      setUp({ state: "error", msg: err instanceof Error ? err.message : "ההעלאה נכשלה" });
    }
  }

  async function importXplan() {
    setImp({ state: "working" });
    const res = await fetch("/api/admin/import-xplan", { method: "POST", headers: { "x-admin-code": code } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setImp({ state: "error", msg: d.error ?? "הייבוא נכשל" });
    const names: Record<string, string> = {
      plan_boundary: "גבול התכנית",
      street_class: "חזיתות וצירים",
      special_guidelines: "הנחיות מיוחדות",
      building_restriction: "מגבלות בנייה",
      well_site: "אתרי קידוח",
    };
    setImp({ state: "done", msg: Object.entries(d.counts ?? {}).map(([k, n]) => `${names[k] ?? k}: ${n}`).join(" · ") });
  }

  if (!open) {
    return (
      <div style={{ marginTop: 32 }}>
        <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>כניסת עורכת</button>
      </div>
    );
  }

  if (!code) {
    return (
      <form className="card stack" style={{ marginTop: 32, maxWidth: 480 }} onSubmit={signIn} data-testid="admin-login">
        <div className="label">עריכה</div>
        <label className="field">
          <span>קוד עריכה</span>
          <input className="input num" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" name="admin-code" aria-invalid={login === "error" || undefined} />
        </label>
        {login === "error" && <div className="state bad" role="alert">הקוד שגוי</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn small" type="submit" disabled={login === "checking" || input.trim().length < 8}>{login === "checking" ? "בודק" : "כניסה"}</button>
          <button className="btn ghost small" type="button" onClick={() => setOpen(false)}>ביטול</button>
        </div>
      </form>
    );
  }

  return (
    <section className="stack admin" style={{ marginTop: 32 }} aria-labelledby="admin-title" data-testid="admin-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 id="admin-title" className="h2">ניהול מסמכים</h2>
        <button type="button" className="btn ghost small" onClick={signOut}>יציאה</button>
      </div>

      <form className="card raised stack" onSubmit={onUpload} data-testid="upload-form">
        <div className="label">העלאת מסמך</div>
        <label className="field">
          <span>קובץ (PDF, תמונה, Word, Excel, KML)</span>
          <input className="input" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx,.kml,.kmz,.zip"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !form.title) setForm({ ...form, title: f.name.replace(/\.[^.]+$/, "") });
            }} />
        </label>
        <div className="grid grid-2">
          <label className="field">
            <span>שם המסמך באתר</span>
            <input className="input" name="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="לדוגמה: הוראות התכנית" />
          </label>
          <label className="field">
            <span>מעמד</span>
            <select className="select" name="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as DocCategory })}>
              {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>תיאור קצר (רשות)</span>
          <input className="input" name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" type="submit" disabled={up.state === "uploading"}>{up.state === "uploading" ? `מעלה ${up.pct ?? 0}%` : "העלאה"}</button>
          {up.state === "done" && <span className="chip ok">{up.msg}</span>}
          {up.state === "error" && <span className="chip bad" role="alert">{up.msg}</span>}
        </div>
      </form>

      <div className="card stack">
        <div className="label">שכבות התשריט</div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          טעינה מחדש של גבול התכנית, החזיתות הפעילות, צירי התחבורה הציבורית, ההנחיות המיוחדות ואתרי הקידוח מהשירות הציבורי של מינהל התכנון.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn ghost small" onClick={importXplan} disabled={imp.state === "working"}>{imp.state === "working" ? "מייבא" : "ייבוא שכבות ממינהל התכנון"}</button>
          {imp.state === "done" && <span className="chip ok" data-testid="import-result">{imp.msg}</span>}
          {imp.state === "error" && <span className="chip bad" role="alert">{imp.msg}</span>}
        </div>
      </div>

      <div className="label">מסמכים ({docs?.length ?? 0})</div>
      {docs === null && <div className="skeleton" style={{ height: 120 }} />}
      {docs?.length === 0 && <div className="state info">עדיין לא הועלו מסמכים.</div>}
      {docs?.map((d) => <DocRow key={d.id + d.title + d.published} d={d} code={code} onChanged={refresh} />)}
    </section>
  );
}
