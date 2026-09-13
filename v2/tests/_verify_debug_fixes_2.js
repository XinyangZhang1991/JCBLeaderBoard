// Verification harness for the DEBUG_FINDINGS_2 fixes (#1–#7).
// Run with: node v2/_verify_debug_fixes_2.js
//
// Covers:
//   (a) a run that ranks #11 IS still persisted in the full cache and the
//       render path slices to 10 correctly;
//   (b) a consenting run appears on the leaderboard;
//   (c) window.ExecutiveSummaryGenerator is defined after loading scripts in
//       index.html order (no LEAD_CONSTANTS collision);
//   (d) the cohort dropdown value round-trips through the canonical schema;
//   (e) the consent text is exactly the required string;
//   (f) £50K is reduced;
//   (g) the PRIVATE RESULTS block is gone and hidden runs do not print #null.
//
// Self-contained: Node built-ins only. game-engine.js is a browser-global
// script (it assigns `window.game`), so it is loaded in a vm sandbox that
// provides a minimal window/document/localStorage.

const path = require("path");
const fs = require("fs");
const vm = require("vm");

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
// Minimal DOM / storage stubs
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
    classList: {
      add() {},
      remove() {},
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
    addEventListener() {},
    _elements: elements,
  };
}

// ---------------------------------------------------------------------------
// Load game-engine.js in a sandbox
// ---------------------------------------------------------------------------

const sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  isFinite: isFinite,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: (fn) => {
    if (typeof fn === "function") fn();
    return 0;
  },
};
sandbox.window = sandbox;
sandbox.localStorage = makeLocalStorage();
sandbox.document = makeDocument();
sandbox.addEventListener = () => {};
sandbox.window.addEventListener = () => {};

const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "game-engine.js"),
  "utf8",
);
const instrumentedSrc = engineSrc + "\n;this.GameEngine = GameEngine;\n";
vm.createContext(sandbox);
vm.runInContext(instrumentedSrc, sandbox);

const GameEngine = sandbox.GameEngine;
check(
  "GameEngine class loaded from browser-global script",
  typeof GameEngine === "function",
);

function freshEngine() {
  sandbox.localStorage.clear();
  return new GameEngine();
}

// A minimal flat run record. `growth` drives the ranking (higher = better).
function runRecord(opts) {
  const o = opts || {};
  const rec = {
    runId: o.runId || "run_" + Math.random().toString(36).slice(2, 10),
    name: o.name || "Test Player",
    jobFunction: o.jobFunction || "Engineering",
    seniority: o.seniority || "Middle Manager",
    leadCohort: o.leadCohort || "",
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
  };
  if ("consent" in o) rec.consent = o.consent;
  return rec;
}

// ---------------------------------------------------------------------------
// (a) A run that ranks #11 IS still persisted in the full cache; render slices
//     to 10 correctly.
// ---------------------------------------------------------------------------
section("(a) #11-ranked run persists in full cache; render slices to 10");
{
  const engine = freshEngine();

  // Seed 10 consenting players with descending growth 49..40.
  for (let i = 0; i < 10; i++) {
    engine.saveToLeaderboard(
      runRecord({
        runId: "run_seed_" + i,
        name: "Player" + i,
        growth: 49 - i,
        consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
      }),
    );
  }

  // New consenting player with the LOWEST growth -> ranks #11 of 11.
  const placement = engine.saveToLeaderboard(
    runRecord({
      runId: "run_newbie",
      name: "Newbie",
      growth: 12,
      consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
    }),
  );

  check(
    "new run is ranked #11 of 11",
    placement && placement.rank === 11 && placement.total === 11,
    JSON.stringify(placement),
  );
  check(
    "new run is NOT in the top 10",
    placement && placement.inTop10 === false,
    JSON.stringify(placement),
  );

  const raw = JSON.parse(
    sandbox.localStorage.getItem("jcb_leaderboard") || "[]",
  );
  check(
    "full cache retains ALL 11 runs (not truncated to 10)",
    raw.length === 11,
    "cache length = " + raw.length,
  );
  check(
    "the #11 run IS present in the full cache",
    raw.some((r) => r.runId === "run_newbie"),
    JSON.stringify(raw.map((r) => r.runId)),
  );

  // The render path must slice the DISPLAYABLE list to 10.
  const displayable = engine.getDisplayableLeaderboard();
  check(
    "getDisplayableLeaderboard returns all 11 displayable runs",
    displayable.length === 11,
    "displayable length = " + displayable.length,
  );

  // Drive the real render path and count the rendered rows.
  engine.loadLeaderboard();
  const container = sandbox.document.getElementById("leaderboard-container");
  // Each row emits both `leaderboard-item` and `leaderboard-item-compact`, so
  // count the unique row wrapper class only.
  const rowCount = (
    container.innerHTML.match(
      /class="leaderboard-item leaderboard-item-compact"/g,
    ) || []
  ).length;
  check(
    "loadLeaderboard renders exactly 10 rows (top-10 display)",
    rowCount === 10,
    "rendered rows = " + rowCount,
  );
  check(
    "the #11 run is NOT rendered (outside top 10)",
    !/Newbie/.test(container.innerHTML),
  );
}

// ---------------------------------------------------------------------------
// (b) A consenting run appears on the leaderboard.
// ---------------------------------------------------------------------------
section("(b) consenting run appears on the leaderboard");
{
  const engine = freshEngine();
  engine.saveToLeaderboard(
    runRecord({
      runId: "run_public",
      name: "Public Player",
      growth: 30,
      consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
    }),
  );

  const displayable = engine.getDisplayableLeaderboard();
  check(
    "consenting run is displayable",
    displayable.some((r) => r.runId === "run_public"),
  );

  engine.loadLeaderboard();
  const container = sandbox.document.getElementById("leaderboard-container");
  check(
    "consenting run IS rendered on the leaderboard",
    /Public Player/.test(container.innerHTML),
  );
}

// ---------------------------------------------------------------------------
// (c) window.ExecutiveSummaryGenerator is defined after loading scripts in
//     index.html order (no LEAD_CONSTANTS collision).
// ---------------------------------------------------------------------------
section("(c) ExecutiveSummaryGenerator loads (no LEAD_CONSTANTS collision)");
{
  // Parse index.html for the <script src="..."> order.
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  const scriptOrder = [];
  const re = /<script\s+src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    scriptOrder.push(m[1]);
  }
  check(
    "index.html declares script load order",
    scriptOrder.length > 0,
    JSON.stringify(scriptOrder),
  );

  // Load each classic script in order into ONE shared context, exactly as a
  // browser would. A duplicate top-level lexical declaration throws here.
  const ctx = {
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    isFinite: isFinite,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    localStorage: makeLocalStorage(),
    document: makeDocument(),
    addEventListener: () => {},
    navigator: { userAgent: "node" },
    // app.js reads window.location.search for its debug flag.
    location: { search: "", href: "file:///index.html", hash: "" },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  let loadError = null;
  for (const src of scriptOrder) {
    const file = path.join(__dirname, "..", src);
    if (!fs.existsSync(file)) continue;
    try {
      vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: src });
    } catch (e) {
      loadError = src + " -> " + e.message;
      break;
    }
  }

  check(
    "all classic scripts load without a SyntaxError",
    loadError === null,
    loadError || "",
  );
  check(
    "window.ExecutiveSummaryGenerator is defined",
    typeof ctx.ExecutiveSummaryGenerator === "function",
    "typeof = " + typeof ctx.ExecutiveSummaryGenerator,
  );
  check(
    "window.LEAD_CONSTANTS is published by lead-constants.js",
    !!ctx.LEAD_CONSTANTS && typeof ctx.LEAD_CONSTANTS === "object",
  );

  // The generator must actually be constructible and use the shared constants.
  if (typeof ctx.ExecutiveSummaryGenerator === "function") {
    const gen = new ctx.ExecutiveSummaryGenerator();
    check(
      "ExecutiveSummaryGenerator is constructible",
      !!gen && typeof gen === "object",
    );
  }
}

// ---------------------------------------------------------------------------
// (d) The cohort dropdown value round-trips through the canonical schema.
// ---------------------------------------------------------------------------
section("(d) cohort value round-trips through the canonical schema");
{
  const Store = require(path.join(__dirname, "..", "results-store.js"));

  const flat = {
    runId: "run_cohort",
    name: "Cohort Player",
    jobFunction: "Engineering",
    seniority: "Middle Manager",
    leadCohort: "2026",
    growth: 20,
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
    timestamp: Date.now(),
    consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
  };

  const canonical = Store.flatToCanonical(flat);
  check(
    "flatToCanonical stores player.leadCohort",
    canonical.player && canonical.player.leadCohort === "2026",
    JSON.stringify(canonical.player),
  );

  const back = Store.canonicalToFlat(canonical);
  check(
    "canonicalToFlat restores leadCohort",
    back.leadCohort === "2026",
    JSON.stringify(back.leadCohort),
  );

  // A blank cohort must round-trip as an empty string, not undefined.
  const blankCanonical = Store.flatToCanonical(
    Object.assign({}, flat, { leadCohort: "" }),
  );
  check(
    "blank cohort round-trips as empty string",
    blankCanonical.player.leadCohort === "",
    JSON.stringify(blankCanonical.player.leadCohort),
  );

  // The index.html dropdown must offer exactly 2025 / 2026 plus a blank default.
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  check(
    "index.html has a player-cohort select",
    /id="player-cohort"/.test(html),
  );
  check(
    "cohort dropdown offers 2025",
    /<option value="2025">2025<\/option>/.test(html),
  );
  check(
    "cohort dropdown offers 2026",
    /<option value="2026">2026<\/option>/.test(html),
  );
  check(
    "cohort dropdown has a blank default",
    /<select id="player-cohort"[\s\S]*?<option value="">/.test(html),
  );
  check(
    "cohort question copy is present",
    /Were you part of the LEAD course cohort\?/.test(html),
  );
}

// ---------------------------------------------------------------------------
// (e) The consent text is exactly the required string.
// ---------------------------------------------------------------------------
section("(e) consent text is exactly the required string");
{
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  check(
    "consent label contains the exact required sentence",
    /I consent to my results appearing on the scoreboard/.test(html),
  );
  check(
    "old wordy consent copy is gone",
    !/I consent to my name and results being shown on the public/.test(html),
  );
  check("old consent helper note is gone", !/id="consent-note"/.test(html));
}

// ---------------------------------------------------------------------------
// (f) £50K is reduced.
// ---------------------------------------------------------------------------
section("(f) £50K team-celebration figure is reduced");
{
  const engineSrcNow = fs.readFileSync(
    path.join(__dirname, "..", "game-engine.js"),
    "utf8",
  );
  // £50K now legitimately appears in explanatory COMMENTS (e.g. the tolerance
  // note at game-engine.js:1574 and the slider note at scenarios.js:985). It
  // must not appear in executable code (string literals / logic), so strip
  // line and block comments before searching.
  function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }
  const engineCode = stripComments(engineSrcNow);
  check(
    "£50K no longer appears in game-engine.js executable code",
    !/£50K/.test(engineCode),
  );
  check(
    "the reduced £5K figure is present",
    /£5K in lost sales/.test(engineSrcNow),
  );
  // The unrelated larger figures must be untouched.
  check("unrelated £500K figure is preserved", /£500K/.test(engineSrcNow));
}

// ---------------------------------------------------------------------------
// (g) The PRIVATE RESULTS block is gone and hidden runs do not print #null.
// ---------------------------------------------------------------------------
section("(g) PRIVATE RESULTS removed; hidden runs do not print #null");
{
  const engineSrcNow = fs.readFileSync(
    path.join(__dirname, "..", "game-engine.js"),
    "utf8",
  );
  check("PRIVATE RESULTS copy is gone", !/PRIVATE RESULTS/.test(engineSrcNow));

  // Drive the real render path for a hidden (non-consenting) run.
  const engine = freshEngine();
  const placement = engine.saveToLeaderboard(
    runRecord({
      runId: "run_hidden",
      name: "Hidden Player",
      growth: 20,
      consent: { publicDisplay: false, capturedAt: "2026-01-01T00:00:00Z" },
    }),
  );
  check(
    "non-consenting run has hidden placement (rank null)",
    placement && placement.hidden === true && placement.rank === null,
    JSON.stringify(placement),
  );

  engine.showLeaderboardPlacement(placement);
  const container = sandbox.document.getElementById("results-placement");
  const html = container.innerHTML;
  check("hidden run does NOT print '#null'", !/#null/.test(html), html);
  check("hidden run shows a neutral message", /RUN COMPLETE/.test(html), html);
  check(
    "hidden run does not show PRIVATE RESULTS",
    !/PRIVATE RESULTS/.test(html),
    html,
  );

  // A ranked run must still render its rank normally.
  const engine2 = freshEngine();
  const ranked = engine2.saveToLeaderboard(
    runRecord({
      runId: "run_ranked",
      name: "Ranked Player",
      growth: 30,
      consent: { publicDisplay: true, capturedAt: "2026-01-01T00:00:00Z" },
    }),
  );
  engine2.showLeaderboardPlacement(ranked);
  const rankedHtml =
    sandbox.document.getElementById("results-placement").innerHTML;
  // Rank 1 is a podium finish, so the headline is "TOP 1 OF 1" by design.
  check(
    "ranked run renders its rank (no #null)",
    /TOP 1 OF 1/.test(rankedHtml) && !/#null/.test(rankedHtml),
    rankedHtml,
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
