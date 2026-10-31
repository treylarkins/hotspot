import { z } from "zod";

export const ConnectionTypeSchema = z.enum([
  "trade", "debt_finance", "energy", "supply_chain", "security", "migration",
]);

export const ConnectionSchema = z.object({
  region_id: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(64),
  type: ConnectionTypeSchema,
  strength: z.number().min(0).max(1),
  why: z.string().min(5).max(300),
});

export const CausalChainSchema = z.object({
  cause: z.string().min(5).max(500),
  effect: z.string().min(5).max(500),
  downstream: z.string().max(500).optional(),
});

export const DevelopmentSchema = z.object({
  development: z.string().min(10).max(600),
  chain: CausalChainSchema,
});

export const BriefSourceSchema = z.object({
  article_id: z.string().uuid(),
  headline: z.string().min(1).max(500),
  url: z.string().url(),
  source_name: z.string().min(1),
  published_at: z.string().datetime(),
});

export const RegionBriefSchema = z.object({
  id: z.string().uuid(),
  region_id: z.string().regex(/^[a-z0-9_-]+$/).min(2).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  headline: z.string().min(5).max(300),
  matters_for: z.array(z.string().min(1).max(200)).min(1).max(10),
  whats_changing: z.array(DevelopmentSchema).min(0).max(6),
  connections: z.array(ConnectionSchema).min(0).max(10),
  watch: z.array(z.string().min(10).max(400)).min(0).max(3),
  sources: z.array(BriefSourceSchema).min(1).max(30),
  generated_at: z.string().datetime(),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
});

export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Development = z.infer<typeof DevelopmentSchema>;
export type BriefSource = z.infer<typeof BriefSourceSchema>;
export type RegionBrief = z.infer<typeof RegionBriefSchema>;
