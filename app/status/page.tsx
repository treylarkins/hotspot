import Link from "next/link";

async function getStatus() {
  try {
    const { getLastIngestRun, getHotspots } = await import("../../src/lib/db");
    const { createClient } = await import("@supabase/supabase-js");

    const [lastRun, hotspots] = await Promise.all([
      getLastIngestRun(),
      getHotspots(),
    ]);

    // Get failed summaries
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: failedHotspots } = await supabase
      .from("hotspots")
      .select("id, name, region, severity, last_scored_at")
      .eq("summary_failed", true)
      .order("severity", { ascending: false });

    return { lastRun, hotspots, failedHotspots: failedHotspots ?? [] };
  } catch {
    return { lastRun: null, hotspots: [], failedHotspots: [] };
  }
}

export default async function StatusPage() {
  const { lastRun, hotspots, failedHotspots } = await getStatus();

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-8 font-mono">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Hotspot Status</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Globe
          </Link>
        </div>

        {/* Last ingest */}
        <section className="border border-gray-800 rounded-lg p-4 space-y-2">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide">Last Ingest</h2>
          {lastRun ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-500">Time:</span>{" "}
                <span className="text-white">
                  {new Date(lastRun.ran_at).toLocaleString()}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Status:</span>{" "}
                <span
                  className={
                    lastRun.status === "success" ? "text-green-400" : "text-red-400"
                  }
                >
                  {lastRun.status}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Articles:</span>{" "}
                <span className="text-white">{lastRun.article_count}</span>
              </p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No ingest runs recorded.</p>
          )}
        </section>

        {/* Hotspot count */}
        <section className="border border-gray-800 rounded-lg p-4 space-y-2">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide">Active Hotspots</h2>
          <p className="text-2xl font-semibold">{hotspots.length}</p>
          <p className="text-xs text-gray-500">severity ≥ 0.15</p>
        </section>

        {/* Top hotspots */}
        {hotspots.length > 0 && (
          <section className="border border-gray-800 rounded-lg p-4 space-y-3">
            <h2 className="text-sm text-gray-400 uppercase tracking-wide">
              Top 10 by Severity
            </h2>
            <ul className="space-y-1.5">
              {hotspots
                .sort((a, b) => b.severity - a.severity)
                .slice(0, 10)
                .map((h) => (
                  <li key={h.id} className="flex justify-between text-sm">
                    <span className="text-white">{h.name}</span>
                    <span className="text-gray-400 tabular-nums">
                      {(h.severity * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Failed summaries */}
        {failedHotspots.length > 0 && (
          <section className="border border-red-900/40 rounded-lg p-4 space-y-3">
            <h2 className="text-sm text-red-400 uppercase tracking-wide">
              Summary Failures ({failedHotspots.length})
            </h2>
            <ul className="space-y-1.5">
              {failedHotspots.map((h: { id: string; name: string; region: string; severity: number }) => (
                <li key={h.id} className="flex justify-between text-sm">
                  <span className="text-white">{h.name}</span>
                  <span className="text-red-400">{h.region}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        <section className="border border-gray-800 rounded-lg p-4 space-y-2">
          <h2 className="text-sm text-gray-400 uppercase tracking-wide">Manual Triggers</h2>
          <p className="text-xs text-gray-500">
            Use CRON_SECRET to trigger manually:
          </p>
          <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded overflow-auto">
{`curl -H "Authorization: Bearer $CRON_SECRET" \\
  https://your-domain.com/api/cron/ingest`}
          </pre>
        </section>
      </div>
    </div>
  );
}
