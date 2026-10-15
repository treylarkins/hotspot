"use client";

export interface HistoryPoint {
  date: string;
  count: number;
}

interface StoryArcPanelProps {
  history: HistoryPoint[];
}

const WIDTH = 260;
const HEIGHT = 56;
const PAD_X = 4;
const PAD_Y = 6;

export default function StoryArcPanel({ history }: StoryArcPanelProps) {
  if (!history || history.length === 0) return null;

  const maxCount = Math.max(...history.map((p) => p.count), 1);
  const minCount = Math.min(...history.map((p) => p.count), 0);
  const range = maxCount - minCount || 1;

  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_Y * 2;

  const toX = (i: number) =>
    PAD_X + (history.length === 1 ? plotW / 2 : (i / (history.length - 1)) * plotW);
  const toY = (count: number) =>
    PAD_Y + plotH - ((count - minCount) / range) * plotH;

  const points = history.map((p, i) => ({ x: toX(i), y: toY(p.count), ...p }));

  // Build SVG polyline points string
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Area fill path: line down to baseline, across, back up
  const baseY = PAD_Y + plotH;
  const areaPath =
    `M ${points[0].x.toFixed(1)},${baseY} ` +
    points.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L ${points[points.length - 1].x.toFixed(1)},${baseY} Z`;

  return (
    <div className="mt-4 pt-4 border-t border-gray-800" data-testid="story-arc-panel">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">7-day trend</p>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        aria-label="7-day article volume trend"
        role="img"
      >
        <defs>
          <linearGradient id="arc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C04040" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#C04040" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#arc-fill)" />

        {/* Line */}
        {history.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#C04040"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Points with hover titles */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={i === points.length - 1 ? 3 : 2}
              fill={i === points.length - 1 ? "#C04040" : "#7A0000"}
              opacity={i === points.length - 1 ? 1 : 0.7}
            />
            <title>{`${p.date}: ${p.count} articles`}</title>
          </g>
        ))}

        {/* Date labels: first and last */}
        <text
          x={PAD_X}
          y={HEIGHT - 1}
          fontSize="9"
          fill="#4B5563"
          textAnchor="start"
        >
          {history[0].date.slice(5)}
        </text>
        <text
          x={WIDTH - PAD_X}
          y={HEIGHT - 1}
          fontSize="9"
          fill="#4B5563"
          textAnchor="end"
        >
          {history[history.length - 1].date.slice(5)}
        </text>

        {/* Max count label */}
        <text
          x={points[history.map((p) => p.count).indexOf(maxCount)].x}
          y={toY(maxCount) - 3}
          fontSize="9"
          fill="#9CA3AF"
          textAnchor="middle"
        >
          {maxCount}
        </text>
      </svg>
    </div>
  );
}
