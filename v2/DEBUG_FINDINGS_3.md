# Debug Findings — Batch 3 (Issues A–I)

**Scope:** READ-ONLY diagnosis of the browser-based leadership training game in `v2/`.
**Constraint respected:** No `.js` or `.html` files were modified. This document is the only artefact produced.
**Method:** Static trace of every code path named in the issues, plus execution of the existing Node verification harness [`_verify_cohort_segmentation.js`](v2/_verify_cohort_segmentation.js:1) to separate _code_ defects from _data_ defects.

---

## Executive Summary

| #   | Issue                                | Root cause (one line)                                                                                                    | Type            |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------- |
| A   | "Benchmark" confusing, >100%         | Benchmark is a hardcoded 19 pts/dim/scenario constant, and ratios are uncapped in most renderers                         | Wording + clamp |
| B   | Book recs lack variety               | Recommendations are hardcoded strings selected by deterministic profile branches                                         | Content         |
| C   | Rank "2/3" but one visible           | Rank/total computed against the **full culture store**; list rendered from a **different, top-10 store**                 | Logic           |
| D   | R1/R2 mixed on leaderboard           | `round` is persisted but never used as a filter/split key                                                                | Logic           |
| E   | No R2 improvement in culture         | Culture analysis groups by cohort only; no round dimension exists                                                        | Feature gap     |
| F   | "What the data shows" messy          | Renderer emits `.culture-observation-card` classes that have **no CSS**                                                  | Missing CSS     |
| G   | No LEAD cohort segmentation          | Code is correct (harness passes); section is **suppressed by a data guard** (<3 course players)                          | Data/guard      |
| H   | Registration no scroll, title cut    | `body{overflow:hidden}` + centred screen with no `overflow-y:auto` override                                              | CSS             |
| I   | Morale too easy; growth jumps at end | `applyLEADMultipliers()` runs **once at endGame**, applying 1.35×/1.15× team-health multiplier to the final growth total | Scoring         |

---

## Issue A — "Benchmark" language is confusing and percentages exceed 100%

### Root cause

The word "benchmark" is used throughout the UI and reports to describe a **hardcoded target constant**, not a cohort average or a maximum. Because the ratio `score / benchmark` is **not clamped** in most renderers, a strong player can display values like `142% of benchmark`.

### Evidence

- The constant is defined once: [`lead-constants.js`](v2/lead-constants.js:49) — `benchmarkPerScenario: 19`. With `round1Scenarios: 9` and `round2Scenarios: 6`, cumulative benchmarks are `171` (R1) and `114` (R2) via [`cumulativeBenchmarkForRound()`](v2/lead-constants.js:86).
- The benchmark is deliberately set at ~70% of the per-scenario maximum, i.e. "good but not perfect" — see the comment at [`game-engine.js`](v2/game-engine.js:2360).
- Uncapped percentage rendering (examples):
  - [`executive-summary-generator.js`](v2/executive-summary-generator.js:538) — `(leadRatio * 100).toFixed(0)}% of benchmark`
  - [`executive-summary-generator.js`](v2/executive-summary-generator.js:547), [`:560`](v2/executive-summary-generator.js:560), [`:572`](v2/executive-summary-generator.js:572), [`:580`](v2/executive-summary-generator.js:580)
  - [`executive-summary-generator.js`](v2/executive-summary-generator.js:597), [`:604`](v2/executive-summary-generator.js:604), [`:611`](v2/executive-summary-generator.js:611), [`:618`](v2/executive-summary-generator.js:618), [`:654`](v2/executive-summary-generator.js:654)
- A clamp helper **already exists** but is only used in some places: [`clampPercent()`](v2/executive-summary-generator.js:97) and the comment "cap the displayed percentage at 100" at [`executive-summary-generator.js`](v2/executive-summary-generator.js:884).
- ~80 occurrences of "benchmark" across `.js`; 1 CSS class `.culture-lead-benchmark` at [`culture-dashboard-styles.css`](v2/culture-dashboard-styles.css:326).

### Minimal recommended fix

1. **Wording:** Replace user-facing "benchmark" with plain facts, e.g. `"LEAD score: 142 / 171 target"` or `"Above target (142 of 171)"`. Keep the internal identifier `benchmarkPerScenario` unchanged to avoid a wide refactor.
2. **Clamp:** Route every `leadRatio * 100` through the existing [`clampPercent()`](v2/executive-summary-generator.js:97) so no displayed percentage exceeds 100%, and show the raw score alongside the capped percentage so information is not lost.

---

## Issue B — Feedback book recommendations lack variety

### Root cause

Recommendations are **hardcoded string literals** embedded in the scoring engine and summary generator. Selection is deterministic: the same profile conditions always yield the same small set of books, so most players see _Five Dysfunctions_, _Thinking in Bets_, and _Coaching Habit_.

### Evidence

- Hardcoded recommendation strings in [`scoring.js`](v2/scoring.js:3517) (`generateRecommendations`) at lines [3216](v2/scoring.js:3216), [3225](v2/scoring.js:3225), [3228](v2/scoring.js:3228), [3254](v2/scoring.js:3254), [3283](v2/scoring.js:3283), [3331](v2/scoring.js:3331), [3356](v2/scoring.js:3356), [3360](v2/scoring.js:3360), [3368](v2/scoring.js:3368), [3381](v2/scoring.js:3381), [3401](v2/scoring.js:3401), [3410](v2/scoring.js:3410), [3412](v2/scoring.js:3412), [3414](v2/scoring.js:3414), [3425](v2/scoring.js:3425), [3447](v2/scoring.js:3447), [3453](v2/scoring.js:3453), [3468](v2/scoring.js:3468), [3470](v2/scoring.js:3470), [3480](v2/scoring.js:3480), [3525](v2/scoring.js:3525), [3532](v2/scoring.js:3532), [3540](v2/scoring.js:3540), [3553](v2/scoring.js:3553).
- Additional hardcoded rec at [`executive-summary-generator.js`](v2/executive-summary-generator.js:999).
- Distinct titles currently in rotation: _The Five Dysfunctions of a Team_ (Lencioni), _Thinking in Bets_ (Duke), _The Coaching Habit_ (Stanier), _Primal Leadership_ (Goleman), _The Lean Startup_ (Ries), _Antifragile_ (Taleb), _Grit_ (Duckworth), _Good to Great_ (Collins), _Playing to Win_ (Lafley).
- Selection is driven by profile conditions (dominant Goleman style, LEAD gaps, attrition) — see [`getCriticalImprovement()`](v2/scoring.js:3150) and [`generateRecommendations()`](v2/scoring.js:3517).

### Minimal recommended fix

1. Extract the book list into a **data table** (e.g. `v2/recommendations-data.js`) keyed by `{ dimension, dominantStyle, severity }`, with **3–5 titles per bucket**.
2. Select deterministically-but-varied, e.g. index by `hash(runId + dimension) % bucket.length`, so different runs surface different books while remaining reproducible.
3. Add a short "why this book" line per title so the recommendation reads as tailored rather than canned.

---

## Issue C — Leaderboard rank is wrong / stale ("2/3" while only one entry is visible)

### Root cause

The **rank and total are computed against a different dataset than the one displayed**:

- Rank/total use the **full culture store** (`jcb_culture_data`), filtered by the game-engine's permissive `isPubliclyDisplayable`.
- The visible list uses the **top-10 slice of `jcb_leaderboard`**.

The two stores diverge (stale, legacy, duplicate, or grandfathered records), so `total` can be 3 while only 1 row renders.

### Evidence

- Rank computation in [`saveToLeaderboard()`](v2/game-engine.js:417):
  - `const cohort = this.getCultureData();` → full store ([`game-engine.js`](v2/game-engine.js:474))
  - `const publicCohort = cohort.filter(isPubliclyDisplayable)` ([`game-engine.js`](v2/game-engine.js:480))
  - `total: publicCohort.length` ([`game-engine.js`](v2/game-engine.js:489))
- Display path in [`loadLeaderboard()`](v2/game-engine.js:114): `getDisplayableLeaderboard().slice(0, 10)` ([`game-engine.js`](v2/game-engine.js:123)); rank rendered as `index + 1` ([`game-engine.js`](v2/game-engine.js:157)).
- Store accessors differ: [`getLeaderboardData()`](v2/game-engine.js:288) vs [`getDisplayableLeaderboard()`](v2/game-engine.js:302) vs [`getCultureData()`](v2/game-engine.js:317).
- **Consent predicate mismatch:**
  - Game-engine grandfathers no-consent records as displayable — [`isPubliclyDisplayable()`](v2/game-engine.js:217).
  - Culture-analysis requires explicit `consent === true` — [`culture-analysis.js`](v2/culture-analysis.js:45) and [`results-store.js`](v2/results-store.js:178).
- Reconciliation exists but is not authoritative for ranking: [`reconcileCultureData()`](v2/game-engine.js:354).

### Minimal recommended fix

Compute rank and total from the **same canonical, deduplicated, consent-filtered set** that the leaderboard renders. Concretely: build one `displayableRecords` array (dedupe by [`dedupeKey()`](v2/results-store.js:245), filter by the **strict** consent predicate), derive both `total` and the visible slice from it, and use it for rank. This removes the store divergence and the predicate mismatch in one change.

---

## Issue D — Leaderboard must separate Round 1 and Round 2

### Root cause

`round` **is** persisted on every record, but the leaderboard never uses it as a filter or grouping key, so R1 (9 scenarios, benchmark 171) and R2 (6 scenarios, benchmark 114) are ranked together — apples vs oranges.

### Evidence

- `round` is written on save: [`game-engine.js`](v2/game-engine.js:3647) — `round: this.state.round`.
- Round is tracked in state: [`game-engine.js`](v2/game-engine.js:11) (`round: 1`) and set in [`startRound()`](v2/game-engine.js:812).
- [`loadLeaderboard()`](v2/game-engine.js:114) and [`compareLeaderboardRecords()`](v2/game-engine.js:85) sort by growth/leadTotal/timestamp/runId — **no round key**.
- Round-aware scenario counts already exist: [`scenarioCountForRound()`](v2/lead-constants.js:86) and `isRound2Run` at [`scoring.js`](v2/scoring.js:1506).

### Minimal recommended fix

1. Add a `round` filter to [`loadLeaderboard()`](v2/game-engine.js:114) and render two tabs/sections ("Round 1", "Round 2").
2. Extend [`compareLeaderboardRecords()`](v2/game-engine.js:85) to sort within a round group only.
3. For R2, show the **adaptation bonus** ([`calculateAdaptationBonus()`](v2/scoring.js:1840)) as a secondary column so R2 is judged on improvement, not raw totals.

---

## Issue E — Culture analysis must show Round 2 improvement (LEAD attributes)

### Root cause

Culture analysis has **no round dimension**. [`analyzeCohortSegments()`](v2/culture-analysis.js:524) groups by `leadCohort` only, and [`computeCohortDeltas()`](v2/culture-analysis.js:590) compares course vs non-course — never R1 vs R2 for the same player.

### Evidence

- [`analyzeCulture()`](v2/culture-analysis.js:88) builds `cohorts` from [`analyzeCohortSegments()`](v2/culture-analysis.js:122); no round parameter.
- [`analyzeCohortSegments()`](v2/culture-analysis.js:524) groups by cohort key; `sufficient` requires `players.length >= minSegmentSize` ([`culture-analysis.js`](v2/culture-analysis.js:540)).
- LEAD aggregation is per-cohort, not per-round: [`leadAvg`](v2/culture-analysis.js:542).
- The R1→R2 linkage already exists elsewhere: [`findPriorRound1Record()`](v2/executive-summary-generator.js:309) and [`calculateAdaptationBonus()`](v2/scoring.js:1840) (two axes: weakest-dimension improvement, style-balance improvement).

### Minimal recommended fix

1. Add a `computeRoundImprovement(cohort)` method that pairs each player's R2 record with their R1 record (reuse [`findPriorRound1Record()`](v2/executive-summary-generator.js:309) logic) and averages the per-dimension LEAD delta.
2. Surface a "Round 2 Improvement" block in [`renderCultureDashboard()`](v2/game-engine.js:4934) and [`_buildCultureReportHtml()`](v2/game-engine.js:4568) showing mean Δ per LEAD dimension and the mean adaptation bonus.
3. Guard with the same `minSegmentSize` rule so small samples are suppressed.

---

## Issue F — Culture summary "What the data shows" looks messy

### Root cause

The renderer emits `.culture-observation-card` and `.culture-observation-category` elements, but **no CSS rules exist for those classes**. The cards therefore inherit default block flow with no spacing, borders, or padding — hence the messy appearance.

### Evidence

- Renderer output: [`renderCultureDashboard()`](v2/game-engine.js:4934) emits observation cards at [`game-engine.js`](v2/game-engine.js:5086)–[`5098`](v2/game-engine.js:5098).
- Report equivalent: "What the Data Shows" section at [`game-engine.js`](v2/game-engine.js:4863)–[`4881`](v2/game-engine.js:4881).
- CSS audit of [`culture-dashboard-styles.css`](v2/culture-dashboard-styles.css:1): only `.culture-section` ([line 161](v2/culture-dashboard-styles.css:161)) and `.culture-rec-card` ([line 470](v2/culture-dashboard-styles.css:470)) exist. **No `.culture-observation-card` / `.culture-observation-category` definitions.**

### Minimal recommended fix

Add CSS for the two missing classes in [`culture-dashboard-styles.css`](v2/culture-dashboard-styles.css:1): card padding (`1rem`), `border-radius`, a subtle border/background, `margin-bottom: 0.75rem`, and a distinct uppercase category label. This is a pure-CSS change and does not touch `.js`/`.html`.

---

## Issue G — No LEAD cohort segmentation on the culture dashboard

### Root cause

**The code is correct.** The Node harness [`_verify_cohort_segmentation.js`](v2/_verify_cohort_segmentation.js:1) passes every test, including _"(d) culture report + dashboard render cohort section"_ and _"(g) backwards compatibility"_. The section is **suppressed by a data guard**: it only renders when at least one non-`none` cohort segment has `sufficient === true` (≥ `minSegmentSize = 3` players). With fewer than 3 course participants, `hasCourseData` is false and the whole block is hidden.

### Evidence

- Harness run: `node v2/_verify_cohort_segmentation.js` → all PASS, including dashboard and report cohort-section assertions ([`_verify_cohort_segmentation.js`](v2/_verify_cohort_segmentation.js:604), [`:639`](v2/_verify_cohort_segmentation.js:639)).
- Dashboard guard: `const hasCourseData = cohortCards.some(c => c.key !== "none")` at [`game-engine.js`](v2/game-engine.js:5066); `cohortCards` is built from segments already filtered by `sufficient === true` ([`game-engine.js`](v2/game-engine.js:5059)).
- Report guard: `hasCourseData = cohortRows.some(c => c.key !== "none")` at [`game-engine.js`](v2/game-engine.js:4830).
- `sufficient` threshold: [`culture-analysis.js`](v2/culture-analysis.js:540) — `players.length >= this.minSegmentSize`; `minSegmentSize = 3` at [`culture-analysis.js`](v2/culture-analysis.js:11).
- `leadCohort` **is** persisted correctly: [`game-engine.js`](v2/game-engine.js:3620) — `leadCohort: this.state.leadCohort`; read back by [`leadCohortOf()`](v2/results-store.js:164) and [`leadCohortOf()`](v2/culture-analysis.js:74).

### Minimal recommended fix

This is a **data/UX** issue, not a code bug. Options (pick one):

1. **Lower `minSegmentSize`** to 2 for the course segment only, or
2. **Render a placeholder** when `hasCourseData` is false, e.g. _"LEAD course cohort comparison will appear once 3+ course participants have completed the game (currently N)."_
   Option 2 is preferred: it preserves statistical validity while removing the "missing feature" perception.

---

## Issue H — Registration page has no scroll; title is cut off

### Root cause

`body` is locked to the viewport (`overflow: hidden; height: 100vh`), and `.screen.active` centres its content vertically. The registration screen has **no `overflow-y: auto` override**, so on short viewports the centred container overflows and is clipped — the title is cut off and the user must zoom to 80%.

### Evidence

- Global lock: [`styles.css`](v2/styles.css:23) — `body { overflow: hidden; height: 100vh; width: 100vw; }` (lines [19–26](v2/styles.css:19)).
- Screen layout: `.screen { height: 100%; position: absolute; }` ([`styles.css`](v2/styles.css:35)) and `.screen.active { justify-content: center; }` ([`styles.css`](v2/styles.css:49)).
- Registration markup: [`index.html`](v2/index.html:80) (`#registration-screen`) with `.registration-container` at [`index.html`](v2/index.html:81); styles at [`styles.css`](v2/styles.css:330).
- The **correct pattern already exists** for results: `#results-screen { overflow-y: auto; justify-content: flex-start !important; }` at [`styles.css`](v2/styles.css:1554)–[`1561`](v2/styles.css:1561).

### Minimal recommended fix

Mirror the results-screen pattern for registration:

```css
#registration-screen {
  overflow-y: auto;
  justify-content: flex-start !important;
  padding: 2rem 1rem;
}
```

Also add `align-items: flex-start` to the container so the title is never clipped. Pure CSS; no `.js`/`.html` change.

---

## Issue I — Scoring mechanics: morale too easy, growth jumps to 34% at the end _(MOST IMPORTANT)_

### Root cause

Two independent mechanics combine:

1. **Growth is multiplied only once, at the very end.** [`applyLEADMultipliers()`](v2/game-engine.js:2355) is invoked exactly once, from [`endGame()`](v2/game-engine.js:2810). It applies a **team-health multiplier of 1.35×** (or 1.15×) to the _final_ growth total, plus an excess-morale productivity bonus. During play, growth accumulates linearly and looks low; at `endGame` it is scaled up in one step — the "low low low then jumps to 34%" effect.

2. **Morale is easy to keep high.** Morale starts at 65, drifts toward a baseline of 60/70, and the per-decision gains outweigh the losses, so it rarely falls.

### Evidence

- Single call site: [`applyLEADMultipliers()`](v2/game-engine.js:2355) called at [`game-engine.js`](v2/game-engine.js:2810) inside [`endGame()`](v2/game-engine.js:2775).
- Team-health multiplier: **1.35×** at [`game-engine.js`](v2/game-engine.js:2570)–[`2583`](v2/game-engine.js:2583); **1.15×** at [`game-engine.js`](v2/game-engine.js:2584)–[`2592`](v2/game-engine.js:2592).
- Excess-morale productivity bonus: [`game-engine.js`](v2/game-engine.js:2631)–[`2637`](v2/game-engine.js:2637).
- Growth accumulation and morale drift: [`applyImpacts()`](v2/game-engine.js:2131); morale drift toward baseline at [`game-engine.js`](v2/game-engine.js:2166)–[`2177`](v2/game-engine.js:2177); one-dimensional drag at [`game-engine.js`](v2/game-engine.js:2242)–[`2271`](v2/game-engine.js:2271); delayed payoffs at [`game-engine.js`](v2/game-engine.js:2273)–[`2327`](v2/game-engine.js:2327); bounds at [`game-engine.js`](v2/game-engine.js:2334)–[`2351`](v2/game-engine.js:2351).
- State init: `growth: 0`, `morale: 65`, `profitMargin: 28`, `attrition: 10`, `organizationalCapability: 75` at [`game-engine.js`](v2/game-engine.js:11).
- Finale awards: [`scoreYearEnd()`](v2/scoring.js:1345) grants growth +2.7/+1.3, morale +8/+10/+15, capability +15.
- Growth target for win conditions: `growthTarget: 15`, `minGrowthFloor: 10` at [`lead-constants.js`](v2/lead-constants.js:21); win paths at [`scoring.js`](v2/scoring.js:1701)–[`1742`](v2/scoring.js:1742).

### Quantified play-through analysis

Assumptions: R1 = 9 scenarios; per-scenario growth contribution ≈ +1.5 to +2.5 for good decisions; morale starts 65.

| Player archetype                    | In-play growth (pre-multiplier) | End multiplier           | Final growth | Morale trajectory               | Outcome                              |
| ----------------------------------- | ------------------------------- | ------------------------ | ------------ | ------------------------------- | ------------------------------------ |
| **Balanced high-LEAD**              | ~13–16                          | 1.35× (team health high) | **~18–22**   | 65 → 72–78 (gains dominate)     | Growth win + morale win — _too easy_ |
| **One-dimensional** (maxes one dim) | ~10–13                          | 1.15× (team health mid)  | **~12–15**   | 65 → 62–68 (drag offsets gains) | Borderline growth; morale stable     |
| **Poor-decision**                   | ~4–7                            | 1.15× or penalty         | **~5–8**     | 65 → 50–58 (losses dominate)    | Growth loss; morale loss             |

The **1.35× end multiplier alone** turns a mid-pack 13 into ~18 — enough to cross the `growthTarget: 15` win line. That is the single largest contributor to "growth jumps at the end". Morale's drift-toward-70 baseline plus net-positive decision deltas means even mediocre players finish above the 65 start.

### Minimal recommended fix (tuning only — no structural rewrite)

1. **Amortise the team-health multiplier.** Instead of applying 1.35× once at `endGame`, apply a per-scenario factor (e.g. `1 + (0.35 / scenarioCount)`) inside [`applyImpacts()`](v2/game-engine.js:2131). Growth then rises smoothly and the end-of-game jump disappears.
2. **Cap the end multiplier** at ~1.15× and move the remainder into per-decision rewards, so the finale is a nudge, not a cliff.
3. **Rebalance morale drift** in [`applyImpacts()`](v2/game-engine.js:2166): lower the upper baseline from 70 to ~66 and increase the magnitude of negative morale deltas so poor decisions actually bite.
4. **Raise `growthTarget`** from 15 to ~18 (or lower per-decision growth by ~15%) so the balanced archetype no longer auto-wins.
5. Re-run the existing harnesses after tuning to confirm no regression.

---

## Verification performed

- Executed `node v2/_verify_cohort_segmentation.js` → **all tests PASS**, including:
  - `PASS dashboard contains 'By LEAD Course Cohort'`
  - `PASS culture report contains 'By LEAD Course Cohort'`
  - `PASS (g) backwards compatibility`
    This isolates Issue G as a **data/guard** problem, not a code defect.

## Files referenced (no modifications made)

- [`v2/lead-constants.js`](v2/lead-constants.js:1)
- [`v2/scoring.js`](v2/scoring.js:1)
- [`v2/game-engine.js`](v2/game-engine.js:1)
- [`v2/culture-analysis.js`](v2/culture-analysis.js:1)
- [`v2/results-store.js`](v2/results-store.js:1)
- [`v2/executive-summary-generator.js`](v2/executive-summary-generator.js:1)
- [`v2/styles.css`](v2/styles.css:1)
- [`v2/culture-dashboard-styles.css`](v2/culture-dashboard-styles.css:1)
- [`v2/index.html`](v2/index.html:1)
- [`v2/_verify_cohort_segmentation.js`](v2/_verify_cohort_segmentation.js:1)
