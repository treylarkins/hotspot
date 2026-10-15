"use client";

import { useEffect, useRef, useState } from "react";
import type { HotspotListItem } from "../contracts/api";
import { SEVERITY_THRESHOLD } from "../lib/score";
import { CATEGORY_COLORS } from "../config/sources";

interface GlobeProps {
  hotspots: HotspotListItem[];
  onHotspotClick: (hotspot: HotspotListItem) => void;
  selectedId?: string | null;
  onZoomChange?: (altitude: number, lat: number, lng: number) => void;
}

/** MapLibre zoom level → altitude value compatible with altitudeToResolution() */
function zoomToAltitude(zoom: number): number {
  return Math.pow(2, 4 - zoom) * 1.25;
}

/** Severity (0.15–1.0) → opacity blend (0.25–1.0) */
function severityBlend(severity: number): number {
  return 0.25 + 0.75 * Math.max(0, Math.min(1, (severity - SEVERITY_THRESHOLD) / (1 - SEVERITY_THRESHOLD)));
}

function categoryColor(hotspot: HotspotListItem): string {
  const cat = (hotspot.category ?? hotspot.region ?? "general") as keyof typeof CATEGORY_COLORS;
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.general;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGeoJSON(hotspots: HotspotListItem[], selectedId?: string | null): any {
  return {
    type: "FeatureCollection",
    features: hotspots
      .filter((h) => h.severity >= SEVERITY_THRESHOLD)
      .map((h) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.lng, h.lat] },
        properties: {
          id: h.id,
          color: h.id === selectedId ? "#ffffff" : categoryColor(h),
          opacity: severityBlend(h.severity),
          radius: Math.sqrt(h.article_count) * 3,
          data: JSON.stringify(h),
        },
      })),
  };
}

const LEGEND_ENTRIES = Object.entries(CATEGORY_COLORS) as [keyof typeof CATEGORY_COLORS, string][];

export default function Globe({ hotspots, onHotspotClick, selectedId, onZoomChange }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const autoRotateRef = useRef(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Always-fresh callback refs so closures in useEffect don't stale
  const zoomCallbackRef = useRef(onZoomChange);
  zoomCallbackRef.current = onZoomChange;
  const clickCallbackRef = useRef(onHotspotClick);
  clickCallbackRef.current = onHotspotClick;

  // Latest prop refs so the async `load` handler can snapshot current values
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    let animFrameId: number;
    let resumeTimer: ReturnType<typeof setTimeout>;

    import("maplibre-gl").then(({ Map: MapLibreMap, setWorkerUrl }) => {
      if (cancelled) return;

      // Point MapLibre at the worker file served from public/
      setWorkerUrl("/maplibre-gl-worker.mjs");

      try {
        map = new MapLibreMap({
        container: containerRef.current!,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: [0, 20] as [number, number],
        zoom: 1.5,
        minZoom: 1,
        maxZoom: 10,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        // Globe projection + dark space sky
        map.setProjection({ type: "globe" });
        map.setSky({
          "sky-color": "#000000",
          "horizon-color": "#0d0d0d",
          "fog-color": "#000000",
          "sky-horizon-blend": 0.1,
          "atmosphere-blend": 0.0,
        });

        // GeoJSON source — snapshot latest props at load time
        map.addSource("hotspots", {
          type: "geojson",
          data: buildGeoJSON(hotspotsRef.current, selectedIdRef.current),
        });

        // Halo layer: blurred glow behind each dot
        map.addLayer({
          id: "hotspot-halo",
          type: "circle",
          source: "hotspots",
          paint: {
            "circle-color": ["get", "color"],
            "circle-opacity": 0.2,
            "circle-radius": ["*", ["get", "radius"], 2.2],
            "circle-blur": 1,
          },
        });

        // Main dot layer
        map.addLayer({
          id: "hotspot-dot",
          type: "circle",
          source: "hotspots",
          paint: {
            "circle-color": ["get", "color"],
            "circle-opacity": ["get", "opacity"],
            "circle-radius": ["get", "radius"],
          },
        });
      });

      // Click → fire callback + fly to hotspot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", "hotspot-dot", (e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const hotspot = JSON.parse(feature.properties.data) as HotspotListItem;
        autoRotateRef.current = false;
        clickCallbackRef.current(hotspot);
        map.flyTo({
          center: [hotspot.lng, hotspot.lat] as [number, number],
          zoom: Math.max(map.getZoom(), 4),
          duration: 900,
        });
        setTimeout(() => { autoRotateRef.current = true; }, 12000);
      });

      // Cursor pointer on hover
      map.on("mouseenter", "hotspot-dot", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "hotspot-dot", () => { map.getCanvas().style.cursor = ""; });

      // Auto-rotate via requestAnimationFrame — only at global zoom
      function rotate() {
        if (autoRotateRef.current && map.getZoom() < 2.5) {
          const center = map.getCenter();
          map.jumpTo({ center: [center.lng + 0.1, center.lat] });
        }
        animFrameId = requestAnimationFrame(rotate);
      }
      animFrameId = requestAnimationFrame(rotate);

      // Stop rotation on user drag; resume 3s after drag ends
      map.on("dragstart", () => {
        autoRotateRef.current = false;
        clearTimeout(resumeTimer);
      });
      map.on("dragend", () => {
        resumeTimer = setTimeout(() => { autoRotateRef.current = true; }, 3000);
        const center = map.getCenter();
        zoomCallbackRef.current?.(zoomToAltitude(map.getZoom()), center.lat, center.lng);
      });
      map.on("zoomend", () => {
        const center = map.getCenter();
        zoomCallbackRef.current?.(zoomToAltitude(map.getZoom()), center.lat, center.lng);
      });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMapError(msg.includes("WebGL") ? "WebGL2 not available in this browser" : "Map failed to initialize");
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameId);
      clearTimeout(resumeTimer);
      map?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync hotspot data whenever props change ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = map.getSource("hotspots") as any;
    if (!source) return;
    source.setData(buildGeoJSON(hotspots, selectedId));
  }, [hotspots, selectedId]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
        <p className="text-gray-500 text-xs">{mapError}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative" data-testid="globe-container">
      {/* Category legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none z-10">
        {LEGEND_ENTRIES.map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              style={{ background: color, width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }}
            />
            <span
              style={{
                color,
                fontSize: 10,
                fontFamily: "system-ui",
                textTransform: "capitalize",
                letterSpacing: "0.05em",
              }}
            >
              {cat}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
