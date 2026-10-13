// Host / projector display client.
//
// Connects to the server's WebSocket endpoint (/ws), receives an initial
// snapshot plus live "added"/"updated" events, and renders the shared
// leaderboard. Reconnects automatically if the connection drops.

(function () {
  "use strict";

  var WS_URL =
    (location.protocol === "https:" ? "wss://" : "ws://") +
    location.host +
    "/ws";

  var els = {
    body: document.getElementById("leaderboard-body"),
    connDot: document.getElementById("conn-dot"),
    connLabel: document.getElementById("conn-label"),
    playerCount: document.getElementById("player-count"),
    statCount: document.getElementById("stat-count"),
    statTopGrowth: document.getElementById("stat-top-growth"),
    statAvgMorale: document.getElementById("stat-avg-morale"),
    statUpdated: document.getElementById("stat-updated"),
    joinUrl: document.getElementById("join-url"),
  };

  var socket = null;
  var reconnectDelay = 1000;
  var maxReconnectDelay = 15000;
  var lastRunIds = {};

  function setConnected(connected) {
    if (!els.connDot) return;
    els.connDot.classList.toggle("online", connected);
    els.connDot.classList.toggle("offline", !connected);
    els.connLabel.textContent = connected ? "Live" : "Reconnecting…";
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

  function fmt(n, digits) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return n.toFixed(digits === undefined ? 0 : digits);
  }

  function styleClass(style) {
    return "style-pill";
  }

  function renderLeaderboard(entries) {
    if (!els.body) return;
    if (!entries || entries.length === 0) {
      els.body.innerHTML =
        '<tr class="empty-row"><td colspan="8">Waiting for players to finish…</td></tr>';
      return;
    }

    var html = "";
    entries.forEach(function (e) {
      var isNew = !lastRunIds[e.runId];
      lastRunIds[e.runId] = true;
      html +=
        '<tr class="' +
        (isNew ? "flash" : "") +
        '">' +
        '<td class="col-rank" data-label="Rank"><span class="rank-badge">' +
        escapeHtml(e.rank) +
        "</span></td>" +
        '<td class="col-name" data-label="Player">' +
        escapeHtml(e.name || "Anonymous") +
        "</td>" +
        '<td class="col-num" data-label="Growth">' +
        fmt(e.growth, 1) +
        "</td>" +
        '<td class="col-num" data-label="LEAD">' +
        fmt(e.leadTotal, 0) +
        "</td>" +
        '<td class="col-num" data-label="Morale">' +
        fmt(e.morale, 0) +
        "</td>" +
        '<td class="col-num" data-label="Attrition">' +
        fmt(e.attrition, 0) +
        "</td>" +
        '<td class="col-style" data-label="Style"><span class="' +
        styleClass(e.leadershipStyle) +
        '">' +
        escapeHtml(e.leadershipStyle || e.personalityColor || "—") +
        "</span></td>" +
        '<td class="col-round" data-label="Round">' +
        escapeHtml(e.round || 1) +
        "</td>" +
        "</tr>";
    });
    els.body.innerHTML = html;
  }

  function renderStats(count, entries, updatedAt) {
    if (els.statCount) els.statCount.textContent = String(count || 0);
    if (els.playerCount)
      els.playerCount.textContent =
        (count || 0) + " player" + (count === 1 ? "" : "s");

    if (els.statTopGrowth) {
      var top = entries && entries.length ? entries[0].growth : null;
      els.statTopGrowth.textContent =
        top === null || top === undefined ? "—" : fmt(top, 1);
    }

    if (els.statAvgMorale) {
      if (entries && entries.length) {
        var sum = 0;
        entries.forEach(function (e) {
          sum += typeof e.morale === "number" ? e.morale : 0;
        });
        els.statAvgMorale.textContent = fmt(sum / entries.length, 0);
      } else {
        els.statAvgMorale.textContent = "—";
      }
    }

    if (els.statUpdated) {
      if (updatedAt) {
        var d = new Date(updatedAt);
        els.statUpdated.textContent = d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        els.statUpdated.textContent = "—";
      }
    }
  }

  function handleMessage(data) {
    if (!data || typeof data !== "object") return;
    if (
      data.type === "snapshot" ||
      data.type === "added" ||
      data.type === "updated"
    ) {
      renderLeaderboard(data.leaderboard || []);
      renderStats(data.count, data.leaderboard || [], data.updatedAt);
    }
  }

  function connect() {
    try {
      socket = new WebSocket(WS_URL);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    socket.onopen = function () {
      setConnected(true);
      reconnectDelay = 1000;
    };

    socket.onmessage = function (evt) {
      var data = null;
      try {
        data = JSON.parse(evt.data);
      } catch (e) {
        return;
      }
      handleMessage(data);
    };

    socket.onclose = function () {
      setConnected(false);
      scheduleReconnect();
    };

    socket.onerror = function () {
      try {
        socket.close();
      } catch (e) {
        /* ignore */
      }
    };
  }

  function scheduleReconnect() {
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }

  // Show the join URL (the current host) so the projector can display it.
  if (els.joinUrl) {
    els.joinUrl.textContent = "Join at " + location.origin;
  }

  connect();
})();
