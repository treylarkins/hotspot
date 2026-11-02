"use client";

import { useEffect, useRef, useState } from "react";
import { latLngToCell, gridRingUnsafe, cellsToMultiPolygon } from "h3-js";
import type { HotspotListItem } from "@/contracts/api";
import { SEVERITY_THRESHOLD } from "@/lib/score";

interface GlobeProps {
  hotspots: HotspotListItem[];
  onHotspotClick: (hotspot: HotspotListItem) => void;
  selectedId?: string | null;
}

// Ring opacity weights — raised so outer rings merge into the core at global zoom
const RING_WEIGHTS = [1.0, 0.72, 0.42] as const;

/** Severity (0.15–1.0) → base opacity */
function severityOpacity(severity: number): number {
  return 0.62 + 0.38 * Math.max(0, Math.min(1,
    (severity - SEVERITY_THRESHOLD) / (1 - SEVERITY_THRESHOLD)
  ));
}

/**
 * Build H3 ring polygons for all hotspots at res3 (≈69km cells).
 * 3 rings per hotspot: core → inner falloff → outer edge.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHotspotPolygons(hotspots: HotspotListItem[], selectedId?: string | null): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: any[] = [];

  for (const h of hotspots.filter(hs => hs.severity >= SEVERITY_THRESHOLD)) {
    const center = latLngToCell(h.lat, h.lng, 3);
    const baseOpacity = severityOpacity(h.severity);

    for (let r = 0; r < 3; r++) {
      const cells = r === 0 ? [center] : gridRingUnsafe(center, r);
      if (!cells.length) continue;
      const multiPoly = cellsToMultiPolygon(cells, true); // GeoJSON [lng, lat] order
      if (!multiPoly.length) continue;

      features.push({
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: multiPoly },
        properties: {
          id: h.id,
          severity: h.severity,
          ring: r,
          fillOpacity: RING_WEIGHTS[r] * baseOpacity,
          selected: h.id === selectedId,
          data: JSON.stringify(h),
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

export default function Globe({ hotspots, onHotspotClick, selectedId }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const autoRotateRef = useRef(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const clickCallbackRef = useRef(onHotspotClick);
  clickCallbackRef.current = onHotspotClick;

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
    let pulseT = 0;

    import("maplibre-gl").then(({ Map: MapLibreMap, setWorkerUrl }) => {
      if (cancelled) return;

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
          map.setProjection({ type: "globe" });
          map.setSky({
            "sky-color": "#000000",
            "horizon-color": "#0d0d0d",
            "fog-color": "#000000",
            "sky-horizon-blend": 0.1,
            "atmosphere-blend": 0.0,
          });

          // Insert before first label layer so fills sit under place names / roads
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const styleLayers: any[] = map.getStyle().layers;
          const firstLabelLayer = styleLayers.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any) => l.type === "symbol" && l.layout?.["text-field"]
          );
          const beforeId: string | undefined = firstLabelLayer?.id;

          // Single source — res3 fixed, no resolution switching
          map.addSource("hotspot-poly", {
            type: "geojson",
            data: buildHotspotPolygons(hotspotsRef.current, selectedIdRef.current),
          });

          // Severity → fill color
          const fillColor = [
            "interpolate", ["linear"], ["get", "severity"],
            0.15, "#7A0A0A",
            0.40, "#AA1500",
            0.65, "#CC2200",
            0.85, "#E83010",
            1.0,  "#FF3B1E",
          ];

          // Per-ring zoom-boosted opacity expressions.
          // At global zoom the outer rings get a guaranteed minimum so the
          // cluster reads as one solid blob; at zoom 5+ pure severity drives it.
          // Zoom-boosted opacity per ring — outer rings get a larger multiplier
          // at global zoom so the cluster reads as a solid blob; at zoom 5+ pure
          // severity-based fillOpacity takes over. Uses ["*", expr, factor] inside
          // interpolate stops (["max", expr, expr] fails silently in MapLibre 6).
          const opacityRing0 = ["interpolate", ["linear"], ["zoom"],
            1.0, ["*", ["get", "fillOpacity"], 1.5],
            3.0, ["*", ["get", "fillOpacity"], 1.2],
            5.0, ["get", "fillOpacity"],
          ];
          const opacityRing1 = ["interpolate", ["linear"], ["zoom"],
            1.0, ["*", ["get", "fillOpacity"], 1.9],
            3.0, ["*", ["get", "fillOpacity"], 1.4],
            5.0, ["get", "fillOpacity"],
          ];
          const opacityRing2 = ["interpolate", ["linear"], ["zoom"],
            1.0, ["*", ["get", "fillOpacity"], 2.4],
            3.0, ["*", ["get", "fillOpacity"], 1.7],
            5.0, ["get", "fillOpacity"],
          ];

          // Add outer rings first so inner rings paint on top
          map.addLayer({
            id: "hotspot-ring-2",
            type: "fill",
            source: "hotspot-poly",
            filter: ["==", ["get", "ring"], 2],
            paint: { "fill-color": fillColor, "fill-opacity": opacityRing2, "fill-antialias": false },
          }, beforeId);

          map.addLayer({
            id: "hotspot-ring-1",
            type: "fill",
            source: "hotspot-poly",
            filter: ["==", ["get", "ring"], 1],
            paint: { "fill-color": fillColor, "fill-opacity": opacityRing1, "fill-antialias": false },
          }, beforeId);

          map.addLayer({
            id: "hotspot-ring-0",
            type: "fill",
            source: "hotspot-poly",
            filter: ["==", ["get", "ring"], 0],
            paint: { "fill-color": fillColor, "fill-opacity": opacityRing0, "fill-antialias": false },
          }, beforeId);

          // Pulse layer: ring-0, severity > 0.7 — opacity animated in rAF loop
          map.addLayer({
            id: "hotspot-pulse",
            type: "fill",
            source: "hotspot-poly",
            filter: ["all", ["==", ["get", "ring"], 0], [">", ["get", "severity"], 0.7]],
            paint: { "fill-color": "#FF5030", "fill-opacity": 0, "fill-antialias": false },
          }, beforeId);
        });

        // Click on ring-0 (the core fill) — entire core area is clickable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "hotspot-ring-0", (e: any) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const hotspot = JSON.parse(feature.properties.data) as HotspotListItem;
          autoRotateRef.current = false;
          clearTimeout(resumeTimer);
          clickCallbackRef.current(hotspot);
          map.flyTo({
            center: [hotspot.lng, hotspot.lat] as [number, number],
            zoom: Math.max(map.getZoom(), 4),
            duration: 900,
          });
          resumeTimer = setTimeout(() => { autoRotateRef.current = true; }, 12000);
        });

        map.on("mouseenter", "hotspot-ring-0", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "hotspot-ring-0", () => { map.getCanvas().style.cursor = ""; });

        // ── Animation loop: auto-rotate + pulse ───────────────────────────
        function animate() {
          if (autoRotateRef.current && map.getZoom() < 2.5) {
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.1, center.lat] });
          }

          pulseT += 0.004; // ~2 s cycle at 60 fps
          const pulseOpacity = 0.15 * Math.max(0, Math.sin(pulseT * Math.PI * 2));
          try {
            if (map.getLayer("hotspot-pulse")) {
              map.setPaintProperty("hotspot-pulse", "fill-opacity", pulseOpacity);
            }
          } catch { /* layer not ready yet */ }

          animFrameId = requestAnimationFrame(animate);
        }
        animFrameId = requestAnimationFrame(animate);

        map.on("dragstart", () => {
          autoRotateRef.current = false;
          clearTimeout(resumeTimer);
        });
        map.on("dragend", () => {
          resumeTimer = setTimeout(() => { autoRotateRef.current = true; }, 3000);
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
    const source = map.getSource("hotspot-poly") as any;
    if (source) source.setData(buildHotspotPolygons(hotspots, selectedId));
  }, [hotspots, selectedId]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
        <p className="text-gray-500 text-xs">{mapError}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative" data-testid="globe-container" />
  );
}
