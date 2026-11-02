"use client";

import { useEffect, useRef, useState } from "react";
import type { HotspotListItem } from "@/contracts/api";
import { SEVERITY_THRESHOLD } from "@/lib/score";

interface GlobeProps {
  hotspots: HotspotListItem[];
  onHotspotClick: (hotspot: HotspotListItem) => void;
  selectedId?: string | null;
}

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
          category: h.category ?? "power",
          data: JSON.stringify(h),
        },
      })),
  };
}

// ── Thermal palette ─────────────────────────────────────────────────────────
// 6 shades per category: [atmosphere, outer, mid-outer, mid, inner, core]
// Progression mirrors a thermal/infrared camera: cold dark edge → hot bright centre.
// The near-white core gives the "burning focal point" effect; the atmospheric edge
// fades to near-black so hotspots lift cleanly off the dark globe.
const PALETTE: Record<string, readonly string[]> = {
  money:      ["#1C0F00", "#6B3300", "#B86200", "#F59E0B", "#FDE68A", "#FFFBEB"],
  power:      ["#1C0505", "#621010", "#991B1B", "#EF4444", "#FECACA", "#FFF1F2"],
  resources:  ["#011A0E", "#063B22", "#065236", "#10B981", "#6EE7B7", "#F0FDF4"],
  technology: ["#0D0A28", "#231C6B", "#3730A3", "#818CF8", "#C7D2FE", "#EEF2FF"],
};

// ── Layer stack ──────────────────────────────────────────────────────────────
// Each entry drives one circle layer. Index 0 = outermost atmosphere; 5 = hot core.
//
// Radii: geometric progression (~0.70× each step inward). Outer layers are 15×
// the core radius so the atmospheric halo covers a realistic geographic footprint.
//
// Blur: 1.0 on outer layers = pure Gaussian falloff (radius IS the sigma).
//       Drops toward 0 at the core to produce a crisp luminous point.
//
// Base opacity: deliberately low on outer layers — they exist to build the glow,
//   not dominate it. Severity multiplies the final value up or down.
const LAYERS = [
  // id          palette slot  blur    base-op  radii [z1, z2, z3, z4, z5, z7]
  { id: "atm",   slot: 0,  blur: 1.00, op: 0.22, r: [88,  120, 168, 235, 320, 440] },
  { id: "out",   slot: 1,  blur: 0.92, op: 0.30, r: [62,   85, 118, 165, 225, 308] },
  { id: "mid1",  slot: 2,  blur: 0.76, op: 0.40, r: [43,   59,  82, 115, 156, 214] },
  { id: "mid2",  slot: 3,  blur: 0.55, op: 0.54, r: [28,   39,  54,  76, 103, 141] },
  { id: "inn",   slot: 4,  blur: 0.28, op: 0.72, r: [15,   21,  29,  41,  56,  76] },
  { id: "core",  slot: 5,  blur: 0.07, op: 0.90, r: [6,     8,  11,  16,  22,  30] },
] as const;

// Build a MapLibre "match" expression for a palette slot across all categories.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function catColor(slot: number): any {
  return [
    "match", ["get", "category"],
    "money",      PALETTE.money[slot],
    "power",      PALETTE.power[slot],
    "resources",  PALETTE.resources[slot],
    "technology", PALETTE.technology[slot],
    PALETTE.power[slot],
  ];
}

// Severity → opacity multiplier: high-severity hotspots burn bright; low ones smoulder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sevMult(): any {
  return ["interpolate", ["linear"], ["get", "severity"],
    0.15, 0.42,
    0.40, 0.66,
    0.70, 0.88,
    1.0,  1.0,
  ];
}

// Build the full opacity expression: base × severity multiplier
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function layerOpacity(base: number): any {
  return ["*", base, sevMult()];
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

          // ── Thermal layers: atmosphere outward → hot core ─────────────────
          // Rendered bottom-to-top: each inner layer composites over the outer,
          // building up from dark atmospheric tint to the near-white burning core.
          for (const layer of LAYERS) {
            map.addLayer(
              {
                id: `hotspot-${layer.id}`,
                type: "circle",
                source: "hotspot-points",
                paint: {
                  "circle-radius": [
                    "interpolate", ["linear"], ["zoom"],
                    1, layer.r[0],
                    2, layer.r[1],
                    3, layer.r[2],
                    4, layer.r[3],
                    5, layer.r[4],
                    7, layer.r[5],
                  ],
                  "circle-color":   catColor(layer.slot),
                  "circle-blur":    layer.blur,
                  "circle-opacity": layerOpacity(layer.op),
                },
              },
              beforeId
            );
          }

          // ── Invisible click-target ────────────────────────────────────────
          // Not inserted before `beforeId` — sits on top of labels so pointer
          // events fire reliably even when the map is fully zoomed in.
          map.addLayer({
            id: "hotspot-click",
            type: "circle",
            source: "hotspot-points",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                1, 32, 3, 65, 5, 105, 7, 160,
              ],
              "circle-opacity": 0.001,
              "circle-color": "#000000",
            },
          });
        });

        // ── Click / hover ──────────────────────────────────────────────────
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

        // ── Auto-rotate + pulse ────────────────────────────────────────────
        // The inner-glow layer (slot 4, bright category colour) pulses gently.
        // Throttled to every 6 frames (~10Hz) to keep GPU load minimal.
        // Pulse range: base_op × [0.72 … 1.0] — subtle, not flashy.
        let pulsePhase = 0;
        let pulseFrame = 0;
        const INN = LAYERS[4]; // inner-glow layer

        function animate() {
          if (autoRotateRef.current && map.getZoom() < 2.5) {
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.1, center.lat] });
          }

          pulsePhase += 0.028;
          pulseFrame++;
          if (pulseFrame >= 6) {
            pulseFrame = 0;
            const p = 0.82 + 0.18 * Math.sin(pulsePhase); // 0.64 … 1.0
            if (map.getLayer(`hotspot-${INN.id}`)) {
              map.setPaintProperty(`hotspot-${INN.id}`, "circle-opacity", [
                "*", INN.op * p, sevMult(),
              ]);
            }
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
