# Hotspot — Backlog Stories

Each story ships as its own branch (`fix/` or `feat/`) → PR → merge into `main`.
Order is rough priority, not strict dependency.

---

## STORY-01 · fix/globe-mouse
### Fix world movement with the mouse

**Branch:** `fix/globe-mouse`

**Problem**
- Auto-rotate resumes too eagerly after a click (should pause for a beat, not immediately restart)
- Drag-to-pan and click-on-hotspot conflict: fast drags register as clicks and open the wrong panel
- Scroll-to-zoom sensitivity is too coarse on trackpad (pinch vs two-finger-scroll behave the same)
- No inertia — map snaps to a stop on release instead of gliding

**Files**
- `src/components/Globe.tsx` — `useEffect` with `map.on('mousedown'/'mouseup'/'click')`, `autoRotate` timer

**Acceptance criteria**
- [ ] Drags > 5px never trigger `onHotspotClick`
- [ ] Auto-rotate pauses on any interaction and resumes after 8 s of no input
- [ ] Trackpad pinch-zoom feels smooth (no jumpy steps)
- [ ] Map glides to a stop after a fast drag (inertia enabled in MapLibre options)
- [ ] No regression on hotspot click-to-open panel

---

## STORY-02 · fix/hotspot-visuals
### Fix hotspot dot visuals on the globe

**Branch:** `fix/hotspot-visuals`

> *(was STORY-03; STORY-02 world-view dropped — current globe kept as-is)*

**Problem**
- Severity color ramp (#F4B4B4 → #7A0000) is hard to read on the dark map — low-severity dots near-invisible
- Halo/pulse layer is not rendered or too subtle to see
- Dot radius (`Math.sqrt(articleCount) * 0.3`) causes very large blobs for 50+ article hotspots that overlap
- Active (selected) hotspot has no distinct visual state — no ring, no highlight
- Dots below `SEVERITY_THRESHOLD` (0.15) disappear silently; no empty-state handling if all filtered out

**Files**
- `src/components/Globe.tsx` — `addHotspotLayer()`, `circle-color`, `circle-radius`, `circle-stroke-*`

**Acceptance criteria**
- [ ] Minimum visible dot radius at severity 0.15 (floor so dots are never sub-pixel)
- [ ] Max radius capped so a 100-article hotspot doesn't obscure neighbors
- [ ] Active hotspot has a white/bright stroke ring distinguishing it from inactive
- [ ] Halo pulse layer renders and animates for high-severity dots (severity > 0.7)
- [ ] Color ramp updated: minimum color is #E88080 (more visible on dark) → #7A0000

---

## STORY-04 · feat/ai-summaries
### Update news summary AI (Gemini → Claude)

**Branch:** `feat/ai-summaries`

**Problem**
- `src/lib/ai/summarize.ts` currently calls Google Gemini (`gemini-flash-lite-latest`), contradicting the spec (claude-sonnet-4-6)
- Gemini responses occasionally miss the citation-per-sentence rule; retry logic fires too often
- System prompt doesn't enforce sentence-level diversity (all sentences can pull from same 2 articles)
- No structured output — response is freeform JSON that requires fragile string parsing
- `findUncitedSentences` regex doesn't catch sentences ending with punctuation inside quotes

**Files**
- `src/lib/ai/summarize.ts`
- `.env.local` — `ANTHROPIC_API_KEY` must be set (already documented)

**Acceptance criteria**
- [ ] Switched to Anthropic SDK (`@anthropic-ai/sdk`) calling `claude-sonnet-4-6`
- [ ] Uses Anthropic's tool-use / structured output to return typed JSON (no string-parse fragility)
- [ ] Every sentence in `neutral_summary` carries ≥ 1 citation; `findUncitedSentences` catches missing ones
- [ ] No evaluative adjectives slip through (prompt includes explicit banned-words list)
- [ ] `perspectives` array: each entry has `outlet`, `bias`, `quote`, `citations[]`
- [ ] Unit tests in `tests/unit/summarize.test.ts` pass with mocked Anthropic client
- [ ] Retry fires only once; on second failure, sets `summary_failed = true` in DB

---

## STORY-05 · feat/perspectives-tab
### Update the Perspectives tab UI

**Branch:** `feat/perspectives-tab`

**Problem**
- Perspectives are stacked vertically with no visual breathing room between them
- Bias label pill (left/center/right) is tiny and easy to miss
- No outlet logo / favicon — all perspectives look identical except the bias color stripe
- Quote text is rendered as plain prose — not visually distinct from the surrounding summary tab
- No fallback when `perspectives` array is empty or API returns `null`
- Citations inside perspectives aren't linked to the article list (no cross-tab navigation)

**Files**
- `src/components/PerspectivesView.tsx`
- `src/components/HotspotPanel.tsx` — tab switching

**Acceptance criteria**
- [ ] Each perspective card has a clear outlet name header + bias badge (full label, not abbrev.)
- [ ] Quote text is visually styled as a blockquote (left border, italic, slightly indented)
- [ ] Bias stripe on left edge uses the existing BIAS_LABELS color map
- [ ] Empty-state: "No perspectives available yet" message when array is empty
- [ ] Inline citation numbers are clickable — clicking [1] opens the articles tab scrolled to that article
- [ ] Cards have 16px vertical gap and a subtle separator

---

## STORY-06 · feat/article-sourcing
### Update article visibility and sourcing display

**Branch:** `feat/article-sourcing`

**Problem**
- ArticleList groups by bias but doesn't show tier (tier-1 sources should be visually elevated)
- Article cards lack favicon / source logo — all sources look equal
- No link-out affordance — "read full article" call-to-action is absent or unclear
- Abstract is truncated at a fixed char count that cuts mid-sentence
- Published timestamp shown as relative time ("3 hours ago") loses precision — should be absolute date
- Sources with no abstract show an empty card with no fallback text
- `isWhitelisted` check not surfaced to UI — whitelisted articles need no indicator, but non-whitelisted should be filtered silently (currently may show)

**Files**
- `src/components/ArticleList.tsx`
- `src/config/sources.ts` — `getSource()`, `isWhitelisted()`

**Acceptance criteria**
- [ ] Tier-1 articles render with a gold/amber dot or "Top Source" label
- [ ] Source name links to source domain (opens in new tab)
- [ ] Each card has a clear "Read →" external link to the full article URL
- [ ] Abstract truncation breaks on a word boundary with `…` — no mid-word cuts
- [ ] Published date shows as `Oct 31, 2026 · 9:45 AM` (absolute, not relative)
- [ ] Cards with no abstract show: `"No abstract available."`
- [ ] Only whitelisted articles ever appear (enforced at API layer; ArticleList trusts it)
- [ ] Bias groups with 0 articles are not rendered (no empty section headers)

---

## Branch → merge flow

```
main
 ├─ fix/globe-mouse        (STORY-01)
 ├─ fix/hotspot-visuals    (STORY-02)
 ├─ feat/ai-summaries      (STORY-03)
 ├─ feat/perspectives-tab  (STORY-04)
 └─ feat/article-sourcing  (STORY-05)
```

Each branch: implement → `npm test` → `npm run build` → PR → merge into `main`.
Stories 01–03 are independent fixes; 04–06 are feature work. No hard dependencies between them.
