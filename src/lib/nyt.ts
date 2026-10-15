import { getSource } from "../config/sources";
import type { Article } from "../contracts/article";
import { randomUUID } from "crypto";

const NYT_API_BASE = "https://api.nytimes.com/svc/topstories/v2";
const NYT_SECTIONS = ["world", "us", "politics", "business"];

interface NytArticle {
  url: string;
  title: string;
  abstract: string;
  published_date: string;
  geo_facet?: string[];
  multimedia?: Array<{ url: string; type: string }>;
}

interface NytResponse {
  results: NytArticle[];
}

/** Fetch NYT Top Stories for given sections */
export async function fetchNytTopStories(apiKey?: string): Promise<Article[]> {
  const key = apiKey ?? process.env.NYT_API_KEY;
  if (!key) throw new Error("NYT_API_KEY not set");

  const articles: Article[] = [];
  const now = new Date().toISOString();

  for (const section of NYT_SECTIONS) {
    const url = `${NYT_API_BASE}/${section}.json?api-key=${key}`;
    let data: NytResponse;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      data = await response.json();
    } catch {
      continue;
    }

    for (const item of data.results ?? []) {
      if (!item.url) continue;
      const sourceInfo = getSource(item.url);
      if (!sourceInfo) continue;

      // Geocode from geo_facet: "New York (State)" → approximate coords
      const geo = item.geo_facet?.[0] ?? null;
      const coords = geoFacetToCoords(geo);
      if (!coords) continue;

      articles.push({
        id: randomUUID(),
        url: item.url,
        headline: item.title ?? "",
        abstract: item.abstract ?? null,
        source_domain: "nytimes.com",
        source_name: sourceInfo.name,
        source_bias: sourceInfo.bias,
        source_tier: sourceInfo.tier,
        lat: coords.lat,
        lng: coords.lng,
        location_confidence: coords.confidence,
        goldstein: null,
        published_at: item.published_date,
        ingested_at: now,
        h3_cell: null,
      });
    }
  }

  return articles;
}

/** Basic geo_facet → lat/lng mapping for common NYT tags */
const GEO_FACET_MAP: Record<string, { lat: number; lng: number; confidence: number }> = {
  "Afghanistan": { lat: 33.9, lng: 67.7, confidence: 0.5 },
  "China": { lat: 35.0, lng: 105.0, confidence: 0.5 },
  "Europe": { lat: 50.0, lng: 15.0, confidence: 0.4 },
  "France": { lat: 46.2, lng: 2.2, confidence: 0.6 },
  "Gaza Strip": { lat: 31.4, lng: 34.3, confidence: 0.9 },
  "Germany": { lat: 51.2, lng: 10.5, confidence: 0.6 },
  "India": { lat: 20.6, lng: 78.9, confidence: 0.5 },
  "Iran": { lat: 32.4, lng: 53.7, confidence: 0.6 },
  "Iraq": { lat: 33.2, lng: 43.7, confidence: 0.6 },
  "Israel": { lat: 31.0, lng: 34.9, confidence: 0.7 },
  "Japan": { lat: 36.2, lng: 138.3, confidence: 0.6 },
  "Mexico": { lat: 23.6, lng: -102.6, confidence: 0.5 },
  "Middle East": { lat: 29.3, lng: 42.5, confidence: 0.4 },
  "North Korea": { lat: 40.3, lng: 127.5, confidence: 0.6 },
  "Pakistan": { lat: 30.4, lng: 69.3, confidence: 0.5 },
  "Russia": { lat: 61.5, lng: 105.3, confidence: 0.5 },
  "Taiwan": { lat: 23.7, lng: 121.0, confidence: 0.8 },
  "Ukraine": { lat: 48.4, lng: 31.2, confidence: 0.7 },
  "United Kingdom": { lat: 55.4, lng: -3.4, confidence: 0.6 },
  "United States": { lat: 37.1, lng: -95.7, confidence: 0.4 },
  "Washington (DC)": { lat: 38.9, lng: -77.0, confidence: 0.25 },
  "Yemen": { lat: 15.6, lng: 48.5, confidence: 0.6 },
};

export function geoFacetToCoords(
  geoFacet: string | null
): { lat: number; lng: number; confidence: number } | null {
  if (!geoFacet) return null;

  // Exact match
  if (GEO_FACET_MAP[geoFacet]) return GEO_FACET_MAP[geoFacet];

  // Partial match (remove state qualifiers like "(State)", "(City)")
  const normalized = geoFacet.replace(/\s*\([^)]+\)/, "").trim();
  if (GEO_FACET_MAP[normalized]) return GEO_FACET_MAP[normalized];

  // No mapping → skip
  return null;
}
