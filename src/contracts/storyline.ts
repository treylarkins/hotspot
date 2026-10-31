import { z } from "zod";

export const StorylineStatusSchema = z.enum([
  "emerging", "escalating", "stable", "fading", "resolved",
]);

export const StorylineSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(5).max(300),
  region_ids: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1).max(20),
  status: StorylineStatusSchema,
  first_seen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().max(500).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type StorylineStatus = z.infer<typeof StorylineStatusSchema>;
export type Storyline = z.infer<typeof StorylineSchema>;
