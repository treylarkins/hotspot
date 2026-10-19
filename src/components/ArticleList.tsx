"use client";

interface ArticleItem {
  id: string;
  url: string;
  headline: string;
  abstract: string | null;
  source_name: string;
  source_bias: string;
  published_at: string;
}

interface ArticleListProps {
  articles: ArticleItem[];
}

// Pill styles keyed by bias value
const BIAS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  left:           { bg: "bg-blue-700",  text: "text-blue-100",  label: "Left" },
  "center-left":  { bg: "bg-teal-700",  text: "text-teal-100",  label: "Center-Left" },
  center:         { bg: "bg-gray-600",  text: "text-gray-200",  label: "Center" },
  "center-right": { bg: "bg-orange-700",text: "text-orange-100",label: "Center-Right" },
  right:          { bg: "bg-red-700",   text: "text-red-100",   label: "Right" },
};

// Display order for bias groups
const BIAS_ORDER: string[] = ["left", "center-left", "center", "center-right", "right"];

// Section header label per group
const GROUP_LABEL: Record<string, string> = {
  left:           "Left",
  "center-left":  "Center-Left",
  center:         "Center",
  "center-right": "Center-Right",
  right:          "Right",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BiasPill({ bias }: { bias: string }) {
  const style = BIAS_PILL[bias];
  if (!style) {
    return (
      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
        {bias}
      </span>
    );
  }
  return (
    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function ArticleCard({ a }: { a: ArticleItem }) {
  return (
    <li className="border border-gray-800 rounded-md p-3 hover:border-gray-600 transition-colors">
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        {/* Row 1: bias pill + outlet name + timestamp */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <BiasPill bias={a.source_bias} />
          <span className="text-xs font-medium text-gray-300">{a.source_name}</span>
          <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
            {formatDate(a.published_at)} · {formatTime(a.published_at)}
          </span>
        </div>

        {/* Row 2: headline */}
        <p className="text-sm text-gray-200 group-hover:text-white transition-colors leading-snug font-medium">
          {a.headline}
        </p>

        {/* Row 3: abstract (when present) */}
        {a.abstract && (
          <p className="text-xs text-gray-400 mt-1 leading-snug line-clamp-2">
            {a.abstract}
          </p>
        )}
      </a>
    </li>
  );
}

export default function ArticleList({ articles }: ArticleListProps) {
  if (articles.length === 0) {
    return <p className="text-gray-500 text-sm">No articles available.</p>;
  }

  // Group articles by bias, preserving display order
  const grouped = BIAS_ORDER.reduce<Record<string, ArticleItem[]>>((acc, bias) => {
    const items = articles.filter((a) => a.source_bias === bias);
    if (items.length > 0) acc[bias] = items;
    return acc;
  }, {});

  // Articles with an unknown bias value fall into an "other" bucket
  const knownBiases = new Set(BIAS_ORDER);
  const unknown = articles.filter((a) => !knownBiases.has(a.source_bias));

  return (
    <div className="space-y-6" data-testid="article-list">
      {BIAS_ORDER.filter((bias) => grouped[bias]).map((bias) => (
        <section key={bias}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
            <BiasPill bias={bias} />
            <span>{GROUP_LABEL[bias]}</span>
            <span className="text-gray-600 font-normal normal-case tracking-normal">
              ({grouped[bias].length})
            </span>
          </h3>
          <ul className="space-y-2">
            {grouped[bias].map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </ul>
        </section>
      ))}

      {unknown.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Other ({unknown.length})
          </h3>
          <ul className="space-y-2">
            {unknown.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
