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

// ── Thermographic palette ────────────────────────────────────────────────────
//
// Replicates the scientific IR / thermal-camera colour ramp:
//   near-black → deep indigo → vivid violet → crimson → orange → amber-gold
//
// This is the ramp used in real thermographic world maps (NASA, satellite
// imagery, the Shutterstock reference image). The PURPLE ATMOSPHERE is the
// dominant visual element — it extends far beyond the hot core and gives the
// "glowing from within" feel. The orange/yellow core is small and intense.
//
// Category differentiation: only the atmosphere layer (slot 0) carries a faint
// category tint (barely visible on the dark globe). Every other layer uses the
// fixed thermographic ramp so all hotspots share the same language.

// Slot 0 — atmospheric tint, per-category (very dark, ~15% of full colour)
const CAT_ATM: Record<string, string> = {
  money:      "#180D00",   // near-black amber
  power:      "#0A0620",   // near-black indigo
  resources:  "#041008",   // near-black forest green
  technology: "#040718",   // near-black navy
};

// Slots 1-4 — fixed thermographic ramp (same for every category)
const THERMO: readonly string[] = [
  "#1E0855",   // 1 outer      — deep indigo/violet
  "#7200CC",   // 2 mid-outer  — vivid violet        (the signature purple)
  "#C40A22",   // 3 mid        — crimson-red          (purple → red transition)
  "#FF4800",   // 4 inner      — orange               (pulses)
];

// Slot 5 — core: severity-driven from dim orange to blazing gold
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CORE_COLOR: any = [
  "interpolate", ["linear"], ["get", "severity"],
  0.15, "#FF7A00",   // dim amber at threshold
  0.45, "#FFAA00",   // gold at medium
  0.75, "#FFD200",   // bright gold at high
  1.0,  "#FFE800",   // near-white yellow at max
];

// Build a color expression for a given slot
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function slotColor(slot: number): any {
  if (slot === 0) {
    return [
      "match", ["get", "category"],
      "money",      CAT_ATM.money,
      "power",      CAT_ATM.power,
      "resources",  CAT_ATM.resources,
      "technology", CAT_ATM.technology,
      CAT_ATM.power,
    ];
  }
  if (slot === 5) return CORE_COLOR;
  return THERMO[slot - 1];
}

// Severity → global opacity multiplier
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sevMult(): any {
  return [
    "interpolate", ["linear"], ["get", "severity"],
    0.15, 0.40,
    0.45, 0.70,
    0.75, 0.90,
    1.0,  1.0,
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function layerOpacity(base: number): any {
  return ["*", base, sevMult()];
}

// ── Layer stack ──────────────────────────────────────────────────────────────
//
// The outer layers (atm, out, mid1) are the PURPLE BAND — they must be large
// and visible, not just hints. This is what the reference image emphasises:
// a massive violet halo that dwarfs the bright inner zone.
//
// Radius ratio between each layer: ~0.70× inward.
// Atmosphere radius vs core radius: ~16:1 — same dramatic ratio as IR images.
//
//                         blur    base-op   radii [z1,  z2,  z3,  z4,  z5,  z7 ]
const LAYERS = [
  { id: "atm",  slot: 0, blur: 1.00, op: 0.28, r: [100, 136, 190, 266, 360, 490] },  // near-black category tint
  { id: "out",  slot: 1, blur: 0.95, op: 0.38, r: [72,  98,  137, 192, 260, 354] },  // deep violet — large halo
  { id: "mid1", slot: 2, blur: 0.80, op: 0.50, r: [50,  68,  95,  133, 180, 244] },  // vivid violet — the signature
  { id: "mid2", slot: 3, blur: 0.58, op: 0.62, r: [33,  45,  63,  88,  120, 163] },  // crimson-red
  { id: "inn",  slot: 4, blur: 0.28, op: 0.78, r: [17,  23,  32,  45,  61,  83]  },  // orange — PULSES
  { id: "core", slot: 5, blur: 0.06, op: 0.94, r: [6,   8,   11,  16,  22,  30]  },  // bright gold core
] as const;

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

          // Deep navy atmosphere — closer to the reference image background colour
          map.setSky({
            "sky-color":          "#050318",
            "horizon-color":      "#080520",
            "fog-color":          "#040215",
            "sky-horizon-blend":  0.08,
            "atmosphere-blend":   0.0,
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

          // ── Thermographic layers: cold edge → hot core ─────────────────────
          // Rendered bottom-to-top (outermost first). The purple band (out+mid1)
          // is the largest and most opaque element — it dominates the visual like
          // the violet atmosphere in the reference image.
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
                  "circle-color":   slotColor(layer.slot),
                  "circle-blur":    layer.blur,
                  "circle-opacity": layerOpacity(layer.op),
                },
              },
              beforeId
            );
          }

          // ── Invisible click-target ────────────────────────────────────────
          map.addLayer({
            id: "hotspot-click",
            type: "circle",
            source: "hotspot-points",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                1, 35, 3, 70, 5, 110, 7, 170,
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
        // The orange inner-glow layer pulses — like heat radiating outward.
        // The violet mid layers are stable (they are the "cold" zone).
        // The gold core is stable (crisp reference point).
        let pulsePhase = 0;
        let pulseFrame = 0;
        const INN = LAYERS[4]; // "inn" — orange layer

        function animate() {
          if (autoRotateRef.current && map.getZoom() < 2.5) {
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.1, center.lat] });
          }

          // Pulse ~10Hz (every 6 frames at 60fps). Range: ×0.65 → ×1.0
          pulsePhase += 0.030;
          pulseFrame++;
          if (pulseFrame >= 6) {
            pulseFrame = 0;
            const p = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(pulsePhase));
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
