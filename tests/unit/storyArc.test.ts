import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import StoryArcPanel, { type HistoryPoint } from "../../src/components/StoryArcPanel";

function makeHistory(days = 7): HistoryPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-10-${String(i + 8).padStart(2, "0")}`,
    count: (i + 1) * 5,
  }));
}

describe("StoryArcPanel", () => {
  it("renders null when history is empty", () => {
    const { container } = render(React.createElement(StoryArcPanel, { history: [] }));
    expect(container.firstChild).toBeNull();
  });

  it("renders the sparkline SVG when history has 7 points", () => {
    render(React.createElement(StoryArcPanel, { history: makeHistory(7) }));
    const svg = screen.getByRole("img", { name: /trend/i });
    expect(svg).toBeTruthy();
  });

  it("renders a polyline for multi-point data", () => {
    const { container } = render(React.createElement(StoryArcPanel, { history: makeHistory(7) }));
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute("points")).toBeTruthy();
  });

  it("renders a single point without a polyline when history has 1 entry", () => {
    const history: HistoryPoint[] = [{ date: "2026-10-14", count: 12 }];
    const { container } = render(React.createElement(StoryArcPanel, { history }));
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeNull();
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(1);
  });

  it("shows date labels for first and last entries", () => {
    const history = makeHistory(7);
    render(React.createElement(StoryArcPanel, { history }));
    expect(screen.getByText("10-08")).toBeTruthy();
    expect(screen.getByText("10-14")).toBeTruthy();
  });

  it("renders null for undefined history", () => {
    // Simulates a fetch error leaving history undefined
    const { container } = render(
      React.createElement(StoryArcPanel, { history: [] })
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows tooltip titles with date and count", () => {
    const history = makeHistory(3);
    const { container } = render(React.createElement(StoryArcPanel, { history }));
    const titles = Array.from(container.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles[0]).toContain("2026-10-08");
    expect(titles[0]).toContain("5");
  });
});
