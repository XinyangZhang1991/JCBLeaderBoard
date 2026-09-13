// Regression test: canonical Goleman leadership style -> Jung colour mapping.
//
// Run with: node v2/tests/style-color-consistency.test.js
//
// WHY THIS TEST EXISTS
// --------------------
// Every decision option in v2/scenarios.js carries a `style` (a Goleman
// leadership style) and a `color` (a Jung colour). The two must always agree
// with the canonical mapping below. Fix 1 corrected 18 violations of this
// mapping; without a permanent guard the mapping can silently drift again.
//
// The `color` field is NOT cosmetic: it is read at runtime by
// countAggressiveDecisions() and countCollaborativeDecisions() in
// v2/scoring.js (see the RED/YELLOW/GREEN/BLUE branches around lines 3109 and
// 3136) and by the feedback view. A wrong colour therefore corrupts scoring
// and feedback, so this mapping must be enforced.
//
// CANONICAL MAPPING
// -----------------
//   coercive      -> RED
//   pacesetting   -> RED
//   authoritative -> BLUE
//   affiliative   -> YELLOW
//   democratic    -> YELLOW
//   coaching      -> GREEN
//
// SCOPE
// -----
// Walks BOTH round1Scenarios and round2Scenarios, every scenario, every
// decision. TWO categories of pair are asserted:
//
//   1. OPTION PAIRS  - every options[] entry that has BOTH a `style` and a
//                      `color`. Options lacking a `style` are skipped, and
//                      sliders[] / items[] arrays (which carry `color` but no
//                      `style`) are skipped entirely.
//   2. TIMELINE PAIRS - every decision that carries parallel `styleMapping[]`
//                      and `colorMapping[]` arrays (used by `type: "timeline"`
//                      decisions). Each index i is asserted as
//                      styleMapping[i] -> colorMapping[i].
//
// The two categories are reported separately as well as in total, because the
// timeline mappings are a distinct surface that the original option-only walk
// never inspected (a 147/147 pass was therefore partly vacuous).
//
// Uses only Node built-ins (fs, path, vm). No external packages.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ---------------------------------------------------------------------------
// Canonical Goleman style -> Jung colour mapping
// ---------------------------------------------------------------------------
const CANONICAL = {
  coercive: "RED",
  pacesetting: "RED",
  authoritative: "BLUE",
  affiliative: "YELLOW",
  democratic: "YELLOW",
  coaching: "GREEN",
};

// ---------------------------------------------------------------------------
// Load v2/scenarios.js headlessly.
// scenarios.js assigns to `window.scenarios`, so provide a `window` sandbox
// and execute the source with Node's vm module (mirrors the convention used by
// the other harnesses in v2/tests/).
// ---------------------------------------------------------------------------
const scenariosPath = path.join(__dirname, "..", "scenarios.js");
const scenariosSrc = fs.readFileSync(scenariosPath, "utf8");

const sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(scenariosSrc, sandbox, { filename: scenariosPath });

const scenarios = sandbox.window.scenarios;
if (!scenarios || !scenarios.round1 || !scenarios.round2) {
  console.error(
    "FATAL: could not load window.scenarios { round1, round2 } from " +
      scenariosPath,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Walk the scenarios and check every style/color pair.
// ---------------------------------------------------------------------------
// Option-level counters (existing coverage).
let optionChecked = 0;
let optionPassed = 0;
let optionFailed = 0;
// Timeline-level counters (new coverage).
let timelineChecked = 0;
let timelinePassed = 0;
let timelineFailed = 0;

const failures = [];

function truncate(text, max) {
  const s = String(text == null ? "" : text);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Assert a single style -> color pair, recording the outcome in the supplied
// category counters. `context` carries the human-readable location for the
// failure report.
function assertPair(category, style, color, context) {
  const expected = CANONICAL[style];

  if (category === "option") {
    optionChecked++;
  } else {
    timelineChecked++;
  }

  if (expected === undefined) {
    if (category === "option") {
      optionFailed++;
    } else {
      timelineFailed++;
    }
    failures.push({
      category,
      ...context,
      style,
      color,
      expected: "<unknown style — not in canonical mapping>",
    });
    return;
  }

  if (color === expected) {
    if (category === "option") {
      optionPassed++;
    } else {
      timelinePassed++;
    }
  } else {
    if (category === "option") {
      optionFailed++;
    } else {
      timelineFailed++;
    }
    failures.push({
      category,
      ...context,
      style,
      color,
      expected,
    });
  }
}

function checkRound(roundName, roundScenarios) {
  if (!Array.isArray(roundScenarios)) return;

  roundScenarios.forEach((scenario, scenarioIndex) => {
    if (!scenario || !Array.isArray(scenario.decisions)) return;

    const scenarioLabel =
      scenario.id || scenario.title || "scenario#" + scenarioIndex;

    scenario.decisions.forEach((decision, decisionIndex) => {
      if (!decision || typeof decision !== "object") return;

      // --- Category 1: option pairs -------------------------------------
      // Only options[] carry both style and color. sliders[] / items[] are
      // skipped entirely (they have color but no style).
      if (Array.isArray(decision.options)) {
        decision.options.forEach((option, optionIndex) => {
          if (!option || typeof option !== "object") return;

          // Skip options that lack a style field.
          if (!Object.prototype.hasOwnProperty.call(option, "style")) return;
          // Only assert when a color is also present.
          if (!Object.prototype.hasOwnProperty.call(option, "color")) return;

          assertPair("option", option.style, option.color, {
            roundName,
            scenarioLabel,
            decisionIndex,
            optionIndex,
            text: truncate(option.text, 60),
          });
        });
      }

      // --- Category 2: timeline pairs -----------------------------------
      // Timeline decisions carry parallel styleMapping[] / colorMapping[]
      // arrays. Assert each index where BOTH sides are present.
      const styleMapping = decision.styleMapping;
      const colorMapping = decision.colorMapping;
      if (Array.isArray(styleMapping) && Array.isArray(colorMapping)) {
        const len = Math.min(styleMapping.length, colorMapping.length);
        for (let i = 0; i < len; i++) {
          const style = styleMapping[i];
          const color = colorMapping[i];
          if (style == null || color == null) continue;
          assertPair("timeline", style, color, {
            roundName,
            scenarioLabel,
            decisionIndex,
            optionIndex: i,
            text: truncate(decision.title, 60),
          });
        }
      }
    });
  });
}

checkRound("round1", scenarios.round1);
checkRound("round2", scenarios.round2);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const totalChecked = optionChecked + timelineChecked;
const totalPassed = optionPassed + timelinePassed;
const totalFailed = optionFailed + timelineFailed;

console.log("=== style <-> colour consistency regression test ===");
console.log("Source: " + scenariosPath);
console.log("");

if (failures.length > 0) {
  console.log("FAILURES:");
  failures.forEach((f) => {
    console.log(
      `  [${f.roundName}] ${f.scenarioLabel} | decision[${f.decisionIndex}] ` +
        `${f.category}[${f.optionIndex}] | "${f.text}" | style=${f.style} ` +
        `color=${f.color} expected=${f.expected}`,
    );
  });
  console.log("");
}

console.log("OPTION PAIRS (options[] style/color):");
console.log("  Checked: " + optionChecked);
console.log("  Passed:  " + optionPassed);
console.log("  Failed:  " + optionFailed);
console.log("");
console.log("TIMELINE PAIRS (styleMapping[]/colorMapping[]):");
console.log("  Checked: " + timelineChecked);
console.log("  Passed:  " + timelinePassed);
console.log("  Failed:  " + timelineFailed);
console.log("");
console.log("TOTAL:");
console.log("  Checked: " + totalChecked);
console.log("  Passed:  " + totalPassed);
console.log("  Failed:  " + totalFailed);
console.log("");

if (totalFailed === 0) {
  console.log("RESULT: PASS");
  process.exit(0);
} else {
  console.log("RESULT: FAIL");
  process.exit(1);
}
