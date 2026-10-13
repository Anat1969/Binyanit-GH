"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type ColumnDef } from "@/program/DataTable";
import { downloadCsv, toCsv } from "@/program/csv";
import { PAGES, PROGRAM, capacityOf, fmt, type Rova } from "@/program/data";
import { CLASS_KEYS, CLASS_LABEL, COMMUNITY_KEYS, COMMUNITY_LABEL } from "@/program/labels";
import { MODE_LABEL, type MapMode } from "@/program/ProgramMap";
import { ApproxBanner, EraNotice, MapLegend, RovaButtons, SourceLink, StatusBadge, Tabs, statusOf, type TabDef } from "@/program/ui";

const ProgramMap = dynamic(() => import("@/program/ProgramMap"), { ssr: false, loading: () => <div className="pmap skeleton" style={{ height: 600 }} /> });

const P = PROGRAM;
const T = P.totals;
const M = P.meta.methodology;

const KPIS: { value: number; label: string; page: number; field: string }[] = [
  { value: T.existing_units_for_renewal, label: 'יח"ד קיימות להתחדשות', page: PAGES.capacity, field: "totals.existing_units_for_renewal" },
  { value: T.added_units_max_5y, label: 'תוספת במימוש מקסימלי לחמש שנים', page: PAGES.capacity, field: "totals.added_units_max_5y" },
  { value: T.added_units_realistic, label: 'תוספת במימוש ריאלי צפוי', page: PAGES.capacity, field: "totals.added_units_realistic" },
  { value: M.full_capacity_units, label: 'קיבולת במימוש מלא', page: PAGES.capacity, field: "meta.methodology.full_capacity_units" },
  { value: T.added_population_max_5y, label: "תושבים נוספים (מימוש מקסימלי)", page: PAGES.education, field: "totals.added_population_max_5y" },
  { value: T.children_max_5y, label: "ילדים בשנתון (מימוש מקסימלי)", page: PAGES.education, field: "totals.children_max_5y" },
];

type Row = {
  id: string;
  name: string;
  status: string;
  statusKey: string;
  existing: number;
  added: number;
  realistic: number;
  population: number;
  children: number;
  demand: number | undefined;
  supply: number | undefined;
  balance: number | undefined;
  threshold: string | undefined;
  viaGroup: boolean;
  rova: Rova;
};

const ROWS: Row[] = P.rovaim.map((r) => {
  const { cap, viaGroup } = capacityOf(r);
  const s = statusOf(r);
  return {
    id: r.id,
    name: r.name,
    status: s.label,
    statusKey: s.key ?? "null",
    existing: r.units_existing_for_renewal,
    added: r.added_max_5y,
    realistic: r.added_realistic,
    population: r.added_population,
    children: r.children,
    demand: cap?.demand,
    supply: cap?.supply,
    balance: cap?.balance,
    threshold: cap ? String(cap.min_threshold) : undefined,
    viaGroup: Boolean(viaGroup),
    rova: r,
  };
});

const num = (v: number | undefined) => <span className="num">{fmt(v)}</span>;

const TABS: TabDef[] = [
  { id: "compare", label: "השוואה בין רובעים" },
  { id: "education", label: "צורכי חינוך" },
  { id: "unused", label: "כיתות לא מנוצלות" },
  { id: "community", label: "קהילה, בריאות ודת" },
  { id: "summary", label: "סיכום ומסמכים" },
];

export default function ProgramClient() {
  const [mode, setMode] = useState<MapMode>("capacity");
  const [approx, setApprox] = useState(true);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("compare");

  const rows = useMemo(
    () => ROWS.filter((r) => (status === "all" || r.statusKey === status) && (!q.trim() || r.name.includes(q.trim()))),
    [status, q],
  );

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "name", header: "רובע", cell: (c) => <Link href={`/program/${c.row.original.id}`}>{c.row.original.name}</Link> },
      { accessorKey: "existing", header: 'יח"ד קיימות', cell: (c) => num(c.getValue() as number) },
      { accessorKey: "added", header: "תוספת מקסימלית", cell: (c) => num(c.getValue() as number) },
      { accessorKey: "realistic", header: "תוספת ריאלית", cell: (c) => num(c.getValue() as number) },
      { accessorKey: "population", header: "תושבים", cell: (c) => num(c.getValue() as number) },
      { accessorKey: "children", header: "ילדים", cell: (c) => num(c.getValue() as number) },
      { accessorKey: "demand", header: "כיתות יסודי נדרשות", cell: (c) => num(c.getValue() as number | undefined), sortUndefined: "last" },
      { accessorKey: "supply", header: "מענה", cell: (c) => num(c.getValue() as number | undefined), sortUndefined: "last" },
      {
        accessorKey: "balance",
        header: "יתרה / גירעון",
        sortUndefined: "last",
        cell: (c) => {
          const v = c.getValue() as number | undefined;
          return <span className={`num ${v != null && v < 0 ? "neg" : ""}`}>{fmt(v)}</span>;
        },
      },
      { accessorKey: "threshold", header: "סף מימוש", cell: (c) => (c.getValue() as string | undefined) ?? "—", sortUndefined: "last" },
      {
        accessorKey: "status",
        header: "סטטוס",
        cell: (c) => (
          <span className="stack-tight">
            <StatusBadge r={c.row.original.rova} />
            {c.row.original.viaGroup && <small className="muted">לפי קבוצת י'+י"א+י"ג</small>}
          </span>
        ),
      },
    ],
    [],
  );

  function exportCsv() {
    const headers = ["רובע", 'יח"ד קיימות', "תוספת מקסימלית", "תוספת ריאלית", "תושבים", "ילדים", "כיתות יסודי נדרשות", "מענה", "יתרה / גירעון", "סף מימוש", "סטטוס"];
    downloadCsv(
      "program-603-0972307.csv",
      toCsv(headers, rows.map((r) => [r.name, r.existing, r.added, r.realistic, r.population, r.children, r.demand, r.supply, r.balance, r.threshold, r.status])),
    );
  }

  type EduRow = { id: string; name: string } & Record<string, number | string | undefined>;
  const eduRows: EduRow[] = P.rovaim.map((r) => ({ id: r.id, name: r.name, added: r.added_max_5y, population: r.added_population, children: r.children, ...r.classes }));
  const eduCols: ColumnDef<EduRow, unknown>[] = [
    { accessorKey: "name", header: "רובע", cell: (c) => <Link href={`/program/${c.row.original.id}`}>{c.getValue() as string}</Link> },
    { accessorKey: "added", header: "תוספת יח\"ד", cell: (c) => num(c.getValue() as number) },
    { accessorKey: "children", header: "ילדים בשנתון", cell: (c) => num(c.getValue() as number) },
    ...CLASS_KEYS.map<ColumnDef<EduRow, unknown>>((k) => ({ accessorKey: k, header: CLASS_LABEL[k], sortUndefined: "last", cell: (c) => num(c.getValue() as number | undefined) })),
  ];
  const tc = T.education_classes_max_5y;

  type ComRow = { id: string; name: string; note?: string } & Record<string, number | string | undefined>;
  const comRows: ComRow[] = P.rovaim.map((r) => {
    const { _note, ...rest } = (r.community_sqm ?? {}) as Record<string, number | string>;
    return { id: r.id, name: r.name, note: typeof _note === "string" ? _note : undefined, ...rest };
  });
  const comCols: ColumnDef<ComRow, unknown>[] = [
    { accessorKey: "name", header: "רובע", cell: (c) => <Link href={`/program/${c.row.original.id}`}>{c.getValue() as string}</Link> },
    ...COMMUNITY_KEYS.map<ColumnDef<ComRow, unknown>>((k) => ({ accessorKey: k, header: `${COMMUNITY_LABEL[k]} (מ"ר)`, sortUndefined: "last", cell: (c) => num(c.getValue() as number | undefined) })),
    { accessorKey: "note", header: "הערה", sortUndefined: "last", cell: (c) => <small className="muted">{(c.getValue() as string | undefined) ?? ""}</small> },
  ];
  const tm = T.community_sqm_max_5y;

  type UnusedRow = { rova: string; classes: number; schools: string };
  const unusedCols: ColumnDef<UnusedRow, unknown>[] = [
    { accessorKey: "rova", header: "רובע" },
    { accessorKey: "classes", header: "מספר כיתות", cell: (c) => num(c.getValue() as number) },
    { accessorKey: "schools", header: "בתי הספר" },
  ];

  return (
    <div className="wrap program" style={{ paddingTop: 32, paddingBottom: 48 }}>
      <header className="stack">
        <div className="label">נספח פרוגרמה לצורכי ציבור וקיבולת · תכנית {P.meta.plan_number}</div>
        <h1 className="h2">באיזה רובע יש כושר נשיאה?</h1>
        <p className="lead" style={{ margin: 0 }}>{M.limiting_factor}</p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {P.meta.source_document}. {P.meta.approval}. <SourceLink page={1} label="עמוד השער" />
        </p>
      </header>

      <section aria-label="מספרי מפתח" className="kpis" data-testid="kpis">
        {KPIS.map((k) => (
          <div key={k.field} className="kpi" data-field={k.field}>
            <div className="kpi-v num">{fmt(k.value)}</div>
            <div className="kpi-l">{k.label}</div>
            <SourceLink page={k.page} label={`עמ׳ ${k.page}`} />
          </div>
        ))}
      </section>

      <details className="card disclosure">
        <summary>מתודולוגיה: איך חושבו המספרים</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <ul className="plain">
            <li><b>מימוש ריאלי צפוי ({fmt(M.realistic_scenario.units)} יח"ד):</b> {M.realistic_scenario.assumptions}</li>
            <li><b>מימוש מקסימלי לחמש שנים ({fmt(M.max_5_years.units)} יח"ד):</b> {M.max_5_years.assumptions}</li>
            <li><b>אוכלוסייה כללית:</b> משק בית {M.household.general.household_size}, שנתון {M.household.general.cohort_pct}%, {M.household.general.primary_years} שנות יסודי, {M.household.general.class_size} ילדים בכיתה.</li>
            <li><b>אוכלוסייה חרדית:</b> משק בית {M.household.haredi.household_size}, שנתון {M.household.haredi.cohort_pct}%, {M.household.haredi.primary_years} שנות יסודי, {M.household.haredi.class_size_boys} בנים / {M.household.haredi.class_size_girls} בנות בכיתה.</li>
            <li>{M.guide}. {M.threshold_note}.</li>
          </ul>
          <SourceLink page={PAGES.methodology} />
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{P.meta.data_status}</p>
        </div>
      </details>

      <section className="stack" aria-labelledby="map-title" style={{ marginTop: 28 }}>
        <h2 id="map-title" className="h3 sec-title">14 הרובעים</h2>
        <RovaButtons />
        <div className="row-between" style={{ marginTop: 8 }}>
          <h3 className="h3 sub-title">מפת הרובעים</h3>
          <div className="seg" role="group" aria-label="תצוגת המפה">
            {(Object.keys(MODE_LABEL) as MapMode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>
            ))}
          </div>
        </div>
        {mode === "era" && <EraNotice />}
        <ProgramMap mode={mode} onState={(_, a) => setApprox(a)} legend={<MapLegend mode={mode} />} />
        {approx && <ApproxBanner />}
        <SourceLink page={PAGES.carrying} label="מקרא כושר הנשיאה: עמ׳ 16" />
      </section>

      <section className="stack" aria-label="נתונים לפי נושא" style={{ marginTop: 32 }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} label="נושא" />

        {tab === "compare" && (
          <div className="stack" role="tabpanel" id="panel-compare" aria-labelledby="tab-compare">
            <div className="row-between">
              <h2 className="h3 sec-title">השוואה בין רובעים</h2>
              <button type="button" className="btn ghost small" onClick={exportCsv}>ייצוא CSV</button>
            </div>
            <div className="filters">
              <label className="field">
                <span>סטטוס</span>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} name="status-filter">
                  <option value="all">הכול</option>
                  {P.meta.carrying_capacity_legend.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                  <option value="null">ללא נתון</option>
                </select>
              </label>
              <label className="field">
                <span>חיפוש רובע</span>
                <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="לדוגמה: ג'" name="rova-search" />
              </label>
            </div>
            <DataTable data={rows} columns={columns} caption="השוואה בין רובעים" testId="cmp-table" empty="אין רובעים שעונים על הסינון"
              footer={rows.length === ROWS.length ? ["סה\"כ (עמ׳ 4, 14)", fmt(T.existing_units_for_renewal), fmt(T.added_units_max_5y), fmt(T.added_units_realistic), fmt(T.added_population_max_5y), fmt(T.children_max_5y), null, null, null, null, null] : undefined} />
            <div className="row-gap">
              <SourceLink page={PAGES.capacity} label="יח״ד: עמ׳ 4" />
              <SourceLink page={PAGES.education} label="תושבים וילדים: עמ׳ 14" />
              <SourceLink page={PAGES.carrying} label="כושר נשיאה: עמ׳ 16" />
            </div>
          </div>
        )}

        {tab === "education" && (
          <div className="stack" role="tabpanel" id="panel-education" aria-labelledby="tab-education">
            <h2 className="h3 sec-title">צורכי חינוך (מימוש מקסימלי לחמש שנים)</h2>
            <DataTable data={eduRows} columns={eduCols} caption="צורכי חינוך" testId="edu-table"
              footer={["סה\"כ", fmt(T.added_units_max_5y), fmt(T.children_max_5y), ...CLASS_KEYS.map((k) => fmt(tc[k]))]} />
            <SourceLink page={PAGES.education} />
          </div>
        )}

        {tab === "unused" && (
          <div className="stack" role="tabpanel" id="panel-unused" aria-labelledby="tab-unused">
            <h2 className="h3 sec-title">כיתות יסודי לא מנוצלות (מצבת תשפ"ג)</h2>
            <DataTable data={P.unused_classes_tashpag.rows} columns={unusedCols} caption="כיתות לא מנוצלות" testId="unused-table" />
            <SourceLink page={PAGES.unused} />
          </div>
        )}

        {tab === "community" && (
          <div className="stack" role="tabpanel" id="panel-community" aria-labelledby="tab-community">
            <h2 className="h3 sec-title">צורכי קהילה, בריאות ודת (מ"ר)</h2>
            <DataTable data={comRows} columns={comCols} caption="צורכי קהילה" testId="com-table"
              footer={["סה\"כ", ...COMMUNITY_KEYS.map((k) => fmt(tm[k])), null]} />
            <SourceLink page={PAGES.community} />
          </div>
        )}

        {tab === "summary" && (
          <div className="grid grid-2 eq" role="tabpanel" id="panel-summary" aria-labelledby="tab-summary">
            <div className="card stack" data-testid="program-summary">
              <h2 className="h3 sec-title">סיכום פרוגרמה</h2>
              <ul className="plain summary-list">{T.program_summary.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>{T.ground_floor_note}</p>
              <SourceLink page={PAGES.community} />
            </div>
            <div className="card stack" data-testid="program-docs">
              <h2 className="h3 sec-title">מסמכים</h2>
              <ul className="plain docs-list">
                {P.documents.map((d) => {
                  const href = d.href ?? d.url ?? null;
                  return (
                    <li key={d.id}>
                      <div>
                        <b>{d.title}</b>
                        {d.date && <span className="muted num"> · {d.date}</span>}
                        {d.note && <div className="muted" style={{ fontSize: 13 }}>{d.note}</div>}
                      </div>
                      {href ? (
                        <a className="btn ghost small" href={href} target="_blank" rel="noreferrer">פתיחה</a>
                      ) : (
                        <span className="chip warn">הקובץ טרם הועלה</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

