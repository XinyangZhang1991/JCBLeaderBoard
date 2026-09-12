// Company Culture Analysis Engine for JCB Leadership Game
// Analyses the aggregate leadership data of everyone who has played.
//
// DESIGN PRINCIPLE: This engine is DESCRIPTIVE, not comparative.
// It reports what the cohort actually did - distributions, ranges,
// medians, concentration and consistency - with no external benchmark
// and no invented "high performance" target. Every figure shown is
// derived directly from the players' own results, so nothing can be
// claimed that is not explicitly true of the data.

class CultureAnalysis {
  constructor() {
    // Minimum number of players required before any analysis is shown.
    this.minPlayers = 3;
    // Minimum players in a segment before that segment is displayed.
    this.minSegmentSize = 3;
  }

  analyzeCulture(cohortData) {
    if (!cohortData || cohortData.length < this.minPlayers) {
      return {
        error: "Insufficient data",
        message:
          "Company Culture Analysis requires at least " +
          this.minPlayers +
          " leaders to have completed the game.",
        playerCount: cohortData ? cohortData.length : 0,
      };
    }

    const analysis = {
      playerCount: cohortData.length,
      metrics: this.calculateAggregateMetrics(cohortData),
      leadership: this.analyzeLeadershipDistribution(cohortData),
      decisions: this.analyzeDecisionPatterns(cohortData),
      lead: this.analyzeLEADScores(cohortData),
      colors: this.analyzePersonalityColors(cohortData),
      segments: this.analyzeSegments(cohortData),
      observations: [],
      recommendations: [],
    };

    // Descriptive observations derived only from the data above
    this.generateObservations(analysis);

    // Recommendations derived only from the observations
    this.generateRecommendations(analysis);

    return analysis;
  }

  // ------------------------------------------------------------------
  // Descriptive statistics helpers
  // ------------------------------------------------------------------

  mean(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  min(values) {
    return values.length ? Math.min(...values) : 0;
  }

  max(values) {
    return values.length ? Math.max(...values) : 0;
  }

  // Population standard deviation - used to describe spread/consistency
  stdDev(values) {
    if (values.length < 2) return 0;
    const m = this.mean(values);
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Shannon entropy normalised to 0-1 (0 = all one value, 1 = perfectly even)
  calculateDiversityIndex(values) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    const probabilities = values.map((v) => v / total).filter((p) => p > 0);
    const entropy = -probabilities.reduce(
      (sum, p) => sum + p * Math.log2(p),
      0,
    );
    const maxEntropy = Math.log2(values.length);

    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  // Returns a plain-language description of how tightly values cluster.
  describeConsistency(values, unit) {
    const sd = this.stdDev(values);
    const m = this.mean(values);
    if (m === 0) return "no variation data";
    const cv = (sd / Math.abs(m)) * 100;
    if (cv < 10) return "very consistent";
    if (cv < 20) return "broadly consistent";
    if (cv < 35) return "varied";
    return "highly varied";
  }

  // ------------------------------------------------------------------
  // Aggregate metrics (descriptive only)
  // ------------------------------------------------------------------

  calculateAggregateMetrics(data) {
    const growth = data.map((p) => p.growth || 0);
    const morale = data.map((p) => p.morale || 0);
    const attrition = data.map((p) => p.attrition || 0);
    const profit = data.map((p) => p.profitMargin || 0);

    const metrics = {
      // Growth
      avgGrowth: this.mean(growth),
      medianGrowth: this.median(growth),
      minGrowth: this.min(growth),
      maxGrowth: this.max(growth),
      growthSpread: this.stdDev(growth),
      growthConsistency: this.describeConsistency(growth, "%"),

      // Morale
      avgMorale: this.mean(morale),
      medianMorale: this.median(morale),
      minMorale: this.min(morale),
      maxMorale: this.max(morale),
      moraleSpread: this.stdDev(morale),
      moraleConsistency: this.describeConsistency(morale, "%"),

      // Attrition
      avgAttrition: this.mean(attrition),
      medianAttrition: this.median(attrition),
      minAttrition: this.min(attrition),
      maxAttrition: this.max(attrition),

      // Profit
      avgProfitMargin: this.mean(profit),
      medianProfitMargin: this.median(profit),

      // Outcomes (factual counts)
      successCount: data.filter((p) => p.escaped).length,
      optimalCount: data.filter((p) => p.optimal).length,
      successRate: (data.filter((p) => p.escaped).length / data.length) * 100,
      optimalRate: (data.filter((p) => p.optimal).length / data.length) * 100,
    };

    return metrics;
  }

  // ------------------------------------------------------------------
  // Leadership style distribution (descriptive only)
  // ------------------------------------------------------------------

  analyzeLeadershipDistribution(data) {
    const styleAggregate = {
      coercive: 0,
      authoritative: 0,
      affiliative: 0,
      democratic: 0,
      pacesetting: 0,
      coaching: 0,
    };

    const dominantStyles = {};

    // PERCENTAGE ACCURACY FIX: `leadershipProfile` is documented as a 0-100
    // percentage split, but the code elsewhere also accepts raw style points.
    // Averaging raw points directly produced aggregates far above 100. We now
    // normalise each player's profile to a percentage split (summing to 100)
    // BEFORE averaging, and skip players whose profile is empty/non-finite.
    let contributingPlayers = 0;

    data.forEach((player) => {
      if (player.leadershipProfile) {
        // Sum only the recognised, finite style values for this player.
        let profileSum = 0;
        Object.keys(styleAggregate).forEach((style) => {
          const v = player.leadershipProfile[style];
          if (typeof v === "number" && isFinite(v) && v > 0) {
            profileSum += v;
          }
        });

        // Skip players with no usable profile (sum 0 or non-finite) so they
        // do not drag the cohort average toward zero.
        if (profileSum > 0 && isFinite(profileSum)) {
          contributingPlayers++;
          Object.keys(styleAggregate).forEach((style) => {
            const v = player.leadershipProfile[style];
            const safe = typeof v === "number" && isFinite(v) && v > 0 ? v : 0;
            // Scale so each player contributes exactly 100 percentage points.
            styleAggregate[style] += (safe / profileSum) * 100;
          });
        }
      }

      const style = player.leadershipStyle || "Unknown";
      dominantStyles[style] = (dominantStyles[style] || 0) + 1;
    });

    // Average across contributing players only (fall back to cohort size when
    // nobody had a usable profile, preserving the previous zero behaviour).
    const count = contributingPlayers > 0 ? contributingPlayers : data.length;
    Object.keys(styleAggregate).forEach((style) => {
      // Clamp each aggregate share to 0-100 for safety.
      const avg = styleAggregate[style] / count;
      styleAggregate[style] = isFinite(avg)
        ? Math.max(0, Math.min(100, avg))
        : 0;
    });

    const diversity = this.calculateDiversityIndex(
      Object.values(styleAggregate),
    );

    const sortedStyles = Object.entries(styleAggregate).sort(
      (a, b) => b[1] - a[1],
    );

    // How many leaders named each style as their self-identified primary
    const selfIdentified = {};
    data.forEach((p) => {
      const s = p.selfIdentifiedStyle || "Unknown";
      selfIdentified[s] = (selfIdentified[s] || 0) + 1;
    });

    // PERCENTAGE ACCURACY FIX: mostUsed/leastUsed derive from the aggregate, so
    // clamp their percentage component to 0-100 as well (the style name is
    // untouched). diversity is an entropy index already bounded 0-1; clamp it
    // defensively so it can never render above 100%.
    const clampPair = (pair) =>
      pair
        ? [
            pair[0],
            typeof pair[1] === "number" && isFinite(pair[1])
              ? Math.max(0, Math.min(100, pair[1]))
              : 0,
          ]
        : pair;

    return {
      aggregate: styleAggregate,
      dominantStyles: dominantStyles,
      selfIdentified: selfIdentified,
      diversity:
        typeof diversity === "number" && isFinite(diversity)
          ? Math.max(0, Math.min(1, diversity))
          : 0,
      mostUsed: clampPair(sortedStyles[0]),
      leastUsed: clampPair(sortedStyles[sortedStyles.length - 1]),
      // Descriptive label based on the entropy index only
      spreadLabel:
        diversity >= 0.85
          ? "Evenly spread"
          : diversity >= 0.65
            ? "Moderately spread"
            : "Concentrated",
    };
  }

  // ------------------------------------------------------------------
  // Decision patterns (descriptive only)
  // ------------------------------------------------------------------

  analyzeDecisionPatterns(data) {
    // Scan ALL players for decision history, not just the first record
    const playersWithDecisions = data.filter(
      (p) => Array.isArray(p.decisions) && p.decisions.length > 0,
    );

    if (playersWithDecisions.length === 0) {
      return {
        available: false,
        message: "Decision history not available for this cohort",
      };
    }

    const patterns = {
      available: true,
      playersWithDecisions: playersWithDecisions.length,
      aggressiveDecisionCount: 0,
      collaborativeDecisionCount: 0,
      totalDecisions: 0,
      aggressiveDecisionRate: 0,
      collaborativeDecisionRate: 0,
      infoSeekingBehavior: {
        avgRequestsPerPlayer: 0,
        totalRequests: 0,
      },
    };

    let totalAggressive = 0;
    let totalCollaborative = 0;
    let totalDecisions = 0;
    let totalInfoRequests = 0;

    playersWithDecisions.forEach((player) => {
      player.decisions.forEach((decision) => {
        totalDecisions++;
        if (decision.stylesUsed) {
          if (
            decision.stylesUsed.includes("pacesetting") ||
            decision.stylesUsed.includes("coercive")
          ) {
            totalAggressive++;
          }
          if (
            decision.stylesUsed.includes("democratic") ||
            decision.stylesUsed.includes("coaching") ||
            decision.stylesUsed.includes("affiliative")
          ) {
            totalCollaborative++;
          }
        }
      });

      if (Array.isArray(player.infoRequests)) {
        totalInfoRequests += player.infoRequests.length;
      }
    });

    patterns.totalDecisions = totalDecisions;
    patterns.aggressiveDecisionCount = totalAggressive;
    patterns.collaborativeDecisionCount = totalCollaborative;
    patterns.aggressiveDecisionRate =
      totalDecisions > 0 ? (totalAggressive / totalDecisions) * 100 : 0;
    patterns.collaborativeDecisionRate =
      totalDecisions > 0 ? (totalCollaborative / totalDecisions) * 100 : 0;
    patterns.infoSeekingBehavior.totalRequests = totalInfoRequests;
    patterns.infoSeekingBehavior.avgRequestsPerPlayer =
      totalInfoRequests / playersWithDecisions.length;

    return patterns;
  }

  // ------------------------------------------------------------------
  // LEAD scores (descriptive only)
  // ------------------------------------------------------------------

  analyzeLEADScores(data) {
    const collect = (key) => data.map((p) => p[key] || 0);

    const leadership = collect("leadership");
    const excellence = collect("excellence");
    const agility = collect("agility");
    const determination = collect("determination");

    const describe = (values) => ({
      avg: this.mean(values),
      median: this.median(values),
      min: this.min(values),
      max: this.max(values),
      spread: this.stdDev(values),
      consistency: this.describeConsistency(values, "pts"),
    });

    return {
      leadership: describe(leadership),
      excellence: describe(excellence),
      agility: describe(agility),
      determination: describe(determination),
    };
  }

  // ------------------------------------------------------------------
  // Personality colours (descriptive only)
  // ------------------------------------------------------------------

  analyzePersonalityColors(data) {
    const colors = {
      RED: 0,
      BLUE: 0,
      YELLOW: 0,
      GREEN: 0,
      BALANCED: 0,
    };

    data.forEach((player) => {
      const raw = player.personalityColor || "BALANCED";
      // Compound colours (e.g. "RED/YELLOW") are bucketed into their
      // PRIMARY component (the part before the "/") so the counts
      // always total data.length and percentages sum to ~100.
      // Unknown/empty values fall back to BALANCED.
      const primary = String(raw).split("/")[0].trim();
      if (primary in colors) {
        colors[primary]++;
      } else {
        colors.BALANCED++;
      }
    });

    const total = data.length;
    const percentages = {};
    Object.keys(colors).forEach((color) => {
      percentages[color] = (colors[color] / total) * 100;
    });

    const dominant = Object.keys(colors).reduce((a, b) =>
      colors[a] >= colors[b] ? a : b,
    );

    return {
      counts: colors,
      percentages: percentages,
      dominant: dominant,
    };
  }

  // ------------------------------------------------------------------
  // Segmentation by business function and seniority
  // ------------------------------------------------------------------

  analyzeSegments(data) {
    return {
      byFunction: this.segmentBy(data, "jobFunction"),
      bySeniority: this.segmentBy(data, "seniority"),
    };
  }

  segmentBy(data, field) {
    const groups = {};

    data.forEach((player) => {
      const key = player[field] || "Not specified";
      if (!groups[key]) groups[key] = [];
      groups[key].push(player);
    });

    const segments = Object.entries(groups)
      .map(([name, players]) => {
        const growth = players.map((p) => p.growth || 0);
        const morale = players.map((p) => p.morale || 0);
        const attrition = players.map((p) => p.attrition || 0);

        // Dominant style within this segment
        const styleTotals = {};
        players.forEach((p) => {
          if (p.leadershipProfile) {
            Object.entries(p.leadershipProfile).forEach(([style, val]) => {
              styleTotals[style] = (styleTotals[style] || 0) + (val || 0);
            });
          }
        });
        const dominantStyle = Object.entries(styleTotals).sort(
          (a, b) => b[1] - a[1],
        )[0];

        return {
          name: name,
          count: players.length,
          avgGrowth: this.mean(growth),
          avgMorale: this.mean(morale),
          avgAttrition: this.mean(attrition),
          dominantStyle: dominantStyle ? dominantStyle[0] : null,
          // Only meaningful when the segment is large enough
          sufficient: players.length >= this.minSegmentSize,
        };
      })
      .sort((a, b) => b.count - a.count);

    return segments;
  }

  // ------------------------------------------------------------------
  // Descriptive observations (replaces strengths/weaknesses/risks)
  // ------------------------------------------------------------------

  generateObservations(analysis) {
    const { metrics, leadership, lead, decisions, colors, segments } = analysis;

    // --- Performance spread ---
    analysis.observations.push({
      category: "Performance Range",
      headline:
        "Growth outcomes ranged from " +
        metrics.minGrowth.toFixed(1) +
        "% to " +
        metrics.maxGrowth.toFixed(1) +
        "%",
      detail:
        "The median was " +
        metrics.medianGrowth.toFixed(1) +
        "% and the average " +
        metrics.avgGrowth.toFixed(1) +
        "%. Outcomes were " +
        metrics.growthConsistency +
        " across the cohort.",
    });

    // --- Morale spread ---
    analysis.observations.push({
      category: "Team Health Range",
      headline:
        "Morale outcomes ranged from " +
        metrics.minMorale.toFixed(0) +
        "% to " +
        metrics.maxMorale.toFixed(0) +
        "%",
      detail:
        "The median was " +
        metrics.medianMorale.toFixed(0) +
        "% and the average " +
        metrics.avgMorale.toFixed(0) +
        "%. Morale was " +
        metrics.moraleConsistency +
        " across the cohort.",
    });

    // --- Attrition spread ---
    analysis.observations.push({
      category: "Retention Range",
      headline:
        "Attrition outcomes ranged from " +
        metrics.minAttrition.toFixed(1) +
        "% to " +
        metrics.maxAttrition.toFixed(1) +
        "%",
      detail:
        "The median was " +
        metrics.medianAttrition.toFixed(1) +
        "% and the average " +
        metrics.avgAttrition.toFixed(1) +
        "%.",
    });

    // --- Leadership style concentration ---
    analysis.observations.push({
      category: "Leadership Style Spread",
      headline:
        "Most used style: " +
        this.capitalize(leadership.mostUsed[0]) +
        " (" +
        leadership.mostUsed[1].toFixed(0) +
        "%)",
      detail:
        "Least used: " +
        this.capitalize(leadership.leastUsed[0]) +
        " (" +
        leadership.leastUsed[1].toFixed(0) +
        "%). Style usage was " +
        leadership.spreadLabel.toLowerCase() +
        " (diversity index " +
        (leadership.diversity * 100).toFixed(0) +
        "%).",
    });

    // --- LEAD profile ---
    const leadDims = [
      ["Leadership", lead.leadership],
      ["Excellence", lead.excellence],
      ["Agility", lead.agility],
      ["Determination", lead.determination],
    ];
    const strongest = [...leadDims].sort((a, b) => b[1].avg - a[1].avg)[0];
    const weakest = [...leadDims].sort((a, b) => a[1].avg - b[1].avg)[0];

    analysis.observations.push({
      category: "LEAD Profile",
      headline:
        "Highest average: " +
        strongest[0] +
        " (" +
        strongest[1].avg.toFixed(0) +
        " pts)",
      detail:
        "Lowest average: " +
        weakest[0] +
        " (" +
        weakest[1].avg.toFixed(0) +
        " pts). Scores ranged from " +
        weakest[1].min.toFixed(0) +
        " to " +
        strongest[1].max.toFixed(0) +
        " points across the cohort.",
    });

    // --- Decision tendencies ---
    if (decisions.available) {
      analysis.observations.push({
        category: "Decision Tendencies",
        headline:
          decisions.aggressiveDecisionRate.toFixed(0) +
          "% of decisions used directive styles",
        detail:
          decisions.collaborativeDecisionRate.toFixed(0) +
          "% used collaborative styles. Leaders requested an average of " +
          decisions.infoSeekingBehavior.avgRequestsPerPlayer.toFixed(1) +
          " additional information sources each.",
      });
    }

    // --- Personality colour mix ---
    analysis.observations.push({
      category: "Personality Mix",
      headline:
        "Most common profile: " +
        this.capitalize(colors.dominant.toLowerCase()) +
        " (" +
        colors.percentages[colors.dominant].toFixed(0) +
        "%)",
      detail:
        "Across " +
        analysis.playerCount +
        " leaders, the colour distribution was " +
        Object.entries(colors.percentages)
          .filter(([, pct]) => pct > 0)
          .map(
            ([color, pct]) =>
              this.capitalize(color.toLowerCase()) + " " + pct.toFixed(0) + "%",
          )
          .join(", ") +
        ".",
    });

    // --- Segmentation insight (function) ---
    const funcSegments = segments.byFunction.filter((s) => s.sufficient);
    if (funcSegments.length >= 2) {
      const top = funcSegments[0];
      analysis.observations.push({
        category: "Functional Differences",
        headline:
          top.name + " is the largest group (" + top.count + " leaders)",
        detail:
          "Their most used style was " +
          this.capitalize(top.dominantStyle || "n/a") +
          ", averaging " +
          top.avgGrowth.toFixed(1) +
          "% growth and " +
          top.avgMorale.toFixed(0) +
          "% morale.",
      });
    }

    // --- Segmentation insight (seniority) ---
    const senSegments = segments.bySeniority.filter((s) => s.sufficient);
    if (senSegments.length >= 2) {
      const top = senSegments[0];
      analysis.observations.push({
        category: "Seniority Differences",
        headline:
          top.name + " is the largest group (" + top.count + " leaders)",
        detail:
          "Their most used style was " +
          this.capitalize(top.dominantStyle || "n/a") +
          ", averaging " +
          top.avgGrowth.toFixed(1) +
          "% growth and " +
          top.avgMorale.toFixed(0) +
          "% morale.",
      });
    }
  }

  // ------------------------------------------------------------------
  // Recommendations (derived only from observed data)
  // ------------------------------------------------------------------

  generateRecommendations(analysis) {
    const { metrics, leadership, lead, decisions, segments } = analysis;

    // 1. Style concentration - only if the data shows concentration
    if (leadership.diversity < 0.65) {
      analysis.recommendations.push({
        title: "Broaden Leadership Style Repertoire",
        rationale:
          "Style usage is concentrated (diversity index " +
          (leadership.diversity * 100).toFixed(0) +
          "%), with " +
          this.capitalize(leadership.mostUsed[0]) +
          " used most (" +
          leadership.mostUsed[1].toFixed(0) +
          "%).",
        actions: [
          "Run a facilitated session on Goleman's six leadership styles",
          "Pair leaders with colleagues who use different dominant styles",
          'Build a "when to use which style" playbook for the leadership team',
        ],
      });
    }

    // 2. Coaching usage - only if the data shows it is low
    if (leadership.aggregate.coaching < 15) {
      analysis.recommendations.push({
        title: "Increase Coaching and Development Focus",
        rationale:
          "Coaching accounted for only " +
          leadership.aggregate.coaching.toFixed(0) +
          "% of style usage across the cohort.",
        actions: [
          "Introduce structured coaching conversations for all people managers",
          "Recognise leaders who develop others as a measured outcome",
          "Review succession plans for each function",
        ],
      });
    }

    // 3. Morale spread - only if morale varies widely
    if (metrics.moraleSpread > 12) {
      analysis.recommendations.push({
        title: "Share Team-Health Practices Across the Cohort",
        rationale:
          "Morale outcomes varied widely (range " +
          metrics.minMorale.toFixed(0) +
          "% to " +
          metrics.maxMorale.toFixed(0) +
          "%), suggesting inconsistent team-health practices.",
        actions: [
          "Capture what the highest-morale leaders did differently",
          "Create peer-learning sessions between functions",
          "Include team health in leadership performance reviews",
        ],
      });
    }

    // 4. Information seeking - only if the data shows it is low
    if (
      decisions.available &&
      decisions.infoSeekingBehavior.avgRequestsPerPlayer < 2
    ) {
      analysis.recommendations.push({
        title: "Strengthen Evidence-Based Decision Making",
        rationale:
          "Leaders requested an average of only " +
          decisions.infoSeekingBehavior.avgRequestsPerPlayer.toFixed(1) +
          " additional information sources per simulation.",
        actions: [
          "Encourage structured information gathering before major decisions",
          "Share examples where additional data changed the outcome",
          "Review decision-making processes for missing inputs",
        ],
      });
    }

    // 5. Agility - only if the data shows it is the weakest dimension
    const leadDims = [
      ["Leadership", lead.leadership.avg],
      ["Excellence", lead.excellence.avg],
      ["Agility", lead.agility.avg],
      ["Determination", lead.determination.avg],
    ];
    const weakest = [...leadDims].sort((a, b) => a[1] - b[1])[0];
    if (weakest[0] === "Agility") {
      analysis.recommendations.push({
        title: "Build Adaptability and Agility",
        rationale:
          "Agility was the lowest-scoring LEAD dimension across the cohort (average " +
          lead.agility.avg.toFixed(0) +
          " points).",
        actions: [
          "Create rapid-response teams for market changes",
          "Reduce approval layers for tactical decisions",
          "Run scenario-planning exercises for the leadership team",
        ],
      });
    }

    // 6. Functional differences - only if segments differ meaningfully
    const funcSegments = segments.byFunction.filter((s) => s.sufficient);
    if (funcSegments.length >= 2) {
      const growthValues = funcSegments.map((s) => s.avgGrowth);
      const spread = this.max(growthValues) - this.min(growthValues);
      if (spread > 5) {
        analysis.recommendations.push({
          title: "Share Best Practice Between Functions",
          rationale:
            "Average growth differed by " +
            spread.toFixed(1) +
            " percentage points between functions, from " +
            this.min(growthValues).toFixed(1) +
            "% to " +
            this.max(growthValues).toFixed(1) +
            "%.",
          actions: [
            "Identify what the highest-performing function did differently",
            "Run cross-functional knowledge-sharing sessions",
            "Set shared objectives that encourage collaboration",
          ],
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Make available to game engine
if (typeof window !== "undefined") {
  window.CultureAnalysis = CultureAnalysis;
}
