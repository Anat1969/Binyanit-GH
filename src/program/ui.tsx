"use client";
import Link from "next/link";
import { ADDED_STEPS, HAREDI_STEPS, MODE_LABEL, type MapMode } from "./ProgramMap";
import { NULL_STATUS, PROGRAM, capacityOf, legendFor, pageHref, type CapacityClass, type Rova } from "./data";

/** Link to a page of the signed appendix, opened in a new tab. */
export function SourceLink({ page, label }: { page: number; label?: string }) {
  return (
    <a className="src-link" href={pageHref(page)} target="_blank" rel="noreferrer" data-page={page}>
      {label ?? `מקור: עמ׳ ${page} בנספח`}
    </a>
  );
}

export function statusOf(r: Rova): { key: CapacityClass | null; label: string; color: string; opacity: number; stroke?: string } {
  const { cap } = capacityOf(r);
  const lg = legendFor(cap?.class);
  return lg ? { key: lg.key, label: lg.label, color: lg.color, opacity: lg.opacity, stroke: lg.stroke } : { key: null, ...NULL_STATUS };
}

export function StatusBadge({ r }: { r: Rova }) {
  const s = statusOf(r);
  return (
    <span className="status-badge" data-status={s.key ?? "null"} style={{ ["--sc" as string]: s.color, ["--sb" as string]: s.stroke ?? s.color }}>
      {s.label}
    </span>
  );
}

export function RovaButtons({ current }: { current?: string }) {
  return (
    <nav className="rova-buttons" aria-label="רובעים">
      {PROGRAM.rovaim.map((r) => {
        const s = statusOf(r);
        return (
          <Link
            key={r.id}
            href={`/program/${r.id}`}
            className="rova-btn"
            data-status={s.key ?? "null"}
            aria-current={current === r.id ? "page" : undefined}
            title={s.label}
            style={{ ["--sc" as string]: s.color, ["--sb" as string]: s.stroke ?? s.color }}
          >
            {r.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function MapLegend({ mode }: { mode: MapMode }) {
  if (mode === "capacity") {
    return (
      <ul className="legend" aria-label={`מקרא: ${MODE_LABEL[mode]}`}>
        {PROGRAM.meta.carrying_capacity_legend.map((l) => (
          <li key={l.key}>
            <i style={{ background: l.color, opacity: Math.max(l.opacity, 0.6), outline: l.stroke ? `2px solid ${l.stroke}` : undefined }} />
            {l.label}
          </li>
        ))}
        <li>
          <i style={{ background: NULL_STATUS.color, opacity: 0.6 }} />
          {NULL_STATUS.label} ({PROGRAM.meta.methodology.threshold_note})
        </li>
      </ul>
    );
  }
  if (mode === "era") {
    const e = PROGRAM.meta.construction_era_legend;
    return (
      <div className="stack">
        <div className="state info" data-testid="era-empty">
          <b>אין נתון שנת הקמה לפי רובע בנתוני המקור</b>
          קובץ הנתונים כולל רק את מקרא שנות ההקמה ({e.source}), ללא שיוך לרובעים. לכן הרובעים מוצגים באפור.
        </div>
        <ul className="legend" aria-label="מקרא שנות הקמה (ללא שיוך לרובעים)">
          {e.classes.map((c) => (
            <li key={c.label}>
              <i style={{ background: c.color }} />
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const steps = mode === "added" ? ADDED_STEPS : HAREDI_STEPS;
  const colors = mode === "added" ? ["#e8eef5", "#bccde0", "#8aa6c4", "#5a7ea6", "#2f557f"] : ["#f3ece4", "#e1cdb6", "#c9a985", "#a8825a", "#7b5b39"];
  const lab = (v: number) => (mode === "added" ? v.toLocaleString("he-IL") : `${Math.round(v * 100)}%`);
  return (
    <ul className="legend" aria-label={`מקרא: ${MODE_LABEL[mode]}`}>
      {steps.map((s, i) => (
        <li key={s}>
          <i style={{ background: colors[i] }} />
          {i < steps.length - 1 ? `${lab(s)} עד ${lab(steps[i + 1])}` : `${lab(s)} ומעלה`}
        </li>
      ))}
      <li className="muted">גובה הפוליגון: תוספת יח"ד במימוש מקסימלי לחמש שנים</li>
    </ul>
  );
}

export function ApproxBanner() {
  return (
    <div className="state warn approx" role="status" data-testid="approx-banner">
      <b>גבולות משוערים</b>
      אין גאומטריה במסמכי המקור. הגבולות חושבו מנקודות רובע ב-OpenStreetMap, בתוך גבול התכנית הרשמי, ויוחלפו בשכבת הרובעים של ה-GIS העירוני.
    </div>
  );
}

export function DataErrorState({ errors }: { errors: string[] }) {
  return (
    <div className="wrap section">
      <div className="state bad" role="alert" data-testid="data-error">
        <b>שגיאה בקובץ הנתונים</b>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
    </div>
  );
}
