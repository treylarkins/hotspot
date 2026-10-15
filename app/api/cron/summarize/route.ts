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
    const { generateSummary } = await import("../../../../src/lib/summarize");
    const {
      getHotspotsNeedingSummary,
      getArticlesForHotspot,
      upsertSummary,
    } = await import("../../../../src/lib/db");
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const hotspots = await getHotspotsNeedingSummary();

    let generated = 0;
    let failed = 0;

    for (const hotspot of hotspots) {
      // Check if we already have a summary and if article_hash changed >20%
      const { data: existingSummary } = await supabase
        .from("summaries")
        .select("id, generated_at")
        .eq("hotspot_id", hotspot.id)
        .single();

      if (existingSummary) {
        // Only regenerate if new articles represent >20% change
        // (simplified: just regenerate if more than 20% of articles are new)
        // For v1, regenerate once per day max
        const hoursSince =
          (Date.now() - new Date(existingSummary.generated_at).getTime()) / 3600000;
        if (hoursSince < 20) continue; // Generated within 20 hours, skip
      }

      const articles = await getArticlesForHotspot(hotspot.h3_cell);
      if (articles.length === 0) continue;

      const summary = await generateSummary(hotspot.id, `Region ${hotspot.h3_cell}`, articles);

      if (summary) {
        await upsertSummary(summary);
        generated++;
      } else {
        // Mark as failed
        await supabase
          .from("hotspots")
          .update({ summary_failed: true })
          .eq("id", hotspot.id);
        failed++;
      }

      // Rate limit: wait 1s between API calls
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({ success: true, generated, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Summarize cron failed:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
