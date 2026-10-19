import { latLngToCell } from "h3-js";
import type { Article } from "../contracts/article";
import type { Hotspot } from "../contracts/hotspot";
import { TIER_WEIGHTS, getSourceByDomain } from "../config/sources";
import { randomUUID } from "crypto";

export const H3_RESOLUTION = 4;

export function latLngToH3(lat: number, lng: number, res = H3_RESOLUTION): string {
  return latLngToCell(lat, lng, res);
}

export interface ArticleGroup {
  h3_cell: string;
  lat: number;
  lng: number;
  articles: Article[];
  /** avg lat/lng of all articles */
}

export function groupByH3(articles: Article[], res = H3_RESOLUTION): ArticleGroup[] {
  const map = new Map<string, ArticleGroup>();
  for (const article of articles) {
    const cell = latLngToH3(article.lat, article.lng, res);
    if (!map.has(cell)) {
      map.set(cell, { h3_cell: cell, lat: article.lat, lng: article.lng, articles: [] });
    }
    map.get(cell)!.articles.push(article);
  }
  return Array.from(map.values());
}

/** volume score: log10(count) / log10(100), clamped 0–1 */
export function volumeScore(count: number): number {
  if (count <= 0) return 0;
  return Math.min(1, Math.log10(count) / Math.log10(100));
}

/** velocity score: today_count / 7-day-baseline_count, clamped 0–1 */
export function velocityScore(todayCount: number, baselineCount: number): number {
  if (baselineCount <= 0) return 0.5; // neutral — no history, don't boost or suppress
  return Math.min(1, todayCount / baselineCount);
}

/** tier weight: weighted avg of tier weights across articles */
export function tierWeight(articles: Article[]): number {
  if (articles.length === 0) return 0;
  const total = articles.reduce((sum, a) => sum + (TIER_WEIGHTS[a.source_tier as 1 | 2] ?? 0.6), 0);
  return total / articles.length;
}

/** intensity score: (-goldstein + 10) / 20 — higher conflict → higher score */
export function intensityScore(articles: Article[]): number {
  const withGoldstein = articles.filter((a) => a.goldstein !== null);
  if (withGoldstein.length === 0) return 0.5; // neutral default
  const avg = withGoldstein.reduce((sum, a) => sum + (a.goldstein ?? 0), 0) / withGoldstein.length;
  return Math.max(0, Math.min(1, (-avg + 10) / 20));
}

/** Location confidence weight: average confidence across articles */
export function avgLocationConfidence(articles: Article[]): number {
  if (articles.length === 0) return 0;
  return articles.reduce((sum, a) => sum + a.location_confidence, 0) / articles.length;
}

export interface SeverityComponents {
  volumeScore: number;
  velocityScore: number;
  tierWeight: number;
  intensityScore: number;
  avgGoldstein: number | null;
  locationConfidenceMult: number;
}

export function severityScore(
  group: ArticleGroup,
  baselineCount: number
): SeverityComponents & { severity: number } {
  const count = group.articles.length;
  const vol = volumeScore(count);
  const vel = velocityScore(count, baselineCount);
  const tier = tierWeight(group.articles);
  const intensity = intensityScore(group.articles);
  const locConf = avgLocationConfidence(group.articles);

  const withGoldstein = group.articles.filter((a) => a.goldstein !== null);
  const avgGoldstein =
    withGoldstein.length > 0
      ? withGoldstein.reduce((sum, a) => sum + (a.goldstein ?? 0), 0) / withGoldstein.length
      : null;

  const raw = 0.35 * vol + 0.30 * vel + 0.20 * tier + 0.15 * intensity;
  // Apply location confidence multiplier (penalizes low-confidence geocoding)
  const severity = Math.min(1, raw * (0.5 + 0.5 * locConf));

  return {
    volumeScore: vol,
    velocityScore: vel,
    tierWeight: tier,
    intensityScore: intensity,
    avgGoldstein,
    locationConfidenceMult: 0.5 + 0.5 * locConf,
    severity,
  };
}

export const SEVERITY_THRESHOLD = 0.10;

export function shouldShow(severity: number): boolean {
  return severity >= SEVERITY_THRESHOLD;
}

/** Dominant category among articles in a group (plurality wins, ties go to first) */
export function dominantCategory(articles: Article[]): string {
  const counts = new Map<string, number>();
  for (const a of articles) {
    const src = getSourceByDomain(a.source_domain);
    const cat = src?.category ?? "general";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  let best = "general";
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) { best = cat; bestCount = count; }
  }
  return best;
}

export interface ScoredHotspot {
  h3_cell: string;
  lat: number;
  lng: number;
  article_count: number;
  severity: number;
  volume_score: number;
  velocity_score: number;
  tier_weight: number;
  intensity_score: number;
  avg_goldstein: number | null;
  article_hash: string;
  dominant_category: string;
}

export function computeArticleHash(articleIds: string[]): string {
  return [...articleIds].sort().join(",");
}

export function scoreHotspots(
  articles: Article[],
  baselineCountByCell: Map<string, number>
): ScoredHotspot[] {
  const groups = groupByH3(articles);
  const results: ScoredHotspot[] = [];

  for (const group of groups) {
    const baseline = baselineCountByCell.get(group.h3_cell) ?? group.articles.length;
    const scored = severityScore(group, baseline);
    if (!shouldShow(scored.severity)) continue;

    // Centroid: avg lat/lng
    const lat = group.articles.reduce((s, a) => s + a.lat, 0) / group.articles.length;
    const lng = group.articles.reduce((s, a) => s + a.lng, 0) / group.articles.length;

    results.push({
      h3_cell: group.h3_cell,
      lat,
      lng,
      article_count: group.articles.length,
      severity: scored.severity,
      volume_score: scored.volumeScore,
      velocity_score: scored.velocityScore,
      tier_weight: scored.tierWeight,
      intensity_score: scored.intensityScore,
      avg_goldstein: scored.avgGoldstein,
      article_hash: computeArticleHash(group.articles.map((a) => a.id)),
      dominant_category: dominantCategory(group.articles),
    });
  }

  return results;
}

/** Severity color: linear interpolation from #F4B4B4 (0.15) to #7A0000 (1.0) */
export function severityColor(severity: number): string {
  const t = Math.max(0, Math.min(1, (severity - 0.15) / 0.85));
  const r = Math.round(0xf4 + (0x7a - 0xf4) * t);
  const g = Math.round(0xb4 + (0x00 - 0xb4) * t);
  const b = Math.round(0xb4 + (0x00 - 0xb4) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Dot radius: power curve for dramatic visual range (3px at 1 article → 60px at 500). */
export function dotRadius(articleCount: number): number {
  const clamped = Math.max(1, Math.min(articleCount, 500));
  return 3 + (Math.pow(clamped / 500, 0.45) * 57);
}
