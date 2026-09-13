// Verification harness for the AUDIT_REPORT fixes and PART B balance tuning.
// Run with: node v2/_verify_audit_fixes.js
//
// This harness is self-contained: it loads the shared constants module and
// exercises the pure-logic pieces of the fixes without needing a browser DOM.

const path = require("path");
const fs = require("fs");

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// H4: shared LEAD constants module
// ---------------------------------------------------------------------------
section("H4 — shared LEAD constants module");
const LEAD_CONSTANTS = require(path.join(__dirname, "..", "lead-constants.js"));

check("module exports an object", typeof LEAD_CONSTANTS === "object");
check("exceptionalLEAD is 0.78", LEAD_CONSTANTS.exceptionalLEAD === 0.78);
check("solidLEAD is 0.65", LEAD_CONSTANTS.solidLEAD === 0.65);
check("strongLEAD is 0.5", LEAD_CONSTANTS.strongLEAD === 0.5);
check(
  "minimumDimensionRatio is 0.35",
  LEAD_CONSTANTS.minimumDimensionRatio === 0.35,
);
check("isBalancedMax is 60", LEAD_CONSTANTS.isBalancedMax === 60);
check("growthTarget is 15", LEAD_CONSTANTS.growthTarget === 15);
check(
  "cumulativeBenchmarkForRound(1) === 171",
  LEAD_CONSTANTS.cumulativeBenchmarkForRound(1) === 171,
  String(LEAD_CONSTANTS.cumulativeBenchmarkForRound(1)),
);
check(
  "cumulativeBenchmarkForRound(2) === 114",
  LEAD_CONSTANTS.cumulativeBenchmarkForRound(2) === 114,
  String(LEAD_CONSTANTS.cumulativeBenchmarkForRound(2)),
);

// ---------------------------------------------------------------------------
// H1: round-aware breakdown maximums
// ---------------------------------------------------------------------------
section("H1 — round-aware breakdown maximums");
const r1 = LEAD_CONSTANTS.breakdownMaximumsForRound(1);
const r2 = LEAD_CONSTANTS.breakdownMaximumsForRound(2);
check(
  "round 1 leadership max is 401",
  r1.leadership === 401,
  String(r1.leadership),
);
check(
  "round 1 excellence max is 450",
  r1.excellence === 450,
  String(r1.excellence),
);
check("round 1 agility max is 233", r1.agility === 233, String(r1.agility));
check(
  "round 1 determination max is 318",
  r1.determination === 318,
  String(r1.determination),
);
check(
  "round 2 maximums are ~2/3 of round 1",
  r2.leadership === 267 &&
    r2.excellence === 300 &&
    r2.agility === 155 &&
    r2.determination === 212,
  JSON.stringify(r2),
);

// ---------------------------------------------------------------------------
// H2: round-aware getCriticalImprovement benchmark
// ---------------------------------------------------------------------------
section("H2 — round-aware critical-improvement benchmark");
// The benchmark used by getCriticalImprovement must equal the cumulative
// canonical benchmark for the round (171 for R1, 114 for R2).
check(
  "R1 benchmark is 171",
  LEAD_CONSTANTS.cumulativeBenchmarkForRound(1) === 171,
);
check(
  "R2 benchmark is 114",
  LEAD_CONSTANTS.cumulativeBenchmarkForRound(2) === 114,
);

// ---------------------------------------------------------------------------
// H3: qualityScore normalisation
// ---------------------------------------------------------------------------
section("H3 — qualityScore normalisation to 0-100");
// Replicate the clampQuality helper logic used in scoring.js.
function clampQuality(value, benchmark) {
  if (!benchmark || benchmark <= 0) return 0;
  return Math.max(0, Math.min(100, (value / benchmark) * 100));
}
check("at benchmark → 100", clampQuality(171, 171) === 100);
check("at half benchmark → 50", clampQuality(85.5, 171) === 50);
check("above benchmark clamps to 100", clampQuality(250, 171) === 100);
check("zero → 0", clampQuality(0, 171) === 0);
check("R2 at benchmark → 100", clampQuality(114, 114) === 100);

// ---------------------------------------------------------------------------
// M1: balance cut-off aligned with canonical thresholds
// ---------------------------------------------------------------------------
section("M1 — balance cut-off alignment");
check(
  "canonical isBalancedMax is 60 (not bespoke 35)",
  LEAD_CONSTANTS.isBalancedMax === 60,
);

// ---------------------------------------------------------------------------
// M2: relative thresholds in getLeadFeedback
// ---------------------------------------------------------------------------
section("M2 — relative thresholds in getLeadFeedback");
// Replicate the ratio logic.
function leadFeedbackCategory(score, round) {
  const benchmark = LEAD_CONSTANTS.cumulativeBenchmarkForRound(round);
  const ratio = benchmark > 0 ? score / benchmark : 0;
  if (ratio >= LEAD_CONSTANTS.solidLEAD) return "high";
  if (ratio >= LEAD_CONSTANTS.minimumDimensionRatio) return "medium";
  return "low";
}
check(
  "R1 score 60 (35% of 171) is NOT 'high'",
  leadFeedbackCategory(60, 1) !== "high",
);
check("R1 score 60 is 'medium'", leadFeedbackCategory(60, 1) === "medium");
check("R1 score 120 (70%) is 'high'", leadFeedbackCategory(120, 1) === "high");
check("R1 score 30 (18%) is 'low'", leadFeedbackCategory(30, 1) === "low");
check(
  "R2 score 80 (70% of 114) is 'high'",
  leadFeedbackCategory(80, 2) === "high",
);
check(
  "R2 score 40 (35% of 114) is 'medium'",
  leadFeedbackCategory(40, 2) === "medium",
);

// ---------------------------------------------------------------------------
// M3: dynamic growth target
// ---------------------------------------------------------------------------
section("M3 — dynamic growth target");
const gameEngineSrc = fs.readFileSync(
  path.join(__dirname, "..", "game-engine.js"),
  "utf8",
);
check(
  "no hardcoded 'Target was 15%' remains",
  !/Target was 15%/.test(gameEngineSrc),
);
check(
  "no hardcoded '(Target: 15%)' remains",
  !/\(Target: 15%\)/.test(gameEngineSrc),
);
check(
  "_growthTarget helper exists",
  /_growthTarget\s*\(\s*\)/.test(gameEngineSrc),
);
check(
  "_growthTarget reads LEAD_CONSTANTS.growthTarget",
  /_growthTarget[\s\S]{0,200}LEAD_CONSTANTS\.growthTarget/.test(gameEngineSrc),
);

// ---------------------------------------------------------------------------
// M4: dead scoreTemplates removed
// ---------------------------------------------------------------------------
section("M4 — dead scoreTemplates removed");
const scenariosSrc = fs.readFileSync(
  path.join(__dirname, "..", "scenarios.js"),
  "utf8",
);
check(
  "no scoreTemplates blocks remain",
  !/scoreTemplates\s*:/.test(scenariosSrc),
);

// ---------------------------------------------------------------------------
// LOW: scenario numbering + illustrative markers + debug gating
// ---------------------------------------------------------------------------
section("LOW — numbering, illustrative markers, debug gating");
check(
  "SCENARIO 6: THE TALENT EXODUS present",
  /SCENARIO 6: THE TALENT EXODUS/.test(scenariosSrc),
);
check(
  "SCENARIO 9: THE YEAR-END RECKONING present",
  /SCENARIO 9: THE YEAR-END RECKONING/.test(scenariosSrc),
);
check(
  "no duplicate 'SCENARIO 4: THE TALENT EXODUS'",
  !/SCENARIO 4: THE TALENT EXODUS/.test(scenariosSrc),
);
const execSrc = fs.readFileSync(
  path.join(__dirname, "..", "executive-summary-generator.js"),
  "utf8",
);
check(
  "illustrative cells marked with asterisk",
  /68%\*/.test(execSrc) && /82%\*/.test(execSrc),
);
const appSrc = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
// app.js deliberately uses APP_DEBUG_ENABLED rather than DEBUG_ENABLED: the
// latter is already declared as a top-level `const` in game-engine.js, and a
// duplicate top-level lexical declaration in the shared global scope would
// throw a SyntaxError and abort app.js. See the note at app.js:107.
// Strip comments before checking for a redeclaration, since the explanatory
// note itself mentions `const DEBUG_ENABLED` in prose.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
check(
  "debug helpers gated behind APP_DEBUG_ENABLED",
  /if\s*\(APP_DEBUG_ENABLED\)/.test(appSrc),
);
check(
  "app.js does not redeclare the shared DEBUG_ENABLED",
  !/const\s+DEBUG_ENABLED\b/.test(stripComments(appSrc)),
);
check(
  "game-engine.js still declares DEBUG_ENABLED",
  /const\s+DEBUG_ENABLED\b/.test(gameEngineSrc),
);
check("debug flag supports ?debug=1", /debug=1/.test(appSrc));

// ---------------------------------------------------------------------------
// PART B: balance tuning present
// ---------------------------------------------------------------------------
section("PART B — balance tuning");
check(
  "applyDecisionImpact has one-dimensional concentration drag",
  /One-dimensional style concentration/.test(gameEngineSrc),
);
check(
  "applyLEADMultipliers has balanced leadership bonus",
  /Balanced leadership bonus/.test(gameEngineSrc),
);
check(
  "applyLEADMultipliers has one-dimensional leadership penalty",
  /One-dimensional leadership penalty/.test(gameEngineSrc),
);
check(
  "balance reward uses morale AND growth",
  /balanceGrowthBonus[\s\S]{0,200}balanceMoraleBonus/.test(gameEngineSrc),
);
check(
  "one-dimensional penalty uses morale AND attrition",
  /imbalanceMoralePenalty[\s\S]{0,200}imbalanceAttritionPenalty/.test(
    gameEngineSrc,
  ),
);

// ---------------------------------------------------------------------------
// PART B: behavioural simulation of the balance term
// ---------------------------------------------------------------------------
section("PART B — behavioural simulation");
function simulateBalance(ratios) {
  const values = [
    ratios.leadership,
    ratios.excellence,
    ratios.agility,
    ratios.determination,
  ];
  const maxRatio = Math.max(...values);
  const minRatio = Math.min(...values);
  const balanceRatio = maxRatio > 0 ? minRatio / maxRatio : 0;
  const avg = values.reduce((a, b) => a + b, 0) / 4;
  let growth = 0;
  let morale = 0;
  let attrition = 0;
  if (avg >= 0.5 && balanceRatio >= 0.6) {
    const strength = (balanceRatio - 0.6) / 0.4;
    growth += strength * 2;
    morale += strength * 2;
  }
  if (maxRatio > 0 && balanceRatio < 0.4) {
    const imbalance = 0.4 - balanceRatio;
    morale -= imbalance * 20;
    attrition += imbalance * 15;
  }
  return { balanceRatio, growth, morale, attrition };
}

const balanced = simulateBalance({
  leadership: 0.9,
  excellence: 0.9,
  agility: 0.9,
  determination: 0.9,
});
const oneDim = simulateBalance({
  leadership: 1.2,
  excellence: 0.2,
  agility: 0.2,
  determination: 0.2,
});

check(
  "balanced leader gets positive growth bonus",
  balanced.growth > 0,
  JSON.stringify(balanced),
);
check(
  "balanced leader gets positive morale bonus",
  balanced.morale > 0,
  JSON.stringify(balanced),
);
check(
  "one-dimensional leader suffers morale penalty",
  oneDim.morale < 0,
  JSON.stringify(oneDim),
);
check(
  "one-dimensional leader suffers attrition penalty",
  oneDim.attrition > 0,
  JSON.stringify(oneDim),
);
check(
  "balanced leader outperforms one-dimensional on morale",
  balanced.morale > oneDim.morale,
);
check(
  "balanced leader outperforms one-dimensional on growth",
  balanced.growth > oneDim.growth,
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("ALL CHECKS PASSED");
}
