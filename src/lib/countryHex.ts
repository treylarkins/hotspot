import { polygonToCells, latLngToCell } from "h3-js";

const H3_RES = 3;

// Module-level cache — survives hot-reload, populated once by loadCountryHex()
const cellToCountryIdx = new Map<string, number>();
const countryCellSets: Set<string>[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadCountryHex(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = await fetch("/countries-110m.geojson").then((r) => r.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const feature of fc.features as any[]) {
      const { geometry } = feature;
      const cells: string[] = [];

      if (geometry.type === "Polygon") {
        // polygonToCells(coords, res, isGeoJson)
        // coords = geometry.coordinates = [outerRing, ...holes]
        cells.push(...polygonToCells(geometry.coordinates, H3_RES, true));
      } else if (geometry.type === "MultiPolygon") {
        // geometry.coordinates = [ [[outerRing], ...holes], ... ]
        for (const polygon of geometry.coordinates) {
          cells.push(...polygonToCells(polygon, H3_RES, true));
        }
      }

      if (cells.length === 0) continue;
      const idx = countryCellSets.length;
      const set = new Set<string>(cells);
      countryCellSets.push(set);
      for (const cell of cells) {
        if (!cellToCountryIdx.has(cell)) cellToCountryIdx.set(cell, idx);
      }
    }
    loaded = true;
  })();
  return loadPromise;
}

/** Returns the Set of H3 cells for the country containing (lat, lng), or null for ocean. */
export function getCountryCells(lat: number, lng: number): Set<string> | null {
  const cell = latLngToCell(lat, lng, H3_RES);
  const idx = cellToCountryIdx.get(cell);
  return idx !== undefined ? countryCellSets[idx] : null;
}
