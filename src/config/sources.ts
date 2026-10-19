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
  /** HQ city lat/lng — used as location fallback when article has no content-derived geocode (confidence < 0.5) */
  institutionLat?: number;
  institutionLng?: number;
}

// Common US institution coordinates (DRY constants)
const NYC  = { institutionLat: 40.7128, institutionLng: -74.0060 };
const SF   = { institutionLat: 37.7749, institutionLng: -122.4194 };
const DC   = { institutionLat: 38.9072, institutionLng: -77.0369 };
const BOS  = { institutionLat: 42.3601, institutionLng: -71.0589 };
const SEA  = { institutionLat: 47.6062, institutionLng: -122.3321 };
const LA   = { institutionLat: 34.0522, institutionLng: -118.2437 };
const CHI  = { institutionLat: 41.8781, institutionLng: -87.6298 };
const ATL  = { institutionLat: 33.7490, institutionLng: -84.3880 };
const AUS  = { institutionLat: 30.2672, institutionLng: -97.7431 };

export const SOURCES: Source[] = [
  // ─── Tier 1: Global wire services & authoritative papers ──────────────────
  { domain: ["apnews.com"],                           name: "AP",                      bias: "center",       tier: 1, category: "general",      ...NYC },
  { domain: ["reuters.com"],                          name: "Reuters",                 bias: "center",       tier: 1, category: "general",      ...NYC },
  { domain: ["bloomberg.com"],                        name: "Bloomberg",               bias: "center",       tier: 1, category: "finance",      ...NYC },
  { domain: ["afp.com"],                              name: "AFP",                     bias: "center",       tier: 1, category: "general"            },
  { domain: ["bbc.com", "bbc.co.uk"],                 name: "BBC",                     bias: "center",       tier: 1, category: "general"            },
  { domain: ["nytimes.com"],                          name: "NYT",                     bias: "center-left",  tier: 1, category: "general",      ...NYC },
  { domain: ["wsj.com"],                              name: "WSJ",                     bias: "center-right", tier: 1, category: "finance",      ...NYC },
  { domain: ["washingtonpost.com"],                   name: "WaPo",                    bias: "center-left",  tier: 1, category: "general",      ...DC  },
  { domain: ["ft.com"],                               name: "Financial Times",         bias: "center",       tier: 1, category: "finance"            },
  { domain: ["economist.com"],                        name: "Economist",               bias: "center",       tier: 1, category: "finance"            },
  { domain: ["asia.nikkei.com", "nikkei.com"],        name: "Nikkei Asia",             bias: "center",       tier: 1, category: "finance"            },
  { domain: ["nature.com"],                           name: "Nature",                  bias: "center",       tier: 1, category: "science"            },
  { domain: ["science.org"],                          name: "Science",                 bias: "center",       tier: 1, category: "science",      ...DC  },

  // ─── Tier 2: General & analysis ───────────────────────────────────────────
  { domain: ["theguardian.com"],                      name: "Guardian",                bias: "left",         tier: 2, category: "general"            },
  { domain: ["aljazeera.com"],                        name: "Al Jazeera",              bias: "center",       tier: 2, category: "general"            },
  { domain: ["politico.com"],                         name: "Politico",                bias: "center",       tier: 2, category: "geopolitics",   ...DC  },
  { domain: ["axios.com"],                            name: "Axios",                   bias: "center",       tier: 2, category: "general",      ...DC  },
  { domain: ["theatlantic.com"],                      name: "The Atlantic",            bias: "center-left",  tier: 2, category: "general",      ...DC  },
  { domain: ["propublica.org"],                       name: "ProPublica",              bias: "center-left",  tier: 2, category: "general",      ...NYC },
  { domain: ["foxnews.com"],                          name: "Fox News",                bias: "right",        tier: 2, category: "general",      ...NYC },
  { domain: ["nypost.com"],                           name: "NY Post",                 bias: "right",        tier: 2, category: "general",      ...NYC },

  // ─── Tier 2: Finance & markets ────────────────────────────────────────────
  { domain: ["cnbc.com"],                             name: "CNBC",                    bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["marketwatch.com"],                      name: "MarketWatch",             bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["barrons.com"],                          name: "Barron's",                bias: "center-right", tier: 2, category: "finance",      ...NYC },
  { domain: ["institutionalinvestor.com"],            name: "Institutional Investor",  bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["dealbook.nytimes.com"],                 name: "DealBook",                bias: "center-left",  tier: 2, category: "finance",      ...NYC },
  { domain: ["fortune.com"],                          name: "Fortune",                 bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["seekingalpha.com"],                     name: "Seeking Alpha",           bias: "center-right", tier: 2, category: "finance",      ...NYC },
  { domain: ["investors.com"],                        name: "Investor's Business Daily",bias: "center-right",tier: 2, category: "finance",      ...LA  },
  { domain: ["coindesk.com"],                         name: "CoinDesk",                bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["theblock.co"],                          name: "The Block",               bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["morningbrew.com"],                      name: "Morning Brew",            bias: "center",       tier: 2, category: "finance",      ...NYC },
  { domain: ["businessinsider.com"],                  name: "Business Insider",        bias: "center-left",  tier: 2, category: "finance",      ...NYC },

  // ─── Tier 2: Tech & startups ──────────────────────────────────────────────
  { domain: ["techcrunch.com"],                       name: "TechCrunch",              bias: "center",       tier: 2, category: "tech",         ...SF  },
  { domain: ["arstechnica.com"],                      name: "Ars Technica",            bias: "center-left",  tier: 2, category: "tech",         ...CHI },
  { domain: ["wired.com"],                            name: "Wired",                   bias: "center-left",  tier: 2, category: "tech",         ...SF  },
  { domain: ["technologyreview.com"],                 name: "MIT Technology Review",   bias: "center",       tier: 2, category: "tech",         ...BOS },
  { domain: ["theinformation.com"],                   name: "The Information",         bias: "center",       tier: 2, category: "tech",         ...SF  },
  { domain: ["venturebeat.com"],                      name: "VentureBeat",             bias: "center",       tier: 2, category: "tech",         ...SF  },
  { domain: ["ieee.org", "spectrum.ieee.org"],        name: "IEEE Spectrum",           bias: "center",       tier: 2, category: "tech",         ...NYC },
  { domain: ["fastcompany.com"],                      name: "Fast Company",            bias: "center-left",  tier: 2, category: "tech",         ...NYC },
  { domain: ["theverge.com"],                         name: "The Verge",               bias: "center-left",  tier: 2, category: "tech",         ...NYC },
  { domain: ["engadget.com"],                         name: "Engadget",                bias: "center-left",  tier: 2, category: "tech",         ...NYC },
  { domain: ["zdnet.com"],                            name: "ZDNet",                   bias: "center",       tier: 2, category: "tech",         ...SF  },
  { domain: ["thenextweb.com"],                       name: "The Next Web",            bias: "center-left",  tier: 2, category: "tech"              },
  { domain: ["techinasia.com"],                       name: "Tech in Asia",            bias: "center",       tier: 2, category: "tech"              },
  { domain: ["electrek.co"],                          name: "Electrek",                bias: "center-left",  tier: 2, category: "tech",         ...NYC },
  { domain: ["themarkup.org"],                        name: "The Markup",              bias: "center-left",  tier: 2, category: "tech",         ...NYC },
  { domain: ["rest-of-world.org"],                    name: "Rest of World",           bias: "center-left",  tier: 2, category: "tech",         ...NYC },
  { domain: ["stratechery.com"],                      name: "Stratechery",             bias: "center",       tier: 2, category: "tech",         ...SEA },
  { domain: ["mitsloanreview.com"],                   name: "MIT Sloan Review",        bias: "center",       tier: 2, category: "tech",         ...BOS },
  { domain: ["newscientist.com"],                     name: "New Scientist",           bias: "center",       tier: 2, category: "science"           },
  { domain: ["hbr.org"],                              name: "Harvard Business Review", bias: "center",       tier: 2, category: "general",      ...BOS },
  { domain: ["inc.com"],                              name: "Inc.",                    bias: "center",       tier: 2, category: "general",      ...NYC },
  { domain: ["semafor.com"],                          name: "Semafor",                 bias: "center",       tier: 2, category: "general",      ...DC  },

  // ─── Tier 2: Energy & commodities ─────────────────────────────────────────
  { domain: ["oilprice.com"],                         name: "OilPrice",                bias: "center",       tier: 2, category: "energy"            },
  { domain: ["spglobal.com"],                         name: "S&P Global",              bias: "center",       tier: 2, category: "energy",       ...NYC },
  { domain: ["rigzone.com"],                          name: "Rigzone",                 bias: "center",       tier: 2, category: "energy",       ...AUS },
  { domain: ["energymonitor.ai"],                     name: "Energy Monitor",          bias: "center",       tier: 2, category: "energy"            },
  { domain: ["platts.com"],                           name: "Platts",                  bias: "center",       tier: 2, category: "energy",       ...NYC },
  { domain: ["naturalgasintel.com"],                  name: "Natural Gas Intelligence",bias: "center",       tier: 2, category: "energy",       ...DC  },
  { domain: ["offshore-technology.com"],              name: "Offshore Technology",     bias: "center",       tier: 2, category: "energy"            },

  // ─── Tier 2: Manufacturing & industry ─────────────────────────────────────
  { domain: ["autonews.com"],                         name: "Automotive News",         bias: "center",       tier: 2, category: "manufacturing",  ...{ institutionLat: 42.3314, institutionLng: -83.0458 } },
  { domain: ["industryweek.com"],                     name: "IndustryWeek",            bias: "center",       tier: 2, category: "manufacturing",  ...CHI },
  { domain: ["manufacturing.net"],                    name: "Manufacturing.net",       bias: "center",       tier: 2, category: "manufacturing"        },
  { domain: ["supplychaindive.com"],                  name: "Supply Chain Dive",       bias: "center",       tier: 2, category: "manufacturing",  ...DC  },
  { domain: ["freightwaves.com"],                     name: "FreightWaves",            bias: "center",       tier: 2, category: "manufacturing",  ...{ institutionLat: 35.1495, institutionLng: -90.0490 } },
  { domain: ["steelorbis.com"],                       name: "SteelOrbis",              bias: "center",       tier: 2, category: "manufacturing"        },
  { domain: ["miningweekly.com"],                     name: "Mining Weekly",           bias: "center",       tier: 2, category: "manufacturing"        },

  // ─── Tier 2: Defense & security ───────────────────────────────────────────
  { domain: ["defensenews.com"],                      name: "Defense News",            bias: "center",       tier: 2, category: "defense",       ...DC  },
  { domain: ["breakingdefense.com"],                  name: "Breaking Defense",        bias: "center",       tier: 2, category: "defense",       ...DC  },
  { domain: ["janes.com"],                            name: "Jane's",                  bias: "center",       tier: 2, category: "defense"            },
  { domain: ["warontherocks.com"],                    name: "War on the Rocks",        bias: "center",       tier: 2, category: "defense",       ...DC  },
  { domain: ["defenseone.com"],                       name: "Defense One",             bias: "center",       tier: 2, category: "defense",       ...DC  },

  // ─── Tier 2: Foreign policy & geopolitics ─────────────────────────────────
  { domain: ["foreignaffairs.com"],                   name: "Foreign Affairs",         bias: "center",       tier: 2, category: "geopolitics",   ...NYC },
  { domain: ["foreignpolicy.com"],                    name: "Foreign Policy",          bias: "center-left",  tier: 2, category: "geopolitics",   ...DC  },
  { domain: ["chathamhouse.org"],                     name: "Chatham House",           bias: "center",       tier: 2, category: "geopolitics"        },

  // ─── Tier 2: Asia-Pacific ─────────────────────────────────────────────────
  { domain: ["scmp.com"],                             name: "South China Morning Post",bias: "center",       tier: 2, category: "finance"            },
  { domain: ["caixinglobal.com", "caixin.com"],       name: "Caixin",                  bias: "center",       tier: 2, category: "finance"            },
  { domain: ["straitstimes.com"],                     name: "Straits Times",           bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["thehindu.com"],                         name: "The Hindu",               bias: "center-left",  tier: 2, category: "geopolitics"        },
  { domain: ["livemint.com"],                         name: "Mint",                    bias: "center",       tier: 2, category: "finance"            },
  { domain: ["bangkokpost.com"],                      name: "Bangkok Post",            bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["abc.net.au"],                           name: "ABC Australia",           bias: "center",       tier: 2, category: "general"            },
  { domain: ["channelnewsasia.com"],                  name: "CNA",                     bias: "center",       tier: 2, category: "geopolitics"        },

  // ─── Tier 2: Europe ───────────────────────────────────────────────────────
  { domain: ["dw.com"],                               name: "Deutsche Welle",          bias: "center",       tier: 2, category: "general"            },
  { domain: ["france24.com"],                         name: "France 24",               bias: "center",       tier: 2, category: "general"            },
  { domain: ["spiegel.de"],                           name: "Der Spiegel",             bias: "center-left",  tier: 2, category: "geopolitics"        },
  { domain: ["euronews.com"],                         name: "Euronews",                bias: "center",       tier: 2, category: "general"            },
  { domain: ["rferl.org"],                            name: "RFE/RL",                  bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["kyivindependent.com"],                  name: "Kyiv Independent",        bias: "center",       tier: 2, category: "defense"            },

  // ─── Tier 2: Middle East & Africa ─────────────────────────────────────────
  { domain: ["haaretz.com"],                          name: "Haaretz",                 bias: "center-left",  tier: 2, category: "geopolitics"        },
  { domain: ["timesofisrael.com"],                    name: "Times of Israel",         bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["arabnews.com"],                         name: "Arab News",               bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["middleeasteye.net"],                    name: "Middle East Eye",         bias: "center-left",  tier: 2, category: "geopolitics"        },
  { domain: ["dawn.com"],                             name: "Dawn",                    bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["premiumtimesng.com"],                   name: "Premium Times Nigeria",   bias: "center",       tier: 2, category: "general"            },
  { domain: ["dailymaverick.co.za"],                  name: "Daily Maverick",          bias: "center-left",  tier: 2, category: "general"            },

  // ─── Tier 2: Latin America ────────────────────────────────────────────────
  { domain: ["mercopress.com"],                       name: "MercoPress",              bias: "center",       tier: 2, category: "geopolitics"        },
  { domain: ["buenosairesherald.com"],                name: "Buenos Aires Herald",     bias: "center",       tier: 2, category: "finance"            },
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
      institutionLat: source.institutionLat,
      institutionLng: source.institutionLng,
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
