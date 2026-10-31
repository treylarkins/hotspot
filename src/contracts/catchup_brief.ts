import { z } from "zod";

export const StorylineUpdateSchema = z.object({
  storyline_id: z.string().uuid(),
  title: z.string().min(5).max(300),
  status_at_start: z.enum(["emerging","escalating","stable","fading","resolved"]),
  status_at_end:   z.enum(["emerging","escalating","stable","fading","resolved"]),
  summary: z.string().min(10).max(600),
});

export const CatchUpBriefSchema = z.object({
  id: z.string().uuid(),
  region_id: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(64),
  range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  range_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  what_happened:    z.string().min(20).max(2000),
  what_changed:     z.string().min(20).max(1000),
  where_it_stands:  z.string().min(20).max(800),
  storyline_updates: z.array(StorylineUpdateSchema).min(0).max(10),
  watch: z.array(z.string().min(10).max(400)).min(0).max(3),
  fact_ids_used: z.array(z.string().uuid()).min(0),
  generated_at: z.string().datetime(),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
}).refine(
  (d) => d.range_start <= d.range_end,
  { message: "range_start must be ≤ range_end", path: ["range_start"] }
);

export type StorylineUpdate = z.infer<typeof StorylineUpdateSchema>;
export type CatchUpBrief = z.infer<typeof CatchUpBriefSchema>;
