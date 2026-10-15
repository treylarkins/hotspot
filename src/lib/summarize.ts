import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SummarySchema } from "../contracts/summary";
import type { Summary, Perspective } from "../contracts/summary";
import type { Article } from "../contracts/article";
import { randomUUID } from "crypto";

const PROMPT_VERSION = "v1";
const MODEL = "claude-sonnet-4-6";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a neutral news analyst. Your job is to summarize a cluster of news articles about a single geopolitical event or location.

Rules:
1. Every sentence in the neutral_summary MUST contain at least one inline citation in [n] format where n is the article index.
2. Do NOT use evaluative adjectives like: brutal, catastrophic, shocking, reckless, outrageous, alarming, dire, devastating.
3. Use only factual, descriptive language based on what sources report.
4. Perspectives MUST be attributed to named publications. Write "The Guardian reports..." or "WSJ argues...", never in narrator's voice.
5. Each perspective must cite at least one article using [n] format.
6. Return ONLY valid JSON matching the schema. No preamble, no explanation.`;

function buildUserPrompt(
  articles: Article[],
  hotspotName: string,
  failedSentences?: string[]
): string {
  const articleList = articles
    .map(
      (a, i) =>
        `[${i + 1}] ${a.source_name} (${a.source_bias}): "${a.headline}"${a.abstract ? ` — ${a.abstract}` : ""}`
    )
    .join("\n");

  const retryHint =
    failedSentences && failedSentences.length > 0
      ? `\n\nThe following sentences from your previous attempt were MISSING citations — fix them:\n${failedSentences.map((s) => `- "${s}"`).join("\n")}`
      : "";

  return `Generate a summary for the news hotspot: "${hotspotName}"

Articles (${articles.length} total):
${articleList}${retryHint}

Return JSON with this exact structure:
{
  "neutral_summary": "3-5 sentence summary where EVERY sentence has [n] citations.",
  "perspectives": [
    {
      "outlet_name": "Publication Name",
      "outlet_bias": "center|center-left|center-right|left|right",
      "framing": "How this outlet frames the story, cited with [n]. Must start with outlet name.",
      "citations": [1, 2]
    }
  ]
}`;
}

interface ClaudeOutput {
  neutral_summary: string;
  perspectives: Perspective[];
}

const ClaudeOutputSchema = z.object({
  neutral_summary: z.string().min(10),
  perspectives: z.array(
    z.object({
      outlet_name: z.string().min(1),
      outlet_bias: z.enum(["center", "center-left", "center-right", "left", "right"]),
      framing: z.string().min(10),
      citations: z.array(z.number().int().min(1)),
    })
  ),
});

/** Find sentences missing [n] citations */
function findUncitedSentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  return sentences.filter((s) => !s.match(/\[\d+\]/));
}

/** Parse Claude's JSON response */
function parseClaudeResponse(content: string): ClaudeOutput | null {
  try {
    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const result = ClaudeOutputSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

/** Call Claude to generate a summary, with one retry on citation failure */
export async function generateSummary(
  hotspotId: string,
  hotspotName: string,
  articles: Article[]
): Promise<Summary | null> {
  if (articles.length === 0) return null;

  // First attempt
  const firstResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(articles, hotspotName) }],
  });

  const firstContent = firstResponse.content[0];
  if (firstContent.type !== "text") return null;

  let output = parseClaudeResponse(firstContent.text);
  if (!output) return null;

  // Check for uncited sentences
  let uncitedSentences = findUncitedSentences(output.neutral_summary);

  if (uncitedSentences.length > 0) {
    // Retry with failure hint
    const retryResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPrompt(articles, hotspotName, uncitedSentences) },
      ],
    });

    const retryContent = retryResponse.content[0];
    if (retryContent.type === "text") {
      const retryOutput = parseClaudeResponse(retryContent.text);
      if (retryOutput) {
        output = retryOutput;
        uncitedSentences = findUncitedSentences(output.neutral_summary);
      }
    }
  }

  // Still has uncited sentences → mark as failed
  if (uncitedSentences.length > 0) {
    return null; // caller marks hotspot with summary_failed=true
  }

  // Build citations from articles
  const citations = articles.map((a, i) => ({
    index: i + 1,
    article_id: a.id,
    headline: a.headline,
    url: a.url,
    source_name: a.source_name,
    source_bias: a.source_bias,
    published_at: a.published_at,
  }));

  const summary: Summary = {
    id: randomUUID(),
    hotspot_id: hotspotId,
    neutral_summary: output.neutral_summary,
    perspectives: output.perspectives,
    citations,
    generated_at: new Date().toISOString(),
    model: MODEL,
    prompt_version: PROMPT_VERSION,
  };

  // Validate against full schema
  const validation = SummarySchema.safeParse(summary);
  if (!validation.success) {
    console.error("Summary schema validation failed:", validation.error.format());
    return null;
  }

  return validation.data;
}
