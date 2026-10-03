// Server-side validation for incoming result records.
//
// The game is a training/workshop tool rather than a prize competition, so we
// do not need to fully re-run the scoring engine on the server. Instead we
// perform a set of cheap, high-value integrity checks that catch the realistic
// failure modes:
//
//   1. Structural validity  - the record normalises to a canonical run.
//   2. Hash integrity       - when the client supplies integrity.recordHash,
//                             recompute it and confirm it matches (detects
//                             tampering with the stored payload).
//   3. Derived-field checks - lead.total must equal the sum of the four LEAD
//                             dimensions; growth/morale/attrition must be
//                             within plausible bounds.
//   4. Consent sanity       - publicDisplay must be a boolean.
//
// Validation NEVER rejects a record outright (a workshop must not lose a
// player's run because of a cosmetic mismatch). It returns a report the server
// logs and can attach to the stored record as `integrity.validation`.

"use strict";

const path = require("path");
const ResultsStore = require(path.join(
  __dirname,
  "..",
  "main program v3",
  "results-store.js",
));

// Plausible bounds. These are deliberately generous: they catch nonsense
// (NaN, negatives, absurd values) without second-guessing legitimate play.
const BOUNDS = {
  growth: { min: -100, max: 100 },
  morale: { min: 0, max: 100 },
  attrition: { min: 0, max: 100 },
  profitMargin: { min: -100, max: 200 },
  organizationalCapability: { min: 0, max: 100 },
  leadDimension: { min: 0, max: 1000 },
};

function inBounds(value, bounds) {
  return (
    typeof value === "number" &&
    isFinite(value) &&
    value >= bounds.min &&
    value <= bounds.max
  );
}

/**
 * Validate a raw incoming record.
 *
 * @param {object} raw  The parsed JSON body from POST /api/results.
 * @returns {{ ok: boolean, errors: string[], warnings: string[], record: object|null }}
 */
function validateRecord(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["record is not an object"], warnings: warnings, record: null };
  }

  // 1. Structural validity.
  let record = null;
  try {
    record = ResultsStore.normaliseRecord(raw);
  } catch (e) {
    errors.push("normalisation threw: " + (e && e.message ? e.message : e));
  }
  if (!record) {
    errors.push("record could not be normalised to a canonical run");
    return { ok: false, errors: errors, warnings: warnings, record: null };
  }

  // 2. Hash integrity (only when the client supplied a hash).
  if (raw.integrity && raw.integrity.recordHash) {
    const valid = ResultsStore.hasValidHash(raw);
    if (!valid) {
      warnings.push("integrity.recordHash does not match the payload");
    }
  }

  // 3. Derived-field checks.
  const outcomes = record.outcomes || {};
  const lead = record.lead || {};

  if (!inBounds(outcomes.growth, BOUNDS.growth)) {
    warnings.push("growth out of plausible bounds: " + outcomes.growth);
  }
  if (!inBounds(outcomes.morale, BOUNDS.morale)) {
    warnings.push("morale out of plausible bounds: " + outcomes.morale);
  }
  if (!inBounds(outcomes.attrition, BOUNDS.attrition)) {
    warnings.push("attrition out of plausible bounds: " + outcomes.attrition);
  }
  if (!inBounds(outcomes.profitMargin, BOUNDS.profitMargin)) {
    warnings.push("profitMargin out of plausible bounds: " + outcomes.profitMargin);
  }
  if (!inBounds(outcomes.organizationalCapability, BOUNDS.organizationalCapability)) {
    warnings.push(
      "organizationalCapability out of plausible bounds: " +
        outcomes.organizationalCapability,
    );
  }

  ["leadership", "excellence", "agility", "determination"].forEach((dim) => {
    if (!inBounds(lead[dim], BOUNDS.leadDimension)) {
      warnings.push("lead." + dim + " out of plausible bounds: " + lead[dim]);
    }
  });

  // lead.total must equal the sum of the four dimensions.
  const sum =
    (Number(lead.leadership) || 0) +
    (Number(lead.excellence) || 0) +
    (Number(lead.agility) || 0) +
    (Number(lead.determination) || 0);
  if (typeof lead.total === "number" && Math.abs(lead.total - sum) > 0.001) {
    warnings.push(
      "lead.total (" + lead.total + ") != sum of dimensions (" + sum + ")",
    );
  }

  // 4. Consent sanity.
  if (record.consent && typeof record.consent.publicDisplay !== "boolean") {
    warnings.push("consent.publicDisplay is not a boolean");
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    record: record,
  };
}

module.exports = {
  validateRecord: validateRecord,
  BOUNDS: BOUNDS,
};
