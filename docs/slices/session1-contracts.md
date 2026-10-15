# Session 1: Contracts + Fixtures

## What changed
- Created `src/contracts/article.ts`, `hotspot.ts`, `summary.ts`, `api.ts` with TypeScript strict types + Zod schemas
- Created `src/config/sources.ts` with 12-source whitelist (tier 1/2, bias labels)
- Generated `fixtures/hotspots.mock.json` — 25 realistic hotspots spanning full severity range
- Written Vitest tests: 10 passing (contract validation, severity checks, whitelist validation)

## Key decisions
- Fixed UUIDs in fixtures: summary IDs used 's' prefix which isn't valid hex
- Fixed duplicate hotspot/summary IDs by using 'f' prefix for summaries

## What's left
- Playwright E2E tests (planned for Session 2 gate)

## Known issues
- None
