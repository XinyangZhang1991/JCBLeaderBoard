# Mechanics Fix — Revert Instructions

This document records the slider-threshold mechanics fix and how to undo it.

## What was fixed

Five scenario scorers in `main program v3/scoring.js` had **unreachable
thresholds** because the game's budgets were rescaled from £M to sub-£1M but the
scoring thresholds were never rescaled. The result: certain slider allocations
were silently ignored (no LEAD points, no business-metric movement).

| Scenario | Function | Old (dead) thresholds | New (reachable) |
|---|---|---|---|
| competitor_threat | `scoreCompetitorThreat` | `priceMatch >= 1.0`, `rnd >= 1.0 && dealers >= 0.8`, `dealerPartnership >= 0.6/0.8` | share-of-total: `>= 0.6`, `>= 0.4 && >= 0.3`, `>= 0.3/0.4` |
| innovation_gamble | `scoreInnovationGamble` Part 3 | `qa >= 0.5`, `pilot >= 0.4`, `marketing > 0.6` | share-of-total: same numbers, now reachable |
| year_end | `scoreYearEnd` Part 2 | `capability >= 0.4`, `celebration >= 0.3`, `bonuses > 0.5` | share-of-total: same numbers, now reachable |
| merger_integration | `scoreMergerIntegration` Part 3 | `retention >= 0.3`, `teamBuilding >= 0.2 && training >= 0.2` | share-of-total: same numbers, now reachable |
| market_disruption | `scoreMarketDisruption` Part 2 | `rd >= 2.0`, `innovation >= 1.0`, `talent >= 1.5` | share-of-total: `>= 0.2` each |

**Method:** each slider allocation is normalised to its **share of the total
amount allocated** (`v / totalAllocated`, range 0..1). This is scale-independent
and preserves the original "proportion of what you spent" intent. It does NOT
change any win condition, LEAD gate, or balance threshold.

## Additional fix

`main program v3/game-engine.js` — `renderLEADScoreBreakdown()` now clamps every
"% of maximum achievable" figure to 0-100, so a strong player can never be shown
an impossible figure (e.g. "Agility 107%"). The raw per-dimension cap is 250,
which can exceed the Agility ceiling of 233.

## Safety net (created BEFORE the fix)

- **Branch:** `safety/pre-mechanics-fix`
- **Tag:** `pre-mechanics-fix`

Both point at the exact working-tree state immediately before the fix.

## How to revert

### Option A — discard only the fix, keep everything else (recommended)

The fix touched exactly two files. To restore just those two files to the
pre-fix state:

```
git checkout pre-mechanics-fix -- "main program v3/scoring.js" "main program v3/game-engine.js"
```

### Option B — inspect the diff first

```
git diff pre-mechanics-fix -- "main program v3/scoring.js" "main program v3/game-engine.js"
```

### Option C — full rollback to the safety branch

```
git checkout safety/pre-mechanics-fix
```

(Note: this switches branches; uncommitted work on other files may need stashing
first.)

### Option D — revert a single scenario only

Each fix is an isolated block. To undo just one, restore that function's block
from the tag, or manually re-introduce the old absolute thresholds listed in the
table above.

## Verification

`verify-mechanics-fix.js` proves every threshold is reachable (19/19 checks pass)
and that a zero allocation does not divide-by-zero. Run:

```
node verify-mechanics-fix.js
```

## UI fixes (separate from the mechanics fix)

Three presentation issues were fixed after the audit. These are **cosmetic /
layout only** and do not touch scoring:

1. **Business-impact overflow** — `main program v3/styles.css`: `.business-impact`
   now uses `max-width: min(900px, 100%)`, fluid `clamp()` padding/type, and
   `flex-wrap` on rows so the card can never run off-screen. A phone media-query
   override stacks the assessment under the label/value.
2. **"Target met" scroll overshoot** — `main program v3/game-engine.js`
   `showFeedback()`: the scroll anchor changed from the tall feedback container
   to the `#results-outcome` verdict, so the player lands on the headline result
   instead of scrolling past it.
3. **Two-page executive summary** — `main program v3/executive-summary-generator.js`
   `generateExecutiveSummary()`: opening paragraph trimmed to one line and the
   print CSS tightened (margins, section spacing, type scale) so the summary fits
   a single A4 page.

To revert only the UI fixes:

```
git checkout pre-mechanics-fix -- "main program v3/styles.css" "main program v3/executive-summary-generator.js"
```

(Note: `game-engine.js` carries BOTH the mechanics clamp and the scroll fix, so a
blanket checkout of that file would also revert the LEAD-breakdown clamp. Revert
the scroll block manually if you want to keep the clamp.)

## Leaderboard ranking fix (Round 2 shows 1st, not 17th)

**Symptom:** a Round 2 player was listed as "17th" on the live leaderboard even
though they were 1st within Round 2.

**Cause:** the server (`server/results-store.js` `leaderboard()` / `summary()`)
assigns each entry's `rank` against the **combined** cohort (Round 1 + Round 2
mixed). `main program v3/live-sync.js` `renderOverlay()` filtered the entries to
the selected round but rendered the server-assigned `e.rank` unchanged, so a
Round 2 player who was 17th overall displayed as "17th".

**Fix:** `main program v3/live-sync.js` `renderOverlay()` now re-ranks the
round-filtered entries before rendering — it sorts by growth DESC then LEAD DESC
and reassigns `rank = i + 1`, so the displayed rank is the position **within the
selected round**. This mirrors the already-correct local-fallback path.

The host display (`server/public/display.js`) intentionally shows a single
combined board with a "Round" column, so its combined-cohort rank is left as-is.

To revert only this fix:

```
git checkout pre-mechanics-fix -- "main program v3/live-sync.js"
```

## PDF alignment fix (LEAD Competency Breakdown)

**Symptom:** in the exported PDF, the four LEAD dimensions (Leadership /
Excellence / Agility / Determination) in the "LEAD Competency Breakdown"
appendix section stacked vertically instead of sitting in aligned columns.

**Cause:** the section was rendered with a CSS grid (`.lead-grid` /
`.lead-dimension`). The offline PDF writer ([`pdf-writer.js`](main program v3/pdf-writer.js))
does not render CSS grid — it flattens each `<div>` into its own paragraph, so
the grid columns collapsed.

**Fix:** `main program v3/executive-summary-generator.js`
`generateLEADAnalysis()` now emits a real `<table>` (header row + percentage row
+ raw/max row) with explicit `width="25%"` cells. The PDF writer understands
`<table>/<tr>/<td>` and lays them out with proper, aligned columns, so the
browser view and the PDF now agree. The now-dead `.lead-grid` /
`.lead-dimension` / `.lead-score` / `.lead-label` CSS rules were removed.

## Percentage-consistency fix (feedback page vs executive summary)

**Symptom:** the "Overall LEAD" percentage shown on the main feedback page did
not match the "Overall LEAD Quality" percentage in the executive summary PDF for
the same run.

**Cause:** the two artefacts used **different formulas** for the same figure.

- Feedback page — [`renderLEADScoreBreakdown()`](main program v3/game-engine.js:4609)
  used the **weighted** ratio:
  `Σ raw[dim] / Σ maximum[dim] * 100`.
- Executive summary —
  [`getAverageLeadPercentOfMaximum()`](main program v3/executive-summary-generator.js:279)
  used the **unweighted mean** of the four per-dimension ratios:
  `mean( raw[dim] / maximum[dim] ) * 100`.

Because the four dimensions have different ceilings (e.g. Agility 233 vs
Excellence 450), the two formulas produced different numbers for the same run.

**Fix:** `main program v3/executive-summary-generator.js`
`getAverageLeadPercentOfMaximum()` now uses the **same weighted formula** as the
feedback page (`Σ raw / Σ maximum`), so the two artefacts can never disagree.

**Not changed:** `calculateAverageLEADRatio()` and `calculateLEADRatios()` remain
on the separate **19-point-per-scenario benchmark** scale. That scale drives the
verdicts/risk labels and is intentionally distinct from the "% of maximum
achievable" scale — the feedback page labels it "LEAD Quality (vs benchmark)"
and the summary labels it "LEAD quality", so the two scales stay clearly
separated.

To revert only this fix:

```
git checkout pre-mechanics-fix -- "main program v3/executive-summary-generator.js"
```

(Note: that file also carries the two-page executive-summary print fix, so a
blanket checkout would revert both. Revert the `getAverageLeadPercentOfMaximum()`
block manually if you want to keep the print fix.)

## Culture dashboard redesign (segmented, password-gated)

**Goal:** replace the "woolly" narrative culture report with a **data dashboard**
that segments the players who have actually played and shows, side by side, how
the LEAD cohort, business executives and middle managers differ when amalgamated.

### Access control

- The culture button is visible again in the main game (removed from the
  `display: none` rule in [`styles.css`](main program v3/styles.css)).
- Clicking it calls [`promptCultureAccess()`](main program v3/game-engine.js:5289),
  which shows a browser `prompt()`. Entering **`JCBLEAD`** opens the dashboard;
  any other value aborts with an alert. This is a simple client-side gate (not a
  security boundary) — it exists so the culture view is not casually visible.

### Segmentation model

[`analyzeCultureDashboard()`](main program v3/culture-analysis.js:641) replaces
`analyzeCulture()` for the dashboard and PDF. It:

1. Filters to **culture-eligible** players only via `isCultureEligible()` —
   students and non-JCB business functions are excluded (unchanged rule).
2. Anonymises each record via `anonymiseForCulture()`.
3. Builds four segmentation axes with `_buildDashboardGroups()`:
   - **byCohort** — `2025 cohort`, `2026 cohort`, `Non-participants`
   - **bySeniority** — Executive, Middle Manager, Team Leader, …
   - **byColour** — primary personality colour (compound `RED/YELLOW` → `RED`)
   - **byStyle** — dominant Goleman leadership style
4. Summarises each group with `_summariseGroup()`: per-dimension LEAD averages
   (leadership / excellence / agility / determination), weighted `overallPct`,
   style + colour distributions, diversity index, and outcome averages
   (growth, morale, attrition, profit margin, success rate, optimal rate).
5. Builds four head-to-head comparisons with `_comparison()`:
   - **2026 vs 2025** (year-on-year LEAD movement)
   - **LEAD cohort vs non-participants**
   - **Exec vs Middle Manager**
   - **Exec vs LEAD cohort**

   Deltas are signed so a positive number always means "the first group is
   better"; attrition is inverted accordingly. Comparisons are omitted when a
   group falls below `minSegmentSize` (3 players).

### Rendering

- [`renderCultureDashboard()`](main program v3/game-engine.js:6144) was rewritten
  as a dashboard: a headline KPI strip, head-to-head comparison cards with
  signed delta bars, and CSS bar / stacked-bar charts for LEAD-by-cohort,
  LEAD-by-seniority, style-by-cohort, colour-by-cohort, colour-by-seniority and
  outcomes-by-cohort. Helper renderers: `_kpiCard()`, `_renderComparisonCard()`,
  `_renderSegmentGraph()`, `_renderDistributionGraph()`, `_renderOutcomeGraph()`.
- New chart components were appended to
  [`culture-dashboard-styles.css`](main program v3/culture-dashboard-styles.css)
  (`.culture-kpi-strip`, `.culture-comparison-card`, `.culture-bar-chart`,
  `.culture-stack-chart`, `.culture-legend`, …).

### PDF

- [`_buildCultureSummaryHtml()`](main program v3/game-engine.js:5464) now derives
  its headline figures (success/optimal counts, spread label, aggregate,
  diversity, most/least-used style) from the segmented groups.
- [`_buildCultureAppendixHtml()`](main program v3/game-engine.js:5686) branches to
  [`_buildSegmentedCultureAppendix()`](main program v3/game-engine.js:5971) when
  the model is segmented, emitting **table-based** comparisons and distributions
  (the offline PDF writer does not render CSS grid or SVG).

### Root-cause bug fixed alongside this work

**Symptom:** the culture analysis reported **0 players** even though the
leaderboard held 17–19 entries. Reported twice — the first fix did not clear it
in the live browser.

**Cause — two independent defects, both had to be fixed:**

1. **Server projection omitted the segmentation fields.** The server
   leaderboard projection
   ([`toLeaderboardEntry()`](main program v3/results-store.js:667)) omitted
   `jobFunction`, `seniority` and `leadCohort`. The culture engine therefore saw
   records with no JCB business function and excluded every one of them. The
   server ([`server/results-store.js`](server/results-store.js:173)) delegates to
   the same shared helper, so the source fix propagates automatically — **but the
   already-running Node process held the old module in memory**, so
   `/api/leaderboard` kept returning records without the fields until the server
   was restarted.
2. **Stale localStorage rows were never repaired.** Rows written by an older
   build lacked the segmentation fields, and
   [`reconcileCultureData()`](main program v3/game-engine.js:595) only *appended*
   missing runs — it never back-filled fields onto records that already existed.
   So even after the server was correct, the browser's `jcb_culture_data` stayed
   ineligible.

**Fix:**

- `toLeaderboardEntry()` now includes `jobFunction`, `seniority` and
  `leadCohort` (defect 1, source). **The server must be restarted** for this to
  take effect on a running instance.
- [`reconcileCultureData()`](main program v3/game-engine.js:595) was rewritten
  from Set-based to Map-based indexing so it can **back-fill** missing
  segmentation fields onto existing culture records (not just append new runs).
- New [`hydrateCultureFromServer()`](main program v3/game-engine.js:500) fetches
  the authoritative `/api/cohort`, flattens it with `canonicalToFlat()`, and
  repairs **both** local stores (`jcb_culture_data` and `jcb_leaderboard`) keyed
  by `runId`. It is idempotent — object fields such as `leadershipProfile` are
  compared by value, not reference, so a second run is a no-op.
- [`showCultureDashboard()`](main program v3/game-engine.js:5446) and
  [`downloadCulturePdf()`](main program v3/game-engine.js:5492) are now `async`
  and `await` the hydration before analysing, so the dashboard self-heals from
  the server regardless of when the local rows were written.

### Follow-up fixes (dashboard polish)

**1. "LEAD Cohort" KPI always showed 0.** The renderer looked up a group named
`"LEAD cohort (all)"` in `model.byCohort`, but
[`analyzeCultureDashboard()`](main program v3/culture-analysis.js:641) only emits
`"2025 cohort"`, `"2026 cohort"` and `"Non-participants"` — the `"LEAD cohort
(all)"` name exists only transiently inside `_mergeGroups()` for the comparison.
So the lookup always returned `null` and the KPI rendered `0`. Fixed by adding
[`_mergeCohortGroups()`](main program v3/game-engine.js:6424), which unions the
2025 + 2026 cohort groups (weighted by count) for the KPI.

**2. Dead space above the dashboard title.** The base `.screen.active` rule
([`styles.css`](main program v3/styles.css:49)) uses `justify-content: center`,
which vertically centred the `.culture-dashboard-container` and pushed the
"COMPANY CULTURE ANALYSIS" heading down. Fixed by top-aligning this screen
(`#culture-dashboard-screen.active { justify-content: flex-start; align-items:
stretch; }`) and trimming the container's top padding in
[`culture-dashboard-styles.css`](main program v3/culture-dashboard-styles.css:42).

### Verification

`verify-culture-dashboard.js` loads `culture-analysis.js` in a `vm` sandbox and
feeds it a synthetic 12-player cohort (10 eligible + 2 excluded students/non-JCB).
It asserts exclusion, all four segmentation axes, per-segment LEAD averages and
overall %, distribution sums, and the head-to-head comparisons. Run:

```
node verify-culture-dashboard.js
```

`verify-culture-hydration.js` reproduces the "0 players" bug end-to-end: it seeds
stale localStorage rows (no `jobFunction`/`seniority`/`leadCohort`), stubs
`ResultsStore.fetchCohort()` with the authoritative canonical cohort, loads
`game-engine.js` in a `vm` sandbox, runs `hydrateCultureFromServer()`, and
asserts the rows are repaired in **both** stores, that no duplicates are created,
and that a second run is an idempotent no-op. Run:

```
node verify-culture-hydration.js
```

Results: **verify-culture-dashboard.js 20/20**, **verify-culture-hydration.js
10/10**, **verify-mechanics-fix.js 19/19**.

To revert only the culture redesign:

```
git checkout pre-mechanics-fix -- "main program v3/culture-analysis.js" "main program v3/culture-dashboard-styles.css"
```

(Note: `game-engine.js` and `results-store.js` carry other fixes too, so revert
the culture-specific blocks manually if you want to keep those.)

## What was NOT changed

- No win conditions in `calculateFinalScore()`.
- No LEAD quality / balance thresholds in `lead-constants.js`.
- No personality-colour logic (`calculatePersonalityColor()`).
- No scenario text or slider maxima in `scenarios.js`.
