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

const BIAS_COLORS: Record<string, string> = {
  center: "bg-gray-600 text-gray-200",
  "center-left": "bg-blue-900 text-blue-200",
  "center-right": "bg-red-900 text-red-200",
  left: "bg-blue-800 text-blue-100",
  right: "bg-red-800 text-red-100",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ArticleList({ articles }: ArticleListProps) {
  if (articles.length === 0) {
    return <p className="text-gray-500 text-sm">No articles available.</p>;
  }

  return (
    <ul className="space-y-2" data-testid="article-list">
      {articles.map((a) => (
        <li key={a.id} className="border border-gray-800 rounded-md p-3 hover:border-gray-600 transition-colors">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${BIAS_COLORS[a.source_bias] ?? "bg-gray-700 text-gray-300"}`}
              >
                {a.source_name}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(a.published_at)} · {formatTime(a.published_at)}
              </span>
            </div>
            <p className="text-sm text-gray-200 group-hover:text-white transition-colors leading-snug">
              {a.headline}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
