// Recommendations Data Table (Issue B)
// ---------------------------------------------------------------------------
// The feedback engine previously hardcoded the same handful of book titles
// ("The Five Dysfunctions of a Team", "Thinking in Bets", "The Coaching Habit")
// into scoring.js and executive-summary-generator.js, so most players saw the
// same three recommendations regardless of profile.
//
// This file extracts the book/resource catalogue into a DATA TABLE keyed by
// { dimension, style, severity } with 3-5 titles per bucket, plus a
// deterministic-but-varied selector:
//
//     index = hash(runId + dimension + style + severity) % bucket.length
//
// The same runId always yields the same recommendation (reproducible), while
// different players/runs surface different titles (variety).
//
// Loaded as a classic (non-module) script BEFORE scoring.js and
// executive-summary-generator.js in index.html, so both can read the global
// `RecommendationsData` / `RecommendationEngine` bindings. It also exports via
// module.exports when required from Node (verification harnesses).
// ---------------------------------------------------------------------------
(function (root) {
  "use strict";

  // -------------------------------------------------------------------------
  // The catalogue. Each bucket is keyed by a stable string id and holds an
  // array of { title, author, why } entries. `why` is a short, tailored line
  // that explains the relevance to the player's profile.
  // -------------------------------------------------------------------------
  var RECOMMENDATIONS_DATA = {
    // --- LEAD dimension gaps -------------------------------------------------
    "dimension:leadership": [
      {
        title: "Primal Leadership",
        author: "Daniel Goleman",
        why: "Understand the emotional-intelligence foundation that separates managers from leaders.",
      },
      {
        title: "Leading Change",
        author: "John P. Kotter",
        why: "Learn a repeatable sequence for mobilising people when the status quo is not enough.",
      },
      {
        title: "The Leadership Challenge",
        author: "Kouzes & Posner",
        why: "Five practical practices for turning positional authority into genuine followership.",
      },
      {
        title: "Start With Why",
        author: "Simon Sinek",
        why: "Articulate a purpose that gives people a reason to follow, not just a task to complete.",
      },
    ],
    "dimension:excellence": [
      {
        title: "Thinking in Bets",
        author: "Annie Duke",
        why: "Improve decision quality when outcomes are uncertain and information is incomplete.",
      },
      {
        title: "Thinking, Fast and Slow",
        author: "Daniel Kahneman",
        why: "Recognise the cognitive biases that make fast, gut-led decisions unreliable.",
      },
      {
        title: "Superforecasting",
        author: "Philip Tetlock",
        why: "Build the evidence-seeking habits that separate calibrated judgement from guesswork.",
      },
      {
        title: "Decisive",
        author: "Chip & Dan Heath",
        why: "A practical framework for widening options and testing assumptions before committing.",
      },
    ],
    "dimension:agility": [
      {
        title: "The Lean Startup",
        author: "Eric Ries",
        why: "Learn to pivot on evidence rather than defend a plan that is no longer working.",
      },
      {
        title: "Antifragile",
        author: "Nassim Nicholas Taleb",
        why: "Understand how to gain from volatility and uncertainty instead of merely surviving it.",
      },
      {
        title: "Team of Teams",
        author: "Stanley McChrystal",
        why: "How to lead adaptable, networked teams in fast-moving and ambiguous environments.",
      },
      {
        title: "Range",
        author: "David Epstein",
        why: "Why broad, cross-domain thinking outperforms narrow specialisation under uncertainty.",
      },
    ],
    "dimension:determination": [
      {
        title: "Grit",
        author: "Angela Duckworth",
        why: "Understand what separates high achievers from everyone else (hint: it is not talent).",
      },
      {
        title: "Mindset",
        author: "Carol Dweck",
        why: "Shift from a fixed to a growth mindset so setbacks become fuel rather than limits.",
      },
      {
        title: "The Obstacle Is the Way",
        author: "Ryan Holiday",
        why: "A practical stoic approach to pushing through discomfort and resistance.",
      },
      {
        title: "Extreme Ownership",
        author: "Jocko Willink & Leif Babin",
        why: "Take full responsibility for outcomes and drive through difficulty without excuses.",
      },
    ],

    // --- Dominant-style overuse ---------------------------------------------
    "style:pacesetting": [
      {
        title: "Multipliers",
        author: "Liz Wiseman",
        why: "Learn when to step back so your team can step up instead of burning out.",
      },
      {
        title: "The Coaching Habit",
        author: "Michael Bungay Stanier",
        why: "Seven questions that develop your team instead of doing everything yourself.",
      },
      {
        title: "Radical Candor",
        author: "Kim Scott",
        why: "Care personally while challenging directly - drive results without depleting people.",
      },
    ],
    "style:democratic": [
      {
        title: "The Five Dysfunctions of a Team",
        author: "Patrick Lencioni",
        why: "Understand when debate must end and commitment must begin.",
      },
      {
        title: "Death by Meeting",
        author: "Patrick Lencioni",
        why: "Turn endless consultation into decisive, well-structured decisions.",
      },
      {
        title: "Playing to Win",
        author: "A.G. Lafley & Roger Martin",
        why: "Make clear strategic choices rather than consulting your way to mediocrity.",
      },
    ],
    "style:affiliative": [
      {
        title: "Radical Candor",
        author: "Kim Scott",
        why: "Learn to care personally AND challenge directly instead of prioritising harmony.",
      },
      {
        title: "Crucial Conversations",
        author: "Patterson, Grenny et al.",
        why: "Handle high-stakes conversations honestly without damaging relationships.",
      },
      {
        title: "The Culture Code",
        author: "Daniel Coyle",
        why: "Build the trust and psychological safety that lets hard truths be spoken.",
      },
    ],
    "style:coaching": [
      {
        title: "Good to Great",
        author: "Jim Collins",
        why: "See how elite leaders develop people AND drive relentless results simultaneously.",
      },
      {
        title: "The Coaching Habit",
        author: "Michael Bungay Stanier",
        why: "Balance developmental conversations with commercial edge and pace.",
      },
      {
        title: "Multipliers",
        author: "Liz Wiseman",
        why: "Amplify your team's intelligence while still holding the line on outcomes.",
      },
    ],
    "style:authoritative": [
      {
        title: "Primal Leadership",
        author: "Daniel Goleman",
        why: "Learn when to inspire and when to involve, rather than broadcasting vision.",
      },
      {
        title: "Turn the Ship Around!",
        author: "L. David Marquet",
        why: "Give control instead of taking it - build leaders at every level.",
      },
      {
        title: "The Five Dysfunctions of a Team",
        author: "Patrick Lencioni",
        why: "Turn a vision-led team into a genuinely collaborative one.",
      },
    ],
    "style:coercive": [
      {
        title: "Dare to Lead",
        author: "Brené Brown",
        why: "Examine why you lead through control rather than trust, and how to change it.",
      },
      {
        title: "Radical Candor",
        author: "Kim Scott",
        why: "Replace fear-based compliance with direct, respectful challenge.",
      },
      {
        title: "Leaders Eat Last",
        author: "Simon Sinek",
        why: "Build the safety and loyalty that command-and-control can never buy.",
      },
    ],

    // --- Attrition / culture crisis -----------------------------------------
    "attrition:severe": [
      {
        title: "Dare to Lead",
        author: "Brené Brown",
        why: "Confront the truth that you cannot lead people you do not genuinely value.",
      },
      {
        title: "The Culture Code",
        author: "Daniel Coyle",
        why: "Understand how trust is built through hundreds of small moments, not grand gestures.",
      },
      {
        title: "Leaders Eat Last",
        author: "Simon Sinek",
        why: "Create the circle of safety that stops talented people walking out the door.",
      },
      {
        title: "No Rules Rules",
        author: "Reed Hastings & Erin Meyer",
        why: "See how high-trust cultures retain talent by removing fear and bureaucracy.",
      },
    ],
    "attrition:moderate": [
      {
        title: "The Coaching Habit",
        author: "Michael Bungay Stanier",
        why: "Commit to one 15-minute development conversation per person, weekly.",
      },
      {
        title: "Radical Candor",
        author: "Kim Scott",
        why: "Care personally while challenging directly - stop losing people to a growth ceiling.",
      },
      {
        title: "The Culture Code",
        author: "Daniel Coyle",
        why: "Build belonging so people stay for the mission, not just the pay.",
      },
    ],

    // --- Pyrrhic victory / morale -------------------------------------------
    "morale:low": [
      {
        title: "The Culture Code",
        author: "Daniel Coyle",
        why: "High-performing teams thrive, they do not just survive quarter to quarter.",
      },
      {
        title: "Multipliers",
        author: "Liz Wiseman",
        why: "Amplify your team instead of depleting them to hit the numbers.",
      },
      {
        title: "Leaders Eat Last",
        author: "Simon Sinek",
        why: "Put people first so success does not come at the cost of their wellbeing.",
      },
      {
        title: "Drive",
        author: "Daniel H. Pink",
        why: "Understand the intrinsic motivators that sustain engagement beyond targets.",
      },
    ],

    // --- Commercial / strategy ----------------------------------------------
    "commercial:strategy": [
      {
        title: "Playing to Win",
        author: "A.G. Lafley & Roger Martin",
        why: "Learn how leaders make high-stakes strategic choices when competitors are circling.",
      },
      {
        title: "Good Strategy Bad Strategy",
        author: "Richard Rumelt",
        why: "Distinguish real strategy from goal-setting and wishful thinking.",
      },
      {
        title: "The Lean Startup",
        author: "Eric Ries",
        why: "Balance bold ambition with evidence-based iteration on the way to growth.",
      },
    ],

    // --- Optimal / world-class ----------------------------------------------
    "optimal:mastery": [
      {
        title: "The Score Takes Care of Itself",
        author: "Bill Walsh",
        why: "Learn how process discipline creates repeatable, sustainable success.",
      },
      {
        title: "Good to Great",
        author: "Jim Collins",
        why: "Understand what separates good leaders from truly great ones.",
      },
      {
        title: "Mastery",
        author: "Robert Greene",
        why: "Deepen the craft of leadership so excellence becomes your default.",
      },
      {
        title: "Peak",
        author: "Anders Ericsson & Robert Pool",
        why: "Apply deliberate practice to keep improving after you are already strong.",
      },
    ],

    // --- Generic / fallback --------------------------------------------------
    "general:development": [
      {
        title: "Primal Leadership",
        author: "Daniel Goleman",
        why: "Master contextual leadership across all six styles.",
      },
      {
        title: "The Coaching Habit",
        author: "Michael Bungay Stanier",
        why: "Develop your people daily with seven simple, repeatable questions.",
      },
      {
        title: "The Five Dysfunctions of a Team",
        author: "Patrick Lencioni",
        why: "Build the trust and accountability that make a team greater than its parts.",
      },
      {
        title: "Multipliers",
        author: "Liz Wiseman",
        why: "Get more done by amplifying your team rather than being the bottleneck.",
      },
    ],
  };

  // -------------------------------------------------------------------------
  // Deterministic string hash (FNV-1a, 32-bit). Stable across runs and
  // platforms so the same runId always selects the same title.
  // -------------------------------------------------------------------------
  function hashString(str) {
    var h = 0x811c9dc5;
    var s = String(str == null ? "" : str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  // -------------------------------------------------------------------------
  // Select one entry from a bucket deterministically-but-variedly.
  //   index = hash(runId + "|" + salt) % bucket.length
  // -------------------------------------------------------------------------
  function pickFromBucket(bucketKey, runId, salt) {
    var bucket = RECOMMENDATIONS_DATA[bucketKey];
    if (!bucket || bucket.length === 0) return null;
    var seed =
      String(runId == null ? "" : runId) +
      "|" +
      bucketKey +
      "|" +
      String(salt == null ? "" : salt);
    var index = hashString(seed) % bucket.length;
    return bucket[index];
  }

  // -------------------------------------------------------------------------
  // Build a recommendation object for a bucket, formatted for the feedback UI.
  // Returns { title, author, why, text } or null when the bucket is missing.
  // -------------------------------------------------------------------------
  function buildRecommendation(bucketKey, runId, salt) {
    var entry = pickFromBucket(bucketKey, runId, salt);
    if (!entry) return null;
    return {
      title: entry.title,
      author: entry.author,
      why: entry.why,
      text: '"' + entry.title + '" by ' + entry.author + " - " + entry.why,
    };
  }

  // -------------------------------------------------------------------------
  // Map a player profile to an ordered list of candidate bucket keys. The
  // caller (scoring.js / executive-summary-generator.js) supplies the profile
  // signals; this keeps the mapping in one place so both engines agree.
  //
  // @param {Object} signals
  //   - dominantStyle {string}   e.g. "pacesetting"
  //   - weakestDimension {string} e.g. "excellence"
  //   - attrition {number}       percentage
  //   - morale {number}          percentage
  //   - escaped {boolean}
  //   - optimal {boolean}
  //   - growth {number}
  // @returns {string[]} ordered bucket keys (most relevant first)
  // -------------------------------------------------------------------------
  function candidateBuckets(signals) {
    var s = signals || {};
    var keys = [];

    // Attrition / culture crisis takes priority - it is the most urgent signal.
    if (typeof s.attrition === "number" && s.attrition >= 20) {
      keys.push("attrition:severe");
    } else if (typeof s.attrition === "number" && s.attrition >= 15) {
      keys.push("attrition:moderate");
    }

    // Pyrrhic victory: won but morale is low.
    if (s.escaped && typeof s.morale === "number" && s.morale < 70) {
      keys.push("morale:low");
    }

    // Dominant-style overuse.
    if (s.dominantStyle && RECOMMENDATIONS_DATA["style:" + s.dominantStyle]) {
      keys.push("style:" + s.dominantStyle);
    }

    // Weakest LEAD dimension.
    if (
      s.weakestDimension &&
      RECOMMENDATIONS_DATA["dimension:" + s.weakestDimension]
    ) {
      keys.push("dimension:" + s.weakestDimension);
    }

    // Commercial / strategy shortfall.
    if (typeof s.growth === "number" && s.growth < 15) {
      keys.push("commercial:strategy");
    }

    // Optimal - focus on mastery.
    if (s.optimal) {
      keys.push("optimal:mastery");
    }

    // Always end with the generic fallback so there is never an empty list.
    keys.push("general:development");
    return keys;
  }

  // -------------------------------------------------------------------------
  // Produce up to `limit` distinct recommendations for a profile, varying by
  // runId while staying reproducible for the same runId.
  // -------------------------------------------------------------------------
  function recommendForProfile(signals, runId, limit) {
    var max = typeof limit === "number" ? limit : 3;
    var buckets = candidateBuckets(signals);
    var out = [];
    var seenTitles = {};
    for (var i = 0; i < buckets.length && out.length < max; i++) {
      var rec = buildRecommendation(buckets[i], runId, i);
      if (!rec) continue;
      if (seenTitles[rec.title]) continue;
      seenTitles[rec.title] = true;
      out.push(rec);
    }
    return out;
  }

  var api = {
    RECOMMENDATIONS_DATA: RECOMMENDATIONS_DATA,
    hashString: hashString,
    pickFromBucket: pickFromBucket,
    buildRecommendation: buildRecommendation,
    candidateBuckets: candidateBuckets,
    recommendForProfile: recommendForProfile,
  };

  // Publish to the browser global (classic script) and to Node (harness).
  root.RecommendationsData = api;
  root.RecommendationEngine = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
