// Verification harness for LEAD course cohort segmentation.
// Run with: node v2/_verify_cohort_segmentation.js
//
// Covers COHORT_SEGMENTATION_DESIGN.md:
//   (a) normaliseCohort maps blank/legacy/unexpected values correctly
//   (b) cohorts segment into 2025/2026/none/course with correct counts
//   (c) deltas are null when either side is below the minimum sample size
//   (d) the culture report and dashboard render the "By LEAD Course Cohort"
//       section
//   (e) the executive summary renders the cohort comparison table AND the
//       headline
//   (f) the merge manifest includes cohortCounts
//   (g) reports render unchanged when no cohort data is present
//
// Self-contained: Node built-ins only. Browser-global scripts (culture-analysis,
// game-engine, executive-summary-generator) are loaded in a vm sandbox that
// provides `window` + `window.ResultsStore`, mirroring a file:// browser load.

const path = require("path");
const fs = require("fs");
const os = require("os");
const vm = require("vm");
const { execFileSync } = require("child_process");

const Store = require(path.join(__dirname, "..", "results-store.js"));

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
// Fixture builders
// ---------------------------------------------------------------------------

// Build a flat record with an explicit cohort + business function.
function flatRecord(opts) {
  const o = opts || {};
  return {
    runId: o.runId || "run_" + Math.random().toString(36).slice(2, 10),
    name: o.name || "Test Player",
    jobFunction: o.jobFunction === undefined ? "Engineering" : o.jobFunction,
    seniority: o.seniority || "Senior Leader",
    leadCohort: o.leadCohort,
    selfIdentifiedStyle: o.selfIdentifiedStyle || "coaching",
    growth: o.growth === undefined ? 20 : o.growth,
    morale: o.morale === undefined ? 70 : o.morale,
    attrition: o.attrition === undefined ? 8 : o.attrition,
    profitMargin: o.profitMargin === undefined ? 30 : o.profitMargin,
    organizationalCapability: 80,
    leadership: o.leadership === undefined ? 100 : o.leadership,
    excellence: o.excellence === undefined ? 100 : o.excellence,
    agility: o.agility === undefined ? 100 : o.agility,
    determination: o.determination === undefined ? 100 : o.determination,
    leadershipStyle: "Coaching",
    leadershipProfile: {
      coaching: 40,
      visionary: 20,
      affiliative: 15,
      democratic: 10,
      pacesetting: 10,
      commanding: 5,
    },
    personalityColor: "GREEN",
    escaped: true,
    optimal: false,
    round: o.round === undefined ? 1 : o.round,
    timestamp: o.timestamp || Date.now(),
    consent: o.consent === undefined ? { publicDisplay: true } : o.consent,
  };
}

// ---------------------------------------------------------------------------
// (a) normaliseCohort / leadCohortOf / isCourseParticipant
// ---------------------------------------------------------------------------
section("(a) normaliseCohort maps blank/legacy/unexpected values correctly");

check(
  "LEAD_COHORTS is ['2025','2026']",
  Array.isArray(Store.LEAD_COHORTS) &&
    Store.LEAD_COHORTS.length === 2 &&
    Store.LEAD_COHORTS[0] === "2025" &&
    Store.LEAD_COHORTS[1] === "2026",
);
check(
  "normaliseCohort('2025') === '2025'",
  Store.normaliseCohort("2025") === "2025",
);
check(
  "normaliseCohort('2026') === '2026'",
  Store.normaliseCohort("2026") === "2026",
);
check(
  "normaliseCohort(' 2025 ') trims -> '2025'",
  Store.normaliseCohort(" 2025 ") === "2025",
);
check("normaliseCohort('') === ''", Store.normaliseCohort("") === "");
check(
  "normaliseCohort(undefined) === ''",
  Store.normaliseCohort(undefined) === "",
);
check("normaliseCohort(null) === ''", Store.normaliseCohort(null) === "");
check(
  "normaliseCohort('2024') === '' (unexpected)",
  Store.normaliseCohort("2024") === "",
);
check(
  "normaliseCohort('2027') === '' (unexpected)",
  Store.normaliseCohort("2027") === "",
);
check("normaliseCohort('none') === ''", Store.normaliseCohort("none") === "");

check(
  "leadCohortOf(flat 2025) === '2025'",
  Store.leadCohortOf({ leadCohort: "2025" }) === "2025",
);
check(
  "leadCohortOf(canonical 2026) === '2026'",
  Store.leadCohortOf({ player: { leadCohort: "2026" } }) === "2026",
);
check(
  "leadCohortOf(legacy, no field) === ''",
  Store.leadCohortOf({ name: "Legacy" }) === "",
);
check("leadCohortOf(null) === ''", Store.leadCohortOf(null) === "");
check(
  "leadCohortOf(unexpected '2024') === ''",
  Store.leadCohortOf({ leadCohort: "2024" }) === "",
);

check(
  "isCourseParticipant(2025) === true",
  Store.isCourseParticipant({ leadCohort: "2025" }) === true,
);
check(
  "isCourseParticipant(blank) === false",
  Store.isCourseParticipant({ leadCohort: "" }) === false,
);
check(
  "isCourseParticipant(legacy) === false",
  Store.isCourseParticipant({ name: "Legacy" }) === false,
);

// Schema write normalisation: unexpected value stored as "".
{
  const canonical = Store.flatToCanonical(
    flatRecord({ leadCohort: "2024", runId: "run_phantom" }),
  );
  check(
    "flatToCanonical normalises '2024' -> ''",
    canonical.player.leadCohort === "",
    JSON.stringify(canonical.player.leadCohort),
  );
  const canonical2025 = Store.flatToCanonical(
    flatRecord({ leadCohort: "2025", runId: "run_ok" }),
  );
  check(
    "flatToCanonical preserves '2025'",
    canonical2025.player.leadCohort === "2025",
  );
}

// ---------------------------------------------------------------------------
// Load browser-global scripts in a vm sandbox (window + window.ResultsStore).
// ---------------------------------------------------------------------------
function loadBrowserScripts() {
  const sandbox = {
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    isFinite: isFinite,
    parseInt: parseInt,
    parseFloat: parseFloat,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    localStorage: (function () {
      const map = {};
      return {
        getItem: (k) => (k in map ? map[k] : null),
        setItem: (k, v) => {
          map[k] = String(v);
        },
        removeItem: (k) => {
          delete map[k];
        },
      };
    })(),
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, appendChild: () => {} }),
      addEventListener: () => {},
    },
    addEventListener: () => {},
    navigator: { userAgent: "node" },
    location: { search: "", href: "file:///index.html", hash: "" },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.ResultsStore = Store;
  vm.createContext(sandbox);

  const files = [
    "lead-constants.js",
    "scoring.js",
    "culture-analysis.js",
    "game-engine.js",
    "executive-summary-generator.js",
  ];
  for (const f of files) {
    const full = path.join(__dirname, "..", f);
    if (!fs.existsSync(full)) continue;
    let src = fs.readFileSync(full, "utf8");
    // game-engine.js declares GameEngine as a top-level class but does not
    // publish it to window; expose it for the harness (same trick the other
    // harnesses use).
    if (f === "game-engine.js") {
      src += "\n;this.GameEngine = GameEngine;\n";
    }
    vm.runInContext(src, sandbox, { filename: f });
  }
  return sandbox;
}

const ctx = loadBrowserScripts();
const CultureAnalysis = ctx.CultureAnalysis;
const GameEngine = ctx.GameEngine;
const ExecutiveSummaryGenerator = ctx.ExecutiveSummaryGenerator;

check("CultureAnalysis loaded", typeof CultureAnalysis === "function");
check("GameEngine loaded", typeof GameEngine === "function");
check(
  "ExecutiveSummaryGenerator loaded",
  typeof ExecutiveSummaryGenerator === "function",
);

// ---------------------------------------------------------------------------
// (b) Cohorts segment into 2025/2026/none/course with correct counts
// ---------------------------------------------------------------------------
section("(b) culture-analysis cohort segmentation counts");

const analyzer = new CultureAnalysis();

// 3x 2025, 4x 2026, 5x none = 12 eligible records.
const cohortData = [];
for (let i = 0; i < 3; i++) {
  cohortData.push(
    flatRecord({
      name: "Y25-" + i,
      leadCohort: "2025",
      growth: 10,
      morale: 60,
      attrition: 12,
    }),
  );
}
for (let i = 0; i < 4; i++) {
  cohortData.push(
    flatRecord({
      name: "Y26-" + i,
      leadCohort: "2026",
      growth: 25,
      morale: 80,
      attrition: 5,
    }),
  );
}
for (let i = 0; i < 5; i++) {
  cohortData.push(
    flatRecord({
      name: "None-" + i,
      leadCohort: "",
      growth: 5,
      morale: 50,
      attrition: 15,
    }),
  );
}

const analysis = analyzer.analyzeCulture(cohortData);
check("analysis has no error", !analysis.error, analysis.error || "");
check("analysis.cohorts exists", !!analysis.cohorts);
check(
  "byCohort['2025'].count === 3",
  analysis.cohorts.byCohort["2025"].count === 3,
  String(analysis.cohorts.byCohort["2025"].count),
);
check(
  "byCohort['2026'].count === 4",
  analysis.cohorts.byCohort["2026"].count === 4,
  String(analysis.cohorts.byCohort["2026"].count),
);
check(
  "nonParticipants.count === 5",
  analysis.cohorts.nonParticipants.count === 5,
  String(analysis.cohorts.nonParticipants.count),
);
check(
  "course roll-up count === 7",
  analysis.cohorts.course.count === 7,
  String(analysis.cohorts.course.count),
);
check(
  "course label is 'All course participants'",
  analysis.cohorts.course.label === "All course participants",
);
check(
  "2025 label is '2025 cohort'",
  analysis.cohorts.byCohort["2025"].label === "2025 cohort",
);
check(
  "none label is 'Non-participants'",
  analysis.cohorts.nonParticipants.label === "Non-participants",
);
check(
  "all four segments sufficient (>=3)",
  analysis.cohorts.byCohort["2025"].sufficient === true &&
    analysis.cohorts.byCohort["2026"].sufficient === true &&
    analysis.cohorts.nonParticipants.sufficient === true &&
    analysis.cohorts.course.sufficient === true,
);

// Unexpected value "2024" must be counted as none, not a phantom segment.
{
  const withUnexpected = cohortData.concat([
    flatRecord({ name: "Bad", leadCohort: "2024" }),
  ]);
  const a2 = analyzer.analyzeCulture(withUnexpected);
  check(
    "unexpected '2024' folds into none (count 6)",
    a2.cohorts.nonParticipants.count === 6,
    String(a2.cohorts.nonParticipants.count),
  );
  check("no phantom '2024' segment", a2.cohorts.byCohort["2024"] === undefined);
}

// ---------------------------------------------------------------------------
// (c) Deltas null when either side below the minimum sample size
// ---------------------------------------------------------------------------
section("(c) deltas null below minimum sample size");

check(
  "courseVsNone is non-null when both sides sufficient",
  analysis.cohorts.deltas.courseVsNone !== null,
);
check(
  "yoy is non-null when both years sufficient",
  analysis.cohorts.deltas.yoy !== null,
);

// 2025 has only 2 members -> below min (3): yoy and cohort2025VsNone null.
{
  const small = [];
  for (let i = 0; i < 2; i++) {
    small.push(flatRecord({ name: "s25-" + i, leadCohort: "2025" }));
  }
  for (let i = 0; i < 4; i++) {
    small.push(flatRecord({ name: "s26-" + i, leadCohort: "2026" }));
  }
  for (let i = 0; i < 4; i++) {
    small.push(flatRecord({ name: "sn-" + i, leadCohort: "" }));
  }
  const a3 = analyzer.analyzeCulture(small);
  check(
    "2025 segment (2) is not sufficient",
    a3.cohorts.byCohort["2025"].sufficient === false,
  );
  check("yoy is null when 2025 below min", a3.cohorts.deltas.yoy === null);
  check(
    "cohort2025VsNone is null when 2025 below min",
    a3.cohorts.deltas.cohort2025VsNone === null,
  );
  check(
    "cohort2026VsNone is non-null (both sufficient)",
    a3.cohorts.deltas.cohort2026VsNone !== null,
  );
  check(
    "courseVsNone is non-null (course=6, none=4)",
    a3.cohorts.deltas.courseVsNone !== null,
  );
}

// All-blank cohort: no 2025/2026 segments; all deltas null.
{
  const blanks = [];
  for (let i = 0; i < 5; i++) {
    blanks.push(flatRecord({ name: "b-" + i, leadCohort: "" }));
  }
  const a4 = analyzer.analyzeCulture(blanks);
  check(
    "all-blank: byCohort['2025'] is null",
    a4.cohorts.byCohort["2025"] === null,
  );
  check(
    "all-blank: byCohort['2026'] is null",
    a4.cohorts.byCohort["2026"] === null,
  );
  check("all-blank: course is null", a4.cohorts.course === null);
  check(
    "all-blank: all deltas null",
    a4.cohorts.deltas.yoy === null &&
      a4.cohorts.deltas.cohort2026VsNone === null &&
      a4.cohorts.deltas.cohort2025VsNone === null &&
      a4.cohorts.deltas.courseVsNone === null,
  );
  check(
    "all-blank: Course Impact observation absent",
    !a4.observations.some((o) => o.category === "Course Impact"),
  );
}

// Course Impact observation present when both sides sufficient.
check(
  "Course Impact observation present",
  analysis.observations.some((o) => o.category === "Course Impact"),
);
{
  const obs = analysis.observations.find((o) => o.category === "Course Impact");
  check(
    "Course Impact headline mentions LEAD points",
    !!obs && /LEAD points vs non-participants/.test(obs.headline),
    obs ? obs.headline : "missing",
  );
  check(
    "Course Impact detail is descriptive-not-causal",
    !!obs && /does not by itself establish/.test(obs.detail),
  );
}

// ---------------------------------------------------------------------------
// (d) Culture report + dashboard render the "By LEAD Course Cohort" section
// ---------------------------------------------------------------------------
section("(d) culture report + dashboard render cohort section");

{
  const engine = new GameEngine();
  const reportHtml = engine._buildCultureReportHtml(analysis);
  check(
    "culture report contains 'By LEAD Course Cohort'",
    reportHtml.indexOf("By LEAD Course Cohort") !== -1,
  );
  check(
    "culture report contains '2025 cohort'",
    reportHtml.indexOf("2025 cohort") !== -1,
  );
  check(
    "culture report contains 'All course participants'",
    reportHtml.indexOf("All course participants") !== -1,
  );
  check(
    "culture report contains the minimum-size footnote",
    reportHtml.indexOf("fewer than 3 leaders are not shown") !== -1,
  );

  // Dashboard: renderCultureDashboard writes into a container element.
  let captured = "";
  const fakeContainer = {
    set innerHTML(v) {
      captured = v;
    },
    get innerHTML() {
      return captured;
    },
  };
  const origGet = ctx.document.getElementById;
  ctx.document.getElementById = (id) =>
    id === "culture-content" ? fakeContainer : null;
  try {
    engine.renderCultureDashboard(analysis);
  } finally {
    ctx.document.getElementById = origGet;
  }
  check(
    "dashboard contains 'By LEAD Course Cohort'",
    captured.indexOf("By LEAD Course Cohort") !== -1,
  );
  check(
    "dashboard contains 'All course participants'",
    captured.indexOf("All course participants") !== -1,
  );
}

// ---------------------------------------------------------------------------
// (e) Executive summary renders the cohort comparison table AND the headline
// ---------------------------------------------------------------------------
section("(e) executive summary cohort comparison + headline");

function makeGenerator(cohort) {
  const gen = new ExecutiveSummaryGenerator();
  gen.cultureDataProvider = () => cohort;
  return gen;
}

{
  const gen = makeGenerator(cohortData);
  const sectionHtml = gen.generateCohortComparisonSection();
  check("comparison section is non-empty", sectionHtml.length > 0);
  check(
    "comparison heading present",
    sectionHtml.indexOf("LEAD Course Impact — Cohort Comparison") !== -1,
  );
  check(
    "comparison table headers present",
    sectionHtml.indexOf("Overall LEAD") !== -1 &&
      sectionHtml.indexOf("Style Balance") !== -1,
  );
  check(
    "comparison rows present",
    sectionHtml.indexOf("2025 cohort") !== -1 &&
      sectionHtml.indexOf("2026 cohort") !== -1 &&
      sectionHtml.indexOf("Non-participants") !== -1 &&
      sectionHtml.indexOf("All course participants") !== -1,
  );
  check(
    "comparison impact line present",
    sectionHtml.indexOf("Course participants vs non-participants") !== -1,
  );
  check(
    "comparison footnote is descriptive-not-causal",
    sectionHtml.indexOf("does not by itself establish") !== -1,
  );

  const headline = gen.generateCohortHeadline();
  check("headline is non-empty", headline.length > 0);
  check(
    "headline mentions LEAD points vs non-participants",
    headline.indexOf("LEAD points vs non-participants") !== -1,
  );
  check("headline shows n for both sides", /n=\d+ vs n=\d+/.test(headline));
  check(
    "headline includes 2026 vs 2025 line",
    headline.indexOf("2026 vs 2025") !== -1,
  );

  // minCohortSize default.
  check("minCohortSize defaults to 3", gen.minCohortSize === 3);
}

// Below-minimum cohort -> no comparison section, no headline.
{
  const small = [
    flatRecord({ name: "x1", leadCohort: "2025" }),
    flatRecord({ name: "x2", leadCohort: "" }),
  ];
  const gen = makeGenerator(small);
  check(
    "comparison section empty when all cohorts below min",
    gen.generateCohortComparisonSection() === "",
  );
  check("headline empty when below min", gen.generateCohortHeadline() === "");
}

// ---------------------------------------------------------------------------
// (f) Merge manifest includes cohortCounts
// ---------------------------------------------------------------------------
section("(f) merge manifest includes cohortCounts");

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jcb-cohort-"));
  const inDir = path.join(tmp, "raw");
  const outDir = path.join(tmp, "merged");
  fs.mkdirSync(inDir, { recursive: true });

  const fixtures = [
    flatRecord({ runId: "run_c25a", name: "C25A", leadCohort: "2025" }),
    flatRecord({ runId: "run_c25b", name: "C25B", leadCohort: "2025" }),
    flatRecord({ runId: "run_c26a", name: "C26A", leadCohort: "2026" }),
    flatRecord({ runId: "run_c26b", name: "C26B", leadCohort: "2026" }),
    flatRecord({ runId: "run_c26c", name: "C26C", leadCohort: "2026" }),
    flatRecord({ runId: "run_nonea", name: "NA", leadCohort: "" }),
    flatRecord({ runId: "run_noneb", name: "NB", leadCohort: "" }),
    flatRecord({ runId: "run_bad", name: "BAD", leadCohort: "2024" }),
  ];
  fixtures.forEach((f, i) => {
    const canonical = Store.flatToCanonical(f);
    fs.writeFileSync(
      path.join(inDir, "run_" + i + ".json"),
      JSON.stringify(canonical, null, 2),
      "utf8",
    );
  });

  execFileSync(
    process.execPath,
    [
      path.join(__dirname, "..", "tools", "merge-results.js"),
      "--in",
      inDir,
      "--out",
      outDir,
      "--top",
      "10",
    ],
    { stdio: "pipe" },
  );

  const manifest = JSON.parse(
    fs.readFileSync(path.join(outDir, "merge-manifest.json"), "utf8"),
  );
  check(
    "manifest.totals.cohortCounts exists",
    !!manifest.totals && !!manifest.totals.cohortCounts,
  );
  const cc = manifest.totals.cohortCounts || {};
  check("cohortCounts['2025'] === 2", cc["2025"] === 2, String(cc["2025"]));
  check("cohortCounts['2026'] === 3", cc["2026"] === 3, String(cc["2026"]));
  check(
    "cohortCounts.none === 3 (blank + unexpected '2024')",
    cc.none === 3,
    String(cc.none),
  );
  check("cohortCounts.course === 5", cc.course === 5, String(cc.course));

  // Determinism: re-run and compare the derived cohort counts. The manifest
  // carries a `generatedAt` timestamp, so whole-file byte comparison is not a
  // valid determinism check; the derived counts must be byte-identical.
  const firstCounts = JSON.stringify(manifest.totals.cohortCounts);
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, "..", "tools", "merge-results.js"),
      "--in",
      inDir,
      "--out",
      outDir,
      "--top",
      "10",
    ],
    { stdio: "pipe" },
  );
  const secondManifest = JSON.parse(
    fs.readFileSync(path.join(outDir, "merge-manifest.json"), "utf8"),
  );
  const secondCounts = JSON.stringify(secondManifest.totals.cohortCounts);
  check(
    "merge cohortCounts are deterministic across runs",
    firstCounts === secondCounts,
    firstCounts + " vs " + secondCounts,
  );

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// (g) Reports render unchanged when no cohort data is present
// ---------------------------------------------------------------------------
section("(g) backwards compatibility — no cohort data");

{
  // All-blank cohort: culture report must NOT contain the cohort section.
  const blanks = [];
  for (let i = 0; i < 5; i++) {
    blanks.push(flatRecord({ name: "nb-" + i, leadCohort: "" }));
  }
  const aBlank = analyzer.analyzeCulture(blanks);
  const engine = new GameEngine();
  const reportHtml = engine._buildCultureReportHtml(aBlank);
  check(
    "no-cohort culture report omits 'By LEAD Course Cohort'",
    reportHtml.indexOf("By LEAD Course Cohort") === -1,
  );

  // Executive summary: no comparison section, no headline.
  const gen = makeGenerator(blanks);
  check(
    "no-cohort comparison section is empty",
    gen.generateCohortComparisonSection() === "",
  );
  check("no-cohort headline is empty", gen.generateCohortHeadline() === "");

  // Legacy records (no leadCohort field at all) behave as non-participants.
  const legacy = [];
  for (let i = 0; i < 4; i++) {
    const r = flatRecord({ name: "leg-" + i });
    delete r.leadCohort;
    legacy.push(r);
  }
  const aLegacy = analyzer.analyzeCulture(legacy);
  check(
    "legacy records all fold into none",
    aLegacy.cohorts.nonParticipants.count === 4,
    String(aLegacy.cohorts.nonParticipants.count),
  );
  check(
    "legacy records: no 2025/2026 segments",
    aLegacy.cohorts.byCohort["2025"] === null &&
      aLegacy.cohorts.byCohort["2026"] === null,
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
