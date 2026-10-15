import { z } from "zod";

export const CitationSchema = z.object({
  index: z.number().int().min(1),
  article_id: z.string().uuid(),
  headline: z.string(),
  url: z.string().url(),
  source_name: z.string(),
  source_bias: z.enum(["center", "center-left", "center-right", "left", "right"]),
  published_at: z.string().datetime(),
});

export const PerspectiveSchema = z.object({
  outlet_name: z.string().min(1),
  outlet_bias: z.enum(["center", "center-left", "center-right", "left", "right"]),
  framing: z.string().min(1).max(1000),
  citations: z.array(z.number().int().min(1)),
});

export const SummarySchema = z.object({
  id: z.string().uuid(),
  hotspot_id: z.string().uuid(),
  neutral_summary: z.string().min(1),
  perspectives: z.array(PerspectiveSchema).min(0).max(4),
  citations: z.array(CitationSchema),
  generated_at: z.string().datetime(),
  model: z.string(),
  prompt_version: z.string(),
});

export type Citation = z.infer<typeof CitationSchema>;
export type Perspective = z.infer<typeof PerspectiveSchema>;
export type Summary = z.infer<typeof SummarySchema>;
