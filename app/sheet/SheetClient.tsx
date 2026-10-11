"use client";
// Plan sheet (graphic appendix to the tashrit) as layered SVG in sheet coordinates.
// Data: public/data/sheet-layers.json, extracted from the PDF vectors (paths per colour layer,
// hover zones for the hatched renewal areas, plan-area polygon). Not georeferenced.
import { useEffect, useRef, useState } from "react";
import { PUBLIC_ALLOCATION } from "@/engine/config";

const NS = "http://www.w3.org/2000/svg";
const W = 2730;
const H = 2384;
const STORE = "binyanit-sheet-layers";

type Fill = { nonzero: string; evenodd: string; count: number };
type SheetData = {
  boundary: Fill;
  active: Fill;
  metro: Fill;
  traffic: Fill;
  public: Fill;
  renewal: { stroke: string; count: number; zones: string[] };
  planArea: string;
};
type LayerId = "renewal" | "public" | "active" | "metro" | "traffic" | "boundary";
type Layer = { id: LayerId; name: string; kind: "hatch" | "fill" | "line"; info: string };

const LAYERS: Layer[] = [
  {
    id: "renewal",
    name: "תחום לאיתור מתחמים להתחדשות עירונית",
    kind: "hatch",
    info: "נדרשת בחינה מול הוועדה המקומית לפני הגשת בקשה להיתר. בחלק מהמקרים יידרש פתרון משלים עם מגרשים סמוכים, בתכנית בינוי או בתב\"ע נקודתית.",
  },
  {
    id: "public",
    name: "תחום הפרשות לצורכי ציבור",
    kind: "fill",
    info: `במסלולי הריסה ובנייה, וחיזוק ומיגון: הפרשה של ${PUBLIC_ALLOCATION.groundFloorPct}% מקומת הקרקע, לפחות ${PUBLIC_ALLOCATION.minArea} מ"ר ולא יותר מ־${PUBLIC_ALLOCATION.maxPctOfRights}% מזכויות הבנייה במגרש, עם כניסה ראויה למגורים.`,
  },
  {
    id: "active",
    name: "חזית פעילה",
    kind: "line",
    info: "מבנה הפונה לרחוב: תוספת קומה אחת מעל רחבי העיר במסלולי הריסה ובנייה, וחיזוק ומיגון, בתנאי שימושים פעילים בקומת הקרקע (מסחר, תעסוקה, שימוש ציבורי).",
  },
  {
    id: "metro",
    name: "ציר מתע\"ן",
    kind: "line",
    info: "זכויות כמו ברחוב פעיל: תוספת קומה אחת מעל רחבי העיר, בתנאי שימושים פעילים בקומת הקרקע.",
  },
  {
    id: "traffic",
    name: "חיבורי תנועה מתוכננים",
    kind: "line",
    info: "חיבור תנועה מתוכנן שעשוי לחצות את המגרש או לגבול בו. יש לתאם מול הוועדה המקומית לפני תכנון.",
  },
  {
    id: "boundary",
    name: "גבול התכנית",
    kind: "line",
    info: "התכנית חלה בתוך הגבול. הזכויות נקבעות לפי מצב המבנה, המסלול והמיקום.",
  },
];

// Paint order on the sheet (bottom to top), independent of the legend order.
const DRAW_ORDER: LayerId[] = ["public", "renewal", "boundary", "active", "metro", "traffic"];

type Bg = "base" | "orig" | "none";
type Probe = { inside: boolean; found: Layer[] } | null;

function mk(tag: string, attrs: Record<string, string | number>, parent?: Element) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e as SVGGraphicsElement;
}

export default function SheetClient() {
  const [data, setData] = useState<SheetData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [on, setOn] = useState<Record<LayerId, boolean>>(() =>
    Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<LayerId, boolean>,
  );
  const [bg, setBg] = useState<Bg>("base");
  const [op, setOp] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [probe, setProbe] = useState<Probe>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const vpRef = useRef<SVGGElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const groups = useRef<Partial<Record<LayerId, SVGGElement | null>>>({});
  const els = useRef<Partial<Record<LayerId, SVGGeometryElement[]>>>({});
  const areaRef = useRef<SVGPathElement>(null);
  const view = useRef({ s: 1.6, tx: -700, ty: -60 });
  const onRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      setOn((o) => ({ ...o, ...saved }));
    } catch {}
    fetch("/data/sheet-layers.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SheetData) => {
        setData(d);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  // Draw layers once the data is in.
  useEffect(() => {
    if (!data) return;
    for (const L of LAYERS) {
      const g = groups.current[L.id];
      if (!g) continue;
      g.replaceChildren();
      const color = `var(--l-${L.id})`;
      if (L.kind === "hatch") {
        mk("path", { d: data.renewal.stroke, fill: "none", stroke: color, "stroke-width": 0.9 }, g);
        els.current[L.id] = data.renewal.zones.map(
          (z, i) => mk("path", { d: z, class: "zone-hit", "fill-rule": "evenodd", "data-i": i }, g) as SVGGeometryElement,
        );
      } else {
        const f = data[L.id as Exclude<LayerId, "renewal">];
        els.current[L.id] = [
          mk("path", { d: f.nonzero, fill: color, "fill-opacity": L.id === "public" ? 0.85 : 1 }, g) as SVGGeometryElement,
        ];
      }
    }
  }, [data]);

  // Pan / zoom / tap-to-probe.
  useEffect(() => {
    const svg = svgRef.current;
    const vp = vpRef.current;
    if (!svg || !vp || state !== "ready") return;
    const v = view.current;
    const apply = () => {
      vp.setAttribute("transform", `translate(${v.tx} ${v.ty}) scale(${v.s})`);
      setZoom(v.s);
    };
    const toSvg = (cx: number, cy: number) => {
      const p = svg.createSVGPoint();
      p.x = cx;
      p.y = cy;
      return p.matrixTransform(svg.getScreenCTM()!.inverse());
    };
    const zoomAt = (f: number, cx: number, cy: number) => {
      const p = toSvg(cx, cy);
      const ns = Math.min(14, Math.max(1, v.s * f));
      const k = ns / v.s;
      v.tx = p.x - (p.x - v.tx) * k;
      v.ty = p.y - (p.y - v.ty) * k;
      v.s = ns;
      if (v.s === 1) v.tx = v.ty = 0;
      apply();
    };
    const center = (f: number) => {
      const r = svg.getBoundingClientRect();
      zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
    };

    const hit = (path: SVGGeometryElement, x: number, y: number, tol: number) => {
      const pt = svg.createSVGPoint();
      const t = tol * 0.7;
      const offs = tol ? [[0, 0], [tol, 0], [-tol, 0], [0, tol], [0, -tol], [t, t], [-t, -t], [t, -t], [-t, t]] : [[0, 0]];
      for (const [dx, dy] of offs) {
        pt.x = x + dx;
        pt.y = y + dy;
        if (path.isPointInFill(pt)) return true;
      }
      return false;
    };
    const doProbe = (cx: number, cy: number) => {
      const p = toSvg(cx, cy);
      const x = (p.x - v.tx) / v.s;
      const y = (p.y - v.ty) / v.s;
      const pin = pinRef.current!;
      pin.replaceChildren();
      mk("circle", { cx: x, cy: y, r: 7 / v.s + 2, fill: "none", stroke: "var(--accent)", "stroke-width": 2.5 / v.s + 0.5 }, pin);
      svg.querySelectorAll(".zone-hit.sel").forEach((z) => z.classList.remove("sel"));
      const found: Layer[] = [];
      for (const L of LAYERS) {
        if (!onRef.current[L.id] || L.id === "boundary") continue;
        // ~22 sheet units, about 60 m at 1:7,500: a plot fronting the street counts as on the line.
        const tol = L.kind === "line" ? 22 : 0;
        for (const el of els.current[L.id] ?? []) {
          if (hit(el, x, y, tol)) {
            found.push(L);
            if (L.kind === "hatch") el.classList.add("sel");
            break;
          }
        }
      }
      setProbe({ inside: areaRef.current ? hit(areaRef.current, x, y, 0) : false, found });
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
    };
    const ptrs = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinchD = 0;
    let last = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      svg.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      last = { x: e.clientX, y: e.clientY };
      svg.classList.add("drag");
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const move = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD) zoomAt(dist / pinchD, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinchD = dist;
        moved += 10;
        return;
      }
      const k = svg.getScreenCTM()!.a;
      const dx = (e.clientX - last.x) / k;
      const dy = (e.clientY - last.y) / k;
      last = { x: e.clientX, y: e.clientY };
      moved += Math.abs(dx) + Math.abs(dy);
      v.tx += dx;
      v.ty += dy;
      apply();
    };
    const up = (e: PointerEvent) => {
      svg.classList.remove("drag");
      const tap = ptrs.size === 1 && moved < 4;
      ptrs.delete(e.pointerId);
      pinchD = 0;
      if (tap && e.type === "pointerup") doProbe(e.clientX, e.clientY);
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 40 / v.s;
      if (e.key === "+" || e.key === "=") center(1.4);
      else if (e.key === "-") center(1 / 1.4);
      else if (e.key === "ArrowLeft") v.tx += step * v.s;
      else if (e.key === "ArrowRight") v.tx -= step * v.s;
      else if (e.key === "ArrowUp") v.ty += step * v.s;
      else if (e.key === "ArrowDown") v.ty -= step * v.s;
      else return;
      e.preventDefault();
      apply();
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("keydown", onKey);
    const ctl = svg.parentElement!;
    const zin = ctl.querySelector<HTMLButtonElement>("[data-z=in]")!;
    const zout = ctl.querySelector<HTMLButtonElement>("[data-z=out]")!;
    const zfit = ctl.querySelector<HTMLButtonElement>("[data-z=fit]")!;
    const fin = () => center(1.4);
    const fout = () => center(1 / 1.4);
    const ffit = () => {
      v.s = 1;
      v.tx = v.ty = 0;
      apply();
    };
    zin.addEventListener("click", fin);
    zout.addEventListener("click", fout);
    zfit.addEventListener("click", ffit);
    apply();
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
      svg.removeEventListener("keydown", onKey);
      zin.removeEventListener("click", fin);
      zout.removeEventListener("click", fout);
      zfit.removeEventListener("click", ffit);
    };
  }, [state]);

  const toggle = (id: LayerId, v: boolean) => {
    const next = { ...on, [id]: v };
    setOn(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
  };

  const count = (L: Layer) => {
    if (!data) return "";
    if (L.kind === "hatch") return `${data.renewal.zones.length} תחומים`;
    if (L.id === "boundary") return "";
    return `${data[L.id as Exclude<LayerId, "renewal">].count} רכיבים`;
  };

  return (
    <div className="tashrit" data-testid="sheet" data-state={state}>
      <aside className="sheet-panel" aria-label="מקרא ושכבות">
        <div className="label">מקרא</div>
        <ul className="sheet-layers">
          {LAYERS.map((L) => (
            <li key={L.id} className={on[L.id] ? "" : "off"}>
              <input
                type="checkbox"
                id={`chk-${L.id}`}
                checked={on[L.id]}
                onChange={(e) => toggle(L.id, e.target.checked)}
              />
              <span className={`sw ${L.kind}`} style={L.kind === "hatch" ? undefined : { background: `var(--l-${L.id})` }} />
              <label htmlFor={`chk-${L.id}`}>{L.name}</label>
              <span className="n num">{count(L)}</span>
            </li>
          ))}
          <li className="pending">
            <input type="checkbox" disabled aria-label="שכבה לא זמינה" />
            <span className="sw" />
            <label>
              מבנים טעוני חיזוק ומיגון
              <small>ברמת בניין, לפי סקר הרישוי. טרם התקבל.</small>
            </label>
            <span className="tag">ממתין לנתונים</span>
          </li>
        </ul>

        <div className="sheet-row" role="group" aria-label="רקע">
          <span className="label">רקע</span>
          {(
            [
              ["base", "גושים וחלקות"],
              ["orig", "גיליון מקורי"],
              ["none", "ללא"],
            ] as [Bg, string][]
          ).map(([k, t]) => (
            <button key={k} type="button" className="tchip" aria-pressed={bg === k} onClick={() => setBg(k)}>
              {t}
            </button>
          ))}
        </div>
        <div className="sheet-row">
          <label htmlFor="sheet-op" className="label">
            שקיפות רקע
          </label>
          <input id="sheet-op" type="range" min={15} max={100} value={op} onChange={(e) => setOp(Number(e.target.value))} />
        </div>

        <section className="sheet-probe" aria-live="polite" data-testid="sheet-probe">
          <h3>בדיקת נקודה</h3>
          {!probe && <p className="muted">לחיצה על המפה מציגה אילו שכבות חלות במקום.</p>}
          {probe && probe.found.length === 0 && (
            <p className="muted">
              {probe.inside
                ? "בתוך גבול התכנית, ללא שכבה מיוחדת. חלות זכויות \"רחבי העיר\" לפי מצב המבנה והמסלול."
                : "מחוץ לגבול התכנית. התכנית הבניינית אינה חלה כאן."}
            </p>
          )}
          {probe && probe.found.length > 0 && (
            <ul>
              {probe.found.map((f) => (
                <li key={f.id}>
                  <b>{f.name}</b>
                  <br />
                  {f.info}
                </li>
              ))}
            </ul>
          )}
          {probe && <p className="muted sheet-small">בדיקה גרפית בלבד. אינה מחליפה בדיקה מול הוראות התכנית והוועדה המקומית.</p>}
        </section>
      </aside>

      <div className="sheet-map">
        {state === "error" && (
          <div className="state bad" role="alert">
            <b>לא ניתן לטעון את שכבות התשריט</b>
            אפשר לרענן את הדף.
          </div>
        )}
        {state === "loading" && <div className="sheet-loading muted">טוען שכבות…</div>}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="מפת התכנית הבניינית בשכבות. מקשי חיצים להזזה, פלוס ומינוס לזום"
          tabIndex={0}
        >
          <g ref={vpRef}>
            <image
              href="/sheet/base.webp"
              width={W}
              height={H}
              preserveAspectRatio="none"
              className="sheet-base"
              visibility={bg === "base" ? "visible" : "hidden"}
              style={{ opacity: op / 100 }}
            />
            <image
              href="/sheet/original.jpg"
              width={W}
              height={H}
              preserveAspectRatio="none"
              visibility={bg === "orig" ? "visible" : "hidden"}
              style={{ opacity: op / 100 }}
            />
            {DRAW_ORDER.map((id) => (
              <g
                key={id}
                ref={(el) => {
                  groups.current[id] = el;
                }}
                style={{ display: on[id] ? undefined : "none" }}
              />
            ))}
            {data && <path ref={areaRef} d={data.planArea} fill="none" />}
            <g ref={pinRef} pointerEvents="none" />
          </g>
        </svg>
        <div className="sheet-zoom">
          <button type="button" className="tchip" data-z="in" aria-label="הגדלה">
            +
          </button>
          <button type="button" className="tchip" data-z="out" aria-label="הקטנה">
            −
          </button>
          <button type="button" className="tchip" data-z="fit" aria-label="כל הגיליון">
            הכל
          </button>
        </div>
        <div className="sheet-scale num">זום ×{zoom.toFixed(1)} · קנ&quot;מ גיליון 1:7,500</div>
      </div>
    </div>
  );
}
