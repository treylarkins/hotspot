import { NextRequest, NextResponse } from "next/server";

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { scoreHotspots, computeArticleHash, shouldShow, H3_RESOLUTION } = await import(
      "../../../../src/lib/score"
    );
    const { upsertHotspot } = await import("../../../../src/lib/db");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Fetch all articles from last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: articles, error } = await supabase
      .from("articles")
      .select("*")
      .gte("published_at", since);

    if (error) throw error;

    // Get 7-day baseline counts by h3_cell
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: baselineData } = await supabase
      .from("articles")
      .select("h3_cell")
      .gte("published_at", sevenDaysAgo)
      .lt("published_at", since);

    const baselineByCell = new Map<string, number>();
    for (const row of baselineData ?? []) {
      if (row.h3_cell) {
        const cur = baselineByCell.get(row.h3_cell) ?? 0;
        baselineByCell.set(row.h3_cell, cur + 1);
      }
    }
    // Convert 6-day total to daily avg × 1 day
    for (const [cell, count] of baselineByCell) {
      baselineByCell.set(cell, count / 6);
    }

    const scored = scoreHotspots(articles ?? [], baselineByCell);

    // Build a map of existing hotspot ids by h3_cell to avoid UUID churn
    const h3Cells = scored.map((h) => h.h3_cell);
    const { data: existingRows } = await supabase
      .from("hotspots")
      .select("id, h3_cell")
      .in("h3_cell", h3Cells);
    const existingIdByCell = new Map<string, string>(
      (existingRows ?? []).map((r: { id: string; h3_cell: string }) => [r.h3_cell, r.id])
    );

    let upserted = 0;
    for (const h of scored) {
      const now = new Date().toISOString();
      // Reuse existing id to keep summaries linked; only generate new UUID for genuinely new hotspots
      const id = existingIdByCell.get(h.h3_cell) ?? require("crypto").randomUUID();
      await upsertHotspot({
        id,
        h3_cell: h.h3_cell,
        lat: h.lat,
        lng: h.lng,
        name: `Region ${h.h3_cell.slice(0, 8)}`,
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

    return NextResponse.json({ success: true, hotspots_scored: upserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Score cron failed:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
