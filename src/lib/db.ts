import { createClient } from "@supabase/supabase-js";
import type { HotspotListItem, HotspotDetail } from "../contracts/api";
import type { Article } from "../contracts/article";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key);
}

export async function getHotspots(): Promise<HotspotListItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("hotspots")
    .select("id, lat, lng, name, region, severity, article_count, summary_failed, last_scored_at")
    .gte("severity", 0.15)
    .order("severity", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as HotspotListItem[];
}

export async function getHotspotDetail(id: string): Promise<HotspotDetail | null> {
  const supabase = getSupabaseClient();

  // Fetch hotspot
  const { data: hotspot, error: hotspotError } = await supabase
    .from("hotspots")
    .select("*")
    .eq("id", id)
    .single();

  if (hotspotError || !hotspot) return null;

  // Fetch summary
  const { data: summary } = await supabase
    .from("summaries")
    .select("*")
    .eq("hotspot_id", id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch articles
  const { data: articles } = await supabase
    .from("articles")
    .select("id, url, headline, abstract, source_name, source_bias, published_at")
    .eq("h3_cell", hotspot.h3_cell)
    .order("published_at", { ascending: false })
    .limit(20);

  return {
    ...hotspot,
    summary: summary ?? null,
    articles: articles ?? [],
  } as HotspotDetail;
}

export async function upsertArticles(articles: Article[]): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("articles").upsert(articles, {
    onConflict: "url",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function upsertHotspot(
  hotspot: Omit<import("../contracts/hotspot").Hotspot, "created_at">
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("hotspots")
    .upsert({ ...hotspot, updated_at: new Date().toISOString() }, { onConflict: "h3_cell" });
  if (error) throw error;
}

export async function upsertSummary(
  summary: import("../contracts/summary").Summary
): Promise<void> {
  const supabase = getSupabaseClient();
  // Delete existing summary for this hotspot, then insert fresh
  await supabase.from("summaries").delete().eq("hotspot_id", summary.hotspot_id);
  const { error } = await supabase.from("summaries").insert(summary);
  if (error) throw error;
}

export async function getHotspotsNeedingSummary(): Promise<
  Array<{ id: string; h3_cell: string; article_hash: string; article_count: number }>
> {
  const supabase = getSupabaseClient();

  // Get hotspots with article_hash that differs from latest summary's stored hash
  const { data, error } = await supabase
    .from("hotspots")
    .select("id, h3_cell, article_hash, article_count")
    .eq("summary_failed", false)
    .gte("severity", 0.15)
    .order("severity", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function getArticlesForHotspot(h3_cell: string): Promise<Article[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("h3_cell", h3_cell)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function recordIngestRun(
  status: "success" | "error",
  articleCount: number,
  message?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from("ingest_runs").insert({
    ran_at: new Date().toISOString(),
    status,
    article_count: articleCount,
    message: message ?? null,
  });
}

export async function getHotspotHistory(
  h3_cell: string,
  days = 7
): Promise<Array<{ date: string; count: number }>> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("articles")
    .select("published_at")
    .eq("h3_cell", h3_cell)
    .gte("published_at", since)
    .order("published_at", { ascending: true });

  if (error) throw error;

  // Group by date (YYYY-MM-DD) client-side — avoids raw SQL, works with Supabase JS SDK
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const date = row.published_at.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLastIngestRun(): Promise<{
  ran_at: string;
  status: string;
  article_count: number;
} | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("ingest_runs")
    .select("ran_at, status, article_count")
    .order("ran_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}
