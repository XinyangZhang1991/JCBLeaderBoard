// Executive Summary PDF Generator
// Generates printable 1-page executive summary + detailed appendix for each player

class ExecutiveSummaryGenerator {
  constructor() {
    this.playerData = null;
    this.gameState = null;
    this.results = null;
    // Round-awareness. Defaults to 1 so legacy callers that never pass a
    // round keep the original Round 1 behaviour.
    this.round = 1;
    // The same player's most recent Round 1 record, when available. Used to
    // build the Round 1 vs Round 2 awareness-change section. Null for Round 1
    // runs and for Round 2 runs with no prior record.
    this.priorRound1Record = null;
    // Optional cohort lookup function (e.g. GameEngine.getCultureData bound
    // to the engine). When absent, the generator falls back to reading
    // localStorage directly in a browser, or to illustrative figures.
    this.cultureDataProvider = null;
  }

  /**
   * Format a number as a percentage string with a finite guard.
   *
   * PERCENTAGE ACCURACY FIX: the raw `.toFixed()` calls used throughout this
   * generator would happily print `NaN`/`Infinity` when a metric was missing
   * or non-numeric. This helper guarantees a finite, consistently formatted
   * string. It does NOT clamp - use `clampPercent` for conceptually bounded
   * percentages.
   *
   * @param {*} value   Raw numeric value (already in percentage units, e.g. 87.4).
   * @param {number} [digits=0] Decimal places.
   * @returns {string}  Finite formatted number, or "0" for non-finite input.
   */
  formatPercent(value, digits) {
    const d = typeof digits === "number" ? digits : 0;
    return typeof value === "number" && isFinite(value)
      ? value.toFixed(d)
      : "0";
  }

  /**
   * Clamp a conceptually bounded percentage to the 0-100 range.
   *
   * PERCENTAGE ACCURACY FIX: LEAD ratios, style shares, retention and the
   * diversity index cannot logically exceed 100%. Values above 100 are capped
   * at 100 (the achievement is still visible via the underlying ratio used for
   * colour/verdict logic); negative values are floored at 0. Non-finite input
   * returns 0 so no `NaN`/`undefined%` can ever be rendered.
   *
   * NOTE: deliberately NOT applied to raw game metrics such as growth, morale,
   * profitMargin or attrition, which are meaningful above 100 / below 0.
   *
   * @param {*} value  Raw numeric value in percentage units.
   * @returns {number} Finite value clamped to [0, 100].
   */
  clampPercent(value) {
    if (typeof value !== "number" || !isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
  }

  /**
   * Generate the executive summary + detailed appendix.
   *
   * @param {Object} playerData  Player identity/segmentation (name, jobFunction, ...).
   * @param {Object} gameState   Final game state (LEAD scores, round, styles, ...).
   * @param {Object} results     Scoring results from calculateFinalScore().
   * @param {Object} [options]   Optional overrides:
   *   - round: explicit round number (defaults to gameState.round || 1)
   *   - priorRound1Record: explicit prior Round 1 record (else auto-looked-up)
   *   - cultureDataProvider: function returning the full cohort array
   * @returns {{summary:string, detailed:string, combined:string, filename:string,
   *            round:number, roundLabel:string, awarenessChange:?string}}
   */
  generateSummary(playerData, gameState, results, options) {
    this.playerData = playerData || {};
    this.gameState = gameState || {};
    this.results = results || {};

    const opts = options || {};

    // Resolve the round: explicit option > gameState.round > 1.
    const explicitRound = opts.round;
    const stateRound = this.gameState.round;
    this.round = explicitRound === 2 || stateRound === 2 ? 2 : 1;

    // Resolve the cohort provider (used for the prior-Round-1 lookup and the
    // benchmark comparison). Never throw if it is missing.
    this.cultureDataProvider =
      typeof opts.cultureDataProvider === "function"
        ? opts.cultureDataProvider
        : null;

    // Resolve the prior Round 1 record for Round 2 runs.
    this.priorRound1Record = null;
    if (this.round === 2) {
      if (opts.priorRound1Record) {
        this.priorRound1Record = opts.priorRound1Record;
      } else {
        this.priorRound1Record = this.findPriorRound1Record();
      }
    }

    // Generate both summary and detailed report
    const summary = this.generateExecutiveSummary();
    const detailed = this.generateDetailedAppendix();

    // The awareness-change section is generated once and embedded in the
    // detailed appendix (and surfaced as its own field for callers/tests).
    const awarenessChange = this.generateAwarenessChangeSection();

    return {
      summary: summary,
      detailed: detailed,
      combined:
        summary + '<div style="page-break-before: always;"></div>' + detailed,
      filename: this.generateFilename(),
      // Additive fields (do not remove the four original keys).
      round: this.round,
      roundLabel: this.getRoundLabel(),
      awarenessChange: awarenessChange,
    };
  }

  /**
   * Human-readable round label used throughout the report.
   * @returns {string}
   */
  getRoundLabel() {
    return this.round === 2 ? "Round 2 — Advanced" : "Round 1 — Foundation";
  }

  /**
   * Number of scenarios in the current round. Round 1 has 9, Round 2 has 6.
   * Mirrors the round-aware divisor in scoring.js calculateFinalScore().
   * @returns {number}
   */
  getScenarioCount() {
    return this.round === 2 ? 6 : 9;
  }

  /**
   * Cumulative LEAD target for the current round (scenarioCount x 19).
   * Round 1 = 171, Round 2 = 114.
   * @returns {number}
   */
  getCumulativeTarget() {
    return this.getScenarioCount() * 19;
  }

  /**
   * Return the full cohort array, or [] when unavailable. Prefers an injected
   * provider (GameEngine.getCultureData) and falls back to localStorage in a
   * browser. Never throws.
   * @returns {Array<Object>}
   */
  getCohort() {
    try {
      if (this.cultureDataProvider) {
        const data = this.cultureDataProvider();
        return Array.isArray(data) ? data : [];
      }
      if (typeof localStorage !== "undefined" && localStorage) {
        const raw = localStorage.getItem("jcb_culture_data");
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      // Swallow: a missing cohort must never break report generation.
    }
    return [];
  }

  /**
   * Look up the same player's most recent Round 1 record from the cohort.
   * Mirrors GameEngine.findReturningPlayer()'s name-match + most-recent logic
   * but is restricted to Round 1 records (Round 2 builds on Round 1 feedback).
   * @returns {?Object}
   */
  findPriorRound1Record() {
    const name = this.playerData && this.playerData.name;
    if (!name || typeof name !== "string" || !name.trim()) return null;

    const target = name.trim().toLowerCase();
    const cohort = this.getCohort();
    const matches = cohort.filter(
      (p) =>
        p &&
        typeof p.name === "string" &&
        p.name.trim().toLowerCase() === target &&
        (p.round || 1) === 1,
    );
    if (matches.length === 0) return null;

    return matches.reduce((latest, current) => {
      const latestTs = latest.timestamp || 0;
      const currentTs = current.timestamp || 0;
      return currentTs > latestTs ? current : latest;
    });
  }

  generateFilename() {
    const timestamp = new Date().toISOString().split("T")[0];
    const cleanName = (this.playerData.name || "Player").replace(
      /[^a-zA-Z0-9]/g,
      "_",
    );
    // Include the round so Round 1 and Round 2 reports are distinguishable.
    return `JCB_Leadership_Assessment_${cleanName}_round${this.round}_${timestamp}.pdf`;
  }

  /**
   * Shared branded header block for the executive summary and its appendix.
   *
   * Uses only semantic tags the PDF writer understands (h1/h2/p/strong/hr) and
   * inline styles, because the writer strips CSS classes. The wordmark line
   * renders "JCB" bold followed by "LEADERSHIP IN ACTION" in a lighter weight.
   *
   * @param {string} title     Report title (rendered as <h1>).
   * @param {string} subtitle  Subtitle line.
   * @param {string[]} metaLines Additional meta lines (date, identifiers).
   * @returns {string} HTML fragment.
   */
  buildBrandedHeader(title, subtitle, metaLines) {
    const lines = Array.isArray(metaLines) ? metaLines : [];
    const metaHtml = lines
      .filter((l) => l)
      .map((l) => `<p style="margin: 2px 0;">${l}</p>`)
      .join("");
    return `
    <div>
        <p style="margin: 0 0 4px 0;"><strong>JCB</strong> LEADERSHIP IN ACTION</p>
        <h1 style="margin: 0 0 4px 0;">${title}</h1>
        <p style="margin: 0 0 4px 0; color: #333;">${subtitle}</p>
        ${metaHtml}
        <hr/>
    </div>
        `;
  }

  generateExecutiveSummary() {
    const assessment = this.calculateOverallAssessment();
    const keyStrengths = this.identifyKeyStrengths();
    const developmentAreas = this.identifyDevelopmentAreas();
    const businessImpact = this.calculateBusinessImpact();
    const promotionReadiness = this.assessPromotionReadiness();
    const careerRisks = this.identifyCareerRisks();

    const generated = new Date().toLocaleDateString("en-GB");
    const header = this.buildBrandedHeader(
      "Executive Summary",
      `${this.getRoundLabel()} — ${this.getScenarioCount()} scenarios, cumulative LEAD target ${this.getCumulativeTarget()} (19 points/dimension/scenario)`,
      [
        `<strong>Player:</strong> ${this.playerData.name} &nbsp; <strong>Date:</strong> ${generated} &nbsp; <strong>Personality:</strong> ${this.results.personalityColor}`,
      ],
    );

    // Plain-language opening summary (2-3 sentences) before the detailed tables.
    const openingSummary =
      `<p>This report summarises ${this.playerData.name}'s performance across the ` +
      `${this.getRoundLabel()} leadership simulation. It highlights overall ` +
      `assessment, key strengths, development areas, business impact and ` +
      `promotion readiness, with a full appendix of supporting analysis.</p>`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Executive Summary - ${this.playerData.name}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
        .header { border-bottom: 4px solid #FFCB00; padding-bottom: 10px; margin-bottom: 15px; }
        .jcb-logo { font-size: 24pt; font-weight: bold; color: #000; margin-bottom: 5px; }
        .title { font-size: 18pt; font-weight: bold; color: #000; margin: 5px 0; }
        .subtitle { font-size: 10pt; color: #666; }
        .assessment-box { background: ${assessment.color}; padding: 15px; border-left: 5px solid #FFCB00; margin: 15px 0; border-radius: 3px; }
        .assessment-title { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
        .section { margin: 15px 0; }
        .section-title { font-size: 12pt; font-weight: bold; color: #000; border-bottom: 2px solid #FFCB00; padding-bottom: 3px; margin-bottom: 8px; }
        .bullet-list { margin: 5px 0; padding-left: 20px; }
        .bullet-list li { margin: 3px 0; }
        .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
        .metric { padding: 8px; background: #f5f5f5; border-left: 3px solid #FFCB00; }
        .metric-label { font-size: 9pt; color: #666; }
        .metric-value { font-size: 14pt; font-weight: bold; color: #000; }
        .risk-flag { background: #fff3cd; border-left: 4px solid #ff9800; padding: 10px; margin: 10px 0; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; }
        .confidential { font-size: 9pt; color: #d32f2f; font-weight: bold; margin-bottom: 10px; }
        @media print { .assessment-box { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
</head>
<body>
    ${header}

    <div class="confidential">CONFIDENTIAL - For Development Purposes Only</div>

    ${openingSummary}

    <div class="assessment-box">
        <div class="assessment-title">OVERALL ASSESSMENT: ${assessment.level}</div>
        <p style="margin: 5px 0 0 0;">${assessment.summary}</p>
    </div>

    ${careerRisks.length > 0 ? this.renderCareerRisks(careerRisks) : ""}

    ${
      keyStrengths.length > 0
        ? `<div class="section">
        <h2>Key Strengths</h2>
        <ul class="bullet-list">
            ${keyStrengths.map((s) => `<li><strong>${s.title}:</strong> ${s.detail}</li>`).join("")}
        </ul>
    </div>`
        : ""
    }

    ${
      developmentAreas.length > 0
        ? `<div class="section">
        <h2>Critical Development Areas</h2>
        <ul class="bullet-list">
            ${developmentAreas.map((d) => `<li><strong>${d.title}:</strong> ${d.detail}</li>`).join("")}
        </ul>
    </div>`
        : ""
    }

    <div class="section">
        <h2>Business Impact (Simulation)</h2>
        <table>
            <tr><th>Metric</th><th>Value</th><th>Assessment</th></tr>
            <tr><td>Revenue Growth</td><td>${businessImpact.growth.value}</td><td>${businessImpact.growth.label}</td></tr>
            <tr><td>Team Morale</td><td>${businessImpact.morale.value}</td><td>${businessImpact.morale.label}</td></tr>
            <tr><td>Staff Retention</td><td>${businessImpact.retention.value}</td><td>${businessImpact.retention.label}</td></tr>
            <tr><td>LEAD Quality</td><td>${businessImpact.lead.value}</td><td>${businessImpact.lead.label}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Recommended Actions (Next 90 Days)</h2>
        <ol class="bullet-list">
            ${this.generateActionPlan()
              .map(
                (action) =>
                  `<li><strong>${action.action}:</strong> ${action.detail}</li>`,
              )
              .join("")}
        </ol>
    </div>

    <div class="section">
        <h2>Promotion Readiness</h2>
        <p><strong>${promotionReadiness.status}</strong></p>
        <p style="margin-top: 5px;">${promotionReadiness.rationale}</p>
        ${promotionReadiness.conditions ? `<p style="margin-top: 5px;"><em>Conditions: ${promotionReadiness.conditions}</em></p>` : ""}
    </div>

    <div class="footer">
        <p><strong>JCB Leadership Development Programme</strong> | Assessment Version 2.0</p>
        <p>This assessment is based on simulation performance and should be considered alongside 360 degree feedback, business results, and manager assessment.</p>
        <p><em>See detailed appendix for full analysis, decision history, and psychometric validation.</em></p>
    </div>
</body>
</html>
        `;
  }

  renderCareerRisks(careerRisks) {
    return `
    <div class="section">
        <h2>Career Risks Identified</h2>
        ${careerRisks
          .map(
            (risk) => `
        <div class="risk-flag">
            <strong>${risk.title}</strong>
            <p style="margin: 5px 0 0 0;">${risk.detail}</p>
        </div>
        `,
          )
          .join("")}
    </div>
        `;
  }

  calculateOverallAssessment() {
    const leadRatio = this.calculateAverageLEADRatio();
    const escaped = this.results.escaped;
    const growth = this.gameState.growth;
    const morale = this.gameState.morale;
    const attrition = this.gameState.attrition;

    // High Potential: Escaped + High LEAD + Balanced
    if (escaped && leadRatio >= 0.85 && this.results.optimal) {
      return {
        level: "HIGH POTENTIAL",
        color: "#d4edda",
        summary: `Demonstrates exceptional leadership capability across all LEAD dimensions (${(leadRatio * 100).toFixed(0)}% of benchmark). Achieved strong business results (${growth.toFixed(1)}% growth) while maintaining team health (${morale.toFixed(0)}% morale). Shows balanced, adaptive leadership with strategic thinking. Ready for increased responsibility.`,
      };
    }

    // Solid Performer: Escaped + Good LEAD
    if (escaped && leadRatio >= 0.65) {
      return {
        level: "SOLID PERFORMER",
        color: "#d1ecf1",
        summary: `Demonstrates strong leadership competencies (${(leadRatio * 100).toFixed(0)}% of benchmark) and achieved business objectives (${growth.toFixed(1)}% growth, ${morale.toFixed(0)}% morale). Shows clear strengths but has identifiable development areas. Performing well in current role with potential for growth.`,
      };
    }

    // Developing: Escaped but Lower LEAD OR Failed narrowly
    if (escaped || (leadRatio >= 0.5 && growth >= 15)) {
      return {
        level: "DEVELOPING",
        color: "#fff3cd",
        summary: `Shows leadership potential but needs development in key areas. ${escaped ? `Met objectives but` : `Narrowly missed objectives -`} LEAD competencies at ${(leadRatio * 100).toFixed(0)}% of benchmark suggest gaps in leadership effectiveness. Requires targeted development and coaching to reach full potential.`,
      };
    }

    // Needs Development: Failed with moderate issues
    if (leadRatio >= 0.35 || growth >= 12) {
      return {
        level: "NEEDS DEVELOPMENT",
        color: "#f8d7da",
        summary: `Significant gaps in leadership competencies identified (${(leadRatio * 100).toFixed(0)}% of benchmark). ${growth < 15 ? "Failed to achieve viable growth targets." : "Growth achieved but at cost to team health or quality."} Requires immediate development intervention and close coaching. Not ready for increased responsibility without support.`,
      };
    }

    // At Risk: Critical failures
    return {
      level: "AT RISK",
      color: "#f5c6cb",
      summary: `Critical leadership deficiencies identified (${(leadRatio * 100).toFixed(0)}% of benchmark). Failed to meet basic objectives (${growth.toFixed(1)}% growth, ${morale.toFixed(0)}% morale, ${attrition.toFixed(1)}% attrition). Approach is unsustainable and poses risk to team and business. Urgent intervention required - consider role fit assessment.`,
    };
  }

  identifyKeyStrengths() {
    const strengths = [];
    const leadRatios = this.calculateLEADRatios();
    const styles = this.results.leadershipProfile;
    const infoRequests = this.gameState.infoRequests?.length || 0;

    // Check each LEAD dimension
    if (leadRatios.leadership >= 0.8) {
      const balancedStyles = Object.values(styles).filter(
        (v) => v >= 20 && v <= 40,
      ).length;
      strengths.push({
        title: "Exceptional Leadership Style Variety",
        detail: `${(leadRatios.leadership * 100).toFixed(0)}% of benchmark - Uses ${balancedStyles} different leadership styles effectively, demonstrating high adaptability and contextual awareness.`,
      });
    }

    if (leadRatios.excellence >= 0.8) {
      strengths.push({
        title: "Evidence-Based Decision Making",
        detail: `${(leadRatios.excellence * 100).toFixed(0)}% of benchmark - Sought additional information ${infoRequests} times, showing strong commitment to data-driven leadership and intellectual rigor.`,
      });
    }

    if (leadRatios.agility >= 0.8) {
      strengths.push({
        title: "Strategic Agility in Ambiguity",
        detail: `${(leadRatios.agility * 100).toFixed(0)}% of benchmark - Navigates uncertain situations effectively, adapts approach based on context, and synthesizes conflicting information well.`,
      });
    }

    if (leadRatios.determination >= 0.8) {
      strengths.push({
        title: "Strong Growth Orientation",
        detail: `${(leadRatios.determination * 100).toFixed(0)}% of benchmark - Demonstrates persistence, growth mindset, and willingness to tackle challenging objectives. Drives for results consistently.`,
      });
    }

    // Organizational capability strength
    if (this.gameState.organizationalCapability >= 150) {
      strengths.push({
        title: "Team Development Focus",
        detail: `Built ${this.gameState.organizationalCapability.toFixed(0)} organizational capability points through coaching and democratic leadership. Invests in long-term team strength.`,
      });
    }

    // High morale achievement
    if (this.gameState.morale >= 80) {
      strengths.push({
        title: "Team Engagement & Morale",
        detail: `Achieved ${this.gameState.morale.toFixed(0)}% team morale - demonstrates ability to maintain high engagement and psychological safety while driving results.`,
      });
    }

    // If no clear strengths above 80%, find relative strengths
    if (strengths.length === 0) {
      const maxRatio = Math.max(
        leadRatios.leadership,
        leadRatios.excellence,
        leadRatios.agility,
        leadRatios.determination,
      );
      if (maxRatio >= 0.6) {
        const dimension = Object.entries(leadRatios).find(
          ([_, v]) => v === maxRatio,
        )[0];
        const dimensionName =
          dimension.charAt(0).toUpperCase() + dimension.slice(1);
        strengths.push({
          title: `Relative Strength in ${dimensionName}`,
          detail: `${(maxRatio * 100).toFixed(0)}% of benchmark - strongest of your LEAD dimensions, though still has room for development.`,
        });
      }
    }

    return strengths.slice(0, 3); // Top 3 strengths only
  }

  identifyDevelopmentAreas() {
    const areas = [];
    const leadRatios = this.calculateLEADRatios();
    const styles = this.results.leadershipProfile;
    const infoRequests = this.gameState.infoRequests?.length || 0;
    const maxStyle = Math.max(...Object.values(styles));
    const dominantStyleName = Object.keys(styles).find(
      (k) => styles[k] === maxStyle,
    );

    // Check for critical LEAD gaps (below 30%)
    if (leadRatios.excellence < 0.3) {
      areas.push({
        title: "CRITICAL: Insufficient Decision Rigor",
        detail: `Excellence at ${(leadRatios.excellence * 100).toFixed(0)}% (need 30%+) - Only ${infoRequests} information requests suggests decisions made on gut instinct. This is a career-limiting pattern for senior leaders making high-stakes decisions.`,
      });
    } else if (leadRatios.excellence < 0.6) {
      areas.push({
        title: "Decision-Making Rigor",
        detail: `Excellence at ${(leadRatios.excellence * 100).toFixed(0)}% - Insufficient information-seeking (${infoRequests} requests). Need to develop habit of asking "What data would make me 90% confident?"  before major decisions.`,
      });
    }

    if (leadRatios.leadership < 0.3) {
      areas.push({
        title: "CRITICAL: Leadership Style Rigidity",
        detail: `Leadership at ${(leadRatios.leadership * 100).toFixed(0)}% (need 30%+) - Overreliance on ${dominantStyleName} (${maxStyle}%) shows inability to adapt approach to context. Leaders must have multiple tools in their toolkit.`,
      });
    } else if (maxStyle >= 70) {
      areas.push({
        title: "Leadership Style Overuse",
        detail: `${dominantStyleName.charAt(0).toUpperCase() + dominantStyleName.slice(1)} used ${maxStyle}% of time (max 70%) - Even strengths become weaknesses when overplayed. Need to develop complementary styles.`,
      });
    }

    if (leadRatios.agility < 0.3) {
      areas.push({
        title: "CRITICAL: Struggles with Ambiguity",
        detail: `Agility at ${(leadRatios.agility * 100).toFixed(0)}% (need 30%+) - Difficulty navigating uncertain situations or conflicting data. Senior roles require comfort with ambiguity and ability to make decisions with incomplete information.`,
      });
    } else if (leadRatios.agility < 0.6) {
      areas.push({
        title: "Adaptability in Uncertainty",
        detail: `Agility at ${(leadRatios.agility * 100).toFixed(0)}% - Room to improve how you handle ambiguous situations and changing priorities. Need to become more comfortable with "gray areas."`,
      });
    }

    if (leadRatios.determination < 0.3) {
      areas.push({
        title: "CRITICAL: Insufficient Drive for Results",
        detail: `Determination at ${(leadRatios.determination * 100).toFixed(0)}% (need 30%+) - Avoids challenging targets or difficult decisions. Leadership requires willingness to tackle hard problems and persist through obstacles.`,
      });
    } else if (leadRatios.determination < 0.6) {
      areas.push({
        title: "Growth Orientation",
        detail: `Determination at ${(leadRatios.determination * 100).toFixed(0)}% - Could be more ambitious in setting targets and more persistent when facing challenges. Need stronger growth mindset.`,
      });
    }

    // Business outcome issues
    if (this.gameState.attrition >= 15) {
      areas.push({
        title: "Team Retention Risk",
        detail: `${this.gameState.attrition.toFixed(1)}% attrition (threshold 15%) - Approach is driving talent away. Likely over-indexed on pressure/results vs people development. This is unsustainable.`,
      });
    }

    if (this.gameState.morale < 65) {
      areas.push({
        title: "Team Engagement",
        detail: `${this.gameState.morale.toFixed(0)}% morale (need 65%+) - Team is not fully engaged or motivated. Need to balance results-focus with people-centered leadership.`,
      });
    }

    return areas.slice(0, 4); // Top 4 development areas
  }

  identifyCareerRisks() {
    const risks = [];
    const leadRatios = this.calculateLEADRatios();
    const infoRequests = this.gameState.infoRequests?.length || 0;
    const styles = this.results.leadershipProfile;
    const maxStyle = Math.max(...Object.values(styles));
    const dominantStyleName = Object.keys(styles).find(
      (k) => styles[k] === maxStyle,
    );

    // Zero information requests = career risk
    if (infoRequests === 0) {
      risks.push({
        icon: "",
        title: "CAREER RISK: Gut-Feel Decision Making",
        detail: `Zero information requests across all scenarios. Making £500k+ decisions on instinct rather than evidence is career-limiting at senior levels. This pattern will eventually lead to a major error.`,
      });
    }

    // Extreme style overuse = career risk
    if (
      maxStyle >= 75 &&
      (dominantStyleName === "coercive" || dominantStyleName === "pacesetting")
    ) {
      risks.push({
        icon: "",
        title: "RETENTION RISK: Command-and-Control Leadership",
        detail: `${maxStyle}% ${dominantStyleName} leadership - Your team is likely updating their CVs. High-pressure, low-support environments drive top talent away. Expect attrition spike within 6 months.`,
      });
    }

    // Very low determination = succession risk
    if (leadRatios.determination < 0.25) {
      risks.push({
        icon: "",
        title: "SUCCESSION RISK: Avoids Tough Decisions",
        detail: `Determination ${(leadRatios.determination * 100).toFixed(0)}% suggests pattern of avoiding difficult choices. Senior leadership requires willingness to make unpopular decisions. This limits advancement potential.`,
      });
    }

    // Low LEAD quality overall = performance risk
    const avgLEAD = this.calculateAverageLEADRatio();
    if (avgLEAD < 0.35) {
      risks.push({
        icon: "",
        title: "PERFORMANCE RISK: Unsustainable Approach",
        detail: `Overall LEAD quality ${(avgLEAD * 100).toFixed(0)}% indicates fundamentally unsustainable leadership approach. Even if results appear acceptable now, this pattern will lead to team breakdown, quality failures, or strategic errors.`,
      });
    }

    // High attrition = immediate risk
    if (this.gameState.attrition >= 20) {
      risks.push({
        icon: "",
        title: "IMMEDIATE RISK: Team Exodus",
        detail: `${this.gameState.attrition.toFixed(1)}% attrition is critically high. At this rate, you're losing institutional knowledge, damaging team capability, and creating reputation risk. Requires urgent intervention.`,
      });
    }

    return risks;
  }

  calculateBusinessImpact() {
    // PERCENTAGE ACCURACY FIX: guard every raw metric against non-finite input
    // so `.toFixed()` can never emit `NaN`. Raw growth/morale/attrition are the
    // game's own metrics and are meaningful above 100 / below 0, so they are
    // left unclamped - only their finiteness is enforced.
    const growth =
      typeof this.gameState.growth === "number" &&
      isFinite(this.gameState.growth)
        ? this.gameState.growth
        : 0;
    const morale =
      typeof this.gameState.morale === "number" &&
      isFinite(this.gameState.morale)
        ? this.gameState.morale
        : 0;
    const attrition =
      typeof this.gameState.attrition === "number" &&
      isFinite(this.gameState.attrition)
        ? this.gameState.attrition
        : 0;
    const avgLEAD = this.calculateAverageLEADRatio();

    return {
      growth: {
        value: `${growth.toFixed(1)}%`,
        label:
          growth >= 28
            ? "Exceptional (>28%)"
            : growth >= 15
              ? "Target Met (15%+)"
              : growth >= 8
                ? "Viable (8%+)"
                : "Below Threshold",
        color:
          growth >= 28
            ? "#2e7d32"
            : growth >= 15
              ? "#388e3c"
              : growth >= 8
                ? "#f57c00"
                : "#d32f2f",
      },
      morale: {
        value: `${morale.toFixed(0)}%`,
        label:
          morale >= 80
            ? "Excellent (>80%)"
            : morale >= 75
              ? "Strong (75%+)"
              : morale >= 65
                ? "Healthy (65%+)"
                : "At Risk",
        color:
          morale >= 80
            ? "#2e7d32"
            : morale >= 75
              ? "#388e3c"
              : morale >= 65
                ? "#f57c00"
                : "#d32f2f",
      },
      retention: {
        // Retention is conceptually bounded 0-100: a negative attrition would
        // otherwise push it above 100. Clamp the displayed value.
        value: `${this.clampPercent(100 - attrition).toFixed(1)}%`,
        label:
          attrition < 8
            ? "Excellent (<8%)"
            : attrition < 12
              ? "Good (<12%)"
              : attrition < 15
                ? "Acceptable (<15%)"
                : "High Turnover",
        color:
          attrition < 8
            ? "#2e7d32"
            : attrition < 12
              ? "#388e3c"
              : attrition < 15
                ? "#f57c00"
                : "#d32f2f",
      },
      lead: {
        // LEAD quality is a ratio of benchmark; cap the displayed percentage
        // at 100 while the raw avgLEAD still drives the label/colour below.
        value: `${this.formatPercent(this.clampPercent(avgLEAD * 100), 0)}%`,
        label:
          avgLEAD >= 0.85
            ? "Exceptional (>85%)"
            : avgLEAD >= 0.7
              ? "Strong (70%+)"
              : avgLEAD >= 0.5
                ? "Adequate (50%+)"
                : avgLEAD >= 0.4
                  ? "Minimum (40%+)"
                  : "Below Standard",
        color:
          avgLEAD >= 0.85
            ? "#2e7d32"
            : avgLEAD >= 0.7
              ? "#388e3c"
              : avgLEAD >= 0.5
                ? "#f57c00"
                : avgLEAD >= 0.4
                  ? "#ff9800"
                  : "#d32f2f",
      },
    };
  }

  assessPromotionReadiness() {
    const escaped = this.results.escaped;
    const optimal = this.results.optimal;
    const avgLEAD = this.calculateAverageLEADRatio();
    const leadRatios = this.calculateLEADRatios();
    const careerRisks = this.identifyCareerRisks();

    // High potential - ready now
    if (optimal && avgLEAD >= 0.85 && careerRisks.length === 0) {
      return {
        status: "READY NOW",
        rationale:
          "Demonstrates all competencies required for next level. Strong business results, balanced leadership, high LEAD quality, and no career-limiting patterns identified. Recommend promotion consideration within next 6 months.",
        conditions: null,
      };
    }

    // Solid performer - ready with conditions
    if (escaped && avgLEAD >= 0.65 && careerRisks.length === 0) {
      const gaps = [];
      if (leadRatios.excellence < 0.7) gaps.push("decision rigor");
      if (leadRatios.leadership < 0.7) gaps.push("style variety");
      if (leadRatios.agility < 0.7) gaps.push("adaptability");

      return {
        status: "READY WITH DEVELOPMENT",
        rationale:
          "Performing well in current role with clear potential for advancement. Has identifiable development areas but no career-limiting patterns. With focused development, ready for promotion within 12-18 months.",
        conditions:
          gaps.length > 0
            ? `Address: ${gaps.join(", ")}`
            : "Continue current development trajectory",
      };
    }

    // Developing - not ready yet
    if (escaped || avgLEAD >= 0.5) {
      return {
        status: "NOT READY - DEVELOPMENT REQUIRED",
        // BUGFIX #7: Was a single-quoted string, so the ${...} placeholder was
        // rendered literally. Converted to a template literal so it interpolates.
        rationale: `Needs significant development before promotion consideration. ${careerRisks.length > 0 ? "Has identified career risks that must be addressed." : "Gap between current capability and next-level requirements is substantial."} Focus on current role excellence and targeted development for 18-24 months before reassessment.`,
        conditions:
          "Complete development plan, demonstrate sustained improvement, retake assessment",
      };
    }

    // At risk - not ready, possible role fit issue
    return {
      status: "NOT READY - ROLE FIT ASSESSMENT RECOMMENDED",
      rationale:
        "Significant gaps in leadership competencies suggest possible role fit issues. Before considering promotion, assess: 1) Is current role appropriate for strengths? 2) Are expectations clear? 3) Is adequate support provided? May need role adjustment before advancement is viable.",
      conditions:
        "Complete development plan, possible role reassignment, manager coaching intervention",
    };
  }

  generateActionPlan() {
    const actions = [];
    const leadRatios = this.calculateLEADRatios();
    const infoRequests = this.gameState.infoRequests?.length || 0;
    const styles = this.results.leadershipProfile;
    const maxStyle = Math.max(...Object.values(styles));
    const dominantStyleName = Object.keys(styles).find(
      (k) => styles[k] === maxStyle,
    );

    // Priority 1: Address most critical LEAD gap
    const lowestDimension = Object.entries(leadRatios).sort(
      (a, b) => a[1] - b[1],
    )[0];
    const [dimensionName, dimensionRatio] = lowestDimension;

    if (dimensionName === "excellence" && dimensionRatio < 0.6) {
      actions.push({
        action: "PRIORITY 1: Develop Evidence-Based Decision Making",
        detail: `Before your next 3 major decisions, ask: "What data would make me 90% confident in this choice?" Seek 2-3 sources of information before deciding. Track: Did additional data change your decision?`,
      });
    } else if (dimensionName === "leadership" && dimensionRatio < 0.6) {
      actions.push({
        action: "PRIORITY 1: Expand Leadership Style Repertoire",
        detail: `Identify your 2 least-used styles from: Authoritative, Democratic, Coaching, Pacesetting, Affiliative, Coercive. Practice each deliberately in next 4 weeks. Seek feedback: "Did my approach feel different today?"`,
      });
    } else if (dimensionName === "agility" && dimensionRatio < 0.6) {
      actions.push({
        action: "PRIORITY 1: Build Comfort with Ambiguity",
        detail: `When facing uncertainty, resist urge to decide immediately. Spend 24 hours gathering diverse perspectives. Practice: "I don't know yet, but here's how I'll figure it out." Read: "Thinking in Bets" by Annie Duke.`,
      });
    } else if (dimensionName === "determination" && dimensionRatio < 0.6) {
      actions.push({
        action: "PRIORITY 1: Strengthen Growth Orientation",
        detail: `Set one ambitious "stretch goal" for next quarter (20% above comfortable target). When facing obstacles, ask: "What would I do if failure wasn't an option?" Track persistence through setbacks.`,
      });
    }

    // Priority 2: Address style balance if needed
    if (maxStyle >= 70) {
      const underusedStyles = Object.entries(styles)
        .filter(([_, v]) => v < 15)
        .map(([k, _]) => k);
      actions.push({
        action: "Address Leadership Style Overuse",
        detail: `You're overusing ${dominantStyleName} (${maxStyle}%). Deliberately practice ${underusedStyles[0] || "complementary styles"} in low-stakes situations. Ask: "What would [different style] look like here?"`,
      });
    }

    // Priority 3: 360° feedback
    actions.push({
      action: "Request Structured 360° Feedback",
      detail: `Ask 5 direct reports, 3 peers, and your manager: "Rate me 1-10 on: (1) Data-driven decisions, (2) Style adaptability, (3) Comfort with ambiguity, (4) Drive for results." Compare to self-assessment. Identify blind spots.`,
    });

    // Priority 4: Specific behavior change based on gaps
    if (infoRequests === 0) {
      actions.push({
        action: 'Implement "Data Check" Habit',
        detail: `For next 30 days, before ANY decision >£100k or affecting >5 people, pause and gather ONE additional data point you don't currently have. Build the habit of evidence-seeking.`,
      });
    }

    if (this.gameState.morale < 65) {
      actions.push({
        action: "Increase People-Centered Touchpoints",
        detail: `Schedule weekly 1-on-1s with direct reports (30 min each). Use 70/30 rule: 70% listening, 30% directing. Ask: "What's blocking your success?" and "How can I help?" Track morale shifts.`,
      });
    }

    // Priority 5: Retake assessment
    actions.push({
      action: "90-Day Follow-Up: Retake Assessment",
      detail: `After implementing above actions for 90 days, retake this simulation. Compare scores. Target: +15% improvement in your lowest LEAD dimension. Track: Did specific actions translate to behavior change?`,
    });

    return actions.slice(0, 5); // Top 5 actions maximum
  }

  calculateAverageLEADRatio() {
    const ratios = this.calculateLEADRatios();
    return (
      (ratios.leadership +
        ratios.excellence +
        ratios.agility +
        ratios.determination) /
      4
    );
  }

  calculateLEADRatios() {
    // ROUND-AWARE: mirrors scoring.js calculateFinalScore(). The per-dimension
    // benchmark stays at 19 points/scenario (canonical LEAD scale), so the
    // cumulative target is 9 x 19 = 171 for Round 1 and 6 x 19 = 114 for
    // Round 2. Only the divisor (scenarioCount) changes with the round.
    const benchmarks = {
      leadership: 19,
      excellence: 19,
      agility: 19,
      determination: 19,
    };
    const scenarioCount = this.getScenarioCount();

    return {
      leadership:
        (this.gameState.leadership || 0) /
        scenarioCount /
        benchmarks.leadership,
      excellence:
        (this.gameState.excellence || 0) /
        scenarioCount /
        benchmarks.excellence,
      agility:
        (this.gameState.agility || 0) / scenarioCount / benchmarks.agility,
      determination:
        (this.gameState.determination || 0) /
        scenarioCount /
        benchmarks.determination,
    };
  }

  generateDetailedAppendix() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Detailed Analysis Appendix - ${this.playerData.name}</title>
    <style>
        /* Copy styles from summary plus additional for detailed content */
        @page {
            size: A4;
            margin: 15mm;
        }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #000;
        }
        .header {
            border-bottom: 4px solid #FFCB00;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .section {
            margin: 20px 0;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            border-bottom: 2px solid #FFCB00;
            padding-bottom: 3px;
            margin-bottom: 10px;
        }
        .decision-card {
            background: #f9f9f9;
            border-left: 3px solid #FFCB00;
            padding: 10px;
            margin: 10px 0;
        }
        .decision-title {
            font-weight: bold;
            color: #000;
        }
        .lead-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 15px 0;
        }
        .lead-dimension {
            text-align: center;
            padding: 10px;
            background: #f5f5f5;
            border-top: 3px solid #FFCB00;
        }
        .lead-score {
            font-size: 18pt;
            font-weight: bold;
            color: #000;
        }
        .lead-label {
            font-size: 9pt;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background: #FFCB00;
            font-weight: bold;
        }
    </style>
</head>
<body>
    ${this.buildBrandedHeader(
      "Detailed Appendix",
      "Supporting analysis and evidence",
      [
        `Player: ${this.playerData.name}`,
        `Generated: ${new Date().toLocaleDateString("en-GB")}`,
      ],
    )}

    ${this.generateLEADAnalysis()}
    ${this.generateAwarenessChangeSection()}
    ${this.generateDecisionHistory()}
    ${this.generatePsychometricValidation()}
    ${this.generateComparisonToBenchmarks()}
    ${this.generateDetailedActionPlan()}

</body>
</html>
        `;
  }

  generateLEADAnalysis() {
    const leadRatios = this.calculateLEADRatios();
    // ROUND-AWARE: canonical 19-point per-scenario scale (see calculateLEADRatios).
    // Divisor is 9 for Round 1 and 6 for Round 2.
    const benchmarks = {
      leadership: 19,
      excellence: 19,
      agility: 19,
      determination: 19,
    };
    const scenarioCount = this.getScenarioCount();

    return `
    <div class="section">
        <h2>LEAD Competency Breakdown — ${this.getRoundLabel()}</h2>
        <p style="font-size: 9pt; color: #666; margin-top: 0;">${scenarioCount} scenarios played; per-dimension benchmark 19 points/scenario (cumulative target ${this.getCumulativeTarget()}).</p>

        <div class="lead-grid">
            <div class="lead-dimension">
                <div class="lead-score" style="color: ${this.getScoreColor(leadRatios.leadership)}">${this.formatPercent(this.clampPercent(leadRatios.leadership * 100), 0)}%</div>
                <div class="lead-label">LEADERSHIP</div>
                <div style="font-size: 8pt; margin-top: 5px;">${((this.gameState.leadership || 0) / scenarioCount).toFixed(1)} / ${benchmarks.leadership}</div>
            </div>
            <div class="lead-dimension">
                <div class="lead-score" style="color: ${this.getScoreColor(leadRatios.excellence)}">${this.formatPercent(this.clampPercent(leadRatios.excellence * 100), 0)}%</div>
                <div class="lead-label">EXCELLENCE</div>
                <div style="font-size: 8pt; margin-top: 5px;">${((this.gameState.excellence || 0) / scenarioCount).toFixed(1)} / ${benchmarks.excellence}</div>
            </div>
            <div class="lead-dimension">
                <div class="lead-score" style="color: ${this.getScoreColor(leadRatios.agility)}">${this.formatPercent(this.clampPercent(leadRatios.agility * 100), 0)}%</div>
                <div class="lead-label">AGILITY</div>
                <div style="font-size: 8pt; margin-top: 5px;">${((this.gameState.agility || 0) / scenarioCount).toFixed(1)} / ${benchmarks.agility}</div>
            </div>
            <div class="lead-dimension">
                <div class="lead-score" style="color: ${this.getScoreColor(leadRatios.determination)}">${this.formatPercent(this.clampPercent(leadRatios.determination * 100), 0)}%</div>
                <div class="lead-label">DETERMINATION</div>
                <div style="font-size: 8pt; margin-top: 5px;">${((this.gameState.determination || 0) / scenarioCount).toFixed(1)} / ${benchmarks.determination}</div>
            </div>
        </div>

        <p><strong>Overall LEAD Quality:</strong> ${this.formatPercent(this.clampPercent(this.calculateAverageLEADRatio() * 100), 0)}% of benchmark</p>
    </div>
        `;
  }

  getScoreColor(ratio) {
    if (ratio >= 0.85) return "#2e7d32";
    if (ratio >= 0.7) return "#388e3c";
    if (ratio >= 0.5) return "#f57c00";
    if (ratio >= 0.3) return "#ff9800";
    return "#d32f2f";
  }

  generateDecisionHistory() {
    const decisions = this.gameState.decisions || [];

    return `
    <div class="section">
        <h2>Decision History (Scenario-by-Scenario)</h2>

        ${decisions
          .map((decision, idx) => {
            // BUGFIX #8: The decision object stores `scenarioTitle`, `stylesUsed` (array)
            // and `impact` (object), not `scenario`/`style`/`*Impact`. Read the real fields.
            const impact = decision.impact || {};
            const styles =
              decision.stylesUsed && decision.stylesUsed.length > 0
                ? [...new Set(decision.stylesUsed)].join(", ")
                : "Unknown";
            return `
            <div class="decision-card">
                <div class="decision-title">Scenario ${idx + 1}: ${decision.scenarioTitle || "Unknown"}</div>
                <p style="margin: 5px 0;"><strong>Leadership Style Used:</strong> ${styles}</p>
                <p style="margin: 5px 0;"><strong>Information Requested:</strong> ${decision.infoRequested ? "Yes" : "No"}</p>
                <p style="margin: 5px 0; font-size: 9pt; color: #666;"><em>LEAD Impact: L+${impact.leadership || 0}, E+${impact.excellence || 0}, A+${impact.agility || 0}, D+${impact.determination || 0}</em></p>
            </div>
        `;
          })
          .join("")}
    </div>
        `;
  }

  generatePsychometricValidation() {
    const jungColor = this.results.personalityColor;
    const styles = this.results.leadershipProfile;
    const leadRatios = this.calculateLEADRatios();

    // Validate against established models
    const golemanAlignment = this.validateGolemanAlignment(styles);
    const jungAlignment = this.validateJungAlignment(jungColor, leadRatios);
    const selfAwarenessCheck = this.validateSelfAwareness();

    return `
    <div class="section">
        <h2>Psychometric Validation</h2>

        <p><strong>Jung Personality Model Validation:</strong></p>
        <p>${jungAlignment}</p>

        <p style="margin-top: 10px;"><strong>Goleman's Six Styles Validation:</strong></p>
        <p>${golemanAlignment}</p>

        <p style="margin-top: 10px;"><strong>Self-Awareness Assessment:</strong></p>
        <p>${selfAwarenessCheck}</p>

        <p style="margin-top: 15px; font-size: 9pt; color: #666;"><em>Note: This assessment is based on simulation performance. For comprehensive psychometric profiling, consider supplementing with validated instruments (MBTI, DISC, Hogan, etc.) and 360° feedback.</em></p>
    </div>
        `;
  }

  validateGolemanAlignment(styles) {
    // Goleman's research shows effective leaders use 4+ styles
    const stylesUsed = Object.values(styles).filter((v) => v >= 10).length;
    const dominantStyle = Object.keys(styles).find(
      (k) => styles[k] === Math.max(...Object.values(styles)),
    );
    const dominantPct = styles[dominantStyle];

    if (stylesUsed >= 5) {
      return `OK: Strong alignment with Goleman's research - You demonstrated ${stylesUsed} different leadership styles (target: 4+). This suggests high contextual intelligence and adaptability, which Goleman identifies as key to leadership effectiveness.`;
    } else if (stylesUsed >= 3) {
      return `WARNING: Moderate alignment with Goleman's research - You used ${stylesUsed} styles (target: 4+). Goleman's research shows leaders who master 4+ styles are more effective across diverse situations. Consider developing ${6 - stylesUsed} additional style(s).`;
    } else {
      return `GAP: Misalignment with Goleman's research - You primarily used ${stylesUsed} style(s), with ${dominantPct}% ${dominantStyle}. Goleman's HBR research demonstrates leaders with limited style repertoires struggle in complex environments. This is a critical development area.`;
    }
  }

  validateJungAlignment(jungColor, leadRatios) {
    // Validate if LEAD scores match expected Jung temperament pattern
    const expectedPatterns = {
      RED: { high: "determination", low: "excellence" },
      BLUE: { high: "excellence", low: "agility" },
      YELLOW: { high: "leadership", low: "determination" },
      GREEN: { high: "leadership", low: "determination" },
      BALANCED: { high: null, low: null },
    };

    const pattern =
      expectedPatterns[jungColor] || expectedPatterns[jungColor.split("/")[0]];

    if (!pattern || pattern.high === null) {
      return `OK: BALANCED profile - No strong Jung temperament preference. LEAD scores show relatively even development (variance <15%). This suggests high adaptability but may indicate lack of clear natural strengths. Consider: Are you truly balanced, or still discovering your authentic style?`;
    }

    const highMatch = leadRatios[pattern.high] >= 0.65;
    const lowMatch = leadRatios[pattern.low] < 0.65;

    if (highMatch && lowMatch) {
      return `OK: Strong Jung model alignment - Your ${jungColor} personality shows expected pattern: high ${pattern.high} (${(leadRatios[pattern.high] * 100).toFixed(0)}%), lower ${pattern.low} (${(leadRatios[pattern.low] * 100).toFixed(0)}%). This consistency suggests you're playing to natural strengths but may be over-indexed on comfort zone.`;
    } else if (highMatch) {
      return `WARNING: Partial Jung alignment - Strong ${pattern.high} matches ${jungColor} profile, but ${pattern.low} higher than expected. You may have developed beyond natural temperament or assessment captured atypical performance. Consider: Is this your authentic style or adapting to role demands?`;
    } else {
      return `GAP: Jung model misalignment - ${jungColor} personality would predict high ${pattern.high}, but you scored ${(leadRatios[pattern.high] * 100).toFixed(0)}%. Possible explanations: (1) Situational pressure override natural style, (2) Early development stage, (3) Role demands conflict with preferences. Recommend professional MBTI/DISC for deeper profiling.`;
    }
  }

  validateSelfAwareness() {
    if (!this.gameState.selfIdentifiedStyle) {
      return "No self-identified style provided - cannot assess self-awareness.";
    }

    const selfID = this.gameState.selfIdentifiedStyle.toLowerCase();
    const actual = this.results.leadershipProfile;
    const actualDominant = Object.keys(actual).find(
      (k) => actual[k] === Math.max(...Object.values(actual)),
    );
    const selfPct = actual[selfID] || 0;

    if (selfID === actualDominant) {
      return `OK: Strong self-awareness - You identified as ${this.gameState.selfIdentifiedStyle} and used it ${selfPct}% (your dominant style). This self-perception/behavior alignment suggests you understand how others experience your leadership. Self-aware leaders are more coachable and develop faster.`;
    } else if (selfPct >= 25) {
      return `WARNING: Moderate self-awareness gap - You identified as ${this.gameState.selfIdentifiedStyle} (${selfPct}% usage) but your dominant style was actually ${actualDominant} (${actual[actualDominant]}%). Small gap suggests minor blind spot - you may not fully recognize your behavioral patterns. Recommend 360 degree feedback to calibrate self-perception.`;
    } else {
      return `GAP: Significant self-awareness gap - You identified as ${this.gameState.selfIdentifiedStyle} but only used it ${selfPct}% of the time. Actual dominant style: ${actualDominant} (${actual[actualDominant]}%). This suggests you don't recognize how others experience your leadership. CRITICAL: Lack of self-awareness is #1 predictor of derailment in senior leaders. URGENTLY recommend 360 degree feedback and executive coaching.`;
    }
  }

  /**
   * Round 1 vs Round 2 awareness-change section.
   *
   * Only produced for Round 2 runs that have a prior Round 1 record. Returns an
   * empty string for Round 1 runs and for Round 2 runs with no prior record, so
   * the caller can embed it unconditionally without error.
   *
   * Compares, on a like-for-like basis:
   *   - the four LEAD ratios (R1 value, R2 value, delta);
   *   - the dominant Goleman style and Jung colour in each round, plus whether
   *     the player broadened their style range (lower concentration = broader);
   *   - the stored adaptationBonus (0-15) with a plain-English interpretation;
   *   - a short narrative verdict (improved / held / regressed).
   *
   * @returns {string} HTML section, or "" when not applicable.
   */
  generateAwarenessChangeSection() {
    // Round 1 runs never show a Round 2 comparison.
    if (this.round !== 2) return "";

    const prior = this.priorRound1Record;
    // Round 2 with no prior Round 1 record: omit gracefully.
    if (!prior) return "";

    const comparison = this.buildAwarenessComparison(prior);
    if (!comparison) return "";

    const {
      rows,
      r1DominantStyle,
      r2DominantStyle,
      r1Color,
      r2Color,
      styleBroadened,
      styleDelta,
      adaptationBonus,
      adaptationText,
      verdict,
      verdictColor,
    } = comparison;

    const rowHtml = rows
      .map((r) => {
        const deltaColor =
          r.delta > 0.005 ? "#2e7d32" : r.delta < -0.005 ? "#d32f2f" : "#666";
        const deltaSign = r.delta > 0 ? "+" : "";
        return `
            <tr>
                <td>${r.label}</td>
                <td>${(r.r1 * 100).toFixed(0)}%</td>
                <td>${(r.r2 * 100).toFixed(0)}%</td>
                <td style="color: ${deltaColor}; font-weight: bold;">${deltaSign}${(r.delta * 100).toFixed(0)}pp</td>
            </tr>`;
      })
      .join("");

    const styleLine = styleBroadened
      ? `Broadened style range: dominant style concentration fell from <strong>${r1DominantStyle.name} ${r1DominantStyle.percentage.toFixed(0)}%</strong> to <strong>${r2DominantStyle.name} ${r2DominantStyle.percentage.toFixed(0)}%</strong> (${styleDelta.toFixed(0)}pp less concentrated).`
      : `Style range did not broaden: dominant style concentration moved from <strong>${r1DominantStyle.name} ${r1DominantStyle.percentage.toFixed(0)}%</strong> to <strong>${r2DominantStyle.name} ${r2DominantStyle.percentage.toFixed(0)}%</strong>.`;

    const colorLine =
      r1Color === r2Color
        ? `Jung colour unchanged: <strong>${r1Color}</strong> in both rounds.`
        : `Jung colour shifted: <strong>${r1Color}</strong> (Round 1) -> <strong>${r2Color}</strong> (Round 2).`;

    return `
    <div class="section">
        <h2>Round 1 vs Round 2 — Awareness Change</h2>

        <p style="font-size: 9pt; color: #666; margin-top: 0;">Compares this player's Round 2 run against their most recent Round 1 record. Ratios are expressed against each round's own benchmark (Round 1: 9 scenarios / 171 cumulative; Round 2: 6 scenarios / 114 cumulative), so the deltas are like-for-like.</p>

        <table>
            <tr>
                <th>LEAD Dimension</th>
                <th>Round 1</th>
                <th>Round 2</th>
                <th>Change</th>
            </tr>
            ${rowHtml}
        </table>

        <p style="margin-top: 10px;"><strong>Style & colour:</strong> ${styleLine}</p>
        <p>${colorLine}</p>

        <p style="margin-top: 10px;"><strong>Adaptation bonus:</strong> ${adaptationBonus.toFixed(1)} / 15 — ${adaptationText}</p>

        <p style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-left: 4px solid ${verdictColor};"><strong>Verdict:</strong> ${verdict}</p>
    </div>
        `;
  }

  /**
   * Compute the Round 1 vs Round 2 comparison data. Returns null when the
   * comparison cannot be computed (e.g. missing ratios), so callers can omit
   * the section rather than fabricate figures.
   *
   * @param {Object} prior The prior Round 1 record.
   * @returns {?Object}
   */
  buildAwarenessComparison(prior) {
    const dimensions = [
      { key: "leadership", label: "Leadership" },
      { key: "excellence", label: "Excellence" },
      { key: "agility", label: "Agility" },
      { key: "determination", label: "Determination" },
    ];

    // Round 1 ratios: prefer the stored leadRatios, else derive from raw scores
    // using the Round 1 divisor (9). Round 2 ratios: current run (divisor 6).
    const r1Ratios = this.extractRatios(prior, 9);
    const r2Ratios = this.calculateLEADRatios();

    const rows = [];
    for (const dim of dimensions) {
      const r1 = r1Ratios[dim.key];
      const r2 = r2Ratios[dim.key];
      if (typeof r1 !== "number" || !isFinite(r1)) return null;
      if (typeof r2 !== "number" || !isFinite(r2)) return null;
      rows.push({ label: dim.label, r1: r1, r2: r2, delta: r2 - r1 });
    }

    // Dominant Goleman style in each round.
    const r1DominantStyle = this.maxStyleConcentration(prior);
    const r2DominantStyle = this.maxStyleConcentration(
      this.results.leadershipProfile,
    );
    if (!r1DominantStyle || !r2DominantStyle) return null;

    const styleDelta = r1DominantStyle.percentage - r2DominantStyle.percentage;
    const styleBroadened = styleDelta > 0.5;

    // Jung colour in each round.
    const r1Color = (prior.personalityColor || "UNKNOWN")
      .toString()
      .toUpperCase();
    const r2Color = (this.results.personalityColor || "UNKNOWN")
      .toString()
      .toUpperCase();

    // Adaptation bonus (0-15) stored on the results / leaderboard payload.
    const adaptationBonus =
      typeof this.results.adaptationBonus === "number"
        ? this.results.adaptationBonus
        : this.results.adaptation &&
            typeof this.results.adaptation.bonus === "number"
          ? this.results.adaptation.bonus
          : 0;

    const adaptationText = this.interpretAdaptationBonus(
      adaptationBonus,
      this.results.adaptation,
    );

    // Narrative verdict: improved / held / regressed, based on the average LEAD
    // delta and the style-broadening signal.
    const avgDelta = rows.reduce((sum, r) => sum + r.delta, 0) / rows.length;
    let verdict;
    let verdictColor;
    if (avgDelta > 0.02 || (avgDelta >= -0.01 && styleBroadened)) {
      verdict = `Awareness improved. Average LEAD performance rose ${(avgDelta * 100).toFixed(0)}pp versus Round 1${styleBroadened ? " and the player broadened their style range" : ""}. The Round 1 feedback appears to have been acted on.`;
      verdictColor = "#2e7d32";
    } else if (avgDelta < -0.02) {
      verdict = `Awareness regressed. Average LEAD performance fell ${(Math.abs(avgDelta) * 100).toFixed(0)}pp versus Round 1. The Round 1 feedback does not appear to have translated into changed behaviour.`;
      verdictColor = "#d32f2f";
    } else {
      verdict = `Awareness held. Average LEAD performance was broadly unchanged (${(avgDelta * 100).toFixed(0)}pp) versus Round 1. No clear evidence of change in either direction.`;
      verdictColor = "#f57c00";
    }

    return {
      rows,
      r1DominantStyle,
      r2DominantStyle,
      r1Color,
      r2Color,
      styleBroadened,
      styleDelta,
      adaptationBonus,
      adaptationText,
      verdict,
      verdictColor,
    };
  }

  /**
   * Plain-English interpretation of the 0-15 adaptation bonus.
   * @param {number} bonus
   * @param {?Object} adaptation The stored adaptation object, when present.
   * @returns {string}
   */
  interpretAdaptationBonus(bonus, adaptation) {
    if (bonus <= 0) {
      return "no measurable adaptation was detected against the specific areas Round 1 flagged. This is not a penalty; it means the flagged areas did not improve enough to register.";
    }
    const parts = [];
    if (adaptation && adaptation.weakestDimension) {
      parts.push(
        `moved toward the weakest Round 1 LEAD dimension (${adaptation.weakestDimension})`,
      );
    }
    if (
      adaptation &&
      adaptation.round1MaxStyleName &&
      adaptation.round2MaxStyleName
    ) {
      parts.push(
        `reduced over-reliance on the ${adaptation.round1MaxStyleName} style`,
      );
    }
    if (parts.length === 0) {
      parts.push("acted on the areas flagged in Round 1 feedback");
    }
    return `the player ${parts.join(" and ")}.`;
  }

  /**
   * Derive LEAD ratios from a record using the canonical per-scenario benchmark
   * (19 points/dimension). Prefers an explicit leadRatios object when present.
   * Mirrors scoring.js _extractLeadRatios().
   *
   * @param {Object} record
   * @param {number} scenarioCount 9 for Round 1, 6 for Round 2.
   * @returns {Object}
   */
  extractRatios(record, scenarioCount) {
    const dimensions = ["leadership", "excellence", "agility", "determination"];
    const ratios = {};

    if (record && record.leadRatios && typeof record.leadRatios === "object") {
      dimensions.forEach((dim) => {
        const v = record.leadRatios[dim];
        if (typeof v === "number" && isFinite(v)) ratios[dim] = v;
      });
      if (Object.keys(ratios).length > 0) return ratios;
    }

    const divisor = scenarioCount === 6 ? 6 : 9;
    const benchmark = 19;
    dimensions.forEach((dim) => {
      const raw = record ? record[dim] : undefined;
      if (typeof raw === "number" && isFinite(raw)) {
        ratios[dim] = raw / divisor / benchmark;
      }
    });
    return ratios;
  }

  /**
   * Return { name, percentage } for the most concentrated Goleman style.
   * Accepts either a raw leadershipStyles points object or a pre-computed
   * leadershipProfile percentage object. Mirrors scoring.js
   * _maxStyleConcentration().
   *
   * @param {?Object} record
   * @returns {?{name:string, percentage:number}}
   */
  maxStyleConcentration(record) {
    if (!record) return null;

    // Prefer raw leadershipStyles points (most accurate).
    const raw = record.leadershipStyles;
    if (raw && typeof raw === "object") {
      const total = Object.values(raw).reduce(
        (a, b) => a + (typeof b === "number" ? b : 0),
        0,
      );
      if (total > 0) {
        let name = null;
        let max = -1;
        Object.keys(raw).forEach((style) => {
          const v = typeof raw[style] === "number" ? raw[style] : 0;
          if (v > max) {
            max = v;
            name = style;
          }
        });
        if (name) {
          return { name: name, percentage: (max / total) * 100 };
        }
      }
    }

    // Fall back to a pre-computed percentage profile. Accept either a record
    // that nests `leadershipProfile`, or a raw style->percentage object passed
    // directly (e.g. this.results.leadershipProfile).
    const profile =
      record.leadershipProfile && typeof record.leadershipProfile === "object"
        ? record.leadershipProfile
        : record;
    if (profile && typeof profile === "object") {
      let name = null;
      let max = -1;
      Object.keys(profile).forEach((style) => {
        const v = typeof profile[style] === "number" ? profile[style] : 0;
        if (v > max) {
          max = v;
          name = style;
        }
      });
      // PERCENTAGE ACCURACY FIX: the pre-computed profile is trusted as-is,
      // but a style share is conceptually bounded 0-100, so clamp the fallback
      // value (and guard non-finite input) before returning it.
      if (name) {
        return { name: name, percentage: this.clampPercent(max) };
      }
    }

    return null;
  }

  generateComparisonToBenchmarks() {
    // Prefer REAL cohort figures derived from getCultureData(). Only when no
    // usable cohort exists do we fall back to clearly-labelled ILLUSTRATIVE
    // reference figures. We never present fabricated numbers as measured.
    const cohort = this.getCohort();
    const stats = this.computeCohortStats(cohort);

    const leadRatios = this.calculateLEADRatios();
    const avgLEAD = this.calculateAverageLEADRatio();
    const maxStyle = Math.max(...Object.values(this.results.leadershipProfile));

    // Cohort column: real when available, otherwise illustrative.
    const cohortLead = stats ? `${(stats.avgLEAD * 100).toFixed(0)}%` : "62%";
    const cohortLeadership = stats
      ? `${(stats.leadership * 100).toFixed(0)}%`
      : "58%";
    const cohortExcellence = stats
      ? `${(stats.excellence * 100).toFixed(0)}%`
      : "51%";
    const cohortBalance = stats
      ? `${stats.maxStyle.toFixed(0)}% max`
      : "58% max";

    const cohortLabel = stats
      ? `JCB Cohort Avg (n=${stats.n})`
      : "JCB Cohort Avg (illustrative)";
    const industryLabel = stats
      ? "Industry Benchmark (illustrative)"
      : "Industry Benchmark (illustrative)";
    const topQuartileLabel = stats
      ? "Top Quartile (illustrative)"
      : "Top Quartile (illustrative)";

    const footnote = stats
      ? `<em>Cohort column is derived from ${stats.n} recorded run(s) in this deployment (getCultureData). Industry and top-quartile columns are ILLUSTRATIVE reference figures drawn from leadership research (Goleman 2000; CCL 2022; DDI Global Leadership Forecast 2023) and are not measured from this cohort.</em>`
      : `<em>No cohort data is available in this deployment, so ALL comparison figures below are ILLUSTRATIVE reference values drawn from leadership research (Goleman 2000; CCL 2022; DDI Global Leadership Forecast 2023). They are not measured from this cohort.</em>`;

    return `
    <div class="section">
        <h2>Comparison to Benchmarks</h2>

        <table>
            <tr>
                <th>Metric</th>
                <th>Your Score</th>
                <th>${cohortLabel}</th>
                <th>${industryLabel}</th>
                <th>${topQuartileLabel}</th>
            </tr>
            <tr>
                <td>Overall LEAD Quality</td>
                <td>${(avgLEAD * 100).toFixed(0)}%</td>
                <td>${cohortLead}</td>
                <td>68%</td>
                <td>82%</td>
            </tr>
            <tr>
                <td>Leadership (Style Variety)</td>
                <td>${(leadRatios.leadership * 100).toFixed(0)}%</td>
                <td>${cohortLeadership}</td>
                <td>65%</td>
                <td>85%</td>
            </tr>
            <tr>
                <td>Excellence (Evidence-Based)</td>
                <td>${(leadRatios.excellence * 100).toFixed(0)}%</td>
                <td>${cohortExcellence}</td>
                <td>72%</td>
                <td>88%</td>
            </tr>
            <tr>
                <td>Style Balance</td>
                <td>${maxStyle}% max</td>
                <td>${cohortBalance}</td>
                <td>45% max</td>
                <td>35% max</td>
            </tr>
        </table>

        <p style="font-size: 9pt; color: #666; margin-top: 10px;">${footnote}</p>
    </div>
        `;
  }

  /**
   * Compute real cohort statistics from the full cohort array. Returns null
   * when there is no usable data (fewer than 1 record with LEAD scores), so the
   * caller can fall back to illustrative figures.
   *
   * @param {Array<Object>} cohort
   * @returns {?{n:number, avgLEAD:number, leadership:number, excellence:number, maxStyle:number}}
   */
  computeCohortStats(cohort) {
    if (!Array.isArray(cohort) || cohort.length === 0) return null;

    let n = 0;
    let sumLead = 0;
    let sumLeadership = 0;
    let sumExcellence = 0;
    let sumMaxStyle = 0;
    let styleSamples = 0;

    cohort.forEach((p) => {
      if (!p) return;
      // Derive ratios using the record's own round divisor so mixed-round
      // cohorts are compared on a like-for-like basis.
      const recordRound = p.round === 2 ? 2 : 1;
      const ratios = this.extractRatios(p, recordRound === 2 ? 6 : 9);
      const dims = ["leadership", "excellence", "agility", "determination"];
      const present = dims.filter(
        (d) => typeof ratios[d] === "number" && isFinite(ratios[d]),
      );
      if (present.length === 0) return;

      n += 1;
      sumLead += present.reduce((s, d) => s + ratios[d], 0) / present.length;
      if (typeof ratios.leadership === "number")
        sumLeadership += ratios.leadership;
      if (typeof ratios.excellence === "number")
        sumExcellence += ratios.excellence;

      const maxStyle = this.maxStyleConcentration(p);
      if (maxStyle && typeof maxStyle.percentage === "number") {
        sumMaxStyle += maxStyle.percentage;
        styleSamples += 1;
      }
    });

    if (n === 0) return null;

    return {
      n: n,
      avgLEAD: sumLead / n,
      leadership: sumLeadership / n,
      excellence: sumExcellence / n,
      maxStyle: styleSamples > 0 ? sumMaxStyle / styleSamples : 0,
    };
  }

  generateDetailedActionPlan() {
    const actions = this.generateActionPlan();

    return `
    <div class="section">
        <h2>Detailed 90-Day Development Plan</h2>

        ${actions
          .map(
            (action, idx) => `
            <div style="margin: 15px 0; page-break-inside: avoid;">
                <p style="font-weight: bold; margin-bottom: 5px;">${idx + 1}. ${action.action}</p>
                <p style="margin: 5px 0 5px 20px;">${action.detail}</p>
                <p style="margin: 5px 0 0 20px; font-size: 9pt; color: #666;"><em>Success Metric: [To be defined with manager during development planning session]</em></p>
            </div>
        `,
          )
          .join("")}

        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #FFCB00;">
            <p style="font-weight: bold; margin-bottom: 5px;">Development Planning Session (Next 7 Days)</p>
            <p style="margin: 5px 0;">Schedule 60-minute session with your manager to:</p>
            <ul style="margin: 5px 0 5px 20px;">
                <li>Review this assessment together</li>
                <li>Agree on top 2 development priorities</li>
                <li>Define specific success metrics for each action</li>
                <li>Schedule 30-day check-in to review progress</li>
                <li>Book 90-day reassessment (retake simulation)</li>
            </ul>
        </div>
    </div>
        `;
  }

  // Method to save both files to a folder
  async saveToFolder(folderPath = "./player_reports") {
    // Preserve the round/prior-record context already resolved on this instance
    // so a re-generation from saveToFolder() stays round-aware.
    const report = this.generateSummary(
      this.playerData,
      this.gameState,
      this.results,
      {
        round: this.round,
        priorRound1Record: this.priorRound1Record,
        cultureDataProvider: this.cultureDataProvider,
      },
    );

    // In browser environment, trigger downloads
    // In Node environment, could use fs.writeFile

    // For now, return the HTML that can be saved
    return {
      summary: report.summary,
      detailed: report.detailed,
      combined: report.combined,
      filename: report.filename,
      round: report.round,
      roundLabel: report.roundLabel,
      awarenessChange: report.awarenessChange,
    };
  }
}

// Make available globally (browser). Guarded so the file can also be loaded
// headlessly in Node (e.g. via the vm module) for verification.
if (typeof window !== "undefined") {
  window.ExecutiveSummaryGenerator = ExecutiveSummaryGenerator;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = ExecutiveSummaryGenerator;
}
