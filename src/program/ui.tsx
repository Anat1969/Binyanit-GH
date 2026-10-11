"use client";
import Link from "next/link";
import { ADDED_STEPS, HAREDI_STEPS, METERS_PER_UNIT, MODE_LABEL, RAMP_ADDED, RAMP_HAREDI, type MapMode } from "./ProgramMap";
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

export function RovaButtons({ current, compact }: { current?: string; compact?: boolean }) {
  return (
    <nav className={`rova-buttons${compact ? " compact" : ""}`} aria-label="רובעים">
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

/** Legend drawn on the map. Says what color, contour and height mean in the active mode. */
export function MapLegend({ mode }: { mode: MapMode }) {
  const contour = (
    <li>
      <i className="lg-dash" />
      גבול רובע (משוער)
    </li>
  );
  if (mode === "capacity") {
    return (
      <div className="stack-tight">
        <b className="lg-title">צבע: כושר נשיאה בכיתות יסודי</b>
        <ul className="legend" aria-label={`מקרא: ${MODE_LABEL[mode]}`}>
          {PROGRAM.meta.carrying_capacity_legend.map((l) => (
            <li key={l.key}>
              <i style={{ background: l.color, opacity: Math.max(l.opacity, 0.6), borderColor: l.stroke ?? undefined, borderStyle: l.stroke ? "dashed" : undefined, borderWidth: l.stroke ? 2 : undefined }} />
              {l.label}
            </li>
          ))}
          <li>
            <i style={{ background: NULL_STATUS.color, opacity: 0.6 }} />
            {NULL_STATUS.label} (תוספת קטנה מ-50 יח"ד)
          </li>
          {contour}
        </ul>
        <small className="muted">מתחת לשם: יתרה או גירעון בכיתות יסודי. מקרא המקור: עמ׳ 16.</small>
      </div>
    );
  }
  if (mode === "era") {
    const e = PROGRAM.meta.construction_era_legend;
    return (
      <div className="stack-tight">
        <b className="lg-title">שנת הקמה (מקרא בלבד, ללא שיוך לרובעים)</b>
        <ul className="legend" aria-label="מקרא שנות הקמה (ללא שיוך לרובעים)">
          {e.classes.map((c) => (
            <li key={c.label}>
              <i style={{ background: c.color }} />
              {c.label}
            </li>
          ))}
          {contour}
        </ul>
      </div>
    );
  }
  const added = mode === "added";
  const steps = added ? ADDED_STEPS : HAREDI_STEPS;
  const colors = added ? RAMP_ADDED : RAMP_HAREDI;
  const lab = (v: number) => (added ? v.toLocaleString("he-IL") : `${Math.round(v * 100)}%`);
  return (
    <div className="stack-tight">
      <b className="lg-title">{added ? 'גובה וגוון: תוספת יח"ד במימוש מקסימלי לחמש שנים' : "צבע: אחוז אוכלוסייה חרדית"}</b>
      <ul className="legend" aria-label={`מקרא: ${MODE_LABEL[mode]}`}>
        {steps.map((s, i) => (
          <li key={s}>
            <i style={{ background: colors[i] }} />
            {i < steps.length - 1 ? `${lab(s)} עד ${lab(steps[i + 1])}` : `${lab(s)} ומעלה`}
          </li>
        ))}
        {contour}
      </ul>
      {added && <small className="muted">הנפח עולה מגבול הרובע. 100 יח"ד = {100 * METERS_PER_UNIT} מ׳ גובה (קנה מידה חזותי בלבד).</small>}
    </div>
  );
}

/** Era mode: the source has no year per rova. */
export function EraNotice() {
  const e = PROGRAM.meta.construction_era_legend;
  return (
    <div className="state info" data-testid="era-empty">
      <b>אין נתון שנת הקמה לפי רובע בנתוני המקור</b>
      קובץ הנתונים כולל רק את מקרא שנות ההקמה ({e.source}), ללא שיוך לרובעים. לכן הרובעים מוצגים באפור.
    </div>
  );
}

export function ApproxBanner() {
  return (
    <div className="state note approx" role="status" data-testid="approx-banner">
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

export type TabDef = { id: string; label: string };

/** Topic switcher: one table group at a time, so the page stays short. */
export function Tabs({ tabs, active, onChange, label }: { tabs: TabDef[]; active: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="ptabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
