import { z } from "zod";
import { HotspotSchema } from "./hotspot";
import { SummarySchema, CitationSchema } from "./summary";

export const HotspotListItemSchema = HotspotSchema.pick({
  id: true,
  lat: true,
  lng: true,
  name: true,
  region: true,
  severity: true,
  article_count: true,
  summary_failed: true,
  last_scored_at: true,
}).extend({
  category: z.string().optional(),
});

export const HotspotDetailSchema = HotspotSchema.extend({
  summary: SummarySchema.nullable(),
  articles: z.array(
    z.object({
      id: z.string().uuid(),
      url: z.string().url(),
      headline: z.string(),
      abstract: z.string().nullable(),
      source_name: z.string(),
      source_bias: z.enum(["center", "center-left", "center-right", "left", "right"]),
      published_at: z.string().datetime(),
    })
  ),
});

export const HotspotsResponseSchema = z.object({
  hotspots: z.array(HotspotListItemSchema),
  generated_at: z.string().datetime(),
});

const HistoryPointSchema = z.object({
  date: z.string(),
  count: z.number().int().nonnegative(),
});

export const HotspotDetailResponseSchema = z.object({
  hotspot: HotspotDetailSchema,
  citations: z.array(CitationSchema),
  generated_at: z.string().datetime(),
  history: z.array(HistoryPointSchema).optional(),
});

export type HotspotListItem = z.infer<typeof HotspotListItemSchema>;
export type HotspotDetail = z.infer<typeof HotspotDetailSchema>;
export type HotspotsResponse = z.infer<typeof HotspotsResponseSchema>;
export type HotspotDetailResponse = z.infer<typeof HotspotDetailResponseSchema>;
