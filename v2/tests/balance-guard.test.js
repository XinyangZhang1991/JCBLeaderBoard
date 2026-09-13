// ============================================================================
// BALANCE GUARD TEST
// ============================================================================
// Automated regression guard for the JCB Leadership in Action challenge
// balance. It converts the manual balance simulator into a deterministic,
// fast-running assertion suite so that a future scoring change which breaks
// the balance fails loudly.
//
// Run with: node v2/tests/balance-guard.test.js
//
// WHY THIS TEST EXISTS
// --------------------
// The game's design intent is that BALANCED leadership play is the strongest
// general strategy, that one-dimensional / poor play is materially harder to
// win, and that the oracle (best-case) policy wins almost always. Those
// properties are emergent from the interaction of scoring.js, game-engine.js,
// and scenarios.js. Nothing in the product code asserts them, so a well-meaning
// scoring tweak could silently invert the balance. This test encodes the
// intent as explicit thresholds.
//
// HOW IT WORKS
// ------------
// It drives the REAL engine through the genuine code path:
//   startRound() -> applyDecisionImpact() per decision -> applyLEADMultipliers()
//   -> calculateFinalScore()
// using the SAME policy implementations as v2/tools/simulate-balance.js. Those
// policies live in the shared module v2/tools/simulate-policies.js, so there is
// ONE source of truth and the test can never drift from the simulator.
//
// DETERMINISM
// -----------
// A seeded Mulberry32 PRNG is used, so the win rates are reproducible run to
// run. The test uses 200 runs per policy per round (rather than the
// simulator's 1000) to keep it fast, with tolerances chosen to absorb the
// smaller-sample noise while still catching a genuine regression.
//
// Uses only Node built-ins (fs, path, vm). No external packages.
// ============================================================================

"use strict";

const path = require("path");
const fs = require("fs");
const vm = require("vm");

const { createSimulation } = require("../tools/simulate-policies");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Smaller than the simulator's 1000 so the test runs fast, but large enough
// that the tolerances below are comfortably outside the sampling noise.
const RUNS_PER_POLICY = 200;
const ROUNDS = [1, 2];

// ---------------------------------------------------------------------------
// Minimal DOM / storage stubs (mirrors the simulator and the other harnesses)
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
// The engine and scoring modules emit DEBUG console chatter. Route the sandbox
// console to a silent sink so the test's own PASS/FAIL table is readable;
// genuine errors are still surfaced via the host console. The one benign
// "Countdown element not found!" message is filtered (expected headlessly).
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

// Bind the shared policy logic to this sandbox. This is the SAME module the
// simulator uses, so the policies cannot drift between the two.
const sim = createSimulation(sandbox);

// ---------------------------------------------------------------------------
// Run the simulation
// ---------------------------------------------------------------------------

// Run every policy for one round and return a map of policy name -> win rate.
function runRound(round) {
  const policies = sim.buildPolicies();
  const rates = {};

  for (const policy of policies) {
    let winCount = 0;
    for (let i = 0; i < RUNS_PER_POLICY; i++) {
      // Same seed derivation as the simulator, so the test and the simulator
      // explore the same deterministic sequence of slider allocations.
      const seed = (i + 1) * 2654435761 + policy.name.length * 40503;
      const { results } = sim.playOnce(policy, seed, round);
      if (results.escaped) winCount++;
    }
    rates[policy.name] = winCount / RUNS_PER_POLICY;
  }

  return rates;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
// Each assertion is a named predicate over the per-round win-rate maps. The
// thresholds encode the DESIGN INTENT with tolerances that absorb the
// smaller-sample noise (200 runs) while still catching a genuine regression.
//
// Baselines (1000 runs, from v2/tools/simulate-balance.js):
//   Round 1: RealisticBalanced 48.3%, Random 26.2%, Poor 0.0%,
//            Pure Democratic 0.0%, Pure Pacesetting 0.0%, SmartBalanced 100.0%
//   Round 2: RealisticBalanced 100.0%, Random 31.3%, Poor 0.0%,
//            Pure Democratic 0.0%, Pure Pacesetting 0.0%, SmartBalanced 100.0%

const REALISTIC = "RealisticBalanced";
const SMART = "SmartBalanced";
const POOR = "Poor / One-dimensional";
const DEMOCRATIC = "Pure Democratic";
const PACESETTING = "Pure Pacesetting";
const RANDOM = "Random";

const assertions = [
  {
    name: "RealisticBalanced wins at least 35% in Round 1 (baseline 48.3%)",
    test: (r1) => r1[REALISTIC] >= 0.35,
    detail: (r1) => `actual ${fmtPct(r1[REALISTIC])}`,
  },
  {
    name: "RealisticBalanced wins at least 80% in Round 2 (baseline 100%)",
    test: (r1, r2) => r2[REALISTIC] >= 0.8,
    detail: (r1, r2) => `actual ${fmtPct(r2[REALISTIC])}`,
  },
  {
    name: "RealisticBalanced beats Poor by at least 20 percentage points in Round 1",
    test: (r1) => r1[REALISTIC] - r1[POOR] >= 0.2,
    detail: (r1) =>
      `gap ${fmtPct(r1[REALISTIC] - r1[POOR])} ` +
      `(RealisticBalanced ${fmtPct(r1[REALISTIC])} vs Poor ${fmtPct(r1[POOR])})`,
  },
  {
    name: "Poor / One-dimensional wins at most 5% in both rounds",
    test: (r1, r2) => r1[POOR] <= 0.05 && r2[POOR] <= 0.05,
    detail: (r1, r2) =>
      `Round 1 ${fmtPct(r1[POOR])}, Round 2 ${fmtPct(r2[POOR])}`,
  },
  {
    name: "Pure Democratic wins at most 5% in both rounds",
    test: (r1, r2) => r1[DEMOCRATIC] <= 0.05 && r2[DEMOCRATIC] <= 0.05,
    detail: (r1, r2) =>
      `Round 1 ${fmtPct(r1[DEMOCRATIC])}, Round 2 ${fmtPct(r2[DEMOCRATIC])}`,
  },
  {
    name: "Pure Pacesetting wins at most 5% in both rounds",
    test: (r1, r2) => r1[PACESETTING] <= 0.05 && r2[PACESETTING] <= 0.05,
    detail: (r1, r2) =>
      `Round 1 ${fmtPct(r1[PACESETTING])}, Round 2 ${fmtPct(r2[PACESETTING])}`,
  },
  {
    name: "Random wins between 10% and 45% in Round 1 (mid-pack sanity band)",
    test: (r1) => r1[RANDOM] >= 0.1 && r1[RANDOM] <= 0.45,
    detail: (r1) => `actual ${fmtPct(r1[RANDOM])}`,
  },
  {
    name: "SmartBalanced (oracle) wins at least 90% in both rounds",
    test: (r1, r2) => r1[SMART] >= 0.9 && r2[SMART] >= 0.9,
    detail: (r1, r2) =>
      `Round 1 ${fmtPct(r1[SMART])}, Round 2 ${fmtPct(r2[SMART])}`,
  },
];

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

function pad(str, len, right) {
  str = String(str);
  if (str.length >= len) return str;
  const fill = " ".repeat(len - str.length);
  return right ? fill + str : str + fill;
}

function fmtPct(x) {
  return (x * 100).toFixed(1) + "%";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("=== balance guard test ===");
  console.log(
    "Driving the REAL engine: startRound -> applyDecisionImpact -> applyLEADMultipliers -> calculateFinalScore",
  );
  console.log(
    `Rounds 1 and 2 | ${RUNS_PER_POLICY} runs per policy per round | seeded (deterministic)`,
  );
  console.log(
    "Policies shared with v2/tools/simulate-balance.js via v2/tools/simulate-policies.js",
  );
  console.log("");

  // Run both rounds. A FRESH policy roster is built per round so no usage
  // counters leak between rounds.
  const ratesByRound = {};
  for (const round of ROUNDS) {
    process.stdout.write(`Running Round ${round} ... `);
    ratesByRound[round] = runRound(round);
    console.log("done");
  }

  const r1 = ratesByRound[1];
  const r2 = ratesByRound[2];

  // --- Win-rate table -----------------------------------------------------
  // Show every policy's win rate per round, in a stable order.
  const policyOrder = [
    SMART,
    REALISTIC,
    "Coaching+Democratic",
    "StrawmanBalanced (style-blind)",
    RANDOM,
    DEMOCRATIC,
    PACESETTING,
    POOR,
  ];

  console.log("");
  console.log("WIN RATES BY POLICY");
  const header =
    pad("Policy", 32, false) +
    " | " +
    pad("Round 1", 9, true) +
    " | " +
    pad("Round 2", 9, true);
  console.log(header);
  console.log("-".repeat(header.length));
  for (const name of policyOrder) {
    console.log(
      pad(name, 32, false) +
        " | " +
        pad(fmtPct(r1[name]), 9, true) +
        " | " +
        pad(fmtPct(r2[name]), 9, true),
    );
  }

  // --- Assertion table ----------------------------------------------------
  console.log("");
  console.log("ASSERTIONS");
  let passed = 0;
  let failed = 0;
  for (const a of assertions) {
    let ok = false;
    let detail = "";
    try {
      ok = !!a.test(r1, r2);
      detail = a.detail ? a.detail(r1, r2) : "";
    } catch (e) {
      ok = false;
      detail = "error: " + e.message;
    }
    if (ok) passed++;
    else failed++;
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${a.name}` + (detail ? ` — ${detail}` : ""),
    );
  }

  // --- Summary ------------------------------------------------------------
  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("RESULT: PASS");
    process.exit(0);
  } else {
    console.log("RESULT: FAIL");
    process.exit(1);
  }
}

main();
