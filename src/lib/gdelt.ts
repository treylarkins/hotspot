import Papa from "papaparse";
import { getSource } from "../config/sources";
import type { Article } from "../contracts/article";
import { randomUUID } from "crypto";

/** GDELT location type → confidence weight */
const LOCATION_TYPE_CONFIDENCE: Record<number, number> = {
  1: 0.25, // Country
  2: 0.4,  // US State
  3: 0.75, // City/ADM1
  4: 1.0,  // Landmark/specific
};

interface GdeltLocation {
  type: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  confidence: number;
}

/**
 * Parse GDELT V2Locations field.
 * Format: Type#Name#CountryCode#ADM1Code#Lat#Long#FeatureID;...
 */
export function parseV2Locations(v2Locations: string): GdeltLocation[] {
  if (!v2Locations || v2Locations.trim() === "") return [];

  const locations: GdeltLocation[] = [];
  const parts = v2Locations.split(";").filter(Boolean);

  for (const part of parts) {
    const fields = part.split("#");
    if (fields.length < 6) continue;

    const type = parseInt(fields[0], 10);
    const name = fields[1] ?? "";
    const country = fields[2] ?? "";
    const lat = parseFloat(fields[4]);
    const lng = parseFloat(fields[5]);

    if (isNaN(lat) || isNaN(lng)) continue;

    let confidence = LOCATION_TYPE_CONFIDENCE[type] ?? 0.25;

    // Washington DC noise suppression: country-level geocode for "Washington" → very low confidence
    if (type === 1 && name.toLowerCase().includes("washington")) {
      confidence = 0.1;
    }

    locations.push({ type, name, country, lat, lng, confidence });
  }

  return locations;
}

/** Best location from a list (highest confidence) */
export function bestLocation(
  locations: GdeltLocation[]
): GdeltLocation | null {
  if (locations.length === 0) return null;
  return locations.reduce((best, loc) =>
    loc.confidence > best.confidence ? loc : best
  );
}

interface GdeltGkgRow {
  GKGRECORDID: string;
  DATE: string;
  SourceCommonName: string;
  DocumentIdentifier: string;
  Themes: string;
  Locations: string;
  Persons: string;
  Organizations: string;
  Tone: string;
  Extras: string;
  [key: string]: string;
}

/**
 * Fetch the GDELT GKG 15-minute CSV and parse it.
 * Uses the last-completed 15-minute file.
 */
export async function fetchGdeltGkg(url?: string): Promise<Article[]> {
  const gkgUrl = url ?? getLatestGkgUrl();

  const response = await fetch(gkgUrl);
  if (!response.ok) {
    throw new Error(`GDELT fetch failed: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  return parseGkgCsv(csvText);
}

/** Get the URL for the most recent GDELT GKG 15-minute file */
export function getLatestGkgUrl(): string {
  // GDELT updates every 15 minutes. Round down to last 15-min mark.
  const now = new Date();
  const minutes = now.getUTCMinutes();
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  const dt = new Date(now);
  dt.setUTCMinutes(roundedMinutes, 0, 0);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStr =
    dt.getUTCFullYear().toString() +
    pad(dt.getUTCMonth() + 1) +
    pad(dt.getUTCDate()) +
    pad(dt.getUTCHours()) +
    pad(dt.getUTCMinutes()) +
    "00";

  return `https://data.gdeltproject.org/gdeltv2/${dateStr}.gkg.csv.zip`;
}

/** Parse the GKG CSV text into Article objects */
export function parseGkgCsv(csvText: string): Article[] {
  const result = Papa.parse<GdeltGkgRow>(csvText, {
    header: true,
    delimiter: "\t",
    skipEmptyLines: true,
  });

  const articles: Article[] = [];
  const now = new Date().toISOString();

  for (const row of result.data) {
    const url = row.DocumentIdentifier;
    if (!url || !url.startsWith("http")) continue;

    const sourceInfo = getSource(url);
    if (!sourceInfo) continue; // not on whitelist

    const locations = parseV2Locations(row.Locations ?? "");
    const loc = bestLocation(locations);
    if (!loc) continue; // skip if no geocoding

    // Parse Goldstein score from Tone field (format: tone,pos,neg,polarity,...)
    let goldstein: number | null = null;
    const toneFields = (row.Tone ?? "").split(",");
    if (toneFields.length >= 1) {
      const tone = parseFloat(toneFields[0]);
      if (!isNaN(tone)) {
        // GDELT tone (-100 to +100) → approximate Goldstein-like scale (-10 to +10)
        goldstein = Math.max(-10, Math.min(10, tone / 10));
      }
    }

    // Parse date from GDELT DATE field (YYYYMMDDHHMMSS)
    let publishedAt: string;
    try {
      const d = row.DATE ?? "";
      publishedAt = new Date(
        `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:${d.slice(10, 12)}:${d.slice(12, 14)}Z`
      ).toISOString();
    } catch {
      publishedAt = now;
    }

    articles.push({
      id: randomUUID(),
      url: canonicalizeUrl(url),
      headline: extractHeadlineFromUrl(url),
      abstract: null,
      source_domain: new URL(url).hostname.replace(/^www\./, ""),
      source_name: sourceInfo.name,
      source_bias: sourceInfo.bias,
      source_tier: sourceInfo.tier,
      lat: loc.lat,
      lng: loc.lng,
      location_confidence: loc.confidence,
      goldstein,
      published_at: publishedAt,
      ingested_at: now,
      h3_cell: null,
    });
  }

  return articles;
}

/** Strip UTM params and normalize URL */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove UTM and tracking params
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "msclkid", "ref", "source",
    ];
    for (const param of trackingParams) {
      u.searchParams.delete(param);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Extract a rough headline from URL slug */
function extractHeadlineFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const slug = path.split("/").filter(Boolean).pop() ?? "";
    return slug
      .replace(/[-_]/g, " ")
      .replace(/\.\w+$/, "")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 200) || url;
  } catch {
    return url;
  }
}
