"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { HotspotListItem } from "@/contracts/api";
import HotspotPanel from "@/components/HotspotPanel";
import { SEVERITY_THRESHOLD, CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/score";

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

function CategoryLegend() {
  const entries = Object.entries(CATEGORY_LABELS) as [string, string][];
  return (
    <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-white/5">
      <div className="flex flex-col gap-1.5">
        {entries.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: `radial-gradient(circle, ${CATEGORY_COLORS[key]}dd 0%, ${CATEGORY_COLORS[key]}44 100%)`,
                boxShadow: `0 0 6px 1px ${CATEGORY_COLORS[key]}66`,
              }}
            />
            <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomePageInner() {
  const searchParams = useSearchParams();
  const useMock = searchParams.get("mock") === "1";

  const [hotspots, setHotspots] = useState<HotspotListItem[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Single fetch on mount — fixed H3 resolution 4, no zoom-based refetching
  useEffect(() => {
    const url = useMock ? "/api/hotspots?mock=1" : "/api/hotspots";
    fetch(url)
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
  }, [useMock]);

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
        useMock={useMock}
      />

      {/* Legend */}
      <CategoryLegend />

      {/* Timestamp */}
      {lastUpdated && (
        <div className="absolute bottom-6 right-6 text-[10px] text-gray-700 pointer-events-none">
          {new Date(lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
          <div className="text-gray-600 text-xs tracking-widest uppercase animate-pulse">
            Initializing
          </div>
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}
