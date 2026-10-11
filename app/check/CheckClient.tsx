"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  InputError,
  RETROFIT_PERMIT_BEFORE_YEAR,
  SEC,
  computePotential,
  type BuildingInput,
  type PotentialReport,
  type SiteContext,
  type StreetClass,
} from "@/engine";
import { QUARTERS, STREET_CLASS_LABEL } from "@/content/plan-meta";
import { RouteCard } from "@/components/RouteCard";
import { ReportSheet } from "@/components/ReportSheet";
import { RichText, SummaryView } from "@/components/Summary";
import { summaryBlocks } from "@/lib/summary";
import { downloadPdf } from "@/lib/pdf";
import { quarterAt, type QuarterFC } from "@/lib/quarter";
import { EXTRACT_LABEL, extractFields, mergeExtracted, type ExtractKey, type Extracted } from "@/lib/extract";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="map skeleton" />,
});

type GeoResult = { label: string; lat: number; lon: number; quarter?: string | null };
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
  permitYear: "",
  existingFloors: "",
  existingUnits: "",
  typicalFloorArea: "",
  plotArea: "",
  frontageLength: "",
  groundFloor: "pilotis" as "built" | "pilotis",
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

type Form = typeof EMPTY_FORM;
type Manual = { streetClass: StreetClass; publicZone: boolean; searchZone: boolean; wellRadius: boolean; quarter: string };

/** Illustrative inputs, one per route. Clearly labelled as examples on screen and in the PDF. */
const EXAMPLES: { id: string; title: string; text: string; form: Form; manual: Manual }[] = [
  {
    id: "protection",
    title: "דוגמה 1: מיגון בלבד",
    text: 'בניין משנת 1986, 4 קומות על עמודים, 16 יח"ד, רחוב כלל עירוני, רובע ט׳. לא טעון חיזוק, ולכן מסלול החיזוק אינו זמין',
    form: { ...EMPTY_FORM, permitYear: "1986", existingFloors: "4", existingUnits: "16", typicalFloorArea: "380", plotArea: "1450", frontageLength: "28", groundFloor: "pilotis" },
    manual: { streetClass: "cityWide", publicZone: false, searchZone: false, wellRadius: false, quarter: "ט" },
  },
  {
    id: "retrofit",
    title: "דוגמה 2: חיזוק ומיגון",
    text: 'בניין משנת 1972, 4 קומות עם קומת קרקע בנויה, 16 יח"ד, רחוב עם חזית פעילה, רובע ג׳. טעון חיזוק, וקומת הקרקע הבנויה מוסיפה קומה',
    form: { ...EMPTY_FORM, permitYear: "1972", existingFloors: "4", existingUnits: "16", typicalFloorArea: "420", plotArea: "1800", frontageLength: "34", groundFloor: "built", activeGroundUses: true },
    manual: { streetClass: "activeFrontage", publicZone: false, searchZone: false, wellRadius: false, quarter: "ג" },
  },
  {
    id: "demolish",
    title: "דוגמה 3: הריסה ובנייה מחדש",
    text: 'בניין משנת 1964, 3 קומות, 12 יח"ד, על ציר הסעת המונים, רובע ב׳, עם 2 כיתות גן בפרויקט',
    form: { ...EMPTY_FORM, permitYear: "1964", existingFloors: "3", existingUnits: "12", typicalFloorArea: "330", plotArea: "1300", frontageLength: "30", groundFloor: "pilotis", publicEducation: "kindergarten2" },
    manual: { streetClass: "massTransit", publicZone: false, searchZone: false, wellRadius: false, quarter: "ב" },
  },
];

const FORM_KEYS: Partial<Record<ExtractKey, keyof Form>> = {
  permitYear: "permitYear",
  existingFloors: "existingFloors",
  existingUnits: "existingUnits",
  typicalFloorArea: "typicalFloorArea",
  plotArea: "plotArea",
  frontageLength: "frontageLength",
  groundFloor: "groundFloor",
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

function SiteValue({ loaded, source, children }: { loaded: boolean; source?: string; children: React.ReactNode }) {
  return (
    <span className="site-v">
      {children}
      <span className={`chip ${loaded ? "ok" : "warn"}`}>{source ?? (loaded ? "מהתשריט" : "ידני")}</span>
    </span>
  );
}

function Empty() {
  return <span className="muted">—</span>;
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
  const [manual, setManual] = useState<Manual>({ streetClass: "cityWide", publicZone: false, searchZone: false, wellRadius: false, quarter: "" });
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [quarters, setQuarters] = useState<QuarterFC | null>(null);
  const [autoQuarter, setAutoQuarter] = useState<{ key: string; source: string } | null>(null);
  const [example, setExample] = useState<(typeof EXAMPLES)[number] | null>(null);
  const [docs, setDocs] = useState<{ state: "idle" | "reading" | "done" | "error"; files: string[]; found: Extracted[]; empty: string[] }>({
    state: "idle",
    files: [],
    found: [],
    empty: [],
  });
  const [fromDoc, setFromDoc] = useState<Set<keyof Form>>(new Set());
  const pendingCompute = useRef(false);
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
    fetch("/data/rovaim.geojson").then((r) => (r.ok ? r.json() : null)).then(setQuarters).catch(() => setQuarters(null));
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFromDoc((d) => {
      if (!d.has(k)) return d;
      const n = new Set(d);
      n.delete(k);
      return n;
    });
    setExample(null);
    setReport(null);
  };

  function loadExample(ex: (typeof EXAMPLES)[number]) {
    setExample(ex);
    setForm(ex.form);
    setManual(ex.manual);
    setFromDoc(new Set());
    setPoint(null);
    setGeo({ state: "idle", results: [] });
    setLookup({ state: "idle", data: null });
    setAutoQuarter(null);
    setManualSite(true);
    setErrors([]);
    pendingCompute.current = true;
  }

  async function onDocs(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, 6);
    setDocs({ state: "reading", files: list.map((f) => f.name), found: [], empty: [] });
    try {
      const { pdfText } = await import("@/lib/pdftext");
      const results: Extracted[][] = [];
      const empty: string[] = [];
      for (const f of list) {
        const text = await pdfText(f);
        if (text.replace(/\s/g, "").length < 20) empty.push(f.name);
        results.push(extractFields(text, f.name));
      }
      const found = mergeExtracted(results);
      const filled = new Set<keyof Form>();
      setForm((prev) => {
        const next = { ...prev };
        for (const e of found) {
          const k = FORM_KEYS[e.key];
          if (!k) continue;
          (next as Record<string, unknown>)[k] = e.value;
          filled.add(k);
        }
        return next;
      });
      setFromDoc(filled);
      setExample(null);
      setReport(null);
      setDocs({ state: "done", files: list.map((f) => f.name), found, empty });
    } catch {
      setDocs((d) => ({ ...d, state: "error" }));
    }
  }

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
      if (data.results.length === 1) pick(data.results[0].lat, data.results[0].lon, data.results[0].label, data.results[0].quarter ?? null);
    } catch {
      setGeo({ state: "error", results: [], error: "אין חיבור לשירות האיתור. אפשר לסמן מיקום על המפה." });
    }
  }

  async function pick(lat: number, lon: number, label: string | null, osmQuarter: string | null = null) {
    setPoint({ lat, lon, label });
    setReport(null);
    setExample(null);
    const hit = quarters ? quarterAt(lon, lat, quarters) : null;
    if (osmQuarter) setAutoQuarter({ key: osmQuarter, source: "לפי הכתובת" });
    else if (hit) setAutoQuarter({ key: hit.key, source: hit.method === "inside" ? "לפי מפת הרובעים" : `הרובע הקרוב (${hit.distanceM} מ׳)` });
    else setAutoQuarter(null);
    setLookup({ state: "loading", data: null });
    try {
      const res = await fetch(`/api/lookup?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Lookup;
      setLookup({ state: "done", data });
      setManualSite(false);
    } catch {
      setLookup({ state: "error", data: null });
      setManualSite(true);
    }
  }

  const L = lookup.data;
  const has = (k: string) => Boolean(L?.loaded?.includes(k));
  const quarterSource = L?.quarter ? "מהתשריט" : example ? "דוגמה" : manual.quarter ? "ידני" : autoQuarter?.source ?? null;
  const quarter = L?.quarter ?? (manual.quarter || autoQuarter?.key || null);
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
      permitYear: form.permitYear.trim() === "" ? null : n(form.permitYear),
      existingFloors: n(form.existingFloors),
      existingUnits: form.residential ? n(form.existingUnits) : Number.isNaN(n(form.existingUnits)) ? 0 : n(form.existingUnits),
      typicalFloorArea: n(form.typicalFloorArea),
      plotArea: n(form.plotArea),
      frontageLength: form.frontageLength.trim() === "" ? null : n(form.frontageLength),
      groundFloor: form.groundFloor,
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

  useEffect(() => {
    if (!pendingCompute.current) return;
    pendingCompute.current = false;
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, manual]);

  function compute(e?: React.FormEvent) {
    e?.preventDefault();
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

  const yearNum = Number(form.permitYear);
  const yearValid = /^\d{4}$/.test(form.permitYear.trim());
  const retrofitText = !yearValid
    ? "ייקבע לפי שנת ההיתר"
    : yearNum < RETROFIT_PERMIT_BEFORE_YEAR
      ? `כן. היתר לפני 1.1.${RETROFIT_PERMIT_BEFORE_YEAR}`
      : `לא. היתר מ-${RETROFIT_PERMIT_BEFORE_YEAR} ואילך`;
  const docChip = (k: keyof Form) => (fromDoc.has(k) ? <span className="chip ok">מהמסמך</span> : null);
  const zoneRows = [
    ["public_allocation_zone", "הנחיות מיוחדות (הקצאה לציבור)", "publicZone", site.publicAllocationZone],
    ["urban_renewal_search_zone", "הנחיות מיוחדות ב׳ (חיפוש התחדשות)", "searchZone", site.urbanRenewalSearchZone],
    ["well_radius", "רדיוס מגן קידוח", "wellRadius", site.wellRadius],
  ] as const;

  return (
    <div className="wrap" style={{ paddingTop: 32 }}>
      <div className="stack" style={{ marginBottom: 20 }}>
        <div className="label">בדיקת כתובת</div>
        <h1 className="h2">מה אפשר לעשות בבניין?</h1>
        <p className="lead" style={{ margin: 0 }}>
          שלושה שלבים: מיקום, נתוני הבניין, ותוצאה לשלושת המסלולים עם הפניה לסעיפי התכנית.
        </p>
      </div>

      <div className="card examples" aria-labelledby="ex-title">
        <div>
          <div className="label" id="ex-title">דוגמאות להמחשה</div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>נתונים מומצאים, לא של בניין אמיתי. בחירה ממלאת את הטופס ומחשבת.</p>
        </div>
        <div className="examples-btns">
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" className="btn ghost small" aria-pressed={example?.id === ex.id} onClick={() => loadExample(ex)}>
              {ex.title}
            </button>
          ))}
        </div>
      </div>

      {example && (
        <div className="state info" style={{ marginTop: 12 }} data-testid="example-banner">
          <b>{example.title} (דוגמה)</b>
          {example.text}. הנתונים להמחשה בלבד.
        </div>
      )}

      <div className="grid grid-2 aligned" style={{ marginTop: 16 }}>
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
                  <button type="button" onClick={() => pick(r.lat, r.lon, r.label, r.quarter ?? null)}>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <MapView point={point} onPick={(lat, lon) => pick(lat, lon, null)} />
          {point && <small className="muted">האיתור מדויק לרמת הרחוב. לדיוק אפשר ללחוץ על הבניין במפה, או לעבור לתצלום אוויר.</small>}
          {!point && !manualSite && (
            <button type="button" className="btn ghost small" style={{ alignSelf: "start" }} onClick={() => { setManualSite(true); setLookup({ state: "idle", data: null }); }}>
              המשך ללא כתובת
            </button>
          )}
        </section>

        <section className="card stack" aria-labelledby="site" data-testid="site-panel">
          <div className="label">נתוני תשריט</div>
          <h2 id="site" className="h3">המגרש לפי התכנית</h2>
          {lookup.state === "loading" && <div className="skeleton" style={{ height: 6 }} aria-label="טוען" />}
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

          <div className={`site-frame ${siteReady ? "" : "empty"}`}>
            <div className="site-row">
              <span className="k">כתובת</span>
              {point ? <span className="num site-addr">{point.label ?? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`}</span> : example ? <span>דוגמה</span> : <Empty />}
            </div>
            <div className="site-row">
              <span className="k">בתחום התכנית</span>
              {!siteReady ? <Empty /> : site.inPlan === null ? <SiteValue loaded={false} source="לא אומת">מניחים שכן</SiteValue> : <SiteValue loaded>{site.inPlan ? "כן" : "לא"}</SiteValue>}
            </div>
            <div className="site-row">
              <span className="k">סיווג רחוב</span>
              {!siteReady ? (
                <Empty />
              ) : has("street_class") ? (
                <SiteValue loaded>{STREET_CLASS_LABEL[site.streetClass]}</SiteValue>
              ) : (
                <SiteValue loaded={false}>
                  <select
                    className="select compact"
                    aria-label="סיווג רחוב"
                    value={manual.streetClass}
                    onChange={(e) => { setManual({ ...manual, streetClass: e.target.value as StreetClass }); setExample(null); setReport(null); }}
                  >
                    {Object.entries(STREET_CLASS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </SiteValue>
              )}
            </div>
            {zoneRows.map(([kind, label, key, val]) => (
              <div className="site-row" key={kind}>
                <span className="k">{label}</span>
                {!siteReady ? (
                  <Empty />
                ) : (kind === "well_radius" ? has("well_radius") || has("building_restriction") : zoneFromMap(kind)) ? (
                  <SiteValue loaded>{val ? "כן" : "לא"}</SiteValue>
                ) : (
                  <SiteValue loaded={false}>
                    <label className="check" style={{ minHeight: 0 }}>
                      <input type="checkbox" checked={manual[key]} onChange={(e) => { setManual({ ...manual, [key]: e.target.checked }); setExample(null); setReport(null); }} />
                      כן
                    </label>
                  </SiteValue>
                )}
              </div>
            ))}
            <div className="site-row">
              <span className="k">רובע</span>
              {!siteReady && !quarter ? (
                <Empty />
              ) : (
                <SiteValue loaded={quarterSource === "מהתשריט" || Boolean(autoQuarter && !manual.quarter)} source={quarterSource ?? "יש לבחור"}>
                  {L?.quarter ? (
                    <span>רובע {L.quarter}</span>
                  ) : (
                    <select
                      className="select compact"
                      aria-label="רובע"
                      value={quarter ?? ""}
                      onChange={(e) => { setManual({ ...manual, quarter: e.target.value }); setExample(null); setReport(null); }}
                    >
                      {!quarter && <option value="">בחירת רובע</option>}
                      {[...QUARTERS, 'מע"ר צפון'].map((q) => (
                        <option key={q} value={q}>{q.startsWith("מע") ? q : `רובע ${q}`}</option>
                      ))}
                    </select>
                  )}
                </SiteValue>
              )}
            </div>
            <div className="site-row">
              <span className="k">אתר קידוח קרוב</span>
              {L?.nearest_well_m != null ? <span className="num">{L.nearest_well_m.toLocaleString("he-IL")} מ׳</span> : <Empty />}
            </div>
          </div>

          {!siteReady && <p className="muted" style={{ margin: 0, fontSize: 14 }}>המסגרת מתמלאת אחרי איתור כתובת, סימון על המפה או בחירת דוגמה.</p>}
          {siteReady && site.inPlan === null && (
            <div className="state info">
              <b>גבול התכנית טרם אומת</b>
              נתונים שלא נמצאו בשכבות התשריט מסומנים "ידני" וניתנים לבחירה.
            </div>
          )}
          {sg && (
            <div className="state warn" data-testid="special-guidelines">
              <b>המגרש בתחום "הנחיות מיוחדות" לפי התשריט</b>
              התשריט אינו מבחין בין הקצאה לצרכי ציבור לבין הנחיות מיוחדות ב׳. יש לבדוק בהוראות איזו הנחיה חלה ולסמן למעלה.
            </div>
          )}
        </section>
      </div>

      <form className="card stack" style={{ marginTop: 16 }} onSubmit={compute} aria-labelledby="s2" noValidate>
        <div className="label">שלב 2</div>
        <h2 id="s2" className="h3">נתוני הבניין הקיים</h2>

        <div className="upload" data-testid="upload">
          <div className="stack" style={{ gap: 4 }}>
            <b>מילוי אוטומטי ממסמכים</b>
            <span className="muted" style={{ fontSize: 14 }}>
              היתר בנייה, מפת מדידה או נסח טאבו בקובץ PDF. הקובץ נקרא בדפדפן ואינו נשלח לשרת. כל ערך שנמצא מסומן "מהמסמך" וניתן לתיקון.
            </span>
          </div>
          <label className="btn ghost small upload-btn">
            {docs.state === "reading" ? "קורא מסמכים" : "בחירת קבצים"}
            <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { onDocs(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {docs.state === "error" && <div className="state bad" role="alert"><b>קריאת המסמך נכשלה</b>אפשר לנסות קובץ אחר או להזין ידנית.</div>}
        {docs.state === "done" && (
          <div className={`state ${docs.found.length ? "ok" : "warn"}`} data-testid="doc-results">
            <b>{docs.found.length ? `נמצאו ${docs.found.length} נתונים ב-${docs.files.length} קבצים` : "לא נמצאו נתונים במסמכים"}</b>
            {docs.empty.length > 0 && <span>{docs.empty.join(", ")}: מסמך סרוק ללא שכבת טקסט. יש להזין את הנתונים ידנית.</span>}
            {docs.found.length > 0 && (
              <ul className="plain" style={{ fontSize: 14 }}>
                {docs.found.map((e) => (
                  <li key={e.key}>
                    <span className="mark" aria-hidden="true">•</span>
                    <span>
                      {EXTRACT_LABEL[e.key]}: <b>{e.key === "groundFloor" ? (e.value === "built" ? "בנויה" : "קומת עמודים") : e.value}</b>
                      <span className="muted"> ({e.source}: "{e.quote}")</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-3 fields">
          {(
            [
              ["permitYear", "שנת היתר הבנייה", "קובעת אם הבניין טעון חיזוק"],
              ["existingFloors", "קומות קיימות", "ללא קומת עמודים"],
              ["existingUnits", 'יח"ד קיימות', ""],
              ["typicalFloorArea", 'שטח קומה טיפוסית (מ"ר)', ""],
              ["plotArea", 'שטח מגרש (מ"ר)', ""],
              ["frontageLength", "אורך חזית המגרש (מ׳)", "רשות. משפיע על פטור מהקצאה"],
            ] as const
          ).map(([k, label, hint]) => (
            <label className="field" key={k}>
              <span className="field-label">{label} {docChip(k)}</span>
              <input
                className="input num"
                inputMode="decimal"
                name={k}
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                aria-invalid={errors.length > 0 && k !== "frontageLength" && form[k] === "" ? true : undefined}
              />
              <small>{hint || " "}</small>
            </label>
          ))}
        </div>
        <div className="grid grid-4 fields">
          <Seg label="קומת קרקע" value={form.groundFloor} onChange={(v) => set("groundFloor", v)} options={[{ v: "built", label: "בנויה (50% ומעלה)" }, { v: "pilotis", label: "קומת עמודים" }]} />
          <Seg label="מרחבים מוגנים" value={form.protectedSpaces} onChange={(v) => set("protectedSpaces", v)} options={[{ v: "none", label: "אין" }, { v: "partial", label: "חלקי (עד 50%)" }, { v: "full", label: "מלא" }]} />
          <Seg label="שימוש" value={form.residential} onChange={(v) => set("residential", v)} options={[{ v: true, label: "מגורים" }, { v: false, label: "אחר" }]} />
          <div className="field" data-testid="retrofit-derived">
            <span>טעון חיזוק לרעידות אדמה</span>
            <div className={`derived ${yearValid ? "" : "pending"}`}>
              <b>{retrofitText}</b>
              <span className="cite">{SEC.retrofitDef}</span>
            </div>
          </div>
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
                <select className="select" value={form.publicEducation} onChange={(e) => set("publicEducation", e.target.value as Form["publicEducation"])}>
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
            <div className="label">שלב 3{example ? " · דוגמה" : ""}</div>
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
            <div className="grid grid-2 aligned">
              <div className="card stack">
                <div className="label">במילים</div>
                <SummaryView blocks={summaryBlocks(report)} />
                {llm && explain.state === "idle" && (
                  <button className="btn ghost small" type="button" style={{ alignSelf: "start" }} onClick={onExplain}>הסבר מורחב</button>
                )}
                {explain.state === "loading" && <div className="skeleton" style={{ height: 80 }} />}
                {explain.state === "done" && explain.text && <RichText text={explain.text} />}
                {explain.state === "error" && <div className="state warn">ההסבר המורחב אינו זמין כרגע. הסיכום שלמעלה מבוסס על אותם נתונים.</div>}
              </div>
              <div className="card stack">
                <div className="label">הנחות חישוב</div>
                <ol className="numbered">{report.assumptions.map((a) => <li key={a}>{a}</li>)}</ol>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={onPdf} disabled={pdfState === "working"}>
                    {pdfState === "working" ? "מכין קובץ" : "הורדת קובץ פוטנציאל (PDF)"}
                  </button>
                </div>
                {pdfState === "error" && <div className="state bad" role="alert">יצירת הקובץ נכשלה. אפשר לנסות שוב.</div>}
              </div>
            </div>
            <ReportSheet ref={sheetRef} rep={report} address={point?.label ?? null} example={example ? example.title : null} />
          </section>
        )}
      </div>
    </div>
  );
}
