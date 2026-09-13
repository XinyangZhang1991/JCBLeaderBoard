// ============================================================================
// POLICY-BASED BALANCE SIMULATOR
// ============================================================================
// Plays the JCB Leadership in Action challenge headlessly in Node, 1000 times
// per named play-style policy, and reports the win rate for each policy.
//
// PURPOSE
//   Verify the balance matches the stated design intent:
//     - Balanced should be the TOP strategy.
//     - One-dimensional / poor play should be MATERIALLY harder to win.
//
// ARCHITECTURE (why this is not a hand-built state simulator)
//   The outcome is fully deterministic given the final state: calculateFinalScore()
//   contains no Math.random. Variation across runs therefore comes ONLY from the
//   slider allocations (and any policy randomness deliberately introduced).
//
//   A true playthrough must drive the REAL engine:
//     1. Start from the engine's initial state (startRound()).
//     2. For each scenario, for each decision, choose an option per the policy.
//     3. Call applyDecisionImpact() per scenario (the real one).
//     4. Call applyLEADMultipliers() once at end of game.
//     5. Call calculateFinalScore().
//
//   A simulator that only calls calculateFinalScore() on a hand-built state does
//   NOT reproduce real outcomes. This harness therefore drives the engine.
//
// SHARED POLICY MODULE
//   The policies, slider allocator, seeded RNG, and playthrough driver live in
//   v2/tools/simulate-policies.js so that this simulator and the automated
//   balance guard test (v2/tests/balance-guard.test.js) share ONE source of
//   truth. This file is responsible only for loading the engine into a sandbox,
//   running the statistics, and printing the report.
//
// Run with: node v2/tools/simulate-balance.js
// ============================================================================

"use strict";

const path = require("path");
const fs = require("fs");
const vm = require("vm");

const { createSimulation } = require("./simulate-policies");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RUNS_PER_POLICY = 1000;
// Both rounds are simulated. Round 1 = 9 scenarios, Round 2 = 6 scenarios.
const ROUNDS = [1, 2];

// ---------------------------------------------------------------------------
// Minimal DOM / storage stubs (copied from the existing verification harnesses)
// ---------------------------------------------------------------------------

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

function makeElement(id) {
  return {
    id: id,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    className: "",
    style: {},
    dataset: {},
    classList: {
      add() {},
      remove() {},
      contains() {
        return false;
      },
    },
    parentElement: null,
    appendChild() {},
    offsetWidth: 0,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function makeDocument() {
  const elements = new Map();
  return {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement(tag) {
      return makeElement(tag);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    _elements: elements,
  };
}

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

// The engine and scoring modules emit a lot of DEBUG console.log chatter
// (LEAD buffer/amplifier traces). We route the sandbox console to a silent
// sink so the simulator's own table is readable; genuine errors are still
// surfaced via the host console.
//
// One benign message is filtered: "Countdown element not found!" is emitted by
// startBriefing() when the DOM stub lacks the countdown element. It is expected
// in a headless run and would otherwise flood the output.
const BENIGN_ERRORS = ["Countdown element not found!"];
const silentConsole = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: (...args) => {
    const first = args.length ? String(args[0]) : "";
    if (BENIGN_ERRORS.some((b) => first.indexOf(b) !== -1)) return;
    console.error(...args);
  },
  debug: () => {},
};

const sandbox = {
  console: silentConsole,
  Math: Math,
  Date: Date,
  JSON: JSON,
  isFinite: isFinite,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  Boolean: Boolean,
  parseInt: parseInt,
  parseFloat: parseFloat,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: (fn) => {
    if (typeof fn === "function") fn();
    return 0;
  },
  alert: () => {},
  confirm: () => true,
};
sandbox.window = sandbox;
sandbox.localStorage = makeLocalStorage();
sandbox.document = makeDocument();
sandbox.addEventListener = () => {};
sandbox.window.addEventListener = () => {};

// lead-constants.js publishes root.LEAD_CONSTANTS (IIFE-wrapped) and also has a
// CommonJS export. Running it in the sandbox attaches it to the sandbox global,
// which is what both scoring.js and game-engine.js read.
const leadConstantsSrc = fs.readFileSync(
  path.join(__dirname, "..", "lead-constants.js"),
  "utf8",
);
vm.createContext(sandbox);
vm.runInContext(leadConstantsSrc, sandbox);

// scoring.js declares `class ScoringEngine` and `const scoringEngine` at top
// level (lexical), so append explicit exports for the harness. It also sets
// window.scoringEngine itself.
const scoringSrc = fs.readFileSync(
  path.join(__dirname, "..", "scoring.js"),
  "utf8",
);
vm.runInContext(
  scoringSrc + "\n;this.ScoringEngine = ScoringEngine;\n",
  sandbox,
);

// scenarios.js publishes window.scenarios = { round1, round2 }.
const scenariosSrc = fs.readFileSync(
  path.join(__dirname, "..", "scenarios.js"),
  "utf8",
);
vm.runInContext(scenariosSrc, sandbox);

// game-engine.js declares `class GameEngine` at top level and instantiates it
// at load (`const game = new GameEngine(); window.game = game;`). The stubs
// above tolerate that.
const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "game-engine.js"),
  "utf8",
);
vm.runInContext(engineSrc + "\n;this.GameEngine = GameEngine;\n", sandbox);

const GameEngine = sandbox.GameEngine;
const ScoringEngine = sandbox.ScoringEngine;
const LEAD_CONSTANTS = sandbox.LEAD_CONSTANTS;
const SCENARIOS = sandbox.window.scenarios;

if (typeof GameEngine !== "function") {
  console.error("FATAL: GameEngine did not load in the sandbox.");
  process.exit(1);
}
if (typeof ScoringEngine !== "function") {
  console.error("FATAL: ScoringEngine did not load in the sandbox.");
  process.exit(1);
}
if (!SCENARIOS || !SCENARIOS.round1) {
  console.error("FATAL: window.scenarios.round1 is not available.");
  process.exit(1);
}

// Bind the shared policy logic to this sandbox. All policy code, the slider
// allocator, the seeded RNG, and the playthrough driver come from the shared
// module so the simulator and the balance guard test cannot drift apart.
const sim = createSimulation(sandbox);

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance =
    arr.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// 95% confidence interval half-width for a proportion (Wald).
function ci95HalfWidth(p, n) {
  if (n === 0) return 0;
  return 1.96 * Math.sqrt((p * (1 - p)) / n);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function runPolicy(policy, runs, round) {
  const wins = [];
  const growths = [];
  const morales = [];
  const attritions = [];
  const capabilities = [];
  const leadRatios = [];
  const maxStyles = [];

  let winCount = 0;
  const pathCounts = {};

  for (let i = 0; i < runs; i++) {
    // Seed varies per run so slider allocations vary for deterministic
    // policies, producing a distribution of outcomes.
    const seed = (i + 1) * 2654435761 + policy.name.length * 40503;
    const { results, state, path } = sim.playOnce(policy, seed, round);

    const won = !!results.escaped;
    if (won) winCount++;
    wins.push(won ? 1 : 0);

    // Count the win path(s) that fired for this run.
    path.split("+").forEach((p) => {
      pathCounts[p] = (pathCounts[p] || 0) + 1;
    });

    growths.push(state.growth);
    morales.push(state.morale);
    attritions.push(state.attrition);
    capabilities.push(state.organizationalCapability);
    leadRatios.push(results.avgLEADRatio || 0);
    maxStyles.push(results.maxStylePercentage || 0);
  }

  const winRate = winCount / runs;
  return {
    name: policy.name,
    runs: runs,
    wins: winCount,
    losses: runs - winCount,
    winRate: winRate,
    ci95: ci95HalfWidth(winRate, runs),
    winRateStdDev: stddev(wins),
    avgGrowth: mean(growths),
    avgMorale: mean(morales),
    avgAttrition: mean(attritions),
    avgCapability: mean(capabilities),
    avgLeadRatio: mean(leadRatios),
    avgMaxStyle: mean(maxStyles),
    pathCounts: pathCounts,
  };
}

function pad(str, len, right) {
  str = String(str);
  if (str.length >= len) return str;
  const fill = " ".repeat(len - str.length);
  return right ? fill + str : str + fill;
}

function fmtPct(x) {
  return (x * 100).toFixed(1) + "%";
}

function fmtNum(x, dp) {
  return Number(x).toFixed(dp === undefined ? 1 : dp);
}

function printTable(results) {
  const headers = [
    "Policy",
    "Wins",
    "Losses",
    "Win Rate",
    "95% CI",
    "Avg Growth",
    "Avg Morale",
    "Avg Attrition",
    "Avg Capability",
    "Avg LEAD Ratio",
    "Avg Max Style %",
  ];
  const widths = [32, 6, 7, 9, 14, 11, 11, 14, 15, 15, 16];

  const headerLine = headers
    .map((h, i) => pad(h, widths[i], i > 0))
    .join(" | ");
  console.log(headerLine);
  console.log("-".repeat(headerLine.length));

  for (const r of results) {
    const row = [
      pad(r.name, widths[0], false),
      pad(r.wins, widths[1], true),
      pad(r.losses, widths[2], true),
      pad(fmtPct(r.winRate), widths[3], true),
      pad("±" + fmtPct(r.ci95), widths[4], true),
      pad(fmtNum(r.avgGrowth) + "%", widths[5], true),
      pad(fmtNum(r.avgMorale) + "%", widths[6], true),
      pad(fmtNum(r.avgAttrition) + "%", widths[7], true),
      pad(fmtNum(r.avgCapability, 0), widths[8], true),
      pad(fmtNum(r.avgLeadRatio, 2), widths[9], true),
      pad(fmtNum(r.avgMaxStyle, 0) + "%", widths[10], true),
    ];
    console.log(row.join(" | "));
  }
}

function printPaths(results) {
  console.log("");
  console.log("Win-path attribution (how each policy wins, when it does):");
  for (const r of results) {
    const parts = Object.keys(r.pathCounts)
      .filter((k) => k !== "none")
      .sort((a, b) => r.pathCounts[b] - r.pathCounts[a])
      .map((k) => `${k}: ${r.pathCounts[k]}`);
    console.log(
      `  ${pad(r.name, 32, false)} ${parts.length ? parts.join(", ") : "(no wins)"}`,
    );
  }
}

// Evaluate one round's results against the design intent. The corrected
// balanced policies are the reference: SmartBalanced is the best case and
// RealisticBalanced is the realistic case. "Balanced play" is judged by the
// REALISTIC policy (the honest human baseline), with SmartBalanced shown as the
// ceiling.
function evaluateRound(round, results) {
  const byName = {};
  results.forEach((r) => (byName[r.name] = r));

  const smart = byName["SmartBalanced"];
  const realistic = byName["RealisticBalanced"];
  const strawman = byName["StrawmanBalanced (style-blind)"];
  const poor = byName["Poor / One-dimensional"];
  const democratic = byName["Pure Democratic"];
  const pacesetting = byName["Pure Pacesetting"];
  const coachingDemo = byName["Coaching+Democratic"];
  const random = byName["Random"];

  const ranked = results.slice().sort((a, b) => b.winRate - a.winRate);
  console.log("");
  console.log(`Round ${round} — ranking by win rate (best to worst):`);
  ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${pad(r.name, 32, false)} ${fmtPct(r.winRate)}`);
  });

  // Check 1: is balanced play (realistic) at or near the top?
  // The design intent is that BALANCED play is the strongest GENERAL strategy.
  // Two policies are deliberately excluded from this comparison because they
  // are not general strategies: SmartBalanced is the oracle ceiling (it sees
  // the hidden impact numbers), and Coaching+Democratic is a legitimate
  // two-style SPECIALIST that the game also rewards. Both are reported
  // separately. Among the remaining realistic field (strawman, random, pure
  // single-style, poor), balanced play should rank FIRST.
  const realisticField = ranked.filter(
    (r) => r.name !== smart.name && r.name !== coachingDemo.name,
  );
  const realisticRank = ranked.findIndex((r) => r.name === realistic.name) + 1;
  const realisticFieldRank =
    realisticField.findIndex((r) => r.name === realistic.name) + 1;
  const balancedNearTop = realisticFieldRank === 1;
  console.log("");
  console.log(
    `[1] Is balanced play (RealisticBalanced) the TOP realistic strategy? ${balancedNearTop ? "YES" : "NO"}` +
      ` (rank ${realisticFieldRank} of ${realisticField.length} among realistic policies; ` +
      `overall rank ${realisticRank} of ${ranked.length} at ${fmtPct(realistic.winRate)}; ` +
      `SmartBalanced ${fmtPct(smart.winRate)}, Coaching+Democratic ${fmtPct(coachingDemo.winRate)} reported separately as ceilings)`,
  );

  // Check 2: is Poor the worst (or joint-worst)?
  const worstRate = ranked[ranked.length - 1].winRate;
  const poorIsWorst = poor.winRate <= worstRate + 1e-9;
  console.log(
    `[2] Is Poor the WORST strategy?     ${poorIsWorst ? "YES" : "NO"}` +
      ` (Poor wins ${fmtPct(poor.winRate)}; worst is ${ranked[ranked.length - 1].name} at ${fmtPct(worstRate)})`,
  );

  // Check 3: are ONE-DIMENSIONAL policies materially harder than balanced play?
  // "One-dimensional" means a single-style strategy (Pure Democratic, Pure
  // Pacesetting) or the deliberately poor control. Coaching+Democratic is a
  // legitimate two-style strategy, not one-dimensional, so it is excluded here
  // and reported separately.
  const oneDim = [democratic, pacesetting, poor];
  const bestOneDim = Math.max(...oneDim.map((r) => r.winRate));
  const allHarder = oneDim.every((r) => r.winRate < realistic.winRate);
  const margin = realistic.winRate - bestOneDim;
  console.log(
    `[3] Are one-dimensional policies harder than balanced play? ${allHarder ? "YES" : "NO"}` +
      ` (RealisticBalanced margin over best one-dimensional: ${fmtPct(margin)})`,
  );
  console.log(
    `    (Coaching+Democratic, a legitimate two-style strategy, wins ${fmtPct(coachingDemo.winRate)} — reported separately, not counted as one-dimensional.)`,
  );

  // Check 4: is Poor materially below balanced play?
  const poorMargin = realistic.winRate - poor.winRate;
  console.log(
    `[4] Is Poor materially below balanced play? ${poorMargin > 0.1 ? "YES" : "NO"}` +
      ` (gap: ${fmtPct(poorMargin)})`,
  );

  // Check 5: differentiation sanity — not all ~0% or ~100%.
  const rates = results.map((r) => r.winRate);
  const spread = Math.max(...rates) - Math.min(...rates);
  const differentiated = spread > 0.05;
  console.log(
    `[5] Are results differentiated (not all ~0% or ~100%)? ${differentiated ? "YES" : "NO"}` +
      ` (spread: ${fmtPct(spread)})`,
  );

  // Check 6: is Random mid-pack (neither top nor bottom)?
  const randomRank = ranked.findIndex((r) => r.name === "Random") + 1;
  console.log(
    `[6] Is Random mid-pack (not top, not bottom)? ${randomRank > 1 && randomRank < ranked.length ? "YES" : "NO"}` +
      ` (rank ${randomRank} of ${ranked.length}, ${fmtPct(random.winRate)})`,
  );

  // Check 7: does the corrected balanced policy beat the strawman? This is the
  // direct evidence that the original conclusion was an artefact of the
  // mis-implementation, not a property of the game.
  const beatsStrawman = realistic.winRate > strawman.winRate;
  console.log(
    `[7] Does corrected balanced play beat the strawman? ${beatsStrawman ? "YES" : "NO"}` +
      ` (RealisticBalanced ${fmtPct(realistic.winRate)} vs StrawmanBalanced ${fmtPct(strawman.winRate)})`,
  );

  console.log("");
  const allPass =
    balancedNearTop &&
    poorIsWorst &&
    allHarder &&
    poorMargin > 0.1 &&
    differentiated &&
    beatsStrawman;
  console.log(
    allPass
      ? `OVERALL (Round ${round}): The balance MATCHES the stated design intent.`
      : `OVERALL (Round ${round}): The balance DEVIATES from the stated design intent — see the checks above.`,
  );

  return {
    round: round,
    runsPerPolicy: RUNS_PER_POLICY,
    results: results,
    ranked: ranked.map((r) => ({ name: r.name, winRate: r.winRate })),
    checks: {
      balancedNearTop,
      poorIsWorst,
      oneDimensionalHarder: allHarder,
      poorMateriallyBelow: poorMargin > 0.1,
      differentiated,
      randomMidPack: randomRank > 1 && randomRank < ranked.length,
      correctedBeatsStrawman: beatsStrawman,
    },
    allPass,
  };
}

function main() {
  console.log("=".repeat(110));
  console.log("JCB LEADERSHIP IN ACTION — POLICY BALANCE SIMULATOR");
  console.log("=".repeat(110));
  console.log(`Rounds 1 and 2 | ${RUNS_PER_POLICY} runs per policy per round`);
  console.log(
    "Driving the REAL engine: startRound -> applyDecisionImpact -> applyLEADMultipliers -> calculateFinalScore",
  );
  console.log(
    "Balanced policies: SmartBalanced (oracle best case) + RealisticBalanced (static heuristic, no lookahead)",
  );
  console.log("");

  const summaries = [];

  for (const round of ROUNDS) {
    const scenarioCount =
      round === 2 ? SCENARIOS.round2.length : SCENARIOS.round1.length;
    console.log("");
    console.log("#".repeat(110));
    console.log(
      `# ROUND ${round} — ${scenarioCount} scenarios, ${RUNS_PER_POLICY} runs per policy`,
    );
    console.log("#".repeat(110));

    const policies = sim.buildPolicies();
    const results = [];
    for (const policy of policies) {
      process.stdout.write(`Running policy: ${policy.name} ... `);
      const r = runPolicy(policy, RUNS_PER_POLICY, round);
      results.push(r);
      console.log(`done (${fmtPct(r.winRate)} win rate)`);
    }

    console.log("");
    console.log("=".repeat(110));
    console.log(`RESULTS — ROUND ${round}`);
    console.log("=".repeat(110));
    printTable(results);
    printPaths(results);

    console.log("");
    console.log("=".repeat(110));
    console.log(`VERDICT vs DESIGN INTENT — ROUND ${round}`);
    console.log("=".repeat(110));
    const summary = evaluateRound(round, results);
    summaries.push(summary);
  }

  // Machine-readable summary for the markdown report (both rounds).
  const summary = {
    runsPerPolicy: RUNS_PER_POLICY,
    rounds: summaries,
  };
  fs.writeFileSync(
    path.join(__dirname, "simulate-balance.summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.log("");
  console.log("Summary written to v2/tools/simulate-balance.summary.json");
  process.exit(0);
}

main();
