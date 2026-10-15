"use client";

interface Perspective {
  outlet_name: string;
  outlet_bias: string;
  framing: string;
  citations: number[];
}

interface CitationRef {
  index: number;
  url: string;
  source_name: string;
  headline: string;
}

interface PerspectivesViewProps {
  perspectives: Perspective[];
  citations: CitationRef[];
}

const BIAS_LABELS: Record<string, { label: string; color: string }> = {
  center: { label: "Center", color: "text-gray-400 border-gray-600" },
  "center-left": { label: "Center-Left", color: "text-blue-400 border-blue-800" },
  "center-right": { label: "Center-Right", color: "text-red-400 border-red-800" },
  left: { label: "Left", color: "text-blue-300 border-blue-700" },
  right: { label: "Right", color: "text-red-300 border-red-700" },
};

function parseCitationsInline(text: string, citations: CitationRef[]): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const citation = citations.find((c) => c.index === idx);
      if (citation) {
        return (
          <a
            key={i}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-[10px] font-mono text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 rounded px-1 ml-0.5 transition-colors"
            title={`${citation.source_name}: ${citation.headline}`}
          >
            {idx}
          </a>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function PerspectivesView({ perspectives, citations }: PerspectivesViewProps) {
  if (perspectives.length === 0) {
    return <p className="text-gray-500 text-sm">No perspectives available.</p>;
  }

  return (
    <div className="space-y-3" data-testid="perspectives-view">
      {perspectives.map((p, i) => {
        const biasStyle = BIAS_LABELS[p.outlet_bias] ?? {
          label: p.outlet_bias,
          color: "text-gray-400 border-gray-600",
        };
        return (
          <div key={i} className={`border-l-2 pl-3 ${biasStyle.color.split(" ")[1]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-white">{p.outlet_name}</span>
              <span className={`text-[10px] uppercase tracking-wide ${biasStyle.color.split(" ")[0]}`}>
                {biasStyle.label}
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {parseCitationsInline(p.framing, citations)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
