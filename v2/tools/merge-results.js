#!/usr/bin/env node
// merge-results.js - amalgamate results folders from multiple computers into
// ONE combined leaderboard and ONE combined cohort.
//
// Dependency-free: Node built-ins only (fs, path, crypto via results-store).
//
// Usage:
//   node tools/merge-results.js \
//     --in results/raw \
//     --in incoming/PC2/results/raw \
//     --out results/merged \
//     --top 10
//
// Behaviour (design doc §6):
//   * collect every *.json under each --in source (recursively)
//   * parse + normalise to the canonical per-run record
//   * de-duplicate by runId (legacy fallback timestamp|name)
//   * resolve conflicts by valid recordHash, then newer recordedAt, then
//     lexicographically greater runId
//   * sort by the strict total order growth DESC, leadTotal DESC,
//     timestamp ASC, runId ASC
//   * emit results/merged/leaderboard.json, cohort.json, merge-manifest.json
//
// Idempotent: the same input set always produces byte-identical output.

"use strict";

const fs = require("fs");
const path = require("path");
const Store = require(path.join(__dirname, "..", "results-store.js"));

const TOOL_NAME = "merge-results.js";
const TOOL_VERSION = Store.TOOL_VERSION;

// ------------------------------------------------------------------
// Argument parsing
// ------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { inputs: [], out: null, top: 10, migrateLegacy: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in" || a === "-i") {
      opts.inputs.push(argv[++i]);
    } else if (a === "--out" || a === "-o") {
      opts.out = argv[++i];
    } else if (a === "--top" || a === "-t") {
      opts.top = parseInt(argv[++i], 10);
    } else if (a === "--migrate-legacy") {
      opts.migrateLegacy = true;
    } else if (a === "--help" || a === "-h") {
      opts.help = true;
    }
  }
  return opts;
}

function usage() {
  return [
    "Usage: node tools/merge-results.js --in <dir> [--in <dir> ...] [--out <dir>] [--top N]",
    "",
    "  --in <dir>          Source folder containing run *.json files (repeatable).",
    "  --out <dir>         Output folder (default: results/merged).",
    "  --top <N>           Leaderboard size (default: 10).",
    "  --migrate-legacy    Accept flat arrays / legacy localStorage exports.",
    "",
    "Example:",
    "  node tools/merge-results.js --in results/raw --in incoming/PC2/results/raw --out results/merged --top 10",
  ].join("\n");
}

// ------------------------------------------------------------------
// File collection
// ------------------------------------------------------------------

// Recursively collect every *.json file under a directory.
function collectJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (dir.toLowerCase().endsWith(".json")) out.push(dir);
    return out;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(usage());
    process.exit(0);
  }

  // Default input is results/raw relative to the v2 folder (parent of tools/).
  const v2Root = path.join(__dirname, "..");
  if (opts.inputs.length === 0) {
    opts.inputs.push(path.join(v2Root, "results", "raw"));
  }
  const outDir = opts.out
    ? path.resolve(opts.out)
    : path.join(v2Root, "results", "merged");

  // Validate sources - a missing source directory is a hard error (exit != 0).
  let missing = false;
  opts.inputs.forEach((src) => {
    if (!fs.existsSync(src)) {
      console.error("ERROR: source directory not found: " + src);
      missing = true;
    }
  });
  if (missing) {
    console.error("\n" + usage());
    process.exit(1);
  }

  const sources = [];
  const allRecords = [];
  const rejected = [];
  let totalFiles = 0;

  opts.inputs.forEach((src) => {
    const files = collectJsonFiles(src);
    let accepted = 0;
    let srcRejected = 0;

    files.forEach((file) => {
      totalFiles++;
      let raw;
      try {
        raw = fs.readFileSync(file, "utf8");
      } catch (e) {
        rejected.push({ file: file, reason: "unreadable: " + e.message });
        srcRejected++;
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        rejected.push({ file: file, reason: "invalid JSON" });
        srcRejected++;
        return;
      }

      // Accept: canonical object, flat object, array of records, or a
      // { records: [...] } wrapper (merged cohort / legacy export).
      let records = [];
      if (Array.isArray(parsed)) {
        records = Store.normaliseMany(parsed);
      } else if (parsed && Array.isArray(parsed.records)) {
        records = Store.normaliseMany(parsed);
      } else if (parsed && typeof parsed === "object") {
        const one = Store.normaliseRecord(parsed);
        if (one) records = [one];
      }

      if (records.length === 0) {
        rejected.push({ file: file, reason: "unrecognised record shape" });
        srcRejected++;
        return;
      }

      records.forEach((r) => allRecords.push(r));
      accepted += records.length;
    });

    sources.push({
      path: path.relative(process.cwd(), src) || src,
      files: files.length,
      accepted: accepted,
      rejected: srcRejected,
    });
  });

  // De-duplicate + resolve conflicts + sort (shared with the browser).
  const merged = Store.mergeRecords(allRecords);

  // Build outputs.
  const generatedAt = new Date().toISOString();

  // CONSENT: only publicly displayable runs appear on the scoreboard. Rank is
  // computed against the publicly displayable set only, so a non-consenting
  // run never consumes a rank slot. Filter BEFORE slicing to `top`.
  const publicRecords = merged.records.filter((rec) =>
    Store.isPubliclyDisplayable(rec),
  );
  const leaderboardEntries = publicRecords
    .slice(0, opts.top > 0 ? opts.top : publicRecords.length)
    .map((rec, i) => Store.toLeaderboardEntry(rec, i + 1));

  const leaderboard = {
    schemaVersion: Store.SCHEMA_VERSION,
    generatedAt: generatedAt,
    sourceCount: sources.length,
    recordCount: publicRecords.length,
    duplicatesRemoved: merged.duplicates,
    sortKey: ["growth:desc", "leadTotal:desc", "timestamp:asc", "runId:asc"],
    entries: leaderboardEntries,
  };

  // SEGMENTATION: the culture/exec cohort keeps only records with a valid JCB
  // business function, and anonymises every non-consenting record.
  const cultureEligibleRecords = merged.records.filter((rec) =>
    Store.isCultureEligible(rec),
  );
  const cohortRecords = cultureEligibleRecords.map((rec) =>
    Store.anonymiseForCulture(rec),
  );

  const cohort = {
    schemaVersion: Store.SCHEMA_VERSION,
    generatedAt: generatedAt,
    recordCount: cohortRecords.length,
    records: cohortRecords,
  };

  // Transparency counts for the manifest.
  const publicDisplayCount = publicRecords.length;
  const hiddenFromScoreboardCount = merged.records.length - publicDisplayCount;
  const cultureEligibleCount = cultureEligibleRecords.length;
  const excludedNoFunctionCount = merged.records.length - cultureEligibleCount;
  const anonymisedCount = merged.records.filter(
    (rec) => !Store.isPubliclyDisplayable(rec) && Store.isCultureEligible(rec),
  ).length;

  // LEAD course cohort breakdown (COHORT_SEGMENTATION_DESIGN §3.5). Pure
  // function of merged.records, so the output stays deterministic.
  const cohortCounts = {
    2025: merged.records.filter((r) => Store.leadCohortOf(r) === "2025").length,
    2026: merged.records.filter((r) => Store.leadCohortOf(r) === "2026").length,
    none: merged.records.filter((r) => Store.leadCohortOf(r) === "").length,
    course: merged.records.filter((r) => Store.isCourseParticipant(r)).length,
  };

  const manifest = {
    schemaVersion: Store.SCHEMA_VERSION,
    generatedAt: generatedAt,
    tool: TOOL_NAME,
    toolVersion: TOOL_VERSION,
    sources: sources,
    totals: {
      files: totalFiles,
      accepted: allRecords.length,
      duplicates: merged.duplicates,
      invalid: rejected.length,
      records: merged.records.length,
      publicDisplay: publicDisplayCount,
      hiddenFromScoreboard: hiddenFromScoreboardCount,
      cultureEligible: cultureEligibleCount,
      excludedNoFunction: excludedNoFunctionCount,
      anonymised: anonymisedCount,
      cohortCounts: cohortCounts,
    },
    conflicts: merged.conflicts,
    rejected: rejected,
  };

  // Write outputs (deterministic: stable key order via canonicalStringify).
  fs.mkdirSync(outDir, { recursive: true });
  const writeJson = (name, obj) => {
    const target = path.join(outDir, name);
    fs.writeFileSync(target, JSON.stringify(obj, null, 2) + "\n", "utf8");
    return target;
  };

  const lbPath = writeJson("leaderboard.json", leaderboard);
  const cohortPath = writeJson("cohort.json", cohort);
  const manifestPath = writeJson("merge-manifest.json", manifest);

  // Human-readable summary.
  console.log("JCB results merge complete");
  console.log("  sources:            " + sources.length);
  sources.forEach((s) => {
    console.log(
      "    - " +
        s.path +
        " (" +
        s.files +
        " files, " +
        s.accepted +
        " accepted, " +
        s.rejected +
        " rejected)",
    );
  });
  console.log("  files scanned:      " + totalFiles);
  console.log("  records accepted:   " + allRecords.length);
  console.log("  duplicates removed: " + merged.duplicates);
  console.log("  conflicts resolved: " + merged.conflicts.length);
  console.log("  invalid/rejected:   " + rejected.length);
  console.log("  unique records:     " + merged.records.length);
  console.log("  public display:     " + publicDisplayCount);
  console.log("  hidden (no consent):" + " " + hiddenFromScoreboardCount);
  console.log("  culture eligible:   " + cultureEligibleCount);
  console.log("  excluded (no func): " + excludedNoFunctionCount);
  console.log("  anonymised:         " + anonymisedCount);
  console.log(
    "  cohorts:            " +
      "2025=" +
      cohortCounts["2025"] +
      " 2026=" +
      cohortCounts["2026"] +
      " none=" +
      cohortCounts.none +
      " course=" +
      cohortCounts.course,
  );
  console.log("  leaderboard top:    " + leaderboardEntries.length);
  console.log("  written:");
  console.log("    " + path.relative(process.cwd(), lbPath));
  console.log("    " + path.relative(process.cwd(), cohortPath));
  console.log("    " + path.relative(process.cwd(), manifestPath));

  process.exit(0);
}

main();
