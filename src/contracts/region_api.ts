import { z } from "zod";
import { RegionProfileSchema } from "./region";
import { RegionScoreSchema } from "./region_score";
import { RegionBriefSchema } from "./region_brief";
import { CatchUpBriefSchema } from "./catchup_brief";
import { StorylineSchema } from "./storyline";

// GET /api/regions — globe render data
export const RegionListItemSchema = RegionProfileSchema.pick({
  id: true, name: true, short_name: true, centroid_lat: true, centroid_lng: true,
}).extend({
  score: z.number().min(0).max(1),
  score_delta: z.number().min(-1).max(1).nullable(),
  date: z.string(),
});

export const RegionsResponseSchema = z.object({
  regions: z.array(RegionListItemSchema),
  generated_at: z.string().datetime(),
});

// GET /api/regions/[id]
export const RegionDetailResponseSchema = z.object({
  region: RegionProfileSchema,
  score: RegionScoreSchema.nullable(),
  brief: RegionBriefSchema.nullable(),
  storylines: z.array(StorylineSchema.pick({
    id: true, title: true, status: true, first_seen: true, last_updated: true, summary: true,
  })),
  generated_at: z.string().datetime(),
});

// POST /api/regions/[id]/catchup
export const CatchUpRequestSchema = z.object({
  range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  range_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const CatchUpResponseSchema = z.object({
  brief: CatchUpBriefSchema,
  generated_at: z.string().datetime(),
});

export type RegionListItem = z.infer<typeof RegionListItemSchema>;
export type RegionsResponse = z.infer<typeof RegionsResponseSchema>;
export type RegionDetailResponse = z.infer<typeof RegionDetailResponseSchema>;
export type CatchUpRequest = z.infer<typeof CatchUpRequestSchema>;
export type CatchUpResponse = z.infer<typeof CatchUpResponseSchema>;
