// ============================================
// Verification harness for the culture-store hydration repair.
//
// Reproduces the reported bug: the browser's jcb_culture_data holds flat rows
// written by an OLDER build that did NOT persist the segmentation fields
// (jobFunction / seniority / leadCohort). Those rows fail isCultureEligible()
// and the dashboard reports "0 players" even though the leaderboard has 19.
//
// This harness:
//   1. builds a fake localStorage seeded with STALE rows (no jobFunction);
//   2. stubs ResultsStore.fetchCohort() to return the AUTHORITATIVE canonical
//      cohort (with player.jobFunction etc.);
//   3. runs GameEngine.hydrateCultureFromServer();
//   4. asserts the stale rows were repaired and now pass isCultureEligible().
// ============================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log("  PASS  " + name);
  } else {
    failed++;
    console.log("  FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

// --- Minimal localStorage shim -------------------------------------------
const store = {};
const localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

// --- Authoritative canonical cohort (as /api/cohort returns) --------------
const JCB = ["Engineering", "Manufacturing", "Commercial", "Finance", "Human Resources", "Operations", "Product Development", "Marketing", "IT / Digital"];
function canonical(i, fn) {
  return {
    runId: "run_" + i,
    timestamp: 1700000000000 + i,
    player: {
      name: "Player " + i,
      jobFunction: fn,
      seniority: i % 2 === 0 ? "Executive" : "Middle Manager",
      leadCohort: i % 3 === 0 ? "2025" : i % 3 === 1 ? "2026" : "",
    },
    consent: { publicDisplay: true },
    run: { round: 1, escaped: true, optimal: false },
    outcomes: { growth: 10 + i, morale: 70, attrition: 10, profitMargin: 15 },
    lead: { leadership: 60, excellence: 60, agility: 60, determination: 60, total: 240 },
    profile: {
      leadershipStyle: "Coaching",
      leadershipProfile: { coaching: 40, democratic: 30, authoritative: 30 },
      personalityColor: "BLUE",
    },
  };
}
const canonicalCohort = [];
for (let i = 0; i < 19; i++) canonicalCohort.push(canonical(i, JCB[i % JCB.length]));

// --- Stale flat rows (NO jobFunction / seniority / leadCohort) ------------
const staleRows = canonicalCohort.map((c) => ({
  runId: c.runId,
  timestamp: c.timestamp,
  name: c.player.name,
  growth: c.outcomes.growth,
  morale: c.outcomes.morale,
  attrition: c.outcomes.attrition,
  leadershipStyle: c.profile.leadershipStyle,
  personalityColor: c.profile.personalityColor,
  round: 1,
  // jobFunction / seniority / leadCohort deliberately ABSENT
}));

localStorage.setItem("jcb_culture_data", JSON.stringify(staleRows));
localStorage.setItem("jcb_leaderboard", JSON.stringify(staleRows));

// --- ResultsStore stub (canonicalToFlat + fetchCohort) --------------------
const ResultsStore = {
  canonicalToFlat(record) {
    const r = record || {};
    const p = r.player || {};
    const o = r.outcomes || {};
    const l = r.lead || {};
    const pr = r.profile || {};
    return {
      name: p.name,
      jobFunction: p.jobFunction,
      seniority: p.seniority,
      leadCohort: p.leadCohort,
      consent: { publicDisplay: !!(r.consent && r.consent.publicDisplay) },
      growth: o.growth,
      morale: o.morale,
      attrition: o.attrition,
      profitMargin: o.profitMargin,
      leadership: l.leadership,
      excellence: l.excellence,
      agility: l.agility,
      determination: l.determination,
      leadershipStyle: pr.leadershipStyle,
      leadershipProfile: pr.leadershipProfile,
      personalityColor: pr.personalityColor,
      round: (r.run && r.run.round) || 1,
      timestamp: r.timestamp,
      runId: r.runId,
    };
  },
  async fetchCohort() {
    return canonicalCohort;
  },
  isCultureEligible(record) {
    const fn = record && record.player ? record.player.jobFunction : record.jobFunction;
    return JCB.indexOf(fn) !== -1;
  },
};

// --- Load GameEngine in a sandbox ----------------------------------------
const SRC = path.join(__dirname, "main program v3", "game-engine.js");
const code = fs.readFileSync(SRC, "utf8");

const sandbox = {
  window: { ResultsStore, addEventListener() {}, removeEventListener() {} },
  localStorage,
  console,
  document: { addEventListener() {}, getElementById() { return null; } },
  alert() {},
  setTimeout,
  clearTimeout,
};
sandbox.window.localStorage = localStorage;
vm.createContext(sandbox);
// Expose the class (the file declares `class GameEngine`).
vm.runInContext(code + "\n;window.GameEngine = GameEngine;", sandbox);

const GameEngine = sandbox.window.GameEngine;

(async () => {
  console.log("\nCulture-store hydration repair\n");

  // BEFORE: stale rows must be ineligible.
  const before = JSON.parse(localStorage.getItem("jcb_culture_data"));
  const beforeEligible = before.filter((r) => ResultsStore.isCultureEligible(r)).length;
  check("stale store starts with 0 eligible rows", beforeEligible === 0, "got " + beforeEligible);

  // Run the repair.
  const engine = new GameEngine();
  const changed = await engine.hydrateCultureFromServer();
  check("hydrateCultureFromServer reports a change", changed === true);

  // AFTER: every row must now be eligible.
  const after = JSON.parse(localStorage.getItem("jcb_culture_data"));
  const afterEligible = after.filter((r) => ResultsStore.isCultureEligible(r)).length;
  check("all 19 rows eligible after hydration", afterEligible === 19, "got " + afterEligible);
  check("culture store still has 19 rows (no duplicates)", after.length === 19, "got " + after.length);

  const sample = after.find((r) => r.runId === "run_0");
  check("sample row gained jobFunction", sample && sample.jobFunction === "Engineering", sample && sample.jobFunction);
  check("sample row gained seniority", sample && !!sample.seniority, sample && sample.seniority);
  check("sample row gained leadCohort", sample && sample.leadCohort === "2025", sample && sample.leadCohort);

  // Leaderboard store repaired too.
  const lb = JSON.parse(localStorage.getItem("jcb_leaderboard"));
  const lbEligible = lb.filter((r) => ResultsStore.isCultureEligible(r)).length;
  check("leaderboard store also repaired (19 eligible)", lbEligible === 19, "got " + lbEligible);

  // Idempotency: a second run must not duplicate or report a change.
  const changed2 = await engine.hydrateCultureFromServer();
  const after2 = JSON.parse(localStorage.getItem("jcb_culture_data"));
  check("second hydration is a no-op (idempotent)", changed2 === false, "changed=" + changed2);
  check("row count stable after second run", after2.length === 19, "got " + after2.length);

  console.log("\n" + passed + " passed, " + failed + " failed\n");
  process.exit(failed === 0 ? 0 : 1);
})();
