/**
 * Manual pipeline runner — use when you need to populate the DB immediately
 * rather than waiting for the Vercel cron (every 4 hours).
 *
 * Usage:
 *   npm run ingest          — ingest articles only
 *   npm run score           — score hotspots only
 *   npm run pipeline        — ingest → score (full run, no summarize)
 *   npm run pipeline:full   — ingest → score → summarize (costs AI credits)
 *
 * Requires .env.local with: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY,
 * NYT_API_KEY, and optionally GUARDIAN_API_KEY, MARKETAUX_API_KEY, NEWS_API_KEY
 */

const step = process.argv[2] ?? "all";

// ─── Step 1: Ingest ──────────────────────────────────────────────────────────

async function ingest() {
  console.log("\n[1/3] Ingest articles");
  const { runIngest } = await import("../src/lib/ingest/index.js");
  const r = await runIngest(4);
  console.log(`  GDELT:    ${r.gdelt}`);
  console.log(`  NYT:      ${r.nyt}`);
  console.log(`  Guardian: ${r.guardian}`);
  console.log(`  RSS:      ${r.rss}`);
  console.log(`  Marketaux:${r.marketaux}`);
  console.log(`  NewsAPI:  ${r.newsapi}`);
  console.log(`  Dupes:    ${r.dupes}`);
  console.log(`  ✓ Stored: ${r.total} articles`);
  return r.total;
}

// ─── Step 2: Score ───────────────────────────────────────────────────────────

async function score() {
  console.log("\n[2/3] Score hotspots");
  const { createClient } = await import("@supabase/supabase-js");
  const { scoreHotspots, H3_RESOLUTION } = await import("../src/lib/score.js");
  const { upsertHotspot } = await import("../src/lib/db.js");
  const { nearestCity } = await import("../src/lib/geoname.js");
  const { randomUUID } = await import("crypto");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo    = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: articles, error } = await supabase
    .from("articles")
    .select("*")
    .gte("published_at", sevenDaysAgo);
  if (error) throw error;

  console.log(`  Articles fetched: ${articles?.length ?? 0}`);

  // Velocity baseline
  const recentByCell  = new Map<string, number>();
  const priorByCell   = new Map<string, number>();
  for (const a of articles ?? []) {
    if (!a.h3_cell) continue;
    if (a.published_at >= oneDayAgo) {
      recentByCell.set(a.h3_cell, (recentByCell.get(a.h3_cell) ?? 0) + 1);
    } else {
      priorByCell.set(a.h3_cell, (priorByCell.get(a.h3_cell) ?? 0) + 1);
    }
  }
  const baselineByCell = new Map<string, number>();
  for (const [cell, count] of priorByCell) baselineByCell.set(cell, count / 6);
  for (const cell of recentByCell.keys()) {
    if (!baselineByCell.has(cell)) baselineByCell.set(cell, 0);
  }

  const scored = scoreHotspots(articles ?? [], baselineByCell);

  // Preserve existing ids
  const h3Cells = scored.map((h) => h.h3_cell);
  const { data: existingRows } = await supabase
    .from("hotspots")
    .select("id, h3_cell")
    .in("h3_cell", h3Cells);
  const existingIdByCell = new Map(
    (existingRows ?? []).map((r: { id: string; h3_cell: string }) => [r.h3_cell, r.id])
  );

  let upserted = 0;
  for (const h of scored) {
    const now = new Date().toISOString();
    const id = existingIdByCell.get(h.h3_cell) ?? randomUUID();
    await upsertHotspot({
      id,
      h3_cell: h.h3_cell,
      lat: h.lat,
      lng: h.lng,
      name: nearestCity(h.lat, h.lng),
      region: h.dominant_category,
      severity: h.severity,
      article_count: h.article_count,
      article_hash: h.article_hash,
      volume_score: h.volume_score,
      velocity_score: h.velocity_score,
      tier_weight: h.tier_weight,
      intensity_score: h.intensity_score,
      avg_goldstein: h.avg_goldstein ?? 0,
      summary_failed: false,
      last_scored_at: now,
      updated_at: now,
    });
    upserted++;
  }

  console.log(`  ✓ Scored: ${upserted} hotspots`);
  return upserted;
}

// ─── Step 3: Summarize ───────────────────────────────────────────────────────

async function summarize() {
  console.log("\n[3/3] Summarize hotspots (uses AI credits)");
  const { createClient } = await import("@supabase/supabase-js");
  const { getArticlesForHotspot, upsertSummary, getHotspotsNeedingSummary } = await import("../src/lib/db.js");
  const { generateSummary } = await import("../src/lib/ai/summarize.js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const hotspots = await getHotspotsNeedingSummary();
  console.log(`  Hotspots needing summary: ${hotspots.length}`);

  let done = 0;
  for (const h of hotspots) {
    const articles = await getArticlesForHotspot(h.h3_cell);
    if (articles.length < 3) continue;

    const { data: existing } = await supabase
      .from("summaries")
      .select("id, article_hash")
      .eq("hotspot_id", h.id)
      .single();
    if (existing?.article_hash === h.article_hash) continue;

    try {
      const summary = await generateSummary(h.id, h.name, articles);
      if (summary) {
        await upsertSummary(summary);
        done++;
      }
    } catch (err) {
      console.warn(`  ✗ ${h.id}: ${(err as Error).message}`);
    }
  }
  console.log(`  ✓ Summarized: ${done} hotspots`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    console.error("Make sure .env.local exists with all required keys.");
    process.exit(1);
  }

  console.log(`Pipeline step: ${step}`);

  if (step === "ingest") {
    await ingest();
  } else if (step === "score") {
    await score();
  } else if (step === "summarize") {
    await summarize();
  } else {
    // "all" or "full"
    const total = await ingest();
    if (total > 0) {
      await score();
      if (step === "full") await summarize();
    } else {
      console.log("  No new articles — skipping score/summarize");
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
