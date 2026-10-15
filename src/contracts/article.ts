import { z } from "zod";

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  headline: z.string().min(1).max(500),
  abstract: z.string().max(2000).nullable(),
  source_domain: z.string().min(1),
  source_name: z.string().min(1),
  source_bias: z.enum(["center", "center-left", "center-right", "left", "right"]),
  source_tier: z.number().int().min(1).max(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_confidence: z.number().min(0).max(1),
  goldstein: z.number().min(-10).max(10).nullable(),
  published_at: z.string().datetime(),
  ingested_at: z.string().datetime(),
  h3_cell: z.string().nullable(),
});

export type Article = z.infer<typeof ArticleSchema>;
