"use client";
import { motion } from "framer-motion";
import type { BuildingInput, RouteResult } from "@/engine";
import { floorsPhrase } from "@/lib/summary";
import { FloorDiagram } from "./FloorDiagram";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 1 });

function Metric({ k, v, cite }: { k: string; v: string; cite?: string }) {
  return (
    <div className="metric">
      <span>
        {k} {cite && <span className="cite">({cite})</span>}
      </span>
      <span className="num">{v}</span>
    </div>
  );
}

export function RouteCard({ r, b, index }: { r: RouteResult; b: BuildingInput; index: number }) {
  const pa = r.publicAllocation;
  return (
    <motion.article
      className={`card raised route ${r.eligible ? "" : "ineligible"}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      data-testid={`route-${r.route}`}
    >
      <div className="route-head">
        <div>
          <div className="label">מסלול {index + 1}</div>
          <h3 className="h3">{r.title}</h3>
        </div>
        <span className={`chip ${r.eligible ? "ok" : "bad"}`}>{r.eligible ? "זכאי לבחינה" : "לא זמין"}</span>
      </div>

      {r.blockers.length > 0 && (
        <div className="state bad">
          <b>חסמים</b>
          <ul className="list">
            {r.blockers.map((x, i) => (
              <li key={i}>
                <span>{x.text}</span>
                <span className="cite">{x.section}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(r.route !== "demolish" || r.totalRights > 0) && (
        <>
          <div>
            <div className="label">תוספת קומות</div>
            <div className={r.route === "demolish" ? "big" : "phrase"}>{r.route === "demolish" ? `+${r.addedFullFloors} קומות` : floorsPhrase(r)}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <FloorDiagram r={r} b={b} />
          </div>
          <div>
            {r.floorSteps.map((s, i) => (
              <Metric key={i} k={s.label} v={s.floors < 1 ? `${Math.round(s.floors * 100)}% מקומה` : `${s.floors} ${s.floors === 1 ? "קומה" : "קומות"}`} cite={s.section} />
            ))}
            <Metric k='מ"ר ליח"ד' v={r.m2PerUnit ? `${r.m2PerUnit}` : "—"} />
            {r.route === "demolish" ? (
              <>
                <Metric k="קומה טיפוסית מורחבת" v={`${fmt(r.expandedFloorArea)} מ"ר`} />
                <Metric k="סך זכויות משוער" v={`${fmt(r.totalRights)} מ"ר`} />
                <Metric k="תוספת על הקיים" v={`${fmt(r.addedArea)} מ"ר`} />
                <Metric k="מספר קומות מרבי" v={`${r.maxFloors}`} cite="טבלה 5" />
                <Metric k="פריסת הזכויות" v={`${r.resultingFloors} קומות`} />
                <Metric k="תכסית מרבית" v={`${r.coveragePct}%`} cite="טבלה 5" />
              </>
            ) : (
              <>
                <Metric k="תוספת שטח משוערת" v={`${fmt(r.addedArea)} מ"ר`} />
                <Metric k="מספר קומות אחרי התוספת" v={`${r.resultingFloors}`} />
                <Metric k="תכסית" v="לפי הקיים ותוספת הממ״ד" />
              </>
            )}
            <Metric k="גובה משוער" v={r.estimatedHeightM ? `כ-${fmt(r.estimatedHeightM)} מ׳` : "—"} />
            <Metric
              k="הקצאה לצרכי ציבור"
              v={!pa.applies ? "לא חלה" : pa.required ? `${fmt(pa.area)} מ"ר` : `פטור: ${pa.exemption}`}
              cite={pa.applies ? pa.section : undefined}
            />
          </div>
        </>
      )}

      {r.notes.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 14 }}>הערות ({r.notes.length})</summary>
          <ul className="list" style={{ marginTop: 8 }}>
            {r.notes.map((x, i) => (
              <li key={i}>
                <span>{x.text}</span>
                <span className="cite">{x.section}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </motion.article>
  );
}
