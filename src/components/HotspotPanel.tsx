"use client";

import { useEffect, useState } from "react";
import type { HotspotListItem } from "../contracts/api";
import SummaryView from "./SummaryView";
import PerspectivesView from "./PerspectivesView";
import ArticleList from "./ArticleList";
import StoryArcPanel, { type HistoryPoint } from "./StoryArcPanel";

interface HotspotPanelProps {
  hotspot: HotspotListItem | null;
  onClose: () => void;
  useMock?: boolean;
}

interface HotspotDetail {
  id: string;
  name: string;
  region: string;
  severity: number;
  article_count: number;
  summary: {
    neutral_summary: string;
    perspectives: Array<{
      outlet_name: string;
      outlet_bias: string;
      framing: string;
      citations: number[];
    }>;
    citations: Array<{
      index: number;
      article_id: string;
      headline: string;
      url: string;
      source_name: string;
      source_bias: string;
      published_at: string;
    }>;
  } | null;
  articles: Array<{
    id: string;
    url: string;
    headline: string;
    abstract: string | null;
    source_name: string;
    source_bias: string;
    published_at: string;
  }>;
}

function SeverityBar({ severity }: { severity: number }) {
  const pct = Math.round(severity * 100);
  const color =
    severity > 0.7
      ? "#7A0000"
      : severity > 0.4
        ? "#C04040"
        : "#F4B4B4";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function HotspotPanel({ hotspot, onClose, useMock }: HotspotPanelProps) {
  const [detail, setDetail] = useState<HotspotDetail | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "perspectives" | "articles">("summary");

  useEffect(() => {
    if (!hotspot) {
      setDetail(null);
      setHistory([]);
      return;
    }
    setLoading(true);
    setActiveTab("summary");
    const base = useMock
      ? `/api/hotspots/${hotspot.id}?mock=1&history=1`
      : `/api/hotspots/${hotspot.id}?history=1`;
    fetch(base)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data.hotspot ?? null);
        setHistory(data.history ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hotspot?.id, useMock]);

  if (!hotspot) return null;

  return (
    <div
      className="absolute top-0 right-0 h-full w-full max-w-sm bg-[#111111] border-l border-gray-800 flex flex-col overflow-hidden z-10"
      data-testid="hotspot-panel"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-800">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white text-base leading-tight truncate">
            {hotspot.name}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{hotspot.region}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 text-gray-500 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Severity bar */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Severity</span>
          <span>{hotspot.article_count} articles</span>
        </div>
        <SeverityBar severity={hotspot.severity} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(["summary", "perspectives", "articles"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-gray-800 rounded w-full" />
            <div className="h-3 bg-gray-800 rounded w-5/6" />
            <div className="h-3 bg-gray-800 rounded w-4/6" />
            <div className="h-3 bg-gray-800 rounded w-full mt-4" />
            <div className="h-3 bg-gray-800 rounded w-3/4" />
          </div>
        ) : !detail ? (
          <p className="text-gray-500 text-sm">No data available.</p>
        ) : activeTab === "summary" ? (
          detail.summary ? (
            <SummaryView
              neutralSummary={detail.summary.neutral_summary}
              citations={detail.summary.citations}
            />
          ) : (
            <p className="text-gray-500 text-sm">Summary not available for this hotspot.</p>
          )
        ) : activeTab === "perspectives" ? (
          detail.summary?.perspectives?.length ? (
            <PerspectivesView
              perspectives={detail.summary.perspectives}
              citations={detail.summary.citations}
            />
          ) : (
            <p className="text-gray-500 text-sm">No perspectives available.</p>
          )
        ) : (
          <>
            <ArticleList articles={detail.articles} />
            <StoryArcPanel history={history} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-[10px] text-gray-600">
          Sources: AP, Reuters, BBC, NYT, WSJ, WaPo, FT, Economist, Guardian, Fox, Al Jazeera, Politico
        </p>
      </div>
    </div>
  );
}
