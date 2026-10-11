"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type ColumnDef } from "@/program/DataTable";
import {
  LOW_ADDITION_THRESHOLD,
  PAGES,
  PROGRAM,
  capacityOf,
  fmt,
  groupOf,
  pct,
  rovaIndex,
  rovaSlidePage,
  type Capacity,
  type Group,
  type Rova,
  type School,
} from "@/program/data";
import { ASSUMPTION_LABEL, CLASS_KEYS, CLASS_LABEL, COMMUNITY_KEYS, COMMUNITY_LABEL, POP_LABEL, UNITS_LABEL } from "@/program/labels";
import { ApproxBanner, MapLegend, RovaButtons, SourceLink, StatusBadge, Tabs, type TabDef } from "@/program/ui";

const ProgramMap = dynamic(() => import("@/program/ProgramMap"), { ssr: false, loading: () => <div className="pmap skeleton" style={{ height: 340 }} /> });

type KV = { key: string; label: string; value: number | string | null | undefined };
const kvCols: ColumnDef<KV, unknown>[] = [
  { accessorKey: "label", header: "פריט" },
  {
    accessorKey: "value",
    header: "ערך",
    sortUndefined: "last",
    cell: (c) => {
      const v = c.getValue();
      return <span className="num">{typeof v === "number" ? fmt(v) : (v as string | null | undefined) ?? "—"}</span>;
    },
  },
];

function kv(obj: Record<string, unknown> | undefined, labels: Record<string, string>): KV[] {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([k, v]) => !k.startsWith("_") && (typeof v === "number" || typeof v === "string"))
    .map(([k, v]) => ({ key: k, label: labels[k] ?? k, value: v as number | string }));
}

function CapacityCard({ cap, via, page }: { cap: Capacity; via: Group | null; page: number }) {
  return (
    <div className="card raised stack" data-testid="capacity-card">
      <div className="row-between">
        <h2 className="h3 sec-title">כושר נשיאה, כיתות יסודי</h2>
        {via && <span className="chip">מחושב לקבוצת {via.name}</span>}
      </div>
      <div className="cap-grid">
        <div><div className="kpi-l">נדרש לבניינית</div><div className="kpi-v num">{fmt(cap.demand)}</div></div>
        <div><div className="kpi-l">נדרש לתוכניות התחדשות</div><div className="kpi-v num">{fmt(cap.renewal_demand)}</div></div>
        <div><div className="kpi-l">סה"כ נדרש</div><div className="kpi-v num">{fmt(cap.total_demand)}</div></div>
        <div><div className="kpi-l">מענה</div><div className="kpi-v num">{fmt(cap.supply)}</div></div>
        <div><div className="kpi-l">יתרה / גירעון</div><div className={`kpi-v num ${cap.balance < 0 ? "neg" : ""}`}>{fmt(cap.balance)}</div></div>
        <div><div className="kpi-l">סף מימוש מיידי</div><div className="kpi-v num">{typeof cap.min_threshold === "number" ? `${fmt(cap.min_threshold)} יח"ד` : cap.min_threshold}</div></div>
      </div>
      <div>
        <div className="kpi-l">מענה מוצע</div>
        <p style={{ margin: 0 }}>{cap.proposed_solution ?? "לא צוין במקור"}</p>
      </div>
      {cap.added_units_in_table != null && <p className="muted" style={{ margin: 0, fontSize: 14 }}>תוספת יח"ד בטבלת כושר הנשיאה: {fmt(cap.added_units_in_table)}</p>}
      <SourceLink page={page} />
    </div>
  );
}

function Flags({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null;
  return (
    <div className="state warn" data-testid="data-flags">
      <b>פערים בנתוני המקור</b>
      <ul style={{ margin: 0, paddingInlineStart: 18 }}>{flags.map((f) => <li key={f}>{f}</li>)}</ul>
    </div>
  );
}

function Assumptions({ a }: { a: Record<string, unknown> | undefined }) {
  if (!a) return <p className="muted">אין הנחות יסוד במקור לרובע זה.</p>;
  if ("general" in a || "haredi" in a) {
    type R = { pop: string; renewal?: number; binyanit?: number; household?: number; cohort_pct?: number; cohort_size?: number };
    const rs = a.renewal_split as Record<string, number> | undefined;
    const bs = a.binyanit_split as Record<string, number> | undefined;
    const rows: R[] = (["general", "haredi"] as const).map((k) => {
      const g = a[k] as { household: number; cohort_pct: number; cohort_size: number } | undefined;
      return { pop: POP_LABEL[k], renewal: rs?.[k], binyanit: bs?.[k], household: g?.household, cohort_pct: g?.cohort_pct, cohort_size: g?.cohort_size };
    });
    const cols: ColumnDef<R, unknown>[] = [
      { accessorKey: "pop", header: "אוכלוסייה" },
      { accessorKey: "renewal", header: 'יח"ד בהתחדשות', sortUndefined: "last", cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
      { accessorKey: "binyanit", header: 'יח"ד בבניינית', sortUndefined: "last", cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
      { accessorKey: "household", header: "גודל משק בית", sortUndefined: "last", cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
      { accessorKey: "cohort_pct", header: "אחוז שנתון", sortUndefined: "last", cell: (c) => <span className="num">{c.getValue() == null ? "—" : `${c.getValue()}%`}</span> },
      { accessorKey: "cohort_size", header: "גודל שנתון חינוך", sortUndefined: "last", cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
    ];
    return <DataTable data={rows} columns={cols} caption="הנחות יסוד" testId="assumptions-table" />;
  }
  const rows = kv(a as Record<string, unknown>, ASSUMPTION_LABEL).map((r) => (r.key === "cohort_pct" ? { ...r, value: `${r.value}%` } : r));
  return <DataTable data={rows} columns={kvCols} caption="הנחות יסוד" testId="assumptions-table" />;
}

function PrimaryDemand({ d }: { d: Rova["primary_demand"] }) {
  if (!d) return <p className="muted">אין דרישה פרוגרמטית במקור לרובע זה.</p>;
  if (d.general || d.haredi_boys || d.haredi_girls) {
    type R = { pop: string; renewal_plans?: number; binyanit?: number };
    const rows: R[] = [
      { pop: "כללי", ...d.general },
      { pop: "חרדי בנים", ...d.haredi_boys },
      { pop: "חרדי בנות", ...d.haredi_girls },
    ];
    const cols: ColumnDef<R, unknown>[] = [
      { accessorKey: "pop", header: "פלח" },
      { accessorKey: "renewal_plans", header: "עבור תוכניות התחדשות", sortUndefined: "last", cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
      { accessorKey: "binyanit", header: "עבור בניינית", sortUndefined: "last", cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
    ];
    return (
      <DataTable data={rows} columns={cols} caption="דרישה פרוגרמטית לכיתות יסודי" testId="demand-table"
        footer={["סה\"כ", fmt(d.renewal_plans), fmt(d.binyanit)]} />
    );
  }
  const rows: KV[] = [
    { key: "renewal_plans", label: "עבור תוכניות התחדשות", value: d.renewal_plans },
    { key: "binyanit", label: "עבור בניינית", value: d.binyanit },
    { key: "total", label: 'סה"כ כיתות יסודי נדרשות', value: d.total },
  ];
  return <DataTable data={rows} columns={kvCols} caption="דרישה פרוגרמטית לכיתות יסודי" testId="demand-table" />;
}

const schoolCols: ColumnDef<School, unknown>[] = [
  { accessorKey: "name", header: "בית ספר" },
  ...(["home_classes", "occupancy", "special_ed", "free", "new_wing_potential"] as const).map<ColumnDef<School, unknown>>((k) => ({
    accessorKey: k,
    header: { home_classes: "כיתות אם", occupancy: "תפוסה תשפ\"ה", special_ed: "חנ\"מ בנוסף לכיתות אם", free: "כיתות פנויות", new_wing_potential: "פוטנציאל אגף חדש" }[k],
    sortUndefined: "last",
    cell: (c) => <span className="num">{fmt(c.getValue() as number | null | undefined)}</span>,
  })),
];

type NamedNum = { name: string; value: number };
const namedCols = (h: string, v: string): ColumnDef<NamedNum, unknown>[] => [
  { accessorKey: "name", header: h },
  { accessorKey: "value", header: v, cell: (c) => <span className="num">{fmt(c.getValue() as number)}</span> },
];

function CommunityTable({ c, testId }: { c: Record<string, number | string> | undefined; testId: string }) {
  const note = typeof c?._note === "string" ? c._note : null;
  const rows = kv(c, COMMUNITY_LABEL).map((r) => ({ ...r, label: `${r.label} (מ"ר)` }));
  return (
    <div className="stack">
      {rows.length > 0 ? <DataTable data={rows} columns={kvCols} caption="צורכי קהילה במ״ר" testId={testId} /> : <p className="muted" style={{ margin: 0 }}>אין שטחים מוקצים לרובע עצמו.</p>}
      {note && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{note}</p>}
    </div>
  );
}

function Section({ title, page, children, id }: { title: string; page?: number | null; children: React.ReactNode; id: string }) {
  return (
    <section className="card stack" aria-labelledby={id}>
      <h2 id={id} className="h3 sec-title">{title}</h2>
      {children}
      {page ? <SourceLink page={page} /> : null}
    </section>
  );
}

function GroupBlock({ g }: { g: Group }) {
  return (
    <section className="stack" aria-labelledby="grp-title" data-testid="group-block">
      <div className="label">קבוצת רובעים</div>
      <h2 id="grp-title" className="h2">{g.name}</h2>
      <p className="lead" style={{ margin: 0 }}>{g.summary}</p>
      <Flags flags={g.data_flags} />
      <div className="grid grid-2 eq">
        <Section title="יחידות דיור (קבוצה)" page={13} id="g-units">
          <DataTable data={kv(g.units, UNITS_LABEL)} columns={kvCols} caption="יחידות דיור בקבוצה" testId="group-units" />
        </Section>
        <Section title="הנחות יסוד (קבוצה)" page={13} id="g-ass">
          <Assumptions a={g.assumptions} />
        </Section>
        <Section title="דרישה פרוגרמטית (קבוצה)" page={13} id="g-dem">
          <PrimaryDemand d={g.primary_demand} />
        </Section>
        <Section title="פוטנציאל תוספת כיתות יסודי (קבוצה)" page={13} id="g-pot">
          <DataTable data={kv(g.potential, { binyanit: "בניינית", renewal: "תוכניות התחדשות", total: "סה\"כ" })} columns={kvCols} caption="פוטנציאל" testId="group-potential" />
        </Section>
        <Section title="צורכי קהילה (קבוצה)" page={PAGES.community} id="g-com">
          <CommunityTable c={g.community_sqm} testId="group-community" />
        </Section>
      </div>
    </section>
  );
}

export default function RovaClient({ id }: { id: string }) {
  const [approx, setApprox] = useState(true);
  const [tab, setTab] = useState("overview");
  const i = rovaIndex(id);
  const r = PROGRAM.rovaim[i];
  const prev = PROGRAM.rovaim[(i - 1 + PROGRAM.rovaim.length) % PROGRAM.rovaim.length];
  const next = PROGRAM.rovaim[(i + 1) % PROGRAM.rovaim.length];
  const { cap, viaGroup } = capacityOf(r);
  const g = groupOf(r);
  const slide = rovaSlidePage(r);
  const low = r.added_max_5y < LOW_ADDITION_THRESHOLD;
  const summary = r.summary ?? g?.summary ?? null;

  const hasEducation = Boolean(r.assumptions || r.primary_demand || r.schools || r.renewal_projects || r.new_schools_proposed);
  const tabs: TabDef[] = [
    { id: "overview", label: "נתוני בסיס וכיתות" },
    ...(hasEducation ? [{ id: "education", label: "חינוך: דרישה ובתי ספר" }] : []),
    { id: "community", label: "קהילה, בריאות ודת" },
    ...(g ? [{ id: "group", label: `קבוצת ${g.name}` }] : []),
  ];

  const classRows: KV[] = CLASS_KEYS.filter((k) => r.classes[k] != null).map((k) => ({ key: k, label: CLASS_LABEL[k], value: r.classes[k] }));
  const basics: KV[] = [
    { key: "existing", label: 'יח"ד קיימות להתחדשות', value: r.units_existing_for_renewal },
    { key: "added", label: 'תוספת במימוש מקסימלי לחמש שנים', value: r.added_max_5y },
    { key: "realistic", label: "תוספת במימוש ריאלי צפוי", value: r.added_realistic },
    { key: "population", label: "תוספת אוכלוסייה", value: r.added_population },
    { key: "children", label: "ילדים בשנתון", value: r.children },
    { key: "general", label: "אחוז אוכלוסייה כללית", value: pct(r.pop_general) },
    { key: "haredi", label: "אחוז אוכלוסייה חרדית", value: pct(r.pop_haredi) },
  ];

  return (
    <div className="wrap program" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <nav className="row-between crumbs" aria-label="ניווט בין רובעים">
        <Link href="/program">כל הרובעים</Link>
        <div className="row-gap">
          <Link className="btn ghost small" href={`/program/${prev.id}`} data-testid="prev">הקודם: {prev.name}</Link>
          <Link className="btn ghost small" href={`/program/${next.id}`} data-testid="next">הבא: {next.name}</Link>
        </div>
      </nav>
      <div style={{ marginTop: 12 }}>
        <RovaButtons current={r.id} compact />
      </div>

      <header className="stack" style={{ marginTop: 20 }}>
        <div className="label">צורכי ציבור וקיבולת</div>
        <div className="row-between">
          <h1 className="h2">{r.name}</h1>
          <StatusBadge r={r} />
        </div>
        {summary && <p className="lead" style={{ margin: 0 }} data-testid="rova-summary">{summary}{!r.summary && g ? ` (סיכום הקבוצה ${g.name})` : ""}</p>}
        <div className="row-gap">
          {slide && <SourceLink page={slide} label={`פתח בעמוד ${slide} של הנספח`} />}
          <SourceLink page={PAGES.capacity} label="עמ׳ 4" />
          <SourceLink page={PAGES.education} label="עמ׳ 14" />
          <SourceLink page={PAGES.community} label="עמ׳ 15" />
          {cap && <SourceLink page={PAGES.carrying} label="עמ׳ 16" />}
        </div>
      </header>

      <Flags flags={r.data_flags} />

      {low && (
        <div className="state info" data-testid="low-empty">
          <b>תוספת מתחת ל-{LOW_ADDITION_THRESHOLD} יח"ד</b>
          {PROGRAM.meta.methodology.threshold_note}. מוצגים נתוני הבסיס בלבד.
        </div>
      )}

      <div className="grid grid-2 eq" style={{ marginTop: 16 }}>
        {cap ? (
          <CapacityCard cap={cap} via={viaGroup} page={PAGES.carrying} />
        ) : (
          <div className="card stack" data-testid="capacity-empty">
            <h2 className="h3">כושר נשיאה</h2>
            <p className="muted" style={{ margin: 0 }}>אין נתון כושר נשיאה לרובע זה. {PROGRAM.meta.methodology.threshold_note}.</p>
          </div>
        )}
        <div className="map-col">
          <ProgramMap mode="capacity" focusId={r.id} height={340} fill onState={(_, a) => setApprox(a)} legend={<MapLegend mode="capacity" />} />
          {approx && <ApproxBanner />}
        </div>
      </div>

      <section className="stack" aria-label="נתוני הרובע לפי נושא" style={{ marginTop: 28 }}>
        <Tabs tabs={tabs} active={tab} onChange={setTab} label="נושא" />

        {tab === "overview" && (
          <div className="grid grid-2 eq" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
            <Section title="נתוני בסיס" page={PAGES.capacity} id="basics">
              <DataTable data={basics} columns={kvCols} caption="נתוני בסיס" testId="basics-table" />
            </Section>
            <Section title="כיתות נדרשות לפי סוג (מימוש מקסימלי)" page={PAGES.education} id="classes">
              {classRows.length ? <DataTable data={classRows} columns={kvCols} caption="כיתות נדרשות" testId="classes-table" /> : <p className="muted" style={{ margin: 0 }}>אין כיתות נדרשות במקור לרובע זה.</p>}
            </Section>
            {r.units && (
              <Section title="יחידות דיור" page={slide} id="units">
                <DataTable data={kv(r.units, UNITS_LABEL)} columns={kvCols} caption="יחידות דיור" testId="units-table" />
              </Section>
            )}
            {r.potential && (
              <Section title="פוטנציאל תוספת כיתות יסודי" page={slide} id="potential">
                <DataTable data={kv(r.potential, { binyanit: "בניינית", renewal: "תוכניות התחדשות", total: "סה\"כ", binyanit_note: "הערה" })} columns={kvCols} caption="פוטנציאל" testId="potential-table" />
              </Section>
            )}
          </div>
        )}

        {tab === "education" && (
          <div className="grid grid-2 eq" role="tabpanel" id="panel-education" aria-labelledby="tab-education">
            {r.assumptions && (
              <Section title="הנחות יסוד" page={slide} id="ass">
                <Assumptions a={r.assumptions} />
              </Section>
            )}
            {r.primary_demand && (
              <Section title="דרישה פרוגרמטית לכיתות יסודי" page={slide} id="dem">
                <PrimaryDemand d={r.primary_demand} />
              </Section>
            )}
            {r.schools && (
              <Section title="בתי ספר יסודיים קיימים" page={slide} id="schools">
                <DataTable data={r.schools} columns={schoolCols} caption="בתי ספר קיימים" testId="schools-table" />
              </Section>
            )}
            {r.renewal_projects && (
              <Section title='פרויקטי התחדשות (יח"ד תוספתיות)' page={slide} id="renewal">
                <DataTable data={r.renewal_projects.map((p) => ({ name: p.name, value: p.added_units }))} columns={namedCols("פרויקט", 'יח"ד תוספתיות')} caption="פרויקטי התחדשות" testId="renewal-table" />
              </Section>
            )}
            {r.new_schools_proposed && (
              <Section title="בתי ספר יסודיים מוצעים" page={slide} id="newschools">
                <DataTable data={r.new_schools_proposed.map((p) => ({ name: p.name, value: p.classes }))} columns={namedCols("בית ספר", "כיתות")} caption="בתי ספר מוצעים" testId="newschools-table" />
              </Section>
            )}
          </div>
        )}

        {tab === "community" && (
          <div role="tabpanel" id="panel-community" aria-labelledby="tab-community">
            <Section title="צורכי קהילה, בריאות ודת" page={PAGES.community} id="community">
              <CommunityTable c={r.community_sqm} testId="community-table" />
            </Section>
          </div>
        )}

        {tab === "group" && g && (
          <div role="tabpanel" id="panel-group" aria-labelledby="tab-group">
            <GroupBlock g={g} />
          </div>
        )}
      </section>
    </div>
  );
}
