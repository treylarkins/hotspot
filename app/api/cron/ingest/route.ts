import { NextRequest, NextResponse } from "next/server";
import { fetchMultipleGdeltSnapshots } from "../../../../src/lib/gdelt";

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

  // Optional ?snapshots=N param (default 4, max 12)
  const rawSnapshots = req.nextUrl.searchParams.get("snapshots");
  const snapshotCount = Math.min(
    12,
    Math.max(1, rawSnapshots ? parseInt(rawSnapshots, 10) || 4 : 4)
  );

  try {
    const { runIngest } = await import("../../../../src/lib/ingest");
    const result = await runIngest(snapshotCount);
    return NextResponse.json({ success: true, snapshots: snapshotCount, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Ingest cron failed:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
