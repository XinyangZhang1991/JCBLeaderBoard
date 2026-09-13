// ============================================================================
// SHARED SIMULATION POLICIES — SINGLE SOURCE OF TRUTH
// ============================================================================
// This module holds the play-style policies, the slider allocator, the
// deterministic RNG, and the playthrough driver used by BOTH:
//
//   - v2/tools/simulate-balance.js   (the manual balance simulator)
//   - v2/tests/balance-guard.test.js (the automated regression guard)
//
// WHY THIS MODULE EXISTS
//   The balance guard test must exercise EXACTLY the same policies as the
//   simulator, otherwise the test would be guarding a different game. Keeping
//   one copy of the policy code here guarantees there is a single source of
//   truth: a change to a policy changes both the simulator and the test.
//
// SANDBOX INJECTION
//   The policies need the REAL scoring engine (for the oracle policy) and the
//   REAL GameEngine (for the playthrough driver). Both live inside a Node `vm`
//   sandbox created by the caller. Rather than hard-code a sandbox here, the
//   caller passes a `sandbox` object into `createSimulation(sandbox)`. The
//   returned object exposes every helper, policy factory, and the driver.
//
//   This keeps the module free of any file-loading concerns: the simulator and
//   the test each build their own sandbox (they may differ in console routing)
//   and then share this policy logic.
//
// Run with: (not runnable directly — it is a library)
// ============================================================================

"use strict";

// ---------------------------------------------------------------------------
// Deterministic RNG (seeded) so runs are reproducible.
// ---------------------------------------------------------------------------

function makeRng(seed) {
  // Mulberry32 — small, fast, good enough for simulation.
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Policy helpers
// ---------------------------------------------------------------------------

const ALL_STYLES = [
  "coercive",
  "authoritative",
  "affiliative",
  "democratic",
  "pacesetting",
  "coaching",
];

// The four LEAD dimensions a decision can move.
const LEAD_DIMS = ["leadership", "excellence", "agility", "determination"];

// Extract the style an option maps to, using `style` first, then `styleMapping`
// (for timeline decisions), then the `color` field as a fallback.
function optionStyle(decisionDef, optionIndex) {
  if (decisionDef.type === "timeline") {
    if (
      Array.isArray(decisionDef.styleMapping) &&
      decisionDef.styleMapping[optionIndex]
    ) {
      return decisionDef.styleMapping[optionIndex];
    }
    return null;
  }
  const option = decisionDef.options && decisionDef.options[optionIndex];
  if (!option) return null;
  if (option.style) return option.style;
  return null;
}

function optionColor(decisionDef, optionIndex) {
  if (decisionDef.type === "timeline") {
    if (
      Array.isArray(decisionDef.colorMapping) &&
      decisionDef.colorMapping[optionIndex]
    ) {
      return decisionDef.colorMapping[optionIndex];
    }
    return null;
  }
  const option = decisionDef.options && decisionDef.options[optionIndex];
  if (!option) return null;
  return option.color || null;
}

// Number of selectable options for a decision.
function optionCount(decisionDef) {
  if (decisionDef.type === "choice") return decisionDef.options.length;
  if (decisionDef.type === "timeline") return decisionDef.options.length;
  if (decisionDef.type === "ranking") return decisionDef.items.length;
  return 0;
}

// Map a colour to the style family it most often represents, used as a fallback
// when an option has no explicit `style`.
const COLOR_STYLE_FALLBACK = {
  RED: "pacesetting",
  BLUE: "authoritative",
  YELLOW: "democratic",
  GREEN: "coaching",
};

function styleFor(decisionDef, optionIndex) {
  const s = optionStyle(decisionDef, optionIndex);
  if (s) return s;
  const c = optionColor(decisionDef, optionIndex);
  if (c && COLOR_STYLE_FALLBACK[c]) return COLOR_STYLE_FALLBACK[c];
  return null;
}

// ---------------------------------------------------------------------------
// Slider allocation
// ---------------------------------------------------------------------------
// Each slider decision has sub-allocations with `max` and a shared
// `budgetConstraint`. We allocate within the budget, respecting `step`.
//
// Returns an array of values (in £M) aligned to the slider sub-buckets.

function allocateSliders(decisionDef, mode, rng) {
  const sliders = decisionDef.sliders || [];
  const budget = sliders[0] && sliders[0].budgetConstraint;
  const n = sliders.length;
  const values = new Array(n).fill(0);
  if (n === 0) return values;

  // Respect the finest step across the sub-buckets so the allocation is always
  // reachable by the UI sliders.
  const step = sliders.reduce((min, s) => {
    const st = s.step || 1 / 20;
    return st < min ? st : min;
  }, 1);

  const snap = (v, s) => {
    const st = s.step || 1 / 20;
    return Math.round(v / st) * st;
  };

  if (!budget) {
    // No shared budget: allocate each sub-bucket independently.
    sliders.forEach((s, i) => {
      if (mode === "even") {
        values[i] = snap(s.max / 2, s);
      } else if (mode === "random") {
        values[i] = snap(rng() * s.max, s);
      } else if (mode === "worst") {
        values[i] = 0;
      } else {
        values[i] = snap(s.max / 2, s);
      }
    });
    return values;
  }

  if (mode === "even") {
    // Spread the budget as evenly as possible across all sub-buckets, capped by
    // each bucket's max.
    let remaining = budget;
    // Iteratively fill: give each bucket an equal share of what is left.
    for (let pass = 0; pass < n + 2 && remaining > 1e-9; pass++) {
      const open = [];
      for (let i = 0; i < n; i++) {
        if (values[i] < sliders[i].max - 1e-9) open.push(i);
      }
      if (open.length === 0) break;
      const share = remaining / open.length;
      let progressed = false;
      for (const i of open) {
        const room = sliders[i].max - values[i];
        const give = Math.min(room, share);
        if (give > 1e-9) {
          values[i] = snap(values[i] + give, sliders[i]);
          remaining -= give;
          progressed = true;
        }
      }
      if (!progressed) break;
    }
  } else if (mode === "balanced-smart") {
    // "Intended optimal" balanced play: the win conditions reward STYLE balance
    // (spread across the six Goleman styles) but the engine rewards STRATEGIC
    // concentration in the budget sliders (e.g. R&D + dealers together unlock a
    // delayed +10% growth payoff). A genuinely optimal balanced leader therefore
    // funds the high-leverage strategic buckets to their productive thresholds
    // and spreads the remainder, rather than diluting every bucket equally.
    //
    // We fund the two largest buckets (by max, a proxy for strategic weight) to
    // their caps where the budget allows, then spread the rest evenly. This
    // keeps the allocation within budget and respects each bucket's cap.
    let remaining = budget;
    const order = sliders
      .map((s, i) => ({ i: i, max: s.max }))
      .sort((a, b) => b.max - a.max)
      .map((o) => o.i);
    for (let k = 0; k < Math.min(2, order.length) && remaining > 1e-9; k++) {
      const i = order[k];
      const target = Math.min(sliders[i].max, remaining);
      values[i] = snap(target, sliders[i]);
      remaining -= values[i];
    }
    // Spread whatever is left evenly across the remaining buckets.
    for (let pass = 0; pass < n + 2 && remaining > 1e-9; pass++) {
      const open = [];
      for (let i = 0; i < n; i++) {
        if (values[i] < sliders[i].max - 1e-9) open.push(i);
      }
      if (open.length === 0) break;
      const share = remaining / open.length;
      let progressed = false;
      for (const i of open) {
        const room = sliders[i].max - values[i];
        const give = Math.min(room, share);
        if (give > 1e-9) {
          values[i] = snap(values[i] + give, sliders[i]);
          remaining -= give;
          progressed = true;
        }
      }
      if (!progressed) break;
    }
  } else if (mode === "random") {
    // Random allocation respecting the budget: repeatedly pick a random open
    // bucket and give it a random slice of the remaining budget.
    let remaining = budget;
    let guard = 0;
    while (remaining > 1e-9 && guard < 500) {
      guard++;
      const open = [];
      for (let i = 0; i < n; i++) {
        if (values[i] < sliders[i].max - 1e-9) open.push(i);
      }
      if (open.length === 0) break;
      const i = open[Math.floor(rng() * open.length)];
      const room = sliders[i].max - values[i];
      const give = Math.min(room, remaining * (0.25 + rng() * 0.75));
      if (give <= 1e-9) break;
      values[i] = snap(values[i] + give, sliders[i]);
      remaining -= give;
    }
  } else if (mode === "worst") {
    // Deliberately allocate to the least effective buckets. We treat the
    // highest-index buckets (typically the relationship/people buckets) as the
    // "least effective" for a one-dimensional, results-only leader, and starve
    // the rest. This concentrates spend and neglects team health.
    let remaining = budget;
    for (let i = n - 1; i >= 0 && remaining > 1e-9; i--) {
      const give = Math.min(sliders[i].max, remaining);
      values[i] = snap(give, sliders[i]);
      remaining -= give;
    }
  }

  // Final safety: never exceed the budget.
  let total = values.reduce((a, b) => a + b, 0);
  if (total > budget + 1e-9) {
    // Trim from the largest bucket until within budget.
    let guard = 0;
    while (total > budget + 1e-9 && guard < 200) {
      guard++;
      let maxIdx = 0;
      for (let i = 1; i < n; i++) if (values[i] > values[maxIdx]) maxIdx = i;
      const st = sliders[maxIdx].step || 1 / 20;
      values[maxIdx] = Math.max(0, values[maxIdx] - st);
      total = values.reduce((a, b) => a + b, 0);
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
// A policy is: (decisionDef, rng, ctx) => chosen option index.
// `ctx` carries { scenario, state } for oracle policies.
// `sliderMode` drives slider allocation.
//
// ---------------------------------------------------------------------------
// Balanced policies
// ---------------------------------------------------------------------------
// HISTORY / WHY THERE ARE TWO
//   The ORIGINAL "Balanced" policy in this harness was a STRAWMAN. It scored
//   each option purely by "how little has this style been used so far", with a
//   tiny random jitter. That made it STYLE-BLIND to impact magnitude: it
//   happily picked a low-impact option simply because its style was under-used,
//   and it picked the MIN-growth option 52.2% of the time and the MAX-growth
//   option only 39.1%. It left ~0.84% growth per decision on the table, which
//   is why it only won ~26%.
//
//   An independent verification replaced it with a correctly-implemented
//   balanced policy that BOTH spreads styles AND prefers high-impact options,
//   and that policy won 100%. This module ships two such policies so the
//   report can show the range between the best case and the realistic case:
//
//     SmartBalanced     — oracle-style best case. Spreads styles AND prefers
//                         high-impact options, evaluated against the REAL
//                         engine (calculateDecisionImpact) on a cloned state.
//     RealisticBalanced — realistic player case. A STATIC quality heuristic
//                         with NO lookahead: it knows which Goleman styles are
//                         generally constructive, and it spreads them, but it
//                         cannot see the engine's per-option impact numbers.
//
//   The old strawman is retained ONLY as an explicit control, relabelled
//   `StrawmanBalanced (style-blind)`, and is never presented as "Balanced".

// --- SmartBalanced (oracle-style best case) -------------------------------
// For each decision we evaluate EVERY candidate option by calling the REAL
// scoringEngine.calculateDecisionImpact() against a CLONE of the current state
// (the method is pure — it does not mutate the state it is given). Each option
// is scored on two axes:
//
//   1. IMPACT MAGNITUDE — a weighted sum of the business and LEAD gains the
//      option would produce (growth, LEAD dimensions, capability, morale) minus
//      the harms (attrition, morale loss). This is what the strawman ignored.
//   2. STYLE SPREAD — a bonus for choosing a style that is currently under-used
//      in the run, so the profile stays spread across all six styles and the
//      Balanced Path's <=50% cap stays reachable.
//
// The two are combined so that a genuinely high-impact option is preferred, but
// among similarly-impactful options the one that best spreads the profile wins.
function makeSmartBalancedPolicy(evaluateOptionImpact) {
  const usage = Object.fromEntries(ALL_STYLES.map((s) => [s, 0]));
  return {
    name: "SmartBalanced",
    reset() {
      ALL_STYLES.forEach((s) => (usage[s] = 0));
    },
    // `ctx` carries { scenario, state } so the oracle can call the real engine.
    choose(decisionDef, rng, ctx) {
      const n = optionCount(decisionDef);
      if (n === 0) return 0;

      // Total style points so far, used to normalise the spread bonus.
      const totalUsage = ALL_STYLES.reduce((a, s) => a + usage[s], 0);

      let best = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        const style = styleFor(decisionDef, i);

        // --- Axis 1: real impact magnitude (oracle) ---
        let magnitude = 0;
        if (ctx && ctx.scenario && ctx.state) {
          const impact = evaluateOptionImpact(
            ctx.scenario,
            decisionDef,
            i,
            ctx.state,
          );
          if (impact) {
            magnitude =
              (impact.growth || 0) * 1.0 +
              (impact.leadership || 0) * 0.25 +
              (impact.excellence || 0) * 0.25 +
              (impact.agility || 0) * 0.25 +
              (impact.determination || 0) * 0.25 +
              (impact.organizationalCapability || 0) * 0.15 +
              (impact.morale || 0) * 0.2 -
              (impact.attrition || 0) * 0.3;
          }
        }

        // --- Axis 2: style spread bonus ---
        // A style that has been used less than an even share earns a bonus; a
        // style already over-used earns a penalty. Scaled so it can break ties
        // between similar-impact options without overriding a large impact gap.
        let spreadBonus = 0;
        if (style) {
          const evenShare = totalUsage > 0 ? totalUsage / ALL_STYLES.length : 0;
          spreadBonus = (evenShare - usage[style]) * 0.6;
        }

        // Small deterministic jitter to break exact ties reproducibly.
        const jitter = rng() * 0.001;
        const score = magnitude + spreadBonus + jitter;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }

      const chosenStyle = styleFor(decisionDef, best);
      if (chosenStyle) usage[chosenStyle] += 1;
      return best;
    },
    // Balanced play spreads STYLES evenly (which the win conditions measure)
    // while allocating the budget strategically rather than diluting it.
    sliderMode: "balanced-smart",
  };
}

// --- RealisticBalanced (static heuristic, no lookahead) -------------------
// A realistic competent player cannot see the engine's per-option impact
// numbers. They apply a STATIC mental model: some Goleman styles are generally
// constructive (coaching, democratic, affiliative, authoritative) and some are
// generally corrosive if over-used (pacesetting, coercive). They also spread
// their choices so no single style dominates. This policy encodes exactly that
// — a fixed quality table plus a capped spread bonus — and NEVER calls the
// engine. It is the honest "good human player" baseline, not an oracle.
//
// The quality table deliberately ranks the constructive styles in a fixed
// order (coaching > democratic > affiliative > authoritative) rather than
// treating them as interchangeable. A real player has habits and preferences;
// they do not randomise uniformly across "good" styles. The capped spread
// bonus then nudges them off their favourite when it has been used a lot,
// which is what produces a genuinely balanced profile rather than a
// single-style collapse.
const REALISTIC_STYLE_QUALITY = {
  coaching: 1.0,
  democratic: 0.9,
  affiliative: 0.8,
  authoritative: 0.75,
  pacesetting: 0.3,
  coercive: 0.2,
};

function makeRealisticBalancedPolicy() {
  const usage = Object.fromEntries(ALL_STYLES.map((s) => [s, 0]));
  return {
    name: "RealisticBalanced",
    reset() {
      ALL_STYLES.forEach((s) => (usage[s] = 0));
    },
    choose(decisionDef, rng) {
      const n = optionCount(decisionDef);
      if (n === 0) return 0;
      const totalUsage = ALL_STYLES.reduce((a, s) => a + usage[s], 0);
      const evenShare = totalUsage > 0 ? totalUsage / ALL_STYLES.length : 0;
      // A realistic player picks the option whose leadership style they judge
      // most effective (a static quality ranking — no lookahead, no knowledge
      // of the hidden impact numbers). They use "balance my profile" only as a
      // TIE-BREAKER: when two options are of comparable quality, they lean
      // toward the style they have used least. This is lexicographic, so the
      // balance motive can never override a clear quality preference — which
      // is exactly how a competent human plays.
      const TIE_EPSILON = 0.05;
      let best = 0;
      let bestQuality = -Infinity;
      let bestSpread = -Infinity;
      for (let i = 0; i < n; i++) {
        const style = styleFor(decisionDef, i);
        const quality = style ? REALISTIC_STYLE_QUALITY[style] || 0.5 : 0.5;
        const spread = style ? evenShare - usage[style] : 0;
        const jitter = rng() * 0.001;
        const q = quality + jitter;
        if (q > bestQuality + TIE_EPSILON) {
          bestQuality = q;
          bestSpread = spread;
          best = i;
        } else if (q > bestQuality - TIE_EPSILON && spread > bestSpread) {
          bestQuality = Math.max(bestQuality, q);
          bestSpread = spread;
          best = i;
        }
      }
      const chosenStyle = styleFor(decisionDef, best);
      if (chosenStyle) usage[chosenStyle] += 1;
      return best;
    },
    // A realistic player prioritises: they fund their top two priorities
    // properly rather than diluting £500K across five buckets at £100K each
    // (which meets no threshold and achieves nothing). They have no lookahead,
    // so they cannot reverse-engineer which exact buckets unlock a delayed
    // payoff — but "concentrate on your biggest priorities" is ordinary good
    // judgement, not oracle knowledge. This is the honest "good human player"
    // allocation.
    sliderMode: "balanced-smart",
  };
}

// --- StrawmanBalanced (style-blind) — CONTROL ONLY ------------------------
// The ORIGINAL mis-implemented "Balanced" policy, retained purely as a control
// to demonstrate the defect. It scores options ONLY by "least-used style" and
// is therefore blind to impact magnitude. It is NEVER presented as "Balanced".
function makeStrawmanBalancedPolicy() {
  const usage = Object.fromEntries(ALL_STYLES.map((s) => [s, 0]));
  return {
    name: "StrawmanBalanced (style-blind)",
    reset() {
      ALL_STYLES.forEach((s) => (usage[s] = 0));
    },
    choose(decisionDef, rng) {
      const n = optionCount(decisionDef);
      if (n === 0) return 0;
      let best = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        const style = styleFor(decisionDef, i);
        const styleScore = style ? -usage[style] : -0.5;
        const jitter = rng() * 0.01;
        const score = styleScore + jitter;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      const chosenStyle = styleFor(decisionDef, best);
      if (chosenStyle) usage[chosenStyle] += 1;
      return best;
    },
    sliderMode: "balanced-smart",
  };
}

// --- Pure style policies --------------------------------------------------
function makeStylePolicy(name, primary, secondary) {
  return {
    name: name,
    reset() {},
    choose(decisionDef, rng) {
      const n = optionCount(decisionDef);
      if (n === 0) return 0;
      // First pass: exact primary style.
      for (let i = 0; i < n; i++) {
        if (styleFor(decisionDef, i) === primary) return i;
      }
      // Second pass: secondary style.
      if (secondary) {
        for (let i = 0; i < n; i++) {
          if (styleFor(decisionDef, i) === secondary) return i;
        }
      }
      // Fallback: first option.
      return 0;
    },
    sliderMode: "even",
  };
}

// --- Random ---------------------------------------------------------------
function makeRandomPolicy() {
  return {
    name: "Random",
    reset() {},
    choose(decisionDef, rng) {
      const n = optionCount(decisionDef);
      if (n === 0) return 0;
      return Math.floor(rng() * n);
    },
    sliderMode: "random",
  };
}

// --- Poor / One-dimensional ----------------------------------------------
// Deliberately pick the worst option: the one that concentrates on a single
// style and neglects team health. We approximate this by preferring the
// coercive/pacesetting styles (results-only, low morale) and, where a decision
// has no such option, the option with the highest index (typically the most
// passive/least effective).
function makePoorPolicy() {
  const BAD_STYLES = ["coercive", "pacesetting"];
  return {
    name: "Poor / One-dimensional",
    reset() {},
    choose(decisionDef, rng) {
      const n = optionCount(decisionDef);
      if (n === 0) return 0;
      for (const bad of BAD_STYLES) {
        for (let i = 0; i < n; i++) {
          if (styleFor(decisionDef, i) === bad) return i;
        }
      }
      // No coercive/pacesetting option: take the last option.
      return n - 1;
    },
    sliderMode: "worst",
  };
}

// ---------------------------------------------------------------------------
// Simulation factory
// ---------------------------------------------------------------------------
// `createSimulation(sandbox)` binds the policy logic to a loaded engine
// sandbox and returns the full toolkit. The sandbox must expose:
//   - sandbox.GameEngine
//   - sandbox.window.scoringEngine
//   - sandbox.LEAD_CONSTANTS
//   - sandbox.window.scenarios
function createSimulation(sandbox) {
  // Evaluate a single option's real impact by calling the engine's
  // calculateDecisionImpact() on a CLONE of the supplied state. The method is
  // pure (it reads gameState but never writes to it), so cloning is a safety
  // measure that also guarantees no state leakage between evaluations.
  function evaluateOptionImpact(scenario, decisionDef, optionIndex, state) {
    const scoring = sandbox.window.scoringEngine;
    if (!scoring || typeof scoring.calculateDecisionImpact !== "function") {
      return null;
    }
    const stateClone = cloneState(state);
    const decision = {
      scenario: stateClone.currentScenario,
      timestamp: 0,
      choices: [],
    };
    // Build a minimal choices array: only the decision under evaluation is set;
    // the scorer reads the choice at the matching index.
    scenario.decisions.forEach((d, idx) => {
      if (idx === decisionDef.__index) {
        if (d.type === "choice")
          decision.choices.push({ type: "choice", index: optionIndex });
        else if (d.type === "timeline")
          decision.choices.push({ type: "timeline", value: optionIndex });
        else if (d.type === "slider")
          decision.choices.push({ type: "slider", values: [] });
        else if (d.type === "ranking")
          decision.choices.push({ type: "ranking", order: [] });
      } else {
        // Neutral placeholder for the other decisions.
        if (d.type === "choice")
          decision.choices.push({ type: "choice", index: 0 });
        else if (d.type === "timeline")
          decision.choices.push({ type: "timeline", value: 0 });
        else if (d.type === "slider")
          decision.choices.push({ type: "slider", values: [] });
        else if (d.type === "ranking")
          decision.choices.push({ type: "ranking", order: [] });
      }
    });
    try {
      return scoring.calculateDecisionImpact(scenario, decision, stateClone);
    } catch (e) {
      return null;
    }
  }

  // Deep-clone the parts of the engine state the scorer reads. JSON round-trip
  // is sufficient here because the state is plain data (no functions/cycles).
  function cloneState(state) {
    return JSON.parse(
      JSON.stringify({
        currentScenario: state.currentScenario,
        round: state.round,
        growth: state.growth,
        profitMargin: state.profitMargin,
        morale: state.morale,
        attrition: state.attrition,
        leadershipStyles: state.leadershipStyles,
        leadership: state.leadership,
        excellence: state.excellence,
        agility: state.agility,
        determination: state.determination,
        organizationalCapability: state.organizationalCapability,
        delayedGrowthPayoffs: state.delayedGrowthPayoffs,
      }),
    );
  }

  // Build a decision record shaped exactly like collectDecisionData() produces,
  // then hand it to the REAL applyDecisionImpact().
  function buildDecisionRecord(scenario, scenarioIndex, policy, rng, state) {
    const data = {
      scenario: scenarioIndex,
      timestamp: Date.now(),
      choices: [],
    };

    // The oracle policy needs to know WHICH decision it is evaluating so it can
    // build a correctly-aligned choices array for calculateDecisionImpact().
    scenario.decisions.forEach((d, idx) => {
      d.__index = idx;
    });

    const ctx = { scenario: scenario, state: state };

    scenario.decisions.forEach((decisionDef) => {
      if (decisionDef.type === "choice") {
        data.choices.push({
          type: "choice",
          index: policy.choose(decisionDef, rng, ctx),
        });
      } else if (decisionDef.type === "timeline") {
        data.choices.push({
          type: "timeline",
          value: policy.choose(decisionDef, rng, ctx),
        });
      } else if (decisionDef.type === "slider") {
        const values = allocateSliders(decisionDef, policy.sliderMode, rng);
        data.choices.push({ type: "slider", values: values });
      } else if (decisionDef.type === "ranking") {
        const n = decisionDef.items.length;
        const order = [];
        for (let i = 0; i < n; i++) order.push(i);
        // Shuffle for Random; otherwise keep natural order.
        if (policy.name === "Random") {
          for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
          }
        }
        data.choices.push({ type: "ranking", order: order });
      }
    });

    return data;
  }

  // Run one full playthrough for a policy and return the final results object.
  function playOnce(policy, seed, round) {
    const rng = makeRng(seed);
    policy.reset();

    const engine = new sandbox.GameEngine();
    engine.startRound(round);

    const scenarios = engine.scenarios;
    for (let s = 0; s < scenarios.length; s++) {
      const scenario = scenarios[s];
      engine.state.currentScenario = s;
      const decision = buildDecisionRecord(
        scenario,
        s,
        policy,
        rng,
        engine.state,
      );
      engine.state.decisions.push(decision);
      engine.applyDecisionImpact(scenario, decision);
    }

    // End of game: apply LEAD multipliers, then score.
    engine.applyLEADMultipliers();
    const results = sandbox.window.scoringEngine.calculateFinalScore(
      engine.state,
      null,
    );

    // Attribute the win (if any) to a specific path so the report can explain
    // WHY a policy wins. This mirrors the OR'd conditions in calculateFinalScore.
    const path = attributeWinPath(engine.state, results);

    return { results, state: engine.state, path: path };
  }

  // Re-derive which win path fired, using the same thresholds as
  // calculateFinalScore(). Purely diagnostic — it does not affect the outcome.
  function attributeWinPath(state, results) {
    if (!results.escaped) return "none";

    const LEAD_CONSTANTS = sandbox.LEAD_CONSTANTS;

    const healthyAttrition = state.attrition < 15;
    const healthyProfit = state.profitMargin > 25;
    const healthyMorale = state.morale >= 65;
    const meetsTeamHealth = healthyAttrition && healthyProfit && healthyMorale;

    const avgLEADRatio = results.avgLEADRatio || 0;
    const maxStylePercentage = results.maxStylePercentage || 0;

    const exceptionalLEAD = avgLEADRatio >= LEAD_CONSTANTS.exceptionalLEAD;
    const strongLEAD = avgLEADRatio >= LEAD_CONSTANTS.strongLEAD;
    const minimumLEAD = avgLEADRatio >= LEAD_CONSTANTS.minimumLEAD;
    const wellBalanced = maxStylePercentage <= LEAD_CONSTANTS.wellBalancedMax;
    const reasonablyBalanced =
      maxStylePercentage <= LEAD_CONSTANTS.reasonablyBalancedMax;

    const MIN_GROWTH_FLOOR = LEAD_CONSTANTS.minGrowthFloor;

    const winsViaExcellencePath =
      exceptionalLEAD &&
      state.growth >= 12 &&
      meetsTeamHealth &&
      reasonablyBalanced;
    const winsViaPeoplePath =
      state.organizationalCapability >= 140 &&
      avgLEADRatio >= 0.65 &&
      state.growth >= MIN_GROWTH_FLOOR &&
      meetsTeamHealth;
    const winsViaBalancedPath =
      strongLEAD &&
      wellBalanced &&
      state.growth >= MIN_GROWTH_FLOOR &&
      meetsTeamHealth;
    const winsViaCapabilityPath =
      state.organizationalCapability >= 145 &&
      strongLEAD &&
      state.growth >= MIN_GROWTH_FLOOR &&
      meetsTeamHealth &&
      reasonablyBalanced;
    const acceptableTeamImpact = state.morale >= 45 && state.attrition < 30;
    const winsViaGrowthPath =
      state.growth >= LEAD_CONSTANTS.growthTarget &&
      minimumLEAD &&
      acceptableTeamImpact;

    const paths = [];
    if (winsViaExcellencePath) paths.push("Excellence");
    if (winsViaPeoplePath) paths.push("People");
    if (winsViaBalancedPath) paths.push("Balanced");
    if (winsViaCapabilityPath) paths.push("Capability");
    if (winsViaGrowthPath) paths.push("Growth");
    return paths.length ? paths.join("+") : "unknown";
  }

  // Build the full policy roster. A FRESH instance is created per round so no
  // usage counters leak between rounds.
  function buildPolicies() {
    return [
      makeSmartBalancedPolicy(evaluateOptionImpact),
      makeRealisticBalancedPolicy(),
      makeStrawmanBalancedPolicy(),
      makeStylePolicy("Pure Democratic", "democratic", "affiliative"),
      makeStylePolicy("Pure Pacesetting", "pacesetting", "coercive"),
      makeStylePolicy("Coaching+Democratic", "coaching", "democratic"),
      makeRandomPolicy(),
      makePoorPolicy(),
    ];
  }

  return {
    // helpers
    makeRng,
    ALL_STYLES,
    LEAD_DIMS,
    optionStyle,
    optionColor,
    optionCount,
    styleFor,
    allocateSliders,
    evaluateOptionImpact,
    cloneState,
    // policy factories
    makeSmartBalancedPolicy: () =>
      makeSmartBalancedPolicy(evaluateOptionImpact),
    makeRealisticBalancedPolicy,
    makeStrawmanBalancedPolicy,
    makeStylePolicy,
    makeRandomPolicy,
    makePoorPolicy,
    buildPolicies,
    // driver
    buildDecisionRecord,
    playOnce,
    attributeWinPath,
  };
}

module.exports = {
  makeRng,
  ALL_STYLES,
  LEAD_DIMS,
  optionStyle,
  optionColor,
  optionCount,
  styleFor,
  allocateSliders,
  REALISTIC_STYLE_QUALITY,
  makeSmartBalancedPolicy,
  makeRealisticBalancedPolicy,
  makeStrawmanBalancedPolicy,
  makeStylePolicy,
  makeRandomPolicy,
  makePoorPolicy,
  createSimulation,
};
