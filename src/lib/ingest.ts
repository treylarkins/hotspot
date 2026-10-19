import { fetchMultipleGdeltSnapshots, canonicalizeUrl } from "./gdelt";
import { fetchNytTopStories } from "./nyt";
import { upsertArticles, recordIngestRun } from "./db";
import { getSourceByDomain } from "../config/sources";
import type { Article } from "../contracts/article";
import { latLngToH3, H3_RESOLUTION } from "./score";

/**
 * Minimum confidence threshold below which we will apply institution-based
 * geocoding as a fallback. Articles with confidence >= this value already have
 * a meaningful city-level signal and must NOT be overridden by the source HQ.
 */
const INSTITUTION_GEOCODE_THRESHOLD = 0.2;

/** Normalize URL for deduplication */
function dedupeKey(url: string): string {
  return canonicalizeUrl(url).toLowerCase();
}

/**
 * Apply institution-based geocoding fallback.
 *
 * Priority (highest → lowest):
 *   1. Content-derived coordinates (geo_facet, GDELT V2Locations) — kept whenever
 *      location_confidence >= INSTITUTION_GEOCODE_THRESHOLD.
 *   2. Source institution HQ coordinates — used only when the article's
 *      content-derived confidence is low (< INSTITUTION_GEOCODE_THRESHOLD),
 *      indicating a vague or missing geocode (e.g. country-level, US centroid).
 *
 * This ensures an NYC article from a SF-based outlet does NOT get pulled to SF.
 */
function applyInstitutionGeocodeFallback(article: Article): Article {
  if (article.location_confidence >= INSTITUTION_GEOCODE_THRESHOLD) {
    // Article already has a good city-level location — keep it as-is.
    return article;
  }

  const source = getSourceByDomain(article.source_domain);
  if (
    source?.institutionLat !== undefined &&
    source?.institutionLng !== undefined
  ) {
    return {
      ...article,
      lat: source.institutionLat,
      lng: source.institutionLng,
      location_confidence: 0.9,
    };
  }

  return article;
}

/** Main ingest orchestrator */
export async function runIngest(snapshotCount = 4): Promise<{
  total: number;
  gdelt: number;
  nyt: number;
  dupes: number;
}> {
  const [gdeltArticles, nytArticles] = await Promise.allSettled([
    fetchMultipleGdeltSnapshots(snapshotCount),
    fetchNytTopStories(),
  ]);

  const allArticles: Article[] = [];

  if (gdeltArticles.status === "fulfilled") {
    allArticles.push(...gdeltArticles.value);
  } else {
    console.warn("GDELT ingest failed:", gdeltArticles.reason);
  }

  if (nytArticles.status === "fulfilled") {
    allArticles.push(...nytArticles.value);
  } else {
    console.warn("NYT ingest failed:", nytArticles.reason);
  }

  const gdeltCount = gdeltArticles.status === "fulfilled" ? gdeltArticles.value.length : 0;
  const nytCount = nytArticles.status === "fulfilled" ? nytArticles.value.length : 0;

  // Deduplicate by canonical URL — keep the copy with higher location_confidence
  const seenMap = new Map<string, Article>();
  for (const article of allArticles) {
    const key = dedupeKey(article.url);
    const existing = seenMap.get(key);
    if (!existing || article.location_confidence > existing.location_confidence) {
      seenMap.set(key, article);
    }
  }
  const dedupedRaw = Array.from(seenMap.values());
  const afterDedup = dedupedRaw.length;

  // Apply institution geocoding fallback, then filter out bad geocodes
  const deduped: Article[] = [];
  for (const article of dedupedRaw) {
    const geocoded = applyInstitutionGeocodeFallback(article);

    // Drop null island (geocoding failures placed in the Gulf of Guinea)
    if (geocoded.lat === 0 && geocoded.lng === 0) continue;

    // Drop very low confidence locations (type 1 country-level geocodes)
    if (geocoded.location_confidence < 0.2) continue;

    deduped.push({
      ...geocoded,
      h3_cell: latLngToH3(geocoded.lat, geocoded.lng, H3_RESOLUTION),
    });
  }

  const dupes = allArticles.length - afterDedup;

  console.log(
    `[ingest] GDELT: ${gdeltCount} articles, NYT: ${nytCount} articles, after dedup: ${afterDedup}, after filter: ${deduped.length}`
  );

  // Upsert to database
  if (deduped.length > 0) {
    await upsertArticles(deduped);
  }

  await recordIngestRun("success", deduped.length);

  return {
    total: deduped.length,
    gdelt: gdeltCount,
    nyt: nytCount,
    dupes,
  };
}
