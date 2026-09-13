# JCB Leadership Challenge — Design-Intent Audit Report

**Scope:** Read-only audit of the v2 game against the stated design intent.
**Files audited:** [`v2/scoring.js`](v2/scoring.js), [`v2/game-engine.js`](v2/game-engine.js), [`v2/scenarios.js`](v2/scenarios.js), [`v2/culture-analysis.js`](v2/culture-analysis.js), [`v2/executive-summary-generator.js`](v2/executive-summary-generator.js), [`v1/LEAD_North_Star.txt`](v1/LEAD_North_Star.txt), plus [`v2/app.js`](v2/app.js) and [`v2/index.html`](v2/index.html) for wiring.
**Constraint honoured:** No `.js` or `.html` file was modified. This report is the only artefact.

---

## 1. Design Intent (restated)

The product owner's intent is that the game must:

1. Showcase what was learned on the leadership course (LEAD attributes are _promoted/hero_ attributes, not the whole intent).
2. Deliver an authentic learning takeaway.
3. Score **operationally in-play** — every decision changes the score in a **plausible** way.
4. Link **feedback correctly to decisions** (not generic/random).
5. Score **end-of-game in line with intent** — win by playing with LEAD attributes using a **balanced approach adapted to the scenario**.
6. Be **harder to win** with inappropriate or **one-dimensional** decisions.
7. Keep **all mechanics plausible** at all times.

---

## 2. Executive Verdict

**Overall: the mechanics substantially meet the design intent, but there are several concrete defects — one Critical — that undermine specific intent clauses.**

The architecture is genuinely decision-driven: [`ScoringEngine.calculateDecisionImpact()`](v2/scoring.js:15) dispatches per-scenario scoring, [`GameEngine.applyDecisionImpact()`](v2/game-engine.js:1715) applies it with secondary effects, and [`GameEngine.applyLEADMultipliers()`](v2/game-engine.js:1976) layers LEAD-driven bonuses/penalties before [`ScoringEngine.calculateFinalScore()`](v2/scoring.js:1441). The five-tier win system, the LEAD quality floor, and the balance requirement together make one-dimensional play genuinely harder to win with. This is a strong foundation.

However:

- **Critical:** the "Most Important Improvement" extraction is **broken** — the regex looks for an emoji that the feedback generator never emits, so the scoreboard always shows a generic fallback. This directly violates intent clause 4 (feedback correctly linked to decisions).
- **High:** the LEAD score breakdown and the critical-improvement benchmark are **not round-aware**, so Round 2 players see inflated/incorrect percentages and wrong gap feedback.
- **High:** the numerical `qualityScore` is **not normalised** to the LEAD cap, so it can exceed its intended 0–100 range and distort the final score.
- **High:** multiple **threshold divergences** between [`scoring.js`](v2/scoring.js) and [`executive-summary-generator.js`](v2/executive-summary-generator.js) mean the same player can be described as "exceptional" in one place and merely "strong" in another.
- **Medium/Low:** dead `scoreTemplates` data, hardcoded "Target was 15%" strings, and a balance-threshold inconsistency in feedback.

---

## 3. Findings by Priority

### CRITICAL

#### C1 — "Most Important Improvement" is never extracted (feedback not linked to decisions)

- **Where:** [`GameEngine.extractCriticalImprovement()`](v2/game-engine.js:3371) vs [`ScoringEngine.generateFeedback()`](v2/scoring.js:2733).
- **Evidence:** The extractor matches:
  ```js
  /🎯 Most Important Improvement:<\/h4>[\s\S]*?<p[^>]*>(.*?)<\/p>/;
  ```
  but the generator emits:
  ```js
  '<h4 style="color: var(--jcb-yellow);">⚠️ Most Important Improvement:</h4>';
  ```
  The emoji differs (`🎯` vs `⚠️`), so the regex **never matches**. The function always returns the fallback `"Continue developing balanced leadership"` ([`v2/game-engine.js:3398`](v2/game-engine.js:3398)).
- **Impact:** The single most important personalised development message — the one intended to link the player's decisions to their biggest weakness — is discarded and replaced with a generic string on the scoreboard. This is a direct violation of intent clause 4.
- **Change needed:** Align the regex with the emitted markup (match `⚠️ Most Important Improvement:`), or better, have `generateFeedback()` return the improvement text as a structured field on `results` rather than re-parsing HTML. Prefer the structured approach to remove the fragile coupling.

---

### HIGH

#### H1 — LEAD score breakdown maximums are not round-aware

- **Where:** [`GameEngine.renderLEADScoreBreakdown()`](v2/game-engine.js:3299).
- **Evidence:** `maximums = { leadership: 401, excellence: 450, agility: 233, determination: 318 }` are explicitly documented as "9 scenarios" values ([`v2/game-engine.js:3300-3303`](v2/game-engine.js:3300)). In Round 2 (6 scenarios) the true maximums are two-thirds of these, so every "% of maximum" shown to a Round 2 player is **understated by ~33%** (e.g. a genuine 60% reads as 40%).
- **Impact:** Round 2 players receive a misleading picture of their LEAD performance, contradicting intent clause 5 (end-of-game scoring in line with intent) and clause 7 (plausibility).
- **Change needed:** Make `maximums` round-aware (scale by `scenarioCount / 9`), mirroring the round-aware divisor already used in [`calculateFinalScore()`](v2/scoring.js:1477).

#### H2 — `getCriticalImprovement()` uses a fixed 9-scenario benchmark

- **Where:** [`ScoringEngine.getCriticalImprovement()`](v2/scoring.js:2828).
- **Evidence:** `leadBenchmarks = { leadership: 171, excellence: 171, agility: 171, determination: 171 }` — the Round 1 cumulative target. For Round 2 the cumulative target is 114 ([`v2/scoring.js:1476`](v2/scoring.js:1476)). The comment at [`v2/scoring.js:2823`](v2/scoring.js:2823) claims it is "unified with calculateFinalScore()", but `calculateFinalScore()` is round-aware while this is not.
- **Impact:** Round 2 players are told they have a large LEAD gap (e.g. "Leadership capability is 57 points below benchmark") when they may in fact be at or above the correct 114 benchmark. This is incorrect, decision-linked feedback (intent clause 4) and a plausibility failure (clause 7).
- **Change needed:** Derive the benchmark from `gameState.round` (171 for R1, 114 for R2), or compute it as `scenarioCount * 19`.

#### H3 — `qualityScore` is not normalised to the LEAD cap

- **Where:** [`ScoringEngine.calculateNumericalScore()`](v2/scoring.js:3247).
- **Evidence:**
  ```js
  const qualityScore =
    (gameState.leadership / 100) * 25 +
    (gameState.excellence / 100) * 25 +
    (gameState.agility / 100) * 25 +
    (gameState.determination / 100) * 25;
  ```
  Each LEAD dimension is capped at **250** ([`v2/game-engine.js`](v2/game-engine.js) LEAD caps), not 100. So each term can reach `(250/100)*25 = 62.5`, and `qualityScore` can reach **250** instead of the intended 0–100. It is then weighted at 15% in the final score ([`v2/scoring.js:3254`](v2/scoring.js:3254)).
- **Impact:** The "quality" component can contribute up to ~37.5 points instead of the intended ~15, silently over-weighting LEAD quality relative to growth/team/balance. This distorts the final numerical score and the leaderboard ordering — a plausibility and consistency failure (clauses 5 and 7).
- **Change needed:** Normalise each dimension against its true maximum (250) or against the round-aware benchmark, so `qualityScore` is bounded 0–100 before weighting.

#### H4 — Threshold divergence between scoring and the executive summary

- **Where:** [`ExecutiveSummaryGenerator.calculateOverallAssessment()`](v2/executive-summary-generator.js:398) and [`calculateBusinessImpact()`](v2/executive-summary-generator.js:745) vs [`scoring.js`](v2/scoring.js:1574).
- **Evidence:**
  | Concept | [`scoring.js`](v2/scoring.js) | [`executive-summary-generator.js`](v2/executive-summary-generator.js) |
  |---|---|---|
  | "Exceptional" LEAD | `exceptionalLEAD = avgLEADRatio >= 0.78` ([`:1574`](v2/scoring.js:1574)) | `leadRatio >= 0.85` ([`:398`](v2/executive-summary-generator.js:398), [`:745`](v2/executive-summary-generator.js:745)) |
  | "Strong" LEAD | `strongLEAD = >= 0.5` ([`:1575`](v2/scoring.js:1575)) | `>= 0.7` ([`:747`](v2/executive-summary-generator.js:747)) |
  | Balance "well" | `wellBalanced = <= 50` ([`:1584`](v2/scoring.js:1584)) | `maxStyle >= 70` overuse ([`:580`](v2/executive-summary-generator.js:580)) |
- **Impact:** A player who wins via the Excellence Path at `avgLEADRatio = 0.80` is "exceptional" to the scoring engine but only "Strong (70%+)" in the executive summary, and may not reach "HIGH POTENTIAL". The same run is described inconsistently across artefacts — a cross-file consistency failure (intent clause 6) that erodes trust in the feedback.
- **Change needed:** Define the LEAD tier thresholds once (a shared constant/module) and consume them in both files. At minimum, reconcile 0.78 vs 0.85 and 0.5 vs 0.7.

---

### MEDIUM

#### M1 — Balance threshold inconsistency inside feedback

- **Where:** [`ScoringEngine.getCriticalImprovement()`](v2/scoring.js:2961).
- **Evidence:** `isBalancedPlay = maxStylePercentage < 35`, while the canonical balance thresholds elsewhere are 50 (well), 60 ([`isBalancedLeadership()`](v2/scoring.js:1764)), and 70 ([`meetsBalanceRequirement`](v2/scoring.js:1561)). The comment at [`v2/scoring.js:2959`](v2/scoring.js:2959) acknowledges this is a heuristic.
- **Impact:** The "balanced but fell short on growth" feedback branch fires for a much narrower band than the game's own definition of balanced, so genuinely balanced players (35–60% dominant style) can receive a different, less apt message. Feedback is not reliably linked to the actual balance state (clause 4).
- **Change needed:** Use the canonical `results.meetsBalanceRequirement` / `isBalancedLeadership()` thresholds rather than a bespoke 35% cut-off.

#### M2 — `getLeadFeedback()` uses absolute thresholds against a 250-point scale

- **Where:** [`GameEngine.getLeadFeedback()`](v2/game-engine.js:3781).
- **Evidence:** `const category = score >= 60 ? "high" : score >= 30 ? "medium" : "low";` — but LEAD dimensions accumulate across 9 scenarios and are capped at 250. A score of 60 is only ~24% of the cap and ~35% of the 171 benchmark, yet is labelled "high".
- **Impact:** The per-dimension narrative in the detailed feedback view ([`v2/game-engine.js:3571`](v2/game-engine.js:3571) etc.) can praise a dimension as "high" when it is objectively weak against the benchmark — inconsistent with the rest of the scoring (clause 6) and misleading (clause 7).
- **Change needed:** Convert the raw score to a ratio against the round-aware benchmark (or the 250 cap) before selecting the category, and reuse the same tier thresholds as the rest of the system.

#### M3 — Hardcoded "Target was 15%" strings

- **Where:** [`GameEngine.showOutcome()`](v2/game-engine.js:2987) and [`GameEngine.viewDetailedFeedback()`](v2/game-engine.js:3596).
- **Evidence:** Both embed the literal text `"Target was 15%"` / `"(Target: 15%)"` rather than reading the canonical `meetsGrowth` threshold (`gameState.growth >= 15`, [`v2/scoring.js:1588`](v2/scoring.js:1588)).
- **Impact:** Low functional risk today, but any future rebalance of the growth target would leave the UI stating a stale number — a latent consistency/plausibility defect (clauses 6 and 7).
- **Change needed:** Source the target from a single shared constant.

#### M4 — Dead `scoreTemplates` data in scenarios

- **Where:** [`v2/scenarios.js`](v2/scenarios.js:132), [`:340`](v2/scenarios.js:340), [`:578`](v2/scenarios.js:578), [`:706`](v2/scenarios.js:706), [`:943`](v2/scenarios.js:943), [`:1101`](v2/scenarios.js:1101).
- **Evidence:** A repo-wide search for `scoreTemplates` returns matches **only** in `scenarios.js` — the property is never read by [`scoring.js`](v2/scoring.js) or [`game-engine.js`](v2/game-engine.js). It is also present on only some scenarios (absent from `data_dilemma`, `ambiguous_signal`, `difficult_conversation`).
- **Impact:** Dead data that documents an _older_ scoring model (e.g. `punitive: { morale: -15, attrition: 12 }`) which no longer matches the live scoring in [`scoring.js`](v2/scoring.js). This is a maintenance trap and a divergence risk (clause 6): a future editor could "fix" the templates believing they drive behaviour.
- **Change needed:** Remove the unused `scoreTemplates` blocks, or wire them in and delete the duplicated logic in `scoring.js`. Do not leave both.

---

### LOW

#### L1 — Inconsistent scenario numbering comments

- **Where:** [`v2/scenarios.js`](v2/scenarios.js) (e.g. "SCENARIO 4: THE TALENT EXODUS" appears after a scenario labelled SCENARIO 5; "SCENARIO 6: THE YEAR-END RECKONING" after one labelled SCENARIO 8).
- **Impact:** Cosmetic only; no runtime effect. Hinders navigation during maintenance.
- **Change needed:** Renumber the comments to match array order.

#### L2 — Illustrative benchmark figures in the executive summary

- **Where:** [`ExecutiveSummaryGenerator.generateComparisonToBenchmarks()`](v2/executive-summary-generator.js:1538).
- **Evidence:** When no cohort exists, the method uses illustrative figures (e.g. 68%, 82%). They are labelled illustrative, and the culture dashboard correctly states "there is no external benchmark" ([`v2/game-engine.js:4207`](v2/game-engine.js:4207)).
- **Impact:** Low, but presenting invented percentages alongside real player data risks being read as a real benchmark — a mild plausibility concern (clause 7).
- **Change needed:** Ensure the illustrative nature is unmistakable in the rendered output, or suppress the comparison entirely when no cohort is present.

#### L3 — Debug helpers exposed on `window`

- **Where:** [`v2/app.js`](v2/app.js:104) (`window.debugGame`, `window.skipToResults`, `window.setMetrics`).
- **Impact:** `window.skipToResults` and `window.setMetrics` allow a player to bypass or fabricate the game state from the console — an exploitability/plausibility risk (clause 7) in a kiosk/leaderboard context.
- **Change needed:** Gate these behind a debug flag or remove them for production builds.

---

## 4. Assessment Against Each Intent Clause

| #   | Intent clause                                       | Verdict        | Key evidence                                                                                                                                             |
| --- | --------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Showcase course learning (LEAD as hero attributes)  | **Met**        | LEAD drives win paths, multipliers, and feedback throughout [`scoring.js`](v2/scoring.js)                                                                |
| 2   | Authentic learning takeaway                         | **Mostly met** | Rich, book-referenced feedback in [`getCriticalImprovement()`](v2/scoring.js:2809); undermined by C1                                                     |
| 3   | Operational in-play scoring, plausible per decision | **Met**        | [`calculateDecisionImpact()`](v2/scoring.js:15) → [`applyDecisionImpact()`](v2/game-engine.js:1715) → [`applyLEADMultipliers()`](v2/game-engine.js:1976) |
| 4   | Feedback correctly linked to decisions              | **Not met**    | C1 (broken extraction), M1, M2                                                                                                                           |
| 5   | End-of-game scoring in line with intent             | **Partly met** | Five-tier win system is sound, but H1/H3 distort displayed and numeric results                                                                           |
| 6   | Cross-file consistency                              | **Not met**    | H2, H4, M2, M4                                                                                                                                           |
| 7   | Plausibility of all mechanics                       | **Mostly met** | Strong core; H1/H2/H3 and L2/L3 introduce implausible or exploitable edges                                                                               |

---

## 5. Recommended Change List (for the implementation mode)

**Critical**

1. Fix [`extractCriticalImprovement()`](v2/game-engine.js:3371) — align the regex with the `⚠️` markup, or (preferred) return the improvement text as a structured `results` field from [`generateFeedback()`](v2/scoring.js:2116).

**High** 2. Make [`renderLEADScoreBreakdown()`](v2/game-engine.js:3294) maximums round-aware. 3. Make [`getCriticalImprovement()`](v2/scoring.js:2828) benchmarks round-aware (171 / 114). 4. Normalise `qualityScore` in [`calculateNumericalScore()`](v2/scoring.js:3247) to a 0–100 range. 5. Reconcile LEAD tier thresholds between [`scoring.js`](v2/scoring.js:1574) and [`executive-summary-generator.js`](v2/executive-summary-generator.js:398) via a shared constant.

**Medium** 6. Replace the bespoke 35% balance heuristic in [`getCriticalImprovement()`](v2/scoring.js:2961) with the canonical balance flags. 7. Make [`getLeadFeedback()`](v2/game-engine.js:3781) ratio-based against the round-aware benchmark. 8. Source the growth target from a shared constant instead of hardcoded "15%" strings ([`v2/game-engine.js:2987`](v2/game-engine.js:2987), [`:3596`](v2/game-engine.js:3596)). 9. Remove or wire up the dead `scoreTemplates` blocks in [`v2/scenarios.js`](v2/scenarios.js:132).

**Low** 10. Renumber scenario comments in [`v2/scenarios.js`](v2/scenarios.js). 11. Make illustrative benchmark figures unmistakable or suppress them without a cohort ([`v2/executive-summary-generator.js:1538`](v2/executive-summary-generator.js:1538)). 12. Gate or remove debug helpers in [`v2/app.js`](v2/app.js:104).

---

## 6. Method & Limitations

- This audit is **static** — it reads source and traces call paths; it does not execute the game or run simulations. Findings about magnitudes (e.g. H3's ~37.5-point contribution) are derived analytically from the code.
- Line numbers refer to the file state at the time of audit and may shift after edits.
- No `.js` or `.html` file was modified; this report is the sole deliverable.
