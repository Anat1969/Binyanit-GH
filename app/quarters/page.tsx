import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { PAGE } from "@/content/site";
import { getQuarters } from "@/lib/data";

export const metadata: Metadata = { title: "מכסות ברובעים | התחדשות בניינית אשדוד" };
export const revalidate = 300;

const fmt = (n: number) => n.toLocaleString("he-IL");

export default async function Page() {
  const { data, error } = await getQuarters();
  const withThreshold = data.filter((q) => q.threshold != null);
  const anyReported = data.some((q) => q.units_used != null);
  return (
    <div className="wrap section stack">
      <PageHead
        href={PAGE.quarters.href}
        kicker="לוח מכסות"
        title="יחידות דיור ברובעים"
        lead="ברובעים שבהם נקבע סף, מספר יחידות הדיור הנוספות מוגבל. הנתונים מתעדכנים לפי היתרים שניתנו."
      >
        <div className="row-gap">
          <Link href={PAGE.program.href} className="btn small ghost">{PAGE.program.label} בכל רובע</Link>
        </div>
      </PageHead>
      {error && (
        <div className="state bad" role="alert">
          <b>לא ניתן לטעון את נתוני המכסות</b>
          אפשר לרענן את הדף בעוד מספר דקות.
        </div>
      )}
      {!error && data.length === 0 && <div className="state info">אין נתוני רובעים להצגה.</div>}
      {!error && data.length > 0 && !anyReported && (
        <div className="state info" data-testid="quarters-empty">
          <b>נתוני מימוש טרם דווחו</b>
          הספים מוצגים לפי התכנית. מספר היחידות שמומשו יוצג לאחר עדכון ראשון מהוועדה המקומית.
        </div>
      )}
      {!error && withThreshold.length > 0 && (
        <div className="grid grid-3" style={{ marginTop: 8 }}>
          {withThreshold.map((q) => {
            const used = q.units_used ?? 0;
            const pct = Math.min(100, (used / (q.threshold as number)) * 100);
            return (
              <article key={q.quarter} className="card raised stack" data-testid={`quota-${q.quarter}`}>
                <div className="label">רובע {q.quarter}</div>
                <div className="big num">
                  {q.units_used == null ? "—" : fmt(used)} <span style={{ fontSize: "var(--fs-l)" }} className="muted">/ {fmt(q.threshold as number)}</span>
                </div>
                <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.threshold as number} aria-valuenow={used} aria-label={`מימוש ברובע ${q.quarter}`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div className="muted" style={{ fontSize: "var(--fs-s)" }}>
                  {q.units_used == null ? "טרם דווח מימוש" : `נותרו ${fmt(Math.max(0, (q.threshold as number) - used))} יח"ד`}
                  {q.units_in_process != null && ` · בהליך: ${fmt(q.units_in_process)}`}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!error && data.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="h3" style={{ marginBottom: 8 }}>כל הרובעים</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>רובע</th><th>סף בתכנית</th><th>מומש</th><th>בהליך</th><th>עדכון אחרון</th></tr>
              </thead>
              <tbody>
                {data.map((q) => (
                  <tr key={q.quarter}>
                    <td>רובע {q.quarter}</td>
                    <td className="num">{q.threshold == null ? "—" : fmt(q.threshold)}</td>
                    <td className="num">{q.units_used == null ? "—" : fmt(q.units_used)}</td>
                    <td className="num">{q.units_in_process == null ? "—" : fmt(q.units_in_process)}</td>
                    <td className="num">{q.updated_at ? new Date(q.updated_at).toLocaleDateString("he-IL") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
