// Verification harness for DEBUG_FINDINGS_2 PRIORITY 3 / item #8:
// feedback <-> scoring ALIGNMENT.
//
// Run with: node v2/_verify_feedback_alignment.js
//
// Covers the five required checks:
//   (a) the colour archetype appears in the narrative;
//   (b) the Self-Image vs Reality block renders correctly for MATCHING,
//       DIVERGING and ABSENT self-identified styles;
//   (c) at least one concrete decision is cited;
//   (d) getLeadFeedback() returns DIFFERENT text for two players in the SAME
//       band but with DIFFERENT dominant styles;
//   (e) feedback does not contradict the score for a balanced vs a
//       one-dimensional player.
//
// Self-contained: Node built-ins only. Both scoring.js and game-engine.js are
// browser-global classic scripts, so they are loaded in a vm sandbox that
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
    classList: { add() {}, remove() {} },
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
// Sandbox
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

// lead-constants.js publishes root.LEAD_CONSTANTS (IIFE-wrapped).
const leadConstantsSrc = fs.readFileSync(
  path.join(__dirname, "..", "lead-constants.js"),
  "utf8",
);
vm.createContext(sandbox);
vm.runInContext(leadConstantsSrc, sandbox);

// scoring.js declares `class ScoringEngine` and `const scoringEngine` at top
// level (lexical), so append explicit exports for the harness.
const scoringSrc = fs.readFileSync(
  path.join(__dirname, "..", "scoring.js"),
  "utf8",
);
vm.runInContext(
  scoringSrc + "\n;this.ScoringEngine = ScoringEngine;\n",
  sandbox,
);

// game-engine.js declares `class GameEngine` at top level.
const engineSrc = fs.readFileSync(
  path.join(__dirname, "..", "game-engine.js"),
  "utf8",
);
vm.runInContext(engineSrc + "\n;this.GameEngine = GameEngine;\n", sandbox);

const ScoringEngine = sandbox.ScoringEngine;
const GameEngine = sandbox.GameEngine;

check(
  "ScoringEngine class loaded from browser-global script",
  typeof ScoringEngine === "function",
);
check(
  "GameEngine class loaded from browser-global script",
  typeof GameEngine === "function",
);

const scoring = new ScoringEngine();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A decision record shaped exactly like collectDecisionData() + applyDecisionImpact()
// produce: { scenario, choices, scenarioTitle, scenarioId, stylesUsed, colorsUsed }.
function decision(scenarioId, scenarioTitle, stylesUsed) {
  return {
    scenario: 1,
    timestamp: Date.now(),
    choices: [{ type: "choice", index: 0 }],
    scenarioId: scenarioId,
    scenarioTitle: scenarioTitle,
    stylesUsed: stylesUsed || [],
    colorsUsed: [],
  };
}

// Build a gameState with a given six-style profile (percentages summing ~100).
function makeGameState(opts) {
  const o = opts || {};
  const profile = o.profile || {
    coercive: 5,
    authoritative: 20,
    affiliative: 20,
    democratic: 20,
    pacesetting: 15,
    coaching: 20,
  };
  const decisions = o.decisions || [
    decision("safety_crisis", "THE SAFETY NEAR-MISS", ["coaching"]),
    decision("talent_exodus", "THE TALENT EXODUS", ["pacesetting"]),
    decision("year_end", "THE YEAR-END RECKONING", ["democratic"]),
  ];
  return {
    playerName: "Test Player",
    round: o.round || 1,
    growth: o.growth === undefined ? 20 : o.growth,
    morale: o.morale === undefined ? 72 : o.morale,
    attrition: o.attrition === undefined ? 8 : o.attrition,
    profitMargin: o.profitMargin === undefined ? 22 : o.profitMargin,
    organizationalCapability:
      o.organizationalCapability === undefined
        ? 90
        : o.organizationalCapability,
    leadership: o.leadership === undefined ? 120 : o.leadership,
    excellence: o.excellence === undefined ? 120 : o.excellence,
    agility: o.agility === undefined ? 120 : o.agility,
    determination: o.determination === undefined ? 120 : o.determination,
    leadershipStyles: profile,
    decisions: decisions,
    infoRequests: o.infoRequests || [{ scenario: 1, requests: [0, 1] }],
    selfIdentifiedStyle: o.selfIdentifiedStyle,
  };
}

// Build a results object the way calculateFinalScore() does, so generateFeedback
// receives the same shape it does in production.
function makeResults(gameState) {
  const profile = gameState.leadershipStyles;
  const total = Object.values(profile).reduce((a, b) => a + b, 0) || 1;
  const stylePercentages = {};
  Object.keys(profile).forEach((s) => {
    stylePercentages[s] = Math.round((profile[s] / total) * 100);
  });
  const maxStylePercentage = Math.max(...Object.values(stylePercentages));
  const round = gameState.round === 2 ? 2 : 1;
  const benchmark = round === 2 ? 114 : 171;
  const leadRatios = {
    leadership: gameState.leadership / benchmark,
    excellence: gameState.excellence / benchmark,
    agility: gameState.agility / benchmark,
    determination: gameState.determination / benchmark,
  };
  const avgLEADRatio =
    (leadRatios.leadership +
      leadRatios.excellence +
      leadRatios.agility +
      leadRatios.determination) /
    4;
  const results = {
    escaped: true,
    optimal: false,
    leadershipProfile: stylePercentages,
    stylePercentages: stylePercentages,
    maxStylePercentage: maxStylePercentage,
    leadRatios: leadRatios,
    avgLEADRatio: avgLEADRatio,
    meetsLEADQuality: avgLEADRatio >= 0.4,
    meetsBalanceRequirement: maxStylePercentage <= 70,
    meetsGrowth: gameState.growth >= 15,
    capabilityPath: false,
    personalityColor: scoring.calculatePersonalityColor(gameState),
    personalityDescription: "",
  };
  results.personalityDescription = scoring.getPersonalityDescription(
    results.personalityColor,
  );
  return results;
}

function feedbackFor(gameState) {
  const results = makeResults(gameState);
  return scoring.generateFeedback(gameState, results);
}

// ---------------------------------------------------------------------------
// (a) The colour archetype appears in the narrative
// ---------------------------------------------------------------------------
section("(a) colour archetype appears in the narrative");
{
  // A strongly pacesetting/coercive profile -> RED.
  const redState = makeGameState({
    profile: {
      coercive: 20,
      authoritative: 5,
      affiliative: 5,
      democratic: 5,
      pacesetting: 55,
      coaching: 10,
    },
  });
  const redResults = makeResults(redState);
  const redFeedback = feedbackFor(redState);
  check(
    "RED profile computes personalityColor RED",
    redResults.personalityColor === "RED",
    redResults.personalityColor,
  );
  check(
    "feedback opens with the archetype heading",
    /Your Leadership Profile:/.test(redFeedback),
  );
  check(
    "feedback names the computed colour (RED)",
    redFeedback.includes("RED"),
  );
  check(
    "feedback includes the archetype tagline (The Driver)",
    redFeedback.includes("The Driver"),
  );
  check(
    "feedback justifies the colour with the two most-used styles",
    /most-used styles/.test(redFeedback),
  );

  // A strongly coaching profile -> GREEN.
  const greenState = makeGameState({
    profile: {
      coercive: 2,
      authoritative: 8,
      affiliative: 10,
      democratic: 10,
      pacesetting: 5,
      coaching: 65,
    },
  });
  const greenResults = makeResults(greenState);
  const greenFeedback = feedbackFor(greenState);
  check(
    "GREEN profile computes personalityColor GREEN",
    greenResults.personalityColor === "GREEN",
    greenResults.personalityColor,
  );
  check(
    "GREEN feedback includes the archetype tagline (The Developer)",
    greenFeedback.includes("The Developer"),
  );
  check("RED and GREEN narratives differ", redFeedback !== greenFeedback);

  // A genuinely spread profile -> BALANCED.
  const balancedState = makeGameState({
    profile: {
      coercive: 16,
      authoritative: 17,
      affiliative: 17,
      democratic: 17,
      pacesetting: 16,
      coaching: 17,
    },
  });
  const balancedResults = makeResults(balancedState);
  const balancedFeedback = feedbackFor(balancedState);
  check(
    "spread profile computes personalityColor BALANCED",
    balancedResults.personalityColor === "BALANCED",
    balancedResults.personalityColor,
  );
  check(
    "BALANCED feedback includes the archetype tagline (The Adaptive Leader)",
    balancedFeedback.includes("The Adaptive Leader"),
  );
}

// ---------------------------------------------------------------------------
// (b) Self-Image vs Reality block: matching / diverging / absent
// ---------------------------------------------------------------------------
section("(b) Self-Image vs Reality block");
{
  // MATCHING: self-identified coaching, dominant coaching.
  const matchState = makeGameState({
    profile: {
      coercive: 2,
      authoritative: 8,
      affiliative: 10,
      democratic: 10,
      pacesetting: 5,
      coaching: 65,
    },
    selfIdentifiedStyle: "coaching",
  });
  const matchFeedback = feedbackFor(matchState);
  check("block heading present", /Self-Image vs Reality:/.test(matchFeedback));
  check("matching case affirms alignment", /Aligned\./.test(matchFeedback));
  check(
    "matching case names the self-identified style",
    /Coaching/.test(matchFeedback),
  );

  // DIVERGING: self-identified democratic, dominant pacesetting.
  const divergeState = makeGameState({
    profile: {
      coercive: 10,
      authoritative: 10,
      affiliative: 5,
      democratic: 8,
      pacesetting: 55,
      coaching: 12,
    },
    selfIdentifiedStyle: "democratic",
  });
  const divergeFeedback = feedbackFor(divergeState);
  check(
    "diverging case flags a gap",
    /gap worth examining/.test(divergeFeedback),
  );
  check(
    "diverging case names the self-identified style (Democratic)",
    /Democratic/.test(divergeFeedback),
  );
  check(
    "diverging case names the revealed dominant style (pacesetting)",
    /pacesetting/.test(divergeFeedback),
  );

  // ABSENT: no self-identified style.
  const absentState = makeGameState({
    profile: {
      coercive: 5,
      authoritative: 20,
      affiliative: 20,
      democratic: 20,
      pacesetting: 15,
      coaching: 20,
    },
    selfIdentifiedStyle: "",
  });
  const absentFeedback = feedbackFor(absentState);
  check(
    "absent case still renders the block",
    /Self-Image vs Reality:/.test(absentFeedback),
  );
  check(
    "absent case explains no style was nominated",
    /did not nominate a primary style/.test(absentFeedback),
  );
  check(
    "absent case does not falsely claim alignment",
    !/Aligned\./.test(absentFeedback),
  );
}

// ---------------------------------------------------------------------------
// (c) At least one concrete decision is cited
// ---------------------------------------------------------------------------
section("(c) concrete decision citation");
{
  const state = makeGameState({
    profile: {
      coercive: 5,
      authoritative: 20,
      affiliative: 20,
      democratic: 20,
      pacesetting: 15,
      coaching: 20,
    },
    decisions: [
      decision("safety_crisis", "THE SAFETY NEAR-MISS", ["coaching"]),
      decision("talent_exodus", "THE TALENT EXODUS", ["pacesetting"]),
      decision("year_end", "THE YEAR-END RECKONING", ["democratic"]),
    ],
  });
  const fb = feedbackFor(state);
  check(
    "feedback cites a concrete scenario title",
    /safety near-miss|talent exodus|year-end reckoning/i.test(fb),
  );
  check(
    "citation is grounded in the player's own decisions",
    /you leaned|your handling of/i.test(fb),
  );

  // No decisions -> citation is omitted, not fabricated.
  const noDecState = makeGameState({
    profile: {
      coercive: 5,
      authoritative: 20,
      affiliative: 20,
      democratic: 20,
      pacesetting: 15,
      coaching: 20,
    },
    decisions: [],
  });
  const noDecFb = feedbackFor(noDecState);
  check(
    "no decisions -> no fabricated citation",
    !/you leaned on/i.test(noDecFb),
  );
}

// ---------------------------------------------------------------------------
// (d) getLeadFeedback() differs for same band, different dominant style
// ---------------------------------------------------------------------------
section("(d) getLeadFeedback() style-aware variants");
{
  const engine = new GameEngine();
  engine.state = { round: 1 };

  // Same LOW band score (30 / 171 = 17.5% -> "low") for both players.
  const lowScore = 30;
  const coerciveLow = engine.getLeadFeedback(
    "leadership",
    lowScore,
    "coercive",
  );
  const democraticLow = engine.getLeadFeedback(
    "leadership",
    lowScore,
    "democratic",
  );
  check(
    "same LOW band, coercive vs democratic -> DIFFERENT text",
    coerciveLow !== democraticLow,
    `coercive="${coerciveLow}" democratic="${democraticLow}"`,
  );
  check("coercive LOW variant mentions control", /control/i.test(coerciveLow));
  check(
    "democratic LOW variant mentions consensus",
    /consensus/i.test(democraticLow),
  );

  // Same MEDIUM band score (100 / 171 = 58% -> "medium").
  const medScore = 100;
  const pacesettingMed = engine.getLeadFeedback(
    "excellence",
    medScore,
    "pacesetting",
  );
  const coachingMed = engine.getLeadFeedback(
    "excellence",
    medScore,
    "coaching",
  );
  check(
    "same MEDIUM band, pacesetting vs coaching -> DIFFERENT text",
    pacesettingMed !== coachingMed,
  );

  // Backwards compatibility: no dominant style -> generic copy unchanged.
  const genericLow = engine.getLeadFeedback("leadership", lowScore);
  check(
    "legacy call (no style) still returns generic copy",
    /primarily transactional/.test(genericLow),
  );
  check(
    "legacy call differs from style-aware call",
    genericLow !== coerciveLow,
  );

  // HIGH band is a strength affirmation and is not style-varied.
  const highScore = 150; // 87.7% -> high
  const highA = engine.getLeadFeedback("leadership", highScore, "coercive");
  const highB = engine.getLeadFeedback("leadership", highScore, "democratic");
  check(
    "HIGH band is identical regardless of style (strength affirmation)",
    highA === highB,
  );
}

// ---------------------------------------------------------------------------
// (e) Feedback does not contradict the score (balanced vs one-dimensional)
// ---------------------------------------------------------------------------
section("(e) feedback does not contradict the score");
{
  // BALANCED player: no style above the canonical 60% balance ceiling. The
  // scoring engine rewards balance, so the feedback must NOT accuse them of
  // over-reliance / one-dimensional play.
  const balancedState = makeGameState({
    profile: {
      coercive: 16,
      authoritative: 17,
      affiliative: 17,
      democratic: 17,
      pacesetting: 16,
      coaching: 17,
    },
  });
  const balancedResults = makeResults(balancedState);
  const balancedFb = feedbackFor(balancedState);
  const balancedMax = balancedResults.maxStylePercentage;
  check(
    "balanced profile has no style above the 60% balance ceiling",
    balancedMax <= 60,
    String(balancedMax),
  );
  check(
    "balanced feedback does NOT claim single-style over-reliance",
    !/over-reliance on/i.test(balancedFb) && !/single <em>/.test(balancedFb),
  );
  check(
    "balanced feedback acknowledges range/adaptability",
    /Adaptive Leader|range|flex/i.test(balancedFb),
  );

  // ONE-DIMENSIONAL player: a single style > 60%. Scoring penalises this, so
  // the feedback MUST name the over-reliance.
  const oneDimState = makeGameState({
    profile: {
      coercive: 5,
      authoritative: 5,
      affiliative: 5,
      democratic: 5,
      pacesetting: 75,
      coaching: 5,
    },
  });
  const oneDimResults = makeResults(oneDimState);
  const oneDimFb = feedbackFor(oneDimState);
  check(
    "one-dimensional profile has a style above 60%",
    oneDimResults.maxStylePercentage > 60,
    String(oneDimResults.maxStylePercentage),
  );
  check(
    "one-dimensional feedback names the over-reliance",
    /over-reliance on|single <em>|adaptability warning/i.test(oneDimFb),
  );
  check(
    "one-dimensional feedback names the dominant style",
    /pacesetting/i.test(oneDimFb),
  );

  // The two narratives must be materially different.
  check(
    "balanced and one-dimensional feedback differ",
    balancedFb !== oneDimFb,
  );

  // Colour archetype must match the computed colour in BOTH cases (no
  // contradiction between the prose and the leaderboard badge).
  check(
    "balanced prose colour matches computed colour",
    balancedFb.includes(balancedResults.personalityColor),
  );
  check(
    "one-dimensional prose colour matches computed colour",
    oneDimFb.includes(oneDimResults.personalityColor),
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n----------------------------------------`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`----------------------------------------`);

process.exit(failed === 0 ? 0 : 1);
