#!/usr/bin/env node
// serve.js - tiny dependency-free Node helper server for the JCB game.
//
// Node built-ins only (http, fs, path, url). No npm install required.
//
// What it does:
//   * statically serves the v2/ folder (the game itself)
//   * POST /api/results  - validate + write results/raw/<runId>.json
//                          (idempotent by runId; never overwrites)
//   * GET  /api/cohort   - return the merged cohort JSON (results/merged/cohort.json)
//   * GET  /api/health   - feature-detection probe used by the browser
//
// Usage:
//   node tools/serve.js            # http://localhost:8080
//   node tools/serve.js --port 3000
//
// The browser picks this server as its primary write layer when /api/health
// responds, so every client hitting the same server shares one leaderboard.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const Store = require(path.join(__dirname, "..", "results-store.js"));

const V2_ROOT = path.join(__dirname, "..");
const RESULTS_RAW = path.join(V2_ROOT, "results", "raw");
const RESULTS_MERGED = path.join(V2_ROOT, "results", "merged");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function parseArgs(argv) {
  const opts = { port: 8080, host: "127.0.0.1" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" || argv[i] === "-p") {
      opts.port = parseInt(argv[++i], 10);
    } else if (argv[i] === "--host") {
      opts.host = argv[++i];
    }
  }
  return opts;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > (limit || 5 * 1024 * 1024)) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// --- API handlers -------------------------------------------------

async function handlePostResults(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 413, { ok: false, error: e.message });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    sendJson(res, 400, { ok: false, error: "invalid JSON" });
    return;
  }

  const record = Store.normaliseRecord(parsed);
  if (!record || !record.runId) {
    sendJson(res, 400, { ok: false, error: "missing runId" });
    return;
  }

  // Recompute the integrity hash if absent so stored files are self-checking.
  if (!record.integrity.recordHash) {
    record.integrity.recordHash = Store.hashRecordSync(record);
  }

  fs.mkdirSync(RESULTS_RAW, { recursive: true });
  const target = path.join(RESULTS_RAW, record.runId + ".json");

  // Idempotent by runId: an existing file is never overwritten.
  if (fs.existsSync(target)) {
    sendJson(res, 200, {
      ok: true,
      duplicate: true,
      runId: record.runId,
      file: path.relative(V2_ROOT, target),
    });
    return;
  }

  try {
    fs.writeFileSync(target, JSON.stringify(record, null, 2) + "\n", "utf8");
  } catch (e) {
    sendJson(res, 500, { ok: false, error: "write failed: " + e.message });
    return;
  }

  console.log(
    "  + stored " +
      record.runId +
      " (" +
      (record.player && record.player.name) +
      ")",
  );
  sendJson(res, 201, {
    ok: true,
    duplicate: false,
    runId: record.runId,
    file: path.relative(V2_ROOT, target),
  });
}

function handleGetCohort(req, res) {
  const cohortPath = path.join(RESULTS_MERGED, "cohort.json");
  if (fs.existsSync(cohortPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cohortPath, "utf8"));
      sendJson(res, 200, data);
      return;
    } catch (e) {
      // fall through to live build
    }
  }

  // No merged cohort yet - build one live from results/raw so the leaderboard
  // is still consistent across clients before the first merge is run.
  const records = [];
  if (fs.existsSync(RESULTS_RAW)) {
    fs.readdirSync(RESULTS_RAW)
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .forEach((f) => {
        try {
          const parsed = JSON.parse(
            fs.readFileSync(path.join(RESULTS_RAW, f), "utf8"),
          );
          const rec = Store.normaliseRecord(parsed);
          if (rec) records.push(rec);
        } catch (e) {
          /* skip unreadable file */
        }
      });
  }
  const merged = Store.mergeRecords(records);
  sendJson(res, 200, {
    schemaVersion: Store.SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    recordCount: merged.records.length,
    records: merged.records,
  });
}

// --- Static file serving ------------------------------------------

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";

  // Prevent path traversal outside v2/.
  const target = path.normalize(path.join(V2_ROOT, rel));
  if (!target.startsWith(V2_ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + rel);
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(target).pipe(res);
  });
}

// --- Server -------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(
      req.url,
      "http://" + (req.headers.host || "localhost"),
    );
    const pathname = parsedUrl.pathname;

    // Permissive CORS so the game can also be opened from file:// and still
    // reach the API if the facilitator points it at this server.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        service: "jcb-results",
        version: Store.TOOL_VERSION,
      });
      return;
    }
    if (pathname === "/api/results" && req.method === "POST") {
      handlePostResults(req, res);
      return;
    }
    if (pathname === "/api/cohort" && req.method === "GET") {
      handleGetCohort(req, res);
      return;
    }

    serveStatic(req, res, pathname);
  });

  server.listen(opts.port, opts.host, () => {
    const url = "http://" + opts.host + ":" + opts.port + "/";
    console.log("");
    console.log("  JCB Leadership Game - results helper server");
    console.log("  ------------------------------------------------");
    console.log("  Serving:   " + V2_ROOT);
    console.log("  Results:   " + RESULTS_RAW);
    console.log("  Merged:    " + RESULTS_MERGED);
    console.log("");
    console.log("  Open the game at:  " + url);
    console.log("");
    console.log("  POST /api/results  append a run (idempotent by runId)");
    console.log(
      "  GET  /api/cohort   shared cohort for a consistent leaderboard",
    );
    console.log("  GET  /api/health   feature-detection probe");
    console.log("");
    console.log("  Press Ctrl+C to stop.");
    console.log("");
  });
}

main();
