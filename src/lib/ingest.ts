import { fetchGdeltGkg } from "./gdelt";
import { fetchNytTopStories } from "./nyt";
import { upsertArticles, recordIngestRun } from "./db";
import { canonicalizeUrl } from "./gdelt";
import type { Article } from "../contracts/article";
import { latLngToH3, H3_RESOLUTION } from "./score";

/** Normalize URL for deduplication */
function dedupeKey(url: string): string {
  return canonicalizeUrl(url).toLowerCase();
}

/** Main ingest orchestrator */
export async function runIngest(): Promise<{
  total: number;
  gdelt: number;
  nyt: number;
  dupes: number;
}> {
  const [gdeltArticles, nytArticles] = await Promise.allSettled([
    fetchGdeltGkg(),
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

  // Deduplicate by canonical URL
  const seen = new Set<string>();
  const deduped: Article[] = [];
  for (const article of allArticles) {
    const key = dedupeKey(article.url);
    if (!seen.has(key)) {
      seen.add(key);
      // Assign H3 cell
      deduped.push({
        ...article,
        h3_cell: latLngToH3(article.lat, article.lng, H3_RESOLUTION),
      });
    }
  }

  const dupes = allArticles.length - deduped.length;

  // Upsert to database
  if (deduped.length > 0) {
    await upsertArticles(deduped);
  }

  await recordIngestRun("success", deduped.length);

  return {
    total: deduped.length,
    gdelt: gdeltArticles.status === "fulfilled" ? gdeltArticles.value.length : 0,
    nyt: nytArticles.status === "fulfilled" ? nytArticles.value.length : 0,
    dupes,
  };
}
