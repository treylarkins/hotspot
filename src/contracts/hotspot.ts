import { z } from "zod";

export const HotspotSchema = z.object({
  id: z.string().uuid(),
  h3_cell: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().min(1),
  region: z.string(),
  severity: z.number().min(0).max(1),
  article_count: z.number().int().min(0),
  article_hash: z.string(),
  volume_score: z.number().min(0).max(1),
  velocity_score: z.number().min(0).max(1),
  tier_weight: z.number().min(0).max(1),
  intensity_score: z.number().min(0).max(1),
  avg_goldstein: z.number().min(-10).max(10).nullable(),
  summary_failed: z.boolean().default(false),
  last_scored_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Hotspot = z.infer<typeof HotspotSchema>;
