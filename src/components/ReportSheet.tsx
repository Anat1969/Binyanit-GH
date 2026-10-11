import { forwardRef } from "react";
import type { PotentialReport } from "@/engine";
import { PLAN, STREET_CLASS_LABEL } from "@/content/plan-meta";
import { summarize } from "@/lib/summary";
import { FloorDiagram } from "./FloorDiagram";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 1 });
const yesNo = (v: boolean | null | undefined) => (v == null ? "לא אומת" : v ? "כן" : "לא");

export const ReportSheet = forwardRef<HTMLDivElement, { rep: PotentialReport; address: string | null }>(function ReportSheet(
  { rep, address },
  ref,
) {
  const b = rep.input;
  const s = rep.site;
  return (
    <div ref={ref} className="sheet" aria-hidden="true">
      <div style={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "#555" }}>
        תכנית {PLAN.number} · קובץ פוטנציאל · {new Date().toLocaleDateString("he-IL")}
      </div>
      <h1>קובץ פוטנציאל תכנוני ראשוני</h1>
      <p style={{ border: "1px solid #26313d", padding: 8, borderRadius: 6 }}>{rep.disclaimer}</p>
      <h3>מיקום ונתוני תשריט</h3>
      <table>
        <tbody>
          <tr><th>כתובת</th><td>{address ?? "לא הוזנה"}</td></tr>
          <tr><th>בתחום התכנית</th><td>{yesNo(s.inPlan)}</td></tr>
          <tr><th>סיווג רחוב</th><td>{STREET_CLASS_LABEL[s.streetClass]}</td></tr>
          <tr><th>הנחיות מיוחדות (הקצאה לציבור)</th><td>{yesNo(s.publicAllocationZone)}</td></tr>
          <tr><th>הנחיות מיוחדות ב׳</th><td>{yesNo(s.urbanRenewalSearchZone)}</td></tr>
          <tr><th>רדיוס מגן קידוח</th><td>{yesNo(s.wellRadius)}</td></tr>
          <tr><th>רובע</th><td>{s.quarter ?? "לא ידוע"}</td></tr>
        </tbody>
      </table>
      <h3>נתוני הבניין</h3>
      <table>
        <tbody>
          <tr><th>קומות קיימות</th><td>{b.existingFloors}</td><th>יח"ד קיימות</th><td>{b.existingUnits}</td></tr>
          <tr><th>שטח קומה טיפוסית</th><td>{fmt(b.typicalFloorArea)} מ"ר</td><th>שטח מגרש</th><td>{fmt(b.plotArea)} מ"ר</td></tr>
          <tr><th>קומת קרקע</th><td>{b.groundFloor === "built" ? "בנויה" : "קומת עמודים"}</td><th>טעון חיזוק</th><td>{b.retrofitNeeded ? "כן" : "לא"}</td></tr>
          <tr><th>מרחבים מוגנים</th><td>{{ none: "אין", partial: "חלקי", full: "מלא" }[b.protectedSpaces]}</td><th>שימוש</th><td>{b.residential ? "מגורים" : "אחר"}</td></tr>
        </tbody>
      </table>
      <h3>שלושת המסלולים</h3>
      <table>
        <thead>
          <tr><th>מסלול</th><th>זכאות</th><th>קומות מלאות</th><th>גג חלקי</th><th>מ"ר ליח"ד</th><th>תוספת שטח</th><th>הקצאה לציבור</th></tr>
        </thead>
        <tbody>
          {rep.routes.map((r) => (
            <tr key={r.route}>
              <td>{r.title}</td>
              <td>{r.eligible ? "זכאי לבחינה" : "לא זמין"}</td>
              <td>{r.addedFullFloors}</td>
              <td>{r.partialRoofFraction ? `${Math.round(r.partialRoofFraction * 100)}%` : "—"}</td>
              <td>{r.m2PerUnit || "—"}</td>
              <td>{fmt(r.addedArea)} מ"ר</td>
              <td>{!r.publicAllocation.applies ? "לא חלה" : r.publicAllocation.required ? `${fmt(r.publicAllocation.area)} מ"ר` : "פטור"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
        {rep.routes.map((r) => (
          <div key={r.route} style={{ border: "1px solid #ccc", padding: 6 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>{r.title}</div>
            <FloorDiagram r={r} b={b} />
          </div>
        ))}
      </div>
      <h3>פירוט והפניות לסעיפים</h3>
      {rep.routes.map((r) => (
        <div key={r.route} style={{ marginBottom: 8 }}>
          <b>{r.title}</b>
          <ul style={{ margin: "4px 0" }}>
            {[...r.blockers, ...r.floorSteps.map((x) => ({ text: `${x.label}: ${x.floors < 1 ? `${Math.round(x.floors * 100)}%` : x.floors}`, section: x.section })), ...r.notes].map((x, i) => (
              <li key={i}>{x.text} ({x.section})</li>
            ))}
          </ul>
        </div>
      ))}
      <h3>סיכום</h3>
      <ul>{summarize(rep).map((l, i) => <li key={i}>{l}</li>)}</ul>
      <h3>הנחות חישוב</h3>
      <ul>{rep.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </div>
  );
});
