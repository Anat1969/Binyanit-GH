"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GeoJSONSource, Map as MlMap, Marker, Popup } from "maplibre-gl";
import { NULL_STATUS, PROGRAM, capacityOf, fmt, legendFor } from "./data";

export type MapMode = "capacity" | "era" | "added" | "haredi";

export const MODE_LABEL: Record<MapMode, string> = {
  capacity: "כושר נשיאה",
  era: "שנת הקמה",
  added: "תוספת יח\"ד",
  haredi: "אחוז אוכלוסייה חרדית",
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
// Shapes Hebrew labels of the basemap right to left (without it MapLibre draws them mirrored).
const RTL_PLUGIN_URL = "/vendor/mapbox-gl-rtl-text.js";
const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: "bg", type: "background" as const, paint: { "background-color": "#e9ebe8" } }],
};
const ASHDOD: [number, number] = [34.648, 31.792];
export const METERS_PER_UNIT = 0.5; // extrusion height = added_max_5y × 0.5 m (visual scale only)

// Only "added" is shown in 3D: a volume grows from the rova footprint. Other modes are flat and top-down.
const PITCH_3D = 50;
const BEARING_3D = -18;

// "added" is a quantity, not a status: grey shades, light to dark. "haredi" keeps a warm heat ramp.
export const RAMP_ADDED = ["#e4e4e1", "#c4c5c2", "#9fa1a0", "#74777a", "#4a4d52"];
export const RAMP_HAREDI = ["#f3ece4", "#e1cdb6", "#c9a985", "#a8825a", "#7b5b39"];
export const ADDED_STEPS = [0, 50, 250, 500, 750];
export const HAREDI_STEPS = [0, 0.2, 0.4, 0.6, 0.8];
const OUTLINE = "#2b2e33";
const LABEL_VALUES_ZOOM = 12.6;
const NO_CAPACITY_LINE = "#C00000"; // source legend, p. 16: "ללא כושר נשיאה" is a white fill with a red outline

function step(v: number, steps: number[], colors: string[]) {
  let i = 0;
  steps.forEach((s, j) => {
    if (v >= s) i = j;
  });
  return colors[i];
}

type Feature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> };
type FC = { type: "FeatureCollection"; properties?: Record<string, unknown>; features: Feature[] };

/** Value printed under the rova name on the map, per mode. */
export function labelValue(id: string, mode: MapMode): string {
  const r = PROGRAM.rovaim.find((x) => x.id === id);
  if (!r) return "";
  if (mode === "added") return `+${fmt(r.added_max_5y)} יח"ד`;
  if (mode === "haredi") return `${Math.round(r.pop_haredi * 100)}% חרדים`;
  if (mode === "era") return "";
  const { cap, viaGroup } = capacityOf(r);
  if (!cap) return "אין נתון";
  const b = cap.balance;
  const txt = b < 0 ? `גירעון ${fmt(-b)} כיתות` : b > 0 ? `יתרה ${fmt(b)} כיתות` : "מאוזן";
  return viaGroup ? `${txt} (לקבוצה)` : txt;
}

/** Joins each polygon to its rova record and computes display properties for the active mode. */
export function decorate(fc: FC, mode: MapMode): FC {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const r = PROGRAM.rovaim.find((x) => x.id === f.properties.id);
      const { cap } = r ? capacityOf(r) : { cap: null };
      const lg = legendFor(cap?.class);
      let color = NULL_STATUS.color;
      let opacity = NULL_STATUS.opacity;
      if (mode === "capacity" && lg) {
        color = lg.color;
        opacity = Math.max(lg.opacity, 0.55);
      } else if (mode === "added") {
        color = "#ffffff";
        opacity = 0.15;
      } else if (mode === "haredi" && r) {
        color = step(r.pop_haredi, HAREDI_STEPS, RAMP_HAREDI);
        opacity = 0.75;
      }
      // "era": the source has a legend but no year per rova, so every rova stays grey (no data).
      return {
        ...f,
        properties: {
          ...f.properties,
          color,
          opacity,
          no_capacity: mode === "capacity" && cap?.class === "none",
          volume: r ? step(r.added_max_5y, ADDED_STEPS, RAMP_ADDED) : RAMP_ADDED[0],
          height: mode === "added" ? (r?.added_max_5y ?? 0) * METERS_PER_UNIT : 0,
          added: r?.added_max_5y ?? null,
          balance: cap ? cap.balance : null,
        },
      };
    }),
  };
}

/** Area-weighted centroid of the largest ring: where the rova name is placed. */
export function labelPoint(geometry: unknown): [number, number] | null {
  const g = geometry as { type: string; coordinates: number[][][] | number[][][][] };
  const polys = (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]) as number[][][][];
  let best: [number, number] | null = null;
  let bestArea = 0;
  for (const poly of polys) {
    const ring = poly[0];
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      a += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    if (Math.abs(a) > bestArea && a !== 0) {
      bestArea = Math.abs(a);
      best = [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

interface Props {
  mode: MapMode;
  focusId?: string;
  height?: number;
  /** Stretch to the parent's height (min. `height`), for side-by-side cards. */
  fill?: boolean;
  /** Legend drawn on the map (bottom corner on wide screens, under the map on phones). */
  legend?: ReactNode;
  onState?: (s: "loading" | "ready" | "error", approximate: boolean) => void;
}

export default function ProgramMap({ mode, focusId, height = 600, fill, legend, onState }: Props) {
  const router = useRouter();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const markers = useRef<Marker[]>([]);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);
  const [fc, setFc] = useState<FC | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [basemap, setBasemap] = useState<"vector" | "fallback">("vector");
  const [mapReady, setMapReady] = useState(false);
  const decorated = useMemo(() => (fc ? decorate(fc, mode) : null), [fc, mode]);
  const stateRef = useRef(onState);
  stateRef.current = onState;
  const is3d = mode === "added";

  // 1. Polygons
  useEffect(() => {
    fetch("/data/rovaim.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: FC) => setFc(d))
      .catch(() => {
        setState("error");
        stateRef.current?.("error", false);
      });
  }, []);

  // 2. Map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = (await import("maplibre-gl")).default;
        ml.current = lib as unknown as typeof import("maplibre-gl");
        if (lib.getRTLTextPluginStatus() === "unavailable") {
          Promise.resolve(lib.setRTLTextPlugin(RTL_PLUGIN_URL, true)).catch(() => undefined);
        }
        let style: unknown = FALLBACK_STYLE;
        try {
          const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(6000) });
          if (res.ok) style = await res.json();
          else setBasemap("fallback");
        } catch {
          setBasemap("fallback");
        }
        if (cancelled || !el.current) return;
        const m = new lib.Map({
          container: el.current,
          style: style as never,
          center: ASHDOD,
          zoom: focusId ? 14.6 : 12.9,
          pitch: 0,
          bearing: 0,
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new lib.NavigationControl({ visualizePitch: true }), "top-left");
        popup.current = new lib.Popup({ closeButton: false, closeOnClick: false, className: "pmap-pop" });
        m.on("load", () => setMapReady(true));
        m.on("error", () => undefined);
      } catch {
        setState("error");
        stateRef.current?.("error", false);
      }
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((k) => k.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [focusId]);

  // 3. Layers (added once, data refreshed on mode change)
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || !decorated) return;
    const src = m.getSource("rovaim") as GeoJSONSource | undefined;
    if (src) {
      src.setData(decorated as never);
      return;
    }
    m.addSource("rovaim", { type: "geojson", data: decorated as never, promoteId: "id" });
    m.addLayer({ id: "rova-fill", type: "fill", source: "rovaim", paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] } });
    // Footprint: a thin dashed contour for every rova, the base of the volume in 3D.
    m.addLayer({
      id: "rova-line",
      type: "line",
      source: "rovaim",
      paint: { "line-color": OUTLINE, "line-width": 1, "line-opacity": 0.85, "line-dasharray": [3, 2] },
    });
    m.addLayer({
      id: "rova-none",
      type: "line",
      source: "rovaim",
      filter: ["==", ["get", "no_capacity"], true],
      paint: { "line-color": NO_CAPACITY_LINE, "line-width": 2, "line-dasharray": [3, 2] },
    });
    m.addLayer({
      id: "rova-3d",
      type: "fill-extrusion",
      source: "rovaim",
      filter: [">", ["get", "height"], 0], // flat modes: no volume, so the status fill stays visible
      paint: {
        "fill-extrusion-color": ["get", "volume"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.82,
        "fill-extrusion-vertical-gradient": true,
      },
    });
    if (focusId) {
      m.addLayer({
        id: "rova-focus",
        type: "line",
        source: "rovaim",
        filter: ["==", ["get", "id"], focusId],
        paint: { "line-color": OUTLINE, "line-width": 3 },
      });
    }

    const show = (e: { features?: { properties: Record<string, unknown> }[]; lngLat: { lng: number; lat: number } }) => {
      const p = e.features?.[0]?.properties;
      if (!p || !popup.current) return;
      m.getCanvas().style.cursor = "pointer";
      const bal = p.balance == null || p.balance === "null" ? "אין נתון" : fmt(Number(p.balance));
      popup.current
        .setLngLat(e.lngLat)
        .setHTML(
          `<div dir="rtl"><b>${p.name}</b><br/>תוספת יח"ד (מקסימלי 5 שנים): ${fmt(Number(p.added))}<br/>יתרה / גירעון כיתות יסודי: ${bal}<br/><small>לחיצה: דף הרובע</small></div>`,
        )
        .addTo(m);
    };
    m.on("mousemove", "rova-fill", show);
    m.on("mouseleave", "rova-fill", () => {
      m.getCanvas().style.cursor = "";
      popup.current?.remove();
    });
    m.on("click", "rova-fill", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") router.push(`/program/${id}`);
    });

    // Fit to all polygons, or to the focused rova.
    const coords: [number, number][] = [];
    const collect = (c: unknown) => {
      if (Array.isArray(c) && typeof c[0] === "number") coords.push(c as [number, number]);
      else if (Array.isArray(c)) c.forEach(collect);
    };
    decorated.features
      .filter((f) => !focusId || f.properties.id === focusId)
      .forEach((f) => collect((f.geometry as { coordinates: unknown }).coordinates));
    if (coords.length) {
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      // Keep the polygons clear of the legend card (bottom right in RTL on wide screens).
      const side = el.current && el.current.clientWidth >= 760 && !fill ? 380 : 30;
      const pad = focusId ? 50 : 24;
      m.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: { top: pad, bottom: pad, left: pad, right: Math.max(side, pad) }, duration: 0, maxZoom: 15.5 },
      );
    }
    // Values under the names only when there is room for them.
    const far = () => el.current?.classList.toggle("pmap-far", m.getZoom() < LABEL_VALUES_ZOOM);
    far();
    m.on("zoom", far);
    setState("ready");
    stateRef.current?.("ready", Boolean(fc?.features.some((f) => f.properties.approximate)));
  }, [mapReady, decorated, focusId, router, fc, fill]);

  // 4. Name labels (HTML, so Hebrew renders right to left even on the fallback basemap)
  useEffect(() => {
    const m = map.current;
    const lib = ml.current;
    if (!m || !lib || !mapReady || !fc) return;
    markers.current.forEach((k) => k.remove());
    markers.current = fc.features.flatMap((f) => {
      const id = String(f.properties.id);
      const at = labelPoint(f.geometry);
      if (!at) return [];
      const r = PROGRAM.rovaim.find((x) => x.id === id);
      const node = document.createElement("button");
      node.type = "button";
      node.className = "pmap-label";
      node.dataset.rova = id;
      if (id === focusId) node.dataset.focus = "true";
      const name = document.createElement("b");
      name.textContent = r?.name ?? String(f.properties.name ?? id);
      node.appendChild(name);
      const v = labelValue(id, mode);
      if (v) {
        const s = document.createElement("span");
        s.textContent = v;
        node.appendChild(s);
      }
      node.addEventListener("click", () => router.push(`/program/${id}`));
      return [new lib.Marker({ element: node, anchor: "center" }).setLngLat(at).addTo(m)];
    });
  }, [mapReady, fc, mode, focusId, router]);

  // 5. Camera: 3D only where height carries data.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    m.easeTo({ pitch: is3d ? PITCH_3D : 0, bearing: is3d ? BEARING_3D : 0, duration: 600 });
  }, [is3d, mapReady]);

  return (
    <div className={`pmap-wrap${fill ? " fill" : ""}`}>
      <div
        className="pmap"
        style={fill ? { minHeight: height } : { height: `min(${height}px, 72vh)` }}
        data-testid="program-map"
        data-state={state}
        data-basemap={basemap}
        data-mode={mode}
      >
        <div ref={el} style={{ position: "absolute", inset: 0 }} />
        {state === "loading" && <div className="skeleton" style={{ position: "absolute", inset: 0 }} aria-label="טוען מפה" />}
        {state === "error" && (
          <div className="state warn" style={{ position: "absolute", inset: 16 }} role="alert">
            <b>המפה אינה זמינה</b>
            אפשר לבחור רובע מהכפתורים או מהטבלה.
          </div>
        )}
        {state === "ready" && basemap === "fallback" && <div className="map-note">מפת הרקע לא נטענה. מוצגים גבולות הרובעים בלבד.</div>}
      </div>
      {legend && <div className="pmap-legend" data-testid="map-legend">{legend}</div>}
    </div>
  );
}
