"use client";

import { THERMO_CAT, CATEGORY_LABELS } from "@/lib/score";

// Keyword patterns for per-article classification — checked in priority order
const RESOURCE_RE = /\b(oil|gas\b|lng|crude|fuel|petroleum|pipeline|commodit|mining|mineral|coal|nuclear|uranium|lithium|copper|wheat|grain|harvest|drought|supply.chain|freight|shipping|cargo|tanker|refiner|opec|energy)\b/i;
const TECH_RE     = /\b(ai\b|a\.i\.|artificial.intelligen|machine.learn|deep.learn|tech(?:nology)?|software|semiconductor|chip\b|chips\b|cyber|digital|startup|silicon|algorithm|quantum|robot|autonomous|drone|data.center|cloud|gpu)\b/i;
const MONEY_RE    = /\b(market|bank|rate\b|inflation|gdp|econom|trade.war|tariff|sanction|currenc|invest|stock|bond|fund\b|debt|deficit|dollar|euro|yuan|renminbi|fiscal|budget|imf\b|federal.reserve|fed\b|treasury|recession|hedge.fund|ipo)\b/i;

function classifyArticle(headline: string, abstract: string | null): "money" | "power" | "resources" | "technology" {
  const text = `${headline} ${abstract ?? ""}`;
  if (RESOURCE_RE.test(text)) return "resources";
  if (TECH_RE.test(text))     return "technology";
  if (MONEY_RE.test(text))    return "money";
  return "power";
}

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CategoryPill({ category }: { category: string }) {
  const color = THERMO_CAT[category] ?? THERMO_CAT.power;
  const label = CATEGORY_LABELS[category] ?? category;
  return (
    <span
      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded tracking-wide"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}

function ArticleCard({ a }: { a: ArticleItem }) {
  const category = classifyArticle(a.headline, a.abstract);
  return (
    <li className="border border-gray-800 rounded-md p-3 hover:border-gray-700 transition-colors">
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="block group">
        {/* Row 1: category pill + outlet name + timestamp */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <CategoryPill category={category} />
          <span className="text-xs font-medium text-gray-300">{a.source_name}</span>
          <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
            {formatDate(a.published_at)} · {formatTime(a.published_at)}
          </span>
        </div>

        {/* Row 2: headline */}
        <p className="text-sm text-gray-200 group-hover:text-white transition-colors leading-snug font-medium">
          {a.headline}
        </p>

        {/* Row 3: abstract */}
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

  return (
    <ul className="space-y-2" data-testid="article-list">
      {articles.map((a) => (
        <ArticleCard key={a.id} a={a} />
      ))}
    </ul>
  );
}
