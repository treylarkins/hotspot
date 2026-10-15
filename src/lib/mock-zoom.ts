import { latLngToCell, cellToLatLng } from "h3-js";
import type { HotspotListItem } from "../contracts/api";
import { severityColor } from "./score";

/** Seeded LCG random — deterministic per hotspot so sub-dots don't jump on re-render */
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Gaussian sample using Box-Muller */
function gaussianOffset(rng: () => number, std: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std;
}

/** Scatter spread (degrees) per H3 resolution — roughly matches cell edge length */
const RESOLUTION_STD: Record<number, number> = {
  4: 0.28,  // ~30km
  5: 0.09,  // ~10km
  6: 0.03,  // ~3km
};

/** Max sub-hotspots to generate per parent */
const RESOLUTION_MAX_CHILDREN: Record<number, number> = {
  4: 9,
  5: 15,
  6: 20,
};

export interface SubHotspot {
  id: string;
  lat: number;
  lng: number;
  name: string;
  region: string;
  severity: number;
  article_count: number;
  summary_failed: boolean;
  last_scored_at: string;
  parentId: string;
}

/**
 * Generate sub-hotspots for a parent hotspot at a finer H3 resolution.
 * Positions are deterministic (seeded by hotspot ID) so they don't jump.
 */
export function generateSubHotspots(
  hotspot: HotspotListItem,
  resolution: number
): SubHotspot[] {
  const std = RESOLUTION_STD[resolution] ?? 0.28;
  const maxChildren = RESOLUTION_MAX_CHILDREN[resolution] ?? 9;
  const count = Math.max(2, Math.min(maxChildren, Math.ceil(hotspot.article_count / 4)));

  const rng = seededRng(hashStr(hotspot.id + resolution));
  const cellsSeen = new Set<string>();
  const children: SubHotspot[] = [];

  let attempts = 0;
  while (children.length < count && attempts < count * 6) {
    attempts++;
    const lat = hotspot.lat + gaussianOffset(rng, std);
    const lng = hotspot.lng + gaussianOffset(rng, std);
    const cell = latLngToCell(lat, lng, resolution);

    if (cellsSeen.has(cell)) continue;
    cellsSeen.add(cell);

    const [cellLat, cellLng] = cellToLatLng(cell);
    const artCount = Math.max(1, Math.round((hotspot.article_count / count) * (0.6 + rng() * 0.8)));
    // Sub-hotspots are slightly less severe than parent (more local = less global significance)
    const severityNoise = 0.75 + rng() * 0.35;
    const severity = Math.min(1, hotspot.severity * severityNoise * 0.9);

    children.push({
      id: `${hotspot.id}:${cell}`,
      lat: cellLat,
      lng: cellLng,
      name: `${hotspot.name} (local)`,
      region: hotspot.region,
      severity,
      article_count: artCount,
      summary_failed: false,
      last_scored_at: hotspot.last_scored_at,
      parentId: hotspot.id,
    });
  }

  return children;
}

/**
 * Given a list of hotspots and a target resolution + viewport center,
 * return sub-hotspots for all visible hotspots within radius.
 */
export function getZoomedHotspots(
  hotspots: HotspotListItem[],
  resolution: number,
  centerLat: number,
  centerLng: number,
  viewRadiusDeg: number
): SubHotspot[] {
  const visible = hotspots.filter((h) => {
    const dLat = Math.abs(h.lat - centerLat);
    const dLng = Math.abs(h.lng - centerLng);
    return dLat <= viewRadiusDeg * 1.5 && dLng <= viewRadiusDeg * 1.5;
  });

  return visible.flatMap((h) => generateSubHotspots(h, resolution));
}

/** Altitude → H3 resolution for nesting */
export function altitudeToResolution(altitude: number): number {
  if (altitude > 2.8) return 3;
  if (altitude > 1.2) return 4;
  if (altitude > 0.45) return 5;
  return 6;
}

/** Altitude → approximate visible radius in degrees */
export function altitudeToViewRadius(altitude: number): number {
  // Rough: at altitude 1.0 ≈ 60° visible half-angle, scales ~linearly with altitude
  return Math.min(90, Math.max(5, altitude * 38));
}
