# Debug Findings — Three Reported Issues

Read-only diagnosis. No `.js` or `.html` files were modified. All line numbers refer to the
current working tree under `v2/`.

---

## ISSUE 1 — Player did not appear on the scoreboard

### Root cause

The consent gate is applied at **write time**, not just at display time. A player who does
not tick the consent checkbox is **never written into the `jcb_leaderboard` localStorage
cache at all**, so there is nothing to retain and nothing to transfer. The owner's explicit
requirement — "the scoreboard should STILL retain information in CACHE (localStorage); it
just needs to be transferable" — is violated because the cache write is conditional on
consent.

There is a **second, compounding defect**: the read path
[`getLeaderboardData()`](v2/game-engine.js:257) filters out every record that is not
publicly displayable. Because legacy rows (written before the consent rule existed) have no
`consent` object, they default to `publicDisplay: false` and are hidden too. So even
previously-saved players disappear from the scoreboard.

### Evidence

1. **Consent IS read correctly from the DOM and written into the run record** — so the
   checkbox itself is not the bug:
   - [`validateAndStartBriefing()`](v2/game-engine.js:639) reads the checkbox:
     [`game-engine.js:643`](v2/game-engine.js:643) `const consentCheckbox = document.getElementById("consent-checkbox");`
     and [`game-engine.js:671`](v2/game-engine.js:671)
     `this.state.consentGiven = !!(consentCheckbox && consentCheckbox.checked);`
   - The checkbox exists in the DOM: [`index.html:236`](v2/index.html:236)
     `<input type="checkbox" id="consent-checkbox" />`.
   - The value is written into the flat run record in
     [`showFeedback()`](v2/game-engine.js:3492):
     [`game-engine.js:3593-3596`](v2/game-engine.js:3593)
     ```js
     consent: {
       publicDisplay: !!this.state.consentGiven,
       capturedAt: this.state.consentCapturedAt || new Date().toISOString(),
     },
     ```
   - `app.js` contains **no** consent handling (search returned 0 results), so there is no
     competing/overwriting read path.

2. **The leaderboard cache write is gated on consent** — this is the primary defect:
   [`saveToLeaderboard()`](v2/game-engine.js:380), lines
   [`game-engine.js:415-422`](v2/game-engine.js:415):

   ```js
   const displayable = this.isPubliclyDisplayable(playerData);
   const leaderboard = this.getLeaderboardData();
   if (displayable && !leaderboard.some((p) => p.runId === playerData.runId)) {
     leaderboard.push(playerData);
   }
   ```

   A non-consenting player is therefore never pushed into `jcb_leaderboard`. The full cohort
   IS still written to `jcb_culture_data` (lines
   [`game-engine.js:403-410`](v2/game-engine.js:403)), so the data is not lost — but the
   _scoreboard cache_ is empty for that player.

3. **The read path filters out non-consenting AND legacy records**:
   [`getLeaderboardData()`](v2/game-engine.js:257), lines
   [`game-engine.js:262-264`](v2/game-engine.js:262):

   ```js
   // Defensive filter: protects against legacy rows written before the
   // consent rule existed (they have no consent object -> not displayable).
   return parsed.filter((r) => this.isPubliclyDisplayable(r));
   ```

   [`isPubliclyDisplayable()`](v2/game-engine.js:202) requires
   `record.consent.publicDisplay === true` (lines
   [`game-engine.js:207-211`](v2/game-engine.js:207)). Legacy rows have no `consent` object,
   so they are dropped. This is the "grandfather legacy records" gap.

4. **The portable transfer path is unaffected by consent** — it is fire-and-forget and
   always runs: [`persistRunToResultsFolder()`](v2/game-engine.js:466) is called
   unconditionally at [`game-engine.js:448`](v2/game-engine.js:448). So the transferable
   copy is fine; only the localStorage scoreboard cache is wrong.

### Minimal recommended fix

Separate **cache retention** from **public display**:

1. In [`saveToLeaderboard()`](v2/game-engine.js:380), always push the run into
   `jcb_leaderboard` (cache ALL runs), regardless of consent. Keep the top-10 slice for
   display, but do not gate the push on `displayable`.
2. Move the consent filter to **display time only** — i.e. filter inside
   [`loadLeaderboard()`](v2/game-engine.js:114) / the render path, not inside
   [`getLeaderboardData()`](v2/game-engine.js:257). `getLeaderboardData()` should return the
   raw cached rows; a new `getDisplayableLeaderboard()` (or a filter at the render call site)
   should apply `isPubliclyDisplayable`.
3. Grandfather legacy records: treat a record with **no `consent` object at all** as
   displayable (legacy = pre-rule), while a record with an explicit
   `consent.publicDisplay === false` stays hidden. This preserves the fail-safe for new
   declines without erasing history.
4. Keep the rank/placement logic as-is (it already computes rank against the public cohort
   and returns `hidden: true` for non-consenting players) — only the cache write and the
   read filter need to change.

---

## ISSUE 2 — Between-scenario metric impacts look illogical ("expected growth shows no impact")

### Root cause (two independent defects)

**2a. Display rounding/negligibility bug (primary).** The impact card rounds Morale, Profit,
Attrition and Capability to **0 decimal places**, and treats any absolute value `< 0.05` as
"0". Growth alone uses 1 decimal. Many decisions move morale/capability by small fractional
amounts (e.g. `+0.4`), which then render as `0` and are styled neutral — so a decision that
_does_ have an effect appears to have "no impact".

**2b. Net-sum cancellation across a scenario.** The impact card is shown **once per
scenario**, not per decision. [`submitDecision()`](v2/game-engine.js:1721) collects ALL
decisions in the scenario into a single `decision` object
([`collectDecisionData()`](v2/game-engine.js:1921), lines
[`game-engine.js:1942-1990`](v2/game-engine.js:1942)), applies them together, and computes
one net `deltas` snapshot. Positive and negative choices within the same scenario cancel, so
a scenario containing one growth-positive choice can net to ~0 and display "0".

**2c. Some expected-growth choices genuinely map to zero growth.** In
[`scoring.js`](v2/scoring.js) several "people-first" styles deliberately add `0` growth:

- coaching: [`scoring.js:329`](v2/scoring.js:329) `impact.growth += 0;`
- affiliative: [`scoring.js:341`](v2/scoring.js:341) `impact.growth += 0; // ENHANCED from -2 (neutral now)`

These are intentional balance choices, but combined with 2a they read as "no impact".

### Evidence

1. **The displayed deltas ARE the same values applied to the running totals** — so this is
   not a "separate calculation" bug. In [`submitDecision()`](v2/game-engine.js:1721):
   - snapshot before: [`game-engine.js:1777-1783`](v2/game-engine.js:1777)
   - apply: [`game-engine.js:1786`](v2/game-engine.js:1786)
     `this.applyDecisionImpact(scenario, decision);`
   - deltas = after − before: [`game-engine.js:1789-1796`](v2/game-engine.js:1789)
   - render: [`game-engine.js:1802`](v2/game-engine.js:1802)
     `this.showConsequence(scenario, decision, deltas);`
     The deltas are computed from the real state change, so the _values_ are truthful; the
     _presentation_ is what misleads.

2. **The rounding/negligibility defect** is in
   [`showConsequence()`](v2/game-engine.js:2596), `pushImpact` at
   [`game-engine.js:2613-2626`](v2/game-engine.js:2613):

   ```js
   const negligible = Math.abs(v) < 0.05;
   ...
   const shown = negligible ? "0" : `${sign}${v.toFixed(decimals)}`;
   ```

   and the call sites at [`game-engine.js:2628-2639`](v2/game-engine.js:2628):

   ```js
   pushImpact("Growth", deltas.growth, "%", 1, false); // 1 decimal
   pushImpact("Profit", deltas.profitMargin, "%", 0, false); // 0 decimals
   pushImpact("Morale", deltas.morale, "%", 0, false); // 0 decimals
   pushImpact("Attrition", deltas.attrition, "%", 0, true); // 0 decimals
   pushImpact("Capability", deltas.organizationalCapability, " pts", 0, false); // 0 decimals
   ```

   A morale delta of `+0.4` → `toFixed(0)` → `"0"`; a capability delta of `+0.4` → `"0"`.
   The same 0-decimal rounding is applied in the HUD chip
   [`animateMetricDelta()`](v2/game-engine.js:1034) at
   [`game-engine.js:1054`](v2/game-engine.js:1054), and morale chips are additionally
   suppressed below `0.5` at [`game-engine.js:1063`](v2/game-engine.js:1063).

3. **Net-sum cancellation** is structural: one `deltas` per scenario, computed from the sum
   of all choices ([`collectDecisionData()`](v2/game-engine.js:1921) aggregates every
   `scenario.decisions` entry). There is no per-decision impact card.

4. **Zero-growth mappings** exist in [`scoring.js`](v2/scoring.js):
   [`scoring.js:329`](v2/scoring.js:329) and [`scoring.js:341`](v2/scoring.js:341).

5. **The balance/drag terms are NOT the cause of "no impact"** — they are applied inside
   [`applyDecisionImpact()`](v2/game-engine.js:1995) and
   [`applyLEADMultipliers()`](v2/game-engine.js:2070) _before_ the `deltas` snapshot is
   taken, so any drag they apply is already reflected in the displayed delta. The
   one-dimensional drag ([`game-engine.js:2181-2207`](v2/game-engine.js:2181)) and the
   balance term ([`game-engine.js:2410-2436`](v2/game-engine.js:2410)) can _reduce_ a
   positive delta toward zero, but they do not hide it — the display rounding does.

### Minimal recommended fix

1. **Fix the display precision** in [`showConsequence()`](v2/game-engine.js:2596): render
   Morale, Profit, Attrition and Capability with **1 decimal** (matching Growth), and lower
   the `negligible` threshold from `0.05` to a value that only suppresses true zero (e.g.
   `< 0.005`). This alone removes the "expected growth shows 0" symptom.
2. **Consider a per-decision impact card** (or at least label the card as the scenario net)
   so a positive choice is not masked by a negative one in the same scenario. Minimal
   version: change the card header from "DECISION RECORDED" to "SCENARIO NET IMPACT" so the
   net-sum semantics are explicit.
3. Optionally revisit the `impact.growth += 0` mappings in
   [`scoring.js:329`](v2/scoring.js:329) and [`scoring.js:341`](v2/scoring.js:341) if the
   product intent is that coaching/affiliative should show a small positive growth.

---

## ISSUE 3 — Stray `**` markdown asterisks in displayed text

### Root cause

Scenario descriptions contain literal Markdown emphasis (`**...**`), but they are injected
into the DOM with `innerHTML` **without any Markdown renderer**. `**` is not an HTML tag, so
the browser renders the asterisks literally. The `**` is therefore neither needed nor
interpreted — it is dead markup that leaks into the UI.

### Evidence

1. **User-facing `**` in scenario data**:
[`scenarios.js:11`](v2/scenarios.js:11):

   ```
   description: `**WEEK 3:** Your predecessor promised three Q1 initiatives: ...
   ```

2. **User-facing `**` in adaptive descriptions** in
[`game-engine.js`](v2/game-engine.js) (all inside `scenario.description` template
   strings):
   - [`game-engine.js:1157-1159`](v2/game-engine.js:1157) (`**Sales Director:**`, `**Finance Director:**`, `**Your gut:**`)
   - [`game-engine.js:1166-1168`](v2/game-engine.js:1166) (same trio)
   - [`game-engine.js:1195-1198`](v2/game-engine.js:1195) (`**Engineering:**`, `**Sales:**`, `**Manufacturing:**`, `**CFO:**`)
   - [`game-engine.js:1205-1208`](v2/game-engine.js:1205) (same quartet)

3. **Rendered as raw HTML, no Markdown pass**:
   [`game-engine.js:1290-1292`](v2/game-engine.js:1290):

   ```js
   <div class="scenario-brief-text">
     <p>${scenario.description}</p>
   </div>
   ```

   The description is interpolated straight into `innerHTML`. There is no `marked`/`showdown`
   or equivalent Markdown renderer anywhere in the load path (no such dependency is
   referenced).

4. **Not user-facing (do not change)**: the `**` matches in
   [`executive-summary-generator.js`](v2/executive-summary-generator.js) are JSDoc comment
   delimiters (`/** ... */`), not display strings — a search for `\*\*[A-Za-z]` returned 0
   results. [`scoring.js`](v2/scoring.js), [`culture-analysis.js`](v2/culture-analysis.js)
   and [`app.js`](v2/app.js) contain **no** `**` at all.

### Minimal recommended fix

Convert the intended emphasis to HTML `<strong>` (the text is already rendered via
`innerHTML`, so `<strong>` will work), or strip the asterisks if emphasis is not wanted:

- [`scenarios.js:11`](v2/scenarios.js:11): `**WEEK 3:**` → `<strong>WEEK 3:</strong>`
- [`game-engine.js:1157-1159`](v2/game-engine.js:1157), [`1166-1168`](v2/game-engine.js:1166),
  [`1195-1198`](v2/game-engine.js:1195), [`1205-1208`](v2/game-engine.js:1205): replace each
  `**Label:**` with `<strong>Label:</strong>`.

Alternative (single-point fix): add a tiny formatter at the render site
([`game-engine.js:1291`](v2/game-engine.js:1291)) that converts `**x**` → `<strong>x</strong>`
before interpolation. This fixes every current and future occurrence without touching the
data files, but it is a broader behavioural change than the targeted edits above.

---

## Summary table

| Issue                             | Root cause                                                                                                                                         | Key evidence                                                                                                                                                                             | Minimal fix                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Player missing from scoreboard | Consent gate applied at **write** time (non-consenting runs never cached in `jcb_leaderboard`); read path also drops legacy rows with no `consent` | [`game-engine.js:415-422`](v2/game-engine.js:415), [`game-engine.js:262-264`](v2/game-engine.js:262), [`game-engine.js:207-211`](v2/game-engine.js:207)                                  | Cache ALL runs; filter only at display time; grandfather legacy (no `consent` object) as displayable |
| 2. Illogical "no impact"          | Impact card rounds Morale/Profit/Attrition/Capability to 0 dp and treats `<0.05` as 0; card is a per-scenario net sum so choices cancel            | [`game-engine.js:2613-2639`](v2/game-engine.js:2613), [`game-engine.js:1789-1802`](v2/game-engine.js:1789), [`scoring.js:329`](v2/scoring.js:329), [`scoring.js:341`](v2/scoring.js:341) | Render all metrics at 1 dp; lower negligible threshold; label card as scenario net                   |
| 3. Stray `**`                     | Markdown emphasis in strings injected via `innerHTML` with no Markdown renderer                                                                    | [`scenarios.js:11`](v2/scenarios.js:11), [`game-engine.js:1157-1208`](v2/game-engine.js:1157), [`game-engine.js:1291`](v2/game-engine.js:1291)                                           | Replace `**x**` with `<strong>x</strong>` (or strip) at the listed locations                         |
