import { getSource } from "../config/sources";
import type { Article } from "../contracts/article";
import { randomUUID } from "crypto";

const NYT_API_BASE = "https://api.nytimes.com/svc/topstories/v2";
const NYT_SECTIONS = ["world", "us", "politics", "business", "technology", "science", "health", "climate", "upshot"];

interface NytArticle {
  url: string;
  title: string;
  abstract: string;
  published_date: string;
  geo_facet?: string[];
  multimedia?: Array<{ url: string; type: string }>;
}

interface NytResponse {
  results: NytArticle[];
}

const CITY_TEXT_MAP: Record<string, { lat: number; lng: number; confidence: number }> = {
  "kyiv": { lat: 50.4501, lng: 30.5234, confidence: 0.75 },
  "moscow": { lat: 55.7558, lng: 37.6176, confidence: 0.75 },
  "beijing": { lat: 39.9042, lng: 116.4074, confidence: 0.75 },
  "shanghai": { lat: 31.2304, lng: 121.4737, confidence: 0.75 },
  "taipei": { lat: 25.0330, lng: 121.5654, confidence: 0.80 },
  "tehran": { lat: 35.6892, lng: 51.3890, confidence: 0.80 },
  "tel aviv": { lat: 32.0853, lng: 34.7818, confidence: 0.80 },
  "jerusalem": { lat: 31.7683, lng: 35.2137, confidence: 0.80 },
  "gaza": { lat: 31.5017, lng: 34.4668, confidence: 0.85 },
  "london": { lat: 51.5074, lng: -0.1278, confidence: 0.75 },
  "paris": { lat: 48.8566, lng: 2.3522, confidence: 0.75 },
  "berlin": { lat: 52.5200, lng: 13.4050, confidence: 0.75 },
  "tokyo": { lat: 35.6762, lng: 139.6503, confidence: 0.75 },
  "seoul": { lat: 37.5665, lng: 126.9780, confidence: 0.75 },
  "pyongyang": { lat: 39.0392, lng: 125.7625, confidence: 0.80 },
  "islamabad": { lat: 33.6844, lng: 73.0479, confidence: 0.75 },
  "kabul": { lat: 34.5553, lng: 69.2075, confidence: 0.80 },
  "baghdad": { lat: 33.3152, lng: 44.3661, confidence: 0.80 },
  "riyadh": { lat: 24.7136, lng: 46.6753, confidence: 0.75 },
  "dubai": { lat: 25.2048, lng: 55.2708, confidence: 0.75 },
  "caracas": { lat: 10.4806, lng: -66.9036, confidence: 0.75 },
  "havana": { lat: 23.1136, lng: -82.3666, confidence: 0.75 },
  "hong kong": { lat: 22.3193, lng: 114.1694, confidence: 0.80 },
  "singapore": { lat: 1.3521, lng: 103.8198, confidence: 0.75 },
  "new delhi": { lat: 28.6139, lng: 77.2090, confidence: 0.75 },
  "mumbai": { lat: 19.0760, lng: 72.8777, confidence: 0.75 },
  "cairo": { lat: 30.0444, lng: 31.2357, confidence: 0.75 },
  "nairobi": { lat: -1.2921, lng: 36.8219, confidence: 0.75 },
  "lagos": { lat: 6.5244, lng: 3.3792, confidence: 0.75 },
  "johannesburg": { lat: -26.2041, lng: 28.0473, confidence: 0.75 },
  "san francisco": { lat: 37.7749, lng: -122.4194, confidence: 0.75 },
  "silicon valley": { lat: 37.3861, lng: -122.0839, confidence: 0.80 },
  "wall street": { lat: 40.7074, lng: -74.0113, confidence: 0.85 },
  "los angeles": { lat: 34.0522, lng: -118.2437, confidence: 0.75 },
  "chicago": { lat: 41.8781, lng: -87.6298, confidence: 0.75 },
  "miami": { lat: 25.7617, lng: -80.1918, confidence: 0.75 },
  "houston": { lat: 29.7604, lng: -95.3698, confidence: 0.75 },
  "seattle": { lat: 47.6062, lng: -122.3321, confidence: 0.75 },
  "boston": { lat: 42.3601, lng: -71.0589, confidence: 0.75 },
  "detroit": { lat: 42.3314, lng: -83.0458, confidence: 0.75 },
  "atlanta": { lat: 33.7490, lng: -84.3880, confidence: 0.75 },
  "ottawa": { lat: 45.4215, lng: -75.6972, confidence: 0.75 },
  "toronto": { lat: 43.6532, lng: -79.3832, confidence: 0.75 },
  "mexico city": { lat: 19.4326, lng: -99.1332, confidence: 0.75 },
  "buenos aires": { lat: -34.6037, lng: -58.3816, confidence: 0.75 },
  "brasilia": { lat: -15.7942, lng: -47.8822, confidence: 0.75 },
  "sao paulo": { lat: -23.5505, lng: -46.6333, confidence: 0.75 },
  "sydney": { lat: -33.8688, lng: 151.2093, confidence: 0.75 },
  "manila": { lat: 14.5995, lng: 120.9842, confidence: 0.75 },
  "jakarta": { lat: -6.2088, lng: 106.8456, confidence: 0.75 },
  "bangkok": { lat: 13.7563, lng: 100.5018, confidence: 0.75 },
  "hanoi": { lat: 21.0285, lng: 105.8542, confidence: 0.75 },
  "ankara": { lat: 39.9334, lng: 32.8597, confidence: 0.75 },
  "rome": { lat: 41.9028, lng: 12.4964, confidence: 0.75 },
  "madrid": { lat: 40.4168, lng: -3.7038, confidence: 0.75 },
  "brussels": { lat: 50.8503, lng: 4.3517, confidence: 0.75 },
  "amsterdam": { lat: 52.3676, lng: 4.9041, confidence: 0.75 },
  "zurich": { lat: 47.3769, lng: 8.5417, confidence: 0.75 },
  "vienna": { lat: 48.2082, lng: 16.3738, confidence: 0.75 },
  "warsaw": { lat: 52.2297, lng: 21.0122, confidence: 0.75 },
  "stockholm": { lat: 59.3293, lng: 18.0686, confidence: 0.75 },
  "oslo": { lat: 59.9139, lng: 10.7522, confidence: 0.75 },
  "copenhagen": { lat: 55.6761, lng: 12.5683, confidence: 0.75 },
  "helsinki": { lat: 60.1699, lng: 24.9384, confidence: 0.75 },
  "prague": { lat: 50.0755, lng: 14.4378, confidence: 0.75 },
  "budapest": { lat: 47.4979, lng: 19.0402, confidence: 0.75 },
  "bucharest": { lat: 44.4268, lng: 26.1025, confidence: 0.75 },
  "kiev": { lat: 50.4501, lng: 30.5234, confidence: 0.75 },
  "minsk": { lat: 53.9045, lng: 27.5615, confidence: 0.75 },
  "tbilisi": { lat: 41.6938, lng: 44.8015, confidence: 0.75 },
  // US capital — the most common dateline in US political news
  "washington": { lat: 38.9072, lng: -77.0369, confidence: 0.75 },
  "congress": { lat: 38.8899, lng: -77.0091, confidence: 0.65 },
  "senate": { lat: 38.8899, lng: -77.0091, confidence: 0.65 },
  "pentagon": { lat: 38.8719, lng: -77.0563, confidence: 0.80 },
  "white house": { lat: 38.8977, lng: -77.0366, confidence: 0.80 },
  "new york": { lat: 40.7128, lng: -74.0060, confidence: 0.70 },
};

const COUNTRY_TEXT_MAP: Record<string, { lat: number; lng: number; confidence: number }> = {
  "ukraine": { lat: 48.3794, lng: 31.1656, confidence: 0.55 },
  "russia": { lat: 61.5240, lng: 105.3188, confidence: 0.45 },
  "china": { lat: 35.8617, lng: 104.1954, confidence: 0.45 },
  "taiwan": { lat: 23.6978, lng: 120.9605, confidence: 0.60 },
  "iran": { lat: 32.4279, lng: 53.6880, confidence: 0.55 },
  "israel": { lat: 31.0461, lng: 34.8516, confidence: 0.60 },
  "north korea": { lat: 40.3399, lng: 127.5101, confidence: 0.65 },
  "venezuela": { lat: 6.4238, lng: -66.5897, confidence: 0.55 },
  "afghanistan": { lat: 33.9391, lng: 67.7100, confidence: 0.55 },
  "pakistan": { lat: 30.3753, lng: 69.3451, confidence: 0.50 },
  "india": { lat: 20.5937, lng: 78.9629, confidence: 0.45 },
  "brazil": { lat: -14.235, lng: -51.9253, confidence: 0.45 },
  "saudi arabia": { lat: 23.8859, lng: 45.0792, confidence: 0.55 },
  "turkey": { lat: 38.9637, lng: 35.2433, confidence: 0.50 },
  "germany": { lat: 51.1657, lng: 10.4515, confidence: 0.50 },
  "france": { lat: 46.2276, lng: 2.2137, confidence: 0.50 },
  "japan": { lat: 36.2048, lng: 138.2529, confidence: 0.50 },
  "south korea": { lat: 35.9078, lng: 127.7669, confidence: 0.55 },
  "mexico": { lat: 23.6345, lng: -102.5528, confidence: 0.50 },
  "indonesia": { lat: -0.7893, lng: 113.9213, confidence: 0.45 },
  "nigeria": { lat: 9.082, lng: 8.6753, confidence: 0.50 },
  "ethiopia": { lat: 9.145, lng: 40.4897, confidence: 0.55 },
  "syria": { lat: 34.8021, lng: 38.9968, confidence: 0.60 },
  "iraq": { lat: 33.2232, lng: 43.6793, confidence: 0.60 },
  "yemen": { lat: 15.5527, lng: 48.5164, confidence: 0.60 },
  "myanmar": { lat: 21.9162, lng: 95.9560, confidence: 0.60 },
  "sudan": { lat: 12.8628, lng: 30.2176, confidence: 0.60 },
  "somalia": { lat: 5.1521, lng: 46.1996, confidence: 0.60 },
  "libya": { lat: 26.3351, lng: 17.2283, confidence: 0.60 },
  "haiti": { lat: 18.9712, lng: -72.2852, confidence: 0.65 },
  "cuba": { lat: 21.5218, lng: -77.7812, confidence: 0.60 },
  // US as a country — low confidence (country-level centroid)
  "united states": { lat: 37.1, lng: -95.7, confidence: 0.30 },
  "america": { lat: 37.1, lng: -95.7, confidence: 0.28 },
};

/** Fallback: extract location from article text by scanning for known place names */
function extractLocationFromText(text: string): { lat: number; lng: number; confidence: number } | null {
  const lower = text.toLowerCase();

  // City matches — higher confidence, check first
  for (const [name, coords] of Object.entries(CITY_TEXT_MAP)) {
    if (lower.includes(name.toLowerCase())) return coords;
  }
  // Country matches — lower confidence
  for (const [name, coords] of Object.entries(COUNTRY_TEXT_MAP)) {
    if (lower.includes(name.toLowerCase())) return coords;
  }
  return null;
}

/** Fetch NYT Top Stories for given sections */
export async function fetchNytTopStories(apiKey?: string): Promise<Article[]> {
  const key = apiKey ?? process.env.NYT_API_KEY;
  if (!key) throw new Error("NYT_API_KEY not set");

  const articles: Article[] = [];
  const now = new Date().toISOString();

  for (const section of NYT_SECTIONS) {
    const url = `${NYT_API_BASE}/${section}.json?api-key=${key}`;
    let data: NytResponse;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      data = await response.json();
    } catch {
      continue;
    }

    for (const item of data.results ?? []) {
      if (!item.url) continue;
      const sourceInfo = getSource(item.url);
      if (!sourceInfo) continue;

      // Geocode from geo_facet: find highest-confidence match across all facets
      let coords: { lat: number; lng: number; confidence: number } | null = null;
      for (const facet of (item.geo_facet ?? [])) {
        const c = geoFacetToCoords(facet);
        if (c && (!coords || c.confidence > coords.confidence)) {
          coords = c;
        }
      }
      if (!coords) {
        const searchText = `${item.title} ${item.abstract ?? ""}`;
        coords = extractLocationFromText(searchText);
      }
      if (!coords) continue;

      articles.push({
        id: randomUUID(),
        url: item.url,
        headline: item.title ?? "",
        abstract: item.abstract ?? null,
        source_domain: "nytimes.com",
        source_name: sourceInfo.name,
        source_bias: sourceInfo.bias,
        source_tier: sourceInfo.tier,
        lat: coords.lat,
        lng: coords.lng,
        location_confidence: coords.confidence,
        goldstein: null,
        published_at: item.published_date,
        ingested_at: now,
        h3_cell: null,
      });
    }
  }

  return articles;
}

/** Basic geo_facet → lat/lng mapping for common NYT tags */
const GEO_FACET_MAP: Record<string, { lat: number; lng: number; confidence: number }> = {
  // ─── Countries & regions ──────────────────────────────────────────────────
  "Afghanistan": { lat: 33.9, lng: 67.7, confidence: 0.5 },
  "Argentina": { lat: -38.4, lng: -63.6, confidence: 0.5 },
  "Australia": { lat: -25.3, lng: 133.8, confidence: 0.5 },
  "Brazil": { lat: -14.2, lng: -51.9, confidence: 0.5 },
  "Canada": { lat: 56.1, lng: -106.3, confidence: 0.5 },
  "China": { lat: 35.0, lng: 105.0, confidence: 0.5 },
  "Europe": { lat: 50.0, lng: 15.0, confidence: 0.4 },
  "France": { lat: 46.2, lng: 2.2, confidence: 0.6 },
  "Gaza Strip": { lat: 31.4, lng: 34.3, confidence: 0.9 },
  "Germany": { lat: 51.2, lng: 10.5, confidence: 0.6 },
  "India": { lat: 20.6, lng: 78.9, confidence: 0.5 },
  "Indonesia": { lat: -0.8, lng: 113.9, confidence: 0.5 },
  "Iran": { lat: 32.4, lng: 53.7, confidence: 0.6 },
  "Iraq": { lat: 33.2, lng: 43.7, confidence: 0.6 },
  "Israel": { lat: 31.0, lng: 34.9, confidence: 0.7 },
  "Italy": { lat: 41.9, lng: 12.6, confidence: 0.6 },
  "Japan": { lat: 36.2, lng: 138.3, confidence: 0.6 },
  "Mexico": { lat: 23.6, lng: -102.6, confidence: 0.5 },
  "Middle East": { lat: 29.3, lng: 42.5, confidence: 0.4 },
  "Netherlands": { lat: 52.1, lng: 5.3, confidence: 0.6 },
  "Nigeria": { lat: 9.1, lng: 8.7, confidence: 0.5 },
  "North Korea": { lat: 40.3, lng: 127.5, confidence: 0.6 },
  "Pakistan": { lat: 30.4, lng: 69.3, confidence: 0.5 },
  "Russia": { lat: 61.5, lng: 105.3, confidence: 0.5 },
  "Saudi Arabia": { lat: 23.9, lng: 45.1, confidence: 0.6 },
  "South Korea": { lat: 35.9, lng: 127.8, confidence: 0.6 },
  "Spain": { lat: 40.5, lng: -3.7, confidence: 0.6 },
  "Sweden": { lat: 60.1, lng: 18.6, confidence: 0.6 },
  "Switzerland": { lat: 46.8, lng: 8.2, confidence: 0.7 },
  "Taiwan": { lat: 23.7, lng: 121.0, confidence: 0.8 },
  "Turkey": { lat: 38.9, lng: 35.2, confidence: 0.6 },
  "Ukraine": { lat: 48.4, lng: 31.2, confidence: 0.7 },
  "United Arab Emirates": { lat: 23.4, lng: 53.8, confidence: 0.7 },
  "United Kingdom": { lat: 55.4, lng: -3.4, confidence: 0.6 },
  "United States": { lat: 37.1, lng: -95.7, confidence: 0.3 },
  "Venezuela": { lat: 6.4, lng: -66.6, confidence: 0.5 },
  "Vietnam": { lat: 14.1, lng: 108.3, confidence: 0.5 },
  "Yemen": { lat: 15.6, lng: 48.5, confidence: 0.6 },

  // ─── Washington DC region ─────────────────────────────────────────────────
  "Washington (DC)": { lat: 38.9072, lng: -77.0369, confidence: 0.92 },
  "Washington": { lat: 38.9072, lng: -77.0369, confidence: 0.88 },
  "Washington, D.C. (USA)": { lat: 38.9072, lng: -77.0369, confidence: 0.95 },
  "Washington, DC": { lat: 38.9072, lng: -77.0369, confidence: 0.92 },
  "Washington D.C.": { lat: 38.9072, lng: -77.0369, confidence: 0.92 },
  "D.C.": { lat: 38.9072, lng: -77.0369, confidence: 0.92 },
  "DC": { lat: 38.9072, lng: -77.0369, confidence: 0.92 },
  "Capitol Hill": { lat: 38.8899, lng: -77.0091, confidence: 0.93 },
  "White House": { lat: 38.8977, lng: -77.0366, confidence: 0.95 },
  "Pentagon": { lat: 38.8719, lng: -77.0563, confidence: 0.95 },
  "Arlington": { lat: 38.8816, lng: -77.0910, confidence: 0.92 },
  "McLean": { lat: 38.9339, lng: -77.1773, confidence: 0.92 },
  "Tysons Corner": { lat: 38.9204, lng: -77.2311, confidence: 0.92 },
  "Bethesda": { lat: 38.9807, lng: -77.1002, confidence: 0.92 },
  "Alexandria": { lat: 38.8048, lng: -77.0469, confidence: 0.92 },

  // ─── New York City region ─────────────────────────────────────────────────
  "New York City, New York (USA)": { lat: 40.7128, lng: -74.0060, confidence: 0.95 },
  "New York City": { lat: 40.7128, lng: -74.0060, confidence: 0.94 },
  "New York (City)": { lat: 40.7128, lng: -74.0060, confidence: 0.94 },
  "NYC": { lat: 40.7128, lng: -74.0060, confidence: 0.94 },
  "Manhattan": { lat: 40.7831, lng: -73.9712, confidence: 0.94 },
  "Wall Street": { lat: 40.7074, lng: -74.0113, confidence: 0.95 },
  "Brooklyn": { lat: 40.6782, lng: -73.9442, confidence: 0.93 },
  "Queens": { lat: 40.7282, lng: -73.7949, confidence: 0.93 },
  "Bronx": { lat: 40.8448, lng: -73.8648, confidence: 0.93 },
  "Staten Island": { lat: 40.5795, lng: -74.1502, confidence: 0.93 },
  "Harlem": { lat: 40.8116, lng: -73.9465, confidence: 0.93 },
  "Midtown Manhattan": { lat: 40.7549, lng: -73.9840, confidence: 0.94 },
  "Lower Manhattan": { lat: 40.7074, lng: -74.0113, confidence: 0.94 },
  "Times Square": { lat: 40.7580, lng: -73.9855, confidence: 0.95 },
  "New York State": { lat: 42.1657, lng: -74.9481, confidence: 0.45 },
  "Hoboken": { lat: 40.7440, lng: -74.0324, confidence: 0.91 },
  "Jersey City": { lat: 40.7178, lng: -74.0431, confidence: 0.91 },

  // ─── San Francisco / Bay Area ─────────────────────────────────────────────
  "San Francisco, California (USA)": { lat: 37.7749, lng: -122.4194, confidence: 0.95 },
  "San Francisco": { lat: 37.7749, lng: -122.4194, confidence: 0.94 },
  "San Francisco Bay Area": { lat: 37.7749, lng: -122.4194, confidence: 0.90 },
  "Bay Area": { lat: 37.7749, lng: -122.4194, confidence: 0.90 },
  "SOMA": { lat: 37.7786, lng: -122.3982, confidence: 0.94 },
  "Silicon Valley (USA)": { lat: 37.3861, lng: -122.0839, confidence: 0.95 },
  "Silicon Valley": { lat: 37.3861, lng: -122.0839, confidence: 0.91 },
  "San Jose, California (USA)": { lat: 37.3382, lng: -121.8863, confidence: 0.95 },
  "San Jose": { lat: 37.3382, lng: -121.8863, confidence: 0.93 },
  "Palo Alto, California (USA)": { lat: 37.4419, lng: -122.1430, confidence: 0.95 },
  "Palo Alto": { lat: 37.4419, lng: -122.1430, confidence: 0.93 },
  "Cupertino": { lat: 37.3230, lng: -122.0322, confidence: 0.93 },
  "Menlo Park": { lat: 37.4530, lng: -122.1820, confidence: 0.93 },
  "Mountain View": { lat: 37.3861, lng: -122.0839, confidence: 0.93 },
  "Sunnyvale": { lat: 37.3688, lng: -122.0363, confidence: 0.93 },
  "Redwood City": { lat: 37.4852, lng: -122.2364, confidence: 0.93 },
  "Santa Clara": { lat: 37.3541, lng: -121.9552, confidence: 0.93 },
  "Oakland": { lat: 37.8044, lng: -122.2712, confidence: 0.93 },
  "Berkeley": { lat: 37.8716, lng: -122.2727, confidence: 0.93 },
  "Fremont": { lat: 37.5485, lng: -121.9886, confidence: 0.92 },

  // ─── Los Angeles region ───────────────────────────────────────────────────
  "Los Angeles, California (USA)": { lat: 34.0522, lng: -118.2437, confidence: 0.95 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437, confidence: 0.94 },
  "Hollywood": { lat: 34.0928, lng: -118.3287, confidence: 0.93 },
  "Santa Monica": { lat: 34.0195, lng: -118.4912, confidence: 0.93 },
  "Venice Beach": { lat: 33.9850, lng: -118.4695, confidence: 0.93 },
  "Culver City": { lat: 34.0211, lng: -118.3965, confidence: 0.93 },
  "El Segundo": { lat: 33.9192, lng: -118.4165, confidence: 0.93 },
  "Burbank": { lat: 34.1808, lng: -118.3090, confidence: 0.93 },
  "Pasadena": { lat: 34.1478, lng: -118.1445, confidence: 0.93 },
  "Long Beach": { lat: 33.7701, lng: -118.1937, confidence: 0.93 },
  "Irvine": { lat: 33.6846, lng: -117.8265, confidence: 0.93 },

  // ─── Seattle region ───────────────────────────────────────────────────────
  "Seattle, Washington (USA)": { lat: 47.6062, lng: -122.3321, confidence: 0.95 },
  "Seattle": { lat: 47.6062, lng: -122.3321, confidence: 0.94 },
  "Bellevue": { lat: 47.6101, lng: -122.2015, confidence: 0.93 },
  "Redmond": { lat: 47.6740, lng: -122.1215, confidence: 0.93 },
  "Kirkland": { lat: 47.6815, lng: -122.2087, confidence: 0.93 },
  "Tacoma": { lat: 47.2529, lng: -122.4443, confidence: 0.92 },

  // ─── Austin region ────────────────────────────────────────────────────────
  "Austin, Texas (USA)": { lat: 30.2672, lng: -97.7431, confidence: 0.95 },
  "Austin": { lat: 30.2672, lng: -97.7431, confidence: 0.93 },
  "Round Rock": { lat: 30.5083, lng: -97.6789, confidence: 0.93 },

  // ─── Boston / Cambridge region ────────────────────────────────────────────
  "Boston, Massachusetts (USA)": { lat: 42.3601, lng: -71.0589, confidence: 0.95 },
  "Boston": { lat: 42.3601, lng: -71.0589, confidence: 0.94 },
  "Cambridge, Massachusetts (USA)": { lat: 42.3736, lng: -71.1097, confidence: 0.95 },
  "Cambridge": { lat: 42.3736, lng: -71.1097, confidence: 0.93 },
  "Somerville": { lat: 42.3876, lng: -71.0995, confidence: 0.93 },
  "Kendall Square": { lat: 42.3626, lng: -71.0843, confidence: 0.94 },

  // ─── Chicago region ───────────────────────────────────────────────────────
  "Chicago, Illinois (USA)": { lat: 41.8781, lng: -87.6298, confidence: 0.95 },
  "Chicago": { lat: 41.8781, lng: -87.6298, confidence: 0.94 },
  "Evanston": { lat: 42.0451, lng: -87.6877, confidence: 0.93 },

  // ─── Miami region ─────────────────────────────────────────────────────────
  "Miami, Florida (USA)": { lat: 25.7617, lng: -80.1918, confidence: 0.95 },
  "Miami": { lat: 25.7617, lng: -80.1918, confidence: 0.94 },
  "Fort Lauderdale": { lat: 26.1224, lng: -80.1373, confidence: 0.93 },
  "Boca Raton": { lat: 26.3683, lng: -80.1289, confidence: 0.93 },
  "Coral Gables": { lat: 25.7215, lng: -80.2684, confidence: 0.93 },

  // ─── Atlanta ──────────────────────────────────────────────────────────────
  "Atlanta, Georgia (USA)": { lat: 33.7490, lng: -84.3880, confidence: 0.95 },
  "Atlanta": { lat: 33.7490, lng: -84.3880, confidence: 0.94 },
  "Buckhead": { lat: 33.8426, lng: -84.3638, confidence: 0.93 },
  "Alpharetta": { lat: 34.0754, lng: -84.2941, confidence: 0.93 },

  // ─── Denver / Boulder ─────────────────────────────────────────────────────
  "Denver, Colorado (USA)": { lat: 39.7392, lng: -104.9903, confidence: 0.95 },
  "Denver": { lat: 39.7392, lng: -104.9903, confidence: 0.94 },
  "Boulder": { lat: 40.0150, lng: -105.2705, confidence: 0.93 },
  "Colorado Springs": { lat: 38.8339, lng: -104.8214, confidence: 0.93 },

  // ─── Dallas / Fort Worth ──────────────────────────────────────────────────
  "Dallas, Texas (USA)": { lat: 32.7767, lng: -96.7970, confidence: 0.95 },
  "Dallas": { lat: 32.7767, lng: -96.7970, confidence: 0.94 },
  "Fort Worth": { lat: 32.7555, lng: -97.3308, confidence: 0.93 },
  "Plano": { lat: 33.0198, lng: -96.6989, confidence: 0.93 },
  "Irving": { lat: 32.8140, lng: -96.9489, confidence: 0.93 },
  "Frisco": { lat: 33.1507, lng: -96.8236, confidence: 0.92 },

  // ─── Houston ──────────────────────────────────────────────────────────────
  "Houston, Texas (USA)": { lat: 29.7604, lng: -95.3698, confidence: 0.95 },
  "Houston": { lat: 29.7604, lng: -95.3698, confidence: 0.94 },
  "The Woodlands": { lat: 30.1658, lng: -95.4613, confidence: 0.93 },
  "Sugar Land": { lat: 29.6197, lng: -95.6349, confidence: 0.93 },

  // ─── Philadelphia ─────────────────────────────────────────────────────────
  "Philadelphia, Pennsylvania (USA)": { lat: 39.9526, lng: -75.1652, confidence: 0.95 },
  "Philadelphia": { lat: 39.9526, lng: -75.1652, confidence: 0.94 },
  "Wilmington": { lat: 39.7459, lng: -75.5466, confidence: 0.92 },

  // ─── Phoenix ──────────────────────────────────────────────────────────────
  "Phoenix, Arizona (USA)": { lat: 33.4484, lng: -112.0740, confidence: 0.95 },
  "Phoenix": { lat: 33.4484, lng: -112.0740, confidence: 0.94 },
  "Scottsdale": { lat: 33.4942, lng: -111.9261, confidence: 0.93 },
  "Tempe": { lat: 33.4255, lng: -111.9400, confidence: 0.93 },
  "Mesa": { lat: 33.4152, lng: -111.8315, confidence: 0.92 },

  // ─── Minneapolis ──────────────────────────────────────────────────────────
  "Minneapolis, Minnesota (USA)": { lat: 44.9778, lng: -93.2650, confidence: 0.95 },
  "Minneapolis": { lat: 44.9778, lng: -93.2650, confidence: 0.94 },
  "St. Paul": { lat: 44.9537, lng: -93.0900, confidence: 0.94 },
  "Saint Paul": { lat: 44.9537, lng: -93.0900, confidence: 0.93 },

  // ─── Portland ─────────────────────────────────────────────────────────────
  "Portland, Oregon (USA)": { lat: 45.5051, lng: -122.6750, confidence: 0.95 },
  "Portland": { lat: 45.5051, lng: -122.6750, confidence: 0.94 },
  "Beaverton": { lat: 45.4871, lng: -122.8037, confidence: 0.93 },

  // ─── Salt Lake City ───────────────────────────────────────────────────────
  "Salt Lake City, Utah (USA)": { lat: 40.7608, lng: -111.8910, confidence: 0.95 },
  "Salt Lake City": { lat: 40.7608, lng: -111.8910, confidence: 0.94 },
  "Provo": { lat: 40.2338, lng: -111.6585, confidence: 0.93 },

  // ─── Pittsburgh ───────────────────────────────────────────────────────────
  "Pittsburgh, Pennsylvania (USA)": { lat: 40.4406, lng: -79.9959, confidence: 0.95 },
  "Pittsburgh": { lat: 40.4406, lng: -79.9959, confidence: 0.94 },

  // ─── Detroit / Ann Arbor ──────────────────────────────────────────────────
  "Detroit, Michigan (USA)": { lat: 42.3314, lng: -83.0458, confidence: 0.95 },
  "Detroit": { lat: 42.3314, lng: -83.0458, confidence: 0.94 },
  "Ann Arbor": { lat: 42.2808, lng: -83.7430, confidence: 0.93 },

  // ─── Nashville ────────────────────────────────────────────────────────────
  "Nashville, Tennessee (USA)": { lat: 36.1627, lng: -86.7816, confidence: 0.95 },
  "Nashville": { lat: 36.1627, lng: -86.7816, confidence: 0.94 },

  // ─── Raleigh / Research Triangle ─────────────────────────────────────────
  "Raleigh, North Carolina (USA)": { lat: 35.7796, lng: -78.6382, confidence: 0.95 },
  "Raleigh": { lat: 35.7796, lng: -78.6382, confidence: 0.94 },
  "Durham": { lat: 35.9940, lng: -78.8986, confidence: 0.93 },
  "Chapel Hill": { lat: 35.9132, lng: -79.0558, confidence: 0.93 },
  "Research Triangle": { lat: 35.8996, lng: -78.8630, confidence: 0.91 },
  "Raleigh-Durham": { lat: 35.8996, lng: -78.8630, confidence: 0.91 },

  // ─── San Diego ────────────────────────────────────────────────────────────
  "San Diego": { lat: 32.7157, lng: -117.1611, confidence: 0.94 },
  "La Jolla": { lat: 32.8328, lng: -117.2713, confidence: 0.93 },
  "Carlsbad": { lat: 33.1581, lng: -117.3506, confidence: 0.93 },

  // ─── Las Vegas ────────────────────────────────────────────────────────────
  "Las Vegas": { lat: 36.1699, lng: -115.1398, confidence: 0.94 },

  // ─── Charlotte ────────────────────────────────────────────────────────────
  "Charlotte": { lat: 35.2271, lng: -80.8431, confidence: 0.94 },

  // ─── Columbus ─────────────────────────────────────────────────────────────
  "Columbus": { lat: 39.9612, lng: -82.9988, confidence: 0.93 },

  // ─── Kansas City ──────────────────────────────────────────────────────────
  "Kansas City": { lat: 39.0997, lng: -94.5786, confidence: 0.93 },

  // ─── Indianapolis ─────────────────────────────────────────────────────────
  "Indianapolis": { lat: 39.7684, lng: -86.1581, confidence: 0.94 },

  // ─── Cincinnati ───────────────────────────────────────────────────────────
  "Cincinnati": { lat: 39.1031, lng: -84.5120, confidence: 0.94 },

  // ─── Milwaukee ────────────────────────────────────────────────────────────
  "Milwaukee": { lat: 43.0389, lng: -87.9065, confidence: 0.94 },

  // ─── St. Louis ────────────────────────────────────────────────────────────
  "St. Louis": { lat: 38.6270, lng: -90.1994, confidence: 0.94 },
  "Saint Louis": { lat: 38.6270, lng: -90.1994, confidence: 0.93 },

  // ─── Baltimore ────────────────────────────────────────────────────────────
  "Baltimore": { lat: 39.2904, lng: -76.6122, confidence: 0.94 },

  // ─── Sacramento ───────────────────────────────────────────────────────────
  "Sacramento": { lat: 38.5816, lng: -121.4944, confidence: 0.93 },

  // ─── San Antonio ──────────────────────────────────────────────────────────
  "San Antonio": { lat: 29.4241, lng: -98.4936, confidence: 0.94 },

  // ─── Richmond ─────────────────────────────────────────────────────────────
  "Richmond": { lat: 37.5407, lng: -77.4360, confidence: 0.93 },

  // ─── Hartford / Connecticut corridor ─────────────────────────────────────
  "Hartford": { lat: 41.7658, lng: -72.6851, confidence: 0.93 },
  "Stamford": { lat: 41.0534, lng: -73.5387, confidence: 0.93 },
  "Greenwich": { lat: 41.0262, lng: -73.6282, confidence: 0.93 },
  "New Haven": { lat: 41.3082, lng: -72.9279, confidence: 0.93 },

  // ─── Albany ───────────────────────────────────────────────────────────────
  "Albany": { lat: 42.6526, lng: -73.7562, confidence: 0.93 },

  // ─── Tampa ────────────────────────────────────────────────────────────────
  "Tampa": { lat: 27.9506, lng: -82.4572, confidence: 0.94 },
  "St. Petersburg": { lat: 27.7676, lng: -82.6403, confidence: 0.93 },
  "Clearwater": { lat: 27.9659, lng: -82.8001, confidence: 0.93 },
  "Sarasota": { lat: 27.3364, lng: -82.5307, confidence: 0.93 },

  // ─── Orlando ──────────────────────────────────────────────────────────────
  "Orlando": { lat: 28.5383, lng: -81.3792, confidence: 0.94 },
  "Lake Nona": { lat: 28.3772, lng: -81.2467, confidence: 0.93 },

  // ─── Jacksonville ─────────────────────────────────────────────────────────
  "Jacksonville": { lat: 30.3322, lng: -81.6557, confidence: 0.93 },

  // ─── New Orleans ──────────────────────────────────────────────────────────
  "New Orleans": { lat: 29.9511, lng: -90.0715, confidence: 0.94 },

  // ─── Memphis ──────────────────────────────────────────────────────────────
  "Memphis": { lat: 35.1495, lng: -90.0490, confidence: 0.94 },

  // ─── Louisville ───────────────────────────────────────────────────────────
  "Louisville": { lat: 38.2527, lng: -85.7585, confidence: 0.94 },

  // ─── Omaha ────────────────────────────────────────────────────────────────
  "Omaha": { lat: 41.2565, lng: -95.9345, confidence: 0.93 },

  // ─── Tulsa ────────────────────────────────────────────────────────────────
  "Tulsa": { lat: 36.1540, lng: -95.9928, confidence: 0.93 },

  // ─── Albuquerque ──────────────────────────────────────────────────────────
  "Albuquerque": { lat: 35.0844, lng: -106.6504, confidence: 0.93 },

  // ─── Tucson ───────────────────────────────────────────────────────────────
  "Tucson": { lat: 32.2217, lng: -110.9265, confidence: 0.93 },

  // ─── Spokane ──────────────────────────────────────────────────────────────
  "Spokane": { lat: 47.6588, lng: -117.4260, confidence: 0.93 },

  // ─── Boise ────────────────────────────────────────────────────────────────
  "Boise": { lat: 43.6150, lng: -116.2023, confidence: 0.93 },

  // ─── Anchorage ────────────────────────────────────────────────────────────
  "Anchorage": { lat: 61.2181, lng: -149.9003, confidence: 0.93 },

  // ─── Honolulu ─────────────────────────────────────────────────────────────
  "Honolulu": { lat: 21.3069, lng: -157.8583, confidence: 0.94 },

  // ─── Other notable US metros ──────────────────────────────────────────────
  "Oklahoma City": { lat: 35.4676, lng: -97.5164, confidence: 0.93 },
  "El Paso": { lat: 31.7619, lng: -106.4850, confidence: 0.92 },
  "Virginia Beach": { lat: 36.8529, lng: -75.9780, confidence: 0.93 },
  "Norfolk": { lat: 36.8508, lng: -76.2859, confidence: 0.93 },
  "Birmingham": { lat: 33.5186, lng: -86.8104, confidence: 0.93 },
  "Huntsville": { lat: 34.7304, lng: -86.5861, confidence: 0.93 },
  "Little Rock": { lat: 34.7465, lng: -92.2896, confidence: 0.93 },
  "Baton Rouge": { lat: 30.4515, lng: -91.1871, confidence: 0.93 },
  "Providence": { lat: 41.8240, lng: -71.4128, confidence: 0.93 },
  "Buffalo": { lat: 42.8864, lng: -78.8784, confidence: 0.93 },
  "Rochester": { lat: 43.1566, lng: -77.6088, confidence: 0.93 },
  "Syracuse": { lat: 43.0481, lng: -76.1474, confidence: 0.92 },
  "Newark": { lat: 40.7357, lng: -74.1724, confidence: 0.93 },
  "Princeton": { lat: 40.3573, lng: -74.6672, confidence: 0.93 },
  "Trenton": { lat: 40.2171, lng: -74.7429, confidence: 0.92 },

  // ─── US State fallbacks (low confidence — penalizes vague geocoding) ───────
  "Alabama": { lat: 32.8067, lng: -86.7911, confidence: 0.45 },
  "Alaska": { lat: 64.2008, lng: -153.4937, confidence: 0.45 },
  "Arizona": { lat: 34.0489, lng: -111.0937, confidence: 0.45 },
  "Arkansas": { lat: 34.7465, lng: -92.2896, confidence: 0.45 },
  "California": { lat: 36.7783, lng: -119.4179, confidence: 0.45 },
  "Colorado": { lat: 39.5501, lng: -105.7821, confidence: 0.45 },
  "Connecticut": { lat: 41.6032, lng: -73.0877, confidence: 0.50 },
  "Delaware": { lat: 38.9108, lng: -75.5277, confidence: 0.50 },
  "Florida": { lat: 27.6648, lng: -81.5158, confidence: 0.45 },
  "Georgia": { lat: 32.1656, lng: -82.9001, confidence: 0.45 },
  "Hawaii": { lat: 19.8968, lng: -155.5828, confidence: 0.45 },
  "Idaho": { lat: 44.0682, lng: -114.7420, confidence: 0.45 },
  "Illinois": { lat: 40.6331, lng: -89.3985, confidence: 0.45 },
  "Indiana": { lat: 40.2672, lng: -86.1349, confidence: 0.45 },
  "Iowa": { lat: 41.8780, lng: -93.0977, confidence: 0.45 },
  "Kansas": { lat: 39.0119, lng: -98.4842, confidence: 0.45 },
  "Kentucky": { lat: 37.8393, lng: -84.2700, confidence: 0.45 },
  "Louisiana": { lat: 31.2448, lng: -92.1450, confidence: 0.45 },
  "Maine": { lat: 45.2538, lng: -69.4455, confidence: 0.45 },
  "Maryland": { lat: 39.0458, lng: -76.6413, confidence: 0.50 },
  "Massachusetts": { lat: 42.4072, lng: -71.3824, confidence: 0.50 },
  "Michigan": { lat: 44.3148, lng: -85.6024, confidence: 0.45 },
  "Minnesota": { lat: 46.7296, lng: -94.6859, confidence: 0.45 },
  "Mississippi": { lat: 32.3547, lng: -89.3985, confidence: 0.45 },
  "Missouri": { lat: 37.9643, lng: -91.8318, confidence: 0.45 },
  "Montana": { lat: 46.8797, lng: -110.3626, confidence: 0.45 },
  "Nebraska": { lat: 41.4925, lng: -99.9018, confidence: 0.45 },
  "Nevada": { lat: 38.8026, lng: -116.4194, confidence: 0.45 },
  "New Hampshire": { lat: 43.1939, lng: -71.5724, confidence: 0.45 },
  "New Jersey": { lat: 40.0583, lng: -74.4057, confidence: 0.50 },
  "New Mexico": { lat: 34.5199, lng: -105.8701, confidence: 0.45 },
  "New York": { lat: 42.1657, lng: -74.9481, confidence: 0.45 },
  "New York (State)": { lat: 42.1657, lng: -74.9481, confidence: 0.45 },
  "North Carolina": { lat: 35.7596, lng: -79.0193, confidence: 0.45 },
  "North Dakota": { lat: 47.5515, lng: -101.0020, confidence: 0.45 },
  "Ohio": { lat: 40.4173, lng: -82.9071, confidence: 0.45 },
  "Oklahoma": { lat: 35.4676, lng: -97.5164, confidence: 0.45 },
  "Oregon": { lat: 43.8041, lng: -120.5542, confidence: 0.45 },
  "Pennsylvania": { lat: 41.2033, lng: -77.1945, confidence: 0.45 },
  "Rhode Island": { lat: 41.6809, lng: -71.5118, confidence: 0.50 },
  "South Carolina": { lat: 33.8361, lng: -81.1637, confidence: 0.45 },
  "South Dakota": { lat: 43.9695, lng: -99.9018, confidence: 0.45 },
  "Tennessee": { lat: 35.5175, lng: -86.5804, confidence: 0.45 },
  "Texas": { lat: 31.9686, lng: -99.9018, confidence: 0.45 },
  "Utah": { lat: 39.3210, lng: -111.0937, confidence: 0.45 },
  "Vermont": { lat: 44.5588, lng: -72.5778, confidence: 0.45 },
  "Virginia": { lat: 37.4316, lng: -78.6569, confidence: 0.45 },
  "Washington (State)": { lat: 47.7511, lng: -120.7401, confidence: 0.45 },
  "West Virginia": { lat: 38.5976, lng: -80.4549, confidence: 0.45 },
  "Wisconsin": { lat: 43.7844, lng: -88.7879, confidence: 0.45 },
  "Wyoming": { lat: 43.0760, lng: -107.2903, confidence: 0.45 },

  // ─── US Territories ───────────────────────────────────────────────────────
  "Puerto Rico": { lat: 18.2208, lng: -66.5901, confidence: 0.6 },
  "Guam": { lat: 13.4443, lng: 144.7937, confidence: 0.6 },

  // ─── International tech & business hubs ──────────────────────────────────
  "Shenzhen (China)": { lat: 22.5431, lng: 114.0579, confidence: 0.90 },
  "Shenzhen": { lat: 22.5431, lng: 114.0579, confidence: 0.85 },
  "Shanghai (China)": { lat: 31.2304, lng: 121.4737, confidence: 0.90 },
  "Shanghai": { lat: 31.2304, lng: 121.4737, confidence: 0.85 },
  "Beijing (China)": { lat: 39.9042, lng: 116.4074, confidence: 0.90 },
  "Beijing": { lat: 39.9042, lng: 116.4074, confidence: 0.85 },
  "Bangalore (India)": { lat: 12.9716, lng: 77.5946, confidence: 0.90 },
  "Bengaluru": { lat: 12.9716, lng: 77.5946, confidence: 0.90 },
  "Mumbai": { lat: 19.0760, lng: 72.8777, confidence: 0.85 },
  "Tel Aviv (Israel)": { lat: 32.0853, lng: 34.7818, confidence: 0.90 },
  "Tel Aviv": { lat: 32.0853, lng: 34.7818, confidence: 0.85 },
  "Stockholm (Sweden)": { lat: 59.3293, lng: 18.0686, confidence: 0.85 },
  "Stockholm": { lat: 59.3293, lng: 18.0686, confidence: 0.80 },
  "Amsterdam (Netherlands)": { lat: 52.3676, lng: 4.9041, confidence: 0.85 },
  "Amsterdam": { lat: 52.3676, lng: 4.9041, confidence: 0.80 },
  "Zurich (Switzerland)": { lat: 47.3769, lng: 8.5417, confidence: 0.85 },
  "Zurich": { lat: 47.3769, lng: 8.5417, confidence: 0.80 },
  "Dubai (United Arab Emirates)": { lat: 25.2048, lng: 55.2708, confidence: 0.85 },
  "Dubai": { lat: 25.2048, lng: 55.2708, confidence: 0.80 },
  "Singapore (Singapore)": { lat: 1.3521, lng: 103.8198, confidence: 0.90 },
  "Singapore": { lat: 1.3521, lng: 103.8198, confidence: 0.90 },
  "Seoul (South Korea)": { lat: 37.5665, lng: 126.9780, confidence: 0.90 },
  "Seoul": { lat: 37.5665, lng: 126.9780, confidence: 0.85 },
  "Taipei (Taiwan)": { lat: 25.0330, lng: 121.5654, confidence: 0.90 },
  "Taipei": { lat: 25.0330, lng: 121.5654, confidence: 0.85 },
  "Toronto (Canada)": { lat: 43.6532, lng: -79.3832, confidence: 0.85 },
  "Toronto": { lat: 43.6532, lng: -79.3832, confidence: 0.80 },
  "Vancouver (Canada)": { lat: 49.2827, lng: -123.1207, confidence: 0.85 },
  "Vancouver": { lat: 49.2827, lng: -123.1207, confidence: 0.80 },
  "São Paulo (Brazil)": { lat: -23.5505, lng: -46.6333, confidence: 0.85 },
  "Sao Paulo": { lat: -23.5505, lng: -46.6333, confidence: 0.80 },
  "London (England)": { lat: 51.5074, lng: -0.1278, confidence: 0.90 },
  "London": { lat: 51.5074, lng: -0.1278, confidence: 0.85 },
  "Paris (France)": { lat: 48.8566, lng: 2.3522, confidence: 0.90 },
  "Paris": { lat: 48.8566, lng: 2.3522, confidence: 0.85 },
  "Berlin (Germany)": { lat: 52.5200, lng: 13.4050, confidence: 0.90 },
  "Berlin": { lat: 52.5200, lng: 13.4050, confidence: 0.85 },
  "Tokyo (Japan)": { lat: 35.6762, lng: 139.6503, confidence: 0.90 },
  "Tokyo": { lat: 35.6762, lng: 139.6503, confidence: 0.85 },
  "Hong Kong": { lat: 22.3193, lng: 114.1694, confidence: 0.90 },
  "Geneva (Switzerland)": { lat: 46.2044, lng: 6.1432, confidence: 0.85 },
  "Davos (Switzerland)": { lat: 46.8027, lng: 9.8378, confidence: 0.90 },
  "Riyadh (Saudi Arabia)": { lat: 24.7136, lng: 46.6753, confidence: 0.85 },
  "Abu Dhabi (United Arab Emirates)": { lat: 24.4539, lng: 54.3773, confidence: 0.85 },
};

export function geoFacetToCoords(
  geoFacet: string | null
): { lat: number; lng: number; confidence: number } | null {
  if (!geoFacet) return null;

  // Exact match
  if (GEO_FACET_MAP[geoFacet]) return GEO_FACET_MAP[geoFacet];

  // Partial match (remove state qualifiers like "(State)", "(City)")
  const normalized = geoFacet.replace(/\s*\([^)]+\)/, "").trim();
  if (GEO_FACET_MAP[normalized]) return GEO_FACET_MAP[normalized];

  // No mapping → skip
  return null;
}
