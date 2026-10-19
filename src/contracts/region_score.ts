import { z } from "zod";

export const ScoreComponentsSchema = z.object({
  volume_vs_baseline: z.number().min(0).max(2), // today_count / 30-day avg; >1 = above baseline
  severity: z.number().min(0).max(1),            // avg severity of hotspots in region
  economic_relevance: z.number().min(0).max(1),  // tier-weighted fraction from finance/energy/mfg
  velocity: z.number().min(0).max(2),            // score_today / score_3_days_ago; 1.0 = flat
});

export const RegionScoreSchema = z.object({
  id: z.string().uuid(),
  region_id: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.number().min(0).max(1),                // globe fill opacity
  score_delta: z.number().min(-1).max(1).nullable(), // null on first appearance
  components: ScoreComponentsSchema,
  article_count: z.number().int().nonnegative(),
  computed_at: z.string().datetime(),
});

export type ScoreComponents = z.infer<typeof ScoreComponentsSchema>;
export type RegionScore = z.infer<typeof RegionScoreSchema>;
