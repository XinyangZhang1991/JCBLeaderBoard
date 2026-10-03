// Server-side results store for the multiplayer JCB game.
//
// This module is the server-authoritative counterpart to the browser's
// `main program v3/results-store.js`. It REUSES that module directly (via
// require) so the canonical schema, consent predicates, conflict resolution
// and strict total-order comparator are byte-for-byte identical between the
// client and the server. Nothing about the record format is re-implemented
// here; we only add:
//
//   * durable persistence to a JSON file on disk
//   * an in-memory cache of the merged cohort
//   * merge-on-write so concurrent players never clobber each other
//   * a change listener so the WebSocket layer can broadcast updates
//
// The on-disk format is a single JSON document:
//   { schemaVersion, updatedAt, records: [ <canonical record>, ... ] }
//
// Records are stored in the canonical (nested) shape produced by the client's
// `flatToCanonical()`. On load we normalise every record through the shared
// `normaliseMany()` so legacy/flat records are upgraded transparently.

"use strict";

const fs = require("fs");
const path = require("path");

// Reuse the exact client-side logic. The path is relative to this file so the
// server can be started from any working directory.
const CLIENT_STORE_PATH = path.join(
  __dirname,
  "..",
  "main program v3",
  "results-store.js",
);
const ResultsStore = require(CLIENT_STORE_PATH);

const STORE_SCHEMA_VERSION = 1;

class ServerResultsStore {
  /**
   * @param {object} options
   * @param {string} options.filePath  Absolute path to the JSON store file.
   * @param {number} [options.flushDebounceMs]  Debounce for disk writes.
   */
  constructor(options) {
    const opts = options || {};
    if (!opts.filePath) {
      throw new Error("ServerResultsStore requires a filePath");
    }
    this.filePath = opts.filePath;
    this.flushDebounceMs =
      typeof opts.flushDebounceMs === "number" ? opts.flushDebounceMs : 250;

    /** @type {Map<string, object>} dedupeKey -> canonical record */
    this._byKey = new Map();
    /** @type {Array<function>} change listeners */
    this._listeners = [];
    /** @type {NodeJS.Timeout|null} */
    this._flushTimer = null;
    this._dirty = false;
    this._loaded = false;
  }

  // ----------------------------------------------------------------
  // Loading & persistence
  // ----------------------------------------------------------------

  /**
   * Load the store from disk (if present). Safe to call multiple times.
   * @returns {this}
   */
  load() {
    if (this._loaded) return this;
    this._loaded = true;

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const parsed = raw ? JSON.parse(raw) : null;
        const records =
          parsed && Array.isArray(parsed.records) ? parsed.records : [];
        // normaliseMany upgrades flat/legacy records to canonical form.
        const normalised = ResultsStore.normaliseMany(records);
        normalised.forEach((rec) => {
          const key = ResultsStore.dedupeKey(rec);
          if (!key) return;
          const existing = this._byKey.get(key);
          if (!existing) {
            this._byKey.set(key, rec);
          } else {
            this._byKey.set(key, ResultsStore.resolveConflict(existing, rec));
          }
        });
      }
    } catch (err) {
      // A corrupt store must not take the server down. Log and start empty;
      // the next flush will overwrite the corrupt file with valid JSON.
      console.error(
        "[results-store] failed to load store, starting empty:",
        err && err.message ? err.message : err,
      );
    }
    return this;
  }

  /** Schedule a debounced flush to disk. */
  _scheduleFlush() {
    this._dirty = true;
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this.flush();
    }, this.flushDebounceMs);
    // Do not keep the event loop alive purely for a pending flush.
    if (this._flushTimer.unref) this._flushTimer.unref();
  }

  /** Write the current merged cohort to disk atomically. */
  flush() {
    if (!this._dirty) return;
    const payload = {
      schemaVersion: STORE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      records: this.all(),
    };
    const dir = path.dirname(this.filePath);
    const tmp = this.filePath + ".tmp";
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
      fs.renameSync(tmp, this.filePath);
      this._dirty = false;
    } catch (err) {
      console.error(
        "[results-store] failed to flush store:",
        err && err.message ? err.message : err,
      );
    }
  }

  // ----------------------------------------------------------------
  // Reads
  // ----------------------------------------------------------------

  /** @returns {number} number of stored records */
  count() {
    return this._byKey.size;
  }

  /**
   * All records in the strict total order (growth DESC, leadTotal DESC,
   * timestamp ASC, runId ASC).
   * @returns {Array<object>}
   */
  all() {
    return Array.from(this._byKey.values()).sort(ResultsStore.compareRecords);
  }

  /**
   * The cohort payload served to clients via GET /api/cohort. This is the raw
   * array of canonical records; the client runs it through normaliseMany().
   * @returns {Array<object>}
   */
  cohort() {
    return this.all();
  }

  /**
   * Leaderboard projection (top N) using the shared projection helper.
   * @param {number} [limit]
   * @returns {Array<object>}
   */
  leaderboard(limit) {
    const ordered = this.all();
    const n = typeof limit === "number" && limit > 0 ? limit : ordered.length;
    return ordered
      .slice(0, n)
      .map((rec, i) => ResultsStore.toLeaderboardEntry(rec, i + 1));
  }

  /**
   * A lightweight summary suitable for broadcasting over WebSocket.
   * @returns {object}
   */
  summary() {
    const ordered = this.all();
    return {
      count: ordered.length,
      updatedAt: new Date().toISOString(),
      leaderboard: ordered
        .slice(0, 10)
        .map((rec, i) => ResultsStore.toLeaderboardEntry(rec, i + 1)),
    };
  }

  // ----------------------------------------------------------------
  // Writes
  // ----------------------------------------------------------------

  /**
   * Insert or merge a single canonical record. De-duplicates by the shared
   * dedupe key and resolves conflicts with the shared rules.
   *
   * @param {object} record  A canonical record (or a flat record, which will
   *                         be normalised).
   * @returns {{ record: object, isNew: boolean, replaced: boolean }}
   */
  upsert(record) {
    if (!record || typeof record !== "object") {
      throw new Error("upsert requires a record object");
    }
    const normalised = ResultsStore.normaliseRecord(record);
    const key = ResultsStore.dedupeKey(normalised);
    if (!key) {
      throw new Error("record is missing a dedupe key (runId/machineId)");
    }

    const existing = this._byKey.get(key);
    if (!existing) {
      this._byKey.set(key, normalised);
      this._scheduleFlush();
      this._emit({ type: "added", record: normalised });
      return { record: normalised, isNew: true, replaced: false };
    }

    const winner = ResultsStore.resolveConflict(existing, normalised);
    const replaced = winner !== existing;
    this._byKey.set(key, winner);
    if (replaced) {
      this._scheduleFlush();
      this._emit({ type: "updated", record: winner });
    }
    return { record: winner, isNew: false, replaced: replaced };
  }

  /**
   * Merge an array of records (used for bulk import / cohort sync).
   * @param {Array<object>} records
   * @returns {{ added: number, updated: number }}
   */
  upsertMany(records) {
    let added = 0;
    let updated = 0;
    (records || []).forEach((rec) => {
      try {
        const res = this.upsert(rec);
        if (res.isNew) added++;
        else if (res.replaced) updated++;
      } catch (err) {
        // Skip malformed records rather than failing the whole batch.
      }
    });
    return { added: added, updated: updated };
  }

  // ----------------------------------------------------------------
  // Change notification (used by the WebSocket broadcaster)
  // ----------------------------------------------------------------

  /**
   * Register a change listener.
   * @param {function({type: string, record: object}): void} fn
   * @returns {function} unsubscribe
   */
  onChange(fn) {
    if (typeof fn !== "function") return () => {};
    this._listeners.push(fn);
    return () => {
      const i = this._listeners.indexOf(fn);
      if (i >= 0) this._listeners.splice(i, 1);
    };
  }

  _emit(event) {
    this._listeners.slice().forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error("[results-store] listener error:", err);
      }
    });
  }
}

module.exports = {
  ServerResultsStore: ServerResultsStore,
  ResultsStore: ResultsStore,
  STORE_SCHEMA_VERSION: STORE_SCHEMA_VERSION,
};
