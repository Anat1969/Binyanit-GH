"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { FAQ } from "@/content/faq";

type Citation = { section: string; title: string; text: string };
type Turn = { matched?: string; q: string; state: "loading" | "done" | "error"; kind?: "answer" | "refused" | "not_found"; answer?: string; citations?: Citation[]; mode?: string; corpus?: string };

const EXAMPLES = FAQ.map((f) => f.q);

export default function QaClient() {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const busy = turns.some((t) => t.state === "loading");

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setQ("");
    setTurns((t) => [...t, { q: text, state: "loading" }]);
    const update = (patch: Partial<Turn>) => setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, ...patch } : x)));
    try {
      const res = await fetch("/api/qa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      const d = await res.json();
      if (!res.ok) return update({ state: "error", answer: d.error });
      update({ state: "done", ...d });
    } catch {
      update({ state: "error", answer: "אין חיבור לשרת. אפשר לנסות שוב." });
    }
  }

  return (
    <div className="wrap section stack" style={{ maxWidth: 900 }}>
      <div className="label">שאלות על התכנית</div>
      <h1 className="h2">שאלה על הוראות התכנית</h1>
      <p className="lead" style={{ margin: 0 }}>
        התשובות נכתבו מראש מתוך הוראות התכנית, עם הפניה לסעיפים. כשאין תשובה מוכנה מוצגים הסעיפים הרלוונטיים. לחישוב זכויות לבניין מסוים יש להשתמש ב
        <Link href="/check">בדיקת הכתובת</Link>.
      </p>

      <div className="chat" aria-live="polite" style={{ marginTop: 16 }}>
        {turns.length === 0 && (
          <div className="card stack" data-testid="qa-empty">
            <div className="label">שאלות נפוצות</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EXAMPLES.map((e) => (
                <button key={e} type="button" className="btn ghost small" onClick={() => ask(e)}>{e}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <motion.div key={i} className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bubble q">{t.q}</div>
            {t.state === "loading" && <div className="skeleton" style={{ height: 90 }} aria-label="טוען תשובה" />}
            {t.state === "error" && <div className="state bad" role="alert"><b>לא התקבלה תשובה</b>{t.answer}</div>}
            {t.state === "done" && (
              <div className={`card stack ${t.kind === "refused" ? "" : "raised"}`} data-testid="qa-answer">
                {t.kind === "refused" && (
                  <div className="state warn">
                    <b>הסוכן אינו מחשב זכויות</b>
                    {t.answer} <Link href="/check">למעבר לבדיקת כתובת</Link>
                  </div>
                )}
                {t.kind === "not_found" && <div className="state info"><b>לא נמצא מענה</b>{t.answer}</div>}
                {t.kind === "answer" && t.mode === "faq" && t.matched && (
                  <div className="label" style={{ textTransform: "none" }}>תשובה מוכנה לשאלה: {t.matched}</div>
                )}
                {t.kind === "answer" && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{t.answer}</p>}
                {t.citations && t.citations.length > 0 && (
                  <div className="stack">
                    <div className="label">סעיפים</div>
                    {t.citations.map((c) => (
                      <details key={c.section + c.title} open={t.mode === "retrieval"}>
                        <summary style={{ cursor: "pointer" }}>
                          <span className="cite">{c.section}</span> · {c.title}
                        </summary>
                        <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{c.text}</p>
                      </details>
                    ))}
                  </div>
                )}
                {t.corpus && <small className="muted">{t.corpus}</small>}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <form
        className="card"
        style={{ display: "flex", gap: 8, alignItems: "flex-end", position: "sticky", bottom: 12 }}
        onSubmit={(e) => { e.preventDefault(); ask(q); }}
      >
        <label className="field" style={{ flex: 1 }}>
          <span>השאלה</span>
          <textarea className="textarea" rows={2} style={{ minHeight: 56 }} value={q} maxLength={1000} onChange={(e) => setQ(e.target.value)} name="question"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} />
        </label>
        <button className="btn" type="submit" disabled={busy || q.trim().length < 3}>{busy ? "שולח" : "שליחה"}</button>
      </form>
    </div>
  );
}
