# Hotspot Project Memory

## What this is
News website: black-and-white interactive 3D globe. Hotspots sized by news volume, colored light→dark red by severity. Click a hotspot → neutral summary, perspectives (left/center/right), and links to articles from whitelisted reputable sources.

## Commands
- `npm run dev` — start dev server
- `npm test` — run Vitest unit tests (34 tests)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run e2e` — Playwright E2E tests

## Project structure
- `src/contracts/` — frozen TypeScript types + Zod schemas (article, hotspot, summary, api)
- `src/config/sources.ts` — source whitelist with bias/tier
- `src/lib/score.ts` — pure scoring functions (unit-tested)
- `src/lib/gdelt.ts` — GDELT GKG CSV parser
- `src/lib/nyt.ts` — NYT Top Stories API
- `src/lib/ingest.ts` — orchestrate GDELT + NYT → Supabase
- `src/lib/summarize.ts` — Claude API summaries with citation validation
- `src/lib/db.ts` — Supabase typed queries
- `src/components/` — Globe, HotspotPanel, SummaryView, PerspectivesView, ArticleList
- `app/` — Next.js App Router pages + API routes
- `fixtures/hotspots.mock.json` — 25 realistic hotspots for frontend dev
- `tests/unit/` — Vitest unit tests

## Hard rules (never break)
- Never scrape or store full article text — headline + abstract + URL only
- Every sentence in neutral_summary must have at least one [n] citation
- No evaluative adjectives in summaries (brutal, catastrophic, shocking, reckless)
- Perspectives must be attributed to named outlets, never written in narrator's voice
- Contracts in src/contracts/ are frozen — stop and ask before changing
- Never commit .env.local

## Architecture decisions
- Globe: react-globe.gl with Three.js dark texture
- Clustering: H3 resolution 3, hidden below severity 0.15
- AI: claude-sonnet-4-6 for summaries, one retry on citation validation failure
- Cache: Postgres article_hash diff (>20% new articles triggers regeneration)
- Location confidence multiplier: DC-type low-confidence geocoding → lower severity

## Severity formula
```
severity = 0.35 * volumeScore       // log10(count) / log10(100)
         + 0.30 * velocityScore     // today / 7-day baseline
         + 0.20 * tierWeight        // tier1=1.0, tier2=0.6
         + 0.15 * intensityScore    // (-goldstein + 10) / 20
         * locationConfidenceMult   // 0.5 + 0.5 * avgConfidence
```
Color: #F4B4B4 (low) → #7A0000 (high)
Radius: Math.sqrt(article_count) * 0.3
Threshold: hide below 0.15

## Supabase tables needed
- `articles` (id, url, headline, abstract, source_domain, source_name, source_bias, source_tier, lat, lng, location_confidence, goldstein, published_at, ingested_at, h3_cell)
- `hotspots` (id, h3_cell, lat, lng, name, region, severity, article_count, article_hash, volume_score, velocity_score, tier_weight, intensity_score, avg_goldstein, summary_failed, last_scored_at, created_at, updated_at)
- `summaries` (id, hotspot_id, neutral_summary, perspectives, citations, generated_at, model, prompt_version)
- `ingest_runs` (id, ran_at, status, article_count, message)

## Mock data
Use `?mock=1` query param to use fixtures instead of live data.
- `GET /api/hotspots?mock=1` → fixture list
- `GET /api/hotspots/{id}?mock=1` → fixture detail

## Cron schedule (vercel.json)
- 6:00am UTC: ingest
- 6:15am UTC: score
- 6:30am UTC: summarize

## Status
All sessions complete. Build passes. 34 unit tests pass.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
