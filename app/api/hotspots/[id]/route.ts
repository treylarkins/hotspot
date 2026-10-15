import { NextRequest, NextResponse } from "next/server";
import type { HotspotDetailResponse } from "../../../../src/contracts/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const useMock = req.nextUrl.searchParams.get("mock") === "1";
  const includeHistory = req.nextUrl.searchParams.get("history") === "1";

  if (useMock) {
    const mockData = (await import("../../../../fixtures/hotspots.mock.json")).default;
    // Sub-spots from mock-zoom have ids like "{uuid}:{h3_cell}" — strip the suffix
    const baseId = id.split(":")[0];
    const hotspot = mockData.hotspots.find((h) => h.id === baseId);
    if (!hotspot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: HotspotDetailResponse = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hotspot: hotspot as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      citations: (hotspot.summary?.citations ?? []) as any,
      generated_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      history: includeHistory ? ((hotspot as any).history ?? []) : undefined,
    };
    return NextResponse.json(response);
  }

  // Live data from Supabase
  try {
    const { getHotspotDetail, getHotspotHistory } = await import("../../../../src/lib/db");
    const detail = await getHotspotDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let history: Array<{ date: string; count: number }> | undefined;
    if (includeHistory) {
      try {
        history = await getHotspotHistory((detail as unknown as { h3_cell: string }).h3_cell);
      } catch {
        history = [];
      }
    }

    const response: HotspotDetailResponse = {
      hotspot: detail,
      citations: detail.summary?.citations ?? [],
      generated_at: new Date().toISOString(),
      history,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Failed to fetch hotspot detail:", err);
    return NextResponse.json({ error: "Failed to fetch hotspot detail" }, { status: 500 });
  }
}
