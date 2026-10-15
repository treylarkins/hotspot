# Session 2: Visual Prototype

## What changed
- Built `Globe.tsx` — react-globe.gl with dark texture, auto-rotate, click animation, severity color/radius
- Built `HotspotPanel.tsx` — tabbed panel (summary/perspectives/articles), loading skeleton, severity bar
- Built `SummaryView.tsx` — inline [n] citation markers as superscript links
- Built `PerspectivesView.tsx` — outlet-attributed perspectives with bias labels
- Built `ArticleList.tsx` — outlet badge, timestamp, external links
- Updated `app/page.tsx` — globe page with severity legend, hotspot count
- Added `/status` page

## Key decisions
- Globe loads via dynamic import (SSR unsafe) with loading spinner
- Auto-rotate pauses on click, resumes after 10s
- Mock data via `?mock=1` query param on all API calls

## What's left
- Live data wiring (Session 3 backend)
- Playwright E2E screenshots

## Known issues
- Globe dark texture loaded from unpkg CDN — needs proper hosting for production
