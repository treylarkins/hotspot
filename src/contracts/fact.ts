import { z } from "zod";

export const FactSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  region_id: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(64),
  claim: z.string().min(10).max(1000), // one factual sentence, no evaluative adjectives
  source_article_id: z.string().uuid(),
  storyline_id: z.string().uuid().nullable(),
  extracted_at: z.string().datetime(),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
});

export type Fact = z.infer<typeof FactSchema>;
