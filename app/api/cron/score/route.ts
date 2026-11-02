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
      "@/lib/score"
    );
    const { upsertHotspot } = await import("@/lib/db");
    const { nearestCity } = await import("@/lib/geoname");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Fetch all articles published in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: articles, error } = await supabase
      .from("articles")
      .select("*")
      .gte("published_at", sevenDaysAgo);

    if (error) throw error;

    // Velocity baseline: compare articles published in the last 24h vs daily avg of the prior 6 days
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentByCell = new Map<string, number>();
    const priorByCell = new Map<string, number>();
    for (const a of articles ?? []) {
      if (!a.h3_cell) continue;
      if (a.published_at >= oneDayAgo) {
        recentByCell.set(a.h3_cell, (recentByCell.get(a.h3_cell) ?? 0) + 1);
      } else {
        priorByCell.set(a.h3_cell, (priorByCell.get(a.h3_cell) ?? 0) + 1);
      }
    }
    // Baseline = daily avg over prior 6 days
    const baselineByCell = new Map<string, number>();
    for (const [cell, count] of priorByCell) {
      baselineByCell.set(cell, count / 6);
    }
    // Cells only seen in recent window get neutral baseline (0 → velocityScore returns 0.5)
    for (const cell of recentByCell.keys()) {
      if (!baselineByCell.has(cell)) baselineByCell.set(cell, 0);
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

    // Fix any stale "Region XXXX" names from before nearestCity was added
    const { data: staleRows } = await supabase
      .from("hotspots")
      .select("id, lat, lng, name")
      .like("name", "Region %");
    let renamed = 0;
    for (const row of staleRows ?? []) {
      if (/^Region [0-9a-f]+$/i.test(row.name)) {
        await supabase
          .from("hotspots")
          .update({ name: nearestCity(row.lat, row.lng), updated_at: new Date().toISOString() })
          .eq("id", row.id);
        renamed++;
      }
    }

    return NextResponse.json({ success: true, hotspots_scored: upserted, stale_renamed: renamed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Score cron failed:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
