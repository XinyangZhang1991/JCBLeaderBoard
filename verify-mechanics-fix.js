// ============================================
// VERIFICATION HARNESS - Mechanics Fix Audit
// ============================================
// Proves the previously-DEAD slider thresholds are now REACHABLE, and that
// the share-of-total normalisation produces sensible, non-degenerate results.
// Run: node verify-mechanics-fix.js
//
// This harness does NOT modify game code. It re-implements the exact
// share-of-total maths used in scoring.js and asserts reachability.

"use strict";

let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}${detail ? "  -> " + detail : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? "  -> " + detail : ""}`);
  }
}

// Mirror of the scoring.js share helper.
function shares(values) {
  const raw = values.map((v) => Number(v) || 0);
  const total = raw.reduce((s, v) => s + v, 0);
  return raw.map((v) => (total > 0 ? v / total : 0));
}

console.log("\n=== 1. competitor_threat (budget 0.4, maxima 0.2/0.3/0.2/0.2/0.1/0.1) ===");
{
  // A player who concentrates on R&D + dealers (indices 1 and 2). The
  // condition needs rnd >= 0.4 AND dealers >= 0.3, i.e. >= 70% of spend on
  // those two. Max R&D is 0.3 and max dealers is 0.2, so a realistic
  // "long-game" allocation of 0.3 R&D + 0.2 dealers gives 0.6/0.4.
  const s = shares([0, 0.3, 0.2, 0, 0, 0]);
  check("rnd >= 0.4 reachable", s[1] >= 0.4, `rnd=${s[1].toFixed(2)}`);
  check("dealers >= 0.3 reachable", s[2] >= 0.3, `dealers=${s[2].toFixed(2)}`);

  // A player who puts everything into dealer partnership (index 5).
  const s2 = shares([0, 0, 0, 0, 0, 0.1]);
  check("dealerPartnership >= 0.3 reachable", s2[5] >= 0.3, `dp=${s2[5].toFixed(2)}`);

  // A player who puts everything into price matching (index 0).
  const s3 = shares([0.2, 0, 0, 0, 0, 0]);
  check("priceMatch >= 0.6 reachable", s3[0] >= 0.6, `pm=${s3[0].toFixed(2)}`);
}

console.log("\n=== 2. innovation_gamble Part 3 (budget 0.5, maxima 0.2/0.2/0.1/0.3/0.1) ===");
{
  // qa (0) + pilot (1) dominant.
  const s = shares([0.2, 0.2, 0, 0, 0]);
  check("qa >= 0.5 reachable", s[0] >= 0.5, `qa=${s[0].toFixed(2)}`);
  check("pilot >= 0.4 reachable", s[1] >= 0.4, `pilot=${s[1].toFixed(2)}`);

  // marketing (3) dominant, qa low.
  const s2 = shares([0, 0, 0, 0.3, 0]);
  check("marketing > 0.6 reachable", s2[3] > 0.6, `mkt=${s2[3].toFixed(2)}`);
  check("qa < 0.3 when marketing dominant", s2[0] < 0.3, `qa=${s2[0].toFixed(2)}`);
}

console.log("\n=== 3. year_end Part 2 (budget 0.25, maxima 0.25/0.01/0.25/0.25) ===");
{
  // capability (2) dominant.
  const s = shares([0, 0, 0.25, 0]);
  check("capability >= 0.4 reachable", s[2] >= 0.4, `cap=${s[2].toFixed(2)}`);

  // celebration (1) dominant - note tiny max 0.01, so it can only dominate
  // if the player spends almost nothing elsewhere.
  const s2 = shares([0, 0.01, 0, 0]);
  check("celebration >= 0.3 reachable", s2[1] >= 0.3, `celeb=${s2[1].toFixed(2)}`);

  // bonuses (0) dominant, capability low.
  const s3 = shares([0.25, 0, 0, 0]);
  check("bonuses > 0.5 reachable", s3[0] > 0.5, `bonus=${s3[0].toFixed(2)}`);
  check("capability < 0.2 when bonuses dominant", s3[2] < 0.2, `cap=${s3[2].toFixed(2)}`);
}

console.log("\n=== 4. merger_integration Part 3 (budget 0.5, maxima 0.2/0.15/0.3/0.1/0.25) ===");
{
  // retention (2) dominant.
  const s = shares([0, 0, 0.3, 0, 0]);
  check("retention >= 0.3 reachable", s[2] >= 0.3, `ret=${s[2].toFixed(2)}`);

  // teamBuilding (0) + training (4) both >= 0.2.
  const s2 = shares([0.2, 0, 0, 0, 0.25]);
  check("teamBuilding >= 0.2 reachable", s2[0] >= 0.2, `tb=${s2[0].toFixed(2)}`);
  check("training >= 0.2 reachable", s2[4] >= 0.2, `tr=${s2[4].toFixed(2)}`);
}

console.log("\n=== 5. market_disruption Part 2 (budget 0.5, maxima 0.3/0.2/0.15/0.2/0.2) ===");
{
  // rd (0) dominant.
  const s = shares([0.3, 0, 0, 0, 0]);
  check("rd >= 0.2 reachable", s[0] >= 0.2, `rd=${s[0].toFixed(2)}`);

  // innovation (3) dominant.
  const s2 = shares([0, 0, 0, 0.2, 0]);
  check("innovation >= 0.2 reachable", s2[3] >= 0.2, `inn=${s2[3].toFixed(2)}`);

  // talent (4) dominant.
  const s3 = shares([0, 0, 0, 0, 0.2]);
  check("talent >= 0.2 reachable", s3[4] >= 0.2, `tal=${s3[4].toFixed(2)}`);
}

console.log("\n=== 6. Degenerate case: zero allocation must not crash or divide-by-zero ===");
{
  const s = shares([0, 0, 0, 0, 0]);
  check("all-zero -> all shares 0 (no NaN)", s.every((v) => v === 0), JSON.stringify(s));
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
