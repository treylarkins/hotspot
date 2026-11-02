"use client";

import { useEffect, useRef, useState } from "react";
import { latLngToCell, gridRingUnsafe, cellToBoundary } from "h3-js";
import type { HotspotListItem } from "@/contracts/api";
import { SEVERITY_THRESHOLD, THERMO_CAT } from "@/lib/score";

interface GlobeProps {
  hotspots: HotspotListItem[];
  onHotspotClick: (hotspot: HotspotListItem) => void;
  selectedId?: string | null;
}


const H3_RES  = 3;   // ~69 km edge — tile size visible at global zoom
const N_RINGS = 2;   // rings 0 (center), 1, 2

// ── GeoJSON builder ──────────────────────────────────────────────────────────
// Produces one polygon Feature per H3 cell so MapLibre renders the hex grid.
// Features are ordered outer-ring first, higher severity last, so important
// hotspot centres always composite on top.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHexGeoJSON(hotspots: HotspotListItem[], selectedId?: string | null): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byRing: any[][] = [[], [], []]; // index = ring number

  for (const h of hotspots) {
    if (h.severity < SEVERITY_THRESHOLD) continue;
    const cat      = h.category ?? "power";
    const center   = latLngToCell(h.lat, h.lng, H3_RES);
    const selected = h.id === selectedId;
    const dataStr  = JSON.stringify(h);

    for (let ring = 0; ring <= N_RINGS; ring++) {
      const cells = ring === 0 ? [center] : gridRingUnsafe(center, ring);
      for (const cell of cells) {
        // cellToBoundary returns [lat, lng]; GeoJSON needs [lng, lat]
        const boundary = cellToBoundary(cell);
        const coords   = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
        coords.push(coords[0]); // close polygon ring

        byRing[ring].push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: {
            hotspot_id: h.id,
            category:   cat,
            severity:   h.severity,
            ring,
            selected,
            data: dataStr,
          },
        });
      }
    }
  }

  // Outer rings first so inner rings (and higher severity) paint on top
  return {
    type: "FeatureCollection",
    features: [...byRing[2], ...byRing[1], ...byRing[0]],
  };
}

// Opacity expression for fill — ring falloff × severity multiplier.
// pulseFactor is varied in the animate loop (ring-0 only).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillOpacity(pulseR0 = 1.0): any {
  const ringBase = [
    "match", ["get", "ring"],
    0, 0.82 * pulseR0,
    1, 0.46,
    2, 0.18,
    0.08, // outside max ring — shouldn't occur
  ];
  const sevScale = [
    "interpolate", ["linear"], ["get", "severity"],
    0.15, 0.42,
    0.50, 0.72,
    1.0,  1.0,
  ];
  return ["*", ringBase, sevScale];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillColor(): any {
  return [
    "match", ["get", "category"],
    "technology", THERMO_CAT.technology,
    "power",      THERMO_CAT.power,
    "resources",  THERMO_CAT.resources,
    "money",      THERMO_CAT.money,
    THERMO_CAT.power,
  ];
}

export default function Globe({ hotspots, onHotspotClick, selectedId }: GlobeProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef        = useRef<any>(null);
  const autoRotateRef = useRef(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const clickCallbackRef  = useRef(onHotspotClick);
  clickCallbackRef.current = onHotspotClick;

  const hotspotsRef  = useRef(hotspots);
  hotspotsRef.current = hotspots;
  const selectedIdRef  = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled    = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    let animFrameId: number;
    let resumeTimer:  ReturnType<typeof setTimeout>;

    import("maplibre-gl").then(({ Map: MapLibreMap, setWorkerUrl }) => {
      if (cancelled) return;
      setWorkerUrl("/maplibre-gl-worker.mjs");

      try {
        map = new MapLibreMap({
          container: containerRef.current!,
          style:     "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          center:    [0, 20] as [number, number],
          zoom:      1.5,
          minZoom:   1,
          maxZoom:   10,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on("load", () => {
          map.setProjection({ type: "globe" });

          map.setSky({
            "sky-color":         "#050318",
            "horizon-color":     "#080520",
            "fog-color":         "#040215",
            "sky-horizon-blend": 0.08,
            "atmosphere-blend":  0.0,
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const styleLayers: any[] = map.getStyle().layers;
          const firstLabel = styleLayers.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any) => l.type === "symbol" && l.layout?.["text-field"]
          );
          const beforeId: string | undefined = firstLabel?.id;

          map.addSource("hex-cells", {
            type: "geojson",
            data: buildHexGeoJSON(hotspotsRef.current, selectedIdRef.current),
          });

          // ── Hex fill ──────────────────────────────────────────────────────
          // Single solid colour per category tile; opacity fades by ring.
          map.addLayer(
            {
              id:     "hex-fill",
              type:   "fill",
              source: "hex-cells",
              paint: {
                "fill-color":     fillColor(),
                "fill-opacity":   fillOpacity(),
                "fill-antialias": true,
              },
            },
            beforeId
          );

          // ── Hex grid lines ─────────────────────────────────────────────────
          // Thin dark outlines reveal the hexagonal tile structure — the
          // "grid patternistic" aesthetic. Slightly thicker when zoomed in.
          map.addLayer(
            {
              id:     "hex-lines",
              type:   "line",
              source: "hex-cells",
              paint: {
                "line-color":   "#000000",
                "line-opacity": 0.30,
                "line-width": [
                  "interpolate", ["linear"], ["zoom"],
                  1, 0.3,
                  4, 0.6,
                  7, 1.0,
                ],
              },
            },
            beforeId
          );

          // ── Selected ring-0 highlight ─────────────────────────────────────
          // White stroke on the centre cell of the selected hotspot.
          map.addLayer({
            id:     "hex-selected",
            type:   "line",
            source: "hex-cells",
            filter: ["all", ["==", ["get", "selected"], true], ["==", ["get", "ring"], 0]],
            paint: {
              "line-color":   "#ffffff",
              "line-opacity": 0.85,
              "line-width":   1.5,
            },
          });
        });

        // ── Click on any hex cell ─────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "hex-fill", (e: any) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const hotspot = JSON.parse(feature.properties.data) as HotspotListItem;
          autoRotateRef.current = false;
          clearTimeout(resumeTimer);
          clickCallbackRef.current(hotspot);
          map.flyTo({
            center:   [hotspot.lng, hotspot.lat] as [number, number],
            zoom:     Math.max(map.getZoom(), 4),
            duration: 900,
          });
          resumeTimer = setTimeout(() => { autoRotateRef.current = true; }, 12000);
        });

        map.on("mouseenter", "hex-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "hex-fill", () => { map.getCanvas().style.cursor = ""; });

        // ── Auto-rotate + pulse ───────────────────────────────────────────
        // Ring-0 (centre tile) pulses — thermal shimmer effect.
        let pulsePhase = 0;
        let pulseFrame = 0;

        function animate() {
          if (autoRotateRef.current && map.getZoom() < 2.5) {
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.1, center.lat] });
          }

          pulsePhase += 0.028;
          pulseFrame++;
          if (pulseFrame >= 6) {
            pulseFrame = 0;
            const p = 0.80 + 0.20 * (0.5 + 0.5 * Math.sin(pulsePhase));
            if (map.getLayer("hex-fill")) {
              map.setPaintProperty("hex-fill", "fill-opacity", fillOpacity(p));
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

  // ── Sync whenever props change ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = map.getSource("hex-cells") as any;
    if (source) source.setData(buildHexGeoJSON(hotspots, selectedId));
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
