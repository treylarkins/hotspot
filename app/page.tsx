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

// Thermographic colour ramp legend — mirrors the 6-layer stack in Globe.tsx
// cold (deep violet) → warm (crimson) → hot (amber-gold)
const THERMO_STOPS = [
  { color: "#1E0855", label: "Cold"   },
  { color: "#7200CC", label: ""       },
  { color: "#C40A22", label: ""       },
  { color: "#FF4800", label: ""       },
  { color: "#FFD200", label: "Hot"    },
];

function ThermoLegend() {
  const gradient = `linear-gradient(to right, ${THERMO_STOPS.map(s => s.color).join(", ")})`;
  return (
    <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-white/5">
      {/* Thermographic ramp bar */}
      <div
        className="h-2 rounded-full mb-2"
        style={{ width: 128, background: gradient, boxShadow: "0 0 8px 1px #7200CC44" }}
      />
      <div className="flex justify-between mb-2.5" style={{ width: 128 }}>
        <span className="text-[9px] text-gray-600 uppercase tracking-widest">Cold</span>
        <span className="text-[9px] text-gray-600 uppercase tracking-widest">Hot</span>
      </div>
      {/* Category dots — data reference, not visual */}
      <div className="flex flex-col gap-1">
        {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: CATEGORY_COLORS[key] }}
            />
            <span className="text-[9px] text-gray-600 uppercase tracking-widest leading-none">{label}</span>
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
      <ThermoLegend />

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
