"use client";

import { useEffect, useRef, useState } from "react";
import type { HotspotListItem } from "@/contracts/api";
import { SEVERITY_THRESHOLD } from "@/lib/score";

interface GlobeProps {
  hotspots: HotspotListItem[];
  onHotspotClick: (hotspot: HotspotListItem) => void;
  selectedId?: string | null;
}

/** Point GeoJSON — used for the heatmap source and the invisible click targets. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPointGeoJSON(hotspots: HotspotListItem[], selectedId?: string | null): any {
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

          // Insert below labels/roads so hotspot fills sit under place names
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const styleLayers: any[] = map.getStyle().layers;
          const firstLabelLayer = styleLayers.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any) => l.type === "symbol" && l.layout?.["text-field"]
          );
          const beforeId: string | undefined = firstLabelLayer?.id;

          map.addSource("hotspot-points", {
            type: "geojson",
            data: buildPointGeoJSON(hotspotsRef.current, selectedIdRef.current),
          });

          // ── Severity → color helper expression (reused across layers) ──────
          // Maps severity 0.15–1.0 to the dark-red ramp. Each layer is a
          // separate draw call per feature so hotspots never blend together.
          const severityColor = [
            "interpolate", ["linear"], ["get", "severity"],
            0.15, "#5A0000",
            0.40, "#8B0A00",
            0.65, "#CC2200",
            0.85, "#E83010",
            1.0,  "#FF4422",
          ];

          // ── Outer glow ────────────────────────────────────────────────────
          // Large soft halo — circle-blur 1.0 means the blur radius == circle
          // radius, giving a fully feathered Gaussian-like edge. Low opacity
          // keeps it atmospheric. Each feature blends only with itself.
          map.addLayer({
            id: "hotspot-outer",
            type: "circle",
            source: "hotspot-points",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                1, 38, 2, 55, 3, 78, 4, 115, 5, 160, 7, 220,
              ],
              "circle-color": severityColor,
              "circle-blur": 1.0,
              "circle-opacity": [
                "interpolate", ["linear"], ["get", "severity"],
                0.15, 0.18, 0.5, 0.28, 1.0, 0.38,
              ],
            },
          }, beforeId);

          // ── Mid ring ──────────────────────────────────────────────────────
          map.addLayer({
            id: "hotspot-mid",
            type: "circle",
            source: "hotspot-points",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                1, 20, 2, 30, 3, 44, 4, 65, 5, 90, 7, 130,
              ],
              "circle-color": severityColor,
              "circle-blur": 0.55,
              "circle-opacity": [
                "interpolate", ["linear"], ["get", "severity"],
                0.15, 0.30, 0.5, 0.44, 1.0, 0.58,
              ],
            },
          }, beforeId);

          // ── Core ──────────────────────────────────────────────────────────
          // Tight bright centre — minimal blur, highest opacity. Gives each
          // hotspot a crisp focal point even when outer rings overlap neighbors.
          map.addLayer({
            id: "hotspot-core",
            type: "circle",
            source: "hotspot-points",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                1, 7, 2, 11, 3, 16, 4, 24, 5, 34, 7, 50,
              ],
              "circle-color": severityColor,
              "circle-blur": 0.15,
              "circle-opacity": [
                "interpolate", ["linear"], ["get", "severity"],
                0.15, 0.60, 0.5, 0.78, 1.0, 0.92,
              ],
            },
          }, beforeId);

          // ── Invisible click-target circles ────────────────────────────────
          // Circle layers don't surface to queryRenderedFeatures by default
          // when blurred / transparent. A nearly-invisible overlay gives a
          // reliable hit area across all zoom levels.
          map.addLayer({
            id: "hotspot-click",
            type: "circle",
            source: "hotspot-points",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                1, 28,
                3, 55,
                5, 90,
                7, 150,
              ],
              // 0.001 — visually invisible but still hit-testable in MapLibre
              "circle-opacity": 0.001,
              "circle-color": "#000000",
            },
          });
        });

        // ── Click / hover ─────────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "hotspot-click", (e: any) => {
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

        map.on("mouseenter", "hotspot-click", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "hotspot-click", () => { map.getCanvas().style.cursor = ""; });

        // ── Auto-rotate ───────────────────────────────────────────────────
        function animate() {
          if (autoRotateRef.current && map.getZoom() < 2.5) {
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.1, center.lat] });
          }
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

  // ── Sync data whenever props change ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = map.getSource("hotspot-points") as any;
    if (source) source.setData(buildPointGeoJSON(hotspots, selectedId));
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
