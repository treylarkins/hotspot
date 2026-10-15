import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ArticleSchema } from "../../src/contracts/article";
import { HotspotSchema } from "../../src/contracts/hotspot";
import { SummarySchema, PerspectiveSchema } from "../../src/contracts/summary";
import {
  HotspotListItemSchema,
  HotspotDetailSchema,
  HotspotsResponseSchema,
} from "../../src/contracts/api";
import mockData from "../../fixtures/hotspots.mock.json";

describe("HotspotsResponse fixture validation", () => {
  it("validates the full fixture against HotspotsResponseSchema", () => {
    // Build a list-response from the fixture
    const listResponse = {
      hotspots: mockData.hotspots.map((h) => ({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        name: h.name,
        region: h.region,
        severity: h.severity,
        article_count: h.article_count,
        summary_failed: h.summary_failed,
        last_scored_at: h.last_scored_at,
      })),
      generated_at: mockData.generated_at,
    };
    const result = HotspotsResponseSchema.safeParse(listResponse);
    if (!result.success) {
      console.error(result.error.format());
    }
    expect(result.success).toBe(true);
  });

  it("has exactly 25 hotspots", () => {
    expect(mockData.hotspots).toHaveLength(25);
  });

  it("validates each hotspot against HotspotSchema", () => {
    for (const h of mockData.hotspots) {
      const result = HotspotSchema.safeParse(h);
      if (!result.success) {
        console.error(`Hotspot ${h.name} failed:`, result.error.format());
      }
      expect(result.success).toBe(true);
    }
  });

  it("Hormuz hotspot has severity > 0.8", () => {
    const hormuz = mockData.hotspots.find((h) => h.name === "Strait of Hormuz");
    expect(hormuz).toBeDefined();
    expect(hormuz!.severity).toBeGreaterThan(0.8);
  });

  it("Eastern Ukraine hotspot has severity > 0.8", () => {
    const ukraine = mockData.hotspots.find((h) => h.name === "Eastern Ukraine");
    expect(ukraine).toBeDefined();
    expect(ukraine!.severity).toBeGreaterThan(0.8);
  });

  it("Taiwan Strait hotspot has severity > 0.8", () => {
    const taiwan = mockData.hotspots.find((h) => h.name === "Taiwan Strait");
    expect(taiwan).toBeDefined();
    expect(taiwan!.severity).toBeGreaterThan(0.8);
  });

  it("Kansas hotspot is below threshold (severity < 0.15)", () => {
    const kansas = mockData.hotspots.find((h) => h.name.includes("Kansas"));
    expect(kansas).toBeDefined();
    expect(kansas!.severity).toBeLessThan(0.15);
  });

  it("validates summaries against SummarySchema where present", () => {
    for (const h of mockData.hotspots) {
      if (h.summary) {
        const result = SummarySchema.safeParse(h.summary);
        if (!result.success) {
          console.error(`Summary for ${h.name} failed:`, result.error.format());
        }
        expect(result.success).toBe(true);
      }
    }
  });

  it("summaries with perspectives have named outlets and bias", () => {
    for (const h of mockData.hotspots) {
      if (h.summary && h.summary.perspectives.length > 0) {
        for (const p of h.summary.perspectives) {
          expect(p.outlet_name).toBeTruthy();
          expect(p.outlet_bias).toBeTruthy();
        }
      }
    }
  });
});

describe("Article fixture articles are from whitelisted domains", () => {
  const WHITELIST = [
    "apnews.com",
    "reuters.com",
    "bbc.com",
    "bbc.co.uk",
    "nytimes.com",
    "wsj.com",
    "washingtonpost.com",
    "ft.com",
    "economist.com",
    "theguardian.com",
    "foxnews.com",
    "aljazeera.com",
    "politico.com",
  ];

  it("all article URLs are from whitelisted domains", () => {
    for (const h of mockData.hotspots) {
      for (const a of h.articles) {
        const hostname = new URL(a.url).hostname.replace(/^www\./, "");
        expect(WHITELIST).toContain(hostname);
      }
    }
  });
});

