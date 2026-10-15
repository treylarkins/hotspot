import { describe, it, expect } from "vitest";
import {
  volumeScore,
  velocityScore,
  tierWeight,
  intensityScore,
  severityScore,
  shouldShow,
  severityColor,
  dotRadius,
  groupByH3,
  SEVERITY_THRESHOLD,
} from "../../src/lib/score";
import type { Article } from "../../src/contracts/article";
import { randomUUID } from "crypto";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: randomUUID(),
    url: "https://reuters.com/test",
    headline: "Test article",
    abstract: null,
    source_domain: "reuters.com",
    source_name: "Reuters",
    source_bias: "center",
    source_tier: 1,
    lat: 26.5,
    lng: 56.5,
    location_confidence: 1.0,
    goldstein: 0,
    published_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    h3_cell: null,
    ...overrides,
  };
}

describe("volumeScore", () => {
  it("returns 0 for 0 articles", () => expect(volumeScore(0)).toBe(0));
  it("returns 1 for 100 articles", () => expect(volumeScore(100)).toBeCloseTo(1));
  it("returns 0.5 for 10 articles", () => expect(volumeScore(10)).toBeCloseTo(0.5));
  it("clamps at 1 for > 100 articles", () => expect(volumeScore(200)).toBe(1));
});

describe("velocityScore", () => {
  it("returns 0 for zero baseline and zero today", () => expect(velocityScore(0, 0)).toBe(0));
  it("returns 1 for zero baseline and >0 today", () => expect(velocityScore(5, 0)).toBe(1));
  it("returns 1 when today >= baseline", () => expect(velocityScore(10, 10)).toBe(1));
  it("returns 0.5 for half the baseline", () => expect(velocityScore(5, 10)).toBeCloseTo(0.5));
});

describe("tierWeight", () => {
  it("returns 1.0 for all tier-1 articles", () => {
    const articles = Array.from({ length: 5 }, () => makeArticle({ source_tier: 1 }));
    expect(tierWeight(articles)).toBeCloseTo(1.0);
  });
  it("returns 0.6 for all tier-2 articles", () => {
    const articles = Array.from({ length: 5 }, () => makeArticle({ source_tier: 2 }));
    expect(tierWeight(articles)).toBeCloseTo(0.6);
  });
});

describe("intensityScore", () => {
  it("returns high score for very negative goldstein (-9)", () => {
    const articles = Array.from({ length: 3 }, () => makeArticle({ goldstein: -9 }));
    const score = intensityScore(articles);
    expect(score).toBeGreaterThan(0.9);
  });
  it("returns low score for positive goldstein (+8)", () => {
    const articles = Array.from({ length: 3 }, () => makeArticle({ goldstein: 8 }));
    const score = intensityScore(articles);
    expect(score).toBeLessThan(0.15);
  });
  it("returns 0.5 for neutral (goldstein 0)", () => {
    const articles = Array.from({ length: 3 }, () => makeArticle({ goldstein: 0 }));
    expect(intensityScore(articles)).toBeCloseTo(0.5);
  });
});

describe("severityScore — Hormuz-like scenario", () => {
  it("produces severity > 0.8 for high-volume, high-conflict, tier-1 articles", () => {
    const articles = Array.from({ length: 15 }, () =>
      makeArticle({
        lat: 26.5,
        lng: 56.5,
        goldstein: -8,
        source_tier: 1,
        location_confidence: 1.0,
      })
    );
    const group = { h3_cell: "test", lat: 26.5, lng: 56.5, articles };
    const result = severityScore(group, 5); // baseline is 5, today is 15 → velocity high
    expect(result.severity).toBeGreaterThan(0.8);
  });
});

describe("severityScore — Kansas-like scenario", () => {
  it("shouldShow returns false for 1-article, low-velocity, low-conflict tier-2 event", () => {
    // 1 article, goldstein +5 (positive/peaceful), tier 2, low confidence geocode, high baseline
    const articles = [
      makeArticle({
        lat: 39.1,
        lng: -96.6,
        goldstein: 5,
        source_tier: 2,
        location_confidence: 0.5,
      }),
    ];
    const group = { h3_cell: "test2", lat: 39.1, lng: -96.6, articles };
    // High baseline (50 articles/week) vs 1 today → near-zero velocity
    const result = severityScore(group, 50);
    expect(shouldShow(result.severity)).toBe(false);
  });
});

describe("severityScore — DC noise suppression", () => {
  it("low-confidence geocoding produces noticeably lower severity than high-confidence same count", () => {
    const highConf = Array.from({ length: 15 }, () =>
      makeArticle({ goldstein: -5, source_tier: 1, location_confidence: 1.0 })
    );
    const lowConf = Array.from({ length: 15 }, () =>
      makeArticle({ goldstein: -5, source_tier: 1, location_confidence: 0.25 })
    );
    const g1 = { h3_cell: "hc", lat: 38.9, lng: -77.0, articles: highConf };
    const g2 = { h3_cell: "lc", lat: 38.9, lng: -77.0, articles: lowConf };
    const r1 = severityScore(g1, 5);
    const r2 = severityScore(g2, 5);
    expect(r1.severity).toBeGreaterThan(r2.severity + 0.1);
  });
});

describe("shouldShow", () => {
  it("returns true at exactly threshold", () => expect(shouldShow(SEVERITY_THRESHOLD)).toBe(true));
  it("returns false below threshold", () => expect(shouldShow(0.14)).toBe(false));
  it("returns true above threshold", () => expect(shouldShow(0.5)).toBe(true));
});

describe("severityColor", () => {
  it("returns light red for low severity", () => {
    const color = severityColor(0.15);
    expect(color.toLowerCase()).toBe("#f4b4b4");
  });
  it("returns dark red for high severity", () => {
    const color = severityColor(1.0);
    expect(color.toLowerCase()).toBe("#7a0000");
  });
  it("returns a valid hex color string", () => {
    const color = severityColor(0.5);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("dotRadius", () => {
  it("returns correct radius for 100 articles", () =>
    expect(dotRadius(100)).toBeCloseTo(Math.sqrt(100) * 0.3));
  it("returns 0 for 0 articles", () => expect(dotRadius(0)).toBe(0));
});
