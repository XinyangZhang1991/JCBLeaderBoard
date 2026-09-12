// Game Engine - Core game logic and state management

// Granularity of the budget sliders. Slider <input> values are integers, so
// the £M value is multiplied by this scale for the DOM and divided back out
// when read. 20 gives 0.05 £M steps, which divides evenly into every budget
// in use (0.4, 0.5, 0.25) so the full allocation is always reachable.
const SLIDER_SCALE = 20;

class GameEngine {
  constructor() {
    this.state = {
      playerName: "",
      jobFunction: "",
      seniority: "",
      selfIdentifiedStyle: "",
      consentGiven: false,
      currentScenario: 0,
      round: 1,

      // Visible metrics
      growth: 0,
      profitMargin: 28, // BUGFIX: Raised from 20 to 28 (initial margin was too fragile)
      morale: 65, // UPDATED 2026-05-17: Reduced from 75 to 65 (inherited team with challenges)
      attrition: 10, // UPDATED 2026-05-17: Increased from 5 to 10 (realistic industry baseline)

      // Hidden tracking
      leadershipStyles: {
        coercive: 0,
        authoritative: 0,
        affiliative: 0,
        democratic: 0,
        pacesetting: 0,
        coaching: 0,
      },

      // Quality metrics
      leadership: 0,
      excellence: 0,
      agility: 0,
      determination: 0,
      organizationalCapability: 75, // Starting baseline - existing team capability

      criticalThinking: 0,
      teamImpact: 0,

      // Decision tracking
      decisions: [],
      infoRequests: [],

      // CRITICAL FIX #2: Delayed Payoffs Tracking
      // Strategic investments (R&D, dealer relationships) pay off in later months
      delayedGrowthPayoffs: [], // Array of {amount: X, triggerScenario: Y}

      // Timing
      startTime: null,
      timeRemaining: 600, // 10 minutes in seconds (9 scenarios, ~60s each)
      timerInterval: null,

      // Submission control
      isSubmitting: false,

      // End-of-game guard (prevents double results / double leaderboard writes)
      gameEnded: false,

      // Leaderboard idempotency guard (prevents duplicate rows for one run)
      savedToLeaderboard: false,
      runId: null,
    };

    this.scenarios = null; // Will be loaded from scenarios.js
    this.finalResults = null; // BUGFIX: Initialize to prevent "No results available" error
  }

  init() {
    console.log("JCB Leadership in Action initialized");
    this.loadLeaderboard();
    this.showScreen("welcome-screen");
  }

  loadLeaderboard() {
    const leaderboardData = this.getLeaderboardData();
    const container = document.getElementById("leaderboard-container");

    if (!container) return;

    if (leaderboardData.length === 0) {
      container.innerHTML =
        '<div class="leaderboard-empty">No players yet.<br/>Be the first to lead!</div>';
      return;
    }

    container.innerHTML = leaderboardData
      .map((player, index) => {
        // Status badge
        const statusBadge = player.optimal
          ? "✅ OPTIMAL"
          : player.escaped
            ? "🎯 TARGET MET"
            : "❌ MISSED TARGET";
        const statusClass = player.optimal
          ? "optimal"
          : player.escaped
            ? "escaped"
            : "failed";

        // LEAD total
        const leadTotal =
          (player.leadership || 0) +
          (player.excellence || 0) +
          (player.agility || 0) +
          (player.determination || 0);

        return `
            <div class="leaderboard-item leaderboard-item-compact">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-player-info">
                    <div class="leaderboard-name">${player.name}</div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                        <div class="leaderboard-status ${statusClass}">${statusBadge}</div>
                        <button class="btn-secondary" style="padding: 4px 12px; font-size: 11px;" onclick="game.viewPlayerFeedback(${index})">
                            📊 VIEW FEEDBACK
                        </button>
                        <button class="btn-secondary" style="padding: 4px 12px; font-size: 11px;" onclick="game.downloadPlayerFeedbackPdf(${index})">
                            📄 PDF
                        </button>
                    </div>
                </div>
                <div class="leaderboard-metrics">
                    <div class="leaderboard-metrics-row">
                        <span class="metric-label">Growth:</span> <span class="metric-value">${player.growth.toFixed(1)}%</span>
                        <span class="metric-label">Capability:</span> <span class="metric-value">${(player.organizationalCapability || 75).toFixed(0)}</span>
                        <span class="metric-label">Morale:</span> <span class="metric-value">${(player.morale || 0).toFixed(0)}%</span>
                        <span class="metric-label">Attrition:</span> <span class="metric-value">${(player.attrition || 0).toFixed(0)}%</span>
                    </div>
                    <div class="leaderboard-metrics-row">
                        <span class="metric-label">LEAD:</span>
                        <span class="metric-value">L:${player.leadership || 0} E:${player.excellence || 0} A:${player.agility || 0} D:${player.determination || 0}</span>
                        <span class="metric-total">(Total: ${leadTotal})</span>
                    </div>
                </div>
                <div class="leaderboard-profile">
                    <div class="leaderboard-style">
                        <span class="style-icon">👤</span> ${player.leadershipStyle}
                    </div>
                    <div class="leaderboard-color">
                        <span class="color-badge color-${player.personalityColor?.toLowerCase() || "balanced"}">${player.personalityColor || "BALANCED"}</span>
                    </div>
                </div>
                <div class="leaderboard-improvement">
                    <div class="improvement-label">🎯 Key Development:</div>
                    <div class="improvement-text">${player.criticalImprovement || "Continue developing leadership skills"}</div>
                </div>
            </div>
        `;
      })
      .join("");
  }

  getLeaderboardData() {
    try {
      const data = localStorage.getItem("jcb_leaderboard");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error loading leaderboard:", e);
      return [];
    }
  }

  // Full cohort of every player who has completed the game.
  // Kept separate from the top-10 display leaderboard so the culture
  // analysis reflects ALL players, not just the highest performers.
  //
  // BUGFIX (culture count): the two stores (jcb_culture_data and
  // jcb_leaderboard) can drift apart - e.g. a row written by an earlier
  // build that only touched the leaderboard, or a partially-failed write.
  // We reconcile on read so a stale culture store is back-filled from the
  // leaderboard before it is used for analysis.
  getCultureData() {
    try {
      this.reconcileCultureData();
      const data = localStorage.getItem("jcb_culture_data");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error loading culture data:", e);
      return [];
    }
  }

  // Back-fill jcb_culture_data from jcb_leaderboard so the two stores agree.
  //
  // The culture store is the authoritative FULL cohort; the leaderboard is a
  // top-10 display slice. Any leaderboard record whose run is missing from the
  // culture store is appended (and persisted). Matching is by `runId` when
  // present, falling back to `timestamp` + `name` for legacy rows that predate
  // runId. Idempotent: running twice never duplicates a record. Never throws.
  reconcileCultureData() {
    try {
      const rawCulture = localStorage.getItem("jcb_culture_data");
      const rawLeaderboard = localStorage.getItem("jcb_leaderboard");

      const culture = rawCulture ? JSON.parse(rawCulture) : [];
      const leaderboard = rawLeaderboard ? JSON.parse(rawLeaderboard) : [];

      if (!Array.isArray(culture) || !Array.isArray(leaderboard)) {
        return culture;
      }
      if (leaderboard.length === 0) {
        return culture;
      }

      // Index existing culture records for O(1) membership checks.
      const cultureRunIds = new Set(
        culture.filter((p) => p && p.runId).map((p) => p.runId),
      );
      const cultureLegacyKeys = new Set(
        culture
          .filter((p) => p && !p.runId)
          .map((p) => this.legacyRecordKey(p)),
      );

      let changed = false;
      leaderboard.forEach((record) => {
        if (!record) return;

        // Prefer the stable runId; fall back to timestamp+name for legacy rows.
        const isDuplicate = record.runId
          ? cultureRunIds.has(record.runId)
          : cultureLegacyKeys.has(this.legacyRecordKey(record));

        if (isDuplicate) return;

        culture.push(record);
        changed = true;

        if (record.runId) {
          cultureRunIds.add(record.runId);
        } else {
          cultureLegacyKeys.add(this.legacyRecordKey(record));
        }
      });

      if (changed) {
        localStorage.setItem("jcb_culture_data", JSON.stringify(culture));
      }

      return culture;
    } catch (e) {
      console.error("Error reconciling culture data:", e);
      return [];
    }
  }

  // Stable identity for legacy records that have no runId.
  legacyRecordKey(record) {
    if (!record) return "";
    return String(record.timestamp || "") + "|" + String(record.name || "");
  }

  saveToLeaderboard(playerData) {
    try {
      // BUGFIX (audit): Give every run a UNIQUE id. Previously the only key was
      // `timestamp: Date.now()`, which can collide when two saves happen in the
      // same millisecond - the rank lookup then matched the wrong entry, which is
      // how a player could see "1 of 1" on the podium while TWO identical rows
      // appeared on the leaderboard.
      if (!playerData.runId) {
        playerData.runId =
          "run_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 10);
      }

      // BUGFIX (culture count): persist the run's stable identity back onto
      // this.state so the idempotency guard in showFeedback() can key on it.
      // Previously this.state.runId stayed null forever, so the guard compared
      // against a fresh unique id every call and never suppressed a duplicate.
      if (this.state && !this.state.runId) {
        this.state.runId = playerData.runId;
      }

      // 1. Persist the FULL cohort for culture analysis (no truncation).
      //    Idempotent: if this exact run was already saved, do not duplicate it.
      const cohort = this.getCultureData();
      const alreadySaved = cohort.some((p) => p.runId === playerData.runId);
      if (!alreadySaved) {
        cohort.push(playerData);
        localStorage.setItem("jcb_culture_data", JSON.stringify(cohort));
      }

      // 2. Maintain the top-10 display leaderboard (also idempotent)
      const leaderboard = this.getLeaderboardData();
      if (!leaderboard.some((p) => p.runId === playerData.runId)) {
        leaderboard.push(playerData);
      }

      // Sort by growth percentage (descending)
      leaderboard.sort((a, b) => b.growth - a.growth);

      // Keep only top 10 for display
      const top10 = leaderboard.slice(0, 10);

      localStorage.setItem("jcb_leaderboard", JSON.stringify(top10));

      // 3. Report the player's placement for the results-screen reveal.
      //    Rank is computed against the FULL cohort so it is always truthful,
      //    even when the player falls outside the displayed top 10.
      const sortedCohort = [...cohort].sort((a, b) => b.growth - a.growth);
      const rank =
        sortedCohort.findIndex((p) => p.runId === playerData.runId) + 1;
      return {
        rank: rank > 0 ? rank : null,
        total: cohort.length,
        inTop10: rank > 0 && rank <= 10,
      };
    } catch (e) {
      console.error("Error saving to leaderboard:", e);
      return null;
    }
  }

  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
  }

  startRegistration() {
    console.log("startRegistration called");
    this.showScreen("registration-screen");
    console.log("registration screen should now be visible");
  }

  selectLeadershipStyle(style) {
    this.state.selfIdentifiedStyle = style;
    document.querySelectorAll(".radio-option").forEach((opt) => {
      opt.classList.remove("selected");
    });

    // Use event if available, otherwise find the element
    const targetOption = window.event
      ? window.event.target.closest(".radio-option")
      : document
          .querySelector(`.radio-option input[value="${style}"]`)
          ?.closest(".radio-option");

    if (targetOption) {
      targetOption.classList.add("selected");
    }

    const radioInput = document.querySelector(`input[value="${style}"]`);
    if (radioInput) {
      radioInput.checked = true;
    }
  }

  validateAndStartBriefing() {
    const nameInput = document.getElementById("player-name");
    const functionInput = document.getElementById("player-function");
    const seniorityInput = document.getElementById("player-seniority");
    const consentCheckbox = document.getElementById("consent-checkbox");

    if (!nameInput.value.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!functionInput.value) {
      alert("Please select your business function");
      return;
    }

    if (!seniorityInput.value) {
      alert("Please select your seniority");
      return;
    }

    if (!this.state.selfIdentifiedStyle) {
      alert("Please select your primary leadership style");
      return;
    }

    if (!consentCheckbox.checked) {
      alert("Please consent to public results display");
      return;
    }

    this.state.playerName = nameInput.value.trim();
    this.state.jobFunction = functionInput.value;
    this.state.seniority = seniorityInput.value;
    this.state.consentGiven = true;

    // Returning-player detection: if this name matches a previous completed
    // run, offer the choice of replaying Round 1 or advancing to Round 2.
    // New players are completely unaffected and go straight to the briefing.
    const returning = this.findReturningPlayer(this.state.playerName);
    if (returning) {
      this.returningPlayer = returning;
      this.showRoundChoice(returning);
      return;
    }

    // New player: default to Round 1 and proceed exactly as before.
    // BUGFIX (culture count): this path calls startBriefing() directly and
    // never went through startRound(), so the previous run's save guard could
    // leak into the new run and suppress its leaderboard write. Reset it here.
    this.resetSaveGuard();
    this.state.round = 1;
    this.scenarios = window.scenarios
      ? window.scenarios.round1
      : this.scenarios;
    this.startBriefing();
  }

  // Reset the per-run leaderboard save guard. Called from startRound() and the
  // new-player path in validateAndStartBriefing(). The guard lives on
  // `this._savedRunIds` (NOT on the swappable this.state) so it survives
  // viewPlayerFeedback()'s state swap; we also clear the legacy boolean flag.
  resetSaveGuard() {
    this._savedRunIds = new Set();
    if (this.state) {
      this.state.savedToLeaderboard = false;
      this.state.runId = null;
    }
  }

  // Search the full cohort (jcb_culture_data) for a prior completed run whose
  // name matches the entered name case-insensitively and trimmed.
  // Returns the most recent match (by timestamp), preferring a Round 1 record
  // when one exists because Round 2 is the "learned from feedback" follow-up.
  findReturningPlayer(name) {
    if (!name || !name.trim()) return null;

    const target = name.trim().toLowerCase();
    const cohort = this.getCultureData();

    const matches = cohort.filter(
      (p) =>
        p &&
        typeof p.name === "string" &&
        p.name.trim().toLowerCase() === target,
    );

    if (matches.length === 0) return null;

    // Prefer a Round 1 record if one exists (Round 2 builds on Round 1 feedback).
    const round1Matches = matches.filter((p) => (p.round || 1) === 1);
    const pool = round1Matches.length > 0 ? round1Matches : matches;

    // Most recent match by timestamp.
    return pool.reduce((latest, current) => {
      const latestTs = latest.timestamp || 0;
      const currentTs = current.timestamp || 0;
      return currentTs > latestTs ? current : latest;
    });
  }

  // Present the returning player with a choice: replay Round 1 or play Round 2.
  showRoundChoice(returning) {
    const nameEl = document.getElementById("round-choice-name");
    if (nameEl) {
      nameEl.textContent = this.state.playerName;
    }

    const detailEl = document.getElementById("round-choice-detail");
    if (detailEl && returning) {
      const growth =
        typeof returning.growth === "number"
          ? returning.growth.toFixed(1)
          : "0.0";
      const status = returning.optimal
        ? "Optimal"
        : returning.escaped
          ? "Target met"
          : "Target missed";
      detailEl.textContent = `We found your previous run: ${growth}% growth (${status}).`;
    }

    this.showScreen("round-choice-screen");
  }

  // Route the chosen round. Resets all per-run state to the constructor
  // defaults so nothing leaks between rounds, then proceeds to the briefing.
  startRound(roundNumber) {
    const round = roundNumber === 2 ? 2 : 1;

    // Reset per-run state to the exact constructor starting values.
    this.state.currentScenario = 0;
    this.state.round = round;

    // Visible metrics
    this.state.growth = 0;
    this.state.profitMargin = 28;
    this.state.morale = 65;
    this.state.attrition = 10;

    // Hidden tracking
    this.state.leadershipStyles = {
      coercive: 0,
      authoritative: 0,
      affiliative: 0,
      democratic: 0,
      pacesetting: 0,
      coaching: 0,
    };

    // Quality metrics
    this.state.leadership = 0;
    this.state.excellence = 0;
    this.state.agility = 0;
    this.state.determination = 0;
    this.state.organizationalCapability = 75;

    this.state.criticalThinking = 0;
    this.state.teamImpact = 0;

    // Decision tracking
    this.state.decisions = [];
    this.state.infoRequests = [];

    // Delayed payoffs
    this.state.delayedGrowthPayoffs = [];

    // Timing
    this.state.startTime = null;
    this.state.timeRemaining = 600;
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }

    // Submission control
    this.state.isSubmitting = false;

    // End-of-game guard
    this.state.gameEnded = false;

    // Leaderboard idempotency guard
    this.resetSaveGuard();

    // Select the scenario set for the chosen round.
    this.scenarios =
      round === 2
        ? window.scenarios && window.scenarios.round2
        : window.scenarios && window.scenarios.round1;

    // Round 2 gets a welcome-back message before the briefing.
    if (round === 2 && this.returningPlayer) {
      this.showWelcomeBack(this.returningPlayer);
      return;
    }

    this.startBriefing();
  }

  // Welcome-back message for a returning player choosing Round 2. References
  // their previous result and their criticalImprovement to set up the
  // "learned from feedback" theme.
  showWelcomeBack(returning) {
    const nameEl = document.getElementById("welcome-back-name");
    if (nameEl) {
      nameEl.textContent = this.state.playerName;
    }

    const summaryEl = document.getElementById("welcome-back-summary");
    if (summaryEl && returning) {
      const growth =
        typeof returning.growth === "number"
          ? returning.growth.toFixed(1)
          : "0.0";
      const status = returning.optimal
        ? "Optimal"
        : returning.escaped
          ? "Target met"
          : "Target missed";
      const leadTotal =
        (returning.leadership || 0) +
        (returning.excellence || 0) +
        (returning.agility || 0) +
        (returning.determination || 0);

      summaryEl.innerHTML = `
        <p>Last time you delivered <strong>${growth}% growth</strong> (${status}) with a LEAD total of <strong>${leadTotal}</strong>.</p>
        <p>Your #1 development priority was:</p>
        <p class="welcome-back-improvement">${returning.criticalImprovement || "Continue developing leadership skills"}</p>
        <p>Round 2 picks up where you left off — the challenges are harder, and the feedback you received is your edge. Apply what you learned.</p>
      `;
    }

    this.showScreen("welcome-back-screen");
  }

  // Called from the welcome-back screen to proceed into the Round 2 briefing.
  proceedFromWelcomeBack() {
    this.startBriefing();
  }

  startBriefing() {
    this.showScreen("briefing-screen");

    // Start countdown
    let countdown = 90;
    const countdownEl = document.querySelector("#briefing-countdown span");

    if (!countdownEl) {
      console.error("Countdown element not found!");
      // Skip to gameplay if element missing
      this.startGameplay();
      return;
    }

    const countdownInterval = setInterval(() => {
      countdown--;
      countdownEl.textContent = countdown;

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.startGameplay();
      }
    }, 1000);

    // Store interval for skip function
    this.briefingInterval = countdownInterval;
  }

  skipBriefing() {
    if (this.briefingInterval) {
      clearInterval(this.briefingInterval);
    }
    this.startGameplay();
  }

  startGameplay() {
    this.state.startTime = Date.now();
    this.showScreen("gameplay-screen");
    this.startTimer();
    this.loadScenario(0);
  }

  startTimer() {
    // Guard against stacking intervals if startTimer is ever called twice
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
    }

    this.updateTimerDisplay();

    this.state.timerInterval = setInterval(() => {
      this.state.timeRemaining--;
      this.updateTimerDisplay();

      if (this.state.timeRemaining <= 0) {
        // Clear the interval BEFORE ending the game so it cannot keep firing
        clearInterval(this.state.timerInterval);
        this.state.timerInterval = null;
        this.endGame();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.state.timeRemaining / 60);
    const seconds = this.state.timeRemaining % 60;
    const timerEl = document.getElementById("game-timer");
    if (!timerEl) return;
    timerEl.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Reset to default colour first, then apply the warning colour only
    // when the clock is genuinely low. Without the reset the timer stayed
    // red forever once it dipped below 60s (e.g. after a restart).
    if (this.state.timeRemaining < 60) {
      timerEl.style.color = "var(--jcb-red)";
    } else {
      timerEl.style.color = "";
    }
  }

  updateHUD(deltas) {
    // Update visible metrics
    document.getElementById("metric-growth").textContent =
      `+${this.state.growth.toFixed(1)}%`;
    document.getElementById("metric-profit").textContent =
      `${this.state.profitMargin.toFixed(0)}%`;
    document.getElementById("metric-attrition").textContent =
      `${this.state.attrition.toFixed(0)}%`;
    document.getElementById("metric-capability").textContent =
      `${this.state.organizationalCapability.toFixed(0)} pts`;

    // Update morale bar
    const moraleFill = document.querySelector(".morale-fill");
    const moraleValue = document.querySelector(".morale-value");
    moraleFill.style.width = `${this.state.morale}%`;
    moraleValue.textContent = `${this.state.morale.toFixed(0)}%`;

    // Color coding for morale
    if (this.state.morale >= 75) {
      moraleFill.style.background =
        "linear-gradient(to right, var(--jcb-green), var(--jcb-yellow))";
    } else if (this.state.morale >= 60) {
      moraleFill.style.background =
        "linear-gradient(to right, var(--jcb-yellow), orange)";
    } else {
      moraleFill.style.background =
        "linear-gradient(to right, orange, var(--jcb-red))";
    }

    // Animated deltas: flash each metric that moved and show a +/- chip
    if (deltas) {
      this.animateMetricDelta("metric-growth", deltas.growth, "%", 1);
      this.animateMetricDelta("metric-profit", deltas.profitMargin, "%", 0);
      this.animateMetricDelta("metric-attrition", deltas.attrition, "%", 0);
      this.animateMetricDelta(
        "metric-capability",
        deltas.organizationalCapability,
        " pts",
        0,
      );
      this.animateMoraleDelta(deltas.morale);
    }
  }

  // Flash a metric value and show a floating +/- delta chip.
  // For attrition, a decrease is good (green) and an increase is bad (red).
  animateMetricDelta(elementId, delta, unit, decimals) {
    if (!delta || Math.abs(delta) < 0.05) return;

    const el = document.getElementById(elementId);
    if (!el) return;

    const isAttrition = elementId === "metric-attrition";
    const isGood = isAttrition ? delta < 0 : delta > 0;
    const cls = isGood ? "delta-good" : "delta-bad";
    const sign = delta > 0 ? "+" : "";

    // Pulse the value itself
    el.classList.remove("delta-good", "delta-bad");
    // Force reflow so the animation can restart
    void el.offsetWidth;
    el.classList.add(cls);

    // Floating chip
    const chip = document.createElement("span");
    chip.className = `metric-delta-chip ${cls}`;
    chip.textContent = `${sign}${delta.toFixed(decimals)}${unit}`;
    el.parentElement.style.position = "relative";
    el.parentElement.appendChild(chip);

    setTimeout(() => chip.remove(), 1600);
    setTimeout(() => el.classList.remove("delta-good", "delta-bad"), 1200);
  }

  animateMoraleDelta(delta) {
    if (!delta || Math.abs(delta) < 0.5) return;

    const bar = document.getElementById("morale-bar");
    if (!bar) return;

    const isGood = delta > 0;
    const cls = isGood ? "delta-good" : "delta-bad";
    const sign = delta > 0 ? "+" : "";

    bar.classList.remove("delta-good", "delta-bad");
    void bar.offsetWidth;
    bar.classList.add(cls);

    const chip = document.createElement("span");
    chip.className = `metric-delta-chip ${cls}`;
    chip.textContent = `${sign}${delta.toFixed(0)}%`;
    bar.parentElement.style.position = "relative";
    bar.parentElement.appendChild(chip);

    setTimeout(() => chip.remove(), 1600);
    setTimeout(() => bar.classList.remove("delta-good", "delta-bad"), 1200);
  }

  updatePeriod(month, quarter) {
    const periodEl = document.getElementById("game-period");
    periodEl.textContent = `Q${quarter} Month ${month}`;
  }

  adaptScenarioToState(scenario) {
    // Adapt scenarios based on current game state performance
    const state = this.state;

    // TALENT EXODUS - Only trigger if morale/attrition are actually poor
    if (scenario.id === "talent_exodus") {
      const moraleThreshold = 65;
      const attritionThreshold = 12;

      if (
        state.morale >= moraleThreshold &&
        state.attrition < attritionThreshold
      ) {
        // Good performance - change to minor retention challenge
        scenario.description = `Your team is performing well overall (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%). However, one regional sales manager has expressed interest in external opportunities, citing career growth concerns. This is a normal retention challenge, not a crisis. How do you proactively address it?`;

        // Adjust root cause options
        scenario.decisions[0].options = [
          {
            text: "Proactive career development conversations with key performers",
            impact: "development",
            style: "coaching",
            color: "GREEN",
          },
          {
            text: "Review compensation to ensure competitiveness",
            impact: "external",
            style: "authoritative",
            color: "BLUE",
          },
          {
            text: "Create more stretch assignments and growth opportunities",
            impact: "development",
            style: "coaching",
            color: "GREEN",
          },
        ];
      } else if (
        state.morale < moraleThreshold &&
        state.attrition >= attritionThreshold
      ) {
        // Poor performance - keep original crisis scenario but make it clear
        scenario.description = `Your top-performing regional sales manager just resigned, citing "unsustainable pressure and lack of support." Two other high-performers are rumored to be interviewing elsewhere. Team attrition is now at ${Math.round(state.attrition)}% (healthy is <10%) and morale is ${Math.round(state.morale)}% (concerning). You've hit ${state.growth.toFixed(1)}% growth but at what cost? An anonymous employee survey reveals burnout and feeling undervalued.`;
      } else {
        // Mixed performance - moderate scenario
        scenario.description = `A valued regional sales manager has resigned, citing work-life balance concerns. While team morale (${Math.round(state.morale)}%) and attrition (${Math.round(state.attrition)}%) are in acceptable ranges, this departure has raised questions about your leadership approach. How do you respond?`;
      }
    }

    // DIFFICULT CONVERSATION - Adapt severity based on morale
    if (scenario.id === "difficult_conversation") {
      if (state.morale >= 75) {
        // High morale - make it about coaching excellence, not crisis
        scenario.description = `Your team is thriving overall (morale: ${Math.round(state.morale)}%). However, one senior team member (20 years at JCB) is underperforming at 25% below target for two quarters. They're respected and well-liked, but their team's morale is starting to drop. This is about elevating performance, not damage control.`;
      } else if (state.morale < 60) {
        // Low morale - make it a symptom of broader issues
        scenario.description = `Your team morale is at ${Math.round(state.morale)}%, and now a senior team member (20 years at JCB) is underperforming at 25% below target. Others wonder if this is a sign of broader problems. This conversation could be a turning point - will you address only the individual, or the systemic issues?`;
      }
    }

    // AMBIGUOUS SIGNAL - Adapt based on growth trajectory
    if (scenario.id === "ambiguous_signal") {
      if (state.growth > 15) {
        // Strong growth - frame as maintaining momentum
        scenario.description = `Despite strong growth of ${state.growth.toFixed(1)}%, your sales team reports that customer sentiment is "changing" but can't pinpoint why. Sales velocity has slowed 8% month-over-month. You need to address this before it impacts your momentum.

**Sales Director:** "Competitor launched new hydraulic feature we don't have"
**Finance Director:** "Economic uncertainty making buyers delay decisions"
**Your gut:** "Our team's approach has gone stale - we're not listening to customers"

Data is incomplete and contradictory. Your CFO demands immediate action. Your strategy lead wants 3 weeks to research properly.`;
      } else if (state.growth < 10) {
        // Poor growth - frame as critical pivot point
        scenario.description = `Your growth is only ${state.growth.toFixed(1)}%, well below target, and now customer sentiment is "changing." Sales velocity has slowed another 8%. You can't afford to get this wrong.

**Sales Director:** "Competitor launched new hydraulic feature we don't have"
**Finance Director:** "Economic uncertainty making buyers delay decisions"
**Your gut:** "Our team's approach has gone stale - we're not listening to customers"

Data is incomplete. Every week of delay costs £50K in lost sales. What do you do?`;
      }
    }

    // NEW: COMPETITOR THREAT - Adapt based on prior growth achievement
    if (scenario.id === "competitor_threat") {
      if (state.growth > 15) {
        // Strong growth - competitor targets YOUR success
        scenario.description = `You've achieved strong ${state.growth.toFixed(1)}% growth, which has drawn competitive attention. A major competitor just announced aggressive price cuts (15% below JCB) and exclusive dealer incentives. They're specifically targeting YOUR top accounts.

Your Board wants immediate response. You have £400K to allocate. How do you defend your position?`;
      } else if (state.growth < 10) {
        // Poor growth - you're already vulnerable
        scenario.description = `Your growth is struggling at ${state.growth.toFixed(1)}%, and now a major competitor announces aggressive price cuts (15% below JCB) and exclusive dealer incentives. You're already behind - this could be devastating.

Your Board is concerned. You have £400K to allocate. How do you respond?`;
      }
    }

    // NEW: INNOVATION GAMBLE - Adapt based on team capacity (morale/attrition)
    if (scenario.id === "innovation_gamble") {
      if (state.morale > 75 && state.attrition < 10) {
        // Strong team - ready for bold moves
        scenario.description = `Your energized team (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%) has developed a revolutionary hydraulic innovation 9 months ahead of schedule. Market testing shows 40% efficiency gain - unprecedented. Board is thrilled but cautious.

**Engineering:** "Ready now - we've tested it thoroughly"
**Sales:** "Dealers want it immediately"
**Manufacturing:** "12-week delay gives us time to scale properly"
**CFO:** "Early launch = £500K revenue this year, delayed launch = £250K risk if competitor beats us"

Your team has the energy for a sprint. When do you launch?`;
      } else if (state.morale < 65 || state.attrition > 15) {
        // Exhausted team - risky to push them
        scenario.description = `Your exhausted team (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%) has developed a hydraulic innovation that shows promise. Market testing suggests strong potential, but your people are burned out.

**Engineering:** "We can rush it, but we're stretched thin"
**Sales:** "Dealers want it, but honestly, our team needs a break"
**Manufacturing:** "We NEED 12 weeks to do this right and not kill our people"
**CFO:** "Early launch = £500K revenue this year, but if we break the team, what's next year worth?"

Your team is fragile. When do you launch?`;
      }
    }

    // NEW: SAFETY CRISIS - Acknowledge if player has pattern of coercive/pacesetting leadership
    if (scenario.id === "safety_crisis") {
      // Count aggressive decisions in scenarios 1-2
      const priorDecisions = state.decisions.slice(0, 2);
      const aggressiveCount = priorDecisions.filter(
        (d) =>
          d.stylesUsed &&
          (d.stylesUsed.includes("pacesetting") ||
            d.stylesUsed.includes("coercive")),
      ).length;

      if (aggressiveCount >= 2) {
        // Pattern of pressure - make that explicit
        scenario.description = `After months of aggressive targets and pressure to deliver (growth: ${state.growth.toFixed(1)}%), a forklift operator at your Leicester depot suffered serious injuries loading equipment. Initial investigation suggests corners were cut to meet deadlines. HSE is investigating.

Your team is shaken. Some privately wonder if the relentless pace you set contributed to this. What's your response?`;
      }
    }
  }

  loadScenario(scenarioIndex) {
    if (!this.scenarios) {
      console.error("ERROR: Scenarios not loaded!");
      alert("Game error: Scenarios not loaded. Please refresh the page.");
      return;
    }

    if (scenarioIndex >= this.scenarios.length) {
      console.log("All scenarios complete, ending game");
      this.endGame();
      return;
    }

    // Reset submission flag for new scenario
    this.state.isSubmitting = false;

    this.state.currentScenario = scenarioIndex;
    const scenario = this.scenarios[scenarioIndex];

    // Adapt scenario based on current game state
    this.adaptScenarioToState(scenario);

    console.log("Loading scenario:", scenario.id);

    // Scroll to top of scenario container
    const scenarioContainer = document.getElementById("scenario-container");
    if (scenarioContainer) {
      scenarioContainer.scrollTop = 0;
    }

    // Update period
    this.updatePeriod(scenario.month, scenario.quarter);

    // Render scenario
    const container = document.getElementById("scenario-container");
    if (!container) {
      console.error("ERROR: scenario-container not found!");
      return;
    }

    container.innerHTML = this.renderScenario(scenario);

    // Initialize scenario-specific interactions
    this.initScenarioInteractions(scenario);
  }

  renderScenario(scenario) {
    return `
            <div class="scenario-header">
                <h2 class="scenario-title">${scenario.title}</h2>
                <h3 class="scenario-subtitle">${scenario.subtitle}</h3>
            </div>

            <div class="scenario-brief">
                <div class="jcb-logo-small"></div>
                <h4>SCENARIO BRIEFING</h4>
                <div class="scenario-brief-text">
                    <p>${scenario.description}</p>
                </div>
            </div>

            <div class="scenario-content">
                ${this.renderDecisionInterface(scenario)}

                <div class="action-buttons">
                    <button class="btn-primary" onclick="game.submitDecision()">
                        CONFIRM DECISION
                    </button>
                </div>
            </div>
        `;
  }

  renderDecisionInterface(scenario) {
    let html = "";

    scenario.decisions.forEach((decision, index) => {
      html += `
                <div class="decision-interface" data-decision-index="${index}">
                    <h3 class="decision-title">${decision.title}</h3>
                    ${this.renderDecisionType(decision, index)}
                </div>
            `;
    });

    return html;
  }

  renderDecisionType(decision, decisionIndex) {
    switch (decision.type) {
      case "choice":
        return this.renderChoiceOptions(decision.options, decisionIndex);
      case "slider":
        return this.renderSliders(decision.sliders, decisionIndex);
      case "ranking":
        return this.renderRanking(decision.items, decisionIndex);
      case "timeline":
        return this.renderTimeline(decision.options, decisionIndex);
      default:
        return "";
    }
  }

  renderChoiceOptions(options, decisionIndex) {
    let html = '<div class="choice-options">';
    options.forEach((option, i) => {
      html += `
                <div class="choice-option"
                     data-decision="${decisionIndex}"
                     data-option="${i}"
                     onclick="game.selectChoice(${decisionIndex}, ${i})">
                    ${option.text}
                </div>
            `;
    });
    html += "</div>";
    return html;
  }

  // Format a monetary amount expressed in £ millions for display.
  // Sub-£1M amounts are shown in £K (e.g. 0.25 -> "£250K") so that the
  // rescale to a £2M engineering budget reads credibly to executives
  // instead of rounding £250K up to a misleading "£0.3M".
  formatMoney(millions) {
    const value = Number(millions) || 0;
    if (value > 0 && value < 1) {
      return `£${Math.round(value * 1000)}K`;
    }
    return `£${value.toFixed(1)}M`;
  }

  renderSliders(sliders, decisionIndex) {
    let html = '<div class="slider-container">';
    sliders.forEach((slider, i) => {
      html += `
                <div class="slider-item">
                    <div class="slider-label">
                        <span class="slider-name">${slider.label}</span>
                        <span class="slider-value" id="slider-value-${decisionIndex}-${i}">
                            £0M
                        </span>
                    </div>
                    <input type="range"
                           class="slider"
                           min="0"
                           max="${slider.max * SLIDER_SCALE}"
                           value="0"
                           data-decision="${decisionIndex}"
                           data-slider="${i}"
                           oninput="game.updateSlider(${decisionIndex}, ${i}, this.value)">
                </div>
            `;
    });

    if (sliders[0].budgetConstraint) {
      html += `<div class="budget-remaining" id="budget-remaining-${decisionIndex}">
                Budget Remaining: ${this.formatMoney(sliders[0].budgetConstraint)}
            </div>`;
    }

    html += "</div>";
    return html;
  }

  renderRanking(items, decisionIndex) {
    let html = `<div class="ranking-container" id="ranking-container-${decisionIndex}">`;
    items.forEach((item, i) => {
      html += `
                <div class="ranking-item" draggable="true" data-decision="${decisionIndex}" data-item="${i}">
                    <div class="ranking-number">${i + 1}</div>
                    <div class="ranking-text">${item}</div>
                </div>
            `;
    });
    html += "</div>";
    return html;
  }

  renderTimeline(options, decisionIndex) {
    let html = `
            <div class="timeline-slider-container">
                <div class="timeline-labels">
                    ${options
                      .map(
                        (opt, i) => `
                        <div class="timeline-label ${i === 0 ? "active" : ""}" id="timeline-label-${decisionIndex}-${i}">
                            ${opt}
                        </div>
                    `,
                      )
                      .join("")}
                </div>
                <div class="timeline-track">
                    <input type="range"
                           class="slider"
                           min="0"
                           max="${options.length - 1}"
                           value="0"
                           data-decision="${decisionIndex}"
                           oninput="game.updateTimeline(${decisionIndex}, this.value, ${options.length})">
                </div>
            </div>
        `;
    return html;
  }

  initScenarioInteractions(scenario) {
    // Initialize drag and drop for rankings if present
    const rankings = document.querySelectorAll(".ranking-item");
    rankings.forEach((item) => {
      item.addEventListener("dragstart", this.handleDragStart.bind(this));
      item.addEventListener("dragover", this.handleDragOver.bind(this));
      item.addEventListener("drop", this.handleDrop.bind(this));
      item.addEventListener("dragend", this.handleDragEnd.bind(this));
    });
  }

  // Interaction handlers
  selectChoice(decisionIndex, optionIndex) {
    const container = document.querySelector(
      `[data-decision-index="${decisionIndex}"]`,
    );
    if (!container) return;
    container.querySelectorAll(".choice-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    // BUGFIX #3: Do not rely on the deprecated global `window.event`.
    // Select the option element directly by its data-option index.
    const target = container.querySelector(
      `.choice-option[data-option="${optionIndex}"]`,
    );
    if (target) {
      target.classList.add("selected");
    }
  }

  updateSlider(decisionIndex, sliderIndex, value) {
    const scenario = this.scenarios[this.state.currentScenario];
    const decision = scenario.decisions[decisionIndex];

    // Check if budget constraint exists
    if (decision.type === "slider" && decision.sliders[0].budgetConstraint) {
      const budgetLimit = decision.sliders[0].budgetConstraint;
      const sliders = document.querySelectorAll(
        `input.slider[data-decision="${decisionIndex}"]`,
      );
      let total = 0;

      sliders.forEach((slider) => {
        total += parseFloat(slider.value) / SLIDER_SCALE;
      });

      // If this change would exceed the budget, prevent it. The tolerance is
      // half a slider step so floating-point noise never blocks a legal move,
      // while still rejecting any genuine overspend.
      const tolerance = 0.5 / SLIDER_SCALE;
      if (total > budgetLimit + tolerance) {
        // Clamp the moved slider to the exact maximum allowed at this
        // granularity. Because SLIDER_SCALE divides every budget evenly,
        // Math.floor lands exactly on a reachable step (e.g. 0.05) instead of
        // stranding the final increment of headroom.
        const currentSlider = sliders[sliderIndex];
        const maxAllowed =
          budgetLimit - (total - parseFloat(value) / SLIDER_SCALE);
        // The tiny epsilon absorbs floating-point error (e.g. 0.5 - 0.3)
        // so a legal step is never floored away.
        currentSlider.value = Math.floor(maxAllowed * SLIDER_SCALE + 1e-9);
        value = currentSlider.value;
      }
    }

    document.getElementById(
      `slider-value-${decisionIndex}-${sliderIndex}`,
    ).textContent = this.formatMoney(value / SLIDER_SCALE);

    // Update budget if constraint exists
    this.updateBudgetRemaining(decisionIndex);
  }

  updateBudgetRemaining(decisionIndex) {
    const scenario = this.scenarios[this.state.currentScenario];
    const decision = scenario.decisions[decisionIndex];

    if (decision.type === "slider" && decision.sliders[0].budgetConstraint) {
      const sliders = document.querySelectorAll(
        `input.slider[data-decision="${decisionIndex}"]`,
      );
      let total = 0;

      sliders.forEach((slider) => {
        total += parseFloat(slider.value) / SLIDER_SCALE;
      });

      const remaining = decision.sliders[0].budgetConstraint - total;
      const budgetEl = document.getElementById(
        `budget-remaining-${decisionIndex}`,
      );

      // Treat anything within half a step of zero as fully allocated, so
      // floating-point noise never shows a phantom "£0K" underspend.
      const fullyAllocated = Math.abs(remaining) < 0.5 / SLIDER_SCALE;
      if (fullyAllocated) {
        budgetEl.textContent = "Budget Remaining: £0K (Fully allocated)";
      } else if (remaining > 0) {
        budgetEl.textContent = `Budget Remaining: ${this.formatMoney(remaining)} (unallocated)`;
      } else {
        budgetEl.textContent = `Budget Remaining: ${this.formatMoney(remaining)}`;
      }

      if (remaining < -0.5 / SLIDER_SCALE) {
        budgetEl.style.color = "var(--jcb-red)";
      } else if (fullyAllocated) {
        budgetEl.style.color = "var(--jcb-green, #2e7d32)";
      } else {
        budgetEl.style.color = "var(--jcb-yellow)";
      }
    }
  }

  updateTimeline(decisionIndex, value, optionsCount) {
    // Update active label
    for (let i = 0; i < optionsCount; i++) {
      const label = document.getElementById(
        `timeline-label-${decisionIndex}-${i}`,
      );
      if (i === parseInt(value)) {
        label.classList.add("active");
      } else {
        label.classList.remove("active");
      }
    }
  }

  // Drag and drop handlers
  handleDragStart(e) {
    e.target.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.innerHTML);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const dragging = document.querySelector(".dragging");
    const dropTarget = e.target.closest(".ranking-item");

    if (dragging && dropTarget && dragging !== dropTarget) {
      const parent = dragging.parentNode;
      const items = Array.from(parent.children);
      const dragIndex = items.indexOf(dragging);
      const dropIndex = items.indexOf(dropTarget);

      if (dragIndex < dropIndex) {
        parent.insertBefore(dragging, dropTarget.nextSibling);
      } else {
        parent.insertBefore(dragging, dropTarget);
      }

      this.updateRankingNumbers(parent);
    }

    return false;
  }

  handleDragEnd(e) {
    e.target.classList.remove("dragging");
  }

  updateRankingNumbers(container) {
    const items = container.querySelectorAll(".ranking-item");
    items.forEach((item, index) => {
      item.querySelector(".ranking-number").textContent = index + 1;
    });
  }

  requestInfo() {
    const scenario = this.scenarios[this.state.currentScenario];
    if (!scenario.additionalInfo) return;

    const modal = document.getElementById("info-modal");

    // Reset modal to original structure
    const modalContent = modal.querySelector(".modal-content");
    modalContent.innerHTML = `
            <h3>ADDITIONAL INFORMATION</h3>
            <p>Available sources:</p>
            <div id="info-options"></div>
            <div class="modal-actions">
                <button class="btn-primary" onclick="game.confirmInfoRequest()">REQUEST SELECTED</button>
                <button class="btn-secondary" onclick="game.closeInfoModal()">CANCEL</button>
            </div>
        `;

    const optionsContainer = document.getElementById("info-options");
    optionsContainer.innerHTML = scenario.additionalInfo
      .map(
        (info, i) => `
            <div class="info-option" onclick="game.selectInfoOption(${i})">
                <input type="checkbox" id="info-${i}">
                <label for="info-${i}">${info.label}</label>
            </div>
        `,
      )
      .join("");

    modal.classList.add("active");
  }

  selectInfoOption(index) {
    // BUGFIX #4: Do not rely on the deprecated global `window.event`, and
    // avoid double-toggling the checkbox. The checkbox is the single source
    // of truth; the `.selected` class is derived from its checked state.
    const checkbox = document.getElementById(`info-${index}`);
    if (!checkbox) return;
    checkbox.checked = !checkbox.checked;
    const option = checkbox.closest(".info-option");
    if (option) {
      option.classList.toggle("selected", checkbox.checked);
    }
  }

  confirmInfoRequest() {
    const selected = [];
    document.querySelectorAll("#info-options input:checked").forEach((cb) => {
      const index = parseInt(cb.id.split("-")[1]);
      selected.push(index);
    });

    console.log("Selected info requests:", selected);

    if (selected.length === 0) {
      alert("Please select at least one information source.");
      return;
    }

    const scenario = this.scenarios[this.state.currentScenario];
    console.log("Current scenario:", scenario.title);

    this.state.infoRequests.push({
      scenario: this.state.currentScenario,
      requests: selected,
    });

    // Show the actual information content
    let infoContent =
      '<h3>ADDITIONAL INFORMATION</h3><div style="text-align: left;">';
    selected.forEach((index) => {
      const info = scenario.additionalInfo[index];
      console.log("Showing info:", info.label, info.content);
      infoContent += `
                <div style="margin-bottom: 20px; padding: 15px; background: rgba(255, 203, 0, 0.1); border-left: 3px solid var(--jcb-yellow);">
                    <h4 style="color: var(--jcb-yellow); margin-bottom: 10px;">${info.label}</h4>
                    <p style="line-height: 1.6; color: rgba(255, 255, 255, 0.9);">${info.content}</p>
                </div>
            `;
    });
    infoContent += "</div>";

    // Display in modal
    const infoModal = document.getElementById("info-modal");
    const modalContent = infoModal.querySelector(".modal-content");
    modalContent.innerHTML =
      infoContent +
      `
            <div class="modal-actions">
                <button class="btn-primary" onclick="game.closeInfoModal()" style="position: relative; z-index: 9999; pointer-events: auto;">UNDERSTOOD</button>
            </div>
        `;

    console.log("Info modal updated with content");
  }

  closeInfoModal() {
    document.getElementById("info-modal").classList.remove("active");
  }

  closeConsequenceModal() {
    document.getElementById("consequence-modal").classList.remove("active");
  }

  submitDecision() {
    // Prevent multiple submissions
    if (this.state.isSubmitting) {
      console.log("Submission already in progress, ignoring duplicate click");
      return;
    }

    const scenario = this.scenarios[this.state.currentScenario];

    console.log("Submit button clicked for scenario:", scenario.id);
    console.log("Scenario decisions count:", scenario.decisions.length);

    // Validate all decisions have been made
    if (!this.validateAllDecisionsMade(scenario)) {
      console.log("Validation failed: Not all decisions made");
      alert("Please make all decisions before continuing.");
      return;
    }

    console.log("All decisions validated successfully");

    // Validate budget constraints before submitting
    if (!this.validateBudgetConstraints(scenario)) {
      console.log("Validation failed: Budget constraint exceeded");
      alert(
        "You have exceeded the allocated budget. Please adjust your spending allocation.",
      );
      return;
    }

    console.log("Budget constraints validated successfully");

    // Underspend feedback: never block submission, but let the player know
    // money is still on the table so they can choose to allocate it.
    const underspend = this.getUnallocatedBudget(scenario);
    if (underspend > 0) {
      const proceed = confirm(
        `You have ${this.formatMoney(underspend)} unallocated. Submit anyway?`,
      );
      if (!proceed) {
        console.log(
          "Submission cancelled: player chose to allocate remaining budget",
        );
        return;
      }
    }

    // Set submitting flag to prevent duplicate submissions
    this.state.isSubmitting = true;

    const decision = this.collectDecisionData(scenario);

    // Store decision
    this.state.decisions.push(decision);

    // Snapshot metrics BEFORE applying impact so we can show the deltas
    const before = {
      growth: this.state.growth,
      profitMargin: this.state.profitMargin,
      morale: this.state.morale,
      attrition: this.state.attrition,
      organizationalCapability: this.state.organizationalCapability,
    };

    // Calculate impacts
    this.applyDecisionImpact(scenario, decision);

    // Compute the deltas this decision produced
    const deltas = {
      growth: this.state.growth - before.growth,
      profitMargin: this.state.profitMargin - before.profitMargin,
      morale: this.state.morale - before.morale,
      attrition: this.state.attrition - before.attrition,
      organizationalCapability:
        this.state.organizationalCapability - before.organizationalCapability,
    };

    // Update HUD with animated deltas
    this.updateHUD(deltas);

    // Show consequence with the impact card
    this.showConsequence(scenario, decision, deltas);
  }

  validateAllDecisionsMade(scenario) {
    // Check each decision to ensure it has been made
    for (
      let decisionIndex = 0;
      decisionIndex < scenario.decisions.length;
      decisionIndex++
    ) {
      const decision = scenario.decisions[decisionIndex];

      console.log(
        `Checking decision ${decisionIndex}: ${decision.title}, type: ${decision.type}`,
      );

      switch (decision.type) {
        case "choice":
          const selected = document.querySelector(
            `.choice-option.selected[data-decision="${decisionIndex}"]`,
          );
          if (!selected) {
            console.log(
              `Decision ${decisionIndex} (${decision.title}) - NO SELECTION FOUND`,
            );
            return false;
          }
          console.log(`Decision ${decisionIndex} - Choice selected`);
          break;

        case "slider":
          // Sliders have default values, so they're always "made"
          console.log(`Decision ${decisionIndex} - Slider (auto-valid)`);
          break;

        case "ranking":
          // Rankings are pre-populated, so they're always "made"
          console.log(`Decision ${decisionIndex} - Ranking (auto-valid)`);
          break;

        case "timeline":
          // Timeline sliders have default values, so they're always "made"
          console.log(`Decision ${decisionIndex} - Timeline (auto-valid)`);
          break;
      }
    }

    return true;
  }

  // Returns the total unallocated budget (in £M) across all slider decisions
  // in the scenario. Used purely for non-blocking underspend feedback.
  getUnallocatedBudget(scenario) {
    let unallocated = 0;

    for (
      let decisionIndex = 0;
      decisionIndex < scenario.decisions.length;
      decisionIndex++
    ) {
      const decision = scenario.decisions[decisionIndex];

      if (decision.type === "slider" && decision.sliders[0].budgetConstraint) {
        const sliders = document.querySelectorAll(
          `input.slider[data-decision="${decisionIndex}"]`,
        );
        let total = 0;

        sliders.forEach((slider) => {
          total += parseFloat(slider.value) / SLIDER_SCALE;
        });

        const remaining = decision.sliders[0].budgetConstraint - total;
        // Ignore sub-step floating-point noise.
        if (remaining > 0.5 / SLIDER_SCALE) {
          unallocated += remaining;
        }
      }
    }

    return unallocated;
  }

  validateBudgetConstraints(scenario) {
    // Check all slider-based decisions for budget constraints
    for (
      let decisionIndex = 0;
      decisionIndex < scenario.decisions.length;
      decisionIndex++
    ) {
      const decision = scenario.decisions[decisionIndex];

      if (decision.type === "slider" && decision.sliders[0].budgetConstraint) {
        const sliders = document.querySelectorAll(
          `input.slider[data-decision="${decisionIndex}"]`,
        );
        let total = 0;

        sliders.forEach((slider) => {
          total += parseFloat(slider.value) / SLIDER_SCALE;
        });

        const budgetLimit = decision.sliders[0].budgetConstraint;

        console.log(
          `Budget validation - Decision ${decisionIndex}: total = ${total.toFixed(2)}, limit = ${budgetLimit}`,
        );

        // Allow half a slider step of margin for floating point errors.
        // Overspend beyond that is still rejected.
        if (total > budgetLimit + 0.5 / SLIDER_SCALE) {
          return false;
        }
      }
    }

    return true;
  }

  collectDecisionData(scenario) {
    const data = {
      scenario: this.state.currentScenario,
      timestamp: Date.now(),
      choices: [],
    };

    // Attach info requests for this scenario
    const scenarioInfoRequests = this.state.infoRequests.find(
      (ir) => ir.scenario === this.state.currentScenario,
    );
    if (
      scenarioInfoRequests &&
      scenarioInfoRequests.requests &&
      scenarioInfoRequests.requests.length > 0
    ) {
      data.infoRequested = scenarioInfoRequests.requests.map(
        (index) => scenario.additionalInfo[index],
      );
    }

    scenario.decisions.forEach((decision, index) => {
      switch (decision.type) {
        case "choice":
          const selected = document.querySelector(
            `.choice-option.selected[data-decision="${index}"]`,
          );
          data.choices.push({
            type: "choice",
            index: selected ? parseInt(selected.dataset.option) : -1,
          });
          break;

        case "slider":
          const sliders = document.querySelectorAll(
            `input.slider[data-decision="${index}"]`,
          );
          const values = Array.from(sliders).map(
            (s) => parseFloat(s.value) / SLIDER_SCALE,
          );
          data.choices.push({
            type: "slider",
            values: values,
          });
          break;

        case "ranking":
          const items = document.querySelectorAll(
            `.ranking-item[data-decision="${index}"]`,
          );
          const ranking = Array.from(items).map((item) =>
            parseInt(item.dataset.item),
          );
          data.choices.push({
            type: "ranking",
            order: ranking,
          });
          break;

        case "timeline":
          const timeline = document.querySelector(
            `input.slider[data-decision="${index}"]`,
          );
          data.choices.push({
            type: "timeline",
            value: parseInt(timeline.value),
          });
          break;
      }
    });

    return data;
  }

  applyDecisionImpact(scenario, decision) {
    // This will use the scoring engine to calculate impact
    if (window.scoringEngine) {
      const impact = scoringEngine.calculateDecisionImpact(
        scenario,
        decision,
        this.state,
      );

      // BUGFIX 2026-05-17: Calculate organizational capability impact BEFORE storing
      // So it can be displayed in decision-by-decision feedback (like growth, morale, etc.)
      let capabilityGain = 0;

      // Calculate from leadership styles (coaching/democratic/affiliative)
      // BALANCING 2026-05-17: Reduced multipliers by 90% to prevent excessive accumulation
      // Goal: 6 coaching scenarios (18 parts) should give ~90 points (starting 75 + 90 = 165, just above 150 threshold)
      if (impact.leadershipStyles) {
        Object.keys(impact.leadershipStyles).forEach((style) => {
          if (style === "coaching") {
            capabilityGain += impact.leadershipStyles[style] * 0.25; // Was 2.5 (10x reduction)
          } else if (style === "democratic") {
            capabilityGain += impact.leadershipStyles[style] * 0.15; // Was 1.5 (10x reduction)
          } else if (style === "affiliative") {
            capabilityGain += impact.leadershipStyles[style] * 0.1; // Was 1.0 (10x reduction)
          }
        });
      }

      // Add explicit capability bonuses from specific decisions (training programs, etc.)
      if (impact.organizationalCapability) {
        capabilityGain += impact.organizationalCapability;
      }

      // Store total capability gain in impact object for display
      if (capabilityGain > 0) {
        impact.organizationalCapability = capabilityGain;
      }

      // Store the impact details with the decision for feedback later
      decision.impact = impact;
      decision.scenarioTitle = scenario.title;
      decision.scenarioId = scenario.id;

      // Extract style and color info from decisions
      decision.stylesUsed = [];
      decision.colorsUsed = [];

      scenario.decisions.forEach((decisionDef, index) => {
        const choice = decision.choices[index];

        if (decisionDef.type === "choice" && choice.index >= 0) {
          const option = decisionDef.options[choice.index];
          if (option) {
            if (option.style) decision.stylesUsed.push(option.style);
            if (option.color) decision.colorsUsed.push(option.color);
          }
        } else if (
          decisionDef.type === "timeline" &&
          choice.value !== undefined
        ) {
          if (
            decisionDef.styleMapping &&
            decisionDef.styleMapping[choice.value]
          ) {
            decision.stylesUsed.push(decisionDef.styleMapping[choice.value]);
          }
          if (
            decisionDef.colorMapping &&
            decisionDef.colorMapping[choice.value]
          ) {
            decision.colorsUsed.push(decisionDef.colorMapping[choice.value]);
          }
        }
      });

      // Apply impacts to state
      this.state.growth += impact.growth || 0;
      this.state.profitMargin += impact.profitMargin || 0;
      this.state.morale += impact.morale || 0;
      this.state.attrition += impact.attrition || 0;

      // REALISM CHECK: High attrition should damage remaining team morale
      // If attrition is high, it creates anxiety and reduces morale of those who remain
      // MORALE REBALANCE: Threshold lowered from 12% to 8% and multiplier raised from 0.5
      // to 0.8, so a talent exodus now visibly drags morale down instead of being absorbed.
      if (this.state.attrition > 8) {
        const attritionMoralePenalty = Math.floor(
          (this.state.attrition - 8) * 0.8,
        );
        this.state.morale -= attritionMoralePenalty;
        console.log(
          `High attrition (${this.state.attrition.toFixed(0)}%) reduced morale by ${attritionMoralePenalty}%`,
        );
      }

      // Similarly, very high morale should reduce attrition somewhat
      // MORALE REBALANCE: Threshold lowered from 80% to 75% so the retention benefit is
      // reachable, but the multiplier is kept low (0.1) so it cannot fully offset attrition.
      if (this.state.morale > 75 && this.state.attrition > 0) {
        const moraleRetentionBonus = Math.floor((this.state.morale - 75) * 0.1);
        this.state.attrition -= moraleRetentionBonus;
        console.log(
          `High morale (${this.state.morale.toFixed(0)}%) reduced attrition by ${moraleRetentionBonus}%`,
        );
      }

      // MORALE DRIFT: Teams naturally regress toward a baseline culture over time.
      // Without this, morale only ever ratchets upward (positive impacts outnumber and
      // outweigh negative ones), which is why morale previously stayed pinned near 100.
      // A neutral team drifts toward 60; a strong culture (high capability) drifts toward 70.
      const moraleBaseline =
        this.state.organizationalCapability >= 150 ? 70 : 60;
      if (this.state.morale > moraleBaseline) {
        const drift = Math.max(
          1,
          Math.round((this.state.morale - moraleBaseline) * 0.08),
        );
        this.state.morale -= drift;
        console.log(
          `Morale drift toward baseline ${moraleBaseline}: -${drift} (now ${this.state.morale.toFixed(0)})`,
        );
      }

      // PROFIT MARGIN REALISM: Link to attrition, morale, and growth
      // High attrition costs money (recruitment, training, knowledge loss)
      if (this.state.attrition > 15) {
        const attritionProfitPenalty = (this.state.attrition - 15) * 0.3;
        this.state.profitMargin -= attritionProfitPenalty;
        console.log(
          `High attrition (${this.state.attrition.toFixed(0)}%) reduced profit margin by ${attritionProfitPenalty.toFixed(1)}%`,
        );
      }

      // Low morale reduces productivity and profit
      if (this.state.morale < 60) {
        const moraleProfitPenalty = (60 - this.state.morale) * 0.2;
        this.state.profitMargin -= moraleProfitPenalty;
        console.log(
          `Low morale (${this.state.morale.toFixed(0)}%) reduced profit margin by ${moraleProfitPenalty.toFixed(1)}%`,
        );
      }

      // High growth can improve profit margin (economies of scale)
      if (this.state.growth > 25) {
        const growthProfitBonus = (this.state.growth - 25) * 0.15;
        this.state.profitMargin += growthProfitBonus;
        console.log(
          `High growth (${this.state.growth.toFixed(1)}%) improved profit margin by ${growthProfitBonus.toFixed(1)}%`,
        );
      }

      // Update leadership style tracking
      // BUGFIX #5: Cap each leadership style at 150 to prevent unbounded accumulation
      if (impact.leadershipStyles) {
        Object.keys(impact.leadershipStyles).forEach((style) => {
          this.state.leadershipStyles[style] += impact.leadershipStyles[style];
          this.state.leadershipStyles[style] = Math.min(
            150,
            this.state.leadershipStyles[style],
          );
        });
      }

      // Apply organizational capability (already calculated above and stored in impact.organizationalCapability)
      // BUGFIX #6: Cap organizational capability at 250 to prevent unbounded accumulation
      if (impact.organizationalCapability) {
        this.state.organizationalCapability += impact.organizationalCapability;
        this.state.organizationalCapability = Math.min(
          250,
          this.state.organizationalCapability,
        );
      }

      // Update quality metrics
      this.state.leadership += impact.leadership || 0;
      this.state.excellence += impact.excellence || 0;
      this.state.agility += impact.agility || 0;
      this.state.determination += impact.determination || 0;

      // CRITICAL FIX #2: Handle Delayed Payoffs
      // Strategic investments (R&D, dealer relationships) tracked for future benefit
      if (impact.delayedGrowth) {
        // BUGFIX #1: impact.delayedGrowth is an object {amount, triggerScenario}.
        // Extract the raw numeric .amount (previously the whole object was stored,
        // which caused NaN when summed later).
        const delayedAmount =
          typeof impact.delayedGrowth === "object"
            ? impact.delayedGrowth.amount
            : impact.delayedGrowth;
        const delayedTrigger =
          typeof impact.delayedGrowth === "object" &&
          impact.delayedGrowth.triggerScenario
            ? impact.delayedGrowth.triggerScenario
            : this.state.currentScenario + 2; // Default: 2 scenarios later

        // BUGFIX #8: Guard against NaN propagation from malformed delayed growth data
        if (!isNaN(delayedAmount) && delayedAmount > 0) {
          this.state.delayedGrowthPayoffs.push({
            amount: delayedAmount,
            triggerScenario: delayedTrigger,
          });
          console.log(
            `📅 Delayed growth payoff scheduled: +${delayedAmount}% growth at scenario ${delayedTrigger}`,
          );
        } else {
          console.warn(
            "⚠️ Ignored invalid delayed growth payoff (NaN or non-positive):",
            impact.delayedGrowth,
          );
        }
      }

      // Apply any delayed payoffs that trigger at current scenario
      const currentScenario = this.state.currentScenario;
      const payoffsToApply = this.state.delayedGrowthPayoffs.filter(
        (p) => p.triggerScenario <= currentScenario,
      );

      if (payoffsToApply.length > 0) {
        const totalDelayedGrowth = payoffsToApply.reduce(
          (sum, p) => sum + p.amount,
          0,
        );
        this.state.growth += totalDelayedGrowth;
        console.log(
          `✅ STRATEGIC INVESTMENT PAYOFF: +${totalDelayedGrowth.toFixed(1)}% growth from prior R&D/dealer investments`,
        );

        // Remove applied payoffs
        this.state.delayedGrowthPayoffs =
          this.state.delayedGrowthPayoffs.filter(
            (p) => p.triggerScenario > currentScenario,
          );
      }

      // BUGFIX #2/#3: Bounds checking MUST run after ALL secondary effects above
      // (attrition->morale, morale->attrition, attrition->profit, morale->profit,
      // growth->profit, style/capability/LEAD accumulation) so that no secondary
      // effect can push a metric outside its hard limits.
      // Bounds checking for visible metrics
      this.state.morale = Math.max(0, Math.min(100, this.state.morale));
      this.state.attrition = Math.max(0, Math.min(100, this.state.attrition));

      // BUGFIX #4: Cap LEAD dimensions at 250 (previously only floored at 0, so they
      // could grow unbounded / toward infinity).
      this.state.leadership = Math.max(0, Math.min(250, this.state.leadership));
      this.state.excellence = Math.max(0, Math.min(250, this.state.excellence));
      this.state.agility = Math.max(0, Math.min(250, this.state.agility));
      this.state.determination = Math.max(
        0,
        Math.min(250, this.state.determination),
      );

      // Profit margin should have reasonable bounds (can't be <0 or >100)
      this.state.profitMargin = Math.max(
        0,
        Math.min(100, this.state.profitMargin),
      );
    }
  }

  applyLEADMultipliers() {
    // CRITICAL FIX: LEAD competencies should amplify business outcomes
    // AND poor LEAD competencies should penalize outcomes (unsustainable approaches)

    // Calculate LEAD performance ratios vs benchmarks
    // BENCHMARKS UPDATED 2026-05-16: Set to realistic values based on actual maximum achievable points
    // These represent "good but not perfect" performance (~70% of maximum per scenario)
    // BUGFIX (audit): These benchmarks MUST match calculateFinalScore() exactly.
    // The game plays 9 scenarios, and calculateFinalScore() uses per-scenario
    // benchmarks of 19/19/19/19. Previously this method used avgScenarios = 6 and
    // benchmarks of 25/35/15/20, which inflated every LEAD ratio by ~1.5x. That made
    // the "poor LEAD" penalties almost unreachable and the bonuses fire too easily,
    // so the in-game multipliers disagreed with the win conditions.
    const benchmarks = {
      leadership: 19,
      excellence: 19,
      agility: 19,
      determination: 19,
    };
    // Round-aware divisor: Round 1 plays 9 scenarios, Round 2 plays 6. Using 9
    // for a Round 2 run would deflate every LEAD ratio by ~33% and mis-fire the
    // in-game multipliers (and disagree with calculateFinalScore's win checks).
    const avgScenarios = this.state && this.state.round === 2 ? 6 : 9;

    const leadRatios = {
      leadership: this.state.leadership / avgScenarios / benchmarks.leadership,
      excellence: this.state.excellence / avgScenarios / benchmarks.excellence,
      agility: this.state.agility / avgScenarios / benchmarks.agility,
      determination:
        this.state.determination / avgScenarios / benchmarks.determination,
    };

    // Calculate average LEAD quality (across all 4 dimensions)
    const avgLEADRatio =
      (leadRatios.leadership +
        leadRatios.excellence +
        leadRatios.agility +
        leadRatios.determination) /
      4;

    console.log("=== LEAD MULTIPLIERS & PENALTIES ===");
    console.log(
      `Leadership ratio: ${leadRatios.leadership.toFixed(2)} (${(this.state.leadership / avgScenarios).toFixed(0)} vs ${benchmarks.leadership})`,
    );
    console.log(
      `Excellence ratio: ${leadRatios.excellence.toFixed(2)} (${(this.state.excellence / avgScenarios).toFixed(0)} vs ${benchmarks.excellence})`,
    );
    console.log(
      `Agility ratio: ${leadRatios.agility.toFixed(2)} (${(this.state.agility / avgScenarios).toFixed(0)} vs ${benchmarks.agility})`,
    );
    console.log(
      `Determination ratio: ${leadRatios.determination.toFixed(2)} (${(this.state.determination / avgScenarios).toFixed(0)} vs ${benchmarks.determination})`,
    );
    console.log(`Average LEAD quality: ${avgLEADRatio.toFixed(2)}`);

    // BONUSES: Apply LEAD-based multipliers to business outcomes
    // UPDATED 2026-05-17: Reduced by 75% to ensure realistic outcomes

    // 1. DETERMINATION drives GROWTH (determined leaders push for results)
    if (leadRatios.determination > 0.8) {
      const determinationBonus = (leadRatios.determination - 0.8) * 2; // REDUCED from 8 to 2 (max +2% growth)
      this.state.growth += determinationBonus;
      console.log(
        `✅ Determination bonus: +${determinationBonus.toFixed(1)}% growth`,
      );
    }

    // 2. LEADERSHIP quality improves MORALE (people follow great leaders)
    if (leadRatios.leadership > 0.8) {
      const leadershipMoraleBonus = (leadRatios.leadership - 0.8) * 3; // REDUCED from 10 to 3 (max +3% morale)
      this.state.morale += leadershipMoraleBonus;
      console.log(
        `✅ Leadership morale bonus: +${leadershipMoraleBonus.toFixed(1)}% morale`,
      );
    }

    // 3. EXCELLENCE reduces ATTRITION (good decision-making retains talent)
    if (leadRatios.excellence > 0.8) {
      const excellenceRetention = (leadRatios.excellence - 0.8) * 2; // REDUCED from 5 to 2 (max -2% attrition)
      this.state.attrition -= excellenceRetention;
      console.log(
        `✅ Excellence retention: -${excellenceRetention.toFixed(1)}% attrition`,
      );
    }

    // 4. AGILITY improves PROFIT MARGIN (adaptability optimizes operations)
    if (leadRatios.agility > 0.8) {
      const agilityProfitBonus = (leadRatios.agility - 0.8) * 1; // REDUCED from 3 to 1 (max +1% profit margin)
      this.state.profitMargin += agilityProfitBonus;
      console.log(
        `✅ Agility profit bonus: +${agilityProfitBonus.toFixed(1)}% profit margin`,
      );
    }

    // NEW: PENALTIES for poor LEAD quality (enforcement mechanism)
    // If average LEAD ratio < 0.5 (significantly below benchmark), apply sustainability penalties

    if (avgLEADRatio < 0.5) {
      // Poor leadership quality causes compounding problems
      const leadDeficit = 0.5 - avgLEADRatio; // How far below 50% of benchmark

      console.log(
        `⚠️ LOW LEAD QUALITY DETECTED (${(avgLEADRatio * 100).toFixed(0)}% of benchmark)`,
      );

      // Penalty 1: Attrition increases (poor leadership drives talent away)
      const attritionPenalty = leadDeficit * 12; // Up to +6% attrition if LEAD ratio is 0
      this.state.attrition += attritionPenalty;
      console.log(
        `❌ Poor leadership attrition penalty: +${attritionPenalty.toFixed(1)}% attrition`,
      );

      // Penalty 2: Morale decreases (people feel the pressure/lack of support)
      const moralePenalty = leadDeficit * 16; // Up to -8% morale
      this.state.morale -= moralePenalty;
      console.log(
        `❌ Poor leadership morale penalty: -${moralePenalty.toFixed(1)}% morale`,
      );

      // Penalty 3: Growth degrades (unsustainable approaches fail to compound)
      // Even if you hit targets early, poor LEAD quality means execution degrades
      const growthPenalty = leadDeficit * 10; // Up to -5% growth
      this.state.growth -= growthPenalty;
      console.log(
        `❌ Unsustainable execution penalty: -${growthPenalty.toFixed(1)}% growth`,
      );

      // Penalty 4: Profit margin suffers (firefighting, inefficiency, mistakes)
      const profitPenalty = leadDeficit * 6; // Up to -3% profit margin
      this.state.profitMargin -= profitPenalty;
      console.log(
        `❌ Poor decision quality penalty: -${profitPenalty.toFixed(1)}% profit margin`,
      );
    }

    // NEW: SEVERE PENALTIES for extremely poor LEAD quality (< 0.3 of benchmark)
    if (avgLEADRatio < 0.3) {
      // This represents truly terrible leadership - near-certain failure
      console.log(
        `⚠️ EXTREMELY POOR LEAD QUALITY (${(avgLEADRatio * 100).toFixed(0)}% of benchmark) - SEVERE PENALTIES`,
      );

      // Additional attrition from toxic environment
      this.state.attrition += 8;
      console.log(`❌ Toxic environment attrition: +8% attrition`);

      // Additional morale collapse
      this.state.morale -= 12;
      console.log(`❌ Leadership crisis morale collapse: -12% morale`);
    }

    // CRITICAL FIX #1: Team Health Multipliers (from AUDIT #4)
    // High-performing teams with strong morale and low attrition deliver superior results
    // This makes team health strategically valuable (fixes "balanced leader fails" bug)

    console.log("=== APPLYING TEAM HEALTH MULTIPLIERS ===");
    console.log(
      `Pre-multiplier - Growth: ${this.state.growth.toFixed(1)}%, Morale: ${this.state.morale.toFixed(0)}%, Attrition: ${this.state.attrition.toFixed(1)}%`,
    );

    // Apply caps BEFORE multipliers to get accurate team health state
    let cappedMorale = Math.max(0, Math.min(95, this.state.morale));
    let cappedAttrition = Math.max(5, Math.min(100, this.state.attrition));

    // Check for exceptional team health (high morale + low attrition)
    if (cappedMorale >= 85 && cappedAttrition < 8) {
      // High-performing teams deliver 35% more results due to:
      // - Discretionary effort from engaged employees
      // - Lower friction/coordination costs
      // - Knowledge retention and compound learning
      const teamHealthMultiplier = 1.35;
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * teamHealthMultiplier;
      console.log(
        `✅ EXCEPTIONAL TEAM HEALTH: ${teamHealthMultiplier}x growth multiplier (+${(this.state.growth - growthBefore).toFixed(1)}% growth)`,
      );
      console.log(
        `   Morale: ${cappedMorale}% (≥85%), Attrition: ${cappedAttrition.toFixed(1)}% (<8%)`,
      );
    } else if (cappedMorale >= 75 && cappedAttrition < 12) {
      // Healthy teams deliver 15% more results
      const teamHealthMultiplier = 1.15;
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * teamHealthMultiplier;
      console.log(
        `✅ Healthy team multiplier: ${teamHealthMultiplier}x growth (+${(this.state.growth - growthBefore).toFixed(1)}% growth)`,
      );
    }

    // CRITICAL FIX #4: Attrition Mechanically Constrains Growth
    // You cannot grow revenue with no employees (fixes "100% attrition wins" bug)
    if (cappedAttrition > 50) {
      // Severe talent hemorrhage prevents execution
      const attritionDrag = 0.5; // 50% reduction in growth capability
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * attritionDrag;
      console.log(
        `❌ SEVERE ATTRITION PENALTY: ${cappedAttrition.toFixed(1)}% attrition → 50% growth reduction (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`,
      );
    } else if (cappedAttrition > 30) {
      // High attrition creates execution gaps
      const attritionDrag = 0.75; // 25% reduction in growth capability
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * attritionDrag;
      console.log(
        `❌ High attrition penalty: ${cappedAttrition.toFixed(1)}% attrition → 25% growth reduction (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`,
      );
    }

    // Check for team collapse (morale <40% OR attrition >40%)
    if (cappedMorale < 40 || cappedAttrition > 40) {
      // Team collapse: Organization in crisis, execution severely impaired
      const crisisMultiplier = 0.5; // 50% reduction in growth
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * crisisMultiplier;
      console.log(
        `❌ TEAM COLLAPSE: ${crisisMultiplier}x growth multiplier (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`,
      );
      console.log(
        `   Morale: ${cappedMorale}% (<40%), Attrition: ${cappedAttrition.toFixed(1)}% (>40%)`,
      );
    }

    // CRITICAL FIX #3: Morale Cap Waste → Productivity Bonus
    // Excess morale above 95% converts to productivity (fixes "wasted people investment" bug)
    // Every 10 points of excess morale = 1% additional growth
    if (this.state.morale > 95) {
      const excessMorale = this.state.morale - 95;
      const productivityBonus = excessMorale * 0.1; // 10 morale = 1% growth
      this.state.growth += productivityBonus;
      console.log(
        `✅ Excess morale productivity bonus: ${excessMorale.toFixed(0)} excess morale → +${productivityBonus.toFixed(1)}% growth`,
      );
    }

    // Re-apply bounds after multipliers and penalties
    // UPDATED 2026-05-17: Realistic caps for executive credibility
    this.state.morale = Math.max(0, Math.min(95, this.state.morale)); // Cap at 95% - 100% morale is impossible
    this.state.attrition = Math.max(5, Math.min(100, this.state.attrition)); // Minimum 5% - natural turnover (retirement, relocation, etc.)
    this.state.profitMargin = Math.max(
      0,
      Math.min(100, this.state.profitMargin),
    );
    this.state.growth = Math.max(0, this.state.growth); // Growth can't go negative but no upper cap

    console.log("=== FINAL METRICS AFTER LEAD MULTIPLIERS ===");
    console.log(`Growth: ${this.state.growth.toFixed(1)}%`);
    console.log(`Morale: ${this.state.morale.toFixed(0)}%`);
    console.log(`Attrition: ${this.state.attrition.toFixed(1)}%`);
    console.log(`Profit Margin: ${this.state.profitMargin.toFixed(1)}%`);
  }

  showConsequence(scenario, decision, deltas) {
    const modal = document.getElementById("consequence-modal");
    const textEl = document.getElementById("consequence-text");

    // Get consequence text from scenario
    const consequenceText =
      scenario.consequenceText ||
      "Your decision has been recorded. The situation evolves...";

    // Build the cinematic impact strip from the deltas.
    // BUGFIX (audit): previously any delta below 0.05 was silently DROPPED, so a
    // decision that moved growth by a small amount (or where two effects cancelled)
    // appeared to have "no growth impact" - which players found disjointed and
    // untrustworthy. We now ALWAYS render all five metrics, showing "0" with a
    // neutral style when there is no meaningful change, so the full picture is
    // visible at a glance.
    const impactItems = [];
    const pushImpact = (label, value, unit, decimals, invert) => {
      const v = typeof value === "number" && isFinite(value) ? value : 0;
      const negligible = Math.abs(v) < 0.05;
      const isGood = invert ? v < 0 : v > 0;
      const cls = negligible ? "neutral" : isGood ? "good" : "bad";
      const sign = v > 0 ? "+" : "";
      const shown = negligible ? "0" : `${sign}${v.toFixed(decimals)}`;
      impactItems.push(
        `<div class="impact-chip ${cls}">
                    <span class="impact-label">${label}</span>
                    <span class="impact-value">${shown}${unit}</span>
                </div>`,
      );
    };

    if (deltas) {
      pushImpact("Growth", deltas.growth, "%", 1, false);
      pushImpact("Profit", deltas.profitMargin, "%", 0, false);
      pushImpact("Morale", deltas.morale, "%", 0, false);
      pushImpact("Attrition", deltas.attrition, "%", 0, true);
      pushImpact(
        "Capability",
        deltas.organizationalCapability,
        " pts",
        0,
        false,
      );
    }

    const impactStrip =
      impactItems.length > 0
        ? `<div class="impact-strip">${impactItems.join("")}</div>`
        : "";

    // Render the impact card into the modal body
    const bodyEl = document.getElementById("consequence-body");
    if (bodyEl) {
      bodyEl.innerHTML = `
                <div class="impact-card">
                    <div class="impact-card-header">DECISION RECORDED</div>
                    <p class="impact-consequence">${consequenceText}</p>
                    ${impactStrip}
                </div>
            `;
    } else {
      // Fallback to the plain text element if the body container is absent
      textEl.textContent = consequenceText;
    }

    modal.classList.add("active");

    // Auto-continue after 5 seconds
    let countdown = 5;
    const timerEl = document.getElementById("consequence-timer");
    timerEl.textContent = countdown;

    const countdownInterval = setInterval(() => {
      countdown--;
      timerEl.textContent = countdown;

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.skipConsequence();
      }
    }, 1000);

    this.consequenceInterval = countdownInterval;
  }

  skipConsequence() {
    // If the game already ended (e.g. the timer expired while this modal was
    // open), do nothing - advancing the scenario counter now would corrupt the
    // finished game state.
    if (this.state.gameEnded) {
      return;
    }

    if (this.consequenceInterval) {
      clearInterval(this.consequenceInterval);
      this.consequenceInterval = null;
    }

    document.getElementById("consequence-modal").classList.remove("active");

    // Reset submitting flag to allow next scenario submission
    this.state.isSubmitting = false;

    // Move to next scenario
    this.state.currentScenario++;

    if (this.state.currentScenario < this.scenarios.length) {
      this.loadScenario(this.state.currentScenario);
    } else {
      this.endGame();
    }
  }

  endGame() {
    // Re-entrancy guard: endGame() can be reached from BOTH the timer expiring
    // AND the final scenario completing. Without this guard the results screen
    // (and the leaderboard write in showFeedback) could run twice.
    if (this.state.gameEnded) {
      return;
    }
    this.state.gameEnded = true;

    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }

    // If the timer expired while the consequence modal was open, tear it down.
    // Otherwise the modal would sit on top of the results screen and its
    // 5-second countdown would later call skipConsequence(), advancing the
    // scenario counter and corrupting the finished game state.
    if (this.consequenceInterval) {
      clearInterval(this.consequenceInterval);
      this.consequenceInterval = null;
    }
    const consequenceModal = document.getElementById("consequence-modal");
    if (consequenceModal) {
      consequenceModal.classList.remove("active");
    }

    this.showResults();
  }

  showResults() {
    this.showScreen("results-screen");

    // CRITICAL: Apply LEAD multipliers BEFORE calculating final score
    // This ensures LEAD competencies actually impact business outcomes
    this.applyLEADMultipliers();

    // Calculate final results using scoring engine
    if (window.scoringEngine) {
      console.log("Calculating final results...");
      try {
        // Pass the Round 1 record (if any) so the scoring engine can compute
        // the Round 2 adaptation bonus. Round 1 runs pass null and are unaffected.
        const results = scoringEngine.calculateFinalScore(
          this.state,
          this.returningPlayer || null,
        );
        console.log("Results calculated:", results);
        this.finalResults = results; // Store for detailed feedback view
        console.log("this.finalResults set to:", this.finalResults);
        this.displayResults(results);
      } catch (error) {
        console.error("ERROR in calculateFinalScore:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        alert("Error calculating results: " + error.message);
      }
    } else {
      console.error("CRITICAL: window.scoringEngine is not defined!");
      alert("Error: Scoring engine not loaded. Please refresh the page.");
    }
  }

  displayResults(results) {
    // Reveal the executive-summary download button now that results exist.
    const execBtn = document.getElementById("download-exec-summary-btn");
    if (execBtn) execBtn.style.display = "";

    // Reveal the individual-feedback PDF button for consistency.
    const feedbackPdfBtn = document.getElementById("download-feedback-pdf-btn");
    if (feedbackPdfBtn) feedbackPdfBtn.style.display = "";

    // Animate metrics counting up (tightened for the time constraint)
    setTimeout(() => {
      this.animateResultsReveal(results);
    }, 900);
  }

  /**
   * Build and download the round-aware executive summary for the current run.
   *
   * Instantiates ExecutiveSummaryGenerator, passes the current player data,
   * game state and results (plus the round and the prior Round 1 record so the
   * Round 1 vs Round 2 awareness-change section can be produced), then triggers
   * a browser download of the generated HTML via a Blob + temporary anchor.
   *
   * Safe to call for Round 1 runs, Round 2 runs with a prior Round 1 record,
   * and Round 2 runs without one.
   */
  downloadExecutiveSummary() {
    try {
      if (!this.finalResults) {
        alert("No results available yet. Complete the simulation first.");
        return;
      }
      if (typeof ExecutiveSummaryGenerator === "undefined") {
        alert("Executive summary generator is not loaded.");
        return;
      }

      const generator = new ExecutiveSummaryGenerator();

      // Round 2 runs pass the prior Round 1 record (already resolved by
      // findReturningPlayer during startRound) so the awareness-change section
      // can be built. Round 1 runs pass null.
      const priorRound1Record =
        this.state && this.state.round === 2
          ? this.returningPlayer || null
          : null;

      const report = generator.generateSummary(
        {
          name: this.state.playerName,
          jobFunction: this.state.jobFunction,
          seniority: this.state.seniority,
        },
        this.state,
        this.finalResults,
        {
          round: this.state.round,
          priorRound1Record: priorRound1Record,
          // Reuse the engine's cohort store rather than inventing a new one.
          cultureDataProvider: () => this.getCultureData(),
        },
      );

      // Trigger a browser download of the combined report.
      const html = report.combined || report.summary || "";
      const baseFilename = report.filename || "JCB_Leadership_Assessment.pdf";

      // Prefer a real PDF when the offline SimplePDF writer is available.
      // Fall back to the original HTML download so the button never breaks.
      let blob;
      let downloadName;
      if (window.SimplePDF && typeof window.SimplePDF.fromHTML === "function") {
        blob = window.SimplePDF.fromHTML(html, {
          title: "JCB Leadership Assessment",
          subtitle:
            "Executive Summary — Round " +
            ((this.state && this.state.round) || 1),
        });
        downloadName = baseFilename.replace(/\.html?$/i, ".pdf");
      } else {
        blob = new Blob([html], { type: "text/html;charset=utf-8" });
        downloadName = baseFilename;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // Release the object URL on the next tick so the download can start.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      console.error("Error generating executive summary:", e);
      alert("Could not generate the executive summary: " + e.message);
    }
  }

  /**
   * Build the shared JCB branded header block used at the top of every PDF
   * report. Uses only semantic tags and inline styles because the offline PDF
   * writer strips CSS classes. The wordmark line ("JCB LEADERSHIP IN ACTION")
   * is followed by an <h1> title, a subtitle line, optional meta lines and a
   * horizontal rule.
   *
   * @param {string} title     Report title (rendered as <h1>)
   * @param {string} subtitle  Report subtitle line
   * @param {Array<string>} metaLines Optional meta lines (date, identifiers)
   * @returns {string} HTML fragment
   */
  _buildReportHeaderBlock(title, subtitle, metaLines) {
    const esc = (v) =>
      String(v === undefined || v === null ? "" : v)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">");
    const lines = Array.isArray(metaLines) ? metaLines : [];
    const metaHtml = lines
      .filter((l) => l)
      .map((l) => "<p style='margin:2px 0;'>" + esc(l) + "</p>")
      .join("");
    return (
      "<div>" +
      "<p style='margin:0 0 4px 0;'><strong>JCB</strong> LEADERSHIP IN ACTION</p>" +
      "<h1 style='margin:0 0 4px 0;'>" +
      esc(title) +
      "</h1>" +
      "<p style='margin:0 0 4px 0;color:#333;'>" +
      esc(subtitle) +
      "</p>" +
      metaHtml +
      "<hr/>" +
      "</div>"
    );
  }

  /**
   * Sanitise text destined for the PDF writer: replace emoji/arrows with
   * plain-ASCII equivalents so the WinAnsi encoder never drops or mangles
   * them. Keeps the degree sign and pound sign, which the writer supports.
   *
   * @param {string} text Raw text (may contain emoji/arrows)
   * @returns {string} Sanitised text
   */
  _sanitisePdfText(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/⚠️/g, "WARNING:")
      .replace(/⚠/g, "WARNING:")
      .replace(/✅/g, "OK:")
      .replace(/❌/g, "GAP:")
      .replace(/←/g, "<-")
      .replace(/→/g, "->")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "");
  }

  /**
   * Build a self-contained, print-friendly HTML document for an individual
   * player's feedback. Shared by downloadFeedbackPdf() (current run) and
   * downloadPlayerFeedbackPdf() (leaderboard player).
   *
   * @param {Object} state   Player state (metrics, LEAD scores, round, etc.)
   * @param {Object} results Final results (profile, colour, feedback, recs)
   * @param {string} name    Player display name
   * @returns {string} Complete HTML document string
   */
  _buildFeedbackReportHtml(state, results, name) {
    const safeName = name || "Player";
    const s = state || {};
    const r = results || {};

    const esc = (v) =>
      String(v === undefined || v === null ? "" : v)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">");

    const num = (v, digits) =>
      typeof v === "number" && isFinite(v) ? v.toFixed(digits) : "0";

    // PERCENTAGE ACCURACY FIX: clamp conceptually bounded percentages (style
    // shares, retention) to 0-100 and guard non-finite input. Raw game metrics
    // (growth, morale, attrition, profitMargin) are left unclamped because they
    // are meaningful above 100 / below 0 - only their finiteness is enforced.
    const pct = (v, digits) => {
      const d = typeof digits === "number" ? digits : 0;
      if (typeof v !== "number" || !isFinite(v)) return "0";
      return Math.max(0, Math.min(100, v)).toFixed(d);
    };

    const colorLabel = this.getColorLabel(r.personalityColor);
    const colorHex = this.getColorHex(r.personalityColor);

    // Outcome line
    let outcome = "Target not met";
    if (r.optimal) outcome = "Optimal outcome achieved";
    else if (r.escaped) outcome = "Target met";

    // Leadership profile rows
    let profileRows = "";
    const profile = r.leadershipProfile || {};
    Object.keys(profile).forEach((style) => {
      const rawPct = profile[style];
      // Style shares are conceptually bounded 0-100; clamp for display.
      const safePct =
        typeof rawPct === "number" && isFinite(rawPct)
          ? Math.max(0, Math.min(100, rawPct))
          : 0;
      let annotation = "";
      if (safePct >= 60) annotation = " (Overused)";
      else if (safePct >= 40) annotation = " (Primary)";
      else if (safePct >= 30) annotation = " (Secondary)";
      else if (safePct <= 20) annotation = " (Underused)";
      profileRows +=
        "<tr><td>" +
        esc(style.charAt(0).toUpperCase() + style.slice(1)) +
        "</td><td>" +
        esc(safePct) +
        "%" +
        esc(annotation) +
        "</td></tr>";
    });

    // Recommendations
    let recsHtml = "";
    if (r.recommendations && r.recommendations.length > 0) {
      recsHtml += "<h2>Development Recommendations</h2><ol>";
      r.recommendations.forEach((rec) => {
        recsHtml +=
          "<li><strong>" +
          esc(rec.title) +
          "</strong><br/>" +
          esc(rec.description) +
          "</li>";
      });
      recsHtml += "</ol>";
    }

    // Plain-language opening summary (2-3 sentences) so the report leads with
    // meaning rather than raw tables.
    const openingSummary =
      "<p>" +
      esc(safeName) +
      " completed Round " +
      esc(s.round || 1) +
      " of the JCB Leadership Assessment with the outcome: " +
      esc(outcome) +
      ". This report summarises the final performance metrics, LEAD framework " +
      "scores, leadership style profile and personalised development feedback " +
      "generated from the decisions made during the simulation.</p>";

    const html =
      "<!DOCTYPE html><html><head><meta charset='utf-8'/>" +
      "<title>JCB Leadership Assessment — Individual Feedback</title>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:24px;line-height:1.5;}" +
      "h1{font-size:22px;margin:0 0 4px 0;}" +
      "h2{font-size:16px;margin:22px 0 8px 0;border-bottom:2px solid #FFCB00;padding-bottom:4px;}" +
      "p{margin:4px 0;}" +
      "table{border-collapse:collapse;width:100%;margin:8px 0;}" +
      "td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}" +
      "th{background:#f4f4f4;}" +
      ".meta{color:#555;font-size:13px;margin-bottom:12px;}" +
      ".color-swatch{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:middle;}" +
      "</style></head><body>" +
      this._buildReportHeaderBlock(
        "Individual Feedback",
        "JCB Leadership Assessment — " + safeName,
        [
          "Player: " + safeName,
          "Function: " +
            (s.jobFunction || "—") +
            "  |  Seniority: " +
            (s.seniority || "—") +
            "  |  Round: " +
            (s.round || 1),
          "Outcome: " + outcome,
          "Generated: " + new Date().toLocaleDateString("en-GB"),
        ],
      ) +
      openingSummary +
      "<h2>Final Performance Metrics</h2>" +
      "<table><tr><th>Metric</th><th>Value</th></tr>" +
      // Growth / attrition / profitMargin are the game's own metrics and are
      // meaningful above 100 / below 0, so they are only finiteness-guarded
      // (via num). Morale is conceptually a percentage of a maximum, so it is
      // clamped to 0-100 to avoid a confusing "morale 180%".
      "<tr><td>Revenue Growth</td><td>" +
      num(s.growth, 1) +
      "%</td></tr>" +
      "<tr><td>Team Morale</td><td>" +
      pct(s.morale, 0) +
      "%</td></tr>" +
      "<tr><td>Staff Attrition</td><td>" +
      num(s.attrition, 1) +
      "%</td></tr>" +
      "<tr><td>Profit Margin</td><td>" +
      num(s.profitMargin, 1) +
      "%</td></tr>" +
      "<tr><td>Organizational Capability</td><td>" +
      num(s.organizationalCapability, 0) +
      "</td></tr></table>" +
      "<h2>JCB LEAD Framework Performance</h2>" +
      "<table><tr><th>Dimension</th><th>Score</th></tr>" +
      "<tr><td>Leadership Quality</td><td>" +
      esc(s.leadership || 0) +
      "</td></tr>" +
      "<tr><td>Excellence Standards</td><td>" +
      esc(s.excellence || 0) +
      "</td></tr>" +
      "<tr><td>Agility & Adaptability</td><td>" +
      esc(s.agility || 0) +
      "</td></tr>" +
      "<tr><td>Determination to Succeed</td><td>" +
      esc(s.determination || 0) +
      "</td></tr></table>" +
      "<h2>Leadership Profile (Goleman Framework)</h2>" +
      "<table><tr><th>Style</th><th>Share</th></tr>" +
      (profileRows || "<tr><td colspan='2'>No profile data</td></tr>") +
      "</table>" +
      "<h2>Personality Colour</h2>" +
      "<p><span class='color-swatch' style='background:" +
      esc(colorHex) +
      ";'></span><strong>" +
      esc(r.personalityColor || "BALANCED") +
      "</strong> — " +
      esc(colorLabel) +
      "</p>" +
      "<p>" +
      esc(r.personalityDescription || "") +
      "</p>" +
      "<h2>Detailed Feedback</h2>" +
      "<div>" +
      this._sanitisePdfText(r.feedback || "") +
      "</div>" +
      recsHtml +
      "</body></html>";

    return html;
  }

  /**
   * Trigger a browser download for a Blob using an object URL + anchor click,
   * revoking the URL on the next tick. Shared download plumbing.
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /**
   * Build and download a PDF of the current player's individual feedback.
   * Falls back to an HTML download when the SimplePDF writer is unavailable.
   */
  downloadFeedbackPdf() {
    try {
      if (!this.finalResults) {
        alert("No feedback available to download yet.");
        return;
      }

      const name = (this.state && this.state.playerName) || "Player";
      const html = this._buildFeedbackReportHtml(
        this.state,
        this.finalResults,
        name,
      );

      const cleanName =
        String(name)
          .replace(/[^a-z0-9]+/gi, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || "Player";
      const round = (this.state && this.state.round) || 1;
      const timestamp = Date.now();

      let blob;
      let downloadName;
      if (window.SimplePDF && typeof window.SimplePDF.fromHTML === "function") {
        blob = window.SimplePDF.fromHTML(html, {
          title: "JCB Leadership Assessment",
          subtitle: "Individual Feedback — " + name,
        });
        downloadName =
          "JCB_Feedback_" +
          cleanName +
          "_round" +
          round +
          "_" +
          timestamp +
          ".pdf";
      } else {
        blob = new Blob([html], { type: "text/html;charset=utf-8" });
        downloadName =
          "JCB_Feedback_" +
          cleanName +
          "_round" +
          round +
          "_" +
          timestamp +
          ".html";
      }

      this._downloadBlob(blob, downloadName);
    } catch (e) {
      console.error("Error generating feedback PDF:", e);
      alert("Could not generate the feedback PDF: " + e.message);
    }
  }

  /**
   * Reconstruct a leaderboard player's state/results from stored data.
   * Shared by viewPlayerFeedback() and downloadPlayerFeedbackPdf() so the
   * reconstruction logic lives in exactly one place.
   *
   * @param {number} playerIndex Index into the leaderboard array
   * @returns {{state: Object, results: Object, name: string}|null}
   */
  _reconstructPlayerState(playerIndex) {
    const leaderboardData = this.getLeaderboardData();
    const player = leaderboardData[playerIndex];

    if (!player) return null;

    const results = {
      escaped: player.escaped,
      optimal: player.optimal,
      leadershipProfile: player.leadershipProfile || {},
      personalityColor: player.personalityColor,
      personalityDescription: player.personalityDescription,
      feedback: player.feedback || "",
      recommendations: player.recommendations || [],
      leadRatios: player.leadRatios || {},
    };

    const state = {
      growth: player.growth,
      morale: player.morale,
      attrition: player.attrition,
      profitMargin: player.profitMargin,
      leadership: player.leadership,
      excellence: player.excellence,
      agility: player.agility,
      determination: player.determination,
      organizationalCapability: player.organizationalCapability || 0,
      infoRequests: player.infoRequests || [],
      decisions: player.decisions || [],
      leadershipStyles: player.leadershipStyles || {},
      round: player.round || 1,
      playerName: player.name,
      jobFunction: player.jobFunction,
      seniority: player.seniority,
    };

    return { state: state, results: results, name: player.name };
  }

  /**
   * Build and download a PDF of a leaderboard player's individual feedback.
   * Temporarily swaps in the reconstructed state/results, reuses the shared
   * report builder, then restores the original state/results.
   */
  downloadPlayerFeedbackPdf(playerIndex) {
    try {
      const reconstructed = this._reconstructPlayerState(playerIndex);
      if (!reconstructed) {
        alert("Player data not found.");
        return;
      }

      const originalState = this.state;
      const originalResults = this.finalResults;

      this.state = reconstructed.state;
      this.finalResults = reconstructed.results;

      try {
        const name = reconstructed.name || "Player";
        const html = this._buildFeedbackReportHtml(
          this.state,
          this.finalResults,
          name,
        );

        const cleanName =
          String(name)
            .replace(/[^a-z0-9]+/gi, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 40) || "Player";
        const round = (this.state && this.state.round) || 1;
        const timestamp = Date.now();

        let blob;
        let downloadName;
        if (
          window.SimplePDF &&
          typeof window.SimplePDF.fromHTML === "function"
        ) {
          blob = window.SimplePDF.fromHTML(html, {
            title: "JCB Leadership Assessment",
            subtitle: "Individual Feedback — " + name,
          });
          downloadName =
            "JCB_Feedback_" +
            cleanName +
            "_round" +
            round +
            "_" +
            timestamp +
            ".pdf";
        } else {
          blob = new Blob([html], { type: "text/html;charset=utf-8" });
          downloadName =
            "JCB_Feedback_" +
            cleanName +
            "_round" +
            round +
            "_" +
            timestamp +
            ".html";
        }

        this._downloadBlob(blob, downloadName);
      } finally {
        // Always restore the original state/results.
        this.state = originalState;
        this.finalResults = originalResults;
      }
    } catch (e) {
      console.error("Error generating player feedback PDF:", e);
      alert("Could not generate the player feedback PDF: " + e.message);
    }
  }

  animateResultsReveal(results) {
    const metricsContainer = document.getElementById("results-metrics");
    metricsContainer.innerHTML = `
            <div class="result-metric">
                <div class="result-metric-label">Revenue Growth</div>
                <div class="result-metric-value">${this.state.growth.toFixed(1)}%</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Organizational Capability</div>
                <div class="result-metric-value">${this.state.organizationalCapability.toFixed(0)}</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Team Morale</div>
                <div class="result-metric-value">${this.state.morale.toFixed(0)}%</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Staff Attrition</div>
                <div class="result-metric-value">${this.state.attrition.toFixed(0)}%</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Profit Margin</div>
                <div class="result-metric-value">${this.state.profitMargin.toFixed(1)}%</div>
            </div>
        `;

    setTimeout(() => {
      this.showOutcome(results);
    }, 900);
  }

  showOutcome(results) {
    const outcomeContainer = document.getElementById("results-outcome");
    const success = results.escaped;

    outcomeContainer.innerHTML = `
            <div class="outcome-status ${success ? "success" : "failure"}">
                ${success ? "✓ TARGET MET" : "✗ TARGET NOT MET"}
            </div>
            <div class="outcome-message">
                ${
                  success
                    ? `You achieved ${this.state.growth.toFixed(1)}% growth and met your target!`
                    : `You achieved ${this.state.growth.toFixed(1)}% growth. Target was 15%.`
                }
            </div>
        `;

    setTimeout(() => {
      this.showLeadershipBreakdown(results);
    }, 900);
  }

  showLeadershipBreakdown(results) {
    const breakdownContainer = document.getElementById("results-breakdown");
    breakdownContainer.innerHTML = this.renderLeadershipChart(results);

    setTimeout(() => {
      this.showFeedback(results);
    }, 900);
  }

  renderLeadershipChart(results) {
    const styles = results.leadershipProfile;

    let html =
      '<div class="leadership-chart"><h3>YOUR LEADERSHIP STYLE PROFILE</h3>';

    Object.keys(styles).forEach((style) => {
      const percentage = styles[style];
      const annotation = this.getStyleAnnotation(style, percentage);

      html += `
                <div class="leadership-bar">
                    <div class="leadership-bar-label">
                        <span class="leadership-bar-name">${this.capitalizeFirst(style)}</span>
                        <span class="leadership-bar-percentage">${percentage}%</span>
                    </div>
                    <div class="leadership-bar-track">
                        <div class="leadership-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    ${annotation ? `<div class="leadership-annotation">${annotation}</div>` : ""}
                </div>
            `;
    });

    html += `
            <div class="personality-color">
                <h4>YOUR LEADERSHIP COLOR: ${results.personalityColor}</h4>
                <p>${results.personalityDescription}</p>
            </div>
        </div>`;

    return html;
  }

  getStyleAnnotation(style, percentage) {
    if (percentage >= 60) return "← OVERUSED ⚠️";
    if (percentage <= 20) return "← UNDERUSED";
    if (percentage >= 40) return "← PRIMARY";
    if (percentage >= 30) return "← SECONDARY";
    return "";
  }

  // Render the Round 2 "Adaptation" section. Returns an empty string for
  // Round 1 runs (or when there is no adaptation data), so Round 1 players
  // never see it. Reuses existing feedback/impact styling rather than adding
  // new CSS classes.
  renderAdaptationSection(results) {
    // Only Round 2 runs with a prior record get an adaptation section.
    if (!this.state || this.state.round !== 2) return "";
    const adaptation = results && results.adaptation;
    if (!adaptation) return "";

    const earned = adaptation.bonus > 0;
    const accent = earned ? "#00D084" : "var(--jcb-yellow)";
    const border = earned ? "#00D084" : "var(--jcb-yellow)";
    const bg = earned
      ? "linear-gradient(135deg, rgba(0, 208, 132, 0.18) 0%, rgba(0, 208, 132, 0.04) 100%)"
      : "linear-gradient(135deg, rgba(255, 203, 0, 0.12) 0%, rgba(255, 203, 0, 0.03) 100%)";

    // What Round 1 flagged.
    let flagged = "";
    if (adaptation.weakestDimension) {
      flagged = `Your Round 1 feedback flagged <strong>${adaptation.weakestDimension}</strong> as your weakest LEAD dimension`;
      if (typeof adaptation.round1WeakestRatio === "number") {
        flagged += ` (${(adaptation.round1WeakestRatio * 100).toFixed(0)}% of benchmark)`;
      }
      flagged += ".";
    } else {
      flagged = "Your Round 1 feedback highlighted areas for development.";
    }
    if (
      adaptation.round1MaxStyleName &&
      typeof adaptation.round1MaxStyle === "number" &&
      adaptation.round1MaxStyle > 60
    ) {
      flagged += ` It also noted over-reliance on the <strong>${adaptation.round1MaxStyleName}</strong> style (${adaptation.round1MaxStyle.toFixed(0)}%).`;
    }

    // What the player did in Round 2.
    let did = "";
    if (
      adaptation.weakestDimension &&
      typeof adaptation.round2WeakestRatio === "number"
    ) {
      did += `In Round 2 your ${adaptation.weakestDimension} moved to <strong>${(adaptation.round2WeakestRatio * 100).toFixed(0)}%</strong> of benchmark. `;
    }
    if (
      adaptation.round2MaxStyleName &&
      typeof adaptation.round2MaxStyle === "number"
    ) {
      did += `Your most-used style was <strong>${adaptation.round2MaxStyleName}</strong> at ${adaptation.round2MaxStyle.toFixed(0)}%. `;
    }
    if (!did)
      did =
        "Your Round 2 approach has been compared against your Round 1 record. ";

    // Bonus line.
    let bonusLine = "";
    if (earned) {
      bonusLine = `<div style="margin-top: 12px; font-size: 20px; font-weight: bold; color: ${accent};">✅ ADAPTATION BONUS: +${adaptation.bonus} points</div>`;
    } else {
      bonusLine = `<div style="margin-top: 12px; font-size: 16px; color: rgba(255, 255, 255, 0.8);">No adaptation bonus this round — but no penalty either. Keep working the areas your feedback flagged.</div>`;
    }

    return `
            <div class="feedback-section" style="background: ${bg}; border: 2px solid ${border}; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                <div style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Round 2 — Learned From Feedback</div>
                <h2 style="color: ${accent}; margin: 0 0 15px 0; font-size: 24px;">🔄 ADAPTATION</h2>
                <p style="font-size: 16px; line-height: 1.6; color: white; margin: 0 0 10px 0;"><strong>What Round 1 flagged:</strong> ${flagged}</p>
                <p style="font-size: 16px; line-height: 1.6; color: white; margin: 0;"><strong>What you did in Round 2:</strong> ${did}${adaptation.summary}</p>
                ${bonusLine}
            </div>
        `;
  }

  showFeedback(results) {
    const feedbackContainer = document.getElementById("results-feedback");

    // Extract critical improvement
    const criticalImprovement = this.extractCriticalImprovement(results);

    feedbackContainer.innerHTML = `
            <div class="most-important-improvement-highlight" style="background: linear-gradient(135deg, rgba(255, 203, 0, 0.2) 0%, rgba(255, 203, 0, 0.05) 100%); border: 3px solid var(--jcb-yellow); border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
                <div style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Your #1 Development Priority</div>
                <h2 style="color: var(--jcb-yellow); margin: 0 0 15px 0; font-size: 24px;">🎯 MOST IMPORTANT IMPROVEMENT</h2>
                <div style="font-size: 18px; line-height: 1.6; color: white;">${criticalImprovement}</div>
            </div>
            ${this.renderAdaptationSection(results)}
            <h3>RADICAL CANDOR FEEDBACK</h3>
            ${results.feedback}
            ${this.renderLEADScoreBreakdown(results)}
            ${this.renderDevelopmentRecommendations(results.recommendations)}
        `;

    // Save to leaderboard with comprehensive data.
    //
    // BUGFIX (culture count): the old guard was a single boolean on this.state
    // (`savedToLeaderboard`). That is fragile because viewPlayerFeedback()
    // swaps this.state for a reconstructed object that omits the flag, so the
    // guard could read as undefined mid-render, and the new-player path never
    // reset it. We now key idempotency on the run's stable runId, tracked on a
    // property that is NOT part of the swappable this.state (`this._savedRunIds`).
    // This survives the state swap and still writes exactly once per run.
    if (!this._savedRunIds) {
      this._savedRunIds = new Set();
    }

    const currentRunId = this.state.runId;
    if (currentRunId && this._savedRunIds.has(currentRunId)) {
      return;
    }
    // Fallback: if this.state.runId is missing (e.g. a swapped state), consult
    // the persisted culture store so a re-entry still cannot double-write.
    if (
      !currentRunId &&
      this.getCultureData().some(
        (p) =>
          p &&
          p.name === this.state.playerName &&
          p.round === this.state.round &&
          p.timestamp &&
          Date.now() - p.timestamp < 60000,
      )
    ) {
      return;
    }
    if (currentRunId) {
      this._savedRunIds.add(currentRunId);
    }
    // Keep the legacy flag in sync for any code that still reads it.
    this.state.savedToLeaderboard = true;

    const placement = this.saveToLeaderboard({
      name: this.state.playerName,
      // Segmentation (for culture analysis)
      jobFunction: this.state.jobFunction,
      seniority: this.state.seniority,
      // Game metrics
      growth: this.state.growth,
      morale: this.state.morale,
      attrition: this.state.attrition,
      profitMargin: this.state.profitMargin,
      // LEAD scores
      leadership: this.state.leadership,
      excellence: this.state.excellence,
      agility: this.state.agility,
      determination: this.state.determination,
      organizationalCapability: this.state.organizationalCapability,
      // Leadership analysis
      leadershipStyle: this.getDominantStyleName(results.leadershipProfile),
      leadershipProfile: results.leadershipProfile, // Full style distribution
      leadershipStyles: this.state.leadershipStyles, // Raw style points
      personalityColor: results.personalityColor,
      personalityDescription: results.personalityDescription,
      // Result status
      escaped: results.escaped,
      optimal: results.optimal,
      // Critical improvement (extract first sentence for compact display)
      criticalImprovement: this.extractCriticalImprovement(results),
      // Full decision history for culture analysis and detailed feedback
      decisions: this.state.decisions,
      infoRequests: this.state.infoRequests,
      selfIdentifiedStyle: this.state.selfIdentifiedStyle,
      round: this.state.round,
      // Store full results for detailed feedback reconstruction
      feedback: results.feedback,
      recommendations: results.recommendations,
      leadRatios: results.leadRatios,
      // Round 2 adaptation bonus (0 for Round 1 runs) so the culture analysis
      // and detailed feedback can see it.
      adaptationBonus:
        typeof results.adaptationBonus === "number"
          ? results.adaptationBonus
          : 0,
      timestamp: Date.now(),
    });

    // Record the runId that saveToLeaderboard() just assigned, so a re-entry
    // into showFeedback() for this same run is suppressed even though the id
    // was not known when the guard was first evaluated.
    if (this.state.runId) {
      this._savedRunIds.add(this.state.runId);
    }

    // Reload leaderboard for next player
    this.loadLeaderboard();

    // Dramatic leaderboard placement reveal
    this.showLeaderboardPlacement(placement);
  }

  // Animated rank-in reveal on the results screen.
  // Uses the truthful rank computed against the full cohort.
  showLeaderboardPlacement(placement) {
    const container = document.getElementById("results-placement");
    if (!container || !placement || !placement.rank) return;

    const { rank, total, inTop10 } = placement;
    const isPodium = rank <= 3;
    const medal =
      rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";

    const headline = isPodium
      ? `TOP ${rank} OF ${total}`
      : inTop10
        ? `#${rank} OF ${total}`
        : `#${rank} OF ${total}`;

    const subline = isPodium
      ? "Outstanding — you are on the podium."
      : inTop10
        ? "You made the leaderboard."
        : "Every run sharpens the picture of our culture.";

    container.innerHTML = `
            <div class="placement-card ${isPodium ? "podium" : ""}">
                <div class="placement-medal">${medal}</div>
                <div class="placement-rank">${headline}</div>
                <div class="placement-sub">${subline}</div>
            </div>
        `;

    // Trigger the rank-in animation on the next frame
    requestAnimationFrame(() => {
      const card = container.querySelector(".placement-card");
      if (card) card.classList.add("revealed");
    });
  }

  renderDevelopmentRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) return "";

    let html =
      '<div class="development-recommendations"><h4>YOUR DEVELOPMENT PRIORITIES</h4>';

    recommendations.forEach((rec, index) => {
      html += `
                <div class="recommendation-item">
                    <h5>${index + 1}. ${rec.title}</h5>
                    <p>${rec.description}</p>
                </div>
            `;
    });

    html += "</div>";
    return html;
  }

  renderLEADScoreBreakdown(results) {
    // BUGFIX (audit): The game plays 9 scenarios, not 6. The previous maximums
    // were calibrated for 6 scenarios, so every "% of maximum" shown to the player
    // was inflated by ~50% (e.g. a genuine 50% read as 75%). These values are the
    // 6-scenario maximums scaled by 9/6 = 1.5 to match the real 9-scenario run.
    const maximums = {
      leadership: 401, // 267 x 1.5 (9 scenarios)
      excellence: 450, // 300 x 1.5 (9 scenarios)
      agility: 233, // 155 x 1.5 (9 scenarios)
      determination: 318, // 212 x 1.5 (9 scenarios)
    };

    // Track cumulative totals
    const cumulativeScores = {
      leadership: this.state.leadership || 0,
      excellence: this.state.excellence || 0,
      agility: this.state.agility || 0,
      determination: this.state.determination || 0,
    };

    let html =
      '<div class="lead-score-breakdown" style="margin: 30px 0; padding: 25px; background: rgba(0, 0, 0, 0.3); border-radius: 12px;">';
    html +=
      '<h3 style="color: var(--jcb-yellow); margin-top: 0;">YOUR LEAD FRAMEWORK SCORES</h3>';
    html +=
      '<p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 20px;">Your performance across all scenarios</p>';

    html +=
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">';

    Object.keys(maximums).forEach((dimension) => {
      const totalScore = cumulativeScores[dimension];
      const maximum = maximums[dimension];
      const percentOfMaximum = ((totalScore / maximum) * 100).toFixed(0);
      const performanceColor =
        percentOfMaximum >= 70
          ? "#00D084"
          : percentOfMaximum >= 50
            ? "#FFCB00"
            : "#FFA500";

      html += `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="font-size: 16px; color: var(--jcb-yellow); margin-bottom: 10px; text-transform: uppercase; font-weight: bold;">${dimension}</div>
                    <div style="font-size: 32px; font-weight: bold; color: white; margin: 10px 0;">${totalScore}</div>
                    <div style="font-size: 14px; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px;">out of ${maximum} maximum</div>
                    <div style="font-size: 18px; font-weight: bold; color: ${performanceColor};">${percentOfMaximum}%</div>
                </div>
            `;
    });

    html += "</div>";

    // Overall assessment
    const totalScore = Object.values(cumulativeScores).reduce(
      (a, b) => a + b,
      0,
    );
    const totalMaximum = Object.values(maximums).reduce((a, b) => a + b, 0);
    const overallPercentage = ((totalScore / totalMaximum) * 100).toFixed(0);

    html +=
      '<div style="margin-top: 20px; padding: 15px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow); border-radius: 4px;">';
    html += `<strong>Overall LEAD Score:</strong> ${totalScore} out of ${totalMaximum} maximum → `;
    html += `<span style="color: #00D084;">${overallPercentage}% of maximum achievable</span>`;
    html += "</div>";

    html += "</div>";
    return html;
  }

  extractCriticalImprovement(results) {
    // Extract the critical improvement from the feedback
    // The "Most Important Improvement" section is in the feedback HTML
    const feedbackHTML = results.feedback;

    // Look for the Most Important Improvement section
    const improvementMatch = feedbackHTML.match(
      /🎯 Most Important Improvement:<\/h4>[\s\S]*?<p[^>]*>(.*?)<\/p>/,
    );

    if (improvementMatch && improvementMatch[1]) {
      // Remove HTML tags and get first sentence
      let improvement = improvementMatch[1]
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/&nbsp;/g, " ") // Replace &nbsp;
        .trim();

      // BUGFIX 2026-05-17: Get first sentence (period not followed by digit to avoid truncating decimals like "11.2%")
      // Old regex /^[^.]+\./ would match "but 11." and cut off at decimal point
      // New regex /^.+?\.(?!\d)/ uses negative lookahead to skip decimals
      const firstSentence = improvement.match(/^.+?\.(?!\d)/);
      if (firstSentence) {
        return firstSentence[0];
      }

      // Fallback: truncate at 150 chars
      if (improvement.length > 150) {
        return improvement.substring(0, 147) + "...";
      }

      return improvement;
    }

    return "Continue developing balanced leadership";
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getDominantStyleName(leadershipProfile) {
    // Sort styles by percentage (descending)
    const sortedStyles = Object.keys(leadershipProfile)
      .map((style) => ({
        name: style,
        percentage: leadershipProfile[style],
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const highest = sortedStyles[0].percentage;

    // If all styles are relatively even (none above 25%), it's truly balanced
    if (highest < 25) {
      return "Agile Balanced Leadership";
    }

    // Collect styles within 10% of the highest
    const dominantStyles = sortedStyles
      .filter(
        (style) => style.percentage >= highest - 10 && style.percentage >= 20,
      )
      .map((style) => this.capitalizeFirst(style.name));

    // If 4+ styles are close, it's balanced leadership
    if (dominantStyles.length >= 4) {
      return "Agile Balanced Leadership";
    }

    // If 2-3 styles are dominant, list them
    if (dominantStyles.length > 1) {
      return dominantStyles.join(" / ");
    }

    // Single dominant style
    return dominantStyles[0];
  }

  viewDetailedFeedback() {
    try {
      console.log("=== viewDetailedFeedback called ===");
      console.log("this:", this);
      console.log("this.finalResults:", this.finalResults);
      console.log("typeof this.finalResults:", typeof this.finalResults);

      if (!this.finalResults) {
        console.error("CRITICAL: this.finalResults is undefined!");
        console.log("this.state:", this.state);
        console.log("window.game:", window.game);
        console.log(
          "window.game.finalResults:",
          window.game ? window.game.finalResults : "N/A",
        );
        alert("No results available. Please complete the game first.");
        return;
      }

      const modal = document.getElementById("consequence-modal");
      if (!modal) {
        alert("Modal element not found. Please refresh the page.");
        console.error("consequence-modal element not found");
        return;
      }

      const modalContent = modal.querySelector(".modal-content");
      if (!modalContent) {
        alert("Modal content element not found. Please refresh the page.");
        console.error(".modal-content element not found");
        return;
      }

      // BUGFIX #10: Use the same scenario source the game actually played
      // (this.scenarios), falling back to window.scenarios only if needed.
      const allScenarios =
        this.scenarios ||
        (this.state.round === 1
          ? window.scenarios?.round1 || []
          : window.scenarios?.round2 || window.round2Scenarios || []);

      // Build comprehensive detailed view
      let detailedView = "<h3>COMPREHENSIVE LEADERSHIP ANALYSIS</h3>";
      detailedView +=
        '<div style="text-align: left; max-height: 70vh; overflow-y: auto;">';

      // Decision-by-Decision Breakdown
      detailedView +=
        '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">';
      detailedView +=
        '<h4 style="color: var(--jcb-yellow); margin-bottom: 20px;">DECISION-BY-DECISION ANALYSIS</h4>';

      this.state.decisions.forEach((decision, index) => {
        const scenario = allScenarios[decision.scenario];

        detailedView += `<div style="margin-bottom: 25px; padding: 15px; background: rgba(0, 0, 0, 0.3); border-left: 3px solid rgba(255, 203, 0, 0.5);">`;
        detailedView += `<h5 style="color: var(--jcb-yellow); margin-bottom: 10px;">Scenario ${index + 1}: ${decision.scenarioTitle || (scenario ? scenario.title : "Unknown Scenario")}</h5>`;

        // Show leadership styles used
        if (decision.stylesUsed && decision.stylesUsed.length > 0) {
          const uniqueStyles = [...new Set(decision.stylesUsed)];
          detailedView += `<p style="margin-bottom: 8px;"><strong>Goleman Style(s):</strong> ${uniqueStyles.map((s) => this.capitalizeFirst(s)).join(", ")}</p>`;
        }

        // Show personality colors used
        if (decision.colorsUsed && decision.colorsUsed.length > 0) {
          const uniqueColors = [...new Set(decision.colorsUsed)];
          const colorLabels = uniqueColors
            .map((c) => {
              const label = this.getColorLabel(c);
              return `<span style="color: ${this.getColorHex(c)}; font-weight: bold;">${c} (${label})</span>`;
            })
            .join(", ");
          detailedView += `<p style="margin-bottom: 8px;"><strong>Personality Color(s):</strong> ${colorLabels}</p>`;
        }

        // Show impacts
        if (decision.impact) {
          const impact = decision.impact;
          detailedView +=
            '<p style="margin-top: 10px; margin-bottom: 5px; font-size: 14px; color: rgba(255, 255, 255, 0.9);"><strong>Impact on Metrics:</strong></p>';
          detailedView +=
            '<ul style="margin: 0; padding-left: 20px; font-size: 14px; color: rgba(255, 255, 255, 0.8);">';

          if (impact.growth)
            detailedView += `<li>Growth: ${impact.growth > 0 ? "+" : ""}${impact.growth.toFixed(1)}%</li>`;
          if (impact.morale)
            detailedView += `<li>Morale: ${impact.morale > 0 ? "+" : ""}${impact.morale.toFixed(0)}%</li>`;
          if (impact.attrition)
            detailedView += `<li>Attrition: ${impact.attrition > 0 ? "+" : ""}${impact.attrition.toFixed(0)}%</li>`;
          if (impact.profitMargin)
            detailedView += `<li>Profit Margin: ${impact.profitMargin > 0 ? "+" : ""}${impact.profitMargin.toFixed(0)}%</li>`;
          if (
            impact.organizationalCapability &&
            impact.organizationalCapability > 0
          ) {
            detailedView += `<li>Organizational Capability: +${impact.organizationalCapability.toFixed(0)} points</li>`;
          }

          detailedView += "</ul>";

          // Show LEAD framework impacts
          const leadImpacts = [];
          if (impact.leadership)
            leadImpacts.push(`Leadership: +${impact.leadership}`);
          if (impact.excellence)
            leadImpacts.push(`Excellence: +${impact.excellence}`);
          if (impact.agility) leadImpacts.push(`Agility: +${impact.agility}`);
          if (impact.determination)
            leadImpacts.push(`Determination: +${impact.determination}`);

          if (leadImpacts.length > 0) {
            detailedView += `<p style="margin-top: 10px; font-size: 14px; color: rgba(255, 203, 0, 0.9);"><strong>JCB LEAD Framework:</strong> ${leadImpacts.join(" | ")}</p>`;
          }
        }

        detailedView += "</div>";
      });

      detailedView += "</div>";

      // JCB LEAD Framework Summary with North Star alignment
      detailedView +=
        '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">';
      detailedView +=
        '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">JCB LEAD FRAMEWORK PERFORMANCE</h4>';

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">L</strong>eadership Quality: ${this.state.leadership} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("leadership", this.state.leadership)}</p>`;
      detailedView += `</div>`;

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">E</strong>xcellence Standards: ${this.state.excellence} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("excellence", this.state.excellence)}</p>`;
      detailedView += `</div>`;

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">A</strong>gility & Adaptability: ${this.state.agility} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("agility", this.state.agility)}</p>`;
      detailedView += `</div>`;

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">D</strong>etermination to Succeed: ${this.state.determination} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("determination", this.state.determination)}</p>`;
      detailedView += `</div>`;

      detailedView += "</div>";

      // Final Metrics
      detailedView +=
        '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
      detailedView +=
        '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Final Performance Metrics</h4>';
      detailedView += `<p><strong>Revenue Growth:</strong> ${this.state.growth.toFixed(1)}% (Target: 15%)</p>`;

      // Morale with explanatory note if at cap
      if (this.state.morale >= 95) {
        detailedView += `<p><strong>Team Morale:</strong> ${this.state.morale.toFixed(0)}% <span style="font-size: 13px; color: rgba(255,255,255,0.7);">(maximum achievable - top 1% of organizations)</span></p>`;
      } else {
        detailedView += `<p><strong>Team Morale:</strong> ${this.state.morale.toFixed(0)}%</p>`;
      }

      // Attrition with explanatory note if at minimum
      if (this.state.attrition <= 5) {
        detailedView += `<p><strong>Staff Attrition:</strong> ${this.state.attrition.toFixed(1)}% <span style="font-size: 13px; color: rgba(255,255,255,0.7);">(minimum achievable - reflects natural turnover: retirement, relocation, etc.)</span></p>`;
      } else {
        detailedView += `<p><strong>Staff Attrition:</strong> ${this.state.attrition.toFixed(1)}%</p>`;
      }

      detailedView += `<p><strong>Profit Margin:</strong> ${this.state.profitMargin.toFixed(1)}%</p>`;
      if (this.state.organizationalCapability > 0) {
        detailedView += `<p><strong>Organizational Capability:</strong> ${this.state.organizationalCapability.toFixed(0)} points</p>`;
      }
      detailedView += "</div>";

      // Leadership Profile Breakdown
      detailedView +=
        '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
      detailedView +=
        '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Leadership Style Analysis (Goleman Framework)</h4>';
      Object.keys(this.finalResults.leadershipProfile).forEach((style) => {
        const percentage = this.finalResults.leadershipProfile[style];
        let annotation = "";
        if (percentage >= 60) annotation = " ⚠️ OVERUSED";
        else if (percentage >= 40) annotation = " (Primary)";
        else if (percentage >= 30) annotation = " (Secondary)";
        else if (percentage <= 20) annotation = " (Underused)";

        detailedView += `<p><strong>${style.charAt(0).toUpperCase() + style.slice(1)}:</strong> ${percentage}%${annotation}</p>`;
      });
      detailedView += `<p style="margin-top: 15px;"><strong>Personality Color:</strong> ${this.finalResults.personalityColor}</p>`;
      detailedView += `<p style="font-size: 14px; color: rgba(255,255,255,0.8);">${this.finalResults.personalityDescription}</p>`;
      detailedView += "</div>";

      // Information Requests
      if (this.state.infoRequests.length > 0) {
        detailedView +=
          '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView +=
          '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Information Gathering Behavior</h4>';
        detailedView += `<p>You requested additional information ${this.state.infoRequests.length} times during the game.</p>`;
        detailedView +=
          '<p style="font-size: 14px; color: rgba(255,255,255,0.8);">This demonstrates thoroughness in decision-making and willingness to seek data before acting.</p>';
        detailedView += "</div>";
      }

      // Full Feedback
      detailedView += '<div style="margin-bottom: 30px;">';
      detailedView += this.finalResults.feedback;
      detailedView += "</div>";

      // Development Recommendations
      if (
        this.finalResults.recommendations &&
        this.finalResults.recommendations.length > 0
      ) {
        detailedView +=
          '<div style="margin-bottom: 20px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView +=
          '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Development Recommendations</h4>';
        this.finalResults.recommendations.forEach((rec, i) => {
          detailedView += `<p style="margin-bottom: 15px;"><strong>${i + 1}. ${rec.title}</strong><br/><span style="font-size: 14px; color: rgba(255,255,255,0.8);">${rec.description}</span></p>`;
        });
        detailedView += "</div>";
      }

      detailedView += "</div>";

      modalContent.innerHTML =
        detailedView +
        `
            <div class="modal-actions" style="margin-top: 30px;">
                <button class="btn-primary" onclick="game.closeConsequenceModal()" style="position: relative; z-index: 9999; pointer-events: auto;">CLOSE</button>
            </div>
        `;

      modal.classList.add("active");
    } catch (error) {
      console.error("Error in viewDetailedFeedback:", error);
      alert(
        "An error occurred while loading detailed feedback. Please check the console for details.\n\nError: " +
          error.message,
      );
    }
  }

  viewPlayerFeedback(playerIndex) {
    try {
      // Reconstruct the player's state/results via the shared helper so the
      // reconstruction logic is not duplicated with downloadPlayerFeedbackPdf.
      const reconstructed = this._reconstructPlayerState(playerIndex);

      if (!reconstructed) {
        alert("Player data not found.");
        return;
      }

      // Temporarily store current state
      const originalState = this.state;
      const originalResults = this.finalResults;

      // Replace with player's data
      this.state = reconstructed.state;
      this.finalResults = reconstructed.results;

      // Call existing viewDetailedFeedback method
      this.viewDetailedFeedback();

      // Restore original state
      this.state = originalState;
      this.finalResults = originalResults;
    } catch (error) {
      console.error("Error in viewPlayerFeedback:", error);
      alert(
        "An error occurred while loading player feedback. Error: " +
          error.message,
      );
    }
  }

  getColorLabel(color) {
    const labels = {
      RED: "Driven",
      BLUE: "Analytical",
      YELLOW: "Collaborative",
      GREEN: "Supportive",
      "RED/YELLOW": "Driven Innovator",
      "BLUE/GREEN": "Thoughtful Coach",
      "YELLOW/RED": "Energetic Achiever",
      "GREEN/BLUE": "Developmental Strategist",
      BALANCED: "Adaptive Leader",
    };
    return labels[color] || color;
  }

  getColorHex(color) {
    const hexColors = {
      RED: "#E31C23",
      BLUE: "#0066CC",
      YELLOW: "#FFCB00",
      GREEN: "#008E4C",
      "RED/YELLOW": "#E31C23",
      "BLUE/GREEN": "#0066CC",
      "YELLOW/RED": "#FFCB00",
      "GREEN/BLUE": "#008E4C",
      BALANCED: "#7A7A7A",
    };
    return hexColors[color] || "#7A7A7A";
  }

  getLeadFeedback(attribute, score) {
    const feedback = {
      leadership: {
        high: "You demonstrated strong leadership by building positive relationships, showing commercial acumen, and considering the bigger picture. Your decisions showed courage in motivating and influencing your team while adapting your style to different situations.",
        medium:
          "You showed leadership potential in some areas, particularly in decision-making and stakeholder management. To strengthen this, focus on building more inclusive relationships and consistently adapting your style to inspire and influence others.",
        low: "Your leadership decisions were primarily transactional. To develop JCB leadership qualities, focus on: building positive relationships within and outside the organization, demonstrating commercial acumen by operating as if it's your own company, and being more ethical and sustainable in addressing both praise and performance issues.",
      },
      excellence: {
        high: "You exemplified excellence through emotional intelligence, critical thinking, and informed decision-making. Your self-awareness and willingness to make courageous, data-driven decisions while owning the outcomes demonstrated mature leadership.",
        medium:
          "You showed good analytical capability in some decisions. To reach excellence, develop stronger self-awareness of your shadow as a leader, improve critical thinking by balancing short-term priorities with long-term strategic goals, and be more courageous in speaking up and learning from mistakes.",
        low: "Your decisions lacked the critical thinking and emotional intelligence that define excellence at JCB. Focus on: developing self-awareness of your strengths and development areas, making more informed data-driven decisions, owning your choices, and creating allies by standing by others even when they're not present.",
      },
      agility: {
        high: "You demonstrated exceptional agility by navigating ambiguity, adapting quickly to changing situations, and showing resilience in the face of setbacks. Your proactive approach and creative problem-solving reflected JCB's values of not giving up and moving quickly.",
        medium:
          "You showed some adaptability but could improve in handling ambiguity and recovering from setbacks. To strengthen agility, be more pragmatic in driving change quickly, don't overthink in evolving situations, and be more proactive in taking initiative without being asked.",
        low: "Your decisions showed rigidity when faced with ambiguity and change. To develop agility: practice handling unclear situations without all the information, consider VUCA (volatility, uncertainty, complexity, ambiguity) impacts, build resilience to recover from setbacks, and take more initiative proactively.",
      },
      determination: {
        high: "You displayed relentless determination through your drive to excel, growth mindset, and willingness to innovate. Your passion for achieving goals, openness to feedback, and view of failure as a learning opportunity embodied JCB's values.",
        medium:
          "You showed drive in pursuing goals but could demonstrate more determination. To improve: communicate more openly and frequently, actively seek feedback to improve performance, challenge the way things are done more often, and maintain a more positive outlook when facing challenges.",
        low: "Your approach lacked the relentless determination to learn and grow that JCB values. Focus on: developing a stronger growth mindset, fostering continuous learning opportunities, innovating by challenging established ways, accepting that failure from innovation is a learning tool, and being a more positive thinking performer.",
      },
    };

    const category = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
    return feedback[attribute][category];
  }

  restart() {
    location.reload();
  }

  // COMPANY CULTURE ANALYSIS METHODS
  showCultureDashboard() {
    // Use the FULL cohort, not the truncated top-10 display leaderboard.
    // getCultureData() reconciles jcb_culture_data against jcb_leaderboard
    // first, so a stale culture store self-heals before analysis runs.
    const cohort = this.getCultureData();

    if (!window.CultureAnalysis) {
      alert("Culture analysis engine not loaded. Please refresh the page.");
      return;
    }

    const analyzer = new window.CultureAnalysis();
    const analysis = analyzer.analyzeCulture(cohort);

    if (analysis.error) {
      // Report the reconciled cohort length so the count is truthful even if
      // the analyzer was handed a stale array.
      alert(analysis.message + "\n\nCurrent player count: " + cohort.length);
      return;
    }

    this.renderCultureDashboard(analysis);
    this.showScreen("culture-dashboard-screen");
  }

  /**
   * Build and download a PDF of the company culture analysis.
   *
   * The analysis object is never cached, so this method re-derives it from the
   * cohort on every click. This makes the button safe to press even if the
   * dashboard was never opened. Falls back to an HTML download when the
   * SimplePDF writer is unavailable.
   */
  downloadCulturePdf() {
    try {
      if (!window.CultureAnalysis) {
        alert("Culture analysis engine not loaded. Please refresh the page.");
        return;
      }

      const cohort = this.getCultureData();
      const analyzer = new window.CultureAnalysis();
      const analysis = analyzer.analyzeCulture(cohort);

      if (analysis.error) {
        alert(analysis.message);
        return;
      }

      const html = this._buildCultureReportHtml(analysis);
      const timestamp = Date.now();
      const baseName =
        "JCB_Culture_Analysis_" +
        (analysis.playerCount || 0) +
        "leaders_" +
        timestamp;

      let blob;
      let downloadName;
      if (window.SimplePDF && typeof window.SimplePDF.fromHTML === "function") {
        blob = window.SimplePDF.fromHTML(html, {
          title: "JCB Leadership Assessment",
          subtitle:
            "Company Culture Analysis — " +
            (analysis.playerCount || 0) +
            " Leaders",
        });
        downloadName = baseName + ".pdf";
      } else {
        blob = new Blob([html], { type: "text/html;charset=utf-8" });
        downloadName = baseName + ".html";
      }

      this._downloadBlob(blob, downloadName);
    } catch (e) {
      console.error("Error generating culture PDF:", e);
      alert("Could not generate the culture PDF: " + e.message);
    }
  }

  /**
   * Build a self-contained, print-friendly HTML document for the company
   * culture analysis. Mirrors _buildFeedbackReportHtml: inline <style> only,
   * semantic markup, and local esc()/num() helpers. No emoji, because the PDF
   * writer maps to Latin-1 and would mangle them.
   *
   * @param {Object} analysis Result of CultureAnalysis.analyzeCulture()
   * @returns {string} Complete HTML document string
   */
  _buildCultureReportHtml(analysis) {
    const a = analysis || {};
    const metrics = a.metrics || {};
    const leadership = a.leadership || {};
    const lead = a.lead || {};
    const segments = a.segments || {};
    const decisions = a.decisions || {};
    const observations = a.observations || [];
    const recommendations = a.recommendations || [];
    const playerCount = a.playerCount || 0;

    const esc = (v) =>
      String(v === undefined || v === null ? "" : v)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">");

    const num = (v, digits) =>
      typeof v === "number" && isFinite(v) ? v.toFixed(digits) : "0";

    // PERCENTAGE ACCURACY FIX: clamp conceptually bounded percentages (style
    // shares, diversity, morale) to 0-100 and guard non-finite input. Raw
    // metrics (growth, attrition, profitMargin) stay unclamped but finite.
    const pct = (v, digits) => {
      const d = typeof digits === "number" ? digits : 0;
      if (typeof v !== "number" || !isFinite(v)) return "0";
      return Math.max(0, Math.min(100, v)).toFixed(d);
    };

    const cap = (v) => {
      const s = String(v === undefined || v === null ? "" : v);
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
    };

    const generated = new Date().toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // --- 1. Title + meta -----------------------------------------------------
    // Plain-language opening summary (2-3 sentences).
    const openingSummary =
      "<p>This report analyses the leadership culture across " +
      esc(playerCount) +
      " recorded leader run(s). It summarises performance ranges, leadership " +
      "style distribution, LEAD framework scores and the decision tendencies " +
      "observed across the cohort, highlighting where the organisation is " +
      "strong and where development focus is warranted.</p>";

    let html =
      "<!DOCTYPE html><html><head><meta charset='utf-8'/>" +
      "<title>JCB Leadership Assessment — Company Culture Analysis</title>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:24px;line-height:1.5;}" +
      "h1{font-size:22px;margin:0 0 4px 0;}" +
      "h2{font-size:16px;margin:22px 0 8px 0;border-bottom:2px solid #FFCB00;padding-bottom:4px;}" +
      "h3{font-size:14px;margin:12px 0 4px 0;}" +
      "p{margin:4px 0;}" +
      "table{border-collapse:collapse;width:100%;margin:8px 0;}" +
      "td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}" +
      "th{background:#f4f4f4;}" +
      ".meta{color:#555;font-size:13px;margin-bottom:12px;}" +
      ".block{margin:10px 0;padding:8px 10px;border-left:3px solid #FFCB00;background:#fafafa;}" +
      ".category{color:#777;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;}" +
      "</style></head><body>" +
      this._buildReportHeaderBlock(
        "Company Culture Analysis",
        "JCB Leadership Assessment — " + playerCount + " Leaders",
        ["Cohort size: " + playerCount + " leaders", "Generated: " + generated],
      ) +
      openingSummary;

    // --- 2. Executive Summary ------------------------------------------------
    html +=
      "<h2>Executive Summary</h2>" +
      "<table>" +
      "<tr><th>Measure</th><th>Value</th></tr>" +
      "<tr><td>Leaders analysed</td><td>" +
      esc(playerCount) +
      "</td></tr>" +
      "<tr><td>Met basic targets</td><td>" +
      esc(metrics.successCount || 0) +
      " of " +
      esc(playerCount) +
      "</td></tr>" +
      "<tr><td>Achieved optimal</td><td>" +
      esc(metrics.optimalCount || 0) +
      " of " +
      esc(playerCount) +
      "</td></tr>" +
      "<tr><td>Style spread</td><td>" +
      esc(leadership.spreadLabel || "n/a") +
      "</td></tr>" +
      "</table>";

    // --- 3. Performance Ranges ----------------------------------------------
    html +=
      "<h2>Performance Ranges</h2>" +
      "<table>" +
      "<tr><th>Metric</th><th>Median</th><th>Range</th></tr>" +
      "<tr><td>Revenue Growth</td><td>" +
      num(metrics.medianGrowth, 1) +
      "%</td><td>" +
      num(metrics.minGrowth, 1) +
      "% - " +
      num(metrics.maxGrowth, 1) +
      "%</td></tr>" +
      "<tr><td>Team Morale</td><td>" +
      pct(metrics.medianMorale, 0) +
      "%</td><td>" +
      pct(metrics.minMorale, 0) +
      "% - " +
      pct(metrics.maxMorale, 0) +
      "%</td></tr>" +
      "<tr><td>Staff Attrition</td><td>" +
      num(metrics.medianAttrition, 1) +
      "%</td><td>" +
      num(metrics.minAttrition, 1) +
      "% - " +
      num(metrics.maxAttrition, 1) +
      "%</td></tr>" +
      "<tr><td>Profit Margin</td><td>" +
      num(metrics.medianProfitMargin, 0) +
      "%</td><td>Median across the cohort</td></tr>" +
      "</table>";

    // --- 4. Leadership Style Distribution -----------------------------------
    const aggregate = leadership.aggregate || {};
    let styleRows = "";
    Object.keys(aggregate).forEach((style) => {
      styleRows +=
        "<tr><td>" +
        esc(cap(style)) +
        "</td><td>" +
        pct(aggregate[style], 0) +
        "%</td></tr>";
    });
    if (!styleRows) {
      styleRows = "<tr><td colspan='2'>No style data</td></tr>";
    }
    const mostUsed = leadership.mostUsed || ["n/a", 0];
    const leastUsed = leadership.leastUsed || ["n/a", 0];
    html +=
      "<h2>Leadership Style Distribution</h2>" +
      "<table><tr><th>Style</th><th>Aggregate Share</th></tr>" +
      styleRows +
      "</table>" +
      "<p><strong>Diversity index:</strong> " +
      pct((leadership.diversity || 0) * 100, 0) +
      "%</p>" +
      "<p><strong>Most Used:</strong> " +
      esc(cap(mostUsed[0])) +
      " (" +
      pct(mostUsed[1], 0) +
      "%) &nbsp; <strong>Least Used:</strong> " +
      esc(cap(leastUsed[0])) +
      " (" +
      pct(leastUsed[1], 0) +
      "%)</p>";

    // --- 5. LEAD Framework Scores -------------------------------------------
    const leadDims = [
      ["Leadership", lead.leadership],
      ["Excellence", lead.excellence],
      ["Agility", lead.agility],
      ["Determination", lead.determination],
    ];
    let leadRows = "";
    leadDims.forEach(([label, stats]) => {
      const s = stats || {};
      leadRows +=
        "<tr><td>" +
        esc(label) +
        "</td><td>" +
        num(s.median, 0) +
        "</td><td>" +
        num(s.avg, 0) +
        "</td><td>" +
        num(s.min, 0) +
        " - " +
        num(s.max, 0) +
        "</td><td>" +
        esc(s.consistency || "n/a") +
        "</td></tr>";
    });
    html +=
      "<h2>LEAD Framework Scores</h2>" +
      "<table><tr><th>Dimension</th><th>Median</th><th>Average</th>" +
      "<th>Range</th><th>Consistency</th></tr>" +
      leadRows +
      "</table>";

    // --- 6. By Business Function --------------------------------------------
    const funcSegments = (segments.byFunction || []).filter(
      (s) => s && s.sufficient === true,
    );
    if (funcSegments.length > 0) {
      html += "<h2>By Business Function</h2>";
      funcSegments.forEach((seg) => {
        html +=
          "<div class='block'>" +
          "<h3>" +
          esc(seg.name || "Unknown") +
          " (" +
          esc(seg.count || 0) +
          " leaders)</h3>" +
          "<p><strong>Dominant style:</strong> " +
          esc(cap(seg.dominantStyle || "n/a")) +
          "</p>" +
          "<p><strong>Average growth:</strong> " +
          num(seg.avgGrowth, 1) +
          "% &nbsp; <strong>Average morale:</strong> " +
          num(seg.avgMorale, 0) +
          "% &nbsp; <strong>Average attrition:</strong> " +
          num(seg.avgAttrition, 1) +
          "%</p>" +
          "</div>";
      });
    }

    // --- 7. By Seniority -----------------------------------------------------
    const senSegments = (segments.bySeniority || []).filter(
      (s) => s && s.sufficient === true,
    );
    if (senSegments.length > 0) {
      html += "<h2>By Seniority</h2>";
      senSegments.forEach((seg) => {
        html +=
          "<div class='block'>" +
          "<h3>" +
          esc(seg.name || "Unknown") +
          " (" +
          esc(seg.count || 0) +
          " leaders)</h3>" +
          "<p><strong>Dominant style:</strong> " +
          esc(cap(seg.dominantStyle || "n/a")) +
          "</p>" +
          "<p><strong>Average growth:</strong> " +
          num(seg.avgGrowth, 1) +
          "% &nbsp; <strong>Average morale:</strong> " +
          num(seg.avgMorale, 0) +
          "% &nbsp; <strong>Average attrition:</strong> " +
          num(seg.avgAttrition, 1) +
          "%</p>" +
          "</div>";
      });
    }

    // --- 8. What the Data Shows ---------------------------------------------
    if (observations.length > 0) {
      html += "<h2>What the Data Shows</h2>";
      observations.forEach((obs) => {
        const o = obs || {};
        html +=
          "<div class='block'>" +
          "<div class='category'>" +
          esc(o.category || "") +
          "</div>" +
          "<h3>" +
          esc(o.headline || "") +
          "</h3>" +
          "<p>" +
          esc(o.detail || "") +
          "</p>" +
          "</div>";
      });
    }

    // --- 9. Suggested Focus Areas -------------------------------------------
    if (recommendations.length > 0) {
      html += "<h2>Suggested Focus Areas</h2>";
      recommendations.forEach((rec, index) => {
        const r = rec || {};
        const actions = r.actions || [];
        html +=
          "<div class='block'>" +
          "<h3>Focus " +
          esc(index + 1) +
          ": " +
          esc(r.title || "") +
          "</h3>" +
          "<p><strong>Why:</strong> " +
          esc(r.rationale || "") +
          "</p>";
        if (actions.length > 0) {
          html += "<p><strong>Suggested actions:</strong></p><ol>";
          actions.forEach((action) => {
            html += "<li>" + esc(action) + "</li>";
          });
          html += "</ol>";
        }
        html += "</div>";
      });
    }

    // --- 10. Decision Tendencies --------------------------------------------
    if (decisions.available === true) {
      const info = decisions.infoSeekingBehavior || {};
      html +=
        "<h2>Decision Tendencies</h2>" +
        "<table>" +
        "<tr><th>Measure</th><th>Value</th></tr>" +
        // Decision rates are proportions of total decisions, bounded 0-100.
        "<tr><td>Aggressive decision rate</td><td>" +
        pct(decisions.aggressiveDecisionRate, 1) +
        "%</td></tr>" +
        "<tr><td>Collaborative decision rate</td><td>" +
        pct(decisions.collaborativeDecisionRate, 1) +
        "%</td></tr>" +
        "<tr><td>Average info requests per player</td><td>" +
        num(info.avgRequestsPerPlayer, 1) +
        "</td></tr>" +
        "</table>";
    }

    html += "</body></html>";
    return html;
  }

  renderCultureDashboard(analysis) {
    const container = document.getElementById("culture-content");

    let html = "";

    // Executive Summary Card
    html += '<div class="culture-summary-card">';
    html += `<h2>Executive Summary</h2>`;
    html += `<p style="margin-bottom: 20px; color: rgba(255, 255, 255, 0.85); line-height: 1.6;">This dashboard describes the collective leadership culture of your team based on ${analysis.playerCount} completed simulations. All figures are drawn directly from the players' own results - there is no external benchmark.</p>`;
    html += `<div class="culture-stat-row">`;
    html += `<div class="culture-stat"><span class="culture-stat-label">Leaders Analysed:</span><span class="culture-stat-value">${analysis.playerCount}</span></div>`;
    html += `<div class="culture-stat"><span class="culture-stat-label">Met Basic Targets:</span><span class="culture-stat-value">${analysis.metrics.successCount} of ${analysis.playerCount}</span></div>`;
    html += `<div class="culture-stat"><span class="culture-stat-label">Achieved Optimal:</span><span class="culture-stat-value">${analysis.metrics.optimalCount} of ${analysis.playerCount}</span></div>`;
    html += `<div class="culture-stat"><span class="culture-stat-label">Style Spread:</span><span class="culture-stat-value">${analysis.leadership.spreadLabel}</span></div>`;
    html += `</div>`;
    html += "</div>";

    // Aggregate Metrics (descriptive ranges)
    html += '<div class="culture-section">';
    html += "<h2>📊 Performance Ranges</h2>";
    html += '<div class="culture-metrics-grid">';
    html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Revenue Growth</div>
            <div class="culture-metric-value">${analysis.metrics.medianGrowth.toFixed(1)}%</div>
            <div class="culture-metric-target">Median (range ${analysis.metrics.minGrowth.toFixed(1)}% - ${analysis.metrics.maxGrowth.toFixed(1)}%)</div>
        </div>`;
    html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Team Morale</div>
            <div class="culture-metric-value">${analysis.metrics.medianMorale.toFixed(0)}%</div>
            <div class="culture-metric-target">Median (range ${analysis.metrics.minMorale.toFixed(0)}% - ${analysis.metrics.maxMorale.toFixed(0)}%)</div>
        </div>`;
    html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Staff Attrition</div>
            <div class="culture-metric-value">${analysis.metrics.medianAttrition.toFixed(1)}%</div>
            <div class="culture-metric-target">Median (range ${analysis.metrics.minAttrition.toFixed(1)}% - ${analysis.metrics.maxAttrition.toFixed(1)}%)</div>
        </div>`;
    html += `<div class="culture-metric-card">
            <div class="culture-metric-label">Profit Margin</div>
            <div class="culture-metric-value">${analysis.metrics.medianProfitMargin.toFixed(0)}%</div>
            <div class="culture-metric-target">Median across the cohort</div>
        </div>`;
    html += "</div>";
    html += "</div>";

    // Leadership Style Distribution
    html += '<div class="culture-section">';
    html += "<h2>👥 Leadership Style Distribution</h2>";
    html += `<div class="culture-diversity-score">`;
    html += `<strong>Style Spread:</strong> ${analysis.leadership.spreadLabel}`;
    html += ` (diversity index ${(analysis.leadership.diversity * 100).toFixed(0)}%)`;
    html += `</div>`;
    html += '<div class="culture-style-bars">';

    Object.entries(analysis.leadership.aggregate).forEach(
      ([style, percentage]) => {
        html += `<div class="culture-style-bar">`;
        html += `<div class="culture-style-label">${this.capitalizeFirst(style)}</div>`;
        html += `<div class="culture-style-track">`;
        html += `<div class="culture-style-fill" style="width: ${percentage}%"></div>`;
        html += `</div>`;
        html += `<div class="culture-style-percentage">${percentage.toFixed(0)}%</div>`;
        html += `</div>`;
      },
    );

    html += "</div>";
    html += `<p class="culture-insight"><strong>Most Used:</strong> ${this.capitalizeFirst(analysis.leadership.mostUsed[0])} (${analysis.leadership.mostUsed[1].toFixed(0)}%) | `;
    html += `<strong>Least Used:</strong> ${this.capitalizeFirst(analysis.leadership.leastUsed[0])} (${analysis.leadership.leastUsed[1].toFixed(0)}%)</p>`;
    html += "</div>";

    // LEAD Scores (descriptive ranges)
    html += '<div class="culture-section">';
    html += "<h2>🎯 LEAD Framework Scores</h2>";
    html += '<div class="culture-lead-grid">';
    html += this.renderLEADRange("Leadership", analysis.lead.leadership);
    html += this.renderLEADRange("Excellence", analysis.lead.excellence);
    html += this.renderLEADRange("Agility", analysis.lead.agility);
    html += this.renderLEADRange("Determination", analysis.lead.determination);
    html += "</div>";
    html += "</div>";

    // Segmentation by function
    const funcSegments = analysis.segments.byFunction.filter(
      (s) => s.sufficient,
    );
    if (funcSegments.length > 0) {
      html += '<div class="culture-section">';
      html += "<h2>🏢 By Business Function</h2>";
      html += '<div class="culture-segment-grid">';
      funcSegments.forEach((seg) => {
        html += `<div class="culture-segment-card">`;
        html += `<h3>${seg.name} <span class="culture-segment-count">${seg.count} leaders</span></h3>`;
        html += `<p><strong>Most used style:</strong> ${this.capitalizeFirst(seg.dominantStyle || "n/a")}</p>`;
        html += `<p><strong>Average growth:</strong> ${seg.avgGrowth.toFixed(1)}%</p>`;
        html += `<p><strong>Average morale:</strong> ${seg.avgMorale.toFixed(0)}%</p>`;
        html += `<p><strong>Average attrition:</strong> ${seg.avgAttrition.toFixed(1)}%</p>`;
        html += `</div>`;
      });
      html += "</div>";
      html += "</div>";
    }

    // Segmentation by seniority
    const senSegments = analysis.segments.bySeniority.filter(
      (s) => s.sufficient,
    );
    if (senSegments.length > 0) {
      html += '<div class="culture-section">';
      html += "<h2>📈 By Seniority</h2>";
      html += '<div class="culture-segment-grid">';
      senSegments.forEach((seg) => {
        html += `<div class="culture-segment-card">`;
        html += `<h3>${seg.name} <span class="culture-segment-count">${seg.count} leaders</span></h3>`;
        html += `<p><strong>Most used style:</strong> ${this.capitalizeFirst(seg.dominantStyle || "n/a")}</p>`;
        html += `<p><strong>Average growth:</strong> ${seg.avgGrowth.toFixed(1)}%</p>`;
        html += `<p><strong>Average morale:</strong> ${seg.avgMorale.toFixed(0)}%</p>`;
        html += `<p><strong>Average attrition:</strong> ${seg.avgAttrition.toFixed(1)}%</p>`;
        html += `</div>`;
      });
      html += "</div>";
      html += "</div>";
    }

    // Observations
    if (analysis.observations.length > 0) {
      html += '<div class="culture-section culture-observations">';
      html += "<h2>🔍 What the Data Shows</h2>";
      analysis.observations.forEach((obs) => {
        html += `<div class="culture-observation-card">`;
        html += `<div class="culture-observation-category">${obs.category}</div>`;
        html += `<h3>${obs.headline}</h3>`;
        html += `<p>${obs.detail}</p>`;
        html += `</div>`;
      });
      html += "</div>";
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      html += '<div class="culture-section culture-recommendations">';
      html += "<h2>💡 Suggested Focus Areas</h2>";
      analysis.recommendations.forEach((rec, index) => {
        const displayPriority = index + 1;
        html += `<div class="culture-rec-card priority-${displayPriority}">`;
        html += `<div class="culture-rec-header">`;
        html += `<h3><span class="culture-rec-number">Focus ${displayPriority}</span> ${rec.title}</h3>`;
        html += `</div>`;
        html += `<div class="culture-rec-body">`;
        html += `<p><strong>Why:</strong> ${rec.rationale}</p>`;
        html += `<h4>Suggested actions:</h4>`;
        html += `<ul>`;
        rec.actions.forEach((action) => {
          html += `<li>${action}</li>`;
        });
        html += `</ul>`;
        html += `</div>`;
        html += `</div>`;
      });
      html += "</div>";
    }

    container.innerHTML = html;
  }

  renderLEADRange(dimension, stats) {
    return `
            <div class="culture-lead-card">
                <div class="culture-lead-dimension">${dimension}</div>
                <div class="culture-lead-scores">
                    <div class="culture-lead-current" title="Median score">${stats.median.toFixed(0)}</div>
                    <div class="culture-lead-vs">median</div>
                    <div class="culture-lead-benchmark" title="Average score">${stats.avg.toFixed(0)} avg</div>
                </div>
                <div class="culture-lead-gap">range ${stats.min.toFixed(0)} - ${stats.max.toFixed(0)} pts (${stats.consistency})</div>
            </div>
        `;
  }
}

// Initialize game immediately
const game = new GameEngine();
window.game = game; // Make it globally available

window.addEventListener("DOMContentLoaded", () => {
  game.init();
});
