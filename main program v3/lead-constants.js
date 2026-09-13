// ============================================
// LEAD CONSTANTS - SINGLE SOURCE OF TRUTH
// ============================================
// BUGFIX (audit H4): LEAD quality thresholds, balance thresholds, the growth
// target and the per-scenario LEAD benchmark were duplicated (and DIVERGENT)
// across scoring.js and executive-summary-generator.js. The same player could
// be described as "exceptional" by the scoring engine (>= 0.78) but only
// "Strong (70%+)" in the executive summary (>= 0.85), which eroded trust in
// the feedback (design-intent clause 6: cross-file consistency).
//
// This module is the ONE canonical definition. Both files consume it. If a
// threshold is ever rebalanced, it changes here and everywhere at once.
//
// Loaded via <script src="lead-constants.js"> BEFORE scoring.js and
// executive-summary-generator.js. Exposed on window.LEAD_CONSTANTS so it works
// in both the browser and the Node verification harness (which can require()
// this file directly).
(function (root) {
  "use strict";

  const LEAD_CONSTANTS = {
    // --- LEAD quality tiers (ratio of the per-scenario benchmark) ---
    // Canonical values are the ones that drive the win conditions in
    // scoring.js calculateFinalScore(). The executive summary now uses the
    // SAME values so both artefacts describe a run identically.
    exceptionalLEAD: 0.78, // "Exceptional" LEAD (top tier)
    solidLEAD: 0.65, // "Solid performer" LEAD (upper-mid tier)
    strongLEAD: 0.5, // "Strong" LEAD (mid tier)
    minimumLEAD: 0.5, // Minimum LEAD quality floor for any win
    // Individual dimension floor: no single LEAD dimension may be ignored.
    minimumDimensionRatio: 0.35,

    // --- Balance thresholds (max % of a single Goleman style) ---
    // wellBalanced: no single style above 50% (rewards genuine range).
    // isBalanced: no single style above 60% (used by isBalancedLeadership()).
    // reasonablyBalanced: no single style above 70% (prevents extremes).
    wellBalancedMax: 50,
    isBalancedMax: 60,
    reasonablyBalancedMax: 70,

    // --- Business targets ---
    growthTarget: 15, // Headline revenue-growth target (%)
    minGrowthFloor: 10, // Minimum growth required by every win path (%)

    // --- LEAD benchmark scale ---
    // 19 points per dimension per scenario (canonical LEAD scale). The
    // cumulative target is therefore 9 x 19 = 171 (Round 1) and
    // 6 x 19 = 114 (Round 2). Only the scenario count changes with the round.
    benchmarkPerScenario: 19,
    round1Scenarios: 9,
    round2Scenarios: 6,

    // --- LEAD dimension hard cap (per game-engine.js) ---
    leadDimensionCap: 250,

    // --- LEAD score-breakdown maximums (per-dimension, per scenario) ---
    // Used by renderLEADScoreBreakdown() to compute "% of maximum". These are
    // the per-scenario ceilings; multiply by the round's scenario count.
    breakdownMaxPerScenario: {
      leadership: 401 / 9,
      excellence: 450 / 9,
      agility: 233 / 9,
      determination: 318 / 9,
    },
  };

  // Helper: number of scenarios for a given round (1 or 2).
  LEAD_CONSTANTS.scenarioCountForRound = function (round) {
    return round === 2
      ? LEAD_CONSTANTS.round2Scenarios
      : LEAD_CONSTANTS.round1Scenarios;
  };

  // Helper: cumulative per-dimension benchmark for a given round.
  LEAD_CONSTANTS.cumulativeBenchmarkForRound = function (round) {
    return (
      LEAD_CONSTANTS.scenarioCountForRound(round) *
      LEAD_CONSTANTS.benchmarkPerScenario
    );
  };

  // Helper: round-aware LEAD score-breakdown maximums.
  LEAD_CONSTANTS.breakdownMaximumsForRound = function (round) {
    const count = LEAD_CONSTANTS.scenarioCountForRound(round);
    const per = LEAD_CONSTANTS.breakdownMaxPerScenario;
    return {
      leadership: Math.round(per.leadership * count),
      excellence: Math.round(per.excellence * count),
      agility: Math.round(per.agility * count),
      determination: Math.round(per.determination * count),
    };
  };

  // Helper: classify a LEAD ratio into a canonical tier label.
  LEAD_CONSTANTS.leadTier = function (ratio) {
    if (ratio >= LEAD_CONSTANTS.exceptionalLEAD) return "exceptional";
    if (ratio >= LEAD_CONSTANTS.strongLEAD) return "strong";
    if (ratio >= LEAD_CONSTANTS.minimumLEAD) return "adequate";
    return "below";
  };

  root.LEAD_CONSTANTS = LEAD_CONSTANTS;

  // CommonJS export so the Node verification harness can require() this file.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = LEAD_CONSTANTS;
  }
})(typeof window !== "undefined" ? window : globalThis);
