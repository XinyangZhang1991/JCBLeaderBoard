// Verification harness for consent & data-segmentation rules.
// Run with: node v2/_verify_consent.js
//
// Covers the full truth table (consent x business-function), scoreboard
// inclusion/exclusion, culture inclusion/exclusion, anonymisation, legacy
// record defaulting, and the merge tool's leaderboard/cohort/manifest output.
//
// Self-contained: Node built-ins only. It loads the shared results-store
// module (the single source of truth for the predicates) and drives the merge
// tool over temporary fixtures.

const path = require("path");
const fs = require("fs");
const os = require("os");
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

// Build a flat record with an explicit consent + business function.
function flatRecord(opts) {
  const o = opts || {};
  return {
    runId: o.runId || "run_" + Math.random().toString(36).slice(2, 10),
    name: o.name || "Test Player",
    jobFunction: o.jobFunction === undefined ? "Engineering" : o.jobFunction,
    seniority: o.seniority || "Senior Leader",
    selfIdentifiedStyle: o.selfIdentifiedStyle || "coaching",
    growth: o.growth === undefined ? 20 : o.growth,
    morale: 70,
    attrition: 8,
    profitMargin: 30,
    organizationalCapability: 80,
    leadership: 100,
    excellence: 100,
    agility: 100,
    determination: 100,
    leadershipStyle: "Coaching",
    personalityColor: "GREEN",
    escaped: true,
    optimal: false,
    round: 1,
    timestamp: o.timestamp || Date.now(),
    consent: o.consent, // may be undefined (legacy)
  };
}

// ---------------------------------------------------------------------------
// 1. JCB_BUSINESS_FUNCTIONS constant
// ---------------------------------------------------------------------------
section("JCB_BUSINESS_FUNCTIONS — valid internal functions only");
const fns = Store.JCB_BUSINESS_FUNCTIONS;
check("is an array", Array.isArray(fns));
check("includes Engineering", fns.indexOf("Engineering") !== -1);
check("includes IT / Digital", fns.indexOf("IT / Digital") !== -1);
check("excludes Student", fns.indexOf("Student") === -1);
check("excludes Academic", fns.indexOf("Academic") === -1);
check("excludes Consultant", fns.indexOf("Consultant") === -1);
check("excludes Other Industry", fns.indexOf("Other Industry") === -1);
check("excludes Other", fns.indexOf("Other") === -1);
check("excludes blank", fns.indexOf("") === -1);

// ---------------------------------------------------------------------------
// 2. hasJcbBusinessFunction
// ---------------------------------------------------------------------------
section("hasJcbBusinessFunction");
check(
  "Engineering (flat) is JCB",
  Store.hasJcbBusinessFunction({ jobFunction: "Engineering" }) === true,
);
check(
  "Student (flat) is NOT JCB",
  Store.hasJcbBusinessFunction({ jobFunction: "Student" }) === false,
);
check(
  "blank (flat) is NOT JCB",
  Store.hasJcbBusinessFunction({ jobFunction: "" }) === false,
);
check(
  "missing function is NOT JCB",
  Store.hasJcbBusinessFunction({}) === false,
);
check(
  "canonical player.jobFunction is read",
  Store.hasJcbBusinessFunction({
    player: { jobFunction: "Manufacturing" },
  }) === true,
);

// ---------------------------------------------------------------------------
// 3. isPubliclyDisplayable — fail-safe default
// ---------------------------------------------------------------------------
section("isPubliclyDisplayable — fail-safe default false");
check(
  "consent.publicDisplay true -> displayable",
  Store.isPubliclyDisplayable({ consent: { publicDisplay: true } }) === true,
);
check(
  "consent.publicDisplay false -> not displayable",
  Store.isPubliclyDisplayable({ consent: { publicDisplay: false } }) === false,
);
check(
  "no consent field (legacy) -> not displayable",
  Store.isPubliclyDisplayable({ name: "Legacy" }) === false,
);
check(
  "null record -> not displayable",
  Store.isPubliclyDisplayable(null) === false,
);

// ---------------------------------------------------------------------------
// 4. isCultureEligible — depends only on business function
// ---------------------------------------------------------------------------
section("isCultureEligible — function only, consent-independent");
check(
  "JCB + consented -> eligible",
  Store.isCultureEligible({
    jobFunction: "Engineering",
    consent: { publicDisplay: true },
  }) === true,
);
check(
  "JCB + declined -> eligible (anonymous)",
  Store.isCultureEligible({
    jobFunction: "Engineering",
    consent: { publicDisplay: false },
  }) === true,
);
check(
  "non-JCB + consented -> NOT eligible",
  Store.isCultureEligible({
    jobFunction: "Student",
    consent: { publicDisplay: true },
  }) === false,
);
check(
  "non-JCB + declined -> NOT eligible",
  Store.isCultureEligible({
    jobFunction: "Other",
    consent: { publicDisplay: false },
  }) === false,
);

// ---------------------------------------------------------------------------
// 5. Full truth table
// ---------------------------------------------------------------------------
section("Truth table — consent x business function");
const truth = [
  // consent, function, expectPublic, expectCulture
  [true, "Engineering", true, true],
  [true, "Student", true, false],
  [false, "Engineering", false, true],
  [false, "Student", false, false],
];
truth.forEach((row) => {
  const [consent, fn, expPublic, expCulture] = row;
  const rec = flatRecord({
    jobFunction: fn,
    consent: { publicDisplay: consent, capturedAt: "2026-01-01T00:00:00Z" },
  });
  const label = `consent=${consent} fn=${fn}`;
  check(
    `${label} -> public=${expPublic}`,
    Store.isPubliclyDisplayable(rec) === expPublic,
  );
  check(
    `${label} -> culture=${expCulture}`,
    Store.isCultureEligible(rec) === expCulture,
  );
});

// ---------------------------------------------------------------------------
// 6. Schema round-trip carries consent
// ---------------------------------------------------------------------------
section("Schema — consent survives flatToCanonical / canonicalToFlat");
const withConsent = flatRecord({
  name: "Alice",
  jobFunction: "Finance",
  consent: { publicDisplay: true, capturedAt: "2026-02-02T10:00:00Z" },
});
const canonical = Store.flatToCanonical(withConsent);
check(
  "canonical.consent.publicDisplay === true",
  canonical.consent && canonical.consent.publicDisplay === true,
);
check(
  "canonical.consent.capturedAt preserved",
  canonical.consent.capturedAt === "2026-02-02T10:00:00Z",
);
const backToFlat = Store.canonicalToFlat(canonical);
check(
  "flat.consent.publicDisplay === true",
  backToFlat.consent && backToFlat.consent.publicDisplay === true,
);
check(
  "flat.consent.capturedAt preserved",
  backToFlat.consent.capturedAt === "2026-02-02T10:00:00Z",
);

// Legacy record (no consent) defaults to false through the schema.
const legacyCanonical = Store.flatToCanonical(
  flatRecord({ name: "Legacy", jobFunction: "Operations" }),
);
check(
  "legacy canonical.consent.publicDisplay defaults false",
  legacyCanonical.consent.publicDisplay === false,
);
check(
  "legacy canonical.consent.capturedAt is a string",
  typeof legacyCanonical.consent.capturedAt === "string" &&
    legacyCanonical.consent.capturedAt.length > 0,
);

// normaliseRecord preserves consent through a canonical re-normalisation.
const renormalised = Store.normaliseRecord(canonical);
check(
  "normaliseRecord preserves consent.publicDisplay",
  renormalised.consent.publicDisplay === true,
);

// ---------------------------------------------------------------------------
// 7. anonymiseForCulture
// ---------------------------------------------------------------------------
section("anonymiseForCulture");
const declined = flatRecord({
  name: "Bob Secret",
  jobFunction: "Engineering",
  consent: { publicDisplay: false, capturedAt: "2026-03-03T00:00:00Z" },
});
const anon = Store.anonymiseForCulture(declined);
check("name replaced with Anonymous", anon.name === "Anonymous");
check("anonymised flag set", anon.anonymised === true);
check("jobFunction retained", anon.jobFunction === "Engineering");
check("seniority retained", anon.seniority === "Senior Leader");
check("outcomes retained", anon.growth === declined.growth);
check("original record not mutated", declined.name === "Bob Secret");

const consented = flatRecord({
  name: "Carol Public",
  jobFunction: "Finance",
  consent: { publicDisplay: true, capturedAt: "2026-03-03T00:00:00Z" },
});
const notAnon = Store.anonymiseForCulture(consented);
check("consented name retained", notAnon.name === "Carol Public");
check("consented not flagged anonymised", !notAnon.anonymised);

// Canonical shape: player.name is replaced.
const canonicalDeclined = Store.flatToCanonical(declined);
const canonicalAnon = Store.anonymiseForCulture(canonicalDeclined);
check(
  "canonical player.name replaced with Anonymous",
  canonicalAnon.player.name === "Anonymous",
);
check(
  "canonical jobFunction retained",
  canonicalAnon.player.jobFunction === "Engineering",
);

// ---------------------------------------------------------------------------
// 8. CultureAnalysis defensive filter + small-cohort safety
// ---------------------------------------------------------------------------
section("CultureAnalysis — defensive filter & small cohorts");
// culture-analysis.js is a browser-global script (it assigns to window.CultureAnalysis
// and does not set module.exports), so load it in a vm sandbox that provides `window`.
const vm = require("vm");
const cultureSrc = fs.readFileSync(
  path.join(__dirname, "..", "culture-analysis.js"),
  "utf8",
);
const cultureSandbox = { window: {}, console: console, Math: Math, Date: Date };
vm.createContext(cultureSandbox);
vm.runInContext(cultureSrc, cultureSandbox);
const CultureAnalysis = cultureSandbox.window.CultureAnalysis;
check(
  "CultureAnalysis class loaded from browser-global script",
  typeof CultureAnalysis === "function",
);
const analyzer = new CultureAnalysis();

// All-declined cohort of JCB players: still eligible (anonymised), no crash.
const allDeclined = [
  flatRecord({
    name: "A",
    jobFunction: "Engineering",
    consent: { publicDisplay: false },
  }),
  flatRecord({
    name: "B",
    jobFunction: "Finance",
    consent: { publicDisplay: false },
  }),
  flatRecord({
    name: "C",
    jobFunction: "Operations",
    consent: { publicDisplay: false },
  }),
];
const allDeclinedAnalysis = analyzer.analyzeCulture(allDeclined);
check(
  "all-declined JCB cohort (3) analyses without error",
  !allDeclinedAnalysis.error,
  allDeclinedAnalysis.error || "",
);
check(
  "all-declined cohort playerCount is 3",
  allDeclinedAnalysis.playerCount === 3,
);

// Non-JCB players are excluded by the defensive filter -> insufficient data.
const nonJcb = [
  flatRecord({ jobFunction: "Student", consent: { publicDisplay: true } }),
  flatRecord({ jobFunction: "Academic", consent: { publicDisplay: true } }),
  flatRecord({ jobFunction: "Other", consent: { publicDisplay: true } }),
];
const nonJcbAnalysis = analyzer.analyzeCulture(nonJcb);
check("all-non-JCB cohort -> insufficient data", !!nonJcbAnalysis.error);
check("insufficient-data playerCount is 0", nonJcbAnalysis.playerCount === 0);

// Mixed cohort: only JCB players counted.
const mixed = [
  flatRecord({ jobFunction: "Engineering", consent: { publicDisplay: true } }),
  flatRecord({ jobFunction: "Finance", consent: { publicDisplay: false } }),
  flatRecord({ jobFunction: "Student", consent: { publicDisplay: true } }),
  flatRecord({ jobFunction: "Other", consent: { publicDisplay: false } }),
];
const mixedAnalysis = analyzer.analyzeCulture(mixed);
check(
  "mixed cohort counts only the 2 JCB players",
  mixedAnalysis.playerCount === 2,
  String(mixedAnalysis.playerCount),
);
check("mixed cohort (2 eligible) -> insufficient data", !!mixedAnalysis.error);

// Sub-3 eligible cohort must not crash.
const twoEligible = [
  flatRecord({ jobFunction: "Engineering", consent: { publicDisplay: true } }),
  flatRecord({ jobFunction: "Finance", consent: { publicDisplay: false } }),
];
const twoAnalysis = analyzer.analyzeCulture(twoEligible);
check("sub-3 eligible cohort returns error, no crash", !!twoAnalysis.error);

// Empty / null cohort must not crash.
check(
  "null cohort returns error, no crash",
  !!analyzer.analyzeCulture(null).error,
);
check(
  "empty cohort returns error, no crash",
  !!analyzer.analyzeCulture([]).error,
);

// ---------------------------------------------------------------------------
// 9. Merge tool over fixtures
// ---------------------------------------------------------------------------
section("Merge tool — leaderboard / cohort / manifest");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jcb-consent-"));
const rawDir = path.join(tmpRoot, "raw");
const outDir = path.join(tmpRoot, "merged");
fs.mkdirSync(rawDir, { recursive: true });

// Fixtures: one of each truth-table combination, plus a legacy record.
const fixtures = [
  // consented + JCB -> public + culture (named)
  flatRecord({
    runId: "run_consent_jcb",
    name: "Public JCB",
    jobFunction: "Engineering",
    growth: 40,
    consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
  }),
  // consented + non-JCB -> public, NOT culture
  flatRecord({
    runId: "run_consent_nojcb",
    name: "Public NonJCB",
    jobFunction: "Student",
    growth: 35,
    consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
  }),
  // declined + JCB -> NOT public, culture (anonymous)
  flatRecord({
    runId: "run_decline_jcb",
    name: "Private JCB",
    jobFunction: "Finance",
    growth: 30,
    consent: { publicDisplay: false, capturedAt: "2026-01-01T00:00:00Z" },
  }),
  // declined + non-JCB -> NOT public, NOT culture
  flatRecord({
    runId: "run_decline_nojcb",
    name: "Private NonJCB",
    jobFunction: "Other",
    growth: 25,
    consent: { publicDisplay: false, capturedAt: "2026-01-01T00:00:00Z" },
  }),
  // legacy (no consent field) + JCB -> NOT public (fail-safe), culture (anon)
  flatRecord({
    runId: "run_legacy_jcb",
    name: "Legacy JCB",
    jobFunction: "Operations",
    growth: 20,
    consent: undefined,
  }),
];

fixtures.forEach((f) => {
  fs.writeFileSync(
    path.join(rawDir, f.runId + ".json"),
    JSON.stringify(Store.flatToCanonical(f), null, 2),
    "utf8",
  );
});

const mergeTool = path.join(__dirname, "..", "tools", "merge-results.js");
let mergeOk = true;
let mergeErr = "";
try {
  execFileSync(
    process.execPath,
    [mergeTool, "--in", rawDir, "--out", outDir, "--top", "10"],
    { stdio: "pipe" },
  );
} catch (e) {
  mergeOk = false;
  mergeErr = e.message + (e.stdout ? "\n" + e.stdout.toString() : "");
}
check("merge tool exits 0", mergeOk, mergeErr);

if (mergeOk) {
  const leaderboard = JSON.parse(
    fs.readFileSync(path.join(outDir, "leaderboard.json"), "utf8"),
  );
  const cohort = JSON.parse(
    fs.readFileSync(path.join(outDir, "cohort.json"), "utf8"),
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(outDir, "merge-manifest.json"), "utf8"),
  );

  // Leaderboard: only the 2 consented records.
  const lbNames = leaderboard.entries.map((e) => e.name).sort();
  check(
    "leaderboard has exactly 2 entries",
    leaderboard.entries.length === 2,
    String(leaderboard.entries.length),
  );
  check(
    "leaderboard excludes non-consenting runs",
    lbNames.indexOf("Private JCB") === -1 &&
      lbNames.indexOf("Private NonJCB") === -1 &&
      lbNames.indexOf("Legacy JCB") === -1,
  );
  check(
    "leaderboard includes consented runs",
    lbNames.indexOf("Public JCB") !== -1 &&
      lbNames.indexOf("Public NonJCB") !== -1,
  );
  check(
    "leaderboard recordCount counts only public",
    leaderboard.recordCount === 2,
    String(leaderboard.recordCount),
  );

  // Cohort: only JCB records (3), with non-consenting anonymised.
  check(
    "cohort has exactly 3 records (JCB only)",
    cohort.records.length === 3,
    String(cohort.records.length),
  );
  const cohortNames = cohort.records.map((r) => r.player.name);
  check(
    "cohort excludes non-JCB players",
    cohortNames.indexOf("Public NonJCB") === -1 &&
      cohortNames.indexOf("Private NonJCB") === -1,
  );
  check(
    "cohort anonymises declined JCB run",
    cohortNames.indexOf("Anonymous") !== -1,
  );
  check(
    "cohort anonymises legacy JCB run",
    cohort.records.filter((r) => r.anonymised === true).length === 2,
    String(cohort.records.filter((r) => r.anonymised === true).length),
  );
  check(
    "cohort keeps consented JCB name",
    cohortNames.indexOf("Public JCB") !== -1,
  );
  check(
    "cohort retains function for segmentation",
    cohort.records.some((r) => r.player.jobFunction === "Finance"),
  );

  // Manifest counts.
  const t = manifest.totals;
  check("manifest totals.records === 5", t.records === 5, String(t.records));
  check(
    "manifest totals.publicDisplay === 2",
    t.publicDisplay === 2,
    String(t.publicDisplay),
  );
  check(
    "manifest totals.hiddenFromScoreboard === 3",
    t.hiddenFromScoreboard === 3,
    String(t.hiddenFromScoreboard),
  );
  check(
    "manifest totals.cultureEligible === 3",
    t.cultureEligible === 3,
    String(t.cultureEligible),
  );
  check(
    "manifest totals.excludedNoFunction === 2",
    t.excludedNoFunction === 2,
    String(t.excludedNoFunction),
  );
  check(
    "manifest totals.anonymised === 2",
    t.anonymised === 2,
    String(t.anonymised),
  );
}

// Clean up the temp fixtures.
try {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
} catch (e) {
  // best-effort cleanup
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
