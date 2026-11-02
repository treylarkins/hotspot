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

// Opacity weight per ring index: core is full, outer rings fade
const RING_WEIGHTS = [1.0, 0.52, 0.20] as const;

/** Severity (0.15–1.0) → base opacity (raised floor so nothing disappears) */
function severityOpacity(severity: number): number {
  return 0.48 + 0.52 * Math.max(0, Math.min(1,
    (severity - SEVERITY_THRESHOLD) / (1 - SEVERITY_THRESHOLD)
  ));
}

/**
 * Build a GeoJSON FeatureCollection of H3 ring polygons.
 * Each hotspot produces `numRings` features (ring 0 = core, ring 1+ = falloff).
 * `resolution` controls cell size: 3 ≈ 69km (regional), 4 ≈ 26km (city).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHotspotPolygons(
  hotspots: HotspotListItem[],
  resolution: number,
  numRings: number,
  selectedId?: string | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: any[] = [];

  for (const h of hotspots.filter(hs => hs.severity >= SEVERITY_THRESHOLD)) {
    const center = latLngToCell(h.lat, h.lng, resolution);
    const baseOpacity = severityOpacity(h.severity);

    for (let r = 0; r < numRings; r++) {
      const cells = r === 0 ? [center] : gridRingUnsafe(center, r);
      if (!cells.length) continue;

      // cellsToMultiPolygon(cells, true) → GeoJSON [lng, lat] coordinate order
      const multiPoly = cellsToMultiPolygon(cells, true);
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

/** Point source — tiny center pins used as precise click targets. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPinGeoJSON(hotspots: HotspotListItem[], selectedId?: string | null): any {
  return {
    type: "FeatureCollection",
    features: hotspots
      .filter(h => h.severity >= SEVERITY_THRESHOLD)
      .map(h => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.lng, h.lat] },
        properties: {
          id: h.id,
          severity: h.severity,
          selected: h.id === selectedId,
          data: JSON.stringify(h),
        },
      })),
  };
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

  // Dedupe clicks that fire from both pin + ring-0 on the same gesture
  const lastClickRef = useRef<{ id: string; ts: number } | null>(null);

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

          // Insert hotspot layers before the first label layer so they sit
          // under place names and roads but above terrain fills.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const styleLayers: any[] = map.getStyle().layers;
          const firstLabelLayer = styleLayers.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any) => l.type === "symbol" && l.layout?.["text-field"]
          );
          const beforeId: string | undefined = firstLabelLayer?.id;

          // ── Sources ──────────────────────────────────────────────────────
          map.addSource("hotspot-poly-low", {
            type: "geojson",
            data: buildHotspotPolygons(hotspotsRef.current, 3, 3, selectedIdRef.current),
          });
          map.addSource("hotspot-poly-high", {
            type: "geojson",
            data: buildHotspotPolygons(hotspotsRef.current, 4, 2, selectedIdRef.current),
          });
          map.addSource("hotspot-pins", {
            type: "geojson",
            data: buildPinGeoJSON(hotspotsRef.current, selectedIdRef.current),
          });

          // Severity → fill color (shared expression)
          const fillColorExpr = [
            "interpolate", ["linear"], ["get", "severity"],
            0.15, "#7A0A0A",
            0.40, "#AA1500",
            0.65, "#CC2200",
            0.85, "#E83010",
            1.0,  "#FF3B1E",
          ];

          // ── Low-zoom fill layers (zoom 1–5, res3 ≈ 69km cells) ───────────
          // Add outer rings first so inner rings paint over them
          for (let r = 2; r >= 0; r--) {
            map.addLayer({
              id: `hotspot-ring-low-${r}`,
              type: "fill",
              source: "hotspot-poly-low",
              filter: ["==", ["get", "ring"], r],
              maxzoom: 5.5,
              paint: {
                "fill-color": fillColorExpr,
                "fill-opacity": ["get", "fillOpacity"],
                "fill-antialias": false,
              },
            }, beforeId);
          }

          // Low-zoom pulse layer: ring-0 only, high-severity only, opacity driven by rAF
          map.addLayer({
            id: "hotspot-pulse-low",
            type: "fill",
            source: "hotspot-poly-low",
            filter: ["all", ["==", ["get", "ring"], 0], [">", ["get", "severity"], 0.7]],
            maxzoom: 5.5,
            paint: {
              "fill-color": "#FF5030",
              "fill-opacity": 0,
              "fill-antialias": false,
            },
          }, beforeId);

          // ── High-zoom fill layers (zoom 4–10, res4 ≈ 26km cells) ─────────
          for (let r = 1; r >= 0; r--) {
            map.addLayer({
              id: `hotspot-ring-high-${r}`,
              type: "fill",
              source: "hotspot-poly-high",
              filter: ["==", ["get", "ring"], r],
              minzoom: 4,
              paint: {
                "fill-color": fillColorExpr,
                "fill-opacity": ["get", "fillOpacity"],
                "fill-antialias": false,
              },
            }, beforeId);
          }

          // High-zoom pulse layer
          map.addLayer({
            id: "hotspot-pulse-high",
            type: "fill",
            source: "hotspot-poly-high",
            filter: ["all", ["==", ["get", "ring"], 0], [">", ["get", "severity"], 0.7]],
            minzoom: 4,
            paint: {
              "fill-color": "#FF5030",
              "fill-opacity": 0,
              "fill-antialias": false,
            },
          }, beforeId);

          // ── Pin layer: precise center dot, always on top ───────────────────
          map.addLayer({
            id: "hotspot-pin",
            type: "circle",
            source: "hotspot-pins",
            paint: {
              "circle-radius": ["case", ["==", ["get", "selected"], true], 5, 3],
              "circle-color": [
                "case",
                ["==", ["get", "selected"], true], "#ffffff",
                ["interpolate", ["linear"], ["get", "severity"],
                  0.15, "#CC3333",
                  1.0,  "#FF3B1E",
                ],
              ],
              "circle-stroke-width": ["case", ["==", ["get", "selected"], true], 2, 0],
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.95,
            },
          });
        });

        // ── Click handler (deduped within 80ms) ───────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function handleHotspotClick(e: any) {
          const feature = e.features?.[0];
          if (!feature) return;
          const hotspot = JSON.parse(feature.properties.data) as HotspotListItem;

          const now = Date.now();
          if (lastClickRef.current?.id === hotspot.id && now - lastClickRef.current.ts < 80) return;
          lastClickRef.current = { id: hotspot.id, ts: now };

          autoRotateRef.current = false;
          clearTimeout(resumeTimer);
          clickCallbackRef.current(hotspot);
          map.flyTo({
            center: [hotspot.lng, hotspot.lat] as [number, number],
            zoom: Math.max(map.getZoom(), 4),
            duration: 900,
          });
          resumeTimer = setTimeout(() => { autoRotateRef.current = true; }, 12000);
        }

        ["hotspot-pin", "hotspot-ring-low-0", "hotspot-ring-high-0"].forEach(id => {
          map.on("click", id, handleHotspotClick);
        });

        // Cursor pointer on hover
        ["hotspot-pin", "hotspot-ring-low-0", "hotspot-ring-high-0"].forEach(id => {
          map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
        });

        // ── Animation loop: auto-rotate + pulse ───────────────────────────
        function animate() {
          // Auto-rotate at low zoom
          if (autoRotateRef.current && map.getZoom() < 2.5) {
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.1, center.lat] });
          }

          // Pulse: sine wave → fill-opacity on high-severity ring-0 only
          pulseT += 0.004; // ~2 s cycle at 60fps
          const pulseOpacity = 0.13 * Math.max(0, Math.sin(pulseT * Math.PI * 2));
          try {
            if (map.getLayer("hotspot-pulse-low")) {
              map.setPaintProperty("hotspot-pulse-low", "fill-opacity", pulseOpacity);
            }
            if (map.getLayer("hotspot-pulse-high")) {
              map.setPaintProperty("hotspot-pulse-high", "fill-opacity", pulseOpacity);
            }
          } catch { /* layer may not be ready on first frames */ }

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
    const polyLow  = map.getSource("hotspot-poly-low")  as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const polyHigh = map.getSource("hotspot-poly-high") as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pins     = map.getSource("hotspot-pins")      as any;
    if (polyLow)  polyLow.setData(buildHotspotPolygons(hotspots, 3, 3, selectedId));
    if (polyHigh) polyHigh.setData(buildHotspotPolygons(hotspots, 4, 2, selectedId));
    if (pins)     pins.setData(buildPinGeoJSON(hotspots, selectedId));
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
