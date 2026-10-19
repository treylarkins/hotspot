"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { HotspotListItem } from "../src/contracts/api";
import HotspotPanel from "../src/components/HotspotPanel";
import { severityColor, SEVERITY_THRESHOLD } from "../src/lib/score";

const Globe = dynamic(() => import("../src/components/Globe"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
      <div className="text-gray-600 text-xs tracking-widest uppercase animate-pulse">
        Initializing
      </div>
    </div>
  ),
});

function SeverityLegend() {
  const stops = [0.15, 0.3, 0.5, 0.7, 0.85, 1.0];
  return (
    <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-white/5">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Severity</p>
      <div className="flex items-center gap-1.5">
        {stops.map((s) => (
          <div
            key={s}
            className="rounded-full"
            style={{
              width: 10 + s * 8,
              height: 10 + s * 8,
              background: `radial-gradient(circle, ${severityColor(s)}cc 0%, ${severityColor(s)}00 100%)`,
              filter: "blur(1px)",
            }}
          />
        ))}
        <span className="text-[10px] text-gray-600 ml-1">Low → High</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [hotspots, setHotspots] = useState<HotspotListItem[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Single fetch on mount — fixed H3 resolution 4, no zoom-based refetching
  useEffect(() => {
    fetch("/api/hotspots")
      .then((r) => r.json())
      .then((data) => {
        setHotspots(data.hotspots ?? []);
        setLastUpdated(data.generated_at ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load hotspots");
        setLoading(false);
      });
  }, []);

  const handleHotspotClick = useCallback((h: HotspotListItem) => {
    setSelectedHotspot(h);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedHotspot(null);
  }, []);

  const visibleCount = hotspots.filter((h) => h.severity >= SEVERITY_THRESHOLD).length;

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#0d0d0d]">
      {/* Title */}
      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <h1 className="text-white font-semibold text-base tracking-tight">Hotspot</h1>
        <p className="text-gray-600 text-xs">
          {loading ? "Loading…" : error ? error : `${visibleCount} hotspots`}
        </p>
      </div>

      {/* Globe */}
      <div className="absolute inset-0">
        {!loading && !error && (
          <Globe
            hotspots={hotspots}
            onHotspotClick={handleHotspotClick}
            selectedId={selectedHotspot?.id}
          />
        )}
      </div>

      {/* Side panel */}
      <HotspotPanel
        hotspot={selectedHotspot}
        onClose={handleClose}
        useMock={false}
      />

      {/* Legend */}
      <SeverityLegend />

      {/* Timestamp */}
      {lastUpdated && (
        <div className="absolute bottom-6 right-6 text-[10px] text-gray-700 pointer-events-none">
          {new Date(lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
