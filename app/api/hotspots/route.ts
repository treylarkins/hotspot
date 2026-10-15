import { NextRequest, NextResponse } from "next/server";
import type { HotspotsResponse } from "../../../src/contracts/api";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const useMock = searchParams.get("mock") === "1";
  const resolution = parseInt(searchParams.get("resolution") ?? "3", 10);
  const centerLat = parseFloat(searchParams.get("lat") ?? "0");
  const centerLng = parseFloat(searchParams.get("lng") ?? "0");
  const viewRadius = parseFloat(searchParams.get("radius") ?? "999");

  if (useMock) {
    const mockData = (await import("../../../fixtures/hotspots.mock.json")).default;

    const baseHotspots = mockData.hotspots.map((h) => ({
      id: h.id,
      lat: h.lat,
      lng: h.lng,
      name: h.name,
      region: h.region,
      severity: h.severity,
      article_count: h.article_count,
      article_hash: h.article_hash,
      volume_score: h.volume_score,
      velocity_score: h.velocity_score,
      tier_weight: h.tier_weight,
      intensity_score: h.intensity_score,
      avg_goldstein: h.avg_goldstein,
      summary_failed: h.summary_failed,
      last_scored_at: h.last_scored_at,
      created_at: h.last_scored_at,
      updated_at: h.last_scored_at,
      h3_cell: h.h3_cell,
      category: (h as any).category as string | undefined,
    }));

    let hotspots: typeof baseHotspots[number][] = baseHotspots;

    // Sub-cluster for deeper zoom levels
    if (resolution >= 4) {
      const { getZoomedHotspots } = await import("../../../src/lib/mock-zoom");
      const subSpots = getZoomedHotspots(
        baseHotspots as any,
        resolution,
        centerLat,
        centerLng,
        viewRadius
      );
      // Parents that have sub-spots are replaced by their children; others stay
      const parentIdsWithChildren = new Set(subSpots.map((s) => s.parentId));
      hotspots = [
        ...baseHotspots.filter((h) => !parentIdsWithChildren.has(h.id)),
        ...subSpots as any,
      ] as any;
    }

    const response: HotspotsResponse = {
      hotspots: hotspots as any,
      generated_at: mockData.generated_at,
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  }

  // Live Supabase
  try {
    const { getHotspots } = await import("../../../src/lib/db");
    const hotspots = await getHotspots();
    const response: HotspotsResponse = {
      hotspots,
      generated_at: new Date().toISOString(),
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    console.error("Failed to fetch hotspots:", err);
    return NextResponse.json({ error: "Failed to fetch hotspots" }, { status: 500 });
  }
}
