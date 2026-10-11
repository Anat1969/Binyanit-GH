"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";

const ASHDOD: [number, number] = [34.655, 31.8];

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ml = (await import("maplibre-gl")).default;
        if (cancelled || !el.current) return;
        const m = new ml.Map({
          container: el.current,
          center: ASHDOD,
          zoom: 12.4,
          attributionControl: { compact: true },
          style: {
            version: 8,
            sources: {
              base: {
                type: "raster",
                tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`),
                tileSize: 256,
                attribution: "© OpenStreetMap contributors © CARTO",
              },
            },
            layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-saturation": -1 } }],
          },
        });
        map.current = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
        m.on("click", (e) => pickRef.current(e.lngLat.lat, e.lngLat.lng));
        m.on("load", async () => {
          setState("ready");
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
