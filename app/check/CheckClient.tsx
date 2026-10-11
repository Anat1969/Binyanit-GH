"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { InputError, computePotential, type BuildingInput, type PotentialReport, type SiteContext, type StreetClass } from "@/engine";
import { QUARTERS, STREET_CLASS_LABEL } from "@/content/plan-meta";
import { RouteCard } from "@/components/RouteCard";
import { ReportSheet } from "@/components/ReportSheet";
import { summarize } from "@/lib/summary";
import { downloadPdf } from "@/lib/pdf";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="map skeleton" />,
});

type GeoResult = { label: string; lat: number; lon: number };
type Lookup = {
  loaded: string[];
  in_plan: boolean | null;
  street_class: StreetClass | null;
  public_allocation_zone: boolean | null;
  urban_renewal_search_zone: boolean | null;
  well_radius: boolean | null;
  special_guidelines?: boolean | null;
  nearest_well_m?: number | null;
  quarter: string | null;
  quarter_quota: { threshold: number; used: number | null } | null;
};
type Counter = { quarter: string; threshold: number | null; units_used: number | null };

const EMPTY_FORM = {
  existingFloors: "",
  existingUnits: "",
  typicalFloorArea: "",
  plotArea: "",
  frontageLength: "",
  groundFloor: "pilotis" as "built" | "pilotis",
  retrofitNeeded: true,
  protectedSpaces: "none" as "none" | "partial" | "full",
  residential: true,
  activeGroundUses: false,
  relocateGroundFloorUnits: false,
  newWing: false,
  publicEducation: "none" as "none" | "kindergarten2" | "daycare3",
  slatedForDemolition: false,
  approvedPinuiBinui: false,
  tama38Transition: false,
};

function Seg<T extends string | boolean>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
  label: string;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={String(o.v)} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SiteValue({ loaded, children }: { loaded: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {children}
      <span className={`chip ${loaded ? "ok" : "warn"}`}>{loaded ? "מהתשריט" : "ידני"}</span>
    </span>
  );
}

export default function CheckClient() {
  const [query, setQuery] = useState("");
  const [geo, setGeo] = useState<{ state: "idle" | "loading" | "results" | "empty" | "error"; results: GeoResult[]; error?: string }>({
    state: "idle",
    results: [],
  });
  const [point, setPoint] = useState<{ lat: number; lon: number; label: string | null } | null>(null);
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" | "done" | "error"; data: Lookup | null }>({ state: "idle", data: null });
  const [manualSite, setManualSite] = useState(false);
  const [manual, setManual] = useState({ streetClass: "cityWide" as StreetClass, publicZone: false, searchZone: false, wellRadius: false, quarter: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [report, setReport] = useState<PotentialReport | null>(null);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [llm, setLlm] = useState(false);
  const [explain, setExplain] = useState<{ state: "idle" | "loading" | "done" | "error"; text?: string }>({ state: "idle" });
  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");
  const sheetRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((d) => setLlm(Boolean(d.llm))).catch(() => setLlm(false));
    fetch("/api/quarters").then((r) => (r.ok ? r.json() : [])).then((d) => setCounters(Array.isArray(d) ? d : [])).catch(() => setCounters([]));
  }, []);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setReport(null);
  };

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) {
      setGeo({ state: "error", results: [], error: "יש להזין רחוב ומספר בית" });
      return;
    }
    setGeo({ state: "loading", results: [] });
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) return setGeo({ state: "error", results: [], error: data.error });
      if (!data.results.length) return setGeo({ state: "empty", results: [] });
      setGeo({ state: "results", results: data.results });
      if (data.results.length === 1) pick(data.results[0].lat, data.results[0].lon, data.results[0].label);
    } catch {
      setGeo({ state: "error", results: [], error: "אין חיבור לשירות האיתור. אפשר לסמן מיקום על המפה." });
    }
  }

  async function pick(lat: number, lon: number, label: string | null) {
    setPoint({ lat, lon, label });
    setReport(null);
    setLookup({ state: "loading", data: null });
    try {
      const res = await fetch(`/api/lookup?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Lookup;
      setLookup({ state: "done", data });
      setManualSite(false);
      if (data.quarter) setManual((m) => ({ ...m, quarter: data.quarter! }));
    } catch {
      setLookup({ state: "error", data: null });
      setManualSite(true);
    }
  }

  const L = lookup.data;
  const has = (k: string) => Boolean(L?.loaded?.includes(k));
  const quarter = L?.quarter ?? (manual.quarter || null);
  const counter = counters.find((c) => c.quarter === quarter);
  const sg = has("special_guidelines") ? Boolean(L?.special_guidelines) : null;
  const zoneFromMap = (kind: string) => has(kind) || sg === false;
  const site: SiteContext = {
    inPlan: L?.in_plan ?? null,
    streetClass: (has("street_class") && L?.street_class) || manual.streetClass,
    publicAllocationZone: has("public_allocation_zone") ? Boolean(L?.public_allocation_zone) : sg === false ? false : manual.publicZone,
    urbanRenewalSearchZone: has("urban_renewal_search_zone") ? Boolean(L?.urban_renewal_search_zone) : sg === false ? false : manual.searchZone,
    wellRadius: has("well_radius") || has("building_restriction") ? Boolean(L?.well_radius) : manual.wellRadius,
    quarter,
    quarterQuota: L?.quarter_quota ?? (counter?.threshold != null ? { threshold: counter.threshold, used: counter.units_used } : null),
  };
  const outOfPlan = site.inPlan === false;
  const siteReady = lookup.state === "done" || manualSite;

  function building(): BuildingInput {
    const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
    return {
      existingFloors: n(form.existingFloors),
      existingUnits: form.residential ? n(form.existingUnits) : Number.isNaN(n(form.existingUnits)) ? 0 : n(form.existingUnits),
      typicalFloorArea: n(form.typicalFloorArea),
      plotArea: n(form.plotArea),
      frontageLength: form.frontageLength.trim() === "" ? null : n(form.frontageLength),
      groundFloor: form.groundFloor,
      retrofitNeeded: form.retrofitNeeded,
      protectedSpaces: form.protectedSpaces,
      residential: form.residential,
      activeGroundUses: form.activeGroundUses,
      relocateGroundFloorUnits: form.relocateGroundFloorUnits,
      newWing: form.newWing,
      publicEducation: form.publicEducation,
      exclusions: {
        slatedForDemolition: form.slatedForDemolition,
        approvedPinuiBinui: form.approvedPinuiBinui,
        tama38Transition: form.tama38Transition,
      },
    };
  }

  function compute(e: React.FormEvent) {
    e.preventDefault();
    setExplain({ state: "idle" });
    try {
      const rep = computePotential(building(), site);
      setErrors([]);
      setReport(rep);
      fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarter: site.quarter,
          in_plan: site.inPlan,
          street_class: site.streetClass,
          existing_floors: rep.input.existingFloors,
          existing_units: rep.input.existingUnits,
          eligible_routes: rep.routes.filter((r) => r.eligible).map((r) => r.route),
        }),
      }).catch(() => undefined);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setReport(null);
      setErrors(err instanceof InputError ? err.message.split("; ") : ["שגיאה בחישוב. נא לבדוק את הנתונים."]);
    }
  }

  async function onPdf() {
    if (!sheetRef.current || !report) return;
    setPdfState("working");
    try {
      await downloadPdf(sheetRef.current, `potential-603-0972307-${Date.now()}.pdf`);
      setPdfState("idle");
    } catch {
      setPdfState("error");
    }
  }

  async function onExplain() {
    if (!report) return;
    setExplain({ state: "loading" });
    try {
      const res = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
      const d = await res.json();
      if (!res.ok || !d.text) throw new Error();
      setExplain({ state: "done", text: d.text });
    } catch {
      setExplain({ state: "error" });
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 32 }}>
      <div className="stack" style={{ marginBottom: 24 }}>
        <div className="label">בדיקת כתובת</div>
        <h1 className="h2">מה אפשר לעשות בבניין?</h1>
        <p className="lead" style={{ margin: 0 }}>
          שלושה שלבים: מיקום, נתוני הבניין, ותוצאה לשלושת המסלולים עם הפניה לסעיפי התכנית.
        </p>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card stack" aria-labelledby="s1">
          <div className="label">שלב 1</div>
          <h2 id="s1" className="h3">מיקום</h2>
          <form onSubmit={search} className="stack" role="search">
            <label className="field">
              <span>כתובת באשדוד</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="לדוגמה: רוגוזין 20"
                  aria-label="כתובת"
                  name="address"
                />
                <button className="btn" type="submit" disabled={geo.state === "loading"} style={{ flex: "0 0 auto" }}>
                  {geo.state === "loading" ? "מאתר" : "איתור"}
                </button>
              </div>
            </label>
          </form>
          {geo.state === "loading" && <div className="skeleton" style={{ height: 44 }} aria-label="טוען" />}
          {geo.state === "empty" && (
            <div className="state warn">
              <b>הכתובת לא נמצאה</b>
              אפשר לנסות ניסוח אחר או לסמן את הבניין על המפה.
            </div>
          )}
          {geo.state === "error" && (
            <div className="state bad" role="alert">
              <b>לא ניתן לאתר את הכתובת</b>
              {geo.error}
            </div>
          )}
          {geo.state === "results" && geo.results.length > 1 && (
            <ul className="results-list" aria-label="תוצאות חיפוש">
              {geo.results.map((r, i) => (
                <li key={i}>
                  <button type="button" onClick={() => pick(r.lat, r.lon, r.label)}>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <MapView point={point} onPick={(lat, lon) => pick(lat, lon, null)} />
          {point && <small className="muted">האיתור מדויק לרמת הרחוב. לדיוק אפשר ללחוץ על הבניין במפה.</small>}
          {!point && (
            <button type="button" className="btn ghost small" onClick={() => { setManualSite(true); setLookup({ state: "idle", data: null }); }}>
              המשך ללא כתובת
            </button>
          )}
        </section>

        <section className="card stack" aria-labelledby="site" data-testid="site-panel">
          <div className="label">נתוני תשריט</div>
          <h2 id="site" className="h3">המגרש לפי התכנית</h2>
          {point && (
            <p className="muted num" style={{ margin: 0, fontSize: 13 }}>
              {point.label ?? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`}
            </p>
          )}
          {lookup.state === "idle" && !manualSite && <p className="muted">יש לאתר כתובת או לסמן מיקום על המפה.</p>}
          {lookup.state === "loading" && (
            <div className="stack" aria-label="טוען">
              <div className="skeleton" style={{ height: 22 }} />
              <div className="skeleton" style={{ height: 22 }} />
              <div className="skeleton" style={{ height: 22 }} />
            </div>
          )}
          {lookup.state === "error" && (
            <div className="state warn" role="alert">
              <b>הבדיקה המרחבית אינה זמינה כרגע</b>
              אפשר להזין את נתוני התשריט ידנית.
            </div>
          )}
          {outOfPlan && (
            <div className="state bad" role="alert" data-testid="out-of-plan">
              <b>הכתובת מחוץ לגבול התכנית</b>
              התכנית אינה חלה על מגרש זה. לבירור אפשרויות אחרות יש לפנות למחלקת התכנון בעירייה.
            </div>
          )}
          {siteReady && site.inPlan === null && (
            <div className="state info">
              <b>גבול התכנית טרם אומת</b>
              שכבות התשריט עדיין לא נטענו במלואן. נתונים שלא נמצאו מסומנים "ידני" וניתנים לבחירה.
            </div>
          )}
          {siteReady && (
            <div>
              <div className="site-row">
                <span className="k">סיווג רחוב</span>
                {has("street_class") ? (
                  <SiteValue loaded>{STREET_CLASS_LABEL[site.streetClass]}</SiteValue>
                ) : (
                  <SiteValue loaded={false}>
                    <select
                      className="select"
                      style={{ minHeight: 40, width: "auto" }}
                      aria-label="סיווג רחוב"
                      value={manual.streetClass}
                      onChange={(e) => { setManual({ ...manual, streetClass: e.target.value as StreetClass }); setReport(null); }}
                    >
                      {Object.entries(STREET_CLASS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </SiteValue>
                )}
              </div>
              {(
                [
                  ["public_allocation_zone", "הנחיות מיוחדות (הקצאה לציבור)", "publicZone", site.publicAllocationZone],
                  ["urban_renewal_search_zone", "הנחיות מיוחדות ב׳ (חיפוש התחדשות)", "searchZone", site.urbanRenewalSearchZone],
                  ["well_radius", "רדיוס מגן קידוח (גבול מגבלות בנייה)", "wellRadius", site.wellRadius],
                ] as const
              ).map(([kind, label, key, val]) => (
                <div className="site-row" key={kind}>
                  <span className="k">{label}</span>
                  {(kind === "well_radius" ? has("well_radius") || has("building_restriction") : zoneFromMap(kind)) ? (
                    <SiteValue loaded>{val ? "כן" : "לא"}</SiteValue>
                  ) : (
                    <SiteValue loaded={false}>
                      <label className="check" style={{ minHeight: 0 }}>
                        <input type="checkbox" checked={manual[key]} onChange={(e) => { setManual({ ...manual, [key]: e.target.checked }); setReport(null); }} />
                        כן
                      </label>
                    </SiteValue>
                  )}
                </div>
              ))}
              {sg && (
                <div className="state warn" data-testid="special-guidelines">
                  <b>המגרש בתחום "הנחיות מיוחדות" לפי התשריט</b>
                  התשריט אינו מבחין בין הקצאה לצרכי ציבור לבין הנחיות מיוחדות ב׳. יש לבדוק בהוראות איזו הנחיה חלה ולסמן למעלה.
                </div>
              )}
              {L?.nearest_well_m != null && (
                <div className="site-row">
                  <span className="k">אתר קידוח קרוב</span>
                  <span className="num">{L.nearest_well_m.toLocaleString("he-IL")} מ׳</span>
                </div>
              )}
              <div className="site-row">
                <span className="k">רובע</span>
                {L?.quarter ? (
                  <SiteValue loaded>{L.quarter}</SiteValue>
                ) : (
                  <SiteValue loaded={false}>
                    <select className="select" style={{ minHeight: 40, width: "auto" }} aria-label="רובע" value={manual.quarter} onChange={(e) => { setManual({ ...manual, quarter: e.target.value }); setReport(null); }}>
                      <option value="">לא ידוע</option>
                      {QUARTERS.map((q) => (
                        <option key={q} value={q}>רובע {q}</option>
                      ))}
                    </select>
                  </SiteValue>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <form className="card stack" style={{ marginTop: 16 }} onSubmit={compute} aria-labelledby="s2" noValidate>
        <div className="label">שלב 2</div>
        <h2 id="s2" className="h3">נתוני הבניין הקיים</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>בשלב זה הנתונים מוזנים ידנית, לפי היתר הבנייה או מדידה.</p>
        <div className="grid grid-4">
          {(
            [
              ["existingFloors", "קומות קיימות", "ללא קומת עמודים"],
              ["existingUnits", 'יח"ד קיימות', ""],
              ["typicalFloorArea", 'שטח קומה טיפוסית (מ"ר)', ""],
              ["plotArea", 'שטח מגרש (מ"ר)', ""],
              ["frontageLength", "אורך חזית המגרש (מ׳)", "רשות. משפיע על פטור מהקצאה"],
            ] as const
          ).map(([k, label, hint]) => (
            <label className="field" key={k}>
              <span>{label}</span>
              <input
                className="input num"
                inputMode="decimal"
                name={k}
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                aria-invalid={errors.length > 0 && k !== "frontageLength" && form[k] === "" ? true : undefined}
              />
              {hint && <small>{hint}</small>}
            </label>
          ))}
        </div>
        <div className="grid grid-4">
          <Seg label="קומת קרקע" value={form.groundFloor} onChange={(v) => set("groundFloor", v)} options={[{ v: "built", label: "בנויה (50% ומעלה)" }, { v: "pilotis", label: "קומת עמודים" }]} />
          <Seg label="טעון חיזוק לרעידות אדמה" value={form.retrofitNeeded} onChange={(v) => set("retrofitNeeded", v)} options={[{ v: true, label: "כן" }, { v: false, label: "לא" }]} />
          <Seg label="מרחבים מוגנים" value={form.protectedSpaces} onChange={(v) => set("protectedSpaces", v)} options={[{ v: "none", label: "אין" }, { v: "partial", label: "חלקי (עד 50%)" }, { v: "full", label: "מלא" }]} />
          <Seg label="שימוש" value={form.residential} onChange={(v) => set("residential", v)} options={[{ v: true, label: "מגורים" }, { v: false, label: "אחר" }]} />
        </div>
        <details>
          <summary style={{ cursor: "pointer" }}>פרטי פרויקט וחריגים</summary>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div className="stack">
              <label className="check"><input type="checkbox" checked={form.activeGroundUses} onChange={(e) => set("activeGroundUses", e.target.checked)} />הפרויקט כולל שימושים פעילים בקומת הקרקע</label>
              {Number(form.existingFloors) >= 6 && (
                <label className="check"><input type="checkbox" checked={form.relocateGroundFloorUnits} onChange={(e) => set("relocateGroundFloorUnits", e.target.checked)} />העתקת יח"ד מקומת הקרקע</label>
              )}
              <label className="check"><input type="checkbox" checked={form.newWing} onChange={(e) => set("newWing", e.target.checked)} />הפרויקט כולל אגף חדש</label>
              <label className="field">
                <span>מבני ציבור בפרויקט הריסה ובנייה</span>
                <select className="select" value={form.publicEducation} onChange={(e) => set("publicEducation", e.target.value as typeof form.publicEducation)}>
                  <option value="none">ללא</option>
                  <option value="kindergarten2">2 כיתות גן</option>
                  <option value="daycare3">3 כיתות מעון</option>
                </select>
              </label>
            </div>
            <div className="stack">
              <div className="label">חריגים</div>
              <label className="check"><input type="checkbox" checked={form.slatedForDemolition} onChange={(e) => set("slatedForDemolition", e.target.checked)} />המבנה מיועד להריסה</label>
              <label className="check"><input type="checkbox" checked={form.approvedPinuiBinui} onChange={(e) => set("approvedPinuiBinui", e.target.checked)} />חלה תכנית פינוי-בינוי מאושרת</label>
              <label className="check"><input type="checkbox" checked={form.tama38Transition} onChange={(e) => set("tama38Transition", e.target.checked)} />בקשה בהליך לפי תמ"א 38 (הוראות מעבר)</label>
            </div>
          </div>
        </details>
        {errors.length > 0 && (
          <div className="state bad" role="alert" data-testid="form-errors">
            <b>יש להשלים את הנתונים</b>
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <div>
          <button className="btn" type="submit" disabled={outOfPlan}>חישוב פוטנציאל</button>
          {outOfPlan && <span className="muted" style={{ marginInlineStart: 12, fontSize: 14 }}>החישוב אינו זמין מחוץ לגבול התכנית</span>}
        </div>
      </form>

      <div ref={resultsRef} style={{ scrollMarginTop: 90 }}>
        {report && (
          <section className="section stack" aria-labelledby="s3" data-testid="results">
            <div className="label">שלב 3</div>
            <h2 id="s3" className="h2">פוטנציאל תכנוני ראשוני</h2>
            <p className="disclaimer" style={{ margin: 0 }}>{report.disclaimer}</p>
            {report.globalBlockers.length > 0 && (
              <div className="state bad" role="alert">
                <b>התכנית אינה מאפשרת התחדשות במגרש זה</b>
                {report.globalBlockers.map((b) => `${b.text} (${b.section})`).join(". ")}
              </div>
            )}
            <div className="routes">
              {report.routes.map((r, i) => (
                <RouteCard key={r.route} r={r} b={report.input} index={i} />
              ))}
            </div>
            <div className="grid grid-2">
              <div className="card stack">
                <div className="label">במילים</div>
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>{summarize(report).map((l, i) => <li key={i}>{l}</li>)}</ul>
                {llm && explain.state === "idle" && (
                  <button className="btn ghost small" type="button" onClick={onExplain}>הסבר מורחב</button>
                )}
                {explain.state === "loading" && <div className="skeleton" style={{ height: 80 }} />}
                {explain.state === "done" && <p style={{ margin: 0, whiteSpace: "pre-wrap" }} data-testid="explain">{explain.text}</p>}
                {explain.state === "error" && <div className="state warn">ההסבר המורחב אינו זמין כרגע. הסיכום שלמעלה מבוסס על אותם נתונים.</div>}
              </div>
              <div className="card stack">
                <div className="label">הנחות חישוב</div>
                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14 }}>{report.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={onPdf} disabled={pdfState === "working"}>
                    {pdfState === "working" ? "מכין קובץ" : "הורדת קובץ פוטנציאל (PDF)"}
                  </button>
                </div>
                {pdfState === "error" && <div className="state bad" role="alert">יצירת הקובץ נכשלה. אפשר לנסות שוב.</div>}
              </div>
            </div>
            <ReportSheet ref={sheetRef} rep={report} address={point?.label ?? null} />
          </section>
        )}
      </div>
    </div>
  );
}
