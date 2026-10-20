"use client";

interface CitationRef {
  index: number;
  article_id: string;
  headline: string;
  url: string;
  source_name: string;
  source_bias: string;
  published_at: string;
}

interface SummaryViewProps {
  neutralSummary: string;
  citations: CitationRef[];
}

/** Parse inline [n] or [n, m] citation markers and render them as superscript links */
function parseCitations(text: string, citations: CitationRef[]): React.ReactNode[] {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
    if (match) {
      const indices = match[1].split(/,\s*/).map((n) => parseInt(n, 10));
      const links = indices.flatMap((idx, j) => {
        const citation = citations.find((c) => c.index === idx);
        if (!citation) return [];
        return [
          <a
            key={`${i}-${j}`}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-[10px] font-mono text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded px-1 ml-0.5 transition-colors"
            title={`${citation.source_name}: ${citation.headline}`}
          >
            {idx}
          </a>,
        ];
      });
      return links.length > 0 ? <span key={i}>{links}</span> : <span key={i}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function SummaryView({ neutralSummary, citations }: SummaryViewProps) {
  // Split into sentences — same abbreviation-aware logic as summarize.ts
  // Avoids splitting on U.S., O.J., Mr., etc.
  const sentences = neutralSummary
    .split(/(?<![A-Z])[.!?]\s+(?=[A-Z])/)
    .filter((s) => s.trim().length > 10);

  return (
    <div className="space-y-1" data-testid="summary-view">
      {sentences.map((sentence, i) => (
        <p key={i} className="text-sm text-gray-300 leading-relaxed">
          {parseCitations(sentence, citations)}
        </p>
      ))}
    </div>
  );
}
