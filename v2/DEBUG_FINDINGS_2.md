# DEBUG FINDINGS 2 — Read-Only Diagnosis

Scope: browser-based leadership training game in `v2/`.
Method: static reading of the source plus headless Node `vm` harnesses that load the
real scripts in the exact `index.html` order and drive the real code paths.
No `.js` or `.html` file was modified. Diagnostic harnesses created (and safe to
delete): `v2/_diag_leaderboard.js`, `v2/_diag_flow.js`, `v2/_diag_top10.js`.

---

## PRIORITY 1 — #7: Player still does not appear on the leaderboard (REGRESSION)

### Root cause (CONFIRMED by reproduction)

The leaderboard cache `jcb_leaderboard` is a **top-10 slice**, and the render path
reads **only** that slice. A new run that does not crack the top 10 is written to
the full cohort store (`jcb_culture_data`) and is publicly displayable, but it is
**silently dropped from `jcb_leaderboard`** and therefore never rendered.

Evidence — [`v2/game-engine.js:443`](v2/game-engine.js:443):

```js
// Keep only top 10 for display
const top10 = leaderboard.slice(0, 10);
localStorage.setItem("jcb_leaderboard", JSON.stringify(top10));
```

Evidence — [`v2/game-engine.js:118`](v2/game-engine.js:118) (render reads only the slice):

```js
const leaderboardData = this.getDisplayableLeaderboard();
```

and [`v2/game-engine.js:281`](v2/game-engine.js:281):

```js
getDisplayableLeaderboard() {
  return this.getLeaderboardData().filter((r) => this.isPubliclyDisplayable(r));
}
```

`getLeaderboardData()` ([`v2/game-engine.js:267`](v2/game-engine.js:267)) reads
`jcb_leaderboard` — the already-truncated top-10 — so there is no path that can
surface an 11th-place run.

### Reproduction

Harness `v2/_diag_top10.js` seeds 10 consenting players with growth 40–49%, then
saves a new consenting player with 12% growth. Output:

```
placement: {"rank":11,"total":11,"inTop10":false,"hidden":false}
jcb_leaderboard rows: 10 names: [ 'Player9', ... 'Player0' ]
Newbie in jcb_leaderboard? false
Newbie in jcb_culture_data? true
displayable names: [ 'Player9', ... 'Player0' ]
```

The player is saved, is displayable, is ranked #11 of 11 — and is invisible on the
leaderboard. This is exactly the reported symptom: the owner "played again" and
their new run scored below the existing ten, so it was sliced out.

### Why it looked like a regression

The prior fix (documented in `v2/DEBUG_FINDINGS.md`) correctly moved the consent
filter to display time and made the cache retain all runs. But the cache is still
truncated to 10 **before** it is persisted, so "retain all runs" only ever applied
to the in-memory array during a single save — the persisted cache is still top-10.
The consent fix therefore did not address the truncation, and the symptom persists.

### Secondary contributing factor (not the trigger, but worth noting)

`consentGiven` is only assigned inside `validateAndStartBriefing()` at
[`v2/game-engine.js:685`](v2/game-engine.js:685), **after** all validation checks.
Any early return (e.g. the returning-player branch at
[`v2/game-engine.js:691-696`](v2/game-engine.js:691) or a validation alert at
[`v2/game-engine.js:659-677`](v2/game-engine.js:659)) leaves `consentGiven` at its
default `false`, which flows to `publicDisplay: false` at
[`v2/game-engine.js:3625-3628`](v2/game-engine.js:3625) and hides the run. In the
reproduced flow this is not the trigger (the happy path sets it correctly), but it
is a latent hazard: a returning player who reaches the round-choice screen and then
abandons it has already had their consent captured, which is fine; the real risk is
any future early-return added before line 685.

### Minimal recommended fix

Do not truncate the persisted cache. Persist the full sorted list and slice only at
render time. Concretely, in `saveToLeaderboard()` replace the top-10 write with a
full write, and in `loadLeaderboard()` slice the displayable list to 10:

```js
// saveToLeaderboard(): persist ALL runs (sorted), not just top 10
leaderboard.sort((a, b) => this.compareLeaderboardRecords(a, b));
localStorage.setItem("jcb_leaderboard", JSON.stringify(leaderboard));

// loadLeaderboard(): slice at render time
const leaderboardData = this.getDisplayableLeaderboard().slice(0, 10);
```

This preserves the "top 10 shown" UX while keeping every run in the cache, so a
player who later climbs into the top 10 is already present. If the intent is that
the player should always see their own row even when outside the top 10, add a
"your position" row rendered from the full cohort (the rank is already computed at
[`v2/game-engine.js:451-457`](v2/game-engine.js:451)).

---

## PRIORITY 2 — #6: "Executive summary generator is not loaded"

### Root cause (CONFIRMED by reproduction)

Two classic (non-module) scripts both declare a **top-level `const LEAD_CONSTANTS`**.
Classic scripts share one global lexical scope, so the second declaration throws a
`SyntaxError` and the **entire file fails to parse**. The generator class is never
defined, so `window.ExecutiveSummaryGenerator` is never assigned.

Evidence — [`v2/scoring.js:7`](v2/scoring.js:7):

```js
const LEAD_CONSTANTS = (typeof window !== "undefined" &&
  window.LEAD_CONSTANTS) || ...
```

Evidence — [`v2/executive-summary-generator.js:8`](v2/executive-summary-generator.js:8):

```js
const LEAD_CONSTANTS = (typeof window !== "undefined" &&
  window.LEAD_CONSTANTS) || ...
```

Load order — [`v2/index.html:612-613`](v2/index.html:612): `scoring.js` loads
before `executive-summary-generator.js`, so `scoring.js` wins and the generator
file dies.

The error string is emitted at [`v2/game-engine.js:2837`](v2/game-engine.js:2837):

```js
if (typeof ExecutiveSummaryGenerator === "undefined") {
  alert("Executive summary generator is not loaded.");
  return;
}
```

### Reproduction

Harness `v2/_diag_flow.js` loads the scripts in `index.html` order:

```
OK   scoring.js
FAIL executive-summary-generator.js -> SyntaxError: Identifier 'LEAD_CONSTANTS' has already been declared
...
ExecutiveSummaryGenerator: undefined
```

`lead-constants.js` is **not** the culprit: it wraps its `const LEAD_CONSTANTS`
inside an IIFE ([`v2/lead-constants.js:21`](v2/lead-constants.js:21)), so it is
function-scoped and only publishes `root.LEAD_CONSTANTS`.

### Minimal recommended fix

Remove the duplicate top-level declaration from `executive-summary-generator.js`
and read the canonical value from the global that `lead-constants.js` already
publishes. Either:

1. Delete lines 8–25 of `executive-summary-generator.js` and reference
   `window.LEAD_CONSTANTS` directly (it is guaranteed present because
   `lead-constants.js` loads first), or
2. Wrap the declaration in an IIFE exactly as `lead-constants.js` does, or
3. Rename the local binding (e.g. `const LEAD_CONSTANTS_FALLBACK = ...`) and use
   that name in the fallback expressions.

Option 1 is the smallest and removes the duplication that caused the divergence in
the first place.

---

## PRIORITY 3 — #8: Feedback / scoring alignment

### What drives feedback today

Feedback is **decision-pattern driven**, not generic. The inputs are real:

- `results.leadershipProfile` — the six Goleman style percentages accumulated from
  every decision ([`v2/scoring.js:2168`](v2/scoring.js:2168)).
- `results.leadRatios` — per-dimension ratios against the 19/scenario benchmark.
- `gameState.infoRequests` — whether the player sought evidence.
- `gameState.growth / morale / attrition / organizationalCapability`.
- `results.personalityColor` — derived from the style mix at
  [`v2/scoring.js:2070`](v2/scoring.js:2070).

`generateFeedback()` ([`v2/scoring.js:2148`](v2/scoring.js:2148)) branches on win
path, morale, agility, and LEAD deficits, and even warns on a "Pyrrhic Victory"
when growth is met with ≥3 weak LEAD dimensions
([`v2/scoring.js:2256`](v2/scoring.js:2256)). `getCriticalImprovement()`
([`v2/scoring.js:2847`](v2/scoring.js:2847)) selects one of many branches keyed on
growth shortfall, attrition, dominant/underused style, and the biggest LEAD gap.
`getLeadFeedback()` ([`v2/game-engine.js:4218`](v2/game-engine.js:4218)) maps each
dimension to high/medium/low copy using a round-aware ratio.

So the engine is already a **rule-based profiler**, not a template.

### Where it is misaligned

1. **Personality colour is computed but barely used in the narrative.** The colour
   and its description are stored ([`v2/scoring.js:2125`](v2/scoring.js:2125)) and
   shown on the leaderboard, but `generateFeedback()` never references the colour
   or its archetype. The "personality profiler" feel the owner wants is present in
   the data but absent from the prose.
2. **No scenario-level specificity.** Feedback references styles and metrics, never
   the specific scenarios the player faced (e.g. "the safety crisis", "the ethical
   dilemma"). `gameState.decisions` is available and stored, but the narrative does
   not cite it.
3. **Self-identified vs revealed style is never compared.** `selfIdentifiedStyle`
   is captured at registration ([`v2/game-engine.js:631`](v2/game-engine.js:631))
   and stored on the run ([`v2/game-engine.js:3611`](v2/game-engine.js:3611)), but
   no feedback contrasts "you said you were X" with "your decisions were Y". This is
   the single highest-value addition for a profiler feel.
4. **`getLeadFeedback()` copy is generic.** The high/medium/low strings at
   [`v2/game-engine.js:4220-4243`](v2/game-engine.js:4220) are the same for every
   player at that band; they do not reference the player's actual dominant style.

### Content inventory (available to build on)

- Six Goleman styles with per-style percentages and dominant/underused/second
  helpers ([`v2/scoring.js:3182-3212`](v2/scoring.js:3182)).
- Four LEAD dimensions with round-aware benchmarks and per-dimension copy.
- Nine personality archetypes (RED, BLUE, YELLOW, GREEN, four compounds, BALANCED)
  with descriptions ([`v2/scoring.js:2126-2143`](v2/scoring.js:2126)).
- Decision history and info-request counts per run.
- Round 2 adaptation bonus and awareness-change section
  ([`v2/executive-summary-generator.js:1348`](v2/executive-summary-generator.js:1348)).

### Recommended expansion (concrete)

1. **Add a "Self-Image vs Reality" block** to `generateFeedback()`: compare
   `gameState.selfIdentifiedStyle` with `dominantStyle.name` and emit one of three
   narratives (aligned / over-estimated / under-estimated). Data already exists.
2. **Lead with the personality archetype.** Open the feedback with the colour
   archetype and its description, then justify it with the two styles that drove it.
3. **Cite one concrete decision.** Use `gameState.decisions` to name the scenario
   where the dominant style was most exercised, so the feedback reads as observed
   behaviour rather than a score readout.
4. **Make `getLeadFeedback()` style-aware.** Pass the dominant style into the copy
   so the "low leadership" string differs for a coercive player vs a democratic one.

---

## ALSO INVESTIGATE

### #1 — Cohort dropdown ("Were you part of the LEAD course cohort?")

Insertion point: the registration form in [`v2/index.html:80-258`](v2/index.html:80).
The natural place is a new `.form-group` immediately after the Seniority group
(ends at [`v2/index.html:150`](v2/index.html:150)) and before the leadership-style
group (starts at [`v2/index.html:152`](v2/index.html:152)).

Neighbouring ids: `player-name` ([`v2/index.html:88`](v2/index.html:88)),
`player-function` ([`v2/index.html:101`](v2/index.html:101)),
`player-seniority` ([`v2/index.html:122`](v2/index.html:122)),
`consent-checkbox` ([`v2/index.html:236`](v2/index.html:236)).

Value read path: `validateAndStartBriefing()` reads the form fields at
[`v2/game-engine.js:654-657`](v2/game-engine.js:654) and assigns them to state at
[`v2/game-engine.js:682-686`](v2/game-engine.js:682). A new dropdown would follow
the same pattern: read `document.getElementById("player-cohort").value` and assign
`this.state.cohort`. Storage: add `cohort: this.state.cohort` to the
`saveToLeaderboard({...})` payload at
[`v2/game-engine.js:3581-3630`](v2/game-engine.js:3581), alongside `jobFunction`
and `seniority`. The canonical record shape is built in
[`v2/results-store.js:246`](v2/results-store.js:246) (`flatToCanonical`), so a new
field should be added there too if it must survive the merge tool.

### #2 — iPad / touchscreen keyboard

The name input already carries touch attributes at
[`v2/index.html:86-96`](v2/index.html:86): `ontouchstart="this.focus();"`,
`onfocus="this.select()"`, `autocomplete="off"`, `autocorrect="off"`,
`autocapitalize="words"`. A JS helper also forces focus on `touchstart`
([`v2/app.js:38-60`](v2/app.js:38)).

Gaps that can prevent the on-screen keyboard from reliably appearing on iPadOS:

- No `inputmode` attribute. Add `inputmode="text"` to be explicit.
- No `enterkeyhint`. Add `enterkeyhint="done"` so the keyboard shows a Done key.
- The `touchstart` handler calls `this.focus()` inside a `setTimeout(..., 100)`.
  On iOS, programmatic focus outside the user-gesture call stack is often ignored
  and the keyboard does not open. The `ontouchstart="this.focus();"` inline handler
  is the reliable one; the delayed `setTimeout` focus is the fragile one.
- `autocapitalize="words"` is fine for names; keep it.

Recommended: add `inputmode="text"` and `enterkeyhint="done"` to
[`v2/index.html:86`](v2/index.html:86), and remove the `setTimeout` wrapper in
[`v2/app.js:46-49`](v2/app.js:46) so focus happens synchronously within the gesture.

### #3 — Consent text simplification

Exact markup to change: [`v2/index.html:234-253`](v2/index.html:234).

- Checkbox: [`v2/index.html:236`](v2/index.html:236) —
  `<input type="checkbox" id="consent-checkbox" />`.
- Current label text: [`v2/index.html:237-240`](v2/index.html:237) — the long
  three-sentence paragraph.
- Helper note: [`v2/index.html:242-252`](v2/index.html:242) — the `#consent-note`
  paragraph.

To simplify to exactly "I consent to my results appearing on the scoreboard",
replace the label text at lines 237–240 with that single sentence and remove (or
empty) the `#consent-note` paragraph at lines 242–252. No JS reads the label text;
only `consentCheckbox.checked` is read at
[`v2/game-engine.js:685`](v2/game-engine.js:685), so this is a pure copy change.

### #4 — "50k" occurrences

All monetary occurrences found (there is no literal "50k" string; the values are
written as `£50K` / `£500K`):

- [`v2/game-engine.js:1189`](v2/game-engine.js:1189) — "Every week of delay costs
  £50K in lost sales." (scenario narrative)
- [`v2/game-engine.js:1217`](v2/game-engine.js:1217) — "Early launch = £500K
  revenue this year, delayed launch = £250K risk…" (CFO dialogue)
- [`v2/game-engine.js:1227`](v2/game-engine.js:1227) — "Early launch = £500K
  revenue this year…" (CFO dialogue)
- [`v2/scenarios.js:796`](v2/scenarios.js:796) — "Marketing wants £350K…"
- [`v2/scenarios.js:861`](v2/scenarios.js:861) — "How do you allocate £500K?"
- [`v2/scenarios.js:973`](v2/scenarios.js:973) — "How do you allocate £250K?"
- [`v2/scenarios.js:1132`](v2/scenarios.js:1132) — "Allocate the £500K cultural
  integration budget"
- [`v2/scenarios.js:1192`](v2/scenarios.js:1192) — "A lucrative £500K export order…"
- [`v2/scenarios.js:1524`](v2/scenarios.js:1524) — "a £500K war chest"
- [`v2/scenarios.js:1554`](v2/scenarios.js:1554) — "Allocate the £500K response
  budget"
- [`v2/executive-summary-generator.js:713`](v2/executive-summary-generator.js:713)
  — "Making £500k+ decisions on instinct…" (career-risk copy)
- [`v2/scoring.js:3846`](v2/scoring.js:3846) — "Part 2: £500K investment
  allocation" (comment)

The only literal "£50K" (not £500K) is at
[`v2/game-engine.js:1189`](v2/game-engine.js:1189). The money formatter that renders
these is `formatMoney()` at [`v2/game-engine.js:1385`](v2/game-engine.js:1385).

### #5 — "PRIVATE RESULTS" card removal

Exact location: [`v2/game-engine.js:3653-3666`](v2/game-engine.js:3653), inside
`showLeaderboardPlacement()`. The card is rendered when
`placement.hidden || !placement.rank`:

```js
if (placement.hidden || !placement.rank) {
  container.innerHTML = `
    <div class="placement-card">
      <div class="placement-medal">🔒</div>
      <div class="placement-rank">PRIVATE RESULTS</div>
      <div class="placement-sub">Your results are private and not shown on the scoreboard. …</div>
    </div>`;
  ...
  return;
}
```

Removing it entails: delete the `if` block (lines 3653–3666) so the function always
falls through to the ranked reveal at
[`v2/game-engine.js:3668-3697`](v2/game-engine.js:3668). Note that a non-consenting
player has `rank: null` and `hidden: true` (set at
[`v2/game-engine.js:464-469`](v2/game-engine.js:464)), so without this branch the
ranked reveal would render `#null OF n`. A safe removal therefore also needs a
fallback headline for the hidden case (e.g. show the private message inline without
the card, or show "Not ranked" instead of `#null`). The CSS class `.placement-card`
is defined at [`v2/styles.css:1484`](v2/styles.css:1484) and is shared with the
ranked card, so it should not be deleted.

---

## Summary of confirmed root causes

| #   | Issue                                       | Root cause                                                                                                                          | Evidence                                                                                                                                    |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Player missing from leaderboard             | `jcb_leaderboard` persisted as a top-10 slice; render reads only that slice, so an 11th-place run is invisible                      | [`game-engine.js:443`](v2/game-engine.js:443), [`game-engine.js:118`](v2/game-engine.js:118); reproduced in `_diag_top10.js`                |
| 6   | "Executive summary generator is not loaded" | Duplicate top-level `const LEAD_CONSTANTS` in two classic scripts → `SyntaxError` → generator file never parses                     | [`scoring.js:7`](v2/scoring.js:7), [`executive-summary-generator.js:8`](v2/executive-summary-generator.js:8); reproduced in `_diag_flow.js` |
| 8   | Feedback feels generic                      | Engine is rule-based but never uses the personality colour, never cites scenarios, never compares self-identified vs revealed style | [`scoring.js:2148`](v2/scoring.js:2148), [`scoring.js:2070`](v2/scoring.js:2070), [`game-engine.js:4218`](v2/game-engine.js:4218)           |
