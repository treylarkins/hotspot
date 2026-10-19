import Papa from "papaparse";
import { unzipSync } from "fflate";
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
  V2THEMES: string;
  Themes: string;
  Locations: string;
  Persons: string;
  Organizations: string;
  Tone: string;
  Extras: string;
  [key: string]: string;
}

/**
 * GDELT V2THEMES hard-news whitelist.
 * Articles with themes but NONE matching this set are dropped as soft news.
 * Articles with NO themes at all are allowed through (no theme data → don't filter).
 */
const HARD_NEWS_THEMES = new Set([
  // Finance & business
  "ECON_BANKRUPTCY", "ECON_DEBT", "ECON_REFORM", "ECON_FOREIGNINVESTMENT",
  "ECON_TAXATION", "ECON_TRADE", "ECON_PRICECONTROL", "ECON_STOCKMARKET",
  "ECON_INFLATION", "ECON_DEVALUATION", "WB_2197_FINANCIAL_SECTOR",
  "WB_2133_TRADE", "WB_1356_ENTERPRISE_DEVELOPMENT", "CORP_MERGER_ACQUISITION",
  // Geopolitics & governance
  "GOV_GOVERNMENT_BODIES", "DEMOCRACY", "ELECTION", "LEADER",
  "GOV_RELATIONS_DIPLOMACY", "MILITARY", "SANCTIONS", "TREATY",
  // Conflict
  "PROTEST", "CONFLICT", "TAX_ETHNICITY_CONFLICT", "TERROR",
  // Disaster & crisis
  "NATURAL_DISASTER", "CRISISLEX_T01_EARTHQUAKE", "CRISISLEX_T05_FLOOD",
  // Energy & resources
  "ENV_ENERGYTRADE", "ENERGY", "ENV_MINING", "ENV_NUCLEAR",
  // Science & health crises
  "SCIENCE", "HEALTH_PANDEMIC", "DISCOVERY",
  // Infrastructure & development
  "TRANSPORTATION", "ENV_INFRASTRUCTUREDEVELOPMENT",
]);

/**
 * Fetch the latest GDELT GKG URL using GDELT's lastupdate.txt.
 * The file has 3 lines, each: SIZE MD5 URL
 * Line 3 (index 2) is always the GKG file ending in .gkg.csv.zip
 */
export async function getLatestGkgUrl(): Promise<string> {
  const resp = await fetch("https://data.gdeltproject.org/gdeltv2/lastupdate.txt");
  if (!resp.ok) {
    throw new Error(`Failed to fetch GDELT lastupdate.txt: ${resp.status} ${resp.statusText}`);
  }
  const text = await resp.text();
  const lines = text.trim().split("\n");
  // Line 3 (index 2) is the GKG file
  const gkgLine = lines[2];
  if (!gkgLine) {
    throw new Error("GDELT lastupdate.txt did not contain a third line");
  }
  const fields = gkgLine.trim().split(/\s+/);
  const url = fields[2];
  if (!url || !url.startsWith("http")) {
    throw new Error(`Could not parse GKG URL from lastupdate.txt line: ${gkgLine}`);
  }
  return url;
}

/**
 * Fetch the GDELT GKG 15-minute ZIP file and parse it into Articles.
 * Properly decompresses the ZIP before parsing the CSV.
 */
export async function fetchGdeltGkg(url?: string): Promise<Article[]> {
  const gkgUrl = url ?? (await getLatestGkgUrl());

  const response = await fetch(gkgUrl);
  if (!response.ok) {
    throw new Error(`GDELT fetch failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const zipped = new Uint8Array(buffer);
  const files = unzipSync(zipped);

  const csvKey = Object.keys(files).find(
    (k) => k.endsWith(".csv") || k.endsWith(".gkg")
  );
  if (!csvKey) {
    throw new Error("No CSV file found inside GDELT ZIP archive");
  }

  const csvText = new TextDecoder("utf-8").decode(files[csvKey]);
  return parseGkgCsv(csvText);
}

/**
 * Format a Date as a GDELT timestamp string: YYYYMMDDHHMMSS
 */
function formatGdeltTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    "00"
  );
}

/**
 * Parse a GDELT timestamp string (YYYYMMDDHHMMSS) into a Date.
 */
function parseGdeltTimestamp(ts: string): Date {
  return new Date(
    `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`
  );
}

/**
 * Fetch multiple GDELT GKG snapshots (default: 4 = last hour of data).
 * Merges and deduplicates articles by URL.
 */
export async function fetchMultipleGdeltSnapshots(count = 4): Promise<Article[]> {
  const latestUrl = await getLatestGkgUrl();

  // Extract the timestamp from the latest URL filename.
  // Filename format: YYYYMMDDHHMMSS.gkg.csv.zip
  const filenameMatch = latestUrl.match(/(\d{14})\.gkg\.csv\.zip$/);
  if (!filenameMatch) {
    throw new Error(`Cannot parse timestamp from GDELT URL: ${latestUrl}`);
  }
  const latestTimestamp = filenameMatch[1];
  const latestDate = parseGdeltTimestamp(latestTimestamp);

  // Build list of URLs: latest first, then count-1 previous 15-min snapshots
  const urls: string[] = [latestUrl];
  for (let i = 1; i < count; i++) {
    const priorDate = new Date(latestDate.getTime() - i * 15 * 60 * 1000);
    const ts = formatGdeltTimestamp(priorDate);
    urls.push(`https://data.gdeltproject.org/gdeltv2/${ts}.gkg.csv.zip`);
  }

  // Fetch all snapshots in parallel; don't fail if one is missing
  const results = await Promise.allSettled(urls.map((u) => fetchGdeltGkg(u)));

  // Merge all articles and deduplicate by url
  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const article of result.value) {
        if (!seen.has(article.url)) {
          seen.add(article.url);
          merged.push(article);
        }
      }
    } else {
      console.warn("GDELT snapshot fetch failed:", result.reason);
    }
  }

  return merged;
}

/**
 * Patterns that identify opinion/listicle/soft-news content.
 * Checked against the full URL path.
 */
const OPINION_PATTERNS: RegExp[] = [
  /^\d+[\s-]+(reasons?|ways?|tips?|things?|signs?|steps?|facts?|myths?)/i,
  /\bopinion\b/i,
  /\bop-ed\b/i,
  /\bop\s+ed\b/i,
  /\bcommentary\b/i,
  /\beditorial\b/i,
  // Soft-news section paths — block /food/best-restaurants but not /business/food-company-merger
  /\/(food|dining|recipe|restaurant|cooking|taste)\//i,
  /\/(travel|destinations?|tourism|vacation)\//i,
  /\/(style|fashion|beauty|wellness|well)\//i,
  /\/(arts?|culture|entertainment|movies?|film|music|television|tv|theater)\//i,
  /\/(sports?|athletics|nba|nfl|nhl|mlb|soccer|golf)\//i,
  /\/(real-?estate|home|garden|automobiles?)\//i,
  /\/(magazine|t-magazine|tmagazine|sunday-review)\//i,
];

/** Returns true if the URL or slug looks like opinion, listicle, or soft-news content */
function isOpinionOrListicle(urlOrSlug: string): boolean {
  return OPINION_PATTERNS.some((re) => re.test(urlOrSlug));
}

const HARD_NEWS_KEYWORDS = [
  "merger", "acquisition", "ipo", "funding", "billion", "million", "deal",
  "treaty", "sanctions", "election", "coup", "default", "bankruptcy",
  "earthquake", "eruption", "tsunami", "outbreak", "pandemic",
  "discovery", "breakthrough", "launch", "tariff", "inflation", "gdp",
  "lawsuit", "indictment", "sentenced", "war", "ceasefire", "summit",
];

const SOFT_NEWS_KEYWORDS = [
  "recipe", "restaurant", "dining", "chef", "cocktail", "wine", "beer",
  "celebrity", "dating", "wedding", "divorce", "fashion", "makeup", "skincare",
  "movie review", "album review", "book review", "concert", "tour",
  "sport", "score", "playoff", "championship", "athlete",
  "vacation", "hotel", "resort", "destination",
];

/**
 * Returns a relevance score: positive → hard news, negative → soft news.
 * Articles with score < -1 should be dropped.
 */
export function headlineRelevanceScore(headline: string): number {
  const lower = headline.toLowerCase();
  const pos = HARD_NEWS_KEYWORDS.filter((k) => lower.includes(k)).length;
  const neg = SOFT_NEWS_KEYWORDS.filter((k) => lower.includes(k)).length;
  return pos - neg * 2;
}

// GDELT GKG v2.1 files have NO header row — prepend one so PapaParse can map columns
const GDELT_GKG_HEADER = [
  "GKGRECORDID", "DATE", "SourceCollectionIdentifier", "SourceCommonName",
  "DocumentIdentifier", "V2COUNTS", "V2EXTCOUNTS", "V2THEMES", "V2EXTTHEMES",
  "Locations", "V2EXTLOCATIONS", "Persons", "V2EXTPERSONS", "Organizations",
  "V2EXTORGS", "Tone", "CAMEOEVENTIDS", "GCAM", "SharingImage", "RelatedImages",
  "SocialImageEmbeds", "SocialVideoEmbeds", "Quotations", "AllNames", "Amounts",
  "TranslationInfo", "ExtrasXML",
].join("\t");

/** Parse the GKG CSV text into Article objects */
export function parseGkgCsv(csvText: string): Article[] {
  const result = Papa.parse<GdeltGkgRow>(GDELT_GKG_HEADER + "\n" + csvText, {
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

    // Filter out opinion, listicle, and soft-news URL paths
    try {
      const pathname = new URL(url).pathname;
      if (isOpinionOrListicle(pathname)) continue;
    } catch {
      // malformed URL — fall through to slug check
    }
    const slug = extractHeadlineFromUrl(url);
    if (isOpinionOrListicle(slug)) continue;

    // V2THEMES filter: if themes are present but none match hard-news set, skip
    const themes = (row.V2THEMES ?? "").split(";").filter(Boolean);
    if (themes.length > 0) {
      const hasHardNews = themes.some((t) => HARD_NEWS_THEMES.has(t.trim().toUpperCase()));
      if (!hasHardNews) continue;
    }
    // themes.length === 0 → no theme data, allow through

    // Headline relevance filter: strong soft-news signal → drop
    if (headlineRelevanceScore(slug) < -1) continue;

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
