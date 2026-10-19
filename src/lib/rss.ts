import { randomUUID } from "crypto";
import { getSource } from "../config/sources";
import { headlineRelevanceScore } from "./gdelt";
import type { Article } from "../contracts/article";

// RSS feeds that provide headlines + abstracts without authentication
const RSS_FEEDS = [
  // WSJ — Dow Jones public feeds (no auth needed for the feed itself)
  "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
  "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
  "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",
  "https://feeds.a.dj.com/rss/RSSWSJD.xml",
  // Reuters — fully free
  "https://feeds.reuters.com/reuters/businessNews",
  "https://feeds.reuters.com/reuters/worldNews",
  "https://feeds.reuters.com/reuters/technologyNews",
  // FT — headlines free (content paywalled, but we only need headline + abstract)
  "https://www.ft.com/rss/home/uk",
  "https://www.ft.com/world/companies?format=rss",
  // The Economist
  "https://www.economist.com/rss",
  // CNBC — free
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://www.cnbc.com/id/10000664/device/rss/rss.html",
  // Nikkei Asia
  "https://asia.nikkei.com/rss/feed/nar",
  // AP Business + World
  "https://rss.ap.org/article/business",
  "https://rss.ap.org/article/world-news",
  // Bloomberg (may fail — Marketaux is the reliable fallback)
  "https://feeds.bloomberg.com/markets/news.rss",
  "https://feeds.bloomberg.com/technology/news.rss",
];

/** Minimal regex-based RSS/Atom parser — no new dependencies */
function parseRssFeed(xml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate: string;
}> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = cdata(tag(block, "title"));
    const link = tag(block, "link") || attrLink(block) || tag(block, "id");
    const description = cdata(
      tag(block, "description") || tag(block, "summary") || tag(block, "content")
    );
    const pubDate =
      tag(block, "pubDate") ||
      tag(block, "updated") ||
      tag(block, "dc:date") ||
      "";
    if (title && link?.startsWith("http")) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}
function cdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}
function attrLink(xml: string): string {
  const m = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

// Company name → HQ coordinates. Confidence 0.60 — used when no explicit city found.
const COMPANY_HQ: Array<[string, number, number]> = [
  // SF Bay Area tech
  ["apple",         37.3317, -122.0307],
  ["google",        37.4220, -122.0841],
  ["alphabet",      37.4220, -122.0841],
  ["meta ",         37.4846, -122.1482],
  ["facebook",      37.4846, -122.1482],
  ["nvidia",        37.3688, -122.0363],
  ["intel",         37.3875, -122.0575],
  ["cisco",         37.3654, -121.9589],
  ["salesforce",    37.7749, -122.4194],
  ["twitter",       37.7749, -122.4194],
  ["x corp",        37.7749, -122.4194],
  ["airbnb",        37.7749, -122.4194],
  ["lyft",          37.7749, -122.4194],
  ["stripe",        37.7749, -122.4194],
  ["openai",        37.7749, -122.4194],
  ["anthropic",     37.7749, -122.4194],
  ["uber",          37.7749, -122.4194],
  ["wells fargo",   37.7749, -122.4194],
  // Seattle
  ["amazon",        47.6062, -122.3321],
  ["microsoft",     47.6402, -122.1296],
  ["starbucks",     47.5480, -122.3879],
  ["costco",        47.6062, -122.3321],
  ["t-mobile",      47.6062, -122.3321],
  // Los Angeles
  ["warner bros",   34.1478, -118.3527],
  ["warner media",  34.0522, -118.2437],
  ["disney",        34.1478, -118.3527],
  ["paramount",     34.0522, -118.2437],
  ["universal",     34.1381, -118.3534],
  ["nbcuniversal",  34.1381, -118.3534],
  ["snapchat",      34.0195, -118.4912],
  ["snap inc",      34.0195, -118.4912],
  ["spacex",        33.9206, -118.3283],
  ["netflix",       34.0522, -118.2437],
  // Texas
  ["tesla",         30.2672,  -97.7431],
  ["exxon",         29.7604,  -95.3698],
  ["exxonmobil",    29.7604,  -95.3698],
  ["halliburton",   29.7604,  -95.3698],
  ["at&t",          32.7767,  -96.7970],
  ["dell",          30.2672,  -97.7431],
  // NYC financial
  ["goldman sachs",        40.7143, -74.0130],
  ["jpmorgan",             40.7143, -74.0130],
  ["jp morgan",            40.7143, -74.0130],
  ["morgan stanley",       40.7143, -74.0130],
  ["citigroup",            40.7143, -74.0130],
  ["citi ",                40.7143, -74.0130],
  ["blackrock",            40.7143, -74.0130],
  ["blackstone",           40.7143, -74.0130],
  ["kkr",                  40.7143, -74.0130],
  ["apollo ",              40.7143, -74.0130],
  ["american express",     40.7143, -74.0130],
  ["mastercard",           40.7553, -73.9948],
  ["pfizer",               40.7143, -74.0130],
  ["merck",                40.7553, -73.9948],
  ["bristol-myers",        40.7143, -74.0130],
  ["new york times",       40.7553, -73.9948],
  ["verizon",              40.7553, -73.9948],
  // Chicago
  ["mcdonald's",           41.8781,  -87.6298],
  ["united airlines",      41.8781,  -87.6298],
  ["walgreens",            42.0620,  -87.6873],
  ["motorola",             41.8781,  -87.6298],
  // Other US
  ["berkshire hathaway",   41.2524,  -95.9980],
  ["warren buffett",       41.2524,  -95.9980],
  ["walmart",              36.3728,  -94.2088],
  ["bank of america",      35.2271,  -80.8431],
  ["lockheed martin",      38.9072,  -77.0369],
  ["raytheon",             42.3601,  -71.0589],
  ["eli lilly",            39.7684,  -86.1581],
  ["boeing",               47.5480, -122.3879],
  ["chevron",              37.8044, -122.2712],
  // London
  ["hsbc",                 51.5074,  -0.1278],
  ["barclays",             51.5074,  -0.1278],
  ["shell",                51.5074,  -0.1278],
  ["bp ",                  51.5074,  -0.1278],
  ["astrazeneca",          51.5074,  -0.1278],
  ["glaxo",                51.5074,  -0.1278],
  ["gsk",                  51.5074,  -0.1278],
  ["vodafone",             51.5074,  -0.1278],
  ["bae systems",          51.5074,  -0.1278],
  ["rolls-royce",          51.5074,  -0.1278],
  ["unilever",             51.5074,  -0.1278],
  ["rio tinto",            51.5074,  -0.1278],
  ["standard chartered",   51.5074,  -0.1278],
  // Frankfurt / Germany
  ["deutsche bank",        50.1109,   8.6821],
  ["volkswagen",           52.4227,  10.7865],
  ["bmw",                  48.1351,  11.5820],
  ["siemens",              48.1351,  11.5820],
  ["bayer",                51.0504,  13.7373],
  ["sap",                  49.4004,   8.6700],
  ["allianz",              48.1351,  11.5820],
  // Paris
  ["lvmh",                 48.8566,   2.3522],
  ["bnp paribas",          48.8566,   2.3522],
  ["airbus",               43.6047,   1.4442],
  ["totalenergies",        48.8566,   2.3522],
  ["renault",              48.8566,   2.3522],
  // Zurich / Switzerland
  ["ubs",                  47.3769,   8.5417],
  ["novartis",             47.5600,   7.5886],
  ["roche",                47.5600,   7.5886],
  ["nestle",               46.5197,   6.6323],
  // Japan
  ["toyota",               35.0851, 137.1534],
  ["sony",                 35.6762, 139.6503],
  ["honda",                35.6762, 139.6503],
  ["softbank",             35.6762, 139.6503],
  ["nippon",               35.6762, 139.6503],
  ["mitsubishi",           35.6762, 139.6503],
  ["sumitomo",             35.6762, 139.6503],
  // China
  ["alibaba",              30.2741, 120.1551],
  ["tencent",              22.5431, 114.0579],
  ["huawei",               22.5431, 114.0579],
  ["byd",                  22.5431, 114.0579],
  ["baidu",                39.9042, 116.4074],
  ["bytedance",            39.9042, 116.4074],
  ["tiktok",               39.9042, 116.4074],
  ["xiaomi",               39.9042, 116.4074],
  // Korea
  ["samsung",              37.5140, 127.1000],
  ["hyundai",              37.5665, 126.9780],
  ["sk ",                  37.5665, 126.9780],
  ["lg ",                  37.5665, 126.9780],
  // Saudi
  ["aramco",               26.3158,  50.1045],
  ["saudi aramco",         26.3158,  50.1045],
];

// Explicit city mentions — checked first (highest confidence)
const CITIES: Array<[string, number, number, number]> = [
  ["new york",      40.7128,  -74.0060, 0.75],
  ["washington",    38.9072,  -77.0369, 0.75],
  ["london",        51.5074,   -0.1278, 0.85],
  ["beijing",       39.9042,  116.4074, 0.85],
  ["shanghai",      31.2304,  121.4737, 0.85],
  ["tokyo",         35.6762,  139.6503, 0.85],
  ["paris",         48.8566,    2.3522, 0.85],
  ["berlin",        52.5200,   13.4050, 0.85],
  ["moscow",        55.7558,   37.6173, 0.85],
  ["brussels",      50.8503,    4.3517, 0.80],
  ["frankfurt",     50.1109,    8.6821, 0.80],
  ["hong kong",     22.3193,  114.1694, 0.85],
  ["singapore",      1.3521,  103.8198, 0.85],
  ["dubai",         25.2048,   55.2708, 0.85],
  ["zurich",        47.3769,    8.5417, 0.80],
  ["seoul",         37.5665,  126.9780, 0.85],
  ["mumbai",        19.0760,   72.8777, 0.85],
  ["sydney",       -33.8688,  151.2093, 0.85],
  ["toronto",       43.6532,  -79.3832, 0.80],
  ["riyadh",        24.6877,   46.7219, 0.85],
  ["tehran",        35.6892,   51.3890, 0.85],
  ["tel aviv",      32.0853,   34.7818, 0.85],
  ["kyiv",          50.4501,   30.5234, 0.85],
  ["kiev",          50.4501,   30.5234, 0.85],
  ["ottawa",        45.4215,  -75.6972, 0.80],
  ["cairo",         30.0444,   31.2357, 0.85],
  ["nairobi",       -1.2921,   36.8219, 0.85],
  ["jakarta",       -6.2088,  106.8456, 0.85],
  ["brasilia",     -15.7942,  -47.8822, 0.85],
  ["buenos aires", -34.6037,  -58.3816, 0.85],
  ["mexico city",   19.4326,  -99.1332, 0.85],
  ["baghdad",       33.3152,   44.3661, 0.85],
  ["damascus",      33.5138,   36.2765, 0.85],
  ["kabul",         34.5553,   69.2075, 0.85],
  ["islamabad",     33.7294,   73.0931, 0.85],
  ["new delhi",     28.6139,   77.2090, 0.85],
  ["san francisco", 37.7749, -122.4194, 0.80],
  ["los angeles",   34.0522, -118.2437, 0.80],
  ["chicago",       41.8781,  -87.6298, 0.80],
  ["houston",       29.7604,  -95.3698, 0.80],
  ["boston",        42.3601,  -71.0589, 0.80],
  ["taipei",        25.0330,  121.5654, 0.85],
  ["stockholm",     59.3293,   18.0686, 0.80],
  ["amsterdam",     52.3676,    4.9041, 0.80],
];

// Country-level fallbacks (lowest confidence)
const COUNTRIES: Array<[string, number, number, number]> = [
  ["china",          35.8617,  104.1954, 0.40],
  ["russia",         61.5240,  105.3188, 0.40],
  ["european union", 50.8503,    4.3517, 0.35],
  ["ukraine",        48.3794,   31.1656, 0.40],
  ["iran",           32.4279,   53.6880, 0.40],
  ["israel",         31.0461,   34.8516, 0.40],
  ["india",          20.5937,   78.9629, 0.38],
  ["japan",          36.2048,  138.2529, 0.38],
  ["germany",        51.1657,   10.4515, 0.38],
  ["france",         46.2276,    2.2137, 0.38],
  ["united kingdom", 55.3781,   -3.4360, 0.38],
  ["brazil",        -14.2350,  -51.9253, 0.38],
  ["saudi arabia",   23.8859,   45.0792, 0.40],
  ["south korea",    35.9078,  127.7669, 0.38],
  ["taiwan",         23.5937,  120.9605, 0.40],
  ["indonesia",      -0.7893,  113.9213, 0.38],
  ["nigeria",         9.0820,    8.6753, 0.38],
  ["turkey",         38.9637,   35.2433, 0.38],
  ["mexico",         23.6345, -102.5528, 0.38],
  ["argentina",     -38.4161,  -63.6167, 0.38],
  ["pakistan",       30.3753,   69.3451, 0.38],
  ["united states",  37.1,     -95.7,    0.30],
  ["america",        37.1,     -95.7,    0.28],
];

/**
 * Extract location from article text.
 * Priority: explicit city mention > company HQ > country mention.
 */
export function extractLocation(
  text: string
): { lat: number; lng: number; confidence: number } | null {
  const lower = text.toLowerCase();

  // 1. Explicit city mention (highest confidence)
  for (const [name, lat, lng, conf] of CITIES) {
    if (lower.includes(name)) return { lat, lng, confidence: conf };
  }

  // 2. Country mention
  for (const [name, lat, lng, conf] of COUNTRIES) {
    if (lower.includes(name)) return { lat, lng, confidence: conf };
  }

  // 3. Company HQ inference
  for (const [name, lat, lng] of COMPANY_HQ) {
    if (lower.includes(name)) return { lat, lng, confidence: 0.60 };
  }

  return null;
}

/** Fetch articles from all public RSS feeds */
export async function fetchRssArticles(): Promise<Article[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feedUrl) => {
      const resp = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Hotspot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`RSS ${resp.status}: ${feedUrl}`);
      const xml = await resp.text();
      const now = new Date().toISOString();
      return parseRssFeed(xml)
        .map((item) => {
          const sourceInfo = getSource(item.link);
          if (!sourceInfo) return null;

          // Headline relevance: strong soft-news signal → drop
          if (headlineRelevanceScore(item.title) < -1) return null;

          const textForGeo = `${item.title} ${item.description}`;
          const loc = extractLocation(textForGeo);
          if (!loc) return null;

          let publishedAt: string;
          try {
            publishedAt = new Date(item.pubDate).toISOString();
          } catch {
            publishedAt = now;
          }

          let hostname: string;
          try {
            hostname = new URL(item.link).hostname.replace(/^www\./, "");
          } catch {
            return null;
          }

          const article: Article = {
            id: randomUUID(),
            url: item.link,
            headline: item.title.slice(0, 500),
            abstract: item.description.replace(/<[^>]+>/g, "").slice(0, 2000) || null,
            source_domain: hostname,
            source_name: sourceInfo.name,
            source_bias: sourceInfo.bias,
            source_tier: sourceInfo.tier,
            lat: loc.lat,
            lng: loc.lng,
            location_confidence: loc.confidence,
            goldstein: null,
            published_at: publishedAt,
            ingested_at: now,
            h3_cell: null,
          };
          return article;
        })
        .filter((a): a is Article => a !== null);
    })
  );

  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const a of r.value) {
        if (!seen.has(a.url)) {
          seen.add(a.url);
          articles.push(a);
        }
      }
    } else {
      console.warn("[rss] Feed failed:", (r.reason as Error)?.message ?? r.reason);
    }
  }
  console.log(`[rss] Fetched ${articles.length} articles from ${RSS_FEEDS.length} feeds`);
  return articles;
}

/**
 * Fetch Bloomberg + tier-1 financial articles via Marketaux API.
 * Set MARKETAUX_API_KEY in .env.local to enable (~$9/mo Basic plan).
 */
export async function fetchMarketauxArticles(): Promise<Article[]> {
  const key = process.env.MARKETAUX_API_KEY;
  if (!key) return [];

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const url = `https://api.marketaux.com/v1/news/all?api_token=${key}&filter_entities=true&language=en&published_after=${since}&limit=50`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`Marketaux ${resp.status}`);
    const data = (await resp.json()) as {
      data: Array<{
        title: string;
        url: string;
        description: string;
        published_at: string;
        source: string;
      }>;
    };

    const now = new Date().toISOString();
    const articles: Article[] = [];

    for (const item of data.data ?? []) {
      if (!item.url?.startsWith("http")) continue;
      const sourceInfo = getSource(item.url);
      if (!sourceInfo) continue;

      const textForGeo = `${item.title} ${item.description ?? ""}`;
      const loc = extractLocation(textForGeo);
      if (!loc) continue;

      let hostname: string;
      try {
        hostname = new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }

      articles.push({
        id: randomUUID(),
        url: item.url,
        headline: item.title.slice(0, 500),
        abstract: (item.description ?? "").slice(0, 2000) || null,
        source_domain: hostname,
        source_name: sourceInfo.name,
        source_bias: sourceInfo.bias,
        source_tier: sourceInfo.tier,
        lat: loc.lat,
        lng: loc.lng,
        location_confidence: loc.confidence,
        goldstein: null,
        published_at: item.published_at,
        ingested_at: now,
        h3_cell: null,
      });
    }

    console.log(`[marketaux] Fetched ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.warn("[marketaux] Failed:", err);
    return [];
  }
}
