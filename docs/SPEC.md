# Hotspot — Intelligent Global Briefing Globe
## Phase 0 Spec

*Frozen after Phase 0. Subagents must not modify this file.*

---

## 1. Product Vision

### Current state
A news globe that clusters articles into H3 hexagons and renders them as colored dots. Users click a dot to see a Claude-generated neutral summary, left/center/right perspectives, and source links.

### New state
A regional intelligence briefing tool. The globe gains a second layer: 10 strategic regions colored by how much news activity is disrupting their supply function. Clicking a region answers three questions:

- **What does this region supply to the world?** (specific, quantified)
- **What is disrupting that supply right now?** (cause → effect → downstream chain)
- **Who else feels it, and through what mechanism?** (connections with type + strength)

The existing hotspot layer remains; users can toggle between views in Phase 1.

### Core user journeys

1. **Morning scan** — user opens the globe, sees which regions have elevated scores (brighter fill). Clicks China → reads the 200-word brief → follows a connection arc to Southeast Asia → reads that brief. Two minutes, three regions, complete picture of semiconductor supply chain stress.

2. **Catch-up** — user returns after a week away. Selects Taiwan, picks a 7-day date range, gets a catch-up brief: what happened, what changed, where it stands, storylines that shifted status.

3. **Arc navigation** — user clicks an arc connecting Middle East Gulf to Germany. Globe transitions to Germany view, loading the EU Industrial Core brief. Back button returns to Gulf view.

---

## 2. MVP Scope

### 10 regions

| ID | Display Name | Primary Supply |
|----|-------------|---------------|
| `taiwan` | Taiwan | Leading-edge semiconductors (92% of <7nm fab capacity) |
| `middle_east_gulf` | Middle East Gulf | Crude oil (30% of global exports), LNG (25%) |
| `chile_lithium_triangle` | Chile / Lithium Triangle | Lithium (60% of global reserves), copper |
| `eastern_europe` | Eastern Europe / Ukraine | Wheat (27% of global exports), neon gas |
| `southeast_asia` | Southeast Asia | Electronics assembly, palm oil, natural gas |
| `congo_basin` | Congo Basin | Cobalt (70% of global supply), coltan |
| `germany_eu` | Germany / EU Industrial Core | Manufactured goods, chemicals, advanced machinery |
| `china` | China | Rare earths (85% of global supply), manufacturing |
| `us_gulf_coast` | US Gulf Coast | Oil refining (45% of US capacity), LNG export |
| `france` | France | Nuclear power (70% of domestic grid), aerospace |

### In scope (Phase 0)
- Contract schemas (TypeScript + Zod v3)
- Product spec (this document)
- Simplified bounding-box GeoJSON for all 10 regions
- Mock fixture files for frontend development
- Brief generation prompt

### Explicitly out of scope (Phase 0)
- Implementation of any service, component, or API route
- Database migrations
- Any change to existing contracts or code

### Success criteria
1. `npm run build` — zero TypeScript errors with new contract files added
2. `npm test` — all 42 existing tests still pass
3. `RegionBriefSchema.safeParse(fixtures/region_briefs.mock.json[0])` → success
4. `CatchUpBriefSchema.safeParse(...)` with `range_start > range_end` → fails with message "range_start must be ≤ range_end"
5. All 10 `data/regions/*.geojson` files are valid GeoJSON `Feature` objects with `properties.id` matching region ID slugs
6. This SPEC.md exists and contains all sections

---

## 3. Data Architecture

### Pipeline (updated cron)

```
articles table (unchanged)
    │
    ▼ after upsertArticles()
article_regions (join table)       ← subagent A: assignArticlesToRegions()
    │
    ├──▶ region_scores              ← subagent B: scoreRegions(date)
    │
    └──▶ facts                      ← subagent C: extractFacts() [Pass 1, Haiku]
             │
             ├──▶ storylines        ← subagent C: matchOrCreateStorylines()
             │
             └──▶ region_briefs     ← subagent C: generateBrief() [Pass 2, Sonnet]
                       │
                       └──▶ catchup_briefs  ← on-demand, from stored facts
```

### Cron schedule (vercel.json)

| Time (UTC) | Job | Owner |
|-----------|-----|-------|
| 6:00am | Ingest (existing) | existing |
| 6:15am | Score hotspots + score regions | existing + subagent B |
| 6:30am | Summarize hotspots (existing) | existing |
| 6:45am | Extract facts + match storylines (Pass 1, Haiku) | subagent C |
| 7:00am | Generate region briefs (Pass 2, Sonnet) | subagent C |

### Backward compatibility
- `Article` TypeScript contract: unchanged
- `articles` DB table: no new columns
- Existing hotspot scoring: unchanged
- Existing API routes (`/api/hotspots/*`): unchanged
- Region assignment uses a join table (`article_regions`) — clean separation

---

## 4. Contracts

All contracts live in `src/contracts/`. Pattern: named export `FooSchema` (Zod v3) + named export `type Foo = z.infer<typeof FooSchema>`.

**Frozen after Phase 0.** Subagents consume but never modify.

### Existing (frozen, untouched)
- `article.ts` → `Article`
- `hotspot.ts` → `Hotspot`
- `summary.ts` → `Summary`
- `api.ts` → API types for existing hotspot routes

### New (frozen after Phase 0)

#### `region.ts`
- `ResourceSchema` — `{ resource, approx_global_share, unit? }`
- `RegionProfileSchema` — full region record: id, name, short_name, geometry_ref, centroid, key_supplies, key_industries, major_partners, description, timestamps

#### `fact.ts`
- `FactSchema` — `{ id, date, region_id, claim, source_article_id, storyline_id, extracted_at, model, prompt_version }`
- `claim`: one factual sentence, no evaluative adjectives, max 1,000 chars

#### `storyline.ts`
- `StorylineStatusSchema` — enum: `emerging | escalating | stable | fading | resolved`
- `StorylineSchema` — `{ id, title, region_ids[], status, first_seen, last_updated, summary?, timestamps }`

#### `region_score.ts`
- `ScoreComponentsSchema` — `{ volume_vs_baseline, severity, economic_relevance, velocity }`
- `RegionScoreSchema` — `{ id, region_id, date, score, score_delta, components, article_count, computed_at }`

#### `region_brief.ts`
- `ConnectionTypeSchema` — enum: `trade | debt_finance | energy | supply_chain | security | migration`
- `ConnectionSchema` — `{ region_id, type, strength, why }`
- `CausalChainSchema` — `{ cause, effect, downstream? }`
- `DevelopmentSchema` — `{ development, chain }`
- `BriefSourceSchema` — `{ article_id, headline, url, source_name, published_at }`
- `RegionBriefSchema` — `{ id, region_id, date, headline, matters_for[], whats_changing[], connections[], watch[], sources[], generated_at, model, prompt_version }`

#### `catchup_brief.ts`
- `StorylineUpdateSchema` — `{ storyline_id, title, status_at_start, status_at_end, summary }`
- `CatchUpBriefSchema` — `{ id, region_id, range_start, range_end, what_happened, what_changed, where_it_stands, storyline_updates[], watch[], fact_ids_used[], generated_at, model, prompt_version }`
- Validation: `range_start ≤ range_end` (Zod `.refine()`)

#### `region_api.ts`
- `RegionListItemSchema` — slim shape for globe render (`GET /api/regions`)
- `RegionsResponseSchema` — `{ regions[], generated_at }`
- `RegionDetailResponseSchema` — `{ region, score, brief, storylines[], generated_at }` (`GET /api/regions/[id]`)
- `CatchUpRequestSchema` — `{ range_start, range_end }` (POST body)
- `CatchUpResponseSchema` — `{ brief, generated_at }`

---

## 5. DB Schema

Seven new Supabase tables. All new; no existing tables modified.

### `regions`
```sql
create table regions (
  id              text primary key,
  name            text not null,
  short_name      text not null,
  geometry_ref    text not null,
  centroid_lat    double precision not null,
  centroid_lng    double precision not null,
  key_supplies    jsonb not null default '[]',
  key_industries  jsonb not null default '[]',
  major_partners  jsonb not null default '[]',
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### `article_regions` (join table — preserves frozen Article contract)
```sql
create table article_regions (
  article_id  uuid not null references articles(id),
  region_id   text not null references regions(id),
  assigned_at timestamptz not null default now(),
  method      text not null default 'point_in_polygon',
  primary key (article_id, region_id)
);
create index article_regions_region_idx on article_regions (region_id, assigned_at desc);
```

### `region_scores` (append-only)
```sql
create table region_scores (
  id              uuid primary key default gen_random_uuid(),
  region_id       text not null references regions(id),
  date            date not null,
  score           double precision not null check (score >= 0 and score <= 1),
  score_delta     double precision,
  components      jsonb not null,
  article_count   integer not null default 0,
  computed_at     timestamptz not null default now(),
  unique (region_id, date)
);
create index region_scores_region_date_idx on region_scores (region_id, date desc);
```

### `facts`
```sql
create table facts (
  id                uuid primary key default gen_random_uuid(),
  date              date not null,
  region_id         text not null references regions(id),
  claim             text not null,
  source_article_id uuid not null references articles(id),
  storyline_id      uuid references storylines(id),
  extracted_at      timestamptz not null default now(),
  model             text not null,
  prompt_version    text not null
);
create index facts_region_date_idx on facts (region_id, date desc);
```

### `storylines`
```sql
create table storylines (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  region_ids   text[] not null default '{}',
  status       text not null check (status in ('emerging','escalating','stable','fading','resolved')),
  first_seen   date not null,
  last_updated date not null,
  summary      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index storylines_region_ids_gin on storylines using gin (region_ids);
```

### `region_briefs` (append-only)
```sql
create table region_briefs (
  id              uuid primary key default gen_random_uuid(),
  region_id       text not null references regions(id),
  date            date not null,
  headline        text not null,
  matters_for     jsonb not null default '[]',
  whats_changing  jsonb not null default '[]',
  connections     jsonb not null default '[]',
  watch           jsonb not null default '[]',
  sources         jsonb not null default '[]',
  generated_at    timestamptz not null default now(),
  model           text not null,
  prompt_version  text not null,
  unique (region_id, date)
);
```

### `catchup_briefs`
```sql
create table catchup_briefs (
  id                uuid primary key default gen_random_uuid(),
  region_id         text not null references regions(id),
  range_start       date not null,
  range_end         date not null,
  what_happened     text not null,
  what_changed      text not null,
  where_it_stands   text not null,
  storyline_updates jsonb not null default '[]',
  watch             jsonb not null default '[]',
  fact_ids_used     uuid[] not null default '{}',
  generated_at      timestamptz not null default now(),
  model             text not null,
  prompt_version    text not null,
  unique (region_id, range_start, range_end)
);
```

---

## 6. Region Geometry

### Storage
`data/regions/{id}.geojson` — each file is a GeoJSON `Feature` (not `FeatureCollection`) with `properties.id` matching the region ID slug.

### MVP format
Simplified bounding-box polygons (convex, 4–8 coordinates). Fast enough for point-in-polygon at any article volume with no external dependencies. Replace with Natural Earth 50m boundaries in Phase 1.

### Point-in-polygon
New file `src/lib/region_assign.ts` (subagent A). Loads all 10 GeoJSON files at module init. Per article:
1. Bounding-box pre-filter: reject if lat/lng outside polygon bbox (fast path, ~0.1ms)
2. Ray-cast inside bbox: ~0.5ms per article

Estimated throughput: ~1ms total for 5,000 articles × 10 regions.

### Globe serving
`GET /api/regions/geometry` returns assembled `FeatureCollection` of all 10 polygons. Edge-cached 1 hour. Globe loads this once at startup.

---

## 7. AI Pipeline

### Pass 1 — Fact extraction (Haiku, 6:45am UTC)
Model: `claude-haiku-4-5-20251001`
Input: articles assigned to a region in the last 24 hours
Output: `Fact[]` + `{ storyline_title, is_new: boolean }[]`

Storyline matching:
- If `is_new: true`: insert new `Storyline` row
- If `is_new: false`: fuzzy-match title against open storylines in last 14 days (Levenshtein distance ≤ 0.3 of title length); link fact to best match

### Pass 2 — Brief generation (Sonnet, 7:00am UTC)
Model: `claude-sonnet-4-6`
Prompt: `prompts/brief.md` (brief-v1)
Input: `Fact[]` for region-day + source articles
Output: `RegionBrief` JSON

Post-generation validation:
1. `RegionBriefSchema.safeParse()` — if fails, retry once with correction prompt listing valid region_ids
2. Check all `connection.region_id` values are in valid set
3. Check no banned adjectives (`brutal|catastrophic|shocking|reckless|outrageous`)

Cache: `unique (region_id, date)` on `region_briefs` table. Never regenerate unless row is manually deleted.

### Catch-up briefs (on-demand)
Triggered by `POST /api/regions/[id]/catchup` with `{ range_start, range_end }`.
Pulls `facts` for region in date range. Generates catch-up brief via Sonnet. Cached by `unique (region_id, range_start, range_end)`.

---

## 8. Scoring Formula

### RegionScore components

| Component | Weight | Formula |
|-----------|--------|---------|
| `volume_vs_baseline` | 35% | `min(1, volume_vs_baseline / 2)` |
| `severity` | 30% | avg severity of hotspots whose centroid falls in region |
| `economic_relevance` | 20% | tier-weighted fraction of articles from finance/energy/mfg sources |
| `velocity` | 15% | `min(1, abs(velocity - 1))` |

```
score = 0.35 * min(1, volume_vs_baseline/2)
      + 0.30 * severity_avg
      + 0.20 * economic_relevance
      + 0.15 * min(1, abs(velocity - 1))
```

### Score delta
```
score_delta = score_today - score_7_days_ago
```
Null if fewer than 7 days of history for this region.

### Globe rendering modes

**Now mode** (default)
- `fill-opacity = score`
- `fill-color`: severity gradient #F4B4B4 (low) → #7A0000 (high)

**Change mode** (toggle)
- `fill-opacity = min(1, abs(score_delta) * 1.5)`
- `fill-color`: positive delta → `#2563EB` (blue, intensifying), negative delta → `#7A0000` (red, easing)

---

## 9. Globe Rendering

### Region fill layer (MapLibre GL)
New GeoJSON source loaded from `GET /api/regions/geometry`. Two layers:
1. `region-fill` — `fill` type, paint driven by score feature property
2. `region-outline` — `line` type, dashed, 1px opacity 0.3

Score injected as feature property by merging `/api/regions` response into FeatureCollection before loading into MapLibre.

### Arc layer
Great-circle `LineString` features in a GeoJSON source named `region-arcs`. One arc per `Connection` in the active region's brief.

Animation: `requestAnimationFrame` + `setPaintProperty("arc-line", "line-dasharray", [...])` cycling dash offset at ~30fps (every 2nd rAF frame). Throttle to every 3rd frame if >10 arcs.

Click: MapLibre `click` event on `arc-line` layer → read `feature.properties.to_region` → `onRegionClick(to_region)`.

### Time slider
Date picker above globe. On change: `GET /api/regions?date=YYYY-MM-DD` → reload scores → update fill paint properties. No page reload.

---

## 10. Panel and Navigation

### RegionPanel
Replaces/coexists with HotspotPanel. Renders when a region is selected.

Layout (top to bottom):
1. **Region name** + score badge + score_delta indicator (↑↓ with color)
2. **Headline** — single sentence from brief
3. **Matters for** — bulleted list, max 3 items
4. **What's changing** — accordion, one entry per development, expands to show causal chain
5. **Connections** — list of connected regions with type chip and strength bar; click → navigate
6. **Watch** — 1–3 items in muted style
7. **Sources** — collapsed by default, expandable list of source links

### CatchUpPicker
Date range selector with preset buttons (3 days, 7 days, 30 days). On submit: `POST /api/regions/[id]/catchup`. Shows loading state, then renders CatchUpBrief inline.

### Navigation history
Simple back-stack array in React state. Each `onRegionClick` pushes to stack. Back button pops.

---

## 11. Subagent Boundaries

| Subagent | Files | Reads | Does NOT touch |
|---------|-------|-------|---------------|
| A — Ingestion | `src/lib/region_assign.ts`, `src/lib/ingest.ts` (+1 call) | contracts/region, data/regions/ | frozen contracts, scoring |
| B — Storage & Scoring | `src/lib/region_score.ts`, `src/lib/region_db.ts`, `app/api/cron/score/route.ts` | contracts/region_score, region | existing score.ts, hotspot scoring |
| C — AI Pipeline | `src/lib/extract.ts`, `src/lib/brief.ts`, `app/api/cron/extract/route.ts`, `app/api/cron/brief/route.ts`, `prompts/extract.md` | all new contracts, facts, storylines | summarize.ts |
| D — Globe | `src/components/Globe.tsx` (extend) | region_api types, fixtures | HotspotPanel, scoring logic |
| E — Panels | `src/components/RegionPanel.tsx`, `CatchUpPicker.tsx`, `StorylineList.tsx`, `app/api/regions/` | all new contracts | HotspotPanel, hotspot routes |
| F — Evaluation | `evals/rubric.ts`, `evals/run.ts`, `evals/fixtures/` | all new contracts + fixtures | production code |

---

## 12. Evaluation Rubric

Reference cases: US Gulf Coast, France, Taiwan, Chile.

### Automated checks (subagent F)
- `RegionBriefSchema.safeParse()` passes — no Zod errors
- At least 1 `connection` in brief
- All `connection.region_id` values in valid set: `{taiwan, middle_east_gulf, chile_lithium_triangle, eastern_europe, southeast_asia, congo_basin, germany_eu, china, us_gulf_coast, france}`
- No evaluative adjectives: `/brutal|catastrophic|shocking|reckless|outrageous/i`
- Taiwan brief: `/semiconductor|TSMC/i` present
- France brief: `/nuclear|EDF/i` present
- Chile brief: `/lithium|copper/i` present
- US Gulf Coast brief: `/refin|LNG|petrochemical/i` present

---

## 13. Environment Variables

No new env vars required for Phase 0.

Phase 1 additions (subagents document in their own AGENTS.md sections):
- `ANTHROPIC_API_KEY` — already present (used by summarize.ts)
- Pass 1 model: `claude-haiku-4-5-20251001` (already credentialed via ANTHROPIC_API_KEY)

---

## 14. Open Questions / Risks

| Risk | Mitigation |
|------|-----------|
| `score_delta` null on first 7 days | Backfill 30 days of `region_scores` before launch using historical `articles` data |
| Arc animation stutter at 30+ arcs | Cap to 30fps (every 2nd rAF); reduce to every 3rd frame if >10 arcs |
| AI emits invalid `region_id` slugs | Validate + 1 retry with slug list injected in prompt |
| Catch-up brief thin on sparse facts | Prompt acknowledges low fact density; bounds claims to what is supported |
| `article_regions` orphans if ingest fails mid-run | Reconciliation query at start of scoring cron |
| RegionBrief generation slow at 10 regions/day | `Promise.allSettled` parallel calls; cache prevents regeneration |
| Bounding-box regions overlap (e.g., France and Germany/EU) | Acceptable for MVP; article assigned to all matching regions; deduplicate in scoring |
