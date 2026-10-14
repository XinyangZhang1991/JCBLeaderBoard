// Game Engine - Core game logic and state management

// Granularity of the budget sliders. Slider <input> values are integers, so
// the £M value is multiplied by this scale for the DOM and divided back out
// when read. 20 gives 0.05 £M steps, which divides evenly into every budget
// in use (0.4, 0.5, 0.25) so the full allocation is always reachable.
const SLIDER_SCALE = 20;

// BUGFIX (B7): single dev flag for the engine's diagnostic logging, matching
// the flag defined in app.js. Enable with ?debug=1 in the URL or by setting
// window.__JCB_DEBUG__ = true before the scripts run. When false, every
// console.log below is suppressed so the live demo console stays quiet.
// console.error / console.warn are deliberately NOT gated.
const DEBUG_ENABLED =
  (typeof window !== "undefined" &&
    (window.__JCB_DEBUG__ === true ||
      (window.location &&
        /[?&]debug=1(?:&|$)/.test(window.location.search)))) ||
  false;

class GameEngine {
  constructor() {
    this.state = {
      playerName: "",
      jobFunction: "",
      seniority: "",
      selfIdentifiedStyle: "",
      consentGiven: false,
      consentCapturedAt: null,
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
      timeRemaining: 1200, // 20 minutes in seconds (9 scenarios, ~130s each)
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

    // Home-screen leaderboard round filter (1 or 2). Round 1 and Round 2 are
    // scored against different benchmarks and scenario counts, so they are
    // shown on separate boards. Defaults to Round 1.
    this.leaderboardRound = 1;
  }

  init() {
    if (DEBUG_ENABLED) console.log("JCB Leadership in Action initialized");
    this.loadLeaderboard();
    this.showScreen("welcome-screen");
  }

  // Strict total-order comparator shared with tools/merge-results.js so the
  // live leaderboard matches the merged leaderboard exactly.
  //   growth DESC, leadTotal DESC, timestamp ASC, runId ASC
  // Falls back to a local implementation when ResultsStore is unavailable.
  compareLeaderboardRecords(a, b) {
    if (
      typeof window !== "undefined" &&
      window.ResultsStore &&
      typeof window.ResultsStore.compareRecords === "function"
    ) {
      return window.ResultsStore.compareRecords(a, b);
    }
    const growthA = Number(a && a.growth) || 0;
    const growthB = Number(b && b.growth) || 0;
    if (growthB !== growthA) return growthB - growthA;
    const leadTotal = (r) =>
      (Number(r && r.leadership) || 0) +
      (Number(r && r.excellence) || 0) +
      (Number(r && r.agility) || 0) +
      (Number(r && r.determination) || 0);
    const la = leadTotal(a);
    const lb = leadTotal(b);
    if (lb !== la) return lb - la;
    const ta = Number(a && a.timestamp) || 0;
    const tb = Number(b && b.timestamp) || 0;
    if (ta !== tb) return ta - tb;
    const ra = String((a && a.runId) || "");
    const rb = String((b && b.runId) || "");
    if (ra < rb) return -1;
    if (ra > rb) return 1;
    return 0;
  }

  loadLeaderboard() {
    // The MAIN-SCREEN leaderboard shows the LOCAL cohort - every run played on
    // this machine - so it must NOT be gated by the public-display consent flag.
    // Consent controls the PUBLIC/LIVE leaderboard (multiplayer display), which
    // is filtered separately in live-sync.js. Filtering the local board by
    // consent made it show only the single most-recent consenting run, which is
    // why it "only ever showed one person".
    //
    // BUGFIX (#7): the cache persists the FULL sorted list, so the top-10 slice
    // must happen HERE, at render time.
    //
    // BUGFIX (#8): on a fresh browser the local cache holds only THIS player's
    // run(s), so the board showed a single row even though the server already
    // had a full cohort. We now render the local cache immediately, then merge
    // in the server's /api/leaderboard cohort and re-render, so the home-screen
    // board matches the live board.
    this._renderLeaderboardRows(this.getLeaderboardData());
    this._mergeServerLeaderboard();
  }

  // Which round the home-screen leaderboard is currently showing. Round 1 and
  // Round 2 are scored against different benchmarks (171 vs 114 cumulative
  // LEAD) and different scenario counts, so their scores are NOT comparable.
  // Defaults to Round 1; the tab strip calls setLeaderboardRound() to switch.
  _leaderboardRound() {
    return this.leaderboardRound === 2 ? 2 : 1;
  }

  // Normalise a record's round. Legacy records written before the `round`
  // field existed are treated as Round 1 (the only round that existed then).
  _recordRound(record) {
    const r = record && record.round;
    return Number(r) === 2 ? 2 : 1;
  }

  // Switch the home-screen leaderboard between Round 1 and Round 2 and repaint.
  setLeaderboardRound(round) {
    this.leaderboardRound = Number(round) === 2 ? 2 : 1;
    // Reflect the active tab.
    const tabs = document.querySelectorAll(".leaderboard-round-tab");
    if (tabs && tabs.forEach) {
      tabs.forEach((tab) => {
        const tabRound = Number(tab.getAttribute("data-round")) === 2 ? 2 : 1;
        tab.classList.toggle("active", tabRound === this.leaderboardRound);
      });
    }
    // Repaint from the local cache immediately, then re-merge the server cohort
    // so the freshly-selected round also picks up server-only players.
    this._renderLeaderboardRows(this.getLeaderboardData());
    this._mergeServerLeaderboard();
  }

  // Render the TOP 3 rows for the CURRENT ROUND from a raw record list into
  // #leaderboard-container. Records from the other round are filtered out so
  // Round 1 and Round 2 scores are never mixed on the same board.
  //
  // The front/welcome screen is a teaser: it shows only the podium (top 3) so
  // players are not tempted to scroll a long list before registering. The FULL
  // board for every player is available via the LIVE LEADERBOARD button directly
  // below the list (see index.html). The complete, uncapped cohort is still
  // fetched and merged (see _mergeServerLeaderboard) - only the DISPLAY here is
  // limited to 3.
  _renderLeaderboardRows(records) {
    const round = this._leaderboardRound();
    const FRONT_SCREEN_LIMIT = 3;
    const allForRound = (Array.isArray(records) ? records : [])
      .filter((r) => this._recordRound(r) === round)
      .slice()
      .sort((a, b) => this.compareLeaderboardRecords(a, b));
    const leaderboardData = allForRound.slice(0, FRONT_SCREEN_LIMIT);
    const hiddenCount = Math.max(0, allForRound.length - leaderboardData.length);
    const container = document.getElementById("leaderboard-container");

    // Remember exactly what is on screen. The per-row VIEW FEEDBACK / PDF
    // buttons pass their row index, and _reconstructPlayerState() must resolve
    // that index against THIS filtered+sorted list - not the raw cache, which
    // now contains both rounds and would resolve the wrong player.
    this._displayedLeaderboard = leaderboardData;

    if (!container) return;

    if (leaderboardData.length === 0) {
      container.innerHTML = `<div class="leaderboard-empty">No Round ${round} players yet.<br/>Be the first to lead!</div>`;
      return;
    }

    const rowsHtml = leaderboardData
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

    // Teaser footer: tell the player how many more finished this round and
    // point them at the LIVE LEADERBOARD button (rendered directly below this
    // list in index.html) for the full board.
    const moreHtml =
      hiddenCount > 0
        ? `<div class="leaderboard-more">+${hiddenCount} more player${
            hiddenCount === 1 ? "" : "s"
          } this round — tap <strong>🔴 LIVE LEADERBOARD</strong> below to see the full board</div>`
        : "";

    container.innerHTML = rowsHtml + moreHtml;
  }

  // Merge the server's public cohort into the home-screen board so a fresh
  // browser (whose local cache holds only its own run) still shows the full
  // leaderboard. The server projection omits `consent`, so it is trusted as
  // already-public. Local records win on runId collisions (they carry the
  // richer, full-fidelity fields). Never throws; silently no-ops offline.
  _mergeServerLeaderboard() {
    if (typeof fetch !== "function") return;
    if (typeof location === "undefined" || location.protocol === "file:")
      return;

    // Fetch the FULL cohort (no limit) so the round filter has every record to
    // choose from. A `?limit=10` would return the global top 10, which - once
    // rounds are separated - could contain ZERO rows for the selected round.
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.leaderboard)) return;
        const local = this.getLeaderboardData();
        const byRunId = new Map();
        // Server rows first, then local rows override on matching runId.
        data.leaderboard.forEach((row) => {
          if (row && row.runId) byRunId.set(row.runId, row);
        });
        local.forEach((row) => {
          if (!row || !row.runId) return;
          const existing = byRunId.get(row.runId);
          // Local rows normally carry the richer, full-fidelity fields, so they
          // win on a runId collision. BUT a stale/partial local row (e.g. one
          // written by an older build that never persisted the individual LEAD
          // dimensions) must NOT blank out a complete server row - otherwise the
          // home-screen board renders "L:0 E:0 A:0 D:0" for that player. Only
          // let the local row win when it actually carries the LEAD dimensions,
          // or when the server row is missing them too.
          if (existing && !this._hasLeadDimensions(row) && this._hasLeadDimensions(existing)) {
            return;
          }
          byRunId.set(row.runId, row);
        });
        const merged = Array.from(byRunId.values());
        // Always repaint after a successful merge. The previous guard
        // (`merged.length > local.length`) compared TOTAL counts, so it skipped
        // the repaint whenever the local cache and the server held the same
        // NUMBER of records - even when the server's set contained a record for
        // the currently-selected round that the local cache lacked (e.g. a
        // Round 2 run played on another machine). That is exactly why the
        // Round 2 board could read "No Round 2 players yet" despite the run
        // existing on the server. A repaint is cheap; correctness wins.
        this._renderLeaderboardRows(merged);
      })
      .catch(() => {
        /* offline / server down - keep the local render */
      });
  }

  // ------------------------------------------------------------------
  // Consent & segmentation predicates
  //
  // Thin wrappers over the shared ResultsStore helpers so the browser and the
  // Node merge tool apply EXACTLY the same rules. Each falls back to a local
  // implementation when ResultsStore is unavailable (e.g. a bare file:// load
  // that failed to include results-store.js).
  // ------------------------------------------------------------------

  // Display-time consent predicate.
  //
  // Delegates to the shared ResultsStore helper so the browser and the Node
  // merge tool apply EXACTLY the same rule. Fail-safe: a missing/legacy
  // consent object means NOT publicly displayable. The local fallback mirrors
  // the canonical ResultsStore.isPubliclyDisplayable() behaviour.
  isPubliclyDisplayable(record) {
    const store = typeof window !== "undefined" ? window.ResultsStore : null;
    if (store && typeof store.isPubliclyDisplayable === "function") {
      return store.isPubliclyDisplayable(record);
    }
    return !!(
      record &&
      record.consent &&
      record.consent.publicDisplay === true
    );
  }

  hasJcbBusinessFunction(record) {
    const store = typeof window !== "undefined" ? window.ResultsStore : null;
    if (store && typeof store.hasJcbBusinessFunction === "function") {
      return store.hasJcbBusinessFunction(record);
    }
    const fn = record && record.jobFunction;
    return (
      [
        "Engineering",
        "Manufacturing",
        "Commercial",
        "Finance",
        "Human Resources",
        "Operations",
        "Product Development",
        "Marketing",
        "IT / Digital",
      ].indexOf(fn) !== -1
    );
  }

  isCultureEligible(record) {
    const store = typeof window !== "undefined" ? window.ResultsStore : null;
    if (store && typeof store.isCultureEligible === "function") {
      return store.isCultureEligible(record);
    }
    return this.hasJcbBusinessFunction(record);
  }

  // LEAD course cohort predicate. Delegates to the shared ResultsStore helper
  // when available; falls back to a local canonical-values-only implementation.
  leadCohortOf(record) {
    const store = typeof window !== "undefined" ? window.ResultsStore : null;
    if (store && typeof store.leadCohortOf === "function") {
      return store.leadCohortOf(record);
    }
    if (!record) return "";
    const raw =
      record.player && typeof record.player === "object"
        ? record.player.leadCohort
        : record.leadCohort;
    const v = raw === null || raw === undefined ? "" : String(raw).trim();
    return v === "2025" || v === "2026" ? v : "";
  }

  anonymiseForCulture(record) {
    const store = typeof window !== "undefined" ? window.ResultsStore : null;
    if (store && typeof store.anonymiseForCulture === "function") {
      return store.anonymiseForCulture(record);
    }
    if (!record) return record;
    const clone = JSON.parse(JSON.stringify(record));
    if (!this.isPubliclyDisplayable(clone)) {
      clone.name = "Anonymous";
      clone.anonymised = true;
    }
    return clone;
  }

  // Raw cached leaderboard rows (ALL runs, regardless of consent).
  //
  // Issue 1: the consent filter was moved OUT of this read path and into the
  // display path (loadLeaderboard / getDisplayableLeaderboard). The cache must
  // RETAIN every run so it stays transferable; only rendering is gated.
  getLeaderboardData() {
    try {
      const data = localStorage.getItem("jcb_leaderboard");
      const parsed = data ? JSON.parse(data) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error("Error loading leaderboard:", e);
      return [];
    }
  }

  // Display-time view of the leaderboard: applies the consent predicate to the
  // raw cache. Non-consenting runs are retained in the cache but hidden here.
  getDisplayableLeaderboard() {
    return this.getLeaderboardData().filter((r) =>
      this.isPubliclyDisplayable(r),
    );
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

  // Culture/executive-analysis view of the cohort:
  //   1. keep only records with a valid JCB business function
  //      (isCultureEligible) - non-JCB players are excluded entirely;
  //   2. anonymise every non-consenting record (anonymiseForCulture) so
  //      declined-consent JCB players are included but not identifiable.
  // getCultureData() still returns the RAW cohort for admin/export use.
  getCultureDataForAnalysis() {
    try {
      const cohort = this.getCultureData();
      if (!Array.isArray(cohort)) return [];
      return cohort
        .filter((r) => this.isCultureEligible(r))
        .map((r) => this.anonymiseForCulture(r));
    } catch (e) {
      console.error("Error building culture analysis data:", e);
      return [];
    }
  }

  // Hydrate the local culture store from the AUTHORITATIVE server cohort.
  //
  // Why this exists: the browser's jcb_culture_data / jcb_leaderboard can hold
  // flat rows written by an OLDER build that did not persist the segmentation
  // fields (jobFunction / seniority / leadCohort). Such rows fail
  // isCultureEligible() and the dashboard reports "0 players" even though the
  // leaderboard clearly has entries. The server's canonical cohort always
  // carries these fields, so we fetch it, flatten each record, and merge it
  // into the local stores (keyed by runId). This is a no-op when the server is
  // unavailable (e.g. opened from file://) - the local store is then used as-is.
  //
  // Returns true when the local store was changed.
  async hydrateCultureFromServer() {
    try {
      const store = typeof window !== "undefined" ? window.ResultsStore : null;
      if (!store || typeof store.fetchCohort !== "function") return false;

      const serverCohort = await store.fetchCohort();
      if (!Array.isArray(serverCohort) || serverCohort.length === 0) {
        return false;
      }

      // Flatten canonical -> flat so the shape matches the local stores.
      const flatRecords = serverCohort.map((rec) => {
        try {
          return typeof store.canonicalToFlat === "function"
            ? store.canonicalToFlat(rec)
            : rec;
        } catch (e) {
          return rec;
        }
      });

      const mergeInto = (key) => {
        let local;
        try {
          const raw = localStorage.getItem(key);
          local = raw ? JSON.parse(raw) : [];
        } catch (e) {
          local = [];
        }
        if (!Array.isArray(local)) local = [];

        const byRunId = new Map();
        local.forEach((r) => {
          if (r && r.runId) byRunId.set(r.runId, r);
        });

        // Value-equality helper: objects (e.g. leadershipProfile) must be
        // compared by content, not reference, or hydration is never idempotent.
        const sameValue = (a, b) => {
          if (a === b) return true;
          if (a && b && typeof a === "object" && typeof b === "object") {
            try {
              return JSON.stringify(a) === JSON.stringify(b);
            } catch (e) {
              return false;
            }
          }
          return false;
        };

        let changed = false;
        flatRecords.forEach((rec) => {
          if (!rec || !rec.runId) return;
          const existing = byRunId.get(rec.runId);
          if (existing) {
            // Prefer the server's authoritative values for the segmentation
            // fields, but never clobber a locally-present value with a blank.
            [
              "jobFunction",
              "seniority",
              "leadCohort",
              "personalityColor",
              "leadershipStyle",
              "leadershipProfile",
            ].forEach((field) => {
              const want = rec[field];
              const wantPresent =
                want !== undefined &&
                want !== null &&
                want !== "" &&
                !(typeof want === "object" && Object.keys(want).length === 0);
              if (wantPresent && !sameValue(existing[field], want)) {
                existing[field] = want;
                changed = true;
              }
            });
          } else {
            local.push(rec);
            byRunId.set(rec.runId, rec);
            changed = true;
          }
        });

        if (changed) {
          try {
            localStorage.setItem(key, JSON.stringify(local));
          } catch (e) {
            /* storage full / disabled - ignore */
          }
        }
        return changed;
      };

      const a = mergeInto("jcb_culture_data");
      const b = mergeInto("jcb_leaderboard");
      return a || b;
    } catch (e) {
      console.error("Error hydrating culture data from server:", e);
      return false;
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

      // Index existing culture records for O(1) membership checks. We keep a
      // reference to the record itself (not just the id) so a matching
      // leaderboard row can BACK-FILL fields the culture row is missing.
      const cultureByRunId = new Map();
      const cultureByLegacyKey = new Map();
      culture.forEach((p) => {
        if (!p) return;
        if (p.runId) cultureByRunId.set(p.runId, p);
        else cultureByLegacyKey.set(this.legacyRecordKey(p), p);
      });

      // Segmentation fields the culture analysis depends on. Older builds wrote
      // flat leaderboard rows WITHOUT these, so a culture store populated by an
      // earlier build rejects every record as "not JCB" and reports 0 players.
      // Back-filling them here makes the store self-heal on read.
      const SEGMENT_FIELDS = [
        "jobFunction",
        "seniority",
        "leadCohort",
        "personalityColor",
        "leadershipStyle",
        "leadershipProfile",
      ];

      let changed = false;
      leaderboard.forEach((record) => {
        if (!record) return;

        // Prefer the stable runId; fall back to timestamp+name for legacy rows.
        const key = record.runId
          ? record.runId
          : this.legacyRecordKey(record);
        const existing = record.runId
          ? cultureByRunId.get(record.runId)
          : cultureByLegacyKey.get(key);

        if (existing) {
          // Already present: repair any missing segmentation fields in place.
          SEGMENT_FIELDS.forEach((field) => {
            const have = existing[field];
            const want = record[field];
            const haveEmpty =
              have === undefined ||
              have === null ||
              have === "" ||
              (typeof have === "object" && Object.keys(have).length === 0);
            const wantPresent =
              want !== undefined &&
              want !== null &&
              want !== "" &&
              !(typeof want === "object" && Object.keys(want).length === 0);
            if (haveEmpty && wantPresent) {
              existing[field] = want;
              changed = true;
            }
          });
          return;
        }

        culture.push(record);
        changed = true;

        if (record.runId) {
          cultureByRunId.set(record.runId, record);
        } else {
          cultureByLegacyKey.set(key, record);
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

      // 2. Maintain the top-10 display leaderboard (also idempotent).
      //    Issue 1: cache ALL runs regardless of consent so the scoreboard
      //    RETAINS information and stays transferable. The consent gate is
      //    applied at DISPLAY time only (loadLeaderboard / getDisplayableLeaderboard).
      const displayable = this.isPubliclyDisplayable(playerData);
      const leaderboard = this.getLeaderboardData();
      if (!leaderboard.some((p) => p.runId === playerData.runId)) {
        leaderboard.push(playerData);
      }

      // Sort using the SAME strict total order as tools/merge-results.js so the
      // live leaderboard is deterministic and matches the merged leaderboard.
      leaderboard.sort((a, b) => this.compareLeaderboardRecords(a, b));

      // BUGFIX (#7): persist the FULL sorted list, not a top-10 slice. The
      // top-10 limit is a DISPLAY concern and is applied at render time in
      // loadLeaderboard(). Truncating here silently dropped any run that did
      // not crack the top 10, so a returning player's new run could be saved
      // (and publicly displayable) yet never appear on the scoreboard.
      localStorage.setItem("jcb_leaderboard", JSON.stringify(leaderboard));

      // 3. Report the player's placement for the results-screen reveal.
      //    Rank is computed ONLY against publicly displayable records, so a
      //    non-consenting player never consumes a rank slot invisibly. A
      //    non-consenting player gets a hidden placement (rank: null).
      //
      //    ROUND-SCOPED: Round 1 and Round 2 are independent competitions with
      //    different benchmarks (171 vs 114 cumulative LEAD; 9 vs 6 scenarios),
      //    so a Round 2 player must be ranked against OTHER ROUND 2 PLAYERS
      //    only - never against the Round 1 cohort. Ranking across both rounds
      //    made a lone Round 2 player read "16th of 16" purely because 15 Round
      //    1 runs existed. Filter to the player's own round before ranking.
      const playerRound = this._recordRound(playerData);
      const publicCohort = cohort.filter(
        (p) =>
          this.isPubliclyDisplayable(p) && this._recordRound(p) === playerRound,
      );
      const sortedPublic = [...publicCohort].sort((a, b) =>
        this.compareLeaderboardRecords(a, b),
      );
      const rank = displayable
        ? sortedPublic.findIndex((p) => p.runId === playerData.runId) + 1
        : 0;
      // 4. ALSO write the run to the portable results folder via the layered
      //    strategy (server -> File System Access API -> download). This is
      //    fire-and-forget: localStorage above remains the local cache and the
      //    game must never block or fail because a file write is unavailable.
      this.persistRunToResultsFolder(playerData);

      return {
        rank: rank > 0 ? rank : null,
        total: publicCohort.length,
        inTop10: rank > 0 && rank <= 10,
        hidden: !displayable,
      };
    } catch (e) {
      console.error("Error saving to leaderboard:", e);
      return null;
    }
  }

  // Persist a completed run to the portable results folder using the layered
  // write path defined in v2/RESULTS_PERSISTENCE_DESIGN.md §5. Never throws.
  // Returns a Promise resolving to the layer descriptor, or null when the
  // ResultsStore module is unavailable.
  persistRunToResultsFolder(playerData) {
    try {
      const store = typeof window !== "undefined" ? window.ResultsStore : null;
      if (!store || typeof store.recordAndPersist !== "function") {
        return null;
      }
      return store
        .recordAndPersist(playerData)
        .then((out) => {
          if (out && out.result && out.result.ok) {
            if (DEBUG_ENABLED)
              console.log(
                "Results folder write via layer: " + out.result.layer,
              );
          }
          return out;
        })
        .catch((e) => {
          console.warn("Results folder write failed (non-fatal):", e);
          return null;
        });
    } catch (e) {
      console.warn("Results folder write failed (non-fatal):", e);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Migration UI (design doc §8, Option D)
  // Export the existing localStorage cohort to a JSON file and import a
  // results file back in, so historical data is never lost.
  // ------------------------------------------------------------------

  // Export the full localStorage cohort as a portable JSON file. The payload
  // is a { schemaVersion, exportedAt, recordCount, records: [...] } wrapper in
  // the canonical schema, so it can be fed straight to the merge tool.
  exportResults() {
    try {
      const store = typeof window !== "undefined" ? window.ResultsStore : null;
      const cohort = this.getCultureData();
      if (!cohort || cohort.length === 0) {
        alert("No results to export yet.");
        return;
      }

      const records = store ? store.normaliseMany(cohort) : cohort;

      const payload = {
        schemaVersion: store ? store.SCHEMA_VERSION : 1,
        exportedAt: new Date().toISOString(),
        recordCount: records.length,
        records: records,
      };

      const date = new Date().toISOString().slice(0, 10);
      const filename = "jcb_cohort_export_" + date + ".json";
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      this._downloadBlob(blob, filename);
      if (DEBUG_ENABLED)
        console.log("Exported " + records.length + " records to " + filename);
    } catch (e) {
      console.error("Error exporting results:", e);
      alert("Could not export results: " + e.message);
    }
  }

  // Import a results file (canonical cohort wrapper, a flat array, or a single
  // run record) and merge it into the localStorage cache. De-duplicates by
  // runId (legacy fallback timestamp|name) so re-importing is safe.
  importResults(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const store =
          typeof window !== "undefined" ? window.ResultsStore : null;
        const incoming = store
          ? store.normaliseMany(parsed)
          : Array.isArray(parsed)
            ? parsed
            : parsed && Array.isArray(parsed.records)
              ? parsed.records
              : [parsed];

        if (!incoming || incoming.length === 0) {
          alert("No records found in that file.");
          return;
        }

        const cohort = this.getCultureData();
        const seen = new Set(
          cohort.map((p) => (p && p.runId ? p.runId : this.legacyRecordKey(p))),
        );

        let added = 0;
        incoming.forEach((rec) => {
          const flat = store ? store.canonicalToFlat(rec) : rec;
          const key = flat.runId ? flat.runId : this.legacyRecordKey(flat);
          if (seen.has(key)) return;
          seen.add(key);
          cohort.push(flat);
          added++;
        });

        localStorage.setItem("jcb_culture_data", JSON.stringify(cohort));

        // Rebuild the leaderboard cache with the shared comparator.
        // BUGFIX (B2): persist the FULL sorted list, consistent with
        // saveToLeaderboard(). The top-10 limit is a DISPLAY concern applied
        // at render time in loadLeaderboard(); truncating here silently
        // dropped any imported run outside the top 10 from the cache.
        const sorted = [...cohort].sort((a, b) =>
          this.compareLeaderboardRecords(a, b),
        );
        localStorage.setItem("jcb_leaderboard", JSON.stringify(sorted));

        this.loadLeaderboard();
        alert(
          "Imported " +
            added +
            " new record(s). " +
            cohort.length +
            " total in the local cohort.",
        );
      } catch (e) {
        console.error("Error importing results:", e);
        alert("Could not import results: " + e.message);
      }
    };
    reader.onerror = () => alert("Could not read that file.");
    reader.readAsText(file);
  }

  // Wire the hidden file input used by the Import button.
  triggerImportResults() {
    const input = document.getElementById("import-results-input");
    if (input) input.click();
  }

  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
    // Reset scroll so each screen opens at the top (phone scrolls the page).
    window.scrollTo(0, 0);
  }

  startRegistration() {
    if (DEBUG_ENABLED) console.log("startRegistration called");
    this.showScreen("registration-screen");
    if (DEBUG_ENABLED) console.log("registration screen should now be visible");
  }

  // Select the player's self-identified primary leadership style.
  //
  // `el` is the .radio-option element that was clicked (passed as `this` from
  // the inline onclick). Relying on the deprecated `window.event` was fragile:
  // when the click landed on the child <input> or the inner text, the event
  // target could be a descendant and the `selected` class was applied to the
  // wrong node (or not at all), so the highlight and the stored value could
  // disagree. We now resolve the option element deterministically and keep the
  // visual state, the radio input and the stored value in lock-step.
  selectLeadershipStyle(style, el) {
    this.state.selfIdentifiedStyle = style;

    // Resolve the option element: prefer the element passed from the handler,
    // then fall back to a value lookup (covers programmatic calls).
    let targetOption = el || null;
    if (!targetOption && typeof document !== "undefined") {
      const input = document.querySelector(
        `.radio-option input[value="${style}"]`,
      );
      targetOption = input ? input.closest(".radio-option") : null;
    }

    // Clear the highlight from every option, then apply it to the chosen one.
    document.querySelectorAll(".radio-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    if (targetOption) {
      targetOption.classList.add("selected");
    }

    // Keep the underlying radio inputs consistent: check the chosen value and
    // uncheck the rest, so the native form state matches the visual state.
    document
      .querySelectorAll('input[name="leadership-style"]')
      .forEach((input) => {
        input.checked = input.value === style;
      });
  }

  async validateAndStartBriefing() {
    const nameInput = document.getElementById("player-name");
    const functionInput = document.getElementById("player-function");
    const seniorityInput = document.getElementById("player-seniority");
    const cohortInput = document.getElementById("player-cohort");
    const consentCheckbox = document.getElementById("consent-checkbox");

    // BUGFIX (#7 latent hazard): capture consent FIRST, before any validation
    // early-return. Previously consentGiven was only assigned after all the
    // validation checks, so any early return (e.g. the returning-player branch
    // below) left it at its default `false`, which flowed to
    // `consent.publicDisplay:false` and silently hid the run. Capturing it here
    // guarantees every path that reaches the game has the player's real choice.
    this.state.consentGiven = !!(consentCheckbox && consentCheckbox.checked);
    this.state.consentCapturedAt = new Date().toISOString();

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

    // Consent is NON-BLOCKING: a player who does not consent can still play.
    // The value only controls whether the run appears on the public
    // scoreboard (see saveToLeaderboard / getLeaderboardData). Default false.
    this.state.playerName = nameInput.value.trim();
    this.state.jobFunction = functionInput.value;
    this.state.seniority = seniorityInput.value;
    // #1: optional LEAD course cohort (2025 / 2026 / blank).
    this.state.leadCohort = cohortInput ? cohortInput.value : "";

    // Returning-player detection: if this name matches a previous completed
    // run, offer the choice of replaying Round 1 or advancing to Round 2.
    // New players are completely unaffected and go straight to the briefing.
    //
    // ASYNC: findReturningPlayer() now also consults the shared server cohort,
    // so a player who completed a run on ANOTHER device/browser (or whose local
    // store was cleared) is still recognised as returning. Previously only the
    // local jcb_culture_data store was searched, so the Round 2 option silently
    // failed to appear for returning players on a fresh device.
    const returning = await this.findReturningPlayer(this.state.playerName);
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

  // Search for a prior completed run whose name matches the entered name
  // case-insensitively and trimmed. Returns the most recent match (by
  // timestamp), preferring a Round 1 record when one exists because Round 2 is
  // the "learned from feedback" follow-up.
  //
  // ASYNC: searches BOTH the local jcb_culture_data store AND the shared server
  // cohort. The local store alone is not enough - a returning player who played
  // on another device/browser, or whose localStorage was cleared, has no local
  // record, so the Round 2 option silently failed to appear. The server cohort
  // (via ResultsStore.fetchCohort) holds every run across all machines.
  async findReturningPlayer(name) {
    if (!name || !name.trim()) return null;

    const target = name.trim().toLowerCase();

    // Local cohort first (fast, synchronous, always available).
    let cohort = this.getCultureData();

    // Merge in the server cohort when the game is served by the Node server.
    // Failures are non-fatal: we simply fall back to the local cohort.
    try {
      const store = typeof window !== "undefined" ? window.ResultsStore : null;
      if (store && typeof store.fetchCohort === "function") {
        const serverCohort = await store.fetchCohort();
        if (Array.isArray(serverCohort) && serverCohort.length > 0) {
          // Normalise the server records to the flat shape the local store uses
          // so the name/round/timestamp fields line up.
          const flatServer =
            typeof store.canonicalToFlat === "function"
              ? serverCohort.map((r) => store.canonicalToFlat(r))
              : serverCohort;
          // De-duplicate by runId (falling back to timestamp+name) so a run
          // present in both stores is not counted twice.
          const seen = new Set();
          const merged = [];
          cohort.concat(flatServer).forEach((r) => {
            if (!r) return;
            const key =
              r.runId ||
              String(r.timestamp || "") + "|" + String(r.name || "");
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(r);
          });
          cohort = merged;
        }
      }
    } catch (e) {
      /* server unavailable - use the local cohort only */
    }

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
    this.state.timeRemaining = 1200;
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

  // Applies the correct briefing narrative and heading for the given round.
  // Round 1 shows #briefing-round1, Round 2 shows #briefing-round2.
  // Guards against missing elements so it never throws.
  _applyBriefingForRound(round) {
    const round1 = document.querySelector("#briefing-round1");
    const round2 = document.querySelector("#briefing-round2");

    // If either container is absent, do nothing rather than throwing.
    if (!round1 || !round2) {
      return;
    }

    // Default to Round 1 when the round is undefined or not 2.
    const isRound2 = round === 2;

    round1.style.display = isRound2 ? "none" : "block";
    round2.style.display = isRound2 ? "block" : "none";

    const heading = document.querySelector("#briefing-heading");
    if (heading) {
      heading.textContent = isRound2
        ? "ROUND 2 MISSION BRIEFING"
        : "MISSION BRIEFING";
    }
  }

  startBriefing() {
    this.showScreen("briefing-screen");

    // Show the briefing narrative that matches the current round.
    this._applyBriefingForRound(this.state.round || 1);

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
    // Profit Margin tile removed from the HUD (only 2 of 9 Round 1 scenarios
    // modify it, so it looked frozen). Guard the lookup so the removed element
    // does not throw; profitMargin is still tracked for win-condition logic.
    const profitEl = document.getElementById("metric-profit");
    if (profitEl) {
      profitEl.textContent = `${this.state.profitMargin.toFixed(0)}%`;
    }
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
      // Profit delta chip suppressed: the Profit Margin tile is no longer on
      // the HUD. animateMetricDelta already no-ops when the element is absent.
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
    // Issue 2: only suppress TRUE zero so small fractional deltas still show.
    if (!delta || Math.abs(delta) < 0.005) return;

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
    // Issue 2: render at 1 decimal (matching the impact card) so a +0.4 delta
    // shows as "+0.4" rather than rounding to "0".
    chip.textContent = `${sign}${delta.toFixed(1)}${unit}`;
    el.parentElement.style.position = "relative";
    el.parentElement.appendChild(chip);

    setTimeout(() => chip.remove(), 1600);
    setTimeout(() => el.classList.remove("delta-good", "delta-bad"), 1200);
  }

  animateMoraleDelta(delta) {
    // Issue 2: stop suppressing morale chips below 0.5 so small morale moves
    // are still surfaced to the player.
    if (!delta || Math.abs(delta) < 0.005) return;

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
    chip.textContent = `${sign}${delta.toFixed(1)}%`;
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
        scenario.description = `Your top-performing regional sales manager just resigned, citing "unsustainable pressure and lack of support." Two other high-performers are rumoured to be interviewing elsewhere. Team attrition is now at ${Math.round(state.attrition)}% (healthy is <10%) and morale is ${Math.round(state.morale)}% (concerning). You have hit ${state.growth.toFixed(1)}% growth, but at what cost? An anonymous employee survey reveals burnout and a sense of being undervalued.`;
      } else {
        // Mixed performance - moderate scenario
        scenario.description = `A valued regional sales manager has resigned, citing work-life balance concerns. While team morale (${Math.round(state.morale)}%) and attrition (${Math.round(state.attrition)}%) are in acceptable ranges, this departure has raised questions about your leadership approach. How do you respond?`;
      }
    }

    // DIFFICULT CONVERSATION - Adapt severity based on morale
    if (scenario.id === "difficult_conversation") {
      if (state.morale >= 75) {
        // High morale - make it about coaching excellence, not crisis
        scenario.description = `Your team is thriving overall (morale: ${Math.round(state.morale)}%). However, one senior team member (20 years at JCB) is underperforming at 25% below target for two quarters. They are respected and well-liked, but the morale of their team is starting to drop.`;
      } else if (state.morale < 60) {
        // Low morale - make it a symptom of broader issues
        scenario.description = `Your team morale is at ${Math.round(state.morale)}%, and now a senior team member (20 years at JCB) is underperforming at 25% below target. Others wonder if this is a sign of broader problems. This conversation could be a turning point - will you address only the individual, or the systemic issues?`;
      }
    }

    // AMBIGUOUS SIGNAL - Adapt based on growth trajectory
    if (scenario.id === "ambiguous_signal") {
      if (state.growth > 15) {
        // Strong growth - frame as maintaining momentum
        scenario.description = `Despite strong growth of ${state.growth.toFixed(1)}%, your sales team reports that customer sentiment is "changing" but the team cannot pinpoint why. Sales velocity has slowed 8% month-over-month. You need to address this before it impacts your momentum.

**Sales Director:** "A competitor launched a new hydraulic feature we do not have"
**Finance Director:** "Economic uncertainty making buyers delay decisions"
**Your gut:** "The approach of our team has gone stale - we are not listening to customers"

Data is incomplete and contradictory. Your CFO demands immediate action. Your strategy lead wants 3 weeks to research properly.`;
      } else if (state.growth < 10) {
        // Poor growth - frame as critical pivot point
        scenario.description = `Your growth is only ${state.growth.toFixed(1)}%, well below target, and now customer sentiment is "changing." Sales velocity has slowed another 8%. You cannot afford to get this wrong.

**Sales Director:** "A competitor launched a new hydraulic feature we do not have"
**Finance Director:** "Economic uncertainty making buyers delay decisions"
**Your gut:** "The approach of our team has gone stale - we are not listening to customers"

Data is incomplete. Every week of delay costs £5K in lost sales. What do you do?`;
      }
    }

    // NEW: COMPETITOR THREAT - Adapt based on prior growth achievement
    if (scenario.id === "competitor_threat") {
      if (state.growth > 15) {
        // Strong growth - competitor targets YOUR success
        scenario.description = `You have achieved strong ${state.growth.toFixed(1)}% growth, which has drawn competitive attention. A major competitor just announced price cuts (15% below JCB) and exclusive dealer incentives. They are specifically targeting your top accounts.

Your Board wants immediate response. You have £400K to allocate. How do you defend your position?`;
      } else if (state.growth < 10) {
        // Poor growth - you're already vulnerable
        scenario.description = `Your growth is struggling at ${state.growth.toFixed(1)}%, and now a major competitor announces aggressive price cuts (15% below JCB) and exclusive dealer incentives. You are already behind - this could be devastating.

Your Board is concerned. You have £400K to allocate. How do you respond?`;
      }
    }

    // NEW: INNOVATION GAMBLE - Adapt based on team capacity (morale/attrition)
    if (scenario.id === "innovation_gamble") {
      if (state.morale > 75 && state.attrition < 10) {
        // Strong team - ready for bold moves
        scenario.description = `Your energized team (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%) has developed a revolutionary hydraulic innovation 9 months ahead of schedule. Market testing shows 40% efficiency gain - unprecedented. The Board is thrilled but cautious.

**Engineering:** "Ready now - we have tested it thoroughly"
**Sales:** "Dealers want it immediately"
**Manufacturing:** "12-week delay gives us time to scale properly"
**CFO:** "Early launch = £500K revenue this year, delayed launch = £250K risk if competitor beats us"

Your team has the energy for a sprint. When do you launch?`;
      } else if (state.morale < 65 || state.attrition > 15) {
        // Exhausted team - risky to push them
        scenario.description = `Your exhausted team (morale: ${Math.round(state.morale)}%, attrition: ${Math.round(state.attrition)}%) has developed a hydraulic innovation that shows promise. Market testing suggests strong potential, but your people are burned out.

**Engineering:** "We can rush it, but we are stretched thin"
**Sales:** "Dealers want it, but honestly, our team needs a break"
**Manufacturing:** "We NEED 12 weeks to do this right and not kill our people"
**CFO:** "Early launch = £500K revenue this year, but if we break the team, what is next year worth?"

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
        scenario.description = `After months of aggressive targets and pressure to deliver (growth: ${state.growth.toFixed(1)}%), a forklift driver in the factory suffered serious injuries loading equipment. Initial investigation suggests corners were cut to meet deadlines. HSE is investigating.

Your team is shaken. Some privately wonder if the relentless pace you set contributed to this. What is your response?`;
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
      if (DEBUG_ENABLED) console.log("All scenarios complete, ending game");
      this.endGame();
      return;
    }

    // Reset submission flag for new scenario
    this.state.isSubmitting = false;

    this.state.currentScenario = scenarioIndex;
    const scenario = this.scenarios[scenarioIndex];

    // Adapt scenario based on current game state
    this.adaptScenarioToState(scenario);

    if (DEBUG_ENABLED) console.log("Loading scenario:", scenario.id);

    // Reset scroll for the new scenario (phone scrolls the page, not the container)
    const scenarioContainer = document.getElementById("scenario-container");
    if (scenarioContainer) {
      scenarioContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);

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

  // Issue 3: scenario descriptions contain literal Markdown emphasis (`**x**`)
  // but are injected via innerHTML with no Markdown renderer, so the asterisks
  // leaked into the UI. This single formatter converts `**x**` -> `<strong>x</strong>`
  // so every current and future occurrence renders cleanly.
  formatInlineMarkdown(text) {
    if (typeof text !== "string") return text;
    return text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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
                    <p>${this.formatInlineMarkdown(scenario.description)}</p>
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
    if (value < 1) {
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
                            ${this.formatMoney(0)}
                        </span>
                    </div>
                    <input type="range"
                           class="slider"
                           min="0"
                           max="${slider.max * SLIDER_SCALE}"
                           step="${(slider.step || 1 / SLIDER_SCALE) * SLIDER_SCALE}"
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
    // HTML5 drag-and-drop (draggable="true") does NOT fire on touch devices, so
    // on a phone a drag just scrolls the page. We therefore render explicit
    // up/down move buttons that work everywhere (touch + mouse + keyboard),
    // while keeping drag-and-drop as a desktop convenience.
    let html = `<div class="ranking-container" id="ranking-container-${decisionIndex}">`;
    items.forEach((item, i) => {
      const isFirst = i === 0;
      const isLast = i === items.length - 1;
      html += `
                <div class="ranking-item" draggable="true" data-decision="${decisionIndex}" data-item="${i}">
                    <div class="ranking-number">${i + 1}</div>
                    <div class="ranking-text">${item}</div>
                    <div class="ranking-move">
                        <button type="button"
                                class="ranking-move-btn"
                                aria-label="Move up"
                                ${isFirst ? "disabled" : ""}
                                onclick="game.moveRankingItem(${decisionIndex}, this, -1)">▲</button>
                        <button type="button"
                                class="ranking-move-btn"
                                aria-label="Move down"
                                ${isLast ? "disabled" : ""}
                                onclick="game.moveRankingItem(${decisionIndex}, this, 1)">▼</button>
                    </div>
                </div>
            `;
    });
    html += "</div>";
    return html;
  }

  // Move a ranking item up (-1) or down (+1) by one position. Works on touch
  // devices where HTML5 drag-and-drop is unavailable. `btn` is the clicked
  // button; we walk up to its .ranking-item and swap it with the adjacent
  // sibling, then renumber and refresh the disabled state of every button.
  moveRankingItem(decisionIndex, btn, direction) {
    const item = btn && btn.closest ? btn.closest(".ranking-item") : null;
    if (!item) return;
    const parent = item.parentNode;
    if (!parent) return;

    if (direction < 0) {
      const prev = item.previousElementSibling;
      if (prev) parent.insertBefore(item, prev);
    } else {
      const next = item.nextElementSibling;
      if (next) parent.insertBefore(next, item);
    }

    this.updateRankingNumbers(parent);
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
      // half the MOVED slider's own step so floating-point noise never blocks a
      // legal move, while still rejecting any genuine overspend.
      //
      // TOLERANCE FIX: this previously used the global default step (1/20 =
      // £50K), i.e. a £25K tolerance. On a fine-grained slider (the £5K-step
      // celebration slider) that tolerance exceeded the slider's entire £10K
      // range, so the clamp never engaged and the budget could be overspent by
      // up to £25K. Deriving the tolerance from the moved slider's own step
      // keeps it proportional to the granularity actually in play.
      const movedStep =
        (decision.sliders[sliderIndex].step || 1 / SLIDER_SCALE) * SLIDER_SCALE;
      const tolerance = movedStep / 2 / SLIDER_SCALE;
      if (total > budgetLimit + tolerance) {
        // Clamp the moved slider to the exact maximum allowed at this
        // granularity. Because SLIDER_SCALE divides every budget evenly,
        // Math.floor lands exactly on a reachable step (e.g. 0.05) instead of
        // stranding the final increment of headroom.
        const currentSlider = sliders[sliderIndex];
        const maxAllowed =
          budgetLimit - (total - parseFloat(value) / SLIDER_SCALE);
        // Snap the clamped value to the slider's own step so fractional steps
        // (e.g. a £5K step on a £10K-capped slider) land on a reachable value.
        // The tiny epsilon absorbs floating-point error (e.g. 0.5 - 0.3) so a
        // legal step is never floored away.
        //
        // UNIT FIX: `maxAllowed` is expressed in £ millions while `step` is in
        // native slider units (0..max*SLIDER_SCALE). Dividing millions by a
        // native step collapsed the clamp to 0 for every sub-£1M budget (i.e.
        // always), so an overspend snapped the slider to zero instead of the
        // largest reachable value. Convert maxAllowed to native units first.
        const step =
          (decision.sliders[sliderIndex].step || 1 / SLIDER_SCALE) *
          SLIDER_SCALE;
        currentSlider.value =
          Math.floor((maxAllowed * SLIDER_SCALE) / step + 1e-9) * step;
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
      const numberEl = item.querySelector(".ranking-number");
      if (numberEl) numberEl.textContent = index + 1;

      // Keep the up/down buttons' disabled state in sync with the new order so
      // the first item cannot move up and the last cannot move down.
      const upBtn = item.querySelector(
        '.ranking-move-btn[aria-label="Move up"]',
      );
      const downBtn = item.querySelector(
        '.ranking-move-btn[aria-label="Move down"]',
      );
      if (upBtn) upBtn.disabled = index === 0;
      if (downBtn) downBtn.disabled = index === items.length - 1;
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

    if (DEBUG_ENABLED) console.log("Selected info requests:", selected);

    if (selected.length === 0) {
      alert("Please select at least one information source.");
      return;
    }

    const scenario = this.scenarios[this.state.currentScenario];
    if (DEBUG_ENABLED) console.log("Current scenario:", scenario.title);

    this.state.infoRequests.push({
      scenario: this.state.currentScenario,
      requests: selected,
    });

    // Show the actual information content
    let infoContent =
      '<h3>ADDITIONAL INFORMATION</h3><div style="text-align: left;">';
    selected.forEach((index) => {
      const info = scenario.additionalInfo[index];
      if (DEBUG_ENABLED) console.log("Showing info:", info.label, info.content);
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

    if (DEBUG_ENABLED) console.log("Info modal updated with content");
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
      if (DEBUG_ENABLED)
        console.log("Submission already in progress, ignoring duplicate click");
      return;
    }

    const scenario = this.scenarios[this.state.currentScenario];

    if (DEBUG_ENABLED)
      console.log("Submit button clicked for scenario:", scenario.id);
    if (DEBUG_ENABLED)
      console.log("Scenario decisions count:", scenario.decisions.length);

    // Validate all decisions have been made
    if (!this.validateAllDecisionsMade(scenario)) {
      if (DEBUG_ENABLED)
        console.log("Validation failed: Not all decisions made");
      alert("Please make all decisions before continuing.");
      return;
    }

    if (DEBUG_ENABLED) console.log("All decisions validated successfully");

    // Validate budget constraints before submitting
    if (!this.validateBudgetConstraints(scenario)) {
      if (DEBUG_ENABLED)
        console.log("Validation failed: Budget constraint exceeded");
      alert(
        "You have exceeded the allocated budget. Please adjust your spending allocation.",
      );
      return;
    }

    if (DEBUG_ENABLED) console.log("Budget constraints validated successfully");

    // Underspend feedback: never block submission, but let the player know
    // money is still on the table so they can choose to allocate it.
    const underspend = this.getUnallocatedBudget(scenario);
    if (underspend > 0) {
      const proceed = confirm(
        `You have ${this.formatMoney(underspend)} unallocated. Submit anyway?`,
      );
      if (!proceed) {
        if (DEBUG_ENABLED)
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

      if (DEBUG_ENABLED)
        console.log(
          `Checking decision ${decisionIndex}: ${decision.title}, type: ${decision.type}`,
        );

      switch (decision.type) {
        case "choice":
          const selected = document.querySelector(
            `.choice-option.selected[data-decision="${decisionIndex}"]`,
          );
          if (!selected) {
            if (DEBUG_ENABLED)
              console.log(
                `Decision ${decisionIndex} (${decision.title}) - NO SELECTION FOUND`,
              );
            return false;
          }
          if (DEBUG_ENABLED)
            console.log(`Decision ${decisionIndex} - Choice selected`);
          break;

        case "slider":
          // Sliders have default values, so they're always "made"
          if (DEBUG_ENABLED)
            console.log(`Decision ${decisionIndex} - Slider (auto-valid)`);
          break;

        case "ranking":
          // Rankings are pre-populated, so they're always "made"
          if (DEBUG_ENABLED)
            console.log(`Decision ${decisionIndex} - Ranking (auto-valid)`);
          break;

        case "timeline":
          // Timeline sliders have default values, so they're always "made"
          if (DEBUG_ENABLED)
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

        if (DEBUG_ENABLED)
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
          // BUGFIX (B1): guard against a missing timeline element, consistent
          // with the `choice` case above. Without this, a null dereference
          // threw a TypeError and aborted submitDecision(), stranding the
          // player mid-scenario. 0 is the sensible default timeline position.
          data.choices.push({
            type: "timeline",
            value: timeline ? parseInt(timeline.value) : 0,
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
        if (DEBUG_ENABLED)
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
        if (DEBUG_ENABLED)
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
        if (DEBUG_ENABLED)
          console.log(
            `Morale drift toward baseline ${moraleBaseline}: -${drift} (now ${this.state.morale.toFixed(0)})`,
          );
      }

      // PROFIT MARGIN REALISM: Link to attrition, morale, and growth
      // High attrition costs money (recruitment, training, knowledge loss)
      if (this.state.attrition > 15) {
        const attritionProfitPenalty = (this.state.attrition - 15) * 0.3;
        this.state.profitMargin -= attritionProfitPenalty;
        if (DEBUG_ENABLED)
          console.log(
            `High attrition (${this.state.attrition.toFixed(0)}%) reduced profit margin by ${attritionProfitPenalty.toFixed(1)}%`,
          );
      }

      // Low morale reduces productivity and profit
      if (this.state.morale < 60) {
        const moraleProfitPenalty = (60 - this.state.morale) * 0.2;
        this.state.profitMargin -= moraleProfitPenalty;
        if (DEBUG_ENABLED)
          console.log(
            `Low morale (${this.state.morale.toFixed(0)}%) reduced profit margin by ${moraleProfitPenalty.toFixed(1)}%`,
          );
      }

      // High growth can improve profit margin (economies of scale)
      if (this.state.growth > 25) {
        const growthProfitBonus = (this.state.growth - 25) * 0.15;
        this.state.profitMargin += growthProfitBonus;
        if (DEBUG_ENABLED)
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

      // BALANCE TUNING (PART B): one-dimensional leadership is unsustainable.
      // A leader who leans on a single Goleman style for most of the run builds
      // a brittle culture: the team has no repertoire to draw on when the
      // situation changes. We model this as a small, compounding morale drag
      // and attrition creep once a single style dominates the profile.
      // This is deliberately gentle per-decision (it accumulates over the run)
      // so it tunes rather than rewrites the existing behaviour.
      if (impact.leadershipStyles) {
        const styleTotal = Object.values(this.state.leadershipStyles).reduce(
          (sum, v) => sum + v,
          0,
        );
        if (styleTotal > 0) {
          const dominantShare =
            Math.max(...Object.values(this.state.leadershipStyles)) /
            styleTotal;
          // Only bite once one style exceeds the canonical "balanced" ceiling.
          const balanceCeiling =
            typeof LEAD_CONSTANTS !== "undefined" &&
            LEAD_CONSTANTS.isBalancedMax
              ? LEAD_CONSTANTS.isBalancedMax / 100
              : 0.6;
          if (dominantShare > balanceCeiling) {
            const overConcentration = dominantShare - balanceCeiling;
            // Up to ~0.8 morale and ~0.6 attrition per decision at extreme
            // concentration (100% one style). Small enough to preserve the
            // existing feel, large enough to matter across 9 scenarios.
            const concentrationMoraleDrag = overConcentration * 8;
            const concentrationAttritionCreep = overConcentration * 6;
            this.state.morale -= concentrationMoraleDrag;
            this.state.attrition += concentrationAttritionCreep;
            if (DEBUG_ENABLED)
              console.log(
                `⚖️ One-dimensional style concentration (${(dominantShare * 100).toFixed(0)}% single style): -${concentrationMoraleDrag.toFixed(1)} morale, +${concentrationAttritionCreep.toFixed(1)} attrition`,
              );
          }
        }
      }

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
          if (DEBUG_ENABLED)
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
        if (DEBUG_ENABLED)
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
      leadership: LEAD_CONSTANTS.benchmarkPerScenario,
      excellence: LEAD_CONSTANTS.benchmarkPerScenario,
      agility: LEAD_CONSTANTS.benchmarkPerScenario,
      determination: LEAD_CONSTANTS.benchmarkPerScenario,
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

    if (DEBUG_ENABLED) {
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
    }

    // BONUSES: Apply LEAD-based multipliers to business outcomes
    // UPDATED 2026-05-17: Reduced by 75% to ensure realistic outcomes

    // 1. DETERMINATION drives GROWTH (determined leaders push for results)
    if (leadRatios.determination > 0.8) {
      const determinationBonus = (leadRatios.determination - 0.8) * 1; // CALIBRATED: max +1% growth (was +2%)
      this.state.growth += determinationBonus;
      if (DEBUG_ENABLED)
        console.log(
          `✅ Determination bonus: +${determinationBonus.toFixed(1)}% growth`,
        );
    }

    // 2. LEADERSHIP quality improves MORALE (people follow great leaders)
    if (leadRatios.leadership > 0.8) {
      const leadershipMoraleBonus = (leadRatios.leadership - 0.8) * 1.5; // CALIBRATED: max +1.5% morale (was +3%)
      this.state.morale += leadershipMoraleBonus;
      if (DEBUG_ENABLED)
        console.log(
          `✅ Leadership morale bonus: +${leadershipMoraleBonus.toFixed(1)}% morale`,
        );
    }

    // 3. EXCELLENCE reduces ATTRITION (good decision-making retains talent)
    if (leadRatios.excellence > 0.8) {
      const excellenceRetention = (leadRatios.excellence - 0.8) * 1; // CALIBRATED: max -1% attrition (was -2%)
      this.state.attrition -= excellenceRetention;
      if (DEBUG_ENABLED)
        console.log(
          `✅ Excellence retention: -${excellenceRetention.toFixed(1)}% attrition`,
        );
    }

    // 4. AGILITY improves PROFIT MARGIN (adaptability optimizes operations)
    if (leadRatios.agility > 0.8) {
      const agilityProfitBonus = (leadRatios.agility - 0.8) * 0.5; // CALIBRATED: max +0.5% profit margin (was +1%)
      this.state.profitMargin += agilityProfitBonus;
      if (DEBUG_ENABLED)
        console.log(
          `✅ Agility profit bonus: +${agilityProfitBonus.toFixed(1)}% profit margin`,
        );
    }

    // BALANCE TUNING (PART B): reward genuine balance, penalise one-dimensional
    // leadership. The four LEAD dimensions are the strategic expression of a
    // leader's repertoire; when they are all developed, the leader can flex to
    // the situation and the culture compounds. When one dimension is starved
    // (a "one-trick" leader), the culture is brittle and the business suffers.
    //
    // We measure balance as the spread of the four LEAD ratios: the closer the
    // weakest dimension is to the strongest, the more balanced the leader.
    // balanceRatio = min(ratios) / max(ratios)  → 1.0 = perfectly balanced.
    const ratioValues = [
      leadRatios.leadership,
      leadRatios.excellence,
      leadRatios.agility,
      leadRatios.determination,
    ];
    const maxRatio = Math.max(...ratioValues);
    const minRatio = Math.min(...ratioValues);
    const balanceRatio = maxRatio > 0 ? minRatio / maxRatio : 0;

    // Only reward balance when the leader is actually performing (avg >= 0.5),
    // so a uniformly weak leader does not get a balance bonus for being
    // consistently poor.
    if (avgLEADRatio >= 0.5 && balanceRatio >= 0.6) {
      // CALIBRATED: up to +1% growth and +1% morale for a fully balanced,
      // high-performing leader (halved from +2%/+2%).
      const balanceStrength = (balanceRatio - 0.6) / 0.4; // 0..1
      const balanceGrowthBonus = balanceStrength * 1;
      const balanceMoraleBonus = balanceStrength * 1;
      this.state.growth += balanceGrowthBonus;
      this.state.morale += balanceMoraleBonus;
      if (DEBUG_ENABLED)
        console.log(
          `✅ Balanced leadership bonus (spread ${(balanceRatio * 100).toFixed(0)}%): +${balanceGrowthBonus.toFixed(1)}% growth, +${balanceMoraleBonus.toFixed(1)}% morale`,
        );
    }

    // One-dimensional penalty: a leader whose weakest dimension is far below
    // their strongest (balanceRatio < 0.4) is relying on a single strength.
    // This is the "one-dimensional play is harder" requirement — it bites via
    // morale and attrition, not just a score deduction.
    if (maxRatio > 0 && balanceRatio < 0.4) {
      const imbalance = 0.4 - balanceRatio; // 0..0.4
      const imbalanceMoralePenalty = imbalance * 20; // up to -8 morale
      const imbalanceAttritionPenalty = imbalance * 15; // up to +6 attrition
      this.state.morale -= imbalanceMoralePenalty;
      this.state.attrition += imbalanceAttritionPenalty;
      if (DEBUG_ENABLED)
        console.log(
          `❌ One-dimensional leadership penalty (spread ${(balanceRatio * 100).toFixed(0)}%): -${imbalanceMoralePenalty.toFixed(1)} morale, +${imbalanceAttritionPenalty.toFixed(1)} attrition`,
        );
    }

    // NEW: PENALTIES for poor LEAD quality (enforcement mechanism)
    // If average LEAD ratio < 0.5 (significantly below benchmark), apply sustainability penalties

    if (avgLEADRatio < 0.5) {
      // Poor leadership quality causes compounding problems
      const leadDeficit = 0.5 - avgLEADRatio; // How far below 50% of benchmark

      if (DEBUG_ENABLED)
        console.log(
          `⚠️ LOW LEAD QUALITY DETECTED (${(avgLEADRatio * 100).toFixed(0)}% of benchmark)`,
        );

      // Penalty 1: Attrition increases (poor leadership drives talent away)
      const attritionPenalty = leadDeficit * 12; // Up to +6% attrition if LEAD ratio is 0
      this.state.attrition += attritionPenalty;
      if (DEBUG_ENABLED)
        console.log(
          `❌ Poor leadership attrition penalty: +${attritionPenalty.toFixed(1)}% attrition`,
        );

      // Penalty 2: Morale decreases (people feel the pressure/lack of support)
      const moralePenalty = leadDeficit * 16; // Up to -8% morale
      this.state.morale -= moralePenalty;
      if (DEBUG_ENABLED)
        console.log(
          `❌ Poor leadership morale penalty: -${moralePenalty.toFixed(1)}% morale`,
        );

      // Penalty 3: Growth degrades (unsustainable approaches fail to compound)
      // Even if you hit targets early, poor LEAD quality means execution degrades
      const growthPenalty = leadDeficit * 10; // Up to -5% growth
      this.state.growth -= growthPenalty;
      if (DEBUG_ENABLED)
        console.log(
          `❌ Unsustainable execution penalty: -${growthPenalty.toFixed(1)}% growth`,
        );

      // Penalty 4: Profit margin suffers (firefighting, inefficiency, mistakes)
      const profitPenalty = leadDeficit * 6; // Up to -3% profit margin
      this.state.profitMargin -= profitPenalty;
      if (DEBUG_ENABLED)
        console.log(
          `❌ Poor decision quality penalty: -${profitPenalty.toFixed(1)}% profit margin`,
        );
    }

    // NEW: SEVERE PENALTIES for extremely poor LEAD quality (< 0.3 of benchmark)
    if (avgLEADRatio < 0.3) {
      // This represents truly terrible leadership - near-certain failure
      if (DEBUG_ENABLED)
        console.log(
          `⚠️ EXTREMELY POOR LEAD QUALITY (${(avgLEADRatio * 100).toFixed(0)}% of benchmark) - SEVERE PENALTIES`,
        );

      // Additional attrition from toxic environment
      this.state.attrition += 8;
      if (DEBUG_ENABLED)
        console.log(`❌ Toxic environment attrition: +8% attrition`);

      // Additional morale collapse
      this.state.morale -= 12;
      if (DEBUG_ENABLED)
        console.log(`❌ Leadership crisis morale collapse: -12% morale`);
    }

    // CRITICAL FIX #1: Team Health Multipliers (from AUDIT #4)
    // High-performing teams with strong morale and low attrition deliver superior results
    // This makes team health strategically valuable (fixes "balanced leader fails" bug)

    if (DEBUG_ENABLED) {
      console.log("=== APPLYING TEAM HEALTH MULTIPLIERS ===");
      console.log(
        `Pre-multiplier - Growth: ${this.state.growth.toFixed(1)}%, Morale: ${this.state.morale.toFixed(0)}%, Attrition: ${this.state.attrition.toFixed(1)}%`,
      );
    }

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
      if (DEBUG_ENABLED) {
        console.log(
          `✅ EXCEPTIONAL TEAM HEALTH: ${teamHealthMultiplier}x growth multiplier (+${(this.state.growth - growthBefore).toFixed(1)}% growth)`,
        );
        console.log(
          `   Morale: ${cappedMorale}% (≥85%), Attrition: ${cappedAttrition.toFixed(1)}% (<8%)`,
        );
      }
    } else if (cappedMorale >= 75 && cappedAttrition < 12) {
      // Healthy teams deliver 15% more results
      const teamHealthMultiplier = 1.15;
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * teamHealthMultiplier;
      if (DEBUG_ENABLED)
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
      if (DEBUG_ENABLED)
        console.log(
          `❌ SEVERE ATTRITION PENALTY: ${cappedAttrition.toFixed(1)}% attrition → 50% growth reduction (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`,
        );
    } else if (cappedAttrition > 30) {
      // High attrition creates execution gaps
      const attritionDrag = 0.75; // 25% reduction in growth capability
      const growthBefore = this.state.growth;
      this.state.growth = this.state.growth * attritionDrag;
      if (DEBUG_ENABLED)
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
      if (DEBUG_ENABLED) {
        console.log(
          `❌ TEAM COLLAPSE: ${crisisMultiplier}x growth multiplier (-${(growthBefore - this.state.growth).toFixed(1)}% growth)`,
        );
        console.log(
          `   Morale: ${cappedMorale}% (<40%), Attrition: ${cappedAttrition.toFixed(1)}% (>40%)`,
        );
      }
    }

    // CRITICAL FIX #3: Morale Cap Waste → Productivity Bonus
    // Excess morale above 95% converts to productivity (fixes "wasted people investment" bug)
    // Every 10 points of excess morale = 1% additional growth
    if (this.state.morale > 95) {
      const excessMorale = this.state.morale - 95;
      const productivityBonus = excessMorale * 0.1; // 10 morale = 1% growth
      this.state.growth += productivityBonus;
      if (DEBUG_ENABLED)
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

    if (DEBUG_ENABLED) {
      console.log("=== FINAL METRICS AFTER LEAD MULTIPLIERS ===");
      console.log(`Growth: ${this.state.growth.toFixed(1)}%`);
      console.log(`Morale: ${this.state.morale.toFixed(0)}%`);
      console.log(`Attrition: ${this.state.attrition.toFixed(1)}%`);
      console.log(`Profit Margin: ${this.state.profitMargin.toFixed(1)}%`);
    }
  }

  // Build a per-option consequence narrative when a scenario does not hand-write
  // one. Previously only the safety near-miss scenario defined per-option
  // `consequence` text, so every other scenario fell back to a generic one-liner
  // and players only saw the "why this went well/badly" explanation on that one
  // scenario. This derives a specific, answer-aware explanation from the option's
  // leadership style/colour plus the ACTUAL metric deltas the choice produced,
  // so every scenario now explains the outcome.
  // Locate the option the player actually picked for the scenario's first
  // multiple-choice decision. `decision.choices` is ordered to match
  // `scenario.decisions`, so we walk both in lockstep and return the option
  // object for the first entry that is a "choice" with a valid index.
  getPrimaryChoiceOption(scenario, decision) {
    if (!scenario || !Array.isArray(scenario.decisions)) return null;
    const choices = (decision && decision.choices) || [];
    for (let i = 0; i < scenario.decisions.length; i++) {
      const dec = scenario.decisions[i];
      const choice = choices[i];
      if (
        dec &&
        dec.type === "choice" &&
        choice &&
        choice.type === "choice" &&
        typeof choice.index === "number" &&
        choice.index >= 0 &&
        Array.isArray(dec.options) &&
        dec.options[choice.index]
      ) {
        return dec.options[choice.index];
      }
    }
    return null;
  }

  generateOptionConsequence(primaryOption, deltas) {
    if (!primaryOption) return "";
    const style = primaryOption.style || "";
    const color = primaryOption.color || "";

    // What the chosen style tends to optimise for, in plain language.
    const styleIntent = {
      coercive: "moving fast and taking control",
      authoritative: "setting a clear direction",
      affiliative: "protecting relationships and morale",
      democratic: "bringing people into the decision",
      pacesetting: "driving hard for results",
      coaching: "developing people and capability",
    };
    const intent = styleIntent[style] || "your chosen approach";

    // Summarise the real, measured effect of the decision.
    const d = deltas || {};
    const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
    const growth = num(d.growth);
    const morale = num(d.morale);
    const attrition = num(d.attrition);
    const capability = num(d.organizationalCapability);
    const profit = num(d.profitMargin);

    const positives = [];
    const negatives = [];
    if (growth > 0.05) positives.push(`growth up ${growth.toFixed(1)}%`);
    else if (growth < -0.05)
      negatives.push(`growth down ${Math.abs(growth).toFixed(1)}%`);
    if (morale > 0.05) positives.push(`morale up ${morale.toFixed(1)}%`);
    else if (morale < -0.05)
      negatives.push(`morale down ${Math.abs(morale).toFixed(1)}%`);
    if (attrition < -0.05)
      positives.push(`attrition down ${Math.abs(attrition).toFixed(1)}%`);
    else if (attrition > 0.05)
      negatives.push(`attrition up ${attrition.toFixed(1)}%`);
    if (capability > 0.05)
      positives.push(`capability up ${capability.toFixed(1)} pts`);
    else if (capability < -0.05)
      negatives.push(`capability down ${Math.abs(capability).toFixed(1)} pts`);
    if (profit > 0.05) positives.push(`profit margin up ${profit.toFixed(1)}%`);
    else if (profit < -0.05)
      negatives.push(`profit margin down ${Math.abs(profit).toFixed(1)}%`);

    let effect;
    if (positives.length > 0 && negatives.length === 0) {
      effect = `The numbers back the call: ${positives.join(", ")}.`;
    } else if (negatives.length > 0 && positives.length === 0) {
      effect = `The cost shows up immediately: ${negatives.join(", ")}.`;
    } else if (positives.length > 0 && negatives.length > 0) {
      effect = `It is a trade-off — ${positives.join(", ")}, but ${negatives.join(", ")}.`;
    } else {
      effect =
        "The immediate metrics barely move, so the real effect will show up in how the team responds over the coming months.";
    }

    // A short, style-aware verdict so the player learns WHY it landed that way.
    let verdict;
    if (positives.length > 0 && negatives.length === 0) {
      verdict = `Leading through ${intent} was the right read of this situation.`;
    } else if (negatives.length > 0 && positives.length === 0) {
      verdict = `Leading through ${intent} did not fit what this situation actually needed.`;
    } else {
      verdict = `Leading through ${intent} bought you something but gave something else away — that is the trade-off to weigh next time.`;
    }

    return `${effect} ${verdict}`;
  }

  showConsequence(scenario, decision, deltas) {
    const modal = document.getElementById("consequence-modal");
    const textEl = document.getElementById("consequence-text");

    // Prefer a per-option consequence when the scenario defines one, so the
    // narrative can affirm the specific choice the player made.
    let consequenceText =
      scenario.consequenceText ||
      "Your decision has been recorded. The situation evolves...";

    // Find the FIRST decision that is a multiple-choice question and pair it
    // with the player's selected option. Previously this hard-coded
    // `scenario.decisions[0]`, so any scenario whose first decision was a
    // slider/ranking/timeline (or whose primary choice lived in a later
    // decision) produced NO answer-specific feedback — which is why the green
    // explanation only appeared on some scenarios.
    const primaryOption = this.getPrimaryChoiceOption(scenario, decision);
    if (primaryOption && primaryOption.consequence) {
      consequenceText = primaryOption.consequence;
    } else if (primaryOption) {
      // No hand-written consequence: generate an answer-specific explanation
      // from the option's style and the measured deltas so every scenario
      // tells the player why their choice went well or badly.
      const generated = this.generateOptionConsequence(primaryOption, deltas);
      if (generated) consequenceText = generated;
    }

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
      // Issue 2: only suppress TRUE zero. The old 0.05 threshold hid real
      // fractional impacts (e.g. +0.4 morale) and made decisions look inert.
      const negligible = Math.abs(v) < 0.005;
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
      // Issue 2: render ALL metrics at 1 decimal (matching Growth) so small
      // fractional impacts are visible instead of rounding to "0".
      pushImpact("Growth", deltas.growth, "%", 1, false);
      pushImpact("Profit", deltas.profitMargin, "%", 1, false);
      pushImpact("Morale", deltas.morale, "%", 1, false);
      pushImpact("Attrition", deltas.attrition, "%", 1, true);
      pushImpact(
        "Capability",
        deltas.organizationalCapability,
        " pts",
        1,
        false,
      );
    }

    const impactStrip =
      impactItems.length > 0
        ? `<div class="impact-strip">${impactItems.join("")}</div>`
        : "";

    // Surface the research payoff: when the player requested useful information
    // that supports the choice they made, say so explicitly. The scoring engine
    // already rewards this; without a visible acknowledgement players assumed
    // their research had no effect.
    let researchNote = "";
    const infoRequests = (this.state.infoRequests || []).find(
      (ir) => ir.scenario === this.state.currentScenario,
    );
    if (
      infoRequests &&
      infoRequests.requests &&
      infoRequests.requests.length > 0 &&
      primaryOption &&
      typeof primaryOption.index === "number" &&
      primaryOption.index >= 0
    ) {
      const useful = infoRequests.requests
        .map((i) => scenario.additionalInfo[i])
        .filter(
          (info) =>
            info &&
            info.type === "useful" &&
            info.validatesDecision &&
            info.validatesDecision.includes(primaryOption.index),
        );
      if (useful.length > 0) {
        researchNote = `<div class="research-payoff">RESEARCH PAYOFF — the evidence you gathered supported this decision.</div>`;
      }
    }

    // Render the impact card into the modal body
    const bodyEl = document.getElementById("consequence-body");
    if (bodyEl) {
      bodyEl.innerHTML = `
                <div class="impact-card">
                    <div class="impact-card-header">SCENARIO NET IMPACT</div>
                    <p class="impact-consequence">${consequenceText}</p>
                    ${researchNote}
                    ${impactStrip}
                </div>
            `;
    } else {
      // Fallback to the plain text element if the body container is absent
      textEl.textContent = consequenceText;
    }

    modal.classList.add("active");

    // Auto-continue after 20 seconds so players have time to read the impact
    // card before it advances.
    let countdown = 20;
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

    // Restore the "CALCULATING YEAR 1 RESULTS..." header. showFeedback() hides
    // it once the reveal completes (it is a loading placeholder), so a fresh
    // run must bring it back or the next player sees no loading heading.
    const resultsHeader = document.querySelector(
      "#results-screen .results-header",
    );
    if (resultsHeader) resultsHeader.style.display = "";

    // The results screen now grows with its content and the PAGE scrolls, so
    // reset the window scroll to the top. Without this the screen could open
    // part-way down, leaving a large empty gap above the feedback.
    const resultsScreen = document.getElementById("results-screen");
    if (resultsScreen) resultsScreen.scrollTop = 0;
    window.scrollTo(0, 0);

    // CRITICAL: Apply LEAD multipliers BEFORE calculating final score
    // This ensures LEAD competencies actually impact business outcomes
    this.applyLEADMultipliers();

    // Calculate final results using scoring engine
    if (window.scoringEngine) {
      if (DEBUG_ENABLED) console.log("Calculating final results...");
      try {
        // Pass the Round 1 record (if any) so the scoring engine can compute
        // the Round 2 adaptation bonus. Round 1 runs pass null and are unaffected.
        const results = scoringEngine.calculateFinalScore(
          this.state,
          this.returningPlayer || null,
        );
        if (DEBUG_ENABLED) console.log("Results calculated:", results);
        this.finalResults = results; // Store for detailed feedback view
        if (DEBUG_ENABLED)
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

    // Collapse the "CALCULATING YEAR 1 RESULTS..." loading header IMMEDIATELY.
    // It is a placeholder whose 48px heading + 40px margin reserved a tall band
    // of dead space at the very top of the page - the "swipe three times before
    // you reach any data" gap. The verdict is now the first section, so the
    // header has served its purpose the moment the reveal begins.
    const resultsHeader = document.querySelector(
      "#results-screen .results-header",
    );
    if (resultsHeader) resultsHeader.style.display = "none";

    // Animate the reveal (verdict first, then metrics) - tightened for the time
    // constraint.
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
          // Use the FILTERED + ANONYMISED view so the executive report only
          // reflects JCB business functions and never names non-consenting
          // players.
          cultureDataProvider: () => this.getCultureDataForAnalysis(),
        },
      );

      // ONE-PAGE SUMMARY: download ONLY the executive summary, not the combined
      // summary + detailed appendix. The combined report ran to ~7 pages, which
      // is not a "summary". The one-page summary is self-contained (overall
      // assessment, key strengths, development areas, recommended actions).
      const html = report.summary || report.combined || "";
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
        "</td><td class='num'>" +
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
      "@page{margin:15mm;}" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0;line-height:1.4;font-size:10.5pt;}" +
      "h1{font-size:20pt;margin:0 0 4px 0;}" +
      "h2{font-size:15pt;margin:22px 0 8px 0;border-bottom:2px solid #FFCB00;padding-bottom:4px;}" +
      "h3{font-size:12.5pt;margin:12px 0 4px 0;}" +
      "h4{font-size:11.5pt;margin:8px 0 4px 0;}" +
      "p{margin:4px 0;}" +
      "table{border-collapse:collapse;width:100%;margin:8px 0;}" +
      "td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;}" +
      "th{background:#f4f4f4;}" +
      // Numeric columns (Value / Score / Share) are right-aligned and given a
      // fixed width so the figures form a single clean vertical column instead
      // of floating at a different x-position on every row (the "wobbly" look).
      "td.num,th.num{text-align:right;width:90px;font-variant-numeric:tabular-nums;}" +
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
      "<table><tr><th>Metric</th><th class='num'>Value</th></tr>" +
      // Growth / attrition / profitMargin are the game's own metrics and are
      // meaningful above 100 / below 0, so they are only finiteness-guarded
      // (via num). Morale is conceptually a percentage of a maximum, so it is
      // clamped to 0-100 to avoid a confusing "morale 180%".
      "<tr><td>Revenue Growth</td><td class='num'>" +
      num(s.growth, 1) +
      "%</td></tr>" +
      "<tr><td>Team Morale</td><td class='num'>" +
      pct(s.morale, 0) +
      "%</td></tr>" +
      "<tr><td>Staff Attrition</td><td class='num'>" +
      num(s.attrition, 1) +
      "%</td></tr>" +
      "<tr><td>Profit Margin</td><td class='num'>" +
      num(s.profitMargin, 1) +
      "%</td></tr>" +
      "<tr><td>Organizational Capability</td><td class='num'>" +
      num(s.organizationalCapability, 0) +
      "</td></tr></table>" +
      "<h2>JCB LEAD Framework Performance</h2>" +
      "<table><tr><th>Dimension</th><th class='num'>Score</th></tr>" +
      "<tr><td>Leadership Quality</td><td class='num'>" +
      esc(s.leadership || 0) +
      "</td></tr>" +
      "<tr><td>Excellence Standards</td><td class='num'>" +
      esc(s.excellence || 0) +
      "</td></tr>" +
      "<tr><td>Agility & Adaptability</td><td class='num'>" +
      esc(s.agility || 0) +
      "</td></tr>" +
      "<tr><td>Determination to Succeed</td><td class='num'>" +
      esc(s.determination || 0) +
      "</td></tr></table>" +
      "<h2>Leadership Profile (Goleman Framework)</h2>" +
      "<table><tr><th>Style</th><th class='num'>Share</th></tr>" +
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
    // Keep the anchor in the DOM until after the click has been processed.
    // Some browsers (notably Safari/iPadOS) ignore a click on a detached
    // anchor, which made the download silently do nothing.
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    // Revoke on a longer delay: revoking on the next tick (0ms) can race the
    // download and cancel it in Safari/iPadOS and some Chrome builds. 60s is
    // long enough for the download to start while still releasing the URL.
    setTimeout(() => {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 60000);
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
        try {
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
        } catch (pdfErr) {
          // If the PDF writer fails for any reason, fall back to an HTML
          // download rather than surfacing an error — the button must always
          // produce a file.
          console.error("SimplePDF failed, falling back to HTML:", pdfErr);
          blob = null;
        }
      }

      if (!blob) {
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
    // Resolve the index against the list that is ACTUALLY on screen (filtered
    // to the selected round and sorted). Falling back to the raw cache keeps
    // this working for any caller that runs before the board has rendered.
    const leaderboardData =
      Array.isArray(this._displayedLeaderboard) &&
      this._displayedLeaderboard.length > 0
        ? this._displayedLeaderboard
        : this.getLeaderboardData();
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

  // Reveal chain, reordered so the VERDICT lands first. The outcome container
  // is now the first section in the DOM (above the metrics grid), so the player
  // sees "TARGET MET / NOT MET" immediately instead of having to scroll past the
  // whole data block to reach it. The metrics then fill in beneath the verdict.
  animateResultsReveal(results) {
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
                    : `You achieved ${this.state.growth.toFixed(1)}% growth. Target was ${this._growthTarget()}%.`
                }
            </div>
        `;

    // Bring the verdict into view immediately - it is the headline result and
    // must not sit below the fold on a phone.
    requestAnimationFrame(() => {
      if (outcomeContainer && outcomeContainer.scrollIntoView) {
        outcomeContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    setTimeout(() => {
      this.showOutcome(results);
    }, 900);
  }

  // Populates the supporting metrics grid beneath the verdict.
  showOutcome(results) {
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
      this.showBusinessImpact(results);
    }, 900);
  }

  // FIX 3a: Executive-grade business-impact summary.
  //
  // Speaks the language of a divisional MD (revenue, morale, retention, LEAD
  // quality) rather than a personality quiz. Built entirely from the already
  // computed `results` object plus `this.state` - it deliberately does NOT call
  // the executive-summary generator, so the on-screen payoff stays self-contained.
  //
  // Field sources (verified against calculateFinalScore):
  //   - growth / morale / attrition / profitMargin live on this.state
  //   - avgLEADRatio lives on results (average LEAD ratio vs benchmark)
  //   - meetsGrowth / meetsCapability live on results
  showBusinessImpact(results) {
    const impactContainer = document.getElementById("results-business-impact");
    if (!impactContainer) {
      // Container missing (older markup) - skip straight to the next stage so
      // the animation chain never stalls.
      this.showLeadershipBreakdown(results);
      return;
    }

    const growth = this.state.growth;
    const morale = this.state.morale;
    const attrition = this.state.attrition;
    const retention = 100 - attrition;
    const leadPct = (results.avgLEADRatio || 0) * 100;

    // Assessment labels - plain, executive language. No apostrophes.
    const growthLabel =
      growth >= this._growthTarget()
        ? "Ahead of target"
        : growth >= this._growthTarget() - 3
          ? "On target"
          : "Below target";

    const moraleLabel =
      morale >= 75 ? "Strong" : morale >= 65 ? "Healthy" : "At risk";

    const retentionLabel =
      retention >= 90 ? "Strong" : retention >= 85 ? "Stable" : "At risk";

    // BUGFIX (B3): derive the LEAD thresholds from the canonical
    // LEAD_CONSTANTS rather than hard-coding 78/65/50, so this screen can
    // never silently disagree with the scoring engine if the values are tuned.
    const leadConstants =
      (typeof window !== "undefined" && window.LEAD_CONSTANTS) ||
      (typeof LEAD_CONSTANTS !== "undefined" ? LEAD_CONSTANTS : null);
    const exceptionalLeadPct = leadConstants
      ? leadConstants.exceptionalLEAD * 100
      : 78;
    const solidLeadPct = leadConstants ? leadConstants.solidLEAD * 100 : 65;
    const strongLeadPct = leadConstants ? leadConstants.strongLEAD * 100 : 50;

    const leadLabel =
      leadPct >= exceptionalLeadPct
        ? "Exceptional"
        : leadPct >= solidLeadPct
          ? "Strong"
          : leadPct >= strongLeadPct
            ? "Adequate"
            : "Below benchmark";

    const rows = [
      {
        label: "Revenue Growth",
        value: `${growth.toFixed(1)}%`,
        assessment: growthLabel,
      },
      {
        label: "Team Morale",
        value: `${morale.toFixed(0)}%`,
        assessment: moraleLabel,
      },
      {
        label: "Staff Retention",
        value: `${retention.toFixed(0)}%`,
        assessment: retentionLabel,
      },
      {
        label: "LEAD Quality (vs benchmark)",
        value: `${leadPct.toFixed(0)}%`,
        assessment: leadLabel,
      },
    ];

    const rowsHtml = rows
      .map(
        (row) => `
                <div class="business-impact-row">
                    <span class="business-impact-label">${row.label}</span>
                    <span class="business-impact-value">${row.value}</span>
                    <span class="business-impact-assessment">${row.assessment}</span>
                </div>`,
      )
      .join("");

    impactContainer.innerHTML = `
            <div class="business-impact">
                <h3>BUSINESS IMPACT</h3>
                ${rowsHtml}
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

    // FIX 3b: the colour is demoted from headline to a secondary "leadership
    // signature" descriptor. The business impact above is the headline; the
    // colour is supporting colour (pun intended).
    html += `
            <div class="personality-color">
                <h4>YOUR LEADERSHIP SIGNATURE</h4>
                <p class="signature-color">${results.personalityColor}</p>
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
        flagged += ` (${(adaptation.round1WeakestRatio * 100).toFixed(0)}% of target)`;
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
      did += `In Round 2 your ${adaptation.weakestDimension} moved to <strong>${(adaptation.round2WeakestRatio * 100).toFixed(0)}%</strong> of target. `;
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
      // #1: optional LEAD course cohort (2025 / 2026 / blank).
      leadCohort: this.state.leadCohort,
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
      // When BALANCED, the colour the player leans towards most (null when
      // genuinely even). Lets the report say "balanced, with a slight tendency
      // towards X" instead of a flat "BALANCED".
      personalityTendency: results.personalityTendency || null,
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
      // Consent to public display. Default false (fail-safe) when the player
      // did not tick the box. Controls scoreboard visibility only.
      consent: {
        publicDisplay: !!this.state.consentGiven,
        capturedAt: this.state.consentCapturedAt || new Date().toISOString(),
      },
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

    // Dramatic leaderboard placement reveal. Pass the runId so the reveal can
    // re-rank against the SERVER cohort (the local cohort may hold only this
    // run on a fresh browser, which showed a misleading "1 of 1").
    this.showLeaderboardPlacement(placement, this.state.runId);

    // The "CALCULATING YEAR 1 RESULTS..." header is a loading placeholder. Once
    // the reveal chain has finished it is stale and its 48px heading + 40px
    // margin reserved a tall band of dead space at the very top of the results
    // page - the "scroll space above the feedback" players had to scroll past.
    // Collapse it now that the real content is on screen.
    const resultsHeader = document.querySelector(
      "#results-screen .results-header",
    );
    if (resultsHeader) resultsHeader.style.display = "none";

    // Bring the results into view. The results screen is a tall scroll
    // container, so without this the player lands at the top and has to scroll
    // down past the metrics/outcome/impact to reach the feedback.
    //
    // SCROLL-OVERSHOOT FIX: previously this scrolled the FEEDBACK container to
    // block:"start". The feedback block is very tall, so anchoring its top to
    // the viewport top pushed the verdict (TARGET MET / NOT MET) off-screen and
    // let the player scroll far past the headline. We now anchor the OUTCOME
    // (the verdict) to the top instead, so the player lands on the headline
    // result with the feedback flowing naturally beneath it. Deferred a frame
    // so the browser has laid out the new content first.
    requestAnimationFrame(() => {
      const outcomeContainer = document.getElementById("results-outcome");
      const anchor =
        outcomeContainer && outcomeContainer.scrollIntoView
          ? outcomeContainer
          : feedbackContainer;
      if (anchor && anchor.scrollIntoView) {
        anchor.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  // Animated rank-in reveal on the results screen.
  //
  // The local placement passed in is computed against the LOCAL cohort, which
  // on a fresh browser holds only this run - hence a misleading "1 of 1". We
  // render that immediately, then fetch the SERVER cohort and re-rank against
  // the merged set so the podium reflects every player who has played.
  showLeaderboardPlacement(placement, runId) {
    const container = document.getElementById("results-placement");
    if (!container || !placement) return;

    // #5: the private-results card was removed. A non-consenting player has
    // `rank: null` and `hidden: true`, so the ranked reveal below would print
    // "#null OF n". Fall back to a neutral, non-numeric message instead.
    if (placement.hidden || !placement.rank) {
      this._renderPlacementCard(container, placement);
      return;
    }

    // First paint: the local placement (instant, no network wait).
    this._renderPlacementCard(container, placement);

    // Then re-rank against the server cohort and repaint if it differs.
    if (!runId || typeof fetch !== "function") return;
    if (typeof location === "undefined" || location.protocol === "file:")
      return;

    // Fetch the FULL cohort (no limit) so the placement rank is computed
    // against every player - cohorts can run to ~150, so a ?limit=100 would
    // under-count and mis-rank players outside the top 100.
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.leaderboard)) return;
        const serverRows = data.leaderboard;
        // Merge local records over server rows (local carries richer fields),
        // then rank the player's runId within the merged, sorted set.
        const byRunId = new Map();
        serverRows.forEach((row) => {
          if (row && row.runId) byRunId.set(row.runId, row);
        });
        this.getLeaderboardData().forEach((row) => {
          if (row && row.runId) byRunId.set(row.runId, row);
        });
        const merged = Array.from(byRunId.values());
        // ROUND-SCOPED: rank only against players in the SAME round. Round 1
        // and Round 2 are independent competitions (different benchmarks and
        // scenario counts), so a Round 2 player must never be ranked against
        // the Round 1 cohort - that is what produced a spurious "16th of 16".
        // Find the player's own record first to learn its round, then filter.
        const playerRecord = merged.find((r) => r.runId === runId);
        if (!playerRecord) return; // this run is not on the server yet - keep local
        const playerRound = this._recordRound(playerRecord);
        const roundScoped = merged.filter(
          (r) => this._recordRound(r) === playerRound,
        );
        roundScoped.sort((a, b) => this.compareLeaderboardRecords(a, b));
        const idx = roundScoped.findIndex((r) => r.runId === runId);
        if (idx < 0) return; // this run is not on the server yet - keep local
        const serverPlacement = {
          rank: idx + 1,
          total: roundScoped.length,
          inTop10: idx + 1 <= 10,
          hidden: false,
        };
        // Only repaint when the server view actually changes the headline.
        if (
          serverPlacement.rank !== placement.rank ||
          serverPlacement.total !== placement.total
        ) {
          this._renderPlacementCard(container, serverPlacement);
        }
      })
      .catch(() => {
        /* offline / server down - keep the local placement */
      });
  }

  // Paint a single placement card into the results-placement container and
  // trigger its rank-in animation. Shared by the local and server reveals.
  _renderPlacementCard(container, placement) {
    if (!container || !placement) return;

    if (placement.hidden || !placement.rank) {
      container.innerHTML = `
            <div class="placement-card">
                <div class="placement-medal">🏅</div>
                <div class="placement-rank">RUN COMPLETE</div>
                <div class="placement-sub">Thanks for playing — your results are saved.</div>
            </div>
        `;
      requestAnimationFrame(() => {
        const card = container.querySelector(".placement-card");
        if (card) card.classList.add("revealed");
      });
      return;
    }

    const { rank, total, inTop10 } = placement;
    const isPodium = rank <= 3;
    const medal =
      rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";

    const headline = isPodium
      ? `TOP ${rank} OF ${total}`
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
    // BUGFIX (audit H1): the maximums were hardcoded for a 9-scenario run, so a
    // Round 2 player (6 scenarios) saw every "% of maximum" understated by ~33%
    // (a genuine 60% read as 40%). They are now ROUND-AWARE, derived from the
    // shared LEAD_CONSTANTS per-scenario ceilings scaled by the round's scenario
    // count - mirroring the round-aware divisor used in calculateFinalScore().
    const round = this.state && this.state.round === 2 ? 2 : 1;
    const maximums =
      typeof LEAD_CONSTANTS !== "undefined" &&
      LEAD_CONSTANTS.breakdownMaximumsForRound
        ? LEAD_CONSTANTS.breakdownMaximumsForRound(round)
        : {
            leadership: round === 2 ? 267 : 401,
            excellence: round === 2 ? 300 : 450,
            agility: round === 2 ? 155 : 233,
            determination: round === 2 ? 212 : 318,
          };

    // Track cumulative totals
    const cumulativeScores = {
      leadership: this.state.leadership || 0,
      excellence: this.state.excellence || 0,
      agility: this.state.agility || 0,
      determination: this.state.determination || 0,
    };

    let html = '<div class="lead-score-breakdown">';
    html +=
      '<h3 class="lead-breakdown-title">YOUR LEAD FRAMEWORK SCORES (% of maximum achievable)</h3>';
    html +=
      '<p class="lead-breakdown-subtitle">Your performance across all scenarios</p>';
    html +=
      '<p class="lead-breakdown-note">These scores show each dimension as a percentage of its maximum achievable points. The "LEAD Quality" figure in your business impact summary is measured against the 19-point-per-scenario benchmark instead, so the two use different scales.</p>';

    // minmax(0, 1fr) lets each track shrink below its content width, so the
    // cards can never overflow the panel's grey border on narrow viewports.
    html += '<div class="lead-breakdown-grid">';

    // FEASIBILITY GUARD: clamp every "% of maximum" to 0-100 so a strong player
    // can never be shown an impossible figure (e.g. "Agility 107%"). The raw
    // per-dimension cap is 250, which can exceed the Agility ceiling of 233, so
    // without this guard the panel could display >100%. Mirrors the clampPct()
    // already used in scoring.js generateFeedback().
    const clampPct = (v) =>
      !isFinite(v) ? 0 : Math.max(0, Math.min(100, Math.round(v)));

    Object.keys(maximums).forEach((dimension) => {
      const totalScore = cumulativeScores[dimension];
      const maximum = maximums[dimension];
      const percentOfMaximum = clampPct((totalScore / maximum) * 100);
      const performanceColor =
        percentOfMaximum >= 70
          ? "#00D084"
          : percentOfMaximum >= 50
            ? "#FFCB00"
            : "#FFA500";

      html += `
                <div class="lead-breakdown-card">
                    <div class="lead-breakdown-dim">${dimension}</div>
                    <div class="lead-breakdown-score">${totalScore}</div>
                    <div class="lead-breakdown-max">out of ${maximum} maximum achievable</div>
                    <div class="lead-breakdown-pct" style="color: ${performanceColor};">${percentOfMaximum}%</div>
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
    const overallPercentage = clampPct((totalScore / totalMaximum) * 100);

    html += '<div class="lead-breakdown-overall">';
    html += `<strong>Overall LEAD Score:</strong> ${totalScore} out of ${totalMaximum} maximum → `;
    html += `<span style="color: #00D084;">${overallPercentage}% of maximum achievable</span>`;
    html += "</div>";

    html += "</div>";
    return html;
  }

  extractCriticalImprovement(results) {
    // BUGFIX (audit C1): prefer the STRUCTURED field that generateFeedback()
    // now stores on results. This removes the fragile HTML re-parsing entirely
    // and guarantees the real, decision-linked improvement surfaces instead of
    // the generic fallback.
    if (
      results &&
      typeof results.criticalImprovement === "string" &&
      results.criticalImprovement.trim().length > 0
    ) {
      return this._firstSentence(results.criticalImprovement.trim());
    }

    // FALLBACK: legacy HTML extraction. The regex previously looked for a 🎯
    // emoji that generateFeedback() never emitted (it emits ⚠️), so it never
    // matched. It now accepts EITHER emoji so older cached feedback still works.
    const feedbackHTML = (results && results.feedback) || "";

    // Look for the Most Important Improvement section
    const improvementMatch = feedbackHTML.match(
      /(?:🎯|⚠️) Most Important Improvement:<\/h4>[\s\S]*?<p[^>]*>(.*?)<\/p>/,
    );

    if (improvementMatch && improvementMatch[1]) {
      // Remove HTML tags and get first sentence
      const improvement = improvementMatch[1]
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/&nbsp;/g, " ") // Replace &nbsp;
        .trim();

      return this._firstSentence(improvement);
    }

    return "Continue developing balanced leadership";
  }

  /**
   * Extract the first sentence from a block of text, guarding against
   * truncating decimals (e.g. "11.2%"). Shared by the structured and legacy
   * paths of extractCriticalImprovement().
   *
   * BUGFIX 2026-05-17: the old regex /^[^.]+\./ would match "but 11." and cut
   * off at the decimal point. /^.+?\.(?!\d)/ uses a negative lookahead to skip
   * decimals.
   */
  _firstSentence(text) {
    const improvement = (text || "").trim();
    if (!improvement) return improvement;

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
      if (DEBUG_ENABLED) {
        console.log("=== viewDetailedFeedback called ===");
        console.log("this:", this);
        console.log("this.finalResults:", this.finalResults);
        console.log("typeof this.finalResults:", typeof this.finalResults);
      }

      if (!this.finalResults) {
        console.error("CRITICAL: this.finalResults is undefined!");
        if (DEBUG_ENABLED) {
          console.log("this.state:", this.state);
          console.log("window.game:", window.game);
          console.log(
            "window.game.finalResults:",
            window.game ? window.game.finalResults : "N/A",
          );
        }
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
          detailedView += `<p style="margin-bottom: 8px;"><strong>Personality Colour(s):</strong> ${colorLabels}</p>`;
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
      // #8 ALIGNMENT: resolve the player's dominant style once so the LEAD
      // feedback below is style-aware (two players in the same band but with
      // different dominant styles read different, resonant copy).
      const dominantStyleName = (() => {
        const profile =
          (this.finalResults && this.finalResults.leadershipProfile) || {};
        let best = null;
        Object.keys(profile).forEach((s) => {
          if (best === null || profile[s] > profile[best]) best = s;
        });
        return best;
      })();

      detailedView +=
        '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.15); border-left: 4px solid var(--jcb-yellow);">';
      detailedView +=
        '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">JCB LEAD FRAMEWORK PERFORMANCE</h4>';

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">L</strong>eadership Quality: ${this.state.leadership} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("leadership", this.state.leadership, dominantStyleName)}</p>`;
      detailedView += `</div>`;

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">E</strong>xcellence Standards: ${this.state.excellence} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("excellence", this.state.excellence, dominantStyleName)}</p>`;
      detailedView += `</div>`;

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">A</strong>gility & Adaptability: ${this.state.agility} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("agility", this.state.agility, dominantStyleName)}</p>`;
      detailedView += `</div>`;

      detailedView += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.2);">`;
      detailedView += `<p style="margin-bottom: 5px;"><strong style="color: var(--jcb-yellow); font-size: 18px;">D</strong>etermination to Succeed: ${this.state.determination} points</p>`;
      detailedView += `<p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">${this.getLeadFeedback("determination", this.state.determination, dominantStyleName)}</p>`;
      detailedView += `</div>`;

      detailedView += "</div>";

      // Final Metrics
      detailedView +=
        '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
      detailedView +=
        '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Final Performance Metrics</h4>';
      detailedView += `<p><strong>Revenue Growth:</strong> ${this.state.growth.toFixed(1)}% (Target: ${this._growthTarget()}%)</p>`;

      // Morale with explanatory note if at cap
      if (this.state.morale >= 95) {
        detailedView += `<p><strong>Team Morale:</strong> ${this.state.morale.toFixed(0)}% <span style="font-size: 13px; color: rgba(255,255,255,0.7);">(maximum achievable - top 1% of organisations)</span></p>`;
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
      detailedView += `<p style="margin-top: 15px;"><strong>Personality Colour:</strong> ${this.finalResults.personalityColor}</p>`;
      detailedView += `<p style="font-size: 14px; color: rgba(255,255,255,0.8);">${this.finalResults.personalityDescription}</p>`;
      detailedView += "</div>";

      // Information Requests
      if (this.state.infoRequests.length > 0) {
        detailedView +=
          '<div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 203, 0, 0.1); border-left: 4px solid var(--jcb-yellow);">';
        detailedView +=
          '<h4 style="color: var(--jcb-yellow); margin-bottom: 15px;">Information Gathering Behaviour</h4>';
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

  // M3 fix: single source for the growth target so UI strings never drift
  // from the canonical value in LEAD_CONSTANTS.
  _growthTarget() {
    return typeof LEAD_CONSTANTS !== "undefined" && LEAD_CONSTANTS.growthTarget
      ? LEAD_CONSTANTS.growthTarget
      : 15;
  }

  // #8 ALIGNMENT: getLeadFeedback() is now STYLE-AWARE. The optional third
  // argument is the player's dominant style (e.g. "pacesetting", "democratic").
  // When supplied, the "low" and "medium" bands return a variant that reflects
  // that style, so two players in the SAME band but with DIFFERENT dominant
  // styles read different, resonant feedback. When omitted (legacy callers /
  // harnesses), the original generic copy is returned unchanged, so the public
  // signature stays backwards compatible.
  getLeadFeedback(attribute, score, dominantStyle) {
    const feedback = {
      leadership: {
        high: "You demonstrated strong leadership by building positive relationships, showing commercial acumen, and considering the bigger picture. Your decisions showed courage in motivating and influencing your team while adapting your style to different situations.",
        medium:
          "You showed leadership potential in some areas, particularly in decision-making and stakeholder management. To strengthen this, focus on building more inclusive relationships and consistently adapting your style to inspire and influence others.",
        low: "Your leadership decisions were primarily transactional. To develop JCB leadership qualities, focus on: building positive relationships within and outside the organisation, demonstrating commercial acumen by operating as if it were your own company, and being more ethical and sustainable in addressing both praise and performance issues.",
      },
      excellence: {
        high: "You exemplified excellence through emotional intelligence, critical thinking, and informed decision-making. Your self-awareness and willingness to make courageous, data-driven decisions while owning the outcomes demonstrated mature leadership.",
        medium:
          "You showed good analytical capability in some decisions. To reach excellence, develop stronger self-awareness of your shadow as a leader, improve critical thinking by balancing short-term priorities with long-term strategic goals, and be more courageous in speaking up and learning from mistakes.",
        low: "Your decisions lacked the critical thinking and emotional intelligence that define excellence at JCB. Focus on: developing self-awareness of your strengths and development areas, making more informed data-driven decisions, owning your choices, and creating allies by standing by others even when they are not present.",
      },
      agility: {
        high: "You demonstrated exceptional agility by navigating ambiguity, adapting quickly to changing situations, and showing resilience in the face of setbacks. Your proactive approach and creative problem-solving reflected the JCB values of not giving up and moving quickly.",
        medium:
          "You showed some adaptability but could improve in handling ambiguity and recovering from setbacks. To strengthen agility, be more pragmatic in driving change quickly, do not overthink in evolving situations, and be more proactive in taking initiative without being asked.",
        low: "Your decisions showed rigidity when faced with ambiguity and change. To develop agility: practice handling unclear situations without all the information, consider VUCA (volatility, uncertainty, complexity, ambiguity) impacts, build resilience to recover from setbacks, and take more initiative proactively.",
      },
      determination: {
        high: "You displayed relentless determination through your drive to excel, growth mindset, and willingness to innovate. Your passion for achieving goals, openness to feedback, and view of failure as a learning opportunity embodied the JCB values.",
        medium:
          "You showed drive in pursuing goals but could demonstrate more determination. To improve: communicate more openly and frequently, actively seek feedback to improve performance, challenge the way things are done more often, and maintain a more positive outlook when facing challenges.",
        low: "Your approach lacked the relentless determination to learn and grow that JCB values. Focus on: developing a stronger growth mindset, fostering continuous learning opportunities, innovating by challenging established ways, accepting that failure from innovation is a learning tool, and being a more positive thinking performer.",
      },
    };

    // #8 ALIGNMENT: per-style variants for the development bands. Keyed by the
    // dominant style so the same band reads differently for a coercive player
    // vs a democratic one. Only "low" and "medium" are style-varied; "high" is
    // already a strength affirmation that does not need a style caveat.
    const styleVariants = {
      leadership: {
        low: {
          pacesetting:
            "Your leadership was transactional and pace-driven. You set the bar and pushed, but you did not bring people with you. Build relationships and commercial context, not just momentum.",
          coercive:
            "Your leadership leaned on control. Compliance is not commitment — invest in relationships, explain the 'why', and earn influence rather than command it.",
          authoritative:
            "You provided direction but did not connect it to people. Vision lands only when it is shared — build the relationships and commercial acumen that turn a plan into a movement.",
          democratic:
            "You consulted widely but did not lead. Consensus is a tool, not a substitute for direction — be willing to own the call and set the standard.",
          affiliative:
            "You prioritised harmony over leadership. Being liked is not the same as being followed — hold the bar and address performance honestly.",
          coaching:
            "You invested in development but under-led on direction and commercial edge. Pair your people-focus with clear standards and a results narrative.",
        },
        medium: {
          pacesetting:
            "You led with pace and got results, but leadership is more than momentum. Balance your drive with relationships and a wider commercial view.",
          coercive:
            "You can command a room, but influence beats control. Work on building genuine relationships and explaining the reasoning behind your calls.",
          authoritative:
            "You set direction well; now connect it to people. Build the relationships and commercial acumen that make your vision land.",
          democratic:
            "You involve people well; now practise decisive leadership. Sometimes the team needs you to choose, not to poll.",
          affiliative:
            "You build goodwill well; now add edge. Care personally AND hold the standard when performance slips.",
          coaching:
            "You develop people well; now add commercial direction. Make sure development serves a clear, ambitious goal.",
        },
      },
      excellence: {
        low: {
          pacesetting:
            "You moved fast on instinct. Speed without evidence is a gamble — slow down enough to gather data and own the quality of the call.",
          coercive:
            "You decided by authority, not analysis. Invite challenge, test your assumptions, and make the reasoning visible.",
          authoritative:
            "You trusted your vision over the evidence. Great strategy still needs rigorous, data-driven validation.",
          democratic:
            "You gathered opinions but not evidence. Consultation is not analysis — seek hard data and own the decision.",
          affiliative:
            "You avoided the uncomfortable analysis. Rigour is a form of care — make the evidence-based call even when it is hard.",
          coaching:
            "You invested in people but under-invested in decision quality. Bring the same rigour to your choices that you bring to development.",
        },
        medium: {
          pacesetting:
            "Your drive sometimes outran your analysis. Build in a deliberate evidence step before the big calls.",
          coercive:
            "You can be decisive, but decisions need testing. Invite dissent and check the data before you commit.",
          authoritative:
            "Your vision is strong; your evidence base can be stronger. Validate the strategy with data.",
          democratic:
            "You value input; now value evidence. Convert consultation into rigorous, owned decisions.",
          affiliative:
            "You protect relationships; now protect decision quality. Make the tough, evidence-based call.",
          coaching:
            "You develop others well; apply that same developmental rigour to your own decision-making.",
        },
      },
      agility: {
        low: {
          pacesetting:
            "You pushed a fixed plan through change. Adaptability is not weakness — read the signals and adjust course.",
          coercive:
            "You held the line rigidly. In ambiguity, control fails — practise experimenting and recovering from setbacks.",
          authoritative:
            "You stuck to the vision when the context shifted. Great direction still needs a willingness to pivot.",
          democratic:
            "You sought consensus when speed was needed. In ambiguity, decide, act, and learn — do not wait for certainty.",
          affiliative:
            "You avoided disruption to keep the peace. Change is not a threat to relationships; rigidity is a threat to results.",
          coaching:
            "You favoured the steady path. Build your tolerance for ambiguity and act before you have all the answers.",
        },
        medium: {
          pacesetting:
            "You adapt by pushing harder. Sometimes the answer is to change direction, not increase effort.",
          coercive:
            "You adapt by tightening control. Try loosening the reins and experimenting when the path is unclear.",
          authoritative:
            "You adapt by re-asserting the vision. Also practise genuinely changing course when the evidence demands it.",
          democratic:
            "You adapt by consulting. In fast-moving ambiguity, be willing to act on incomplete information.",
          affiliative:
            "You adapt by preserving harmony. Be willing to disrupt the comfortable when the situation calls for it.",
          coaching:
            "You adapt patiently. Add a bias for timely action when ambiguity demands a quick pivot.",
        },
      },
      determination: {
        low: {
          pacesetting:
            "You drove hard but lost resilience when it mattered. Determination is not just intensity — it is persistence through setbacks.",
          coercive:
            "You forced outcomes but did not build follow-through. Sustainable drive comes from commitment, not pressure.",
          authoritative:
            "You set a bold vision but wavered under pressure. Back your direction with relentless follow-through.",
          democratic:
            "You sought agreement but lacked the drive to push through. Decide, commit, and persist.",
          affiliative:
            "You avoided the hard push. Determination means holding the goal even when it costs you popularity.",
          coaching:
            "You developed others but under-drove your own goals. Bring the same persistence to results that you bring to people.",
        },
        medium: {
          pacesetting:
            "Your drive is real but uneven. Sustain it through setbacks, not just in the sprint.",
          coercive:
            "You push hard, but persistence beats pressure. Build commitment rather than compliance.",
          authoritative:
            "You have vision; now add relentless follow-through when obstacles appear.",
          democratic:
            "You build buy-in; now add the drive to push the decision through to results.",
          affiliative:
            "You sustain relationships; now sustain the goal. Hold the line when it gets uncomfortable.",
          coaching:
            "You grow people; now grow your own persistence towards hard targets.",
        },
      },
    };

    // M2 fix: convert the raw cumulative score to a ratio against the
    // round-aware canonical benchmark (19 pts/dimension/scenario) before
    // selecting the category. Previously absolute 60/30 thresholds were
    // applied to a 250-point scale, so ~24% of the cap was labelled "high".
    const round =
      this.state && typeof this.state.round === "number" ? this.state.round : 1;
    const benchmark =
      typeof LEAD_CONSTANTS !== "undefined" &&
      typeof LEAD_CONSTANTS.cumulativeBenchmarkForRound === "function"
        ? LEAD_CONSTANTS.cumulativeBenchmarkForRound(round)
        : (round === 2 ? 6 : 9) * 19;
    const ratio = benchmark > 0 ? score / benchmark : 0;
    const highThreshold =
      typeof LEAD_CONSTANTS !== "undefined" && LEAD_CONSTANTS.solidLEAD
        ? LEAD_CONSTANTS.solidLEAD
        : 0.65;
    const mediumThreshold =
      typeof LEAD_CONSTANTS !== "undefined" &&
      LEAD_CONSTANTS.minimumDimensionRatio
        ? LEAD_CONSTANTS.minimumDimensionRatio
        : 0.35;
    const category =
      ratio >= highThreshold
        ? "high"
        : ratio >= mediumThreshold
          ? "medium"
          : "low";

    // #8 ALIGNMENT: prefer the style-specific variant when a dominant style was
    // supplied AND a variant exists for this attribute/category. Otherwise fall
    // back to the generic copy (preserving legacy behaviour exactly).
    if (dominantStyle) {
      const key = String(dominantStyle).toLowerCase();
      const variant =
        styleVariants[attribute] &&
        styleVariants[attribute][category] &&
        styleVariants[attribute][category][key];
      if (variant) return variant;
    }

    return feedback[attribute][category];
  }

  restart() {
    // Force the browser to open the reloaded page at the very top. Without
    // this, the browser restores the previous scroll position (the bottom of
    // the welcome screen) after the reload.
    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch (e) {
      /* ignore */
    }
    window.scrollTo(0, 0);
    location.reload();
  }

  // COMPANY CULTURE ANALYSIS METHODS
  // Password gate for the company culture dashboard.
  //
  // The dashboard is visible to everyone on the welcome screen, but it can
  // surface a picture of the organisation that is not appropriate for all
  // audiences (e.g. players). Access is therefore gated behind a shared
  // password that the facilitator controls. This is a deliberate
  // "keep it out of casual view" gate, not a security boundary - the check
  // is client-side by design.
  promptCultureAccess() {
    const CULTURE_PASSWORD = "JCBLEAD";
    let entered = null;
    try {
      entered = window.prompt("Enter the password to view the Company Culture Analysis:");
    } catch (e) {
      entered = null;
    }

    // Cancelled prompt (null) or empty input: do nothing.
    if (entered === null) return;

    if (String(entered).trim() === CULTURE_PASSWORD) {
      this.showCultureDashboard();
    } else {
      alert("Incorrect password. The Company Culture Analysis is restricted.");
    }
  }

  async showCultureDashboard() {
    if (!window.CultureAnalysis) {
      alert("Culture analysis engine not loaded. Please refresh the page.");
      return;
    }

    // Hydrate the local stores from the AUTHORITATIVE server cohort first. This
    // repairs rows written by an older build that lacked the segmentation
    // fields (jobFunction / seniority / leadCohort), which would otherwise make
    // the dashboard report "0 players". No-op when the server is unavailable.
    try {
      await this.hydrateCultureFromServer();
    } catch (e) {
      /* hydration is best-effort - fall back to the local store */
    }

    // Use the FILTERED + ANONYMISED cohort (JCB business functions only, with
    // non-consenting runs anonymised), not the truncated top-10 display
    // leaderboard. getCultureDataForAnalysis() reconciles jcb_culture_data
    // against jcb_leaderboard first, so a stale culture store self-heals.
    const cohort = this.getCultureDataForAnalysis();

    const analyzer = new window.CultureAnalysis();
    // The dashboard uses the SEGMENTED model (cohort x seniority x colour x
    // style) rather than the flat descriptive summary.
    const analysis = analyzer.analyzeCultureDashboard(cohort);

    if (analysis.error) {
      // Report the eligible cohort length so the count is truthful even if
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
  async downloadCulturePdf() {
    try {
      if (!window.CultureAnalysis) {
        alert("Culture analysis engine not loaded. Please refresh the page.");
        return;
      }

      // Hydrate from the authoritative server cohort first (see
      // showCultureDashboard) so the PDF reflects every player even when the
      // local store holds rows written by an older build.
      try {
        await this.hydrateCultureFromServer();
      } catch (e) {
        /* best-effort */
      }

      const cohort = this.getCultureDataForAnalysis();
      const analyzer = new window.CultureAnalysis();
      // The PDF mirrors the dashboard: it uses the SEGMENTED model so the
      // printed report carries the same cohort/seniority/colour breakdowns.
      const analysis = analyzer.analyzeCultureDashboard(cohort);

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
    // EXEC-LEVEL SPLIT: mirror the executive-summary pattern — a concise
    // one-page summary followed by a page break and a full data appendix.
    // Nothing is deleted; every section is relocated to exactly one part.
    const summaryHtml = this._buildCultureSummaryHtml(analysis);
    const appendixHtml = this._buildCultureAppendixHtml(analysis);
    return (
      summaryHtml +
      '<div style="page-break-before: always;"></div>' +
      appendixHtml
    );
  }

  /**
   * Shared helpers for the culture report builders. Kept in one place so the
   * summary and appendix render identically (escaping, number formatting,
   * percentage clamping, capitalisation).
   * @param {Object} analysis
   * @returns {Object} helper functions
   */
  _cultureReportHelpers(analysis) {
    const a = analysis || {};

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

    return { a, esc, num, pct, cap, generated };
  }

  /**
   * Exec-level, one-page culture summary. Contains only the headline sections:
   * header + opening, Executive Summary table, a condensed Leadership Style
   * Distribution, the first 3 observations and the first 3 focus areas.
   * @param {Object} analysis
   * @returns {string} HTML fragment (closing body/html tags included)
   */
  _buildCultureSummaryHtml(analysis) {
    const { a, esc, pct, cap, generated } =
      this._cultureReportHelpers(analysis);
    const observations = a.observations || [];
    const recommendations = a.recommendations || [];
    const playerCount = a.playerCount || 0;

    // The dashboard/PDF now uses the SEGMENTED model (analyzeCultureDashboard),
    // which has no flat `metrics`/`leadership` objects. Derive the headline
    // figures from the cohort groups so the summary still renders. When the
    // legacy flat model is passed, use it directly.
    const isSegmented = Array.isArray(a.byCohort);
    const metrics = a.metrics || {};
    const leadership = a.leadership || {};
    let successCount = metrics.successCount || 0;
    let optimalCount = metrics.optimalCount || 0;
    let spreadLabel = leadership.spreadLabel || "n/a";
    let aggregate = leadership.aggregate || {};
    let diversity = leadership.diversity || 0;
    let mostUsed = leadership.mostUsed || ["n/a", 0];
    let leastUsed = leadership.leastUsed || ["n/a", 0];

    if (isSegmented) {
      // Roll up the cohort groups into a single headline view.
      const groups = a.byCohort.filter((g) => g.sufficient);
      const total = groups.reduce((s, g) => s + g.count, 0) || 1;
      successCount = Math.round(
        groups.reduce((s, g) => s + (g.successRate || 0) * g.count, 0) / total,
      );
      optimalCount = Math.round(
        groups.reduce((s, g) => s + (g.optimalRate || 0) * g.count, 0) / total,
      );
      // Aggregate style distribution across all groups (weighted by count).
      const styleTotals = {};
      groups.forEach((g) => {
        Object.entries(g.styles || {}).forEach(([k, v]) => {
          styleTotals[k] = (styleTotals[k] || 0) + (v || 0) * g.count;
        });
      });
      Object.keys(styleTotals).forEach((k) => {
        styleTotals[k] = styleTotals[k] / total;
      });
      aggregate = styleTotals;
      const sorted = Object.entries(styleTotals).sort(
        (x, y) => (y[1] || 0) - (x[1] || 0),
      );
      if (sorted.length > 0) {
        mostUsed = sorted[0];
        leastUsed = sorted[sorted.length - 1];
      }
      // Diversity index = 1 - max share (higher = more balanced).
      const maxShare = sorted.length > 0 ? sorted[0][1] : 0;
      diversity = Math.max(0, 1 - maxShare / 100);
      spreadLabel =
        maxShare >= 70
          ? "Concentrated"
          : maxShare >= 50
            ? "Moderately spread"
            : "Well spread";
    }

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
      "@page{margin:15mm;}" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0;line-height:1.4;font-size:10.5pt;}" +
      "h1{font-size:20pt;margin:0 0 4px 0;}" +
      "h2{font-size:15pt;margin:22px 0 8px 0;border-bottom:2px solid #FFCB00;padding-bottom:4px;}" +
      "h3{font-size:12.5pt;margin:12px 0 4px 0;}" +
      "h4{font-size:11.5pt;margin:8px 0 4px 0;}" +
      "p{margin:4px 0;}" +
      "table{border-collapse:collapse;width:100%;margin:8px 0;}" +
      "td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;}" +
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
      "<table data-width='40,60'>" +
      "<tr><th>Measure</th><th>Value</th></tr>" +
      "<tr><td>Leaders analysed</td><td>" +
      esc(playerCount) +
      "</td></tr>" +
      "<tr><td>Met basic targets</td><td>" +
      esc(successCount) +
      " of " +
      esc(playerCount) +
      "</td></tr>" +
      "<tr><td>Achieved optimal</td><td>" +
      esc(optimalCount) +
      " of " +
      esc(playerCount) +
      "</td></tr>" +
      "<tr><td>Style spread</td><td>" +
      esc(spreadLabel) +
      "</td></tr>" +
      "</table>";

    // --- 3. Leadership Style Distribution (CONDENSED) -----------------------
    // Keep the diversity index and most/least used lines, but show only the
    // top-2 and bottom-1 styles rather than all six. The full distribution
    // remains in the appendix.
    const styleEntries = Object.keys(aggregate)
      .map((style) => [style, aggregate[style]])
      .sort((x, y) => (y[1] || 0) - (x[1] || 0));
    let condensedStyles = styleEntries;
    if (styleEntries.length > 3) {
      condensedStyles = styleEntries.slice(0, 2).concat(styleEntries.slice(-1));
    }
    let styleRows = "";
    condensedStyles.forEach(([style, share]) => {
      styleRows +=
        "<tr><td>" +
        esc(cap(style)) +
        "</td><td>" +
        pct(share, 0) +
        "%</td></tr>";
    });
    if (!styleRows) {
      styleRows = "<tr><td colspan='2'>No style data</td></tr>";
    }
    html +=
      "<h2>Leadership Style Distribution</h2>" +
      "<table data-width='60,40'><tr><th>Style</th><th>Aggregate Share</th></tr>" +
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

    // --- 4. What the Data Shows (capped to 3) -------------------------------
    // ONE-PAGE SUMMARY: cap the observations so the summary stays exec-level.
    // The full list remains in the appendix.
    const summaryObservations = observations.slice(0, 3);
    if (summaryObservations.length > 0) {
      html += "<h2>What the Data Shows</h2>";
      summaryObservations.forEach((obs) => {
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

    // --- 5. Suggested Focus Areas (capped to 3, actions capped to 3) --------
    const summaryRecommendations = recommendations.slice(0, 3);
    if (summaryRecommendations.length > 0) {
      html += "<h2>Suggested Focus Areas</h2>";
      summaryRecommendations.forEach((rec, index) => {
        const r = rec || {};
        const actions = (r.actions || []).slice(0, 3);
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

    html += "</body></html>";
    return html;
  }

  /**
   * Detailed culture appendix. Contains every data-dump section plus any
   * observations/recommendations beyond the first three shown in the summary,
   * so no data is lost.
   * @param {Object} analysis
   * @returns {string} HTML fragment
   */
  _buildCultureAppendixHtml(analysis) {
    const { a, esc, num, pct, cap } = this._cultureReportHelpers(analysis);
    const metrics = a.metrics || {};
    const lead = a.lead || {};
    const segments = a.segments || {};
    const decisions = a.decisions || {};
    const observations = a.observations || [];
    const recommendations = a.recommendations || [];

    let html = "<h2>Detailed Appendix</h2>";

    // SEGMENTED MODEL BRANCH: when the dashboard/PDF passes the segmented
    // model (analyzeCultureDashboard), render the segmented tables and return.
    // The legacy flat model falls through to the original appendix below.
    if (Array.isArray(a.byCohort)) {
      return this._buildSegmentedCultureAppendix(a, esc, num, pct, cap);
    }

    // --- Performance Ranges --------------------------------------------------
    html +=
      "<h2>Performance Ranges</h2>" +
      "<table data-width='40,30,30'>" +
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

    // --- Full Leadership Style Distribution ---------------------------------
    const aggregate = (a.leadership || {}).aggregate || {};
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
    html +=
      "<h2>Leadership Style Distribution (Full)</h2>" +
      "<table data-width='60,40'><tr><th>Style</th><th>Aggregate Share</th></tr>" +
      styleRows +
      "</table>";

    // --- LEAD Framework Scores ----------------------------------------------
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
      "<table data-width='28,18,18,18,18'>" +
      "<tr><th>Dimension</th><th>Median</th><th>Average</th>" +
      "<th>Range</th><th>Consistency</th></tr>" +
      leadRows +
      "</table>";

    // --- By Business Function ------------------------------------------------
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

    // --- By Seniority --------------------------------------------------------
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

    // --- By LEAD Course Cohort ----------------------------------------------
    // Only rendered when at least one cohort segment meets the minimum sample
    // size. Descriptive, not causal (COHORT_SEGMENTATION_DESIGN §3.2/§3.4).
    const cohorts = a.cohorts || {};
    const cohortRows = [
      cohorts.byCohort && cohorts.byCohort["2025"],
      cohorts.byCohort && cohorts.byCohort["2026"],
      cohorts.nonParticipants,
      cohorts.course,
    ].filter((c) => c && c.sufficient === true);
    // Only render when actual course data exists (a 2025/2026/course segment
    // is sufficient). An all-blank cohort would otherwise show a section
    // containing only "Non-participants", changing existing reports.
    const hasCourseData = cohortRows.some((c) => c.key !== "none");
    if (cohortRows.length > 0 && hasCourseData) {
      html += "<h2>By LEAD Course Cohort</h2>";
      html +=
        "<table data-width='22,13,13,13,13,13,13'>" +
        "<tr><th>Cohort</th><th>Leaders</th><th>LEAD avg</th>" +
        "<th>Balance (max %)</th><th>Growth</th><th>Morale</th>" +
        "<th>Attrition</th></tr>";
      cohortRows.forEach((c) => {
        html +=
          "<tr><td>" +
          esc(c.label || c.key || "") +
          "</td><td>" +
          esc(c.count || 0) +
          "</td><td>" +
          num(c.leadAvg && c.leadAvg.total, 0) +
          "</td><td>" +
          num(c.maxStyleShare, 0) +
          "%</td><td>" +
          num(c.avgGrowth, 1) +
          "%</td><td>" +
          num(c.avgMorale, 0) +
          "%</td><td>" +
          num(c.avgAttrition, 1) +
          "%</td></tr>";
      });
      html += "</table>";
      html +=
        "<p style='font-size: 9pt; color: #666;'>Cohorts with fewer than 3 " +
        "leaders are not shown. This compares observed outcomes between " +
        "groups; it does not by itself establish that the course caused the " +
        "difference.</p>";
    }

    // --- Remaining observations (beyond the first 3 in the summary) ---------
    const remainingObservations = observations.slice(3);
    if (remainingObservations.length > 0) {
      html += "<h2>What the Data Shows (continued)</h2>";
      remainingObservations.forEach((obs) => {
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

    // --- Remaining recommendations (beyond the first 3 in the summary) ------
    const remainingRecommendations = recommendations.slice(3);
    if (remainingRecommendations.length > 0) {
      html += "<h2>Suggested Focus Areas (continued)</h2>";
      remainingRecommendations.forEach((rec, index) => {
        const r = rec || {};
        const actions = r.actions || [];
        html +=
          "<div class='block'>" +
          "<h3>Focus " +
          esc(index + 4) +
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

    // --- Decision Tendencies -------------------------------------------------
    if (decisions.available === true) {
      const info = decisions.infoSeekingBehavior || {};
      html +=
        "<h2>Decision Tendencies</h2>" +
        "<table data-width='40,60'>" +
        "<tr><th>Measure</th><th>Value</th></tr>" +
        // Decision rates are proportions of total decisions, bounded 0-100.
        "<tr><td>Aggressive rate</td><td>" +
        pct(decisions.aggressiveDecisionRate, 1) +
        "%</td></tr>" +
        "<tr><td>Collaborative rate</td><td>" +
        pct(decisions.collaborativeDecisionRate, 1) +
        "%</td></tr>" +
        "<tr><td>Avg info requests/player</td><td>" +
        num(info.avgRequestsPerPlayer, 1) +
        "</td></tr>" +
        "</table>";
    }

    return html;
  }

  /**
   * Segmented culture appendix. Renders the cohort / seniority / colour / style
   * breakdowns and the head-to-head comparisons as PDF-friendly tables (the
   * SimplePDF writer renders <table> but not CSS grid or SVG). Mirrors the
   * on-screen dashboard so the printed report carries the same picture.
   * @param {Object} a segmented model from analyzeCultureDashboard()
   * @returns {string} HTML fragment
   */
  _buildSegmentedCultureAppendix(a, esc, num, pct, cap) {
    let html = "<h2>Detailed Appendix</h2>";

    // --- Head-to-head comparisons -------------------------------------------
    const comparisons = a.comparisons || [];
    if (comparisons.length > 0) {
      html += "<h2>Head-to-Head Comparisons</h2>";
      html +=
        "<table data-width='30,14,14,14,14,14'>" +
        "<tr><th>Comparison</th><th>LEAD total</th><th>Overall %</th>" +
        "<th>Growth</th><th>Morale</th><th>Attrition (inv.)</th></tr>";
      comparisons.forEach((c) => {
        const sign = (v) => (v >= 0 ? "+" : "") + num(v, 1);
        html +=
          "<tr><td>" +
          esc(c.label) +
          "</td><td>" +
          sign(c.leadTotal) +
          "</td><td>" +
          sign(c.overallPct) +
          "%</td><td>" +
          sign(c.growth) +
          "%</td><td>" +
          sign(c.morale) +
          "%</td><td>" +
          sign(c.attrition) +
          "%</td></tr>";
      });
      html += "</table>";
      html +=
        "<p style='font-size: 9pt; color: #666;'>Positive values mean the " +
        "second group scores higher. Attrition is inverted so a positive value " +
        "always means better. Groups with fewer than 3 leaders are omitted.</p>";
    }

    // --- LEAD scores by cohort ----------------------------------------------
    html += this._segmentedLeadTable(
      "LEAD Scores by Course Cohort",
      a.byCohort,
      esc,
      num,
    );

    // --- LEAD scores by seniority -------------------------------------------
    html += this._segmentedLeadTable(
      "LEAD Scores by Seniority",
      a.bySeniority,
      esc,
      num,
    );

    // --- Leadership style by cohort -----------------------------------------
    html += this._segmentedDistributionTable(
      "Leadership Style by Cohort",
      a.byCohort,
      "styles",
      esc,
      pct,
      cap,
    );

    // --- Leadership style by seniority --------------------------------------
    html += this._segmentedDistributionTable(
      "Leadership Style by Seniority",
      a.bySeniority,
      "styles",
      esc,
      pct,
      cap,
    );

    // --- Personality colour by cohort ---------------------------------------
    html += this._segmentedDistributionTable(
      "Personality Colour by Cohort",
      a.byCohort,
      "colors",
      esc,
      pct,
      cap,
    );

    // --- Personality colour by seniority ------------------------------------
    html += this._segmentedDistributionTable(
      "Personality Colour by Seniority",
      a.bySeniority,
      "colors",
      esc,
      pct,
      cap,
    );

    // --- Business area (job function) ---------------------------------------
    // Show whether culture differs between Engineering, HR, Operations, etc.
    if (Array.isArray(a.byFunction) && a.byFunction.length > 0) {
      html += this._segmentedLeadTable(
        "LEAD Scores by Business Area",
        a.byFunction,
        esc,
        num,
      );
      html += this._segmentedDistributionTable(
        "Leadership Style by Business Area",
        a.byFunction,
        "styles",
        esc,
        pct,
        cap,
      );
      html += this._segmentedDistributionTable(
        "Personality Colour by Business Area",
        a.byFunction,
        "colors",
        esc,
        pct,
        cap,
      );
    }

    // --- Outcomes by cohort --------------------------------------------------
    const sufficient = (a.byCohort || []).filter((g) => g.sufficient);
    if (sufficient.length > 0) {
      html += "<h2>Outcomes by Cohort</h2>";
      html +=
        "<table data-width='28,18,18,18,18'>" +
        "<tr><th>Cohort</th><th>Leaders</th><th>Growth</th>" +
        "<th>Morale</th><th>Attrition</th></tr>";
      sufficient.forEach((g) => {
        html +=
          "<tr><td>" +
          esc(g.name) +
          "</td><td>" +
          esc(g.count) +
          "</td><td>" +
          num(g.avgGrowth, 1) +
          "%</td><td>" +
          num(g.avgMorale, 0) +
          "%</td><td>" +
          num(g.avgAttrition, 1) +
          "%</td></tr>";
      });
      html += "</table>";
    }

    // --- Outcomes by business area ------------------------------------------
    const fnSufficient = (a.byFunction || []).filter((g) => g.sufficient);
    if (fnSufficient.length > 0) {
      html += "<h2>Outcomes by Business Area</h2>";
      html +=
        "<table data-width='28,18,18,18,18'>" +
        "<tr><th>Business Area</th><th>Leaders</th><th>Growth</th>" +
        "<th>Morale</th><th>Attrition</th></tr>";
      fnSufficient.forEach((g) => {
        html +=
          "<tr><td>" +
          esc(g.name) +
          "</td><td>" +
          esc(g.count) +
          "</td><td>" +
          num(g.avgGrowth, 1) +
          "%</td><td>" +
          num(g.avgMorale, 0) +
          "%</td><td>" +
          num(g.avgAttrition, 1) +
          "%</td></tr>";
      });
      html += "</table>";
    }

    return html;
  }

  // A LEAD dimension table for a set of dashboard groups.
  _segmentedLeadTable(title, groups, esc, num) {
    const sufficient = (groups || []).filter((g) => g.sufficient);
    if (sufficient.length === 0) return "";
    let html = "<h2>" + esc(title) + "</h2>";
    html +=
      "<table data-width='24,12,12,12,12,12,16'>" +
      "<tr><th>Group</th><th>Leaders</th><th>Leadership</th>" +
      "<th>Excellence</th><th>Agility</th><th>Determination</th>" +
      "<th>Overall %</th></tr>";
    sufficient.forEach((g) => {
      html +=
        "<tr><td>" +
        esc(g.name) +
        "</td><td>" +
        esc(g.count) +
        "</td><td>" +
        num(g.leadAvg.leadership, 0) +
        "</td><td>" +
        num(g.leadAvg.excellence, 0) +
        "</td><td>" +
        num(g.leadAvg.agility, 0) +
        "</td><td>" +
        num(g.leadAvg.determination, 0) +
        "</td><td>" +
        num(g.overallPct, 0) +
        "%</td></tr>";
    });
    html += "</table>";
    return html;
  }

  // A distribution table (styles or colours) for a set of dashboard groups.
  _segmentedDistributionTable(title, groups, field, esc, pct, cap) {
    const sufficient = (groups || []).filter((g) => g.sufficient);
    if (sufficient.length === 0) return "";

    // Union of keys so every group shows the same columns.
    const keys = [];
    sufficient.forEach((g) => {
      Object.keys(g[field] || {}).forEach((k) => {
        if (keys.indexOf(k) === -1) keys.push(k);
      });
    });
    if (keys.length === 0) return "";

    let html = "<h2>" + esc(title) + "</h2>";
    html += "<table><tr><th>Group</th><th>Leaders</th>";
    keys.forEach((k) => {
      html += "<th>" + esc(cap(k)) + "</th>";
    });
    html += "</tr>";
    sufficient.forEach((g) => {
      html +=
        "<tr><td>" + esc(g.name) + "</td><td>" + esc(g.count) + "</td>";
      keys.forEach((k) => {
        html += "<td>" + pct((g[field] || {})[k], 0) + "%</td>";
      });
      html += "</tr>";
    });
    html += "</table>";
    return html;
  }

  renderCultureDashboard(analysis) {
    const container = document.getElementById("culture-content");

    // The dashboard is driven by the segmented model. If the caller handed us
    // a flat analyzeCulture() result (legacy path), derive the segmented model
    // on the fly so the renderer always has the data it expects.
    let model = analysis;
    if (!analysis.byCohort && window.CultureAnalysis) {
      const cohort = this.getCultureDataForAnalysis();
      model = new window.CultureAnalysis().analyzeCultureDashboard(cohort);
    }

    if (model.error) {
      container.innerHTML =
        '<div class="culture-summary-card"><h2>Not enough data</h2><p>' +
        model.message +
        "</p></div>";
      return;
    }

    let html = "";

    // ---- Headline headcount bins --------------------------------------
    // Every eligible (JCB, non-student) player is binned into exactly one of
    // four groups. The counts are shown up front so the dashboard answers the
    // "how many people have played, and who are they?" question at a glance.
    const totalPlayers = model.playerCount;
    const cohortCount = (name) => {
      const g = this._findGroup(model.byCohort, name);
      return g ? g.count : 0;
    };
    const seniorityCount = (name) => {
      const g = this._findGroup(model.bySeniority, name);
      return g ? g.count : 0;
    };

    html += '<div class="culture-summary-card">';
    html += "<h2>Company Culture Dashboard</h2>";
    html += `<p class="culture-intro">A segmented picture of the ${totalPlayers} JCB leaders who have played. Students and non-JCB players are excluded. The cohort view counts each LEAD cohort and bins everyone else into Other; the seniority view counts Senior Leadership or above and bins everyone else into Other.</p>`;
    html += '<div class="culture-kpi-strip">';
    html += this._kpiCard("Leaders Analysed", totalPlayers);
    html += this._kpiCard("LEAD Cohort 2025", cohortCount("LEAD Cohort 2025"));
    html += this._kpiCard("LEAD Cohort 2026", cohortCount("LEAD Cohort 2026"));
    html += this._kpiCard(
      "Senior Leadership or above",
      seniorityCount("Senior Leadership or above"),
    );
    html += this._kpiCard("Other", cohortCount("Other"));
    html += "</div>";
    html += "</div>";

    // ---- LEAD dimension graph by cohort -------------------------------
    html += this._renderSegmentGraph(
      "🎓 LEAD Scores by Course Cohort",
      model.byCohort,
      "leadAvg",
    );

    // ---- LEAD dimension graph by seniority ----------------------------
    html += this._renderSegmentGraph(
      "📈 LEAD Scores by Seniority",
      model.bySeniority,
      "leadAvg",
    );

    // ---- Leadership style distribution by cohort ----------------------
    html += this._renderDistributionGraph(
      "👥 Leadership Style by Cohort",
      model.byCohort,
      "styles",
    );

    // ---- Leadership style distribution by seniority -------------------
    html += this._renderDistributionGraph(
      "👥 Leadership Style by Seniority",
      model.bySeniority,
      "styles",
    );

    // ---- Personality colour distribution by cohort --------------------
    html += this._renderDistributionGraph(
      "🎨 Personality Colour by Cohort",
      model.byCohort,
      "colors",
      true,
    );

    // ---- Personality colour distribution by seniority -----------------
    html += this._renderDistributionGraph(
      "🎨 Personality Colour by Seniority",
      model.bySeniority,
      "colors",
      true,
    );

    // ---- Outcome graph (growth / morale / attrition) by cohort --------
    html += this._renderOutcomeGraph(model.byCohort, "📊 Outcomes by Cohort");

    // ---- Outcome graph (growth / morale / attrition) by seniority -----
    html += this._renderOutcomeGraph(
      model.bySeniority,
      "📊 Outcomes by Seniority",
    );

    // ---- Business-area (job function) graphs --------------------------
    // Show whether culture differs between Engineering, HR, Operations, etc.
    // Only groups with >= minSegmentSize players are rendered (the graph
    // helpers filter on `sufficient`), so small areas are not over-interpreted.
    if (Array.isArray(model.byFunction) && model.byFunction.length > 0) {
      html += this._renderSegmentGraph(
        "🏢 LEAD Scores by Business Area",
        model.byFunction,
        "leadAvg",
      );
      html += this._renderDistributionGraph(
        "🏢 Leadership Style by Business Area",
        model.byFunction,
        "styles",
      );
      html += this._renderDistributionGraph(
        "🏢 Personality Colour by Business Area",
        model.byFunction,
        "colors",
        true,
      );
      html += this._renderOutcomeGraph(
        model.byFunction,
        "📊 Outcomes by Business Area",
      );
    }

    container.innerHTML = html;
  }

  // Find a group by name in a group array.
  _findGroup(groups, name) {
    return (groups || []).find((g) => g.name === name) || null;
  }

  // Merge the per-year course cohort groups ("2025 cohort" + "2026 cohort")
  // into a single "LEAD cohort" group for the headline KPI. Returns null when
  // no course cohort is present.
  _mergeCohortGroups(byCohort) {
    const years = (byCohort || []).filter(
      (g) => g.name === "2025 cohort" || g.name === "2026 cohort",
    );
    if (years.length === 0) return null;
    if (years.length === 1) return years[0];
    const total = years.reduce((s, g) => s + g.count, 0);
    if (total === 0) return null;
    const w = (field) =>
      years.reduce((s, g) => s + (g[field] || 0) * g.count, 0) / total;
    const wObj = (field) => {
      const out = {};
      years.forEach((g) => {
        Object.entries(g[field] || {}).forEach(([k, v]) => {
          out[k] = (out[k] || 0) + (v || 0) * g.count;
        });
      });
      Object.keys(out).forEach((k) => {
        out[k] = out[k] / total;
      });
      return out;
    };
    return {
      name: "LEAD cohort",
      count: total,
      leadAvg: {
        leadership: years.reduce((s, g) => s + g.leadAvg.leadership * g.count, 0) / total,
        excellence: years.reduce((s, g) => s + g.leadAvg.excellence * g.count, 0) / total,
        agility: years.reduce((s, g) => s + g.leadAvg.agility * g.count, 0) / total,
        determination: years.reduce((s, g) => s + g.leadAvg.determination * g.count, 0) / total,
        total: years.reduce((s, g) => s + g.leadAvg.total * g.count, 0) / total,
      },
      overallPct: w("overallPct"),
      styles: wObj("styles"),
      colors: wObj("colors"),
    };
  }

  // A single KPI tile.
  _kpiCard(label, value) {
    return (
      '<div class="culture-kpi-card">' +
      '<div class="culture-kpi-value">' +
      value +
      "</div>" +
      '<div class="culture-kpi-label">' +
      label +
      "</div>" +
      "</div>"
    );
  }

  // A head-to-head comparison card with signed delta bars.
  _renderComparisonCard(c) {
    const rows = [
      { label: "LEAD total", value: c.leadTotal, unit: " pts" },
      { label: "Overall %", value: c.overallPct, unit: "%" },
      { label: "Growth", value: c.growth, unit: "%" },
      { label: "Morale", value: c.morale, unit: "%" },
      { label: "Attrition (inv.)", value: c.attrition, unit: "%" },
      { label: "Style balance", value: c.balance, unit: "%" },
    ];

    let html = '<div class="culture-comparison-card">';
    html += `<h3>${c.label}</h3>`;
    html += `<div class="culture-comparison-sub">${c.aName} (${c.aCount}) vs ${c.bName} (${c.bCount})</div>`;
    rows.forEach((r) => {
      const positive = r.value >= 0;
      const width = Math.min(100, Math.abs(r.value) * 2); // scale for visibility
      html += '<div class="culture-delta-row">';
      html += `<div class="culture-delta-label">${r.label}</div>`;
      html += '<div class="culture-delta-track">';
      html += `<div class="culture-delta-fill ${positive ? "positive" : "negative"}" style="width:${width}%"></div>`;
      html += "</div>";
      html += `<div class="culture-delta-value ${positive ? "positive" : "negative"}">${positive ? "+" : ""}${r.value.toFixed(1)}${r.unit}</div>`;
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  // A grouped bar chart of LEAD dimension averages across segments.
  _renderSegmentGraph(title, groups, field) {
    const dims = [
      { key: "leadership", label: "Leadership" },
      { key: "excellence", label: "Excellence" },
      { key: "agility", label: "Agility" },
      { key: "determination", label: "Determination" },
    ];
    const sufficient = (groups || []).filter((g) => g.sufficient);
    if (sufficient.length === 0) return "";

    // Scale bars against the largest single-dimension average present.
    let maxVal = 1;
    sufficient.forEach((g) => {
      dims.forEach((d) => {
        const v = (g[field] || {})[d.key] || 0;
        if (v > maxVal) maxVal = v;
      });
    });

    let html = '<div class="culture-section">';
    html += `<h2>${title}</h2>`;
    html += '<div class="culture-bar-chart">';
    sufficient.forEach((g) => {
      html += '<div class="culture-bar-group">';
      html += `<div class="culture-bar-group-title">${g.name} <span class="culture-bar-count">${g.count}</span></div>`;
      dims.forEach((d) => {
        const v = (g[field] || {})[d.key] || 0;
        const pct = (v / maxVal) * 100;
        html += '<div class="culture-bar-row">';
        html += `<div class="culture-bar-label">${d.label}</div>`;
        html += '<div class="culture-bar-track">';
        html += `<div class="culture-bar-fill dim-${d.key}" style="width:${pct}%"></div>`;
        html += "</div>";
        html += `<div class="culture-bar-value">${v.toFixed(0)}</div>`;
        html += "</div>";
      });
      html += `<div class="culture-bar-overall">Overall: ${g.overallPct.toFixed(0)}% of maximum</div>`;
      html += "</div>";
    });
    html += "</div>";
    html += "</div>";
    return html;
  }

  // A stacked distribution chart (styles or colours) across segments.
  _renderDistributionGraph(title, groups, field, isColor) {
    const sufficient = (groups || []).filter((g) => g.sufficient);
    if (sufficient.length === 0) return "";

    // Collect the union of keys so every segment shows the same legend order.
    const keys = [];
    sufficient.forEach((g) => {
      Object.keys(g[field] || {}).forEach((k) => {
        if (keys.indexOf(k) === -1) keys.push(k);
      });
    });

    let html = '<div class="culture-section">';
    html += `<h2>${title}</h2>`;
    html += '<div class="culture-stack-chart">';
    sufficient.forEach((g) => {
      html += '<div class="culture-stack-group">';
      html += `<div class="culture-stack-title">${g.name} <span class="culture-bar-count">${g.count}</span></div>`;
      html += '<div class="culture-stack-bar">';
      keys.forEach((k) => {
        const v = (g[field] || {})[k] || 0;
        if (v <= 0) return;
        const cls = isColor ? "color-" + k.toLowerCase() : "style-" + k;
        html += `<div class="culture-stack-seg ${cls}" style="width:${v}%" title="${k}: ${v.toFixed(0)}%">`;
        if (v >= 8) html += `<span>${v.toFixed(0)}%</span>`;
        html += "</div>";
      });
      html += "</div>";
      html += "</div>";
    });
    html += "</div>";
    // Legend
    html += '<div class="culture-legend">';
    keys.forEach((k) => {
      const cls = isColor ? "color-" + k.toLowerCase() : "style-" + k;
      html += `<span class="culture-legend-item"><span class="culture-legend-swatch ${cls}"></span>${this.capitalizeFirst(k)}</span>`;
    });
    html += "</div>";
    html += "</div>";
    return html;
  }

  // Outcome comparison (growth / morale / attrition) across segments.
  _renderOutcomeGraph(groups, title) {
    const sufficient = (groups || []).filter((g) => g.sufficient);
    if (sufficient.length === 0) return "";

    const metrics = [
      { key: "avgGrowth", label: "Growth %", max: 40 },
      { key: "avgMorale", label: "Morale %", max: 100 },
      { key: "avgAttrition", label: "Attrition %", max: 40 },
    ];

    let html = '<div class="culture-section">';
    html += `<h2>${title || "📊 Outcomes by Cohort"}</h2>`;
    html += '<div class="culture-bar-chart">';
    sufficient.forEach((g) => {
      html += '<div class="culture-bar-group">';
      html += `<div class="culture-bar-group-title">${g.name} <span class="culture-bar-count">${g.count}</span></div>`;
      metrics.forEach((m) => {
        const v = g[m.key] || 0;
        const pct = Math.min(100, (v / m.max) * 100);
        html += '<div class="culture-bar-row">';
        html += `<div class="culture-bar-label">${m.label}</div>`;
        html += '<div class="culture-bar-track">';
        html += `<div class="culture-bar-fill outcome-${m.key}" style="width:${pct}%"></div>`;
        html += "</div>";
        html += `<div class="culture-bar-value">${v.toFixed(1)}</div>`;
        html += "</div>";
      });
      html += "</div>";
    });
    html += "</div>";
    html += "</div>";
    return html;
  }

  renderLEADRange(dimension, stats) {
    return `
            <div class="culture-lead-card">
                <div class="culture-lead-dimension">${dimension}</div>
                <div class="culture-lead-scores">
                    <div class="culture-lead-current" title="Median score">${stats.median.toFixed(0)}</div>
                    <div class="culture-lead-vs">median</div>
                    <div class="culture-lead-average" title="Average score">${stats.avg.toFixed(0)} avg</div>
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
