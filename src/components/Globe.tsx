"use client";

import { useEffect, useRef, useState } from "react";
import { latLngToCell, gridDisk, cellToBoundary } from "h3-js";
import type { HotspotListItem } from "@/contracts/api";
import { SEVERITY_THRESHOLD, THERMO_CAT } from "@/lib/score";
import { loadCountryHex, getCountryCells } from "@/lib/countryHex";

interface GlobeProps {
  hotspots: HotspotListItem[];
  onHotspotClick: (hotspot: HotspotListItem) => void;
  selectedId?: string | null;
}

interface CountryIndex {
  ready: boolean;
  getCells: (lat: number, lng: number) => Set<string> | null;
}

const H3_RES    = 3;     // ~69 km edge — tile size visible at global zoom
const MAX_CELLS = 150;   // per-hotspot cap (handles Russia ~80-120 actual cells)
const FALLBACK_K = 3;    // ring distance for ocean/unmatched fallback

// ── BFS expansion ─────────────────────────────────────────────────────────────
// Grows from center cell through neighboring H3 cells within the country boundary.
// Falls back to a fixed-radius disk when center is ocean / unmatched.
interface BfsResult { depthMap: Map<string, number>; maxDepth: number; }

function bfsExpand(centerCell: string, countryCells: Set<string> | null): BfsResult {
  // Fallback: fixed radius disk if no country match
  if (!countryCells?.has(centerCell)) {
    const depthMap = new Map<string, number>();
    const seen = new Set<string>();
    for (let r = 0; r <= FALLBACK_K; r++) {
      for (const cell of gridDisk(centerCell, r)) {
        if (!seen.has(cell)) { seen.add(cell); depthMap.set(cell, r); }
      }
    }
    return { depthMap, maxDepth: FALLBACK_K };
  }

  // BFS within country boundary
  const visited = new Set<string>();
  const depthMap = new Map<string, number>();
  const queue: [string, number][] = [[centerCell, 0]];
  visited.add(centerCell);
  depthMap.set(centerCell, 0);

  while (queue.length > 0 && depthMap.size < MAX_CELLS) {
    const [cell, depth] = queue.shift()!;
    for (const nb of gridDisk(cell, 1)) {
      if (nb === cell || visited.has(nb) || !countryCells.has(nb)) continue;
      visited.add(nb);
      depthMap.set(nb, depth + 1);
      queue.push([nb, depth + 1]);
    }
  }

  const maxDepth = depthMap.size > 1 ? Math.max(...depthMap.values()) : 0;
  return { depthMap, maxDepth };
}

// ── GeoJSON builder ──────────────────────────────────────────────────────────
// Produces one polygon Feature per H3 cell so MapLibre renders the hex grid.
// Cells sorted outermost-first so the center always composites on top.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHexGeoJSON(
  hotspots: HotspotListItem[],
  selectedId: string | null | undefined,
  countryIndex: CountryIndex | null
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: any[] = [];

  for (const h of hotspots) {
    if (h.severity < SEVERITY_THRESHOLD) continue;
    const cat        = h.category ?? "power";
    const centerCell = latLngToCell(h.lat, h.lng, H3_RES);
    const selected   = h.id === selectedId;
    const dataStr    = JSON.stringify(h);

    const countryCells = countryIndex?.ready
      ? countryIndex.getCells(h.lat, h.lng)
      : null;

    const { depthMap, maxDepth } = bfsExpand(centerCell, countryCells);

    // Sort descending by depth — outermost cells first, center last → center paints on top
    const sorted = [...depthMap.entries()].sort((a, b) => b[1] - a[1]);

    for (const [cell, depth] of sorted) {
      // cellToBoundary returns [lat, lng]; GeoJSON needs [lng, lat]
      const boundary = cellToBoundary(cell);
      const coords   = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
      coords.push(coords[0]); // close polygon ring

      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: {
          hotspot_id: h.id,
          category:   cat,
          severity:   h.severity,
          depth,
          depth_norm: maxDepth > 0 ? depth / maxDepth : 0,
          is_center:  depth === 0 ? 1 : 0, // 1/0 not bool — MapLibre property quirk
          selected,
          data:       dataStr,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

// Opacity expression for fill — depth_norm falloff × severity multiplier.
// pulseFactor is varied in the animate loop (center only).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillOpacity(pulseR0 = 1.0): any {
  const depthBase = [
    "case",
    ["==", ["get", "is_center"], 1],
    0.82 * pulseR0,
    ["interpolate", ["linear"], ["get", "depth_norm"],
      0.0, 0.75,
      1.0, 0.04,
    ],
  ];
  const sevScale = [
    "interpolate", ["linear"], ["get", "severity"],
    0.15, 0.42,
    0.50, 0.72,
    1.0,  1.0,
  ];
  return ["*", depthBase, sevScale];
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

  const countryIndexRef = useRef<CountryIndex>({ ready: false, getCells: () => null });

  // ── Load country hex index once ───────────────────────────────────────────
  useEffect(() => {
    loadCountryHex().then(() => {
      countryIndexRef.current = { ready: true, getCells: getCountryCells };
      const map = mapRef.current;
      if (!map) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const source = map.getSource("hex-cells") as any;
      if (source) {
        source.setData(
          buildHexGeoJSON(hotspotsRef.current, selectedIdRef.current, countryIndexRef.current)
        );
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            data: buildHexGeoJSON(hotspotsRef.current, selectedIdRef.current, countryIndexRef.current),
          });

          // ── Hex fill ──────────────────────────────────────────────────────
          // Single solid colour per category tile; opacity fades by depth.
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
          // Thin dark outlines reveal the hexagonal tile structure.
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

          // ── Center hex highlight — all hotspots ───────────────────────────
          // Subtle white ring on every hotspot's originating cell.
          map.addLayer({
            id:     "hex-center",
            type:   "line",
            source: "hex-cells",
            filter: ["==", ["get", "is_center"], 1],
            paint: {
              "line-color":   "#ffffff",
              "line-opacity": 0.65,
              "line-width":   0.8,
            },
          });

          // ── Selected center highlight ─────────────────────────────────────
          // Brighter white ring on the selected hotspot's centre cell.
          map.addLayer({
            id:     "hex-selected",
            type:   "line",
            source: "hex-cells",
            filter: ["all", ["==", ["get", "selected"], true], ["==", ["get", "is_center"], 1]],
            paint: {
              "line-color":   "#ffffff",
              "line-opacity": 0.90,
              "line-width":   1.2,
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
        // Center tile pulses — thermal shimmer effect.
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
    if (source) source.setData(buildHexGeoJSON(hotspots, selectedId, countryIndexRef.current));
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
