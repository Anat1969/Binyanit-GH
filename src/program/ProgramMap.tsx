"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Popup } from "maplibre-gl";
import { NULL_STATUS, PROGRAM, capacityOf, fmt, legendFor } from "./data";

export type MapMode = "capacity" | "era" | "added" | "haredi";

export const MODE_LABEL: Record<MapMode, string> = {
  capacity: "כושר נשיאה",
  era: "שנת הקמה",
  added: "תוספת יח\"ד",
  haredi: "אחוז אוכלוסייה חרדית",
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: "bg", type: "background" as const, paint: { "background-color": "#e9ebe8" } }],
};
const ASHDOD: [number, number] = [34.648, 31.792];
const METERS_PER_UNIT = 0.5; // extrusion height = added_max_5y × 0.5 m (visual scale only)

// Sequential ramps for the numeric modes (5 steps, light to dark).
const RAMP_ADDED = ["#e8eef5", "#bccde0", "#8aa6c4", "#5a7ea6", "#2f557f"];
const RAMP_HAREDI = ["#f3ece4", "#e1cdb6", "#c9a985", "#a8825a", "#7b5b39"];
export const ADDED_STEPS = [0, 50, 250, 500, 750];
export const HAREDI_STEPS = [0, 0.2, 0.4, 0.6, 0.8];

function step(v: number, steps: number[], colors: string[]) {
  let i = 0;
  steps.forEach((s, j) => {
    if (v >= s) i = j;
  });
  return colors[i];
}

type Feature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> };
type FC = { type: "FeatureCollection"; properties?: Record<string, unknown>; features: Feature[] };

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
      let stroke = "#5f636a";
      if (mode === "capacity" && lg) {
        color = lg.color;
        opacity = lg.opacity;
        stroke = lg.stroke ?? "#3f4247";
      } else if (mode === "added" && r) {
        color = step(r.added_max_5y, ADDED_STEPS, RAMP_ADDED);
        opacity = 0.75;
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
          stroke,
          stroke_width: mode === "capacity" && cap?.class === "none" ? 3 : 1.2,
          height: (r?.added_max_5y ?? 0) * METERS_PER_UNIT,
          added: r?.added_max_5y ?? null,
          balance: cap ? cap.balance : null,
        },
      };
    }),
  };
}

interface Props {
  mode: MapMode;
  focusId?: string;
  height?: number;
  onState?: (s: "loading" | "ready" | "error", approximate: boolean) => void;
}

export default function ProgramMap({ mode, focusId, height = 460, onState }: Props) {
  const router = useRouter();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const [fc, setFc] = useState<FC | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [basemap, setBasemap] = useState<"vector" | "fallback">("vector");
  const [mapReady, setMapReady] = useState(false);
  const decorated = useMemo(() => (fc ? decorate(fc, mode) : null), [fc, mode]);
  const stateRef = useRef(onState);
  stateRef.current = onState;

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
        const ml = (await import("maplibre-gl")).default;
        let style: unknown = FALLBACK_STYLE;
        try {
          const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(6000) });
          if (res.ok) style = await res.json();
          else setBasemap("fallback");
        } catch {
          setBasemap("fallback");
        }
        if (cancelled || !el.current) return;
        const m = new ml.Map({
          container: el.current,
          style: style as never,
          center: ASHDOD,
          zoom: focusId ? 14.6 : 12.9,
          pitch: 55,
          bearing: -18,
          attributionControl: { compact: true },
        });
        map.current = m;
        m.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-left");
        popup.current = new ml.Popup({ closeButton: false, closeOnClick: false, className: "pmap-pop" });
        m.on("load", () => setMapReady(true));
        m.on("error", () => undefined);
      } catch {
        setState("error");
        stateRef.current?.("error", false);
      }
    })();
    return () => {
      cancelled = true;
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
    m.addLayer({
      id: "rova-3d",
      type: "fill-extrusion",
      source: "rovaim",
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.55,
      },
    });
    m.addLayer({
      id: "rova-line",
      type: "line",
      source: "rovaim",
      paint: {
        "line-color": ["get", "stroke"],
        "line-width": ["case", ["==", ["get", "id"], focusId ?? ""], 4, ["get", "stroke_width"]],
      },
    });

    const show = (e: { features?: { properties: Record<string, unknown> }[]; lngLat: { lng: number; lat: number } }) => {
      const p = e.features?.[0]?.properties;
      if (!p || !popup.current) return;
      m.getCanvas().style.cursor = "pointer";
      const bal = p.balance == null || p.balance === "null" ? "אין נתון" : fmt(Number(p.balance));
      popup.current
        .setLngLat(e.lngLat)
        .setHTML(
          `<div dir="rtl"><b>${p.name}</b><br/>תוספת יח"ד (מקסימלי 5 שנים): ${fmt(Number(p.added))}<br/>יתרה / גירעון כיתות: ${bal}</div>`,
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
      m.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: focusId ? 70 : 30, pitch: 55, bearing: -18, duration: 0, maxZoom: 15.5 },
      );
    }
    setState("ready");
    stateRef.current?.("ready", Boolean(fc?.features.some((f) => f.properties.approximate)));
  }, [mapReady, decorated, focusId, router, fc]);

  return (
    <div className="pmap" style={{ height }} data-testid="program-map" data-state={state} data-basemap={basemap}>
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
  );
}
