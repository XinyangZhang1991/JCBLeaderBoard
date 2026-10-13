// Multiplayer server for the JCB Leadership in Action game.
//
// Responsibilities:
//   1. Serve the existing static client from "main program v3".
//   2. Implement the REST contract the client already probes for:
//        GET  /api/health   -> 200 { ok: true }
//        POST /api/results  -> store a canonical record
//        GET  /api/cohort   -> array of canonical records
//   3. Broadcast live updates over WebSocket at /ws so a host display (and any
//      player device) sees the shared leaderboard update in real time.
//   4. Serve the host/display view at /display.
//
// Zero external dependencies: only Node built-ins are used.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { ServerResultsStore, ResultsStore } = require("./results-store");
const { attachWebSocketServer } = require("./websocket");
const { validateRecord } = require("./validate");

// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CLIENT_DIR = path.join(__dirname, "..", "main program v3");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "results.json");

// ------------------------------------------------------------------
// Results store
// ------------------------------------------------------------------

const store = new ServerResultsStore({ filePath: STORE_FILE });
store.load();

// ------------------------------------------------------------------
// Static file serving
// ------------------------------------------------------------------

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

// Resolve a URL path to a file inside CLIENT_DIR, preventing path traversal.
function resolveClientPath(urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const normalised = path
    .normalize(rel)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const full = path.join(CLIENT_DIR, normalised);
  if (!full.startsWith(CLIENT_DIR)) return null;
  return full;
}

// ------------------------------------------------------------------
// HTTP helpers
// ------------------------------------------------------------------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function readBody(req, limitBytes) {
  const limit = limitBytes || 5 * 1024 * 1024; // 5 MB
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ------------------------------------------------------------------
// API handlers
// ------------------------------------------------------------------

function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "jcb-leaderboard-server",
    schemaVersion: ResultsStore.SCHEMA_VERSION,
    count: store.count(),
    updatedAt: new Date().toISOString(),
  });
}

async function handlePostResults(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    sendJson(res, 413, { ok: false, error: "payload too large" });
    return;
  }

  let raw;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: "invalid JSON" });
    return;
  }

  // Validate before storing. Validation never rejects a run outright; it
  // returns warnings that we log and attach to the stored record.
  const report = validateRecord(raw);
  if (!report.ok || !report.record) {
    sendJson(res, 400, {
      ok: false,
      error: "record failed validation",
      details: report.errors,
    });
    return;
  }
  if (report.warnings.length) {
    console.warn(
      "[validate] run " +
        (report.record.runId || "?") +
        " warnings: " +
        report.warnings.join("; "),
    );
  }

  // Attach the validation report to the record's integrity block.
  const record = report.record;
  record.integrity = record.integrity || {};
  record.integrity.validation = {
    ok: report.ok,
    warnings: report.warnings,
    validatedAt: new Date().toISOString(),
  };

  try {
    const result = store.upsert(record);
    sendJson(res, 200, {
      ok: true,
      isNew: result.isNew,
      replaced: result.replaced,
      runId: result.record && result.record.runId,
      count: store.count(),
      warnings: report.warnings,
    });
  } catch (err) {
    sendJson(res, 400, {
      ok: false,
      error: err && err.message ? err.message : "failed to store record",
    });
  }
}

function handleGetCohort(req, res) {
  sendJson(res, 200, store.cohort());
}

function handleGetLeaderboard(req, res) {
  const url = new URL(req.url, "http://localhost");
  // Default to the FULL cohort so the live leaderboard shows every player, not
  // just the top 10. An explicit ?limit= still narrows the result when needed.
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? undefined : parseInt(rawLimit, 10);
  sendJson(res, 200, {
    ok: true,
    count: store.count(),
    leaderboard: store.leaderboard(limit),
  });
}

// ------------------------------------------------------------------
// Request router
// ------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // --- API routes ---
  if (urlPath === "/api/health" && req.method === "GET") {
    handleHealth(req, res);
    return;
  }
  if (urlPath === "/api/results" && req.method === "POST") {
    handlePostResults(req, res);
    return;
  }
  if (urlPath === "/api/cohort" && req.method === "GET") {
    handleGetCohort(req, res);
    return;
  }
  if (urlPath === "/api/leaderboard" && req.method === "GET") {
    handleGetLeaderboard(req, res);
    return;
  }

  // --- Host display view ---
  if (urlPath === "/display" || urlPath === "/display/") {
    sendFile(res, path.join(__dirname, "public", "display.html"));
    return;
  }
  if (urlPath.startsWith("/display-assets/")) {
    const rel = urlPath.replace("/display-assets/", "");
    const full = path.join(__dirname, "public", rel);
    if (full.startsWith(path.join(__dirname, "public"))) {
      sendFile(res, full);
    } else {
      res.writeHead(403);
      res.end("Forbidden");
    }
    return;
  }

  // --- Static client ---
  if (req.method === "GET" || req.method === "HEAD") {
    const filePath = resolveClientPath(urlPath);
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    sendFile(res, filePath);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

// ------------------------------------------------------------------
// WebSocket live updates
// ------------------------------------------------------------------

const ws = attachWebSocketServer(server, {
  path: "/ws",
  onConnection: (conn) => {
    // Send the current state immediately so a freshly connected display is
    // populated without waiting for the next result.
    conn.send(
      JSON.stringify({
        type: "snapshot",
        count: store.count(),
        // Full cohort so the live leaderboard shows every player, not top 10.
        leaderboard: store.leaderboard(),
        updatedAt: new Date().toISOString(),
      }),
    );

    conn.on("message", (text, parsed) => {
      if (parsed && parsed.type === "ping") {
        conn.send(JSON.stringify({ type: "pong", t: Date.now() }));
      }
    });
  },
});

// Broadcast whenever a record is added or updated.
store.onChange((event) => {
  ws.broadcast(
    JSON.stringify({
      type: event.type, // "added" | "updated"
      count: store.count(),
      // Full cohort so the live leaderboard shows every player, not top 10.
      leaderboard: store.leaderboard(),
      record: event.record,
      updatedAt: new Date().toISOString(),
    }),
  );
});

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------

function localAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((info) => {
      if (info.family === "IPv4" && !info.internal) {
        out.push(info.address);
      }
    });
  });
  return out;
}

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error("");
    console.error("  ERROR: port " + PORT + " is already in use.");
    console.error("  Another program is using it. Start on a different port, e.g.:");
    console.error("      set PORT=8081 && node server/server.js");
    console.error("  (PowerShell:  $env:PORT=8081; node server/server.js)");
    console.error("");
    process.exit(1);
  }
  console.error("[server] error:", err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const addrs = localAddresses();
  console.log("");
  console.log("  JCB Leadership in Action - multiplayer server");
  console.log("  ------------------------------------------------");
  console.log("  Local:    http://localhost:" + PORT + "/");
  addrs.forEach((a) => {
    console.log("  Network:  http://" + a + ":" + PORT + "/");
  });
  console.log("  Display:  http://localhost:" + PORT + "/display");
  console.log("  Results:  " + STORE_FILE);
  console.log("  Loaded:   " + store.count() + " record(s)");
  console.log("");
  console.log("  Players on the same network open the Network URL above.");
  console.log("");
});

// Graceful shutdown: flush pending writes.
function shutdown() {
  console.log("\nShutting down...");
  try {
    store.flush();
  } catch (e) {
    /* ignore */
  }
  try {
    ws.close();
  } catch (e) {
    /* ignore */
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
