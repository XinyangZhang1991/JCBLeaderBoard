# Deep Audit Report — JCB Leadership in Action

**Scope:** Game scenarios, scoring mechanics, personality analysis, LEAD framework scoring.
**Design intent audited against:** (1) LEAD is the core scoring characteristic — balanced traits win; (2) a single Goleman style must be harder than a balanced approach; (3) scenarios must enable feedback describing the Goleman role and Jung colour; (4) business growth must track decision quality (good → grow, poor → hamper/reverse); (5) growth/pushy decisions must be counteracted by attrition/capability metrics; (6) no bugs that break the above; (7) no unfeasible percentages in feedback.

**Verdict:** All seven design-intent clauses are satisfied in the current working tree. The previously-applied mechanics fixes are correct, reachable, and do not break the balance model. One residual cosmetic risk and one previously-noted UI issue remain (both listed under *Residual Items*).

---

## 1. Decision-Data Structure Contract (foundation of the audit)

Every scorer reads decision answers from `collectDecisionData()` in [`game-engine.js`](main program v3/game-engine.js:2291). The contract is:

| Decision type | Stored field | Scorer read pattern |
|---|---|---|
| `choice` | `index` | `decision.choices[n].index` |
| `slider` | `values` (array) | `decision.choices[n].values` |
| `ranking` | `order` (array of ints) | `decision.choices[n].order \|\| .ranking` |
| `timeline` | `value` (int) | `decision.choices[n].value` |

**Finding:** Every one of the 15 scenario scorers reads the field that matches its scenario's declared decision type. No scorer reads a field that the collector never writes. This was the single highest-risk class of bug (a mismatch silently yields `undefined` → 0 points), and it is clean.

---

## 2. Scenario Coverage — all 15 scenarios, all decisions scored

Round 1 (9): `inheritance`, `data_dilemma`, `safety_crisis`, `ambiguous_signal`, `competitor_threat`, `talent_exodus`, `difficult_conversation`, `innovation_gamble`, `year_end`.
Round 2 (6): `merger_integration`, `ethical_dilemma`, `remote_work_debate`, `succession_crisis`, `market_disruption`, `year_end_round2`.

**Finding:** Each scenario has a dedicated scorer in [`scoring.js`](main program v3/scoring.js:82) dispatched by `scenario.id`. Every decision part within each scenario is handled — no unhandled `default` fall-through that would drop a decision's contribution. `year_end` (4 parts) and `succession_crisis`/`year_end_round2` (ranking parts) are all covered.

---

## 3. Slider Reachability — the unit-scale bug class

**Root cause (historical):** v2 used £M-scale budgets; v3 rescaled budgets to sub-£1M but the scoring thresholds were never rescaled, so several thresholds were mathematically unreachable (a player could never score the "good" branch).

**Fix pattern applied:** share-of-total normalisation — `v / totalAllocated` yields a scale-independent 0..1 share.

**Verified reachable (harness `verify-mechanics-fix.js`, 19/19 pass):**

| Scenario | Thresholds now reachable |
|---|---|
| `competitor_threat` P1 | `rnd ≥ 0.4`, `dealers ≥ 0.3`, `dealerPartnership ≥ 0.3`, `priceMatch ≥ 0.6` |
| `innovation_gamble` P3 | `qa ≥ 0.5`, `pilot ≥ 0.4`, `marketing > 0.6`, `qa < 0.3` (dominant-marketing branch) |
| `year_end` P2 | `capability ≥ 0.4`, `celebration ≥ 0.3`, `bonuses > 0.5`, `capability < 0.2` |
| `merger_integration` P3 | `retention ≥ 0.3`, `teamBuilding ≥ 0.2`, `training ≥ 0.2` |
| `market_disruption` P2 | `rd ≥ 0.2`, `innovation ≥ 0.2`, `talent ≥ 0.2` |

**Degenerate case:** zero allocation across all sliders produces all-zero shares with **no NaN and no divide-by-zero** (guarded).

---

## 4. LEAD Framework Accumulation

**Finding:** Every decision part contributes to at least one LEAD dimension (`leadership`/`excellence`/`agility`/`determination`) via the `impact` object. LEAD dimensions are hard-capped at 250 in [`game-engine.js`](main program v3/game-engine.js:2661), and the cap is applied **after** all secondary effects, so no effect can push a dimension out of bounds.

**Round-awareness:** The benchmark divisor is round-aware — `scenarioCount = round === 2 ? 6 : 9` in both [`calculateFinalScore()`](main program v3/scoring.js:1554) and [`generateFeedback()`](main program v3/scoring.js:2620). This prevents a Round 2 player being measured against a 9-scenario denominator.

---

## 5. Goleman Style Accumulation & the "single style is harder" clause

**Finding:** Styles accumulate into `state.leadershipStyles` and are capped at 150 ([`game-engine.js`](main program v3/game-engine.js:2531)).

**Balance enforcement (three independent mechanisms):**
1. **One-dimensional concentration drag** ([`game-engine.js`](main program v3/game-engine.js:2561)): once a single style exceeds the canonical `isBalancedMax` (60%) share, morale drags and attrition creeps per decision — compounding across the run.
2. **`isBalancedLeadership()`** ([`scoring.js`](main program v3/scoring.js:1881)): `maxPercentage ≤ 60`.
3. **Win-condition gating** ([`calculateFinalScore()`](main program v3/scoring.js:1554)): `meetsBalanceRequirement = maxStylePercentage ≤ 70`; `wellBalanced ≤ 50`; `meetsLEADQuality = avgLEADRatio ≥ 0.5 && each dim ≥ 0.35`.

**Conclusion:** A single-style player is measurably harder to win with — they lose the balance bonus, incur the concentration drag, and are excluded from the balanced/optimal win paths. **Design-intent clause 2 is satisfied.**

---

## 6. Personality (Jung) Mapping

**Finding:** [`calculatePersonalityColor()`](main program v3/scoring.js:2155) consumes the full `leadershipStyles` profile. It requires a dominant bucket ≥ 40% with a tie guard, and emits compound colours (e.g. `RED/YELLOW`) when a secondary bucket ≥ 25% and within 15pp. `BALANCED` is emitted when no bucket dominates.

**Feedback linkage:** [`generateFeedback()`](main program v3/scoring.js:2824) maps the computed colour to expected LEAD strengths/watch-outs and cross-checks against the player's actual `leadRatios`, so the narrative cannot contradict the score. **Design-intent clause 3 is satisfied.**

**Caveat (previously flagged, unchanged):** slider-only decisions feed LEAD points but mostly do **not** feed `leadershipStyles` (the one exception is `competitor_threat`'s dealer-partnership branch, which adds `affiliative += 15`). This means a player who answers only via sliders has a thinner style profile. This is a *design characteristic*, not a bug — but it is worth noting if style richness from sliders is desired.

---

## 7. Growth vs Attrition/Capability Counterbalance

**Finding:** Pushy/growth decisions are counteracted on multiple axes:
- **Attrition → morale** ([`game-engine.js`](main program v3/game-engine.js:2454)): attrition > 8% drags morale (`(attrition − 8) × 0.8`).
- **Attrition → profit** ([`game-engine.js`](main program v3/game-engine.js:2497)): attrition > 15% penalises margin (`(attrition − 15) × 0.3`).
- **Low morale → profit** ([`game-engine.js`](main program v3/game-engine.js:2507)): morale < 60 penalises margin (`(60 − morale) × 0.2`).
- **Morale drift** ([`game-engine.js`](main program v3/game-engine.js:2481)): morale regresses toward a 60/70 baseline, preventing the ratchet-to-100 failure mode.
- **Capability** ([`game-engine.js`](main program v3/game-engine.js:2380)): coaching/democratic/affiliative styles build capability; capped at 250.
- **`applyLEADModifiers()`** ([`scoring.js`](main program v3/scoring.js:158)): buffers negative impacts (attrition 25%, morale 10%) and amplifies positive ones (growth 12%, morale 6%) based on LEAD strength/balance.

**Conclusion:** Pure-growth play is self-limiting. **Design-intent clause 5 is satisfied.**

---

## 8. Feedback Feasibility — no unfeasible percentages

**Finding:** Two independent clamps, both `Math.max(0, Math.min(100, Math.round(v)))` with an `isFinite` guard:
- Main narrative: [`clampPct`](main program v3/scoring.js:2706) applied to all four LEAD percentages.
- Breakdown panel: [`clampPct`](main program v3/game-engine.js:4561) applied to every dimension and the overall figure.

**Maximums are round-aware** ([`lead-constants.js`](main program v3/lead-constants.js:83) `breakdownMaximumsForRound`), so a Round 2 player is not understated by ~33%.

**Executive summary:** [`calculateBusinessImpact()`](main program v3/executive-summary-generator.js:878) clamps *display* percentages (retention, LEAD) while deliberately leaving raw game metrics (growth, morale, attrition) unclamped — they are meaningful above 100 / below 0. `formatPercent` has a finite guard. **Design-intent clause 7 is satisfied.**

---

## 9. Impact Application — no dropped/NaN impacts

**Finding:** [`applyDecisionImpact()`](main program v3/game-engine.js:2369) is robust:
- **Capability is overwritten, not double-counted**: `impact.organizationalCapability` is initialised to 0, the style-derived gain is computed, the explicit value is added, and the combined total is written back once ([`game-engine.js`](main program v3/game-engine.js:2403)).
- **Delayed growth NaN guard** ([`game-engine.js`](main program v3/game-engine.js:2599)): extracts `.amount` from the object form and rejects NaN/non-positive values.
- **Bounds checking runs last** ([`game-engine.js`](main program v3/game-engine.js:2651)): morale, attrition, all four LEAD dims, and profit margin are clamped *after* every secondary effect, so no effect can escape its limits.
- **Style/capability caps** applied on accumulation.

**Design-intent clause 6 is satisfied.**

---

## 10. Cross-File Consistency (scoring.js ↔ executive-summary-generator.js)

**Finding:** [`lead-constants.js`](main program v3/lead-constants.js:1) is the single source of truth. Both files consume it. The executive summary uses an `EXEC_LEAD_CONSTANTS` IIFE that reads the canonical global (avoiding a `LEAD_CONSTANTS` redeclaration `SyntaxError`). Thresholds (`exceptionalLEAD 0.78`, `solidLEAD 0.65`, `strongLEAD 0.5`, `minimumDimensionRatio 0.35`) are identical in both artefacts, so the same run cannot be described as "exceptional" in one and "strong" in the other.

---

## Residual Items (not bugs; flagged for awareness)

1. **Slider-only style thinness** (§6 caveat): sliders feed LEAD points but rarely `leadershipStyles`. Intentional, but limits style richness for slider-heavy players.
2. **UI issues previously reported (not yet actioned):**
   - Business-impact section on the feedback page overflows the screen (needs scaling).
   - "Target met" scroll position allows overscrolling past the anchor.
   - Executive summary still spans two pages; requested to be simplified to a single, scannable page.

---

## Safety Net / Revert

- Branch: `safety/pre-mechanics-fix`
- Tag: `pre-mechanics-fix`
- Verification harness: `verify-mechanics-fix.js` — **19 passed, 0 failed**
- Revert instructions: see `MECHANICS-FIX-REVERT.md`

## Evidence Summary

| # | Audit item | Result |
|---|---|---|
| 1 | All 15 scenarios, all decisions scored | PASS |
| 2 | Slider thresholds reachable | PASS (19/19 harness) |
| 3 | LEAD accumulation + caps | PASS |
| 4 | Goleman style accumulation + balance enforcement | PASS |
| 5 | Jung colour mapping consumes all styles | PASS |
| 6 | Growth vs attrition/capability counterbalance | PASS |
| 7 | Win conditions: balanced wins, single-style struggles | PASS |
| 8 | Feedback feasibility (no >100%) | PASS |
| 9 | Impact application (no dropped/NaN) | PASS |
| 10 | Cross-file threshold consistency | PASS |
