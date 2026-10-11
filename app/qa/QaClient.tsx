"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { PageHead } from "@/components/PageHead";
import { Prose } from "@/components/Prose";
import { FAQ } from "@/content/faq";
import { PAGE } from "@/content/site";

type Citation = { section: string; title: string; text: string };
type Turn = { provider?: string | null; matched?: string; q: string; state: "loading" | "done" | "error"; kind?: "answer" | "refused" | "not_found"; answer?: string; citations?: Citation[]; mode?: string; corpus?: string };

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
      <PageHead
        href={PAGE.qa.href}
        title="שאלה על הוראות התכנית"
        lead="התשובות נכתבו מראש מתוך הוראות התכנית, עם הפניה לסעיפים. כשאין תשובה מוכנה, מוצגים הסעיפים הרלוונטיים."
      >
        <div className="row-gap">
          <Link href={PAGE.provisions.href} className="btn small ghost">חיפוש ב{PAGE.provisions.label}</Link>
          <Link href={PAGE.check.href} className="btn small ghost">לחישוב לבניין מסוים: {PAGE.check.label}</Link>
        </div>
      </PageHead>

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
                    {t.answer} <Link href={PAGE.check.href}>{PAGE.check.label}</Link>
                  </div>
                )}
                {t.kind === "not_found" && <div className="state info"><b>לא נמצא מענה</b>{t.answer}</div>}
                {t.kind === "answer" && t.mode === "faq" && t.matched && (
                  <div className="label">תשובה מוכנה לשאלה: {t.matched}</div>
                )}
                {t.kind === "answer" && t.answer && <Prose text={t.answer} />}
                {t.mode === "llm" && (
                  <small className="muted">
                    ניסוח אוטומטי בשירות בינה מלאכותית{t.provider === "free" ? " חינמי" : ""}, מתוך הקטעים שלמטה בלבד. כל מספר בתשובה נבדק מול הקטעים.
                  </small>
                )}
                {t.citations && t.citations.length > 0 && (
                  <div className="stack">
                    <div className="label">סעיפים</div>
                    {t.citations.map((c) => (
                      <details key={c.section + c.title} open={t.mode === "retrieval"}>
                        <summary style={{ cursor: "pointer" }}>
                          <span className="cite">{c.section}</span> · {c.title}
                        </summary>
                        <p className="muted" style={{ margin: "6px 0 0", fontSize: "var(--fs-s)" }}>{c.text}</p>
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

      <p className="muted" style={{ fontSize: "var(--fs-s)", margin: 0 }}>
        שאלה שאין לה תשובה מוכנה נשלחת לשירות בינה מלאכותית חיצוני לניסוח. אין להזין פרטים אישיים.
      </p>
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
