"use client";
import { useState } from "react";
import { ASSUMED_NEW_UNIT_AREA_M2, NEW_UNIT_AREA_RANGE, estimateNewUnits, type PotentialReport } from "@/engine";
import { unitsVerdict } from "@/lib/summary";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 1 });

/** Compares the routes by new apartments per existing apartment. Numbers come from the engine. */
export function UnitsCompare({ rep }: { rep: PotentialReport }) {
  const [avg, setAvg] = useState(String(ASSUMED_NEW_UNIT_AREA_M2));
  const est = rep.routes.map((r) => ({ r, e: estimateNewUnits(r, rep.input, Number(avg)) }));
  const max = Math.max(...est.map((x) => x.e.perExistingUnit), 0.01);
  const verdict = unitsVerdict(est.map((x) => x.e));

  return (
    <section className="card stack" aria-labelledby="units-t" data-testid="units-compare">
      <div className="label">השוואת מסלולים</div>
      <h3 id="units-t" className="h3">דירות חדשות לכל דירה קיימת</h3>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          {est.map(({ r, e }) => (
            <div key={r.route} style={{ opacity: e.eligible ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span>
                  {r.title} {!e.eligible && <span className="chip bad">לא זמין</span>}
                </span>
                <span className="num">{e.perExistingUnit.toFixed(2)}</span>
              </div>
              <div className="bar" style={{ marginTop: 6 }}>
                <i style={{ width: `${(e.perExistingUnit / max) * 100}%` }} />
              </div>
            </div>
          ))}
          <label className="field" style={{ maxWidth: 260 }}>
            <span>שטח ממוצע לדירה חדשה, ברוטו (מ"ר)</span>
            <input
              className="input num"
              inputMode="numeric"
              name="avgNewUnitArea"
              value={avg}
              onChange={(e) => setAvg(e.target.value)}
            />
            <small>הנחת עבודה, לא נקבעת בתכנית. טווח {NEW_UNIT_AREA_RANGE.min} עד {NEW_UNIT_AREA_RANGE.max}.</small>
          </label>
        </div>
        <div className="stack">
          <div className="state info" data-testid="units-verdict">
            <b>{verdict.title}</b>
            {verdict.text}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{rep.input.existingUnits} דירות קיימות</th>
                  {est.map(({ r }) => <th key={r.route}>{r.title}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>שטח לדירות חדשות (מ"ר)</td>
                  {est.map(({ r, e }) => <td key={r.route} className="num">{fmt(e.saleableArea)}</td>)}
                </tr>
                <tr>
                  <td>דירות חדשות</td>
                  {est.map(({ r, e }) => <td key={r.route} className="num">{e.newUnits}</td>)}
                </tr>
                <tr>
                  <td>הדיירים בזמן העבודות</td>
                  {est.map(({ r, e }) => <td key={r.route}>{e.residentsStay ? "נשארים בבניין" : "פינוי זמני"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        שטח לדירות חדשות = הזכויות שאפשר לממש עד מספר הקומות המרבי, פחות הדירות הקיימות עם התוספת לכל דירה, פחות
        ההקצאה לצרכי ציבור. היחס הוא מדד ראשוני להשוואה בין המסלולים. כדאיות כלכלית תלויה בשווי הקרקע, בעלויות
        הבנייה ובהסכמת הדיירים, ונבדקת מול שמאי.
      </p>
    </section>
  );
}
