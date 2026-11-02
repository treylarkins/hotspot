import { randomUUID } from "crypto";
import { getSource } from "@/config/sources";
import { headlineRelevanceScore } from "./gdelt";
import { extractLocation } from "./rss";
import type { Article } from "@/contracts/article";

const NEWSAPI_ENDPOINT = "https://newsapi.org/v2/top-headlines";
const NEWSAPI_CATEGORIES = ["business", "technology", "science", "general"] as const;

interface NewsApiArticle {
  title: string;
  url: string;
  description: string | null;
  publishedAt: string;
  source: { name: string };
}

interface NewsApiResponse {
  status: string;
  articles: NewsApiArticle[];
}

/**
 * Fetch top-headline articles from NewsAPI.org.
 * Free tier: 100 req/day, 100 articles/req.
 * Set NEWS_API_KEY in .env.local to enable.
 * Returns [] if the env var is not set.
 */
export async function fetchNewsApiArticles(): Promise<Article[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];

  const now = new Date().toISOString();

  const results = await Promise.allSettled(
    NEWSAPI_CATEGORIES.map(async (category) => {
      const url = `${NEWSAPI_ENDPOINT}?language=en&pageSize=100&category=${category}&apiKey=${key}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`NewsAPI ${resp.status} for category=${category}`);
      const data = (await resp.json()) as NewsApiResponse;
      if (data.status !== "ok") throw new Error(`NewsAPI returned status=${data.status}`);
      return data.articles ?? [];
    })
  );

  const seen = new Set<string>();
  const articles: Article[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[newsapi] Category fetch failed:", (result.reason as Error)?.message ?? result.reason);
      continue;
    }

    for (const item of result.value) {
      if (!item.url?.startsWith("http")) continue;
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      // Must be from a whitelisted source
      const sourceInfo = getSource(item.url);
      if (!sourceInfo) continue;

      // Drop strong soft-news signals
      if (headlineRelevanceScore(item.title) < -2) continue;

      const textForGeo = `${item.title} ${item.description ?? ""}`;
      const loc =
        extractLocation(textForGeo) ??
        (sourceInfo.institutionLat !== undefined && sourceInfo.institutionLng !== undefined
          ? { lat: sourceInfo.institutionLat, lng: sourceInfo.institutionLng, confidence: 0.22 }
          : null);
      if (!loc) continue;

      let hostname: string;
      try {
        hostname = new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }

      let publishedAt: string;
      try {
        publishedAt = new Date(item.publishedAt).toISOString();
      } catch {
        publishedAt = now;
      }

      articles.push({
        id: randomUUID(),
        url: item.url,
        headline: item.title.slice(0, 500),
        abstract: (item.description ?? "").slice(0, 2000) || null,
        source_domain: hostname,
        source_name: sourceInfo.name,
        source_bias: sourceInfo.bias,
        source_tier: sourceInfo.tier,
        lat: loc.lat,
        lng: loc.lng,
        location_confidence: loc.confidence,
        goldstein: null,
        published_at: publishedAt,
        ingested_at: now,
        h3_cell: null,
      });
    }
  }

  console.log(`[newsapi] Fetched ${articles.length} articles`);
  return articles;
}
