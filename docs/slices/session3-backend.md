# Session 3: Backend Slices

## What changed
- `src/lib/score.ts` — pure scoring functions: H3 binning, severity formula, color/radius helpers
- `src/lib/gdelt.ts` — GDELT GKG CSV parser with V2Locations, DC noise suppression
- `src/lib/nyt.ts` — NYT Top Stories API with geo_facet → lat/lng mapping
- `src/lib/ingest.ts` — orchestrate GDELT + NYT, dedupe by canonical URL, assign H3 cells
- `src/lib/summarize.ts` — Claude API with citation validation + retry
- `src/lib/db.ts` — Supabase typed queries
- `app/api/hotspots/route.ts` — GET /api/hotspots (mock + live)
- `app/api/hotspots/[id]/route.ts` — GET /api/hotspots/[id] (mock + live)
- `app/api/cron/ingest/route.ts` — CRON_SECRET secured ingest trigger
- `app/api/cron/score/route.ts` — CRON_SECRET secured score trigger
- `app/api/cron/summarize/route.ts` — CRON_SECRET secured summarize trigger

## Key decisions
- GDELT Goldstein: uses Tone field (tone/10) as approximate Goldstein proxy
- Location confidence multiplier: severity *= (0.5 + 0.5 * avgConfidence) to suppress low-confidence geocodes
- Claude summaries: validate each sentence for [n] citation, retry once on failure

## What's left
- Set actual env vars in .env.local for live testing
- Create Supabase tables (schema in CLAUDE.md)
- Run live ingest to verify pipeline

## Known issues
- GDELT GKG files are .zip compressed; the current fetch assumes uncompressed CSV
  → Need to add decompression for production use
- NYT geo_facet coverage is ~50% of articles; Washington DC gets suppressed via low confidence
