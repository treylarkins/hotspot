import { z } from "zod";

export const ResourceSchema = z.object({
  resource: z.string().min(1).max(200),
  approx_global_share: z.number().min(0).max(1),
  unit: z.string().optional(),
});

export const RegionProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(64),
  name: z.string().min(1).max(200),
  short_name: z.string().min(1).max(60),
  geometry_ref: z.string().min(1), // e.g. "data/regions/taiwan.geojson"
  centroid_lat: z.number().min(-90).max(90),
  centroid_lng: z.number().min(-180).max(180),
  key_supplies: z.array(ResourceSchema).min(1).max(20),
  key_industries: z.array(z.string().min(1).max(200)).max(20),
  major_partners: z.array(z.string().min(1).max(200)).max(30), // region IDs
  description: z.string().max(2000).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Resource = z.infer<typeof ResourceSchema>;
export type RegionProfile = z.infer<typeof RegionProfileSchema>;
