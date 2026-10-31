import { describe, it, expect } from "vitest";
import { findUncitedSentences } from "@/lib/ai/summarize";

describe("findUncitedSentences", () => {
  it("returns empty array when every sentence has a citation", () => {
    const text =
      "The conflict intensified near the border [1]. Diplomatic talks are ongoing [2]. Aid organizations reported shortages [3].";
    expect(findUncitedSentences(text)).toEqual([]);
  });

  it("flags a sentence with no citation", () => {
    const text =
      "The conflict intensified near the border [1]. Diplomatic talks are ongoing. Aid organizations reported shortages [3].";
    const result = findUncitedSentences(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("Diplomatic talks");
  });

  it("does not split on U.S. abbreviation (false sentence boundary)", () => {
    // Gemini wrote: "...cautioned that U.S. policy would result in changes [1]."
    // The period after "U.S." must NOT be treated as a sentence end.
    const text =
      "Zelensky cautioned that U.S. policy would result in changes [1]. Trump signed the order on Friday [2].";
    expect(findUncitedSentences(text)).toEqual([]);
  });

  it("does not split on O.J. abbreviation", () => {
    // Regression: LA hotspot articles about O.J. Simpson caused false splits
    const text =
      "Newly unsealed court records prompted a re-examination of the 1994 O.J. Simpson case [1]. Key players are being re-examined [2].";
    expect(findUncitedSentences(text)).toEqual([]);
  });

  it("does not split on Mr. abbreviation", () => {
    const text = "Mr. Smith announced the deal [1]. The agreement took effect immediately [2].";
    expect(findUncitedSentences(text)).toEqual([]);
  });

  it("correctly splits on a real sentence boundary after a lowercase word", () => {
    const text =
      "The agreement was signed on Monday [1]. No timeline was given for implementation.";
    const result = findUncitedSentences(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("No timeline");
  });

  it("handles multi-number citations like [1, 2]", () => {
    const text = "Multiple reports confirmed the incident [1, 2]. No casualties were reported [3].";
    expect(findUncitedSentences(text)).toEqual([]);
  });

  it("ignores very short fragments (< 10 chars) from abbreviation splits", () => {
    // Edge case: if an abbreviation split produces a tiny fragment, it should be ignored
    const text = "The U.S. government imposed sanctions [1]. Russia denied the allegations [2].";
    expect(findUncitedSentences(text)).toEqual([]);
  });
});
