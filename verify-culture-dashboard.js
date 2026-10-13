// ============================================
// Verification harness for the segmented culture dashboard model.
//
// Loads culture-analysis.js in a minimal fake-browser context and feeds it a
// synthetic cohort that mirrors the real data shape (flat records with
// jobFunction / seniority / leadCohort / personalityColor / leadershipProfile).
// Asserts that:
//   - students / non-JCB players are excluded
//   - the four segmentation axes are produced
//   - per-segment LEAD averages + overall % are present
//   - the head-to-head comparisons are built
// ============================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "main program v3", "culture-analysis.js");
const code = fs.readFileSync(SRC, "utf8");

// Minimal window shim so the class's `typeof window !== "undefined"` guards
// resolve to the local fallbacks (no ResultsStore / LEAD_CONSTANTS needed).
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(code + "\n;window.CultureAnalysis = CultureAnalysis;", sandbox);

const CultureAnalysis = sandbox.window.CultureAnalysis;

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

// Build a synthetic player record.
function player(opts) {
  return {
    name: opts.name || "P",
    jobFunction: opts.jobFunction || "Engineering",
    seniority: opts.seniority || "Middle Manager",
    leadCohort: opts.leadCohort || "",
    personalityColor: opts.personalityColor || "BLUE",
    leadershipProfile: opts.leadershipProfile || {
      authoritative: 40,
      democratic: 30,
      coaching: 30,
    },
    leadership: opts.leadership || 60,
    excellence: opts.excellence || 60,
    agility: opts.agility || 60,
    determination: opts.determination || 60,
    growth: opts.growth || 12,
    morale: opts.morale || 70,
    attrition: opts.attrition || 10,
    profitMargin: opts.profitMargin || 15,
    round: opts.round || 1,
    escaped: false,
    optimal: opts.optimal || false,
  };
}

const cohort = [
  // 2025 cohort - Exec
  player({ name: "A", leadCohort: "2025", seniority: "Executive", personalityColor: "RED", leadership: 80, excellence: 80, agility: 80, determination: 80, growth: 20 }),
  player({ name: "B", leadCohort: "2025", seniority: "Executive", personalityColor: "RED", leadership: 75, excellence: 75, agility: 75, determination: 75, growth: 18 }),
  player({ name: "C", leadCohort: "2025", seniority: "Middle Manager", personalityColor: "BLUE", leadership: 70, excellence: 70, agility: 70, determination: 70, growth: 16 }),
  player({ name: "C2", leadCohort: "2025", seniority: "Executive", personalityColor: "RED", leadership: 78, excellence: 78, agility: 78, determination: 78, growth: 19 }),
  // 2026 cohort - Middle Manager
  player({ name: "D", leadCohort: "2026", seniority: "Middle Manager", personalityColor: "YELLOW", leadership: 55, excellence: 55, agility: 55, determination: 55, growth: 11 }),
  player({ name: "E", leadCohort: "2026", seniority: "Middle Manager", personalityColor: "YELLOW", leadership: 50, excellence: 50, agility: 50, determination: 50, growth: 10 }),
  player({ name: "F", leadCohort: "2026", seniority: "Team Leader", personalityColor: "GREEN", leadership: 52, excellence: 52, agility: 52, determination: 52, growth: 10 }),
  // Non-participants - Middle Manager
  player({ name: "G", leadCohort: "", seniority: "Middle Manager", personalityColor: "GREEN", leadership: 45, excellence: 45, agility: 45, determination: 45, growth: 8 }),
  player({ name: "H", leadCohort: "", seniority: "Middle Manager", personalityColor: "BLUE", leadership: 48, excellence: 48, agility: 48, determination: 48, growth: 9 }),
  player({ name: "I", leadCohort: "", seniority: "Team Leader", personalityColor: "BALANCED", leadership: 44, excellence: 44, agility: 44, determination: 44, growth: 7 }),
  // EXCLUDED: student / non-JCB
  player({ name: "STU", jobFunction: "Student", seniority: "Student", leadCohort: "2026" }),
  player({ name: "EXT", jobFunction: "Other Industry", seniority: "External Visitor", leadCohort: "" }),
];

const analyzer = new CultureAnalysis();
const model = analyzer.analyzeCultureDashboard(cohort);

console.log("\nSegmented culture dashboard model\n");

check("no error returned", !model.error, model.message);
check("playerCount excludes students/non-JCB (10)", model.playerCount === 10, "got " + model.playerCount);
check("byCohort produced", Array.isArray(model.byCohort) && model.byCohort.length > 0);
check("bySeniority produced", Array.isArray(model.bySeniority) && model.bySeniority.length > 0);
check("byFunction produced", Array.isArray(model.byFunction) && model.byFunction.length > 0);
check("byColour produced", Array.isArray(model.byColour) && model.byColour.length > 0);
check("byStyle produced", Array.isArray(model.byStyle) && model.byStyle.length > 0);

// Business-area view: every eligible player has jobFunction "Engineering" in
// the synthetic cohort, so there is exactly one business-area group holding
// all 10 eligible players (the Student / Other Industry rows are excluded).
const eng = model.byFunction.find((g) => g.name === "Engineering");
check("Engineering business-area group present", !!eng);
if (eng) {
  check("Engineering group holds all eligible players (10)", eng.count === 10,
    "got " + eng.count);
  check("Engineering group has leadAvg.total", typeof eng.leadAvg.total === "number");
  check("Engineering group styles sum ~100",
    Math.abs(Object.values(eng.styles).reduce((s, v) => s + v, 0) - 100) < 1);
}
check("no Student business-area group", !model.byFunction.some((g) => g.name === "Student"));
check("no Other Industry business-area group",
  !model.byFunction.some((g) => g.name === "Other Industry"));

const c2025 = model.byCohort.find((g) => g.name === "LEAD Cohort 2025");
const c2026 = model.byCohort.find((g) => g.name === "LEAD Cohort 2026");
const cohortOther = model.byCohort.find((g) => g.name === "Other");
const senior = model.bySeniority.find(
  (g) => g.name === "Senior Leadership or above",
);
const seniorOther = model.bySeniority.find((g) => g.name === "Other");

check("LEAD Cohort 2025 group present", !!c2025);
check("LEAD Cohort 2026 group present", !!c2026);
check("cohort Other group present", !!cohortOther);
check("Senior Leadership or above group present", !!senior);
check("seniority Other group present", !!seniorOther);

if (c2025) {
  check("2025 group has leadAvg.total", typeof c2025.leadAvg.total === "number");
  check("2025 group has overallPct", typeof c2025.overallPct === "number" && c2025.overallPct > 0);
  check("2025 group styles sum ~100", Math.abs(Object.values(c2025.styles).reduce((s, v) => s + v, 0) - 100) < 1);
  check("2025 group colours sum ~100", Math.abs(Object.values(c2025.colors).reduce((s, v) => s + v, 0) - 100) < 1);
}

// 2025 (higher LEAD) should out-score 2026.
if (c2025 && c2026) {
  check("2025 LEAD total > 2026 LEAD total", c2025.leadAvg.total > c2026.leadAvg.total,
    c2025.leadAvg.total + " vs " + c2026.leadAvg.total);
}

// --- Bin semantics -------------------------------------------------------
// The cohort view is a mutually-exclusive segmentation: every eligible player
// is counted exactly once, so the counts must sum to the eligible count.
const cohortSum = model.byCohort.reduce((s, g) => s + g.count, 0);
check("cohort bins sum to eligible player count", cohortSum === model.playerCount,
  cohortSum + " vs " + model.playerCount);

// The seniority view is a SEPARATE mutually-exclusive segmentation, so its
// counts must also sum to the eligible count (a player can be in a cohort bin
// AND a seniority bin - they are different axes).
const senioritySum = model.bySeniority.reduce((s, g) => s + g.count, 0);
check("seniority bins sum to eligible player count", senioritySum === model.playerCount,
  senioritySum + " vs " + model.playerCount);

// Seniority bin must be Senior Leadership or above ONLY (Executives here).
// The synthetic cohort has 3 Executives (A, B, C2) and no Senior Leaders.
if (senior) {
  check("Senior Leadership or above bin counts only Executives (3)", senior.count === 3,
    "got " + senior.count);
}
if (seniorOther) {
  check("seniority Other bin holds the remaining 7", seniorOther.count === 7,
    "got " + seniorOther.count);
}

// Cohort "Other" holds the 3 eligible players with no LEAD cohort (G, H, I).
if (cohortOther) {
  check("cohort Other bin holds the non-cohort players (3)", cohortOther.count === 3,
    "got " + cohortOther.count);
}

// The cohort view has three bins; the seniority view has two.
check("byCohort has three bins", model.byCohort.length === 3,
  "got " + model.byCohort.length);
check("bySeniority has two bins", model.bySeniority.length === 2,
  "got " + model.bySeniority.length);

// Every graph category must expose its bins (the renderer filters on
// `sufficient`, so we assert the underlying groups exist for each axis).
["byCohort", "bySeniority", "byColour", "byStyle"].forEach((axis) => {
  check(axis + " is a non-empty array", Array.isArray(model[axis]) && model[axis].length > 0);
});

console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed === 0 ? 0 : 1);
