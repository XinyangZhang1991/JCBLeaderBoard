// Results Store - portable, mergeable results persistence for the JCB game.
//
// Implements the design in v2/RESULTS_PERSISTENCE_DESIGN.md:
//   * canonical per-run record schema (nested superset of the flat record)
//   * adapter between the flat localStorage record and the canonical record
//   * the strict total-order comparator shared with tools/merge-results.js
//   * a three-layer write path chosen by runtime feature detection:
//       1. POST /api/results        (Node helper server - primary)
//       2. showDirectoryPicker()    (File System Access API - enhancement)
//       3. Blob download            (fallback - works from file://)
//
// The file is dependency-free and works both in the browser (attached to
// window.ResultsStore) and in Node (module.exports) so the merge tool and the
// verification harness can reuse the exact same normalisation + ordering code.

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.ResultsStore = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const APP_VERSION = "2.0.0";
  const TOOL_VERSION = "1.0.0";

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------

  function isObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  function num(v, fallback) {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback === undefined ? 0 : fallback;
  }

  function str(v) {
    return v === null || v === undefined ? "" : String(v);
  }

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  // Deterministic JSON serialisation: object keys are emitted in sorted order
  // so a hash computed over the same logical payload is byte-identical on any
  // machine. Arrays keep their order (order is meaningful for decisions).
  function canonicalStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value === undefined ? null : value);
    }
    if (Array.isArray(value)) {
      return "[" + value.map(canonicalStringify).join(",") + "]";
    }
    const keys = Object.keys(value).sort();
    const parts = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (value[k] === undefined) continue;
      parts.push(JSON.stringify(k) + ":" + canonicalStringify(value[k]));
    }
    return "{" + parts.join(",") + "}";
  }

  // SHA-256 hex. Uses WebCrypto in the browser and node:crypto in Node.
  // Returns a Promise<string>; callers that need it synchronously in Node can
  // use hashRecordSync().
  async function sha256Hex(text) {
    if (
      typeof crypto !== "undefined" &&
      crypto.subtle &&
      typeof TextEncoder !== "undefined"
    ) {
      const buf = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // Node fallback
    try {
      const nodeCrypto = require("crypto");
      return nodeCrypto.createHash("sha256").update(text, "utf8").digest("hex");
    } catch (e) {
      return "";
    }
  }

  function hashRecordSync(record) {
    try {
      const nodeCrypto = require("crypto");
      return nodeCrypto
        .createHash("sha256")
        .update(canonicalStringify(stripIntegrity(record)), "utf8")
        .digest("hex");
    } catch (e) {
      return "";
    }
  }

  function stripIntegrity(record) {
    const copy = {};
    Object.keys(record || {}).forEach((k) => {
      if (k !== "integrity") copy[k] = record[k];
    });
    return copy;
  }

  // ------------------------------------------------------------------
  // Consent & segmentation (single source of truth)
  //
  // These predicates are exported so the browser game and the Node merge
  // tool apply EXACTLY the same rules. See v2/CONSENT_SEGMENTATION_DESIGN.md.
  // ------------------------------------------------------------------

  // Valid JCB internal business functions. ONLY these count for the company
  // culture analysis / executive reports. Student, Academic, Consultant,
  // Other Industry, Other and the blank default are deliberately EXCLUDED.
  const JCB_BUSINESS_FUNCTIONS = [
    "Engineering",
    "Manufacturing",
    "Commercial",
    "Finance",
    "Human Resources",
    "Operations",
    "Product Development",
    "Marketing",
    "IT / Digital",
  ];

  // Accepts either a canonical record ({ player: { jobFunction } }) or a flat
  // record ({ jobFunction }). Returns true only for a valid JCB function.
  function jobFunctionOf(record) {
    if (!record) return "";
    if (isObject(record.player)) return str(record.player.jobFunction);
    return str(record.jobFunction);
  }

  function hasJcbBusinessFunction(record) {
    const fn = jobFunctionOf(record);
    return JCB_BUSINESS_FUNCTIONS.indexOf(fn) !== -1;
  }

  // Valid LEAD course cohorts. Blank = not part of the course (non-participant).
  // See v2/COHORT_SEGMENTATION_DESIGN.md §3.1.
  const LEAD_COHORTS = ["2025", "2026"];

  // Normalise any raw value to a canonical cohort key.
  //   "2025" -> "2025"; "2026" -> "2026"; anything else / blank -> "" (none).
  function normaliseCohort(value) {
    const v = str(value).trim();
    return LEAD_COHORTS.indexOf(v) !== -1 ? v : "";
  }

  // Read the cohort from either a canonical ({ player: { leadCohort } }) or a
  // flat ({ leadCohort }) record. Returns "" when absent (legacy / non-participant).
  function leadCohortOf(record) {
    if (!record) return "";
    if (isObject(record.player))
      return normaliseCohort(record.player.leadCohort);
    return normaliseCohort(record.leadCohort);
  }

  // True when the record belongs to a LEAD course cohort (2025 or 2026).
  function isCourseParticipant(record) {
    return leadCohortOf(record) !== "";
  }

  // True only when the player explicitly consented to public display.
  // Fail-safe: a missing/legacy consent object means NOT public.
  function isPubliclyDisplayable(record) {
    return !!(
      record &&
      record.consent &&
      record.consent.publicDisplay === true
    );
  }

  // Culture eligibility depends ONLY on having a valid JCB business function,
  // regardless of consent. Non-consenting JCB players are included anonymously.
  function isCultureEligible(record) {
    return hasJcbBusinessFunction(record);
  }

  // Return a deep clone of the record with identity stripped when the player
  // did not consent to public display. Function/seniority/outcomes/LEAD are
  // retained so segmentation still works; name and narrative identity are not.
  function anonymiseForCulture(record) {
    if (!record) return record;
    const clone = JSON.parse(JSON.stringify(record));
    if (!isPubliclyDisplayable(clone)) {
      if (isObject(clone.player)) {
        clone.player.name = "Anonymous";
      } else {
        clone.name = "Anonymous";
      }
      // Strip any name echoed inside the narrative / free-text fields.
      if (isObject(clone.narrative)) {
        delete clone.narrative.playerName;
        delete clone.narrative.quotes;
      }
      clone.anonymised = true;
    }
    return clone;
  }

  // ------------------------------------------------------------------
  // Identity
  // ------------------------------------------------------------------

  function randomSuffix(len) {
    return Math.random()
      .toString(36)
      .slice(2, 2 + (len || 8));
  }

  function newRunId() {
    return "run_" + Date.now().toString(36) + "_" + randomSuffix(8);
  }

  function newMachineId() {
    return "mch_" + Date.now().toString(36) + "_" + randomSuffix(8);
  }

  function newSessionId() {
    return "ses_" + Date.now().toString(36) + "_" + randomSuffix(8);
  }

  // Stable identity for legacy records that have no runId. Mirrors
  // GameEngine.legacyRecordKey() so historical localStorage rows merge cleanly.
  function legacyRecordKey(record) {
    if (!record) return "";
    return String(record.timestamp || "") + "|" + String(record.name || "");
  }

  // The de-duplication key for a canonical record: runId when present,
  // otherwise the legacy timestamp|name fallback.
  function dedupeKey(record) {
    if (!record) return "";
    if (record.runId) return String(record.runId);
    return legacyRecordKey(record);
  }

  // ------------------------------------------------------------------
  // Schema: flat record  <->  canonical nested record
  // ------------------------------------------------------------------

  // Derive a STABLE synthetic runId for a legacy record that has none, so
  // re-running the merge over the same legacy input is deterministic (design
  // doc §8: "assigns a synthetic runId where missing (derived from
  // timestamp|name so it stays stable)"). Uses a simple deterministic hash of
  // the legacy key - no randomness, no clock.
  function syntheticRunId(flat) {
    const key = legacyRecordKey(flat);
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
    }
    return "run_legacy_" + h.toString(36);
  }

  // Map a flat localStorage record (the shape produced by showFeedback) to the
  // canonical nested per-run schema (design doc §4.1).
  function flatToCanonical(flat, meta) {
    const f = flat || {};
    const m = meta || {};
    const leadTotal =
      num(f.leadership) +
      num(f.excellence) +
      num(f.agility) +
      num(f.determination);

    const record = {
      schemaVersion: SCHEMA_VERSION,
      runId: str(f.runId) || m.runId || syntheticRunId(f),
      machineId: str(f.machineId) || m.machineId || "",
      sessionId: str(f.sessionId) || m.sessionId || "",
      // Deterministic recordedAt: prefer an explicit value, then the meta
      // override, then derive from the record's own timestamp so a legacy
      // record with no recordedAt does not change on every merge run.
      recordedAt:
        str(f.recordedAt) ||
        m.recordedAt ||
        new Date(num(f.timestamp, Date.now())).toISOString(),
      timestamp: num(f.timestamp, Date.now()),
      appVersion: str(f.appVersion) || m.appVersion || APP_VERSION,

      player: {
        name: str(f.name),
        jobFunction: str(f.jobFunction),
        seniority: str(f.seniority),
        // #1: optional LEAD course cohort (2025 / 2026 / blank). Round-trips
        // through the canonical schema so the merge tool preserves it.
        // Normalised so an unexpected value (e.g. "2024") is stored as "" and
        // can never create a phantom segment (COHORT_SEGMENTATION_DESIGN §3.1).
        leadCohort: normaliseCohort(f.leadCohort),
        selfIdentifiedStyle: str(f.selfIdentifiedStyle),
      },

      // Consent to public display. Fail-safe default: false (absence of an
      // explicit opt-in means the run is NOT publicly displayable).
      consent: {
        publicDisplay: !!(f.consent && f.consent.publicDisplay === true),
        capturedAt:
          str(f.consent && f.consent.capturedAt) ||
          str(f.recordedAt) ||
          m.recordedAt ||
          new Date(num(f.timestamp, Date.now())).toISOString(),
      },

      run: {
        round: num(f.round, 1),
        escaped: !!f.escaped,
        optimal: !!f.optimal,
        adaptationBonus: num(f.adaptationBonus, 0),
      },

      outcomes: {
        growth: num(f.growth),
        morale: num(f.morale),
        attrition: num(f.attrition),
        profitMargin: num(f.profitMargin),
        organizationalCapability: num(f.organizationalCapability, 75),
      },

      lead: {
        leadership: num(f.leadership),
        excellence: num(f.excellence),
        agility: num(f.agility),
        determination: num(f.determination),
        total: leadTotal,
        ratios: isObject(f.leadRatios) ? f.leadRatios : {},
      },

      profile: {
        leadershipStyle: str(f.leadershipStyle),
        leadershipProfile: isObject(f.leadershipProfile)
          ? f.leadershipProfile
          : {},
        leadershipStyles: isObject(f.leadershipStyles)
          ? f.leadershipStyles
          : {},
        personalityColor: str(f.personalityColor) || "BALANCED",
        personalityDescription: str(f.personalityDescription),
      },

      narrative: {
        criticalImprovement: str(f.criticalImprovement),
        feedback: str(f.feedback),
        recommendations: arr(f.recommendations),
      },

      history: {
        decisions: arr(f.decisions),
        infoRequests: arr(f.infoRequests),
      },

      integrity: {
        recordHash: str(f.recordHash),
      },
    };

    return record;
  }

  // Map a canonical nested record back to the flat shape every existing
  // consumer (leaderboard UI, culture analysis, executive summary) expects.
  function canonicalToFlat(record) {
    const r = record || {};
    const player = r.player || {};
    const run = r.run || {};
    const outcomes = r.outcomes || {};
    const lead = r.lead || {};
    const profile = r.profile || {};
    const narrative = r.narrative || {};
    const history = r.history || {};

    return {
      name: str(player.name),
      jobFunction: str(player.jobFunction),
      seniority: str(player.seniority),
      // #1: optional LEAD course cohort (2025 / 2026 / blank).
      leadCohort: str(player.leadCohort),
      selfIdentifiedStyle: str(player.selfIdentifiedStyle),

      // Consent travels with the flat record so the browser filters and the
      // merge tool agree. Default false (fail-safe) when absent.
      consent: {
        publicDisplay: !!(r.consent && r.consent.publicDisplay === true),
        capturedAt: str(r.consent && r.consent.capturedAt),
      },

      growth: num(outcomes.growth),
      morale: num(outcomes.morale),
      attrition: num(outcomes.attrition),
      profitMargin: num(outcomes.profitMargin),
      organizationalCapability: num(outcomes.organizationalCapability, 75),

      leadership: num(lead.leadership),
      excellence: num(lead.excellence),
      agility: num(lead.agility),
      determination: num(lead.determination),
      leadRatios: isObject(lead.ratios) ? lead.ratios : {},

      leadershipStyle: str(profile.leadershipStyle),
      leadershipProfile: isObject(profile.leadershipProfile)
        ? profile.leadershipProfile
        : {},
      leadershipStyles: isObject(profile.leadershipStyles)
        ? profile.leadershipStyles
        : {},
      personalityColor: str(profile.personalityColor) || "BALANCED",
      personalityDescription: str(profile.personalityDescription),

      escaped: !!run.escaped,
      optimal: !!run.optimal,
      round: num(run.round, 1),
      adaptationBonus: num(run.adaptationBonus, 0),

      criticalImprovement: str(narrative.criticalImprovement),
      feedback: str(narrative.feedback),
      recommendations: arr(narrative.recommendations),

      decisions: arr(history.decisions),
      infoRequests: arr(history.infoRequests),

      timestamp: num(r.timestamp, Date.now()),
      runId: str(r.runId),
      machineId: str(r.machineId),
      sessionId: str(r.sessionId),
      recordedAt: str(r.recordedAt),
      appVersion: str(r.appVersion) || APP_VERSION,
      schemaVersion: num(r.schemaVersion, SCHEMA_VERSION),
    };
  }

  // Detect whether an object is already in canonical (nested) form.
  function isCanonical(record) {
    if (!isObject(record)) return false;
    return (
      isObject(record.player) ||
      isObject(record.outcomes) ||
      isObject(record.lead) ||
      isObject(record.profile)
    );
  }

  // Normalise ANY accepted input (canonical object, flat object, or a legacy
  // wrapper such as { records: [...] } / an array) into a canonical record.
  // Returns null when the input cannot be interpreted as a run.
  function normaliseRecord(input, meta) {
    if (!input) return null;

    // A merged cohort wrapper: { schemaVersion, records: [...] } - take the
    // first record only when asked for a single record; callers that need all
    // records should use normaliseMany().
    if (isObject(input) && Array.isArray(input.records)) {
      return input.records.length
        ? normaliseRecord(input.records[0], meta)
        : null;
    }

    if (isCanonical(input)) {
      // Re-run through flatToCanonical so missing fields are defaulted and
      // lead.total is recomputed consistently.
      const flat = canonicalToFlat(input);
      const canonical = flatToCanonical(flat, meta);
      // Preserve an existing hash if present.
      if (input.integrity && input.integrity.recordHash) {
        canonical.integrity.recordHash = input.integrity.recordHash;
      }
      return canonical;
    }

    // Flat record.
    if (isObject(input)) {
      return flatToCanonical(input, meta);
    }

    return null;
  }

  // Normalise a whole payload (array, single record, or { records: [...] })
  // into an array of canonical records.
  function normaliseMany(payload, meta) {
    if (!payload) return [];
    if (Array.isArray(payload)) {
      return payload.map((r) => normaliseRecord(r, meta)).filter(Boolean);
    }
    if (isObject(payload) && Array.isArray(payload.records)) {
      return payload.records
        .map((r) => normaliseRecord(r, meta))
        .filter(Boolean);
    }
    const one = normaliseRecord(payload, meta);
    return one ? [one] : [];
  }

  // ------------------------------------------------------------------
  // Strict total order (design doc §6.5)
  //   growth DESC, leadTotal DESC, timestamp ASC, runId ASC
  // Because runId is unique this is a strict total order, so any machine
  // produces byte-identical output from the same record set.
  // ------------------------------------------------------------------

  function leadTotalOf(record) {
    if (!record) return 0;
    if (isCanonical(record)) {
      if (isObject(record.lead) && typeof record.lead.total === "number") {
        return record.lead.total;
      }
      const l = record.lead || {};
      return (
        num(l.leadership) +
        num(l.excellence) +
        num(l.agility) +
        num(l.determination)
      );
    }
    return (
      num(record.leadership) +
      num(record.excellence) +
      num(record.agility) +
      num(record.determination)
    );
  }

  function growthOf(record) {
    if (!record) return 0;
    if (isCanonical(record)) return num((record.outcomes || {}).growth);
    return num(record.growth);
  }

  function timestampOf(record) {
    if (!record) return 0;
    return num(record.timestamp);
  }

  function runIdOf(record) {
    if (!record) return "";
    return str(record.runId);
  }

  // Comparator usable directly with Array.prototype.sort. Accepts either
  // canonical or flat records.
  function compareRecords(a, b) {
    const ga = growthOf(a);
    const gb = growthOf(b);
    if (gb !== ga) return gb - ga; // growth DESC

    const la = leadTotalOf(a);
    const lb = leadTotalOf(b);
    if (lb !== la) return lb - la; // leadTotal DESC

    const ta = timestampOf(a);
    const tb = timestampOf(b);
    if (ta !== tb) return ta - tb; // timestamp ASC

    const ra = runIdOf(a);
    const rb = runIdOf(b);
    if (ra < rb) return -1; // runId ASC
    if (ra > rb) return 1;
    return 0;
  }

  // ------------------------------------------------------------------
  // Conflict resolution (design doc §6.4)
  //   1. valid recordHash beats no hash
  //   2. newer recordedAt wins
  //   3. lexicographically greater runId wins
  // ------------------------------------------------------------------

  function hasValidHash(record) {
    if (!record || !record.integrity || !record.integrity.recordHash)
      return false;
    const expected = record.integrity.recordHash;
    const actual = hashRecordSync(record);
    // If we cannot compute a hash (no crypto), treat a present hash as valid.
    if (!actual) return true;
    return actual === expected;
  }

  function recordedAtMs(record) {
    if (!record) return 0;
    const iso = record.recordedAt;
    if (iso) {
      const t = Date.parse(iso);
      if (Number.isFinite(t)) return t;
    }
    return num(record.timestamp);
  }

  // Returns the winning record of two candidates for the same dedupe key.
  function resolveConflict(a, b) {
    const ha = hasValidHash(a);
    const hb = hasValidHash(b);
    if (ha && !hb) return a;
    if (hb && !ha) return b;

    const ta = recordedAtMs(a);
    const tb = recordedAtMs(b);
    if (tb !== ta) return tb > ta ? b : a;

    const ra = runIdOf(a);
    const rb = runIdOf(b);
    if (ra !== rb) return rb > ra ? b : a;

    return a;
  }

  // ------------------------------------------------------------------
  // Merge (shared by the browser and tools/merge-results.js)
  // ------------------------------------------------------------------

  // Merge an array of canonical records: de-duplicate by key, resolve
  // conflicts, and sort by the strict total order. Returns
  // { records, duplicates, conflicts }.
  function mergeRecords(records) {
    const map = new Map();
    const conflicts = [];
    let duplicates = 0;

    (records || []).forEach((rec) => {
      if (!rec) return;
      const key = dedupeKey(rec);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, rec);
        return;
      }
      duplicates++;
      const existing = map.get(key);
      const winner = resolveConflict(existing, rec);
      if (winner !== existing) {
        conflicts.push({
          key: key,
          kept: runIdOf(winner),
          dropped: runIdOf(winner === existing ? rec : existing),
          reason: "conflict resolution (hash/recency/runId)",
        });
      }
      map.set(key, winner);
    });

    const merged = Array.from(map.values()).sort(compareRecords);
    return { records: merged, duplicates: duplicates, conflicts: conflicts };
  }

  // Build the leaderboard entry projection for a canonical record.
  function toLeaderboardEntry(record, rank) {
    const flat = canonicalToFlat(record);
    return {
      rank: rank,
      runId: flat.runId,
      name: flat.name,
      growth: flat.growth,
      leadTotal: leadTotalOf(record),
      morale: flat.morale,
      attrition: flat.attrition,
      organizationalCapability: flat.organizationalCapability,
      leadershipStyle: flat.leadershipStyle,
      personalityColor: flat.personalityColor,
      round: flat.round,
      escaped: flat.escaped,
      optimal: flat.optimal,
      timestamp: flat.timestamp,
      machineId: flat.machineId,
    };
  }

  // ------------------------------------------------------------------
  // Three-layer write path (design doc §5)
  // ------------------------------------------------------------------

  const MACHINE_ID_KEY = "jcb_machine_id";
  const SESSION_ID_KEY = "jcb_session_id";
  const DIR_HANDLE_DB = "jcb_results_fs";
  const DIR_HANDLE_STORE = "handles";
  const DIR_HANDLE_KEY = "results_raw_dir";

  function getMachineId() {
    try {
      let id = localStorage.getItem(MACHINE_ID_KEY);
      if (!id) {
        id = newMachineId();
        localStorage.setItem(MACHINE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return "";
    }
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_ID_KEY);
      if (!id) {
        id = newSessionId();
        sessionStorage.setItem(SESSION_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return "";
    }
  }

  // --- IndexedDB persistence for the File System Access directory handle ---

  function idbOpen() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(DIR_HANDLE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DIR_HANDLE_STORE)) {
          db.createObjectStore(DIR_HANDLE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DIR_HANDLE_STORE, "readwrite");
      tx.objectStore(DIR_HANDLE_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DIR_HANDLE_STORE, "readonly");
      const req = tx.objectStore(DIR_HANDLE_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Layer 1: Node helper server ---

  // Probe whether the helper server is reachable. Cached after the first probe
  // so we do not hit the network on every run.
  let _serverAvailable = null;

  async function probeServer() {
    if (_serverAvailable !== null) return _serverAvailable;
    if (typeof fetch !== "function") {
      _serverAvailable = false;
      return false;
    }
    // file:// pages cannot fetch a relative /api path meaningfully.
    if (typeof location !== "undefined" && location.protocol === "file:") {
      _serverAvailable = false;
      return false;
    }
    try {
      const res = await fetch("/api/health", { method: "GET" });
      _serverAvailable = !!res && res.ok;
    } catch (e) {
      _serverAvailable = false;
    }
    return _serverAvailable;
  }

  async function writeViaServer(record) {
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error("server responded " + res.status);
    return { layer: "server", ok: true };
  }

  // --- Layer 2: File System Access API ---

  function fsApiAvailable() {
    return (
      typeof window !== "undefined" &&
      typeof window.showDirectoryPicker === "function" &&
      typeof location !== "undefined" &&
      location.protocol !== "file:"
    );
  }

  async function getStoredDirHandle() {
    try {
      const handle = await idbGet(DIR_HANDLE_KEY);
      if (!handle) return null;
      // Verify we still have permission.
      if (handle.queryPermission) {
        const perm = await handle.queryPermission({ mode: "readwrite" });
        if (perm === "granted") return handle;
        const req = await handle.requestPermission({ mode: "readwrite" });
        if (req === "granted") return handle;
        return null;
      }
      return handle;
    } catch (e) {
      return null;
    }
  }

  // Ask the facilitator to pick the results/raw directory once. Persisted in
  // IndexedDB so subsequent runs write straight into it.
  async function chooseResultsDirectory() {
    if (!fsApiAvailable()) {
      throw new Error("File System Access API unavailable");
    }
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await idbSet(DIR_HANDLE_KEY, handle);
    return handle;
  }

  async function writeViaFsApi(record) {
    let handle = await getStoredDirHandle();
    if (!handle) {
      handle = await chooseResultsDirectory();
    }
    const filename = (record.runId || newRunId()) + ".json";
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(record, null, 2));
    await writable.close();
    return { layer: "fsapi", ok: true };
  }

  // --- Layer 3: Blob download fallback ---

  function downloadRecord(record) {
    const filename = (record.runId || newRunId()) + ".json";
    const blob = new Blob([JSON.stringify(record, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { layer: "download", ok: true, filename: filename };
  }

  // --- Orchestrator ---

  // Persist a canonical record using the layered strategy. Feature detection
  // order: server -> File System Access API -> download. Never throws; returns
  // a descriptor of which layer handled the write.
  async function persistRun(record, options) {
    const opts = options || {};
    if (!record) return { layer: "none", ok: false, error: "no record" };

    // Layer 1 - Node helper server.
    if (opts.forceLayer !== "download") {
      try {
        if (await probeServer()) {
          return await writeViaServer(record);
        }
      } catch (e) {
        // fall through to the next layer
      }
    }

    // Layer 2 - File System Access API.
    if (opts.forceLayer !== "download" && fsApiAvailable()) {
      try {
        return await writeViaFsApi(record);
      } catch (e) {
        // user cancelled or permission denied - fall through
      }
    }

    // Layer 3 - download fallback (always works, including file://).
    try {
      return downloadRecord(record);
    } catch (e) {
      return { layer: "download", ok: false, error: String(e) };
    }
  }

  // Build a canonical record from the flat record produced by showFeedback(),
  // filling in machine/session identity and computing the integrity hash.
  async function buildRunRecord(flat, meta) {
    const m = Object.assign(
      {
        machineId: getMachineId(),
        sessionId: getSessionId(),
        recordedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
      },
      meta || {},
    );
    const record = flatToCanonical(flat, m);
    if (!record.integrity.recordHash) {
      record.integrity.recordHash = await sha256Hex(
        canonicalStringify(stripIntegrity(record)),
      );
    }
    return record;
  }

  // Convenience: build + persist in one call. Returns { record, result }.
  async function recordAndPersist(flat, meta, options) {
    const record = await buildRunRecord(flat, meta);
    const result = await persistRun(record, options);
    return { record: record, result: result };
  }

  // Fetch the shared cohort from the helper server, if present. Returns an
  // array of canonical records, or null when the server is unavailable.
  async function fetchCohort() {
    if (!(await probeServer())) return null;
    try {
      const res = await fetch("/api/cohort");
      if (!res.ok) return null;
      const data = await res.json();
      return normaliseMany(data);
    } catch (e) {
      return null;
    }
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    APP_VERSION: APP_VERSION,
    TOOL_VERSION: TOOL_VERSION,

    // helpers
    canonicalStringify: canonicalStringify,
    sha256Hex: sha256Hex,
    hashRecordSync: hashRecordSync,

    // identity
    newRunId: newRunId,
    newMachineId: newMachineId,
    newSessionId: newSessionId,
    getMachineId: getMachineId,
    getSessionId: getSessionId,
    legacyRecordKey: legacyRecordKey,
    dedupeKey: dedupeKey,

    // schema / adapter
    flatToCanonical: flatToCanonical,
    canonicalToFlat: canonicalToFlat,
    isCanonical: isCanonical,
    normaliseRecord: normaliseRecord,
    normaliseMany: normaliseMany,

    // consent & segmentation (shared with the browser and the merge tool)
    JCB_BUSINESS_FUNCTIONS: JCB_BUSINESS_FUNCTIONS,
    jobFunctionOf: jobFunctionOf,
    hasJcbBusinessFunction: hasJcbBusinessFunction,
    isPubliclyDisplayable: isPubliclyDisplayable,
    isCultureEligible: isCultureEligible,
    anonymiseForCulture: anonymiseForCulture,

    // LEAD course cohort segmentation (shared with the browser and merge tool)
    LEAD_COHORTS: LEAD_COHORTS,
    normaliseCohort: normaliseCohort,
    leadCohortOf: leadCohortOf,
    isCourseParticipant: isCourseParticipant,

    // ordering / merge
    compareRecords: compareRecords,
    leadTotalOf: leadTotalOf,
    growthOf: growthOf,
    resolveConflict: resolveConflict,
    hasValidHash: hasValidHash,
    mergeRecords: mergeRecords,
    toLeaderboardEntry: toLeaderboardEntry,

    // write path
    probeServer: probeServer,
    fsApiAvailable: fsApiAvailable,
    chooseResultsDirectory: chooseResultsDirectory,
    persistRun: persistRun,
    buildRunRecord: buildRunRecord,
    recordAndPersist: recordAndPersist,
    fetchCohort: fetchCohort,
  };
});
