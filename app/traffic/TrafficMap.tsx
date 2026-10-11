"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TRAFFIC_DOC, TRAFFIC_GROUPS, TRAFFIC_LAYERS, TRAFFIC_ORDER,
  type TrafficLayer, type TrafficLayerId,
} from "@/content/traffic";

type PathPair = { fill: string; stroke: string };
type Label = [number, number, string, number];
type LoadState = "loading" | "ready" | "error";

const NS = "http://www.w3.org/2000/svg";
const [, , VW, VH] = TRAFFIC_DOC.viewBox;
const M = TRAFFIC_DOC.metersPerUnit;
const PREF_KEY = "binyanit-traffic-layers";
const BLOCK_ZOOM = 1.6;
const PARCEL_ZOOM = 7;

function el(tag: string, attrs: Record<string, string | number>, parent?: Element) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

function defaults(): Record<TrafficLayerId, boolean> {
  const on = Object.fromEntries(TRAFFIC_LAYERS.map((l) => [l.id, l.defaultOn])) as Record<TrafficLayerId, boolean>;
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    for (const k in saved) if (k in on && typeof saved[k] === "boolean") on[k as TrafficLayerId] = saved[k];
  } catch {}
  return on;
}

export default function TrafficMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const nodes = useRef<Partial<Record<TrafficLayerId, SVGGElement>>>({});
  const labels = useRef<Label[]>([]);
  const view = useRef({ k: 1, tx: 0, ty: 0, base: 1 });
  const ring = useRef<Element | null>(null);

  const [state, setState] = useState<LoadState>("loading");
  const [bgReady, setBgReady] = useState(false);
  const [on, setOn] = useState<Record<TrafficLayerId, boolean>>(() =>
    Object.fromEntries(TRAFFIC_LAYERS.map((l) => [l.id, l.defaultOn])) as Record<TrafficLayerId, boolean>,
  );
  const [bgOpacity, setBgOpacity] = useState(60);
  const [hud, setHud] = useState({ k: 1, barPx: 80, barLabel: "" });
  const [gush, setGush] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => setOn(defaults()), []);

  const draw = useCallback(() => {
    const { k, tx, ty, base } = view.current;
    const s = base * k;
    rootRef.current?.setAttribute("transform", `translate(${tx},${ty}) scale(${s})`);
    svgRef.current?.classList.toggle("z-block", k >= BLOCK_ZOOM);
    svgRef.current?.classList.toggle("z-parcel", k >= PARCEL_ZOOM);
    const target = (90 / s) * M;
    const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const m = nice.find((x) => x >= target * 0.6) ?? 2000;
    setHud({ k, barPx: (m / M) * s, barLabel: m >= 1000 ? `${m / 1000} ק"מ` : `${m} מ'` });
  }, []);

  const size = () => {
    const r = svgRef.current!.getBoundingClientRect();
    return [r.width, r.height] as const;
  };

  const fit = useCallback(() => {
    if (!svgRef.current) return;
    const [w, h] = size();
    const base = Math.min(w / VW, h / VH) * 0.96;
    view.current = { k: 1, base, tx: (w - VW * base) / 2, ty: (h - VH * base) / 2 };
    draw();
  }, [draw]);

  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    const v = view.current;
    const nk = Math.max(0.6, Math.min(60, v.k * f));
    const r = nk / v.k;
    view.current = { ...v, k: nk, tx: cx - (cx - v.tx) * r, ty: cy - (cy - v.ty) * r };
    draw();
  }, [draw]);

  // Load and build layers once. Map content is drawn imperatively: thousands of paths and labels
  // do not need React reconciliation, only show / hide per group.
  useEffect(() => {
    let alive = true;
    const root = rootRef.current!;
    const def = (id: TrafficLayerId) => TRAFFIC_LAYERS.find((l) => l.id === id)!;
    for (const id of TRAFFIC_ORDER) nodes.current[id] = el("g", { "data-layer": id }, root) as SVGGElement;

    const addPaths = (id: TrafficLayerId, L: PathPair) => {
      const d = def(id), g = nodes.current[id]!;
      const bg = id === "cadastre" || id === "cadastre_light";
      if (L.stroke) el("path", { d: L.stroke, fill: "none", stroke: d.stroke || d.fill || "#000", "stroke-width": bg ? 0.45 : 0.72, "stroke-linejoin": "round", class: bg ? "bgline" : "" }, g);
      if (L.fill) el("path", { d: L.fill, fill: d.fill || d.stroke || "#000", class: bg ? "bgline" : "" }, g);
    };

    (async () => {
      try {
        const [layers, lbls] = await Promise.all([
          fetch("/data/traffic/layers.json").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
          fetch("/data/traffic/labels.json").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
        ]);
        if (!alive) return;
        el("image", { href: "/data/traffic/excluded.png", x: 0, y: 0, width: VW, height: VH, opacity: 0.85 }, nodes.current.excluded);
        for (const id of Object.keys(layers) as TrafficLayerId[]) if (nodes.current[id]) addPaths(id, layers[id]);
        labels.current = lbls;
        for (const id of ["lbl_block", "lbl_parcel"] as const) {
          const big = id === "lbl_block";
          const g = nodes.current[id]!;
          g.setAttribute("class", big ? "lbl-block" : "lbl-parcel");
          const frag = document.createDocumentFragment();
          for (const [x, y, t, s] of lbls as Label[]) {
            if (s > 2 !== big) continue;
            const te = el("text", { x, y, "font-size": big ? 7 : 1.6 });
            if (big) te.setAttribute("font-weight", "600");
            te.textContent = t;
            frag.appendChild(te);
          }
          g.appendChild(frag);
        }
        setState("ready");
        fit();
        const bg = await fetch("/data/traffic/cadastre.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!alive || !bg) return;
        addPaths("cadastre", bg.cadastre);
        addPaths("cadastre_light", bg.cadastre_light);
        setBgReady(true);
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
      root.replaceChildren();
      nodes.current = {};
    };
  }, [fit]);

  // Visibility and saved preference.
  useEffect(() => {
    for (const id of TRAFFIC_ORDER) {
      const g = nodes.current[id];
      if (g) g.style.display = on[id] ? "" : "none";
    }
    try { localStorage.setItem(PREF_KEY, JSON.stringify(on)); } catch {}
  }, [on, state]);

  useEffect(() => {
    svgRef.current?.style.setProperty("--bg-op", String(bgOpacity / 100));
  }, [bgOpacity]);

  // Pan, wheel and pinch.
  useEffect(() => {
    const svg = svgRef.current!;
    const pts = new Map<number, [number, number]>();
    let last: [number, number] | null = null;
    let pinch: number | null = null;
    const rel = (x: number, y: number) => { const r = svg.getBoundingClientRect(); return [x - r.left, y - r.top] as const; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const [x, y] = rel(e.clientX, e.clientY); zoomAt(Math.exp(-e.deltaY * 0.0015), x, y); };
    const down = (e: PointerEvent) => {
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      svg.classList.add("drag");
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
      last = [e.clientX, e.clientY];
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const [x, y] = rel((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        zoomAt(d / pinch, x, y);
        pinch = d;
        return;
      }
      if (pts.size === 1 && last) {
        view.current.tx += e.clientX - last[0];
        view.current.ty += e.clientY - last[1];
        last = [e.clientX, e.clientY];
        draw();
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!pts.size) { svg.classList.remove("drag"); last = null; } else last = [...pts.values()][0];
    };
    const dbl = (e: MouseEvent) => { const [x, y] = rel(e.clientX, e.clientY); zoomAt(2, x, y); };
    svg.addEventListener("wheel", wheel, { passive: false });
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("dblclick", dbl);
    const ro = new ResizeObserver(() => fit());
    ro.observe(svg);
    return () => {
      svg.removeEventListener("wheel", wheel);
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
      svg.removeEventListener("dblclick", dbl);
      ro.disconnect();
    };
  }, [draw, fit, zoomAt]);

  const zoomCenter = (f: number) => { const [w, h] = size(); zoomAt(f, w / 2, h / 2); };

  const only = (l: TrafficLayer) => {
    setOn((prev) => {
      const next = { ...prev };
      for (const x of TRAFFIC_LAYERS) if (x.group !== "base") next[x.id] = x.id === l.id;
      next[l.id] = true;
      return next;
    });
  };

  const showGroup = (g: string) =>
    setOn((prev) => {
      const next = { ...prev };
      for (const x of TRAFFIC_LAYERS) if (x.group === g) next[x.id] = true;
      return next;
    });

  const findGush = () => {
    const v = gush.trim();
    if (!v) return setMsg("הקלידו מספר גוש.");
    const hits = labels.current.filter((l) => l[2] === v && l[3] > 2);
    if (!hits.length) return setMsg(`גוש ${v} לא מופיע בגיליון. נסו מספר אחר, למשל 2018 או 2192.`);
    const [x, y] = hits[0];
    setOn((prev) => ({ ...prev, lbl_block: true }));
    const [w, h] = size();
    const k = 4, s = view.current.base * k;
    view.current = { ...view.current, k, tx: w / 2 - x * s, ty: h / 2 - y * s };
    draw();
    ring.current?.remove();
    ring.current = el("circle", { cx: x, cy: y, r: 16, fill: "none", stroke: "#1f4f8f", "stroke-width": 2, class: "hit" }, rootRef.current!);
    setMsg(hits.length > 1 ? `גוש ${v}: ${hits.length} תוויות בגיליון, מוצגת הראשונה.` : `גוש ${v} במרכז המפה.`);
  };

  return (
    <div className="tmap" data-testid="traffic-map" data-state={state}>
      <div className="tmap-stage">
        <svg ref={svgRef} className="tmap-svg" role="img" aria-label="מפת נספח התנועה בשכבות">
          <g ref={rootRef} />
        </svg>
        {state !== "ready" && (
          <div className="tmap-overlay" role="status">
            {state === "loading" ? "טוען את שכבות הנספח" : "שכבות הנספח לא נטענו. נסו לרענן את העמוד."}
          </div>
        )}
        <div className="tmap-tools" role="group" aria-label="תצוגת המפה">
          <button type="button" onClick={() => zoomCenter(1.6)} aria-label="הגדלה">+</button>
          <button type="button" onClick={() => zoomCenter(1 / 1.6)} aria-label="הקטנה">−</button>
          <button type="button" className="wide" onClick={fit}>כל הגיליון</button>
        </div>
        <div className="tmap-hud" aria-live="polite">
          <svg className="tmap-north" viewBox="-15 -15 30 30" aria-label="כיוון צפון לפי הגיליון">
            <g transform={`rotate(${TRAFFIC_DOC.northRotation})`}>
              <path d="M0 -13 L5 6 L0 2 L-5 6 Z" fill="currentColor" />
              <text y="11" fontSize="7" textAnchor="middle" fill="currentColor">צ</text>
            </g>
          </svg>
          <div>
            <div className="num">{hud.barLabel}</div>
            <div className="tmap-bar" style={{ width: hud.barPx }} />
          </div>
          <div className="num" data-testid="traffic-zoom">×{hud.k.toFixed(1)}</div>
        </div>
      </div>

      <aside className="tmap-legend" aria-label="מקרא ושכבות">
        {TRAFFIC_GROUPS.map((g) => (
          <section key={g.id} className="tmap-group">
            <div className="tmap-group-h">
              <span>
                {g.title}
                {g.note && <span className="cite"> · {g.note}</span>}
              </span>
              <button type="button" className="linklike" onClick={() => showGroup(g.id)}>הצגת הכל</button>
            </div>
            {TRAFFIC_LAYERS.filter((l) => l.group === g.id).map((l) => (
              <div key={l.id} className={`tmap-row${on[l.id] ? "" : " off"}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={on[l.id]}
                    onChange={(e) => setOn((p) => ({ ...p, [l.id]: e.target.checked }))}
                  />
                  <SwatchIcon l={l} />
                  <span className="tmap-name">
                    {l.name}
                    {l.status && <span className="tmap-status" data-status={l.status}>{l.status}</span>}
                    {(l.sub || l.sheet) && (
                      <small>
                        {[l.sub, l.sheet && `בגיליון: ${l.sheet}`].filter(Boolean).join(" · ")}
                        {(l.id === "cadastre" || l.id === "cadastre_light") && !bgReady && state === "ready" ? " · נטען" : ""}
                      </small>
                    )}
                  </span>
                </label>
                <button type="button" className="tmap-solo" onClick={() => only(l)} aria-label={`הצגת ${l.name} בלבד`}>
                  רק זו
                </button>
              </div>
            ))}
          </section>
        ))}

        <div className="tmap-ctrl">
          <label className="field">
            <span>שקיפות הרקע הקדסטרי</span>
            <input type="range" min={0} max={100} value={bgOpacity} onChange={(e) => setBgOpacity(+e.target.value)} />
          </label>
          <div className="field">
            <label htmlFor="gush-search">איתור גוש לפי מספר</label>
            <div className="row-gap" style={{ flexWrap: "nowrap" }}>
              <input
                id="gush-search"
                className="input num"
                inputMode="numeric"
                placeholder="לדוגמה 2018"
                value={gush}
                onChange={(e) => setGush(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") findGush(); }}
                disabled={state !== "ready"}
              />
              <button type="button" className="btn small" onClick={findGush} disabled={state !== "ready"}>איתור</button>
            </div>
            <small aria-live="polite" data-testid="gush-msg">{msg}</small>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SwatchIcon({ l }: { l: TrafficLayer }) {
  const c = l.fill || l.stroke || "currentColor";
  return (
    <svg className="tmap-sw" viewBox="0 0 58 16" aria-hidden="true">
      {l.swatch === "solid" && <rect x={2} y={5} width={54} height={6} fill={c} />}
      {l.swatch === "dash" && [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={3 + i * 9.2} y={3} width={5} height={10} fill={c} />)}
      {l.swatch === "hatch" && (
        <>
          <defs><clipPath id={`cp-${l.id}`}><rect x={2} y={2} width={54} height={12} /></clipPath></defs>
          <rect x={2} y={2} width={54} height={12} fill="none" stroke={c} />
          <g clipPath={`url(#cp-${l.id})`}>
            {Array.from({ length: 14 }, (_, i) => <line key={i} x1={2 + (i - 2) * 5} y1={14} x2={14 + (i - 2) * 5} y2={2} stroke={c} />)}
          </g>
        </>
      )}
      {l.swatch === "zig" && (
        <>
          <path d={"M2 8" + Array.from({ length: 18 }, (_, i) => ` L${2 + i * 3 + 1.5} ${(2 + i * 3) % 6 ? 5 : 11}`).join("")} fill="none" stroke={c} />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={2 + i * 12.5} y={4} width={5} height={8} fill={c} />)}
        </>
      )}
      {l.swatch === "block" && <rect x={2} y={2} width={54} height={12} rx={1} fill={c} />}
      {l.swatch === "thin" && <path d="M2 12 L20 4 L38 12 L56 4 M20 4 L20 12" fill="none" stroke={c} />}
      {l.swatch === "text" && <text x={29} y={12} fontSize={10} textAnchor="middle" className="num" fill="#3a423e">{l.sample}</text>}
    </svg>
  );
}
