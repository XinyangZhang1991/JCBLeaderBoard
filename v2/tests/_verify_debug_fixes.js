// Verification harness for the three DEBUG_FINDINGS fixes.
// Run with: node v2/_verify_debug_fixes.js
//
// Covers:
//   (a) a non-consenting run IS cached but hidden at display time;
//   (b) a legacy record with no `consent` is NOT displayed (fail-safe default);
//   (c) an explicit `publicDisplay: false` record IS hidden;
//   (d) metric deltas of +0.4 render as "+0.4" not "0";
//   (e) `**x**` renders as `<strong>x</strong>`.
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

// A tiny element stub good enough for the code paths under test.
function makeElement(id) {
  return {
    id: id,
    innerHTML: "",
    textContent: "",
    className: "",
    style: {},
    classList: {
      add() {},
      remove() {},
    },
    parentElement: null,
    appendChild() {},
    offsetWidth: 0,
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
// `class GameEngine` is a lexical declaration, so it is not attached to the
// sandbox global automatically. Append an explicit export for the harness.
const instrumentedSrc = engineSrc + "\n;this.GameEngine = GameEngine;\n";
vm.createContext(sandbox);
vm.runInContext(instrumentedSrc, sandbox);

const GameEngine = sandbox.GameEngine;
check(
  "GameEngine class loaded from browser-global script",
  typeof GameEngine === "function",
);

// Build a fresh engine per test so state does not leak between cases.
function freshEngine() {
  sandbox.localStorage.clear();
  return new GameEngine();
}

// A minimal flat run record.
function runRecord(opts) {
  const o = opts || {};
  const rec = {
    runId: o.runId || "run_" + Math.random().toString(36).slice(2, 10),
    name: o.name || "Test Player",
    jobFunction: o.jobFunction || "Engineering",
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
// (a) Non-consenting run IS cached but hidden at display time
// ---------------------------------------------------------------------------
section("(a) non-consenting run — cached but hidden at display time");
{
  const engine = freshEngine();
  const rec = runRecord({
    runId: "run_declined",
    name: "Declined Player",
    consent: { publicDisplay: false, capturedAt: "2026-01-01T00:00:00Z" },
  });
  engine.saveToLeaderboard(rec);

  const raw = JSON.parse(
    sandbox.localStorage.getItem("jcb_leaderboard") || "[]",
  );
  check(
    "non-consenting run IS present in jcb_leaderboard cache",
    raw.some((r) => r.runId === "run_declined"),
    JSON.stringify(raw.map((r) => r.runId)),
  );

  const displayable = engine.getDisplayableLeaderboard();
  check(
    "non-consenting run is HIDDEN by getDisplayableLeaderboard",
    !displayable.some((r) => r.runId === "run_declined"),
  );

  // getLeaderboardData must return the RAW cache (all runs).
  const rawViaGetter = engine.getLeaderboardData();
  check(
    "getLeaderboardData returns the raw cache (includes declined run)",
    rawViaGetter.some((r) => r.runId === "run_declined"),
  );
}

// ---------------------------------------------------------------------------
// (b) Legacy record with no `consent` is NOT displayed (fail-safe default)
// ---------------------------------------------------------------------------
section("(b) legacy record (no consent object) — hidden by fail-safe default");
{
  const engine = freshEngine();
  const rec = runRecord({ runId: "run_legacy", name: "Legacy Player" });
  delete rec.consent;
  engine.saveToLeaderboard(rec);

  const raw = JSON.parse(
    sandbox.localStorage.getItem("jcb_leaderboard") || "[]",
  );
  check(
    "legacy run IS present in jcb_leaderboard cache",
    raw.some((r) => r.runId === "run_legacy"),
  );

  // Fail-safe: a missing/legacy consent object means NOT public. See the note
  // at results-store.js:177.
  check(
    "isPubliclyDisplayable(legacy) === false (fail-safe default)",
    engine.isPubliclyDisplayable({ name: "Legacy" }) === false,
  );

  const displayable = engine.getDisplayableLeaderboard();
  check(
    "legacy run is HIDDEN by getDisplayableLeaderboard",
    !displayable.some((r) => r.runId === "run_legacy"),
  );
}

// ---------------------------------------------------------------------------
// (c) Explicit publicDisplay:false IS hidden
// ---------------------------------------------------------------------------
section("(c) explicit publicDisplay:false — hidden");
{
  const engine = freshEngine();
  check(
    "isPubliclyDisplayable({consent:{publicDisplay:false}}) === false",
    engine.isPubliclyDisplayable({ consent: { publicDisplay: false } }) ===
      false,
  );
  check(
    "isPubliclyDisplayable({consent:{publicDisplay:true}}) === true",
    engine.isPubliclyDisplayable({ consent: { publicDisplay: true } }) === true,
  );
  check(
    "isPubliclyDisplayable(null) === false",
    engine.isPubliclyDisplayable(null) === false,
  );
}

// ---------------------------------------------------------------------------
// (d) Metric deltas of +0.4 render as "+0.4" not "0"
// ---------------------------------------------------------------------------
section("(d) metric delta +0.4 renders as +0.4");
{
  const engine = freshEngine();
  // Drive showConsequence with a synthetic deltas object and inspect the
  // rendered impact card HTML.
  const scenario = { consequenceText: "Test consequence." };
  engine.showConsequence(
    scenario,
    {},
    {
      growth: 0.4,
      profitMargin: 0.4,
      morale: 0.4,
      attrition: 0.4,
      organizationalCapability: 0.4,
    },
  );

  const body = sandbox.document.getElementById("consequence-body");
  const html = body.innerHTML;

  check(
    "impact card header is 'SCENARIO NET IMPACT'",
    /SCENARIO NET IMPACT/.test(html),
  );
  check(
    "Morale +0.4 renders as +0.4% (not 0)",
    /impact-label">Morale<\/span>\s*<span class="impact-value">\+0\.4%/.test(
      html,
    ),
    html,
  );
  check(
    "Capability +0.4 renders as +0.4 pts (not 0)",
    /impact-label">Capability<\/span>\s*<span class="impact-value">\+0\.4 pts/.test(
      html,
    ),
    html,
  );
  check(
    "Profit +0.4 renders as +0.4% (not 0)",
    /impact-label">Profit<\/span>\s*<span class="impact-value">\+0\.4%/.test(
      html,
    ),
    html,
  );
  check(
    "Attrition +0.4 renders as +0.4% (not 0)",
    /impact-label">Attrition<\/span>\s*<span class="impact-value">\+0\.4%/.test(
      html,
    ),
    html,
  );
  check(
    "no metric renders as a bare '0' for a +0.4 delta",
    !/impact-value">0%/.test(html) && !/impact-value">0 pts/.test(html),
    html,
  );

  // A true zero should still render as "0" with neutral styling.
  engine.showConsequence(
    scenario,
    {},
    {
      growth: 0,
      profitMargin: 0,
      morale: 0,
      attrition: 0,
      organizationalCapability: 0,
    },
  );
  const zeroHtml =
    sandbox.document.getElementById("consequence-body").innerHTML;
  check(
    "true zero still renders as 0 (neutral)",
    /impact-value">0%/.test(zeroHtml),
    zeroHtml,
  );
}

// ---------------------------------------------------------------------------
// (e) **x** renders as <strong>x</strong>
// ---------------------------------------------------------------------------
section("(e) markdown **x** -> <strong>x</strong>");
{
  const engine = freshEngine();
  check(
    "formatInlineMarkdown converts **x**",
    engine.formatInlineMarkdown("**WEEK 3:** hello") ===
      "<strong>WEEK 3:</strong> hello",
  );
  check(
    "formatInlineMarkdown converts multiple spans",
    engine.formatInlineMarkdown("**A:** x **B:** y") ===
      "<strong>A:</strong> x <strong>B:</strong> y",
  );
  check(
    "formatInlineMarkdown leaves plain text untouched",
    engine.formatInlineMarkdown("no markup here") === "no markup here",
  );
  check(
    "formatInlineMarkdown passes through non-strings",
    engine.formatInlineMarkdown(undefined) === undefined,
  );

  // The render site must apply the formatter.
  const html = engine.renderScenario({
    title: "T",
    subtitle: "S",
    description: "**WEEK 3:** Your predecessor promised three Q1 initiatives.",
    decisions: [],
  });
  check(
    "renderScenario renders <strong> for **WEEK 3:**",
    /<strong>WEEK 3:<\/strong>/.test(html),
    html,
  );
  check(
    "renderScenario leaves no literal ** in the brief",
    !/\*\*/.test(html),
    html,
  );
}

// ---------------------------------------------------------------------------
// (f) scoring.js growth mappings for coaching / affiliative
// ---------------------------------------------------------------------------
section("(f) coaching / affiliative growth mappings are positive");
{
  const scoringSrc = fs.readFileSync(
    path.join(__dirname, "..", "scoring.js"),
    "utf8",
  );
  check(
    "coaching no longer maps growth += 0",
    !/case "coaching":[\s\S]{0,120}impact\.growth \+= 0;/.test(scoringSrc),
  );
  check(
    "affiliative no longer maps growth += 0",
    !/case "affiliative":[\s\S]{0,160}impact\.growth \+= 0;/.test(scoringSrc),
  );
  check(
    "coaching maps a positive growth impact",
    /case "coaching":[\s\S]{0,400}impact\.growth \+= 0\.5;/.test(scoringSrc),
  );
  check(
    "affiliative maps a positive growth impact",
    /case "affiliative":[\s\S]{0,400}impact\.growth \+= 0\.5;/.test(scoringSrc),
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
