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

/** Parse inline [n] citation markers and render them as superscript links */
function parseCitations(text: string, citations: CitationRef[]): React.ReactNode[] {
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
            className="inline-flex items-center text-[10px] font-mono text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded px-1 ml-0.5 transition-colors"
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

export default function SummaryView({ neutralSummary, citations }: SummaryViewProps) {
  // Split into sentences to ensure each has a citation
  const sentences = neutralSummary
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

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
