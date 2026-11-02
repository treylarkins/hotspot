"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { HotspotListItem } from "@/contracts/api";
import HotspotPanel from "@/components/HotspotPanel";
import { SEVERITY_THRESHOLD, CATEGORY_LABELS, THERMO_CAT } from "@/lib/score";

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

const PANEL_W = 200;

function ThermoLegend() {
  const gradient = `linear-gradient(to right, ${THERMO_STOPS.map(s => s.color).join(", ")})`;
  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/8">
      {/* Thermographic ramp bar */}
      <div
        className="h-3 rounded-full mb-2"
        style={{ width: PANEL_W, background: gradient, boxShadow: "0 0 12px 2px #7200CC55" }}
      />
      <div className="flex justify-between mb-4" style={{ width: PANEL_W }}>
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Cold</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Hot</span>
      </div>
      {/* Category dots */}
      <div className="flex flex-col gap-2">
        {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: THERMO_CAT[key], boxShadow: `0 0 6px 1px ${THERMO_CAT[key]}88` }}
            />
            <span className="text-[11px] text-gray-400 uppercase tracking-widest leading-none">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeWindowControl({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  const pct = ((days - 1) / 6) * 100;
  const trackGrad = `linear-gradient(to right, #7200CC ${pct}%, #ffffff18 ${pct}%)`;
  return (
    <div className="bg-black/70 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/8">
      <div className="flex items-baseline justify-between mb-3" style={{ width: PANEL_W }}>
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Time Window</span>
        <span className="text-[11px] text-gray-300 tabular-nums">
          {days === 1 ? "24 hrs" : `${days} days`}
        </span>
      </div>
      <style>{`
        .tw-range {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 9999px;
          outline: none;
          cursor: pointer;
        }
        .tw-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow: 0 0 6px 1px #7200CC88;
          cursor: grab;
        }
        .tw-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: none;
          background: #ffffff;
          box-shadow: 0 0 6px 1px #7200CC88;
          cursor: grab;
        }
      `}</style>
      <input
        type="range"
        min={1}
        max={7}
        step={1}
        value={days}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tw-range block"
        style={{ width: PANEL_W, background: trackGrad }}
      />
      <div className="flex justify-between mt-2" style={{ width: PANEL_W }}>
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">1 day</span>
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">7 days</span>
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
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (useMock) params.set("mock", "1");
    else params.set("days", String(days));
    fetch(`/api/hotspots?${params}`)
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
  }, [useMock, days]);

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

      {/* Legend + time window */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-2">
        <TimeWindowControl days={days} onChange={setDays} />
        <ThermoLegend />
      </div>

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
