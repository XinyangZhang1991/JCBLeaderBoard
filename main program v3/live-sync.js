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
      '<h2>Live Leaderboard</h2>' +
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

  function showOverlay() {
    var overlay = ensureOverlay();
    overlay.classList.add("visible");
    renderOverlay();
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

  function isDisplayable(entry) {
    // Reuse the shared consent predicate when available. The server already
    // sends only leaderboard projections, but we gate again defensively.
    if (
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
    if (countEl) {
      countEl.textContent =
        state.count + " player" + (state.count === 1 ? "" : "s");
    }

    var entries = (state.leaderboard || []).filter(isDisplayable);
    if (entries.length === 0) {
      body.innerHTML =
        '<div class="live-empty">No results yet — be the first to finish!</div>';
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
