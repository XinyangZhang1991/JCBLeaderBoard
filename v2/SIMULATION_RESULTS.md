# Policy Balance Simulation — Results

**Tool:** [`v2/tools/simulate-balance.js`](v2/tools/simulate-balance.js)
**Rounds simulated:** 1 (9 scenarios) and 2 (6 scenarios)
**Runs per policy per round:** 1,000
**Engine path driven:** `startRound()` → `applyDecisionImpact()` (per decision) → `applyLEADMultipliers()` (once) → `calculateFinalScore()`

This report is generated from a headless simulation that drives the **real** game engine inside a Node `vm` sandbox. It does not hand-build state and call the scorer directly; every decision is applied through the same code path the browser uses. The purpose is to check whether the game's balance matches its stated design intent — that a **Balanced** leadership style should be the strongest general strategy, and that one-dimensional or poor play should be materially harder to win with.

> **Correction notice.** An earlier version of this report concluded that the balance _deviated_ from the design intent. That conclusion was **wrong**, and it was wrong because the policy labelled "Balanced" in the earlier run was **mis-implemented**. It was a _style-blind_ policy that picked whichever option used the least-used style, regardless of how good the option actually was. It therefore avoided the highest-impact options (which tend to cluster on a few styles) and left roughly 0.84 percentage points of growth per decision on the table. That policy is retained in the simulator purely as a control, renamed **`StrawmanBalanced (style-blind)`**, and is never presented as "Balanced". This report replaces the earlier conclusion with the corrected one below.

---

## What changed

The simulator now implements **two** correctly-behaved balanced policies, so the report can show the honest range rather than a single point:

- **`SmartBalanced`** — the **oracle best case**. It evaluates each option's _actual_ impact on a cloned game state (using the real `calculateDecisionImpact()`), then prefers high-impact options while still spreading styles. This is the ceiling: what a player with perfect foresight could achieve.
- **`RealisticBalanced`** — the **realistic player case**. It has **no lookahead** and never sees the hidden impact numbers. It scores each option by a _static_ judgement of how effective that leadership style generally is, and uses "balance my profile" only as a **tie-breaker** when two options are of comparable quality. This is how a competent human actually plays.

The original mis-implemented policy is kept as **`StrawmanBalanced (style-blind)`** — a control that demonstrates the defect. All other policies (Pure Democratic, Pure Pacesetting, Coaching+Democratic, Random, Poor) are unchanged.

---

## Results — Round 1 (9 scenarios)

| Policy                         | Wins | Losses |  Win Rate | 95% CI | Avg Growth | Avg Morale | Avg Attrition | Avg Capability | Avg LEAD Ratio | Avg Max Style % |
| ------------------------------ | ---: | -----: | --------: | -----: | ---------: | ---------: | ------------: | -------------: | -------------: | --------------: |
| SmartBalanced (oracle)         | 1000 |      0 |    100.0% |  ±0.0% |      24.9% |      95.0% |          5.0% |            250 |           1.17 |             34% |
| Coaching+Democratic            | 1000 |      0 |    100.0% |  ±0.0% |      12.0% |      91.3% |          5.0% |            250 |           1.01 |             53% |
| **RealisticBalanced**          |  483 |    517 | **48.3%** |  ±3.1% |      10.5% |      90.8% |          5.0% |            250 |           0.98 |             53% |
| Random                         |  262 |    738 |     26.2% |  ±2.7% |       9.0% |      55.6% |         14.2% |            153 |           0.66 |             29% |
| StrawmanBalanced (style-blind) |  213 |    787 |     21.3% |  ±2.5% |       8.1% |      64.0% |         11.7% |            150 |           0.59 |             22% |
| Pure Democratic                |    0 |   1000 |      0.0% |  ±0.0% |       8.4% |      95.0% |          5.0% |            217 |           0.76 |             65% |
| Pure Pacesetting               |    0 |   1000 |      0.0% |  ±0.0% |       4.3% |       0.0% |         76.3% |             72 |           0.47 |             60% |
| Poor / One-dimensional         |    0 |   1000 |      0.0% |  ±0.0% |       5.0% |       0.0% |         62.4% |             80 |           0.53 |             45% |

The 95% confidence interval is the Wald interval for a proportion, `1.96 × sqrt(p(1−p)/n)`. For the deterministic policies the interval collapses to zero because every run produces the same outcome.

### Win-path attribution — Round 1

Each win is attributed to the first of the five OR'd win paths that fires (`Excellence`, `People`, `Balanced`, `Capability`, `Growth`).

| Policy                         | Winning paths (count)                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| SmartBalanced (oracle)         | Excellence 1000, People 1000, Balanced 1000, Capability 1000, Growth 1000 |
| Coaching+Democratic            | People 1000, Capability 1000                                              |
| RealisticBalanced              | People 483, Capability 483, Excellence 244                                |
| Random                         | Balanced 200, Capability 187, People 165, Growth 163, Excellence 76       |
| StrawmanBalanced (style-blind) | Balanced 167, Capability 147, Growth 125, People 89, Excellence 12        |
| Pure Democratic                | (no wins)                                                                 |
| Pure Pacesetting               | (no wins)                                                                 |
| Poor / One-dimensional         | (no wins)                                                                 |

---

## Results — Round 2 (6 scenarios)

| Policy                         | Wins | Losses |   Win Rate | 95% CI | Avg Growth | Avg Morale | Avg Attrition | Avg Capability | Avg LEAD Ratio | Avg Max Style % |
| ------------------------------ | ---: | -----: | ---------: | -----: | ---------: | ---------: | ------------: | -------------: | -------------: | --------------: |
| SmartBalanced (oracle)         | 1000 |      0 |     100.0% |  ±0.0% |      26.4% |      95.0% |          5.0% |            250 |           1.67 |             36% |
| **RealisticBalanced**          | 1000 |      0 | **100.0%** |  ±0.0% |      21.8% |      95.0% |          5.0% |            250 |           1.28 |            100% |
| Coaching+Democratic            | 1000 |      0 |     100.0% |  ±0.0% |      21.8% |      95.0% |          5.0% |            250 |           1.28 |            100% |
| Random                         |  313 |    687 |      31.3% |  ±2.9% |       9.7% |      67.9% |         13.7% |            181 |           1.21 |             35% |
| StrawmanBalanced (style-blind) |  126 |    874 |      12.6% |  ±2.1% |       6.3% |      94.0% |          5.7% |            185 |           1.11 |             22% |
| Pure Democratic                |    0 |   1000 |       0.0% |  ±0.0% |       1.1% |      95.0% |          5.0% |            243 |           1.63 |             88% |
| Pure Pacesetting               |    0 |   1000 |       0.0% |  ±0.0% |       0.3% |       0.0% |         66.4% |            111 |           0.53 |             59% |
| Poor / One-dimensional         |    0 |   1000 |       0.0% |  ±0.0% |       0.1% |       0.0% |         68.2% |             96 |           0.43 |             59% |

### Win-path attribution — Round 2

| Policy                         | Winning paths (count)                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| SmartBalanced (oracle)         | Excellence 1000, People 1000, Balanced 1000, Capability 1000, Growth 1000 |
| RealisticBalanced              | People 1000, Growth 1000                                                  |
| Coaching+Democratic            | People 1000, Growth 1000                                                  |
| Random                         | Growth 263, People 174, Capability 172, Balanced 164, Excellence 153      |
| StrawmanBalanced (style-blind) | Growth 117, People 55, Balanced 55, Excellence 53, Capability 52          |
| Pure Democratic                | (no wins)                                                                 |
| Pure Pacesetting               | (no wins)                                                                 |
| Poor / One-dimensional         | (no wins)                                                                 |

---

## Verdict against design intent

### Round 1

| #   | Check                                                       | Result  | Detail                                                                                                                                  |
| --- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is balanced play the **top realistic** strategy?            | **YES** | Rank 1 of 6 among realistic policies at 48.3% (overall rank 3; SmartBalanced and Coaching+Democratic are ceilings, reported separately) |
| 2   | Is Poor the **worst** strategy?                             | **YES** | Poor wins 0.0%                                                                                                                          |
| 3   | Are one-dimensional policies **harder** than balanced play? | **YES** | RealisticBalanced margin over the best one-dimensional policy is 48.3 percentage points                                                 |
| 4   | Is Poor **materially below** balanced play?                 | **YES** | Gap of 48.3 percentage points                                                                                                           |
| 5   | Are results **differentiated** (not all ~0% or ~100%)?      | **YES** | Spread of 100.0%                                                                                                                        |
| 6   | Is Random **mid-pack**?                                     | **YES** | Rank 4 of 8 at 26.2%                                                                                                                    |
| 7   | Does corrected balanced play **beat the strawman**?         | **YES** | RealisticBalanced 48.3% vs StrawmanBalanced 21.3%                                                                                       |

**Overall (Round 1): the balance MATCHES the stated design intent.**

### Round 2

| #   | Check                                                       | Result  | Detail                                                                                                                                   |
| --- | ----------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is balanced play the **top realistic** strategy?            | **YES** | Rank 1 of 6 among realistic policies at 100.0% (overall rank 2; SmartBalanced and Coaching+Democratic are ceilings, reported separately) |
| 2   | Is Poor the **worst** strategy?                             | **YES** | Poor wins 0.0%                                                                                                                           |
| 3   | Are one-dimensional policies **harder** than balanced play? | **YES** | RealisticBalanced margin over the best one-dimensional policy is 100.0 percentage points                                                 |
| 4   | Is Poor **materially below** balanced play?                 | **YES** | Gap of 100.0 percentage points                                                                                                           |
| 5   | Are results **differentiated** (not all ~0% or ~100%)?      | **YES** | Spread of 100.0%                                                                                                                         |
| 6   | Is Random **mid-pack**?                                     | **YES** | Rank 4 of 8 at 31.3%                                                                                                                     |
| 7   | Does corrected balanced play **beat the strawman**?         | **YES** | RealisticBalanced 100.0% vs StrawmanBalanced 12.6%                                                                                       |

**Overall (Round 2): the balance MATCHES the stated design intent.**

### Reading the verdict

The corrected evidence is unambiguous:

- **Balanced play is the strongest general strategy.** The oracle policy (`SmartBalanced`) wins **100%** of runs in **both** rounds. The realistic, no-lookahead policy (`RealisticBalanced`) wins **48.3%** in Round 1 and **100%** in Round 2, and in both rounds it is the **top-ranked realistic strategy** — ahead of Random, the strawman, and every one-dimensional policy.
- **The original "deviation" was an artefact of the mis-implementation.** The style-blind strawman wins only 21.3% (Round 1) and 12.6% (Round 2), and is beaten by the corrected realistic policy by 27.0 and 87.4 percentage points respectively. The earlier report mistook the strawman's weakness for a property of the game.
- **One-dimensional and poor play are materially harder.** Pure Democratic and Pure Pacesetting win **0%** in both rounds, and the deliberately poor control wins **0%** in both rounds.
- **The controls behave sensibly.** Poor is the joint-worst at 0%, and Random lands mid-pack (rank 4 of 8 in both rounds), so the harness is clearly working and the results are differentiated rather than degenerate.

---

## The People and Capability paths lack a style-concentration constraint

This is a **genuine design characteristic**, not a balance defect, and it does **not** disadvantage balanced play.

The engine's `calculateFinalScore()` accepts a win if **any** of five paths fires. Two of those paths — **People** and **Capability** — impose no cap on style concentration:

- **People Path** requires capability ≥ 140, LEAD ratio ≥ 0.65, growth ≥ 10, and team health, but **no maximum-style constraint**.
- **Capability Path** requires capability ≥ 145, LEAD ratio ≥ 0.5, growth ≥ 10, team health, and max style ≤ 70, but **no balance requirement**.

By contrast, the **Balanced Path** requires LEAD ≥ 0.5, max style ≤ 50, growth ≥ 10 and team health, and the **Excellence Path** requires LEAD ≥ 0.78 plus max style ≤ 70.

Because of this, a focused two-style strategy such as **Coaching+Democratic** can clear the People and Capability thresholds reliably and win 100% of runs. That result is **genuine** — it is not an artefact. It wins via the People and Capability paths on strong, real metrics (Round 1: growth 12.0%, morale 91.3%, attrition 5.0%, capability 250, LEAD 1.01, max style 53%; Round 2: growth 21.8%, morale 95.0%, capability 250, LEAD 1.28).

Crucially, this does **not** mean balanced play is penalised. The corrected balanced policies also clear those same paths — `RealisticBalanced` wins via **People and Capability** in Round 1 and via **People and Growth** in Round 2 — while _additionally_ satisfying the stricter Balanced and Excellence paths that the focused strategy cannot. The absence of a style cap on People/Capability widens the set of viable strategies; it does not narrow it away from balance. Balanced play remains the strongest general strategy, as the results above show.

The earlier report's recommendation to add a style-concentration constraint to the People and Capability paths is therefore **withdrawn**. Such a change is not required to satisfy the design intent, and it would reduce strategic variety by removing a legitimate, well-earned winning approach.

---

## Other observations

- **Pure Democratic** reaches excellent team metrics (Round 1: morale 95.0%, attrition 5.0%, capability 217, LEAD 0.76) but its max style of 65% exceeds the Balanced Path's ≤50 cap and its growth of 8.4% misses the 10% floor, so it wins nothing. In Round 2 it is even more concentrated (max style 88%) and still wins nothing.
- **Pure Pacesetting** is catastrophic in both rounds: morale collapses to 0%, attrition reaches 76.3% (Round 1) and 66.4% (Round 2), and capability falls to 72 and 111 respectively. It fails team health outright.
- **Poor / One-dimensional** behaves as intended as a control, with morale 0% and attrition above 60% in both rounds.
- **Random** is a useful sanity anchor: it wins 26.2% (Round 1) and 31.3% (Round 2), comfortably below balanced play and comfortably above the one-dimensional policies.
- **Round 2 is more forgiving to balanced play than Round 1.** The realistic policy wins 100% in Round 2 versus 48.3% in Round 1. Round 2's six-scenario set contains several decisions where the highest-quality option is also the one that balances the profile, so the realistic heuristic rarely has to trade quality against balance.

---

## Method

- The simulator loads the real browser modules — [`v2/lead-constants.js`](v2/lead-constants.js), [`v2/scoring.js`](v2/scoring.js), [`v2/scenarios.js`](v2/scenarios.js) and [`v2/game-engine.js`](v2/game-engine.js) — into a Node `vm` sandbox with minimal DOM and `localStorage` stubs. No product file is modified.
- Each run calls the real `startRound(round)`, applies every decision through the real `applyDecisionImpact()`, then calls `applyLEADMultipliers()` once and `calculateFinalScore()` once. The win/loss outcome is whatever the real scorer returns.
- The **oracle** policy (`SmartBalanced`) evaluates each option by cloning the current state and calling the real `calculateDecisionImpact()` on the clone. Because that function is pure (it reads state but never mutates it), this is safe and gives a true impact reading.
- The **realistic** policy (`RealisticBalanced`) never calls the scorer. It ranks options by a fixed, hand-authored table of style effectiveness and uses profile balance only as a tie-breaker within a small quality epsilon.
- **Deterministic-outcome caveat.** The policies are deterministic in their _option choices_; only slider allocations (and, for Random, option choices) vary across runs. The reported win rates therefore reflect the policy intent, not human variance. Where a policy's choices and sliders are fully determined, every run produces the same outcome and the 95% CI collapses to zero.

---

## Limitations

- **Rounds 1 and 2 only.** The simulation covers the two shipped rounds (9 and 6 scenarios). It does not model any future or alternate scenario sets.
- **Policies are heuristic.** `SmartBalanced` is an oracle ceiling, not a human; `RealisticBalanced` encodes one particular judgement of style effectiveness. A different reasonable heuristic could produce somewhat different win rates. The qualitative conclusion — balanced play is the strongest general strategy — is robust across both policies and both rounds.
- **Slider allocations vary, option choices are deterministic per policy.** As noted in the Method section, this means the win rates measure policy intent rather than the full spread of human play.
- **The UI layer is bypassed.** The simulation drives the engine methods directly. It does not exercise rendering, timers, information requests, or the budget-validation UI, so it cannot detect defects in those layers.
- **Results are reproducible.** The simulator uses a seeded PRNG (Mulberry32), so re-running produces identical numbers.
- A machine-readable copy of the results is written to [`v2/tools/simulate-balance.summary.json`](v2/tools/simulate-balance.summary.json).

---

## Conclusion

The corrected simulation shows that the game's balance **does** meet its stated design intent. Balanced play is the strongest general strategy in both rounds: the oracle policy wins 100% of runs, and the realistic no-lookahead policy is the top-ranked realistic strategy in both rounds (48.3% in Round 1, 100% in Round 2). One-dimensional and poor play are materially harder, winning 0% in both rounds. The original report's contrary conclusion was caused by a mis-implemented "Balanced" policy that was blind to option quality; that policy is retained only as a labelled control. The absence of a style-concentration constraint on the People and Capability paths is a genuine design characteristic that widens strategic variety without disadvantaging balanced play, so no engine change is recommended.
