"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";

const ASHDOD: [number, number] = [34.655, 31.8];
// Free basemaps without an API key: OpenFreeMap vector streets, Esri World Imagery for aerial photos.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const OSM_RASTER = {
  version: 8 as const,
  sources: {
    osm: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm", paint: { "raster-saturation": -0.8 } }],
};
const AERIAL_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

interface Props {
  point: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
}

export default function MapView({ point, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [boundary, setBoundary] = useState<"loading" | "loaded" | "missing" | "error">("loading");
  const [aerial, setAerial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ml = (await import("maplibre-gl")).default;
        let style: unknown = OSM_RASTER;
        try {
          const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(6000) });
          if (res.ok) style = await res.json();
        } catch {
          // Vector style unavailable: keep the OpenStreetMap raster tiles.
        }
        if (cancelled || !el.current) return;
        const m = new ml.Map({
          container: el.current,
          center: ASHDOD,
          zoom: 12.4,
          attributionControl: { compact: true },
          style: style as never,
        });
        map.current = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
        m.on("click", (e) => pickRef.current(e.lngLat.lat, e.lngLat.lng));
        m.on("load", async () => {
          setState("ready");
          m.addSource("aerial", { type: "raster", tiles: [AERIAL_TILES], tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" });
          m.addLayer({ id: "aerial", type: "raster", source: "aerial", layout: { visibility: "none" } });
          try {
            const res = await fetch("/api/layers/plan_boundary");
            if (!res.ok) throw new Error();
            const fc = await res.json();
            if (!fc.features?.length) return setBoundary("missing");
            m.addSource("boundary", { type: "geojson", data: fc });
            m.addLayer({ id: "boundary-fill", type: "fill", source: "boundary", paint: { "fill-color": "#26313d", "fill-opacity": 0.06 } });
            m.addLayer({ id: "boundary-line", type: "line", source: "boundary", paint: { "line-color": "#26313d", "line-width": 1.6, "line-dasharray": [3, 2] } });
            setBoundary("loaded");
          } catch {
            setBoundary("error");
          }
        });
        m.on("error", () => undefined);
      } catch {
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !point) return;
    (async () => {
      const ml = (await import("maplibre-gl")).default;
      if (!marker.current) {
        const dot = document.createElement("div");
        dot.style.cssText =
          "width:18px;height:18px;border-radius:50%;background:#26313d;border:3px solid #fff;box-shadow:0 0 0 2px #26313d,0 6px 16px rgba(0,0,0,.35)";
        marker.current = new ml.Marker({ element: dot });
      }
      marker.current.setLngLat([point.lon, point.lat]).addTo(m);
      m.flyTo({ center: [point.lon, point.lat], zoom: 16.5, speed: 1.4 });
    })();
  }, [point, state]);

  useEffect(() => {
    const m = map.current;
    if (!m || state !== "ready" || !m.getLayer("aerial")) return;
    m.setLayoutProperty("aerial", "visibility", aerial ? "visible" : "none");
  }, [aerial, state]);

  return (
    <div className="map" data-testid="map">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {state === "loading" && <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}
      {state === "error" && (
        <div className="state warn" style={{ position: "absolute", inset: 16 }}>
          <b>המפה אינה זמינה בדפדפן זה</b>
          אפשר להמשיך בחיפוש כתובת או בהזנה ידנית.
        </div>
      )}
      {state === "ready" && (
        <div className="map-toggle seg" role="group" aria-label="סוג מפה">
          <button type="button" aria-pressed={!aerial} onClick={() => setAerial(false)}>מפה</button>
          <button type="button" aria-pressed={aerial} onClick={() => setAerial(true)}>תצלום אוויר</button>
        </div>
      )}
      {state === "ready" && (
        <div className="map-note">
          {boundary === "loaded" && "קו מקווקו: גבול התכנית. לחיצה על המפה מסמנת מיקום."}
          {boundary === "missing" && "גבול התכנית טרם נטען למערכת. לחיצה על המפה מסמנת מיקום."}
          {boundary === "error" && "שגיאה בטעינת גבול התכנית. לחיצה על המפה מסמנת מיקום."}
          {boundary === "loading" && "טוען את גבול התכנית"}
        </div>
      )}
    </div>
  );
}
