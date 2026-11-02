import { randomUUID } from "crypto";
import { getSourceByDomain } from "@/config/sources";
import { headlineRelevanceScore } from "./gdelt";
import { extractLocation } from "./rss";
import type { Article } from "@/contracts/article";

const GUARDIAN_API_BASE = "https://content.guardianapis.com/search";

// Sections that map to hard-news categories
const GUARDIAN_SECTIONS = [
  "world",
  "us-news",
  "politics",
  "business",
  "technology",
  "science",
  "environment",
  "global-development",
] as const;

interface GuardianArticle {
  id: string;
  webUrl: string;
  webTitle: string;
  webPublicationDate: string;
  sectionName: string;
  fields?: {
    trailText?: string;
    standfirst?: string;
    byline?: string;
    publication?: string;
  };
}

interface GuardianResponse {
  response: {
    status: string;
    results: GuardianArticle[];
  };
}

/**
 * Fetch articles from The Guardian Content API.
 * Free tier: 500 req/day. Set GUARDIAN_API_KEY in .env.local to enable.
 * Returns [] if the env var is not set.
 */
export async function fetchGuardianArticles(apiKey?: string): Promise<Article[]> {
  const key = apiKey ?? process.env.GUARDIAN_API_KEY;
  if (!key) return [];

  const sourceInfo = getSourceByDomain("theguardian.com");
  if (!sourceInfo) return [];

  const now = new Date().toISOString();
  const articles: Article[] = [];
  const seen = new Set<string>();

  const results = await Promise.allSettled(
    GUARDIAN_SECTIONS.map(async (section) => {
      const params = new URLSearchParams({
        section,
        "show-fields": "trailText,standfirst",
        "order-by": "newest",
        "page-size": "50",
        "api-key": key,
      });
      const url = `${GUARDIAN_API_BASE}?${params}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`Guardian API ${resp.status} for section=${section}`);
      const data = (await resp.json()) as GuardianResponse;
      if (data.response.status !== "ok") throw new Error(`Guardian returned status=${data.response.status}`);
      return data.response.results ?? [];
    })
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[guardian] Section fetch failed:", (result.reason as Error)?.message ?? result.reason);
      continue;
    }

    for (const item of result.value) {
      if (!item.webUrl?.startsWith("http")) continue;
      if (seen.has(item.webUrl)) continue;
      seen.add(item.webUrl);

      // Drop strong soft-news signals
      if (headlineRelevanceScore(item.webTitle) < -2) continue;

      const abstract = item.fields?.trailText ?? item.fields?.standfirst ?? null;
      const textForGeo = `${item.webTitle} ${abstract ?? ""}`;
      const loc = extractLocation(textForGeo);
      if (!loc) continue;

      articles.push({
        id: randomUUID(),
        url: item.webUrl,
        headline: item.webTitle.slice(0, 500),
        abstract: abstract ? abstract.replace(/<[^>]+>/g, "").slice(0, 2000) : null,
        source_domain: "theguardian.com",
        source_name: sourceInfo.name,
        source_bias: sourceInfo.bias,
        source_tier: sourceInfo.tier,
        lat: loc.lat,
        lng: loc.lng,
        location_confidence: loc.confidence,
        goldstein: null,
        published_at: item.webPublicationDate,
        ingested_at: now,
        h3_cell: null,
      });
    }
  }

  console.log(`[guardian] Fetched ${articles.length} articles`);
  return articles;
}
