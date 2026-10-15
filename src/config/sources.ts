export type SourceBias = "center" | "center-left" | "center-right" | "left" | "right";
export type SourceTier = 1 | 2;
export type SourceCategory =
  | "general"
  | "finance"
  | "tech"
  | "energy"
  | "manufacturing"
  | "defense"
  | "geopolitics"
  | "science";

export interface Source {
  domain: string[];
  name: string;
  bias: SourceBias;
  tier: SourceTier;
  category: SourceCategory;
}

/** Vivid colors for each news category, readable on dark (#0d0d0d) globe */
export const CATEGORY_COLORS: Record<SourceCategory, string> = {
  general:       "#94a3b8", // slate   — wire services, major papers
  finance:       "#06b6d4", // cyan    — markets, M&A, Wall St
  tech:          "#818cf8", // indigo  — startups, AI, chips
  energy:        "#f97316", // orange  — oil, gas, commodities
  manufacturing: "#a78bfa", // violet  — auto, steel, supply chain
  defense:       "#f43f5e", // rose    — military, security
  geopolitics:   "#facc15", // yellow  — diplomacy, conflict, policy
  science:       "#34d399", // emerald — research, climate, pharma
};

export const SOURCES: Source[] = [
  // ─── Tier 1: Global wire services & authoritative papers ──────────────────
  { domain: ["apnews.com"],                           name: "AP",                      bias: "center",       tier: 1, category: "general"       },
  { domain: ["reuters.com"],                          name: "Reuters",                 bias: "center",       tier: 1, category: "general"       },
  { domain: ["bloomberg.com"],                        name: "Bloomberg",               bias: "center",       tier: 1, category: "finance"       },
  { domain: ["afp.com"],                              name: "AFP",                     bias: "center",       tier: 1, category: "general"       },
  { domain: ["bbc.com", "bbc.co.uk"],                 name: "BBC",                     bias: "center",       tier: 1, category: "general"       },
  { domain: ["nytimes.com"],                          name: "NYT",                     bias: "center-left",  tier: 1, category: "general"       },
  { domain: ["wsj.com"],                              name: "WSJ",                     bias: "center-right", tier: 1, category: "finance"       },
  { domain: ["washingtonpost.com"],                   name: "WaPo",                    bias: "center-left",  tier: 1, category: "general"       },
  { domain: ["ft.com"],                               name: "Financial Times",         bias: "center",       tier: 1, category: "finance"       },
  { domain: ["economist.com"],                        name: "Economist",               bias: "center",       tier: 1, category: "finance"       },
  { domain: ["asia.nikkei.com", "nikkei.com"],        name: "Nikkei Asia",             bias: "center",       tier: 1, category: "finance"       },
  { domain: ["nature.com"],                           name: "Nature",                  bias: "center",       tier: 1, category: "science"       },
  { domain: ["science.org"],                          name: "Science",                 bias: "center",       tier: 1, category: "science"       },

  // ─── Tier 2: General & analysis ───────────────────────────────────────────
  { domain: ["theguardian.com"],                      name: "Guardian",                bias: "left",         tier: 2, category: "general"       },
  { domain: ["aljazeera.com"],                        name: "Al Jazeera",              bias: "center",       tier: 2, category: "general"       },
  { domain: ["politico.com"],                         name: "Politico",                bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["axios.com"],                            name: "Axios",                   bias: "center",       tier: 2, category: "general"       },
  { domain: ["theatlantic.com"],                      name: "The Atlantic",            bias: "center-left",  tier: 2, category: "general"       },
  { domain: ["propublica.org"],                       name: "ProPublica",              bias: "center-left",  tier: 2, category: "general"       },
  { domain: ["foxnews.com"],                          name: "Fox News",                bias: "right",        tier: 2, category: "general"       },
  { domain: ["nypost.com"],                           name: "NY Post",                 bias: "right",        tier: 2, category: "general"       },

  // ─── Tier 2: Finance & markets ────────────────────────────────────────────
  { domain: ["cnbc.com"],                             name: "CNBC",                    bias: "center",       tier: 2, category: "finance"       },
  { domain: ["marketwatch.com"],                      name: "MarketWatch",             bias: "center",       tier: 2, category: "finance"       },
  { domain: ["barrons.com"],                          name: "Barron's",                bias: "center-right", tier: 2, category: "finance"       },
  { domain: ["institutionalinvestor.com"],            name: "Institutional Investor",  bias: "center",       tier: 2, category: "finance"       },
  { domain: ["dealbook.nytimes.com"],                 name: "DealBook",                bias: "center-left",  tier: 2, category: "finance"       },

  // ─── Tier 2: Tech & startups ──────────────────────────────────────────────
  { domain: ["techcrunch.com"],                       name: "TechCrunch",              bias: "center",       tier: 2, category: "tech"          },
  { domain: ["arstechnica.com"],                      name: "Ars Technica",            bias: "center-left",  tier: 2, category: "tech"          },
  { domain: ["wired.com"],                            name: "Wired",                   bias: "center-left",  tier: 2, category: "tech"          },
  { domain: ["technologyreview.com"],                 name: "MIT Technology Review",   bias: "center",       tier: 2, category: "tech"          },
  { domain: ["theinformation.com"],                   name: "The Information",         bias: "center",       tier: 2, category: "tech"          },
  { domain: ["venturebeat.com"],                      name: "VentureBeat",             bias: "center",       tier: 2, category: "tech"          },
  { domain: ["ieee.org", "spectrum.ieee.org"],        name: "IEEE Spectrum",           bias: "center",       tier: 2, category: "tech"          },

  // ─── Tier 2: Energy & commodities ─────────────────────────────────────────
  { domain: ["oilprice.com"],                         name: "OilPrice",                bias: "center",       tier: 2, category: "energy"        },
  { domain: ["spglobal.com"],                         name: "S&P Global",              bias: "center",       tier: 2, category: "energy"        },
  { domain: ["rigzone.com"],                          name: "Rigzone",                 bias: "center",       tier: 2, category: "energy"        },
  { domain: ["energymonitor.ai"],                     name: "Energy Monitor",          bias: "center",       tier: 2, category: "energy"        },
  { domain: ["platts.com"],                           name: "Platts",                  bias: "center",       tier: 2, category: "energy"        },
  { domain: ["naturalgasintel.com"],                  name: "Natural Gas Intelligence",bias: "center",       tier: 2, category: "energy"        },
  { domain: ["offshore-technology.com"],              name: "Offshore Technology",     bias: "center",       tier: 2, category: "energy"        },

  // ─── Tier 2: Manufacturing & industry ─────────────────────────────────────
  { domain: ["autonews.com"],                         name: "Automotive News",         bias: "center",       tier: 2, category: "manufacturing" },
  { domain: ["industryweek.com"],                     name: "IndustryWeek",            bias: "center",       tier: 2, category: "manufacturing" },
  { domain: ["manufacturing.net"],                    name: "Manufacturing.net",       bias: "center",       tier: 2, category: "manufacturing" },
  { domain: ["supplychaindive.com"],                  name: "Supply Chain Dive",       bias: "center",       tier: 2, category: "manufacturing" },
  { domain: ["freightwaves.com"],                     name: "FreightWaves",            bias: "center",       tier: 2, category: "manufacturing" },
  { domain: ["steelorbis.com"],                       name: "SteelOrbis",              bias: "center",       tier: 2, category: "manufacturing" },
  { domain: ["miningweekly.com"],                     name: "Mining Weekly",           bias: "center",       tier: 2, category: "manufacturing" },

  // ─── Tier 2: Defense & security ───────────────────────────────────────────
  { domain: ["defensenews.com"],                      name: "Defense News",            bias: "center",       tier: 2, category: "defense"       },
  { domain: ["breakingdefense.com"],                  name: "Breaking Defense",        bias: "center",       tier: 2, category: "defense"       },
  { domain: ["janes.com"],                            name: "Jane's",                  bias: "center",       tier: 2, category: "defense"       },
  { domain: ["warontherocks.com"],                    name: "War on the Rocks",        bias: "center",       tier: 2, category: "defense"       },

  // ─── Tier 2: Foreign policy & geopolitics ─────────────────────────────────
  { domain: ["foreignaffairs.com"],                   name: "Foreign Affairs",         bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["foreignpolicy.com"],                    name: "Foreign Policy",          bias: "center-left",  tier: 2, category: "geopolitics"   },
  { domain: ["chathamhouse.org"],                     name: "Chatham House",           bias: "center",       tier: 2, category: "geopolitics"   },

  // ─── Tier 2: Asia-Pacific ─────────────────────────────────────────────────
  { domain: ["scmp.com"],                             name: "South China Morning Post",bias: "center",       tier: 2, category: "finance"       },
  { domain: ["caixinglobal.com", "caixin.com"],       name: "Caixin",                  bias: "center",       tier: 2, category: "finance"       },
  { domain: ["straitstimes.com"],                     name: "Straits Times",           bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["thehindu.com"],                         name: "The Hindu",               bias: "center-left",  tier: 2, category: "geopolitics"   },
  { domain: ["livemint.com"],                         name: "Mint",                    bias: "center",       tier: 2, category: "finance"       },
  { domain: ["bangkokpost.com"],                      name: "Bangkok Post",            bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["abc.net.au"],                           name: "ABC Australia",           bias: "center",       tier: 2, category: "general"       },
  { domain: ["channelnewsasia.com"],                  name: "CNA",                     bias: "center",       tier: 2, category: "geopolitics"   },

  // ─── Tier 2: Europe ───────────────────────────────────────────────────────
  { domain: ["dw.com"],                               name: "Deutsche Welle",          bias: "center",       tier: 2, category: "general"       },
  { domain: ["france24.com"],                         name: "France 24",               bias: "center",       tier: 2, category: "general"       },
  { domain: ["spiegel.de"],                           name: "Der Spiegel",             bias: "center-left",  tier: 2, category: "geopolitics"   },
  { domain: ["euronews.com"],                         name: "Euronews",                bias: "center",       tier: 2, category: "general"       },
  { domain: ["rferl.org"],                            name: "RFE/RL",                  bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["kyivindependent.com"],                  name: "Kyiv Independent",        bias: "center",       tier: 2, category: "defense"       },

  // ─── Tier 2: Middle East & Africa ─────────────────────────────────────────
  { domain: ["haaretz.com"],                          name: "Haaretz",                 bias: "center-left",  tier: 2, category: "geopolitics"   },
  { domain: ["timesofisrael.com"],                    name: "Times of Israel",         bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["arabnews.com"],                         name: "Arab News",               bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["middleeasteye.net"],                    name: "Middle East Eye",         bias: "center-left",  tier: 2, category: "geopolitics"   },
  { domain: ["dawn.com"],                             name: "Dawn",                    bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["premiumtimesng.com"],                   name: "Premium Times Nigeria",   bias: "center",       tier: 2, category: "general"       },
  { domain: ["dailymaverick.co.za"],                  name: "Daily Maverick",          bias: "center-left",  tier: 2, category: "general"       },

  // ─── Tier 2: Latin America ────────────────────────────────────────────────
  { domain: ["mercopress.com"],                       name: "MercoPress",              bias: "center",       tier: 2, category: "geopolitics"   },
  { domain: ["buenosairesherald.com"],                name: "Buenos Aires Herald",     bias: "center",       tier: 2, category: "finance"       },
];

/** Build a lookup map: normalized domain → source metadata */
const SOURCE_MAP = new Map<string, Omit<Source, "domain">>();
for (const source of SOURCES) {
  for (const domain of source.domain) {
    SOURCE_MAP.set(domain.toLowerCase(), {
      name: source.name,
      bias: source.bias,
      tier: source.tier,
      category: source.category,
    });
  }
}

/** Extract hostname from a URL and normalize it */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

/** Look up source metadata for a URL, returns null if not whitelisted */
export function getSource(url: string): Omit<Source, "domain"> | null {
  const domain = extractDomain(url);
  return SOURCE_MAP.get(domain) ?? null;
}

/** Look up source metadata by bare domain string, returns null if not whitelisted */
export function getSourceByDomain(domain: string): Omit<Source, "domain"> | null {
  return SOURCE_MAP.get(domain.toLowerCase().replace(/^www\./, "")) ?? null;
}

/** Check if a URL is on the whitelist */
export function isWhitelisted(url: string): boolean {
  return getSource(url) !== null;
}

/** All whitelisted domain strings (flat list) */
export const WHITELIST_DOMAINS: string[] = SOURCES.flatMap((s) => s.domain);

/** Tier weight for scoring */
export const TIER_WEIGHTS: Record<SourceTier, number> = {
  1: 1.0,
  2: 0.6,
};
