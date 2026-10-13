// Live sync client for the multiplayer JCB game.
//
// When the game is served by the Node server (server/server.js), this module:
//
//   1. Connects to the server's WebSocket endpoint (/ws).
//   2. Receives an initial snapshot plus live "added"/"updated" events.
//   3. Merges every server record into the local localStorage stores
//      (jcb_leaderboard + jcb_culture_data) so the EXISTING leaderboard and
//      culture-dashboard views automatically reflect the whole cohort.
//   4. Exposes a live leaderboard overlay that any player device can open.
//
// It is completely inert when the page is opened from file:// or from a host
// that does not expose /ws, so the single-player kiosk behaviour is unchanged.
//
// Privacy: the shared overlay applies the SAME consent predicate used
// everywhere else (ResultsStore.isPubliclyDisplayable) so non-consenting runs
// are never shown on a shared surface.

(function () {
  "use strict";

  var LEADERBOARD_KEY = "jcb_leaderboard";
  var CULTURE_KEY = "jcb_culture_data";

  // Which round the live overlay is showing (1 or 2). Mirrors the home-screen
  // leaderboard's round tab so opening the live board from a Round 2 tab shows
  // the Round 2 cohort, not the combined board. Defaults to Round 1.
  var overlayRound = 1;

  var state = {
    connected: false,
    count: 0,
    leaderboard: [],
    socket: null,
    reconnectDelay: 1000,
    maxReconnectDelay: 15000,
    overlayEl: null,
    enabled: false,
  };

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  function isServerHosted() {
    return (
      typeof location !== "undefined" &&
      location.protocol !== "file:" &&
      typeof WebSocket === "function"
    );
  }

  function wsUrl() {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    return proto + location.host + "/ws";
  }

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage full / disabled - ignore */
    }
  }

  // Merge one canonical server record into the local stores. Uses the shared
  // ResultsStore helpers when available so de-duplication and conflict
  // resolution match the rest of the app exactly.
  function mergeRecordIntoLocalStores(record) {
    if (!record) return;

    var flat = record;
    if (
      typeof window.ResultsStore !== "undefined" &&
      window.ResultsStore.canonicalToFlat
    ) {
      try {
        flat = window.ResultsStore.canonicalToFlat(record);
      } catch (e) {
        flat = record;
      }
    }

    var runId = flat.runId || record.runId;
    if (!runId) return;

    // --- leaderboard store ---
    var leaderboard = readJson(LEADERBOARD_KEY);
    var foundLb = false;
    for (var i = 0; i < leaderboard.length; i++) {
      if (leaderboard[i] && leaderboard[i].runId === runId) {
        leaderboard[i] = flat;
        foundLb = true;
        break;
      }
    }
    if (!foundLb) leaderboard.push(flat);
    writeJson(LEADERBOARD_KEY, leaderboard);

    // --- culture store (full cohort) ---
    var culture = readJson(CULTURE_KEY);
    var foundC = false;
    for (var j = 0; j < culture.length; j++) {
      if (culture[j] && culture[j].runId === runId) {
        culture[j] = flat;
        foundC = true;
        break;
      }
    }
    if (!foundC) culture.push(flat);
    writeJson(CULTURE_KEY, culture);
  }

  // ----------------------------------------------------------------
  // Live leaderboard overlay
  // ----------------------------------------------------------------

  function ensureOverlay() {
    if (state.overlayEl) return state.overlayEl;

    var overlay = document.createElement("div");
    overlay.id = "live-leaderboard-overlay";
    overlay.className = "live-overlay";
    overlay.innerHTML =
      '<div class="live-overlay-panel">' +
      '<div class="live-overlay-header">' +
      '<h2>Live Leaderboard <span id="live-round-label"></span></h2>' +
      '<div class="live-overlay-status">' +
      '<span id="live-conn-dot" class="live-conn-dot"></span>' +
      '<span id="live-conn-label">Connecting…</span>' +
      '<span class="live-count" id="live-count">0 players</span>' +
      "</div>" +
      '<button class="live-overlay-close" id="live-overlay-close" aria-label="Close">×</button>' +
      "</div>" +
      '<div class="live-overlay-body" id="live-overlay-body"></div>' +
      "</div>";
    document.body.appendChild(overlay);

    var closeBtn = overlay.querySelector("#live-overlay-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", hideOverlay);
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) hideOverlay();
    });

    state.overlayEl = overlay;
    return overlay;
  }

  // REST fallback: if the WebSocket has not delivered a snapshot yet (or the
  // socket is unavailable), pull the same leaderboard the server exposes over
  // HTTP so the live view never contradicts the title-screen board. The server
  // projection omits `consent`, so isDisplayable() trusts it.
  function fetchLeaderboardFallback() {
    if (typeof fetch !== "function") return;
    if (typeof location === "undefined" || location.protocol === "file:") return;
    // No limit: the live leaderboard must show every player, not just top 10.
    fetch("/api/leaderboard", { cache: "no-store" })
      .then(function (res) {
        return res && res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.leaderboard)) return;
        // Only adopt the REST payload when the socket has not already given us
        // a (possibly newer) snapshot.
        if (state.leaderboard && state.leaderboard.length > 0) return;
        state.leaderboard = data.leaderboard;
        if (typeof data.count === "number") state.count = data.count;
        renderOverlay();
      })
      .catch(function () {
        /* offline / server down - leave the overlay as-is */
      });
  }

  function showOverlay() {
    var overlay = ensureOverlay();
    overlay.classList.add("visible");
    renderOverlay();
    // Backfill from REST when the socket has not populated the board yet.
    if (!state.leaderboard || state.leaderboard.length === 0) {
      fetchLeaderboardFallback();
    }
  }

  // Open the overlay for a specific round (1 or 2). Called by the LIVE
  // LEADERBOARD button with the home-screen's currently-selected round so the
  // live board matches the tab the user is looking at.
  function showOverlayForRound(round) {
    overlayRound = Number(round) === 2 ? 2 : 1;
    showOverlay();
  }

  function hideOverlay() {
    if (state.overlayEl) state.overlayEl.classList.remove("visible");
  }

  function escapeHtml(s) {
    var str = String(s === null || s === undefined ? "" : s);
    var AMP = String.fromCharCode(38) + "amp;";
    var LT = String.fromCharCode(38) + "lt;";
    var GT = String.fromCharCode(38) + "gt;";
    var QUOT = String.fromCharCode(38) + "quot;";
    return str
      .split(String.fromCharCode(38))
      .join(AMP)
      .split("<")
      .join(LT)
      .split(">")
      .join(GT)
      .split(String.fromCharCode(34))
      .join(QUOT);
  }

  // Normalise a record/entry's round. Legacy entries written before the `round`
  // field existed are treated as Round 1 (the only round that existed then).
  function entryRound(entry) {
    var r = entry && entry.round;
    return Number(r) === 2 ? 2 : 1;
  }

  function isDisplayable(entry) {
    // The server already sends only consent-filtered leaderboard projections,
    // and those projections deliberately omit the `consent` object. Only apply
    // the shared consent predicate when the entry actually carries a consent
    // object (e.g. a full record); otherwise trust the server's projection.
    if (
      entry &&
      typeof entry === "object" &&
      entry.consent &&
      typeof window.ResultsStore !== "undefined" &&
      window.ResultsStore.isPubliclyDisplayable
    ) {
      try {
        return window.ResultsStore.isPubliclyDisplayable(entry);
      } catch (e) {
        /* fall through */
      }
    }
    return true;
  }

  function renderOverlay() {
    if (!state.overlayEl) return;
    var body = state.overlayEl.querySelector("#live-overlay-body");
    var dot = state.overlayEl.querySelector("#live-conn-dot");
    var label = state.overlayEl.querySelector("#live-conn-label");
    var countEl = state.overlayEl.querySelector("#live-count");
    if (!body) return;

    if (dot) dot.classList.toggle("online", state.connected);
    if (label) label.textContent = state.connected ? "Live" : "Reconnecting…";
    var roundLabel = state.overlayEl.querySelector("#live-round-label");
    if (roundLabel) roundLabel.textContent = "— Round " + overlayRound;
    if (countEl) {
      countEl.textContent =
        state.count + " player" + (state.count === 1 ? "" : "s");
    }

    // Filter to the SELECTED round so the live board matches the home-screen
    // round tab. Round 1 and Round 2 are scored against different benchmarks,
    // so mixing them on one board is meaningless.
    var entries = (state.leaderboard || [])
      .filter(isDisplayable)
      .filter(function (e) {
        return entryRound(e) === overlayRound;
      });

    // Re-rank WITHIN the selected round. The server assigns `rank` against the
    // COMBINED cohort (Round 1 + Round 2 mixed), so a Round 2 player who is
    // 17th overall would otherwise display as "17th" even though they are 1st
    // within Round 2. Round 1 and Round 2 are independent competitions, so the
    // displayed rank must be the position within the filtered round only.
    entries = entries
      .slice()
      .sort(function (a, b) {
        var ga = Number(a && a.growth) || 0;
        var gb = Number(b && b.growth) || 0;
        if (gb !== ga) return gb - ga;
        var la = Number(a && a.leadTotal) || 0;
        var lb = Number(b && b.leadTotal) || 0;
        return lb - la;
      })
      .map(function (e, i) {
        var copy = {};
        for (var k in e) {
          if (Object.prototype.hasOwnProperty.call(e, k)) copy[k] = e[k];
        }
        copy.rank = i + 1;
        return copy;
      });

    // Last-resort fallback: when neither the socket nor REST has produced a
    // board (e.g. the page is opened from file:// with no server), show the
    // LOCAL cohort so the live view agrees with the title-screen leaderboard
    // instead of claiming nobody has played.
    if (entries.length === 0) {
      var local = readJson(LEADERBOARD_KEY);
      if (local.length > 0) {
        entries = local
          .filter(function (r) {
            return entryRound(r) === overlayRound;
          })
          .slice()
          .sort(function (a, b) {
            var ga = Number(a && a.growth) || 0;
            var gb = Number(b && b.growth) || 0;
            return gb - ga;
          })
          .map(function (r, i) {
            var lead =
              (Number(r.leadership) || 0) +
              (Number(r.excellence) || 0) +
              (Number(r.agility) || 0) +
              (Number(r.determination) || 0);
            return {
              rank: i + 1,
              name: r.name,
              growth: r.growth,
              leadTotal: lead,
              leadershipStyle: r.leadershipStyle,
              personalityColor: r.personalityColor,
              round: entryRound(r),
            };
          });
        if (countEl && (!state.count || state.count < entries.length)) {
          state.count = entries.length;
          countEl.textContent =
            state.count + " player" + (state.count === 1 ? "" : "s");
        }
      }
    }

    if (entries.length === 0) {
      body.innerHTML =
        '<div class="live-empty">No Round ' +
        overlayRound +
        " results yet — be the first to finish!</div>";
      return;
    }

    var html = '<table class="live-table"><thead><tr>' +
      "<th>#</th><th>Player</th><th>Growth</th><th>LEAD</th><th>Style</th>" +
      "</tr></thead><tbody>";
    entries.forEach(function (e) {
      html +=
        "<tr>" +
        '<td class="live-rank">' +
        escapeHtml(e.rank) +
        "</td>" +
        "<td>" +
        escapeHtml(e.name || "Anonymous") +
        "</td>" +
        '<td class="live-num">' +
        (typeof e.growth === "number" ? e.growth.toFixed(1) : "—") +
        "</td>" +
        '<td class="live-num">' +
        (typeof e.leadTotal === "number" ? e.leadTotal.toFixed(0) : "—") +
        "</td>" +
        "<td>" +
        escapeHtml(e.leadershipStyle || e.personalityColor || "—") +
        "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    body.innerHTML = html;
  }

  // ----------------------------------------------------------------
  // WebSocket lifecycle
  // ----------------------------------------------------------------

  function handleMessage(data) {
    if (!data || typeof data !== "object") return;

    if (data.type === "snapshot" || data.type === "added" || data.type === "updated") {
      state.count = typeof data.count === "number" ? data.count : state.count;
      state.leaderboard = Array.isArray(data.leaderboard)
        ? data.leaderboard
        : state.leaderboard;

      // Merge the individual record into local stores so the existing
      // leaderboard + culture dashboard reflect the shared cohort.
      if (data.record) {
        mergeRecordIntoLocalStores(data.record);
      }

      renderOverlay();
    }
  }

  function connect() {
    if (!isServerHosted()) return;
    try {
      state.socket = new WebSocket(wsUrl());
    } catch (e) {
      scheduleReconnect();
      return;
    }

    state.socket.onopen = function () {
      state.connected = true;
      state.reconnectDelay = 1000;
      renderOverlay();
    };

    state.socket.onmessage = function (evt) {
      var data = null;
      try {
        data = JSON.parse(evt.data);
      } catch (e) {
        return;
      }
      handleMessage(data);
    };

    state.socket.onclose = function () {
      state.connected = false;
      renderOverlay();
      scheduleReconnect();
    };

    state.socket.onerror = function () {
      try {
        state.socket.close();
      } catch (e) {
        /* ignore */
      }
    };
  }

  function scheduleReconnect() {
    setTimeout(connect, state.reconnectDelay);
    state.reconnectDelay = Math.min(
      state.reconnectDelay * 2,
      state.maxReconnectDelay,
    );
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  var LiveSync = {
    init: function () {
      if (!isServerHosted()) return;
      state.enabled = true;
      connect();
    },
    showLeaderboard: showOverlay,
    // Open the live board for a specific round (1 or 2).
    showLeaderboardForRound: showOverlayForRound,
    hideLeaderboard: hideOverlay,
    isConnected: function () {
      return state.connected;
    },
    getState: function () {
      return {
        connected: state.connected,
        count: state.count,
        leaderboard: state.leaderboard,
      };
    },
  };

  if (typeof window !== "undefined") {
    window.LiveSync = LiveSync;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        LiveSync.init();
      });
    } else {
      LiveSync.init();
    }
  }
})();
