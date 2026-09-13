# JCB Leadership in Action — Audio and Video Prompt Pack

**Document type:** Production brief (greenfield)
**Status of the game:** The game is currently **100% silent**. There is no `assets/` folder, no `<audio>` or `<video>` elements, no `new Audio(` calls and no `AudioContext` anywhere in the codebase. Every prompt in this document describes an asset that does **not yet exist**.
**Relationship to [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md):** That guide is a forward-looking plan, not an implemented specification. It states plainly that nothing is implemented yet. This document supersedes its asset inventory with a fuller, production-ready set, while remaining compatible with the wiring approach it describes.

---

## How to use this document

- Every prompt below is **self-contained and copy-pasteable**. Paste it directly into an AI audio or video generation tool, or hand it to a composer, sound designer, voice artist or video editor as a standalone brief.
- Prompts are written for a **serious, premium executive business simulation** for a global engineering company. The register is corporate, restrained and confident. Avoid cartoonish, arcade-style or slapstick sound design at all times.
- Each asset has a stable **Asset ID** and **Filename**. These map one-to-one onto the recommended folder structure in section 4, so the prompts can be wired into the game later without renaming anything.
- **Priority** tells you what to build first. Must-have assets carry the core feedback loop; Nice-to-have assets add polish.
- **Player-facing narration script text contains no apostrophes.** This is a standing project rule. Where a contraction would normally appear, the script uses alternative phrasing (for example, "do not" instead of the contracted form).
- All spelling in this document is **British English** (organisation, colour, prioritise, programme, judgement).

---

## 2. Asset inventory

### 2.1 Interface SFX

| Asset ID                | Filename                    | Type | Duration | Where triggered                                               | Priority     |
| ----------------------- | --------------------------- | ---- | -------- | ------------------------------------------------------------- | ------------ |
| `sfx-intro`             | `sfx-intro.mp3`             | SFX  | 3.0 s    | Briefing screen opens via `startBriefing()`                   | Must-have    |
| `sfx-decision-positive` | `sfx-decision-positive.mp3` | SFX  | 1.5 s    | `submitDecision()` when the growth delta is positive          | Must-have    |
| `sfx-decision-negative` | `sfx-decision-negative.mp3` | SFX  | 1.5 s    | `submitDecision()` when the growth delta is negative          | Must-have    |
| `sfx-decision-neutral`  | `sfx-decision-neutral.mp3`  | SFX  | 1.2 s    | `submitDecision()` when the growth delta is zero              | Nice-to-have |
| `sfx-consequence-sting` | `sfx-consequence-sting.mp3` | SFX  | 2.0 s    | Consequence modal opens via `showConsequence()`               | Must-have    |
| `sfx-results-reveal`    | `sfx-results-reveal.mp3`    | SFX  | 4.0 s    | Results screen reveal via `displayResults()`                  | Must-have    |
| `sfx-timer-warning`     | `sfx-timer-warning.mp3`     | SFX  | 2.0 s    | Gameplay timer crosses 2 minutes remaining in `startTimer()`  | Nice-to-have |
| `sfx-timer-critical`    | `sfx-timer-critical.mp3`    | SFX  | 2.0 s    | Gameplay timer crosses 30 seconds remaining in `startTimer()` | Nice-to-have |
| `sfx-briefing-tick`     | `sfx-briefing-tick.mp3`     | SFX  | 0.5 s    | Final 10 seconds of the 90-second briefing countdown          | Nice-to-have |

### 2.2 Briefing narration

| Asset ID          | Filename              | Type      | Duration | Where triggered                            | Priority     |
| ----------------- | --------------------- | --------- | -------- | ------------------------------------------ | ------------ |
| `nar-briefing-r1` | `nar-briefing-r1.mp3` | Narration | 55–65 s  | Round 1 briefing screen, after `sfx-intro` | Nice-to-have |
| `nar-briefing-r2` | `nar-briefing-r2.mp3` | Narration | 45–55 s  | Round 2 briefing screen, after `sfx-intro` | Nice-to-have |

### 2.3 Music beds

| Asset ID           | Filename               | Type      | Duration   | Where triggered                      | Priority     |
| ------------------ | ---------------------- | --------- | ---------- | ------------------------------------ | ------------ |
| `mus-briefing-bed` | `mus-briefing-bed.mp3` | Music bed | 90 s loop  | Briefing screen, under narration     | Nice-to-have |
| `mus-gameplay-bed` | `mus-gameplay-bed.mp3` | Music bed | 120 s loop | Scenario screen, from `startTimer()` | Nice-to-have |
| `mus-results-bed`  | `mus-results-bed.mp3`  | Music bed | 60 s loop  | Results screen, from `showResults()` | Nice-to-have |

### 2.4 Consequence videos

One clip per scenario. All are 16:9, silent-native (audio optional, see notes), and must fit the 5-second consequence modal auto-advance.

| Asset ID             | Filename                 | Type  | Duration | Where triggered                                  | Priority     |
| -------------------- | ------------------------ | ----- | -------- | ------------------------------------------------ | ------------ |
| `vid-consequence-01` | `vid-consequence-01.mp4` | Video | 5.0 s    | `showConsequence()` — THE INHERITANCE            | Nice-to-have |
| `vid-consequence-02` | `vid-consequence-02.mp4` | Video | 5.0 s    | `showConsequence()` — THE DATA DILEMMA           | Nice-to-have |
| `vid-consequence-03` | `vid-consequence-03.mp4` | Video | 5.0 s    | `showConsequence()` — THE SAFETY NEAR-MISS       | Nice-to-have |
| `vid-consequence-04` | `vid-consequence-04.mp4` | Video | 5.0 s    | `showConsequence()` — THE AMBIGUOUS SIGNAL       | Nice-to-have |
| `vid-consequence-05` | `vid-consequence-05.mp4` | Video | 5.0 s    | `showConsequence()` — THE COMPETITOR THREAT      | Nice-to-have |
| `vid-consequence-06` | `vid-consequence-06.mp4` | Video | 5.0 s    | `showConsequence()` — THE TALENT EXODUS          | Nice-to-have |
| `vid-consequence-07` | `vid-consequence-07.mp4` | Video | 5.0 s    | `showConsequence()` — THE DIFFICULT CONVERSATION | Nice-to-have |
| `vid-consequence-08` | `vid-consequence-08.mp4` | Video | 5.0 s    | `showConsequence()` — THE INNOVATION GAMBLE      | Nice-to-have |
| `vid-consequence-09` | `vid-consequence-09.mp4` | Video | 5.0 s    | `showConsequence()` — THE YEAR-END RECKONING     | Nice-to-have |
| `vid-consequence-10` | `vid-consequence-10.mp4` | Video | 5.0 s    | `showConsequence()` — THE MERGER                 | Nice-to-have |
| `vid-consequence-11` | `vid-consequence-11.mp4` | Video | 5.0 s    | `showConsequence()` — THE ETHICAL LINE           | Nice-to-have |
| `vid-consequence-12` | `vid-consequence-12.mp4` | Video | 5.0 s    | `showConsequence()` — THE REMOTE WORK REVOLT     | Nice-to-have |
| `vid-consequence-13` | `vid-consequence-13.mp4` | Video | 5.0 s    | `showConsequence()` — THE SUCCESSION CRISIS      | Nice-to-have |
| `vid-consequence-14` | `vid-consequence-14.mp4` | Video | 5.0 s    | `showConsequence()` — THE MARKET DISRUPTION      | Nice-to-have |
| `vid-consequence-15` | `vid-consequence-15.mp4` | Video | 5.0 s    | `showConsequence()` — THE SECOND RECKONING       | Nice-to-have |

### 2.5 Results and outcome audio

| Asset ID                  | Filename                      | Type | Duration | Where triggered                                      | Priority     |
| ------------------------- | ----------------------------- | ---- | -------- | ---------------------------------------------------- | ------------ |
| `sfx-outcome-exceptional` | `sfx-outcome-exceptional.mp3` | SFX  | 3.0 s    | `displayResults()` when placement is the top band    | Nice-to-have |
| `sfx-outcome-strong`      | `sfx-outcome-strong.mp3`      | SFX  | 2.5 s    | `displayResults()` when placement is the second band | Nice-to-have |
| `sfx-outcome-developing`  | `sfx-outcome-developing.mp3`  | SFX  | 2.5 s    | `displayResults()` when placement is the third band  | Nice-to-have |
| `sfx-outcome-foundation`  | `sfx-outcome-foundation.mp3`  | SFX  | 2.5 s    | `displayResults()` when placement is the lowest band | Nice-to-have |

---

## 3. Detailed prompts

### 3.1 Interface SFX

---

#### `sfx-intro` — `sfx-intro.mp3`

- **Duration:** 3.0 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** The instant the briefing screen opens from `startBriefing()`. This is the first sound the player hears after pressing START, so it must feel like a confident opening statement rather than a jingle.

**Prompt:**

> A short, premium corporate opening sting for an executive leadership simulation. Begin with a low, warm sub-bass swell rising from 40 Hz to 90 Hz over the first second, giving a sense of grounded authority. Layer a single clean marimba note (C5) struck at 0.4 seconds with a soft mallet, followed by a perfect fifth above (G5) at 0.9 seconds — restrained, not melodic. Add a subtle reverse-cymbal wash that peaks at 1.2 seconds and decays smoothly. Underneath, a soft analogue synth pad in C minor holds steady, filtered with a gentle low-pass sweep opening from 800 Hz to 3 kHz. The final 0.8 seconds resolve to a single sustained low C with a slow fade. No drums, no brass stabs, no whooshes. Emotional register: assured, serious, forward-looking. Think the opening of a board-level strategy film, not a product launch advert.

**Technical notes:**

- Peak loudness target −14 LUFS integrated, true peak no higher than −1 dBTP.
- Fade out over the final 400 ms to avoid a hard cut.
- Must not autoplay on page load. Trigger only from the briefing button click, per the autoplay guidance in [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md:104).
- If the file is absent, the game must continue silently with no error.

---

#### `sfx-decision-positive` — `sfx-decision-positive.mp3`

- **Duration:** 1.5 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** In `submitDecision()`, immediately when the calculated growth delta is positive. This is the player reward cue, so it must be satisfying but never celebratory or game-show-like.

**Prompt:**

> A brief, understated positive confirmation sound for a corporate simulation. A single bright marimba note (E5) struck cleanly at 0.0 seconds, followed 120 ms later by a higher note (B5) a perfect fifth above, creating a rising two-note figure. Each note has a soft, rounded attack and a natural wooden decay of about 600 ms. Behind the notes, a very quiet high-frequency shimmer — like a soft cymbal swell at low volume — rises and falls within 800 ms. Add a barely audible low sine tone at 110 Hz that fades in over 200 ms and out by 1.2 seconds to give the sound body. No reverb tails longer than 400 ms. Emotional register: quiet confidence, a decision well made. Avoid anything resembling a cash register, a chime, or a mobile phone notification.

**Technical notes:**

- Peak loudness target −16 LUFS integrated, true peak no higher than −1 dBTP. This cue plays frequently, so keep it noticeably quieter than the intro sting.
- Fade out over the final 200 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-decision-negative` — `sfx-decision-negative.mp3`

- **Duration:** 1.5 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** In `submitDecision()`, immediately when the calculated growth delta is negative. This signals a setback without punishing or mocking the player.

**Prompt:**

> A short, sober negative confirmation sound for a corporate simulation. A single low marimba note (A3) struck at 0.0 seconds with a slightly dampened mallet, giving a duller, heavier tone than a positive cue. Follow it 150 ms later with a descending minor second (G3) that resolves downward rather than upward. Underneath, a soft low-pass filtered synth tone at 90 Hz fades in over 300 ms and holds for 700 ms before fading out. Add a very subtle, dry paper-like texture — a quiet filtered noise burst of 100 ms at 0.1 seconds — to suggest a page turning or a door closing softly. No dissonant stabs, no buzzer, no alarm. Emotional register: measured concern, a consequence noted, not a failure. The player should feel informed, not scolded.

**Technical notes:**

- Peak loudness target −16 LUFS integrated, true peak no higher than −1 dBTP.
- Fade out over the final 250 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-decision-neutral` — `sfx-decision-neutral.mp3`

- **Duration:** 1.2 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** In `submitDecision()`, when the calculated growth delta is exactly zero. This is a neutral acknowledgement, not a reward or a penalty.

**Prompt:**

> A minimal, neutral acknowledgement tone for a corporate simulation. A single soft marimba note (C4) struck once at 0.0 seconds with a gentle mallet and a natural decay of 700 ms. No second note, no rising or falling figure. Add a very quiet, warm synth pad underneath at 130 Hz that fades in over 200 ms and out by 1.0 second, giving the note a sense of held breath. Keep the whole sound dry and close, with no reverb beyond 300 ms. Emotional register: calm, factual, neither good nor bad. Think of a considered pause rather than a reaction.

**Technical notes:**

- Peak loudness target −18 LUFS integrated, true peak no higher than −1 dBTP.
- Fade out over the final 200 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-consequence-sting` — `sfx-consequence-sting.mp3`

- **Duration:** 2.0 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** The moment the consequence modal opens in `showConsequence()`. This is the transition from decision to outcome, so it should feel like a curtain lifting.

**Prompt:**

> A short transition sting marking the reveal of a consequence in a corporate simulation. Open with a filtered noise whoosh sweeping upward from 200 Hz to 4 kHz across the first 700 ms, with a soft attack and a smooth tail. Layer a low synth swell in D minor rising from 60 Hz to 120 Hz over the same period. At 0.8 seconds, place a single clean marimba note (D4) with a soft mallet, followed at 1.1 seconds by a sustained low D2 pad that holds to the end. The whoosh should feel like air moving, not like a sci-fi teleport. No metallic clangs, no riser clichés with pitch-shifted vocals. Emotional register: anticipation resolving into clarity, the moment the outcome becomes visible.

**Technical notes:**

- Peak loudness target −15 LUFS integrated, true peak no higher than −1 dBTP.
- The consequence modal auto-advances after 5 seconds (see [`game-engine.js`](game-engine.js:2826)), so this sting must complete well within that window and must not loop.
- Fade out over the final 300 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-results-reveal` — `sfx-results-reveal.mp3`

- **Duration:** 4.0 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** On the results screen, triggered from `displayResults()` as the placement and score are revealed. This is the emotional payoff of the whole session.

**Prompt:**

> A four-second reveal sting for the results screen of an executive leadership simulation. Begin with a soft low synth pad in F major fading in over 500 ms at 80 Hz. At 0.6 seconds, introduce a rising three-note marimba figure — F4, A4, C5 — each note 250 ms apart, clean and rounded. At 1.6 seconds, add a warm sustained string-like pad (synthesised, not sampled orchestra) that swells gently to 2.8 seconds. At 2.4 seconds, place a single soft cymbal swell that peaks at 3.0 seconds and decays naturally. Resolve on a sustained F major chord from 3.0 seconds, fading out over the final second. No drums, no fanfare trumpets, no applause. Emotional register: earned achievement, quiet pride, the gravity of a year of leadership. It should feel like the closing shot of a documentary, not the end of a quiz.

**Technical notes:**

- Peak loudness target −14 LUFS integrated, true peak no higher than −1 dBTP.
- Fade out over the final 800 ms.
- Must not loop. Plays once per results reveal.
- Must degrade silently if the file is missing.

---

#### `sfx-timer-warning` — `sfx-timer-warning.mp3`

- **Duration:** 2.0 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** In the `startTimer()` interval, the first time the gameplay timer crosses 2 minutes remaining. Fires once only.

**Prompt:**

> A discreet time-pressure cue for a corporate simulation. Two soft, low marimba notes (G3 then F3) struck 400 ms apart, each with a dampened mallet and a short decay. Underneath, a quiet pulsing synth tone at 100 Hz that beats twice over the two seconds, like a slow, calm heartbeat. Keep the whole sound low in the mix and slightly filtered, as if heard from the next room. No ticking clocks, no alarm beeps, no rising panic. Emotional register: gentle awareness that time is finite, delivered with composure.

**Technical notes:**

- Peak loudness target −20 LUFS integrated, true peak no higher than −1 dBTP. This is deliberately quiet so it does not disrupt concentration.
- Fires once only. Guard against repeat triggering on every timer tick.
- Fade out over the final 300 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-timer-critical` — `sfx-timer-critical.mp3`

- **Duration:** 2.0 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** In the `startTimer()` interval, the first time the gameplay timer crosses 30 seconds remaining. Fires once only.

**Prompt:**

> A firmer time-pressure cue for a corporate simulation, still restrained. Three low marimba notes (G3, F3, E3) struck 300 ms apart with a dampened mallet, descending in pitch to signal urgency. Underneath, a low synth pulse at 90 Hz beating three times across the two seconds, slightly faster than the earlier warning cue. Add a very subtle filtered noise texture that rises gently in the background, suggesting mounting pressure without alarm. No sirens, no buzzers, no clock ticks. Emotional register: focused urgency, a deadline approaching, delivered with control.

**Technical notes:**

- Peak loudness target −18 LUFS integrated, true peak no higher than −1 dBTP.
- Fires once only. Guard against repeat triggering on every timer tick.
- Fade out over the final 300 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-briefing-tick` — `sfx-briefing-tick.mp3`

- **Duration:** 0.5 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, mono is acceptable
- **Where it plays:** Once per second during the final 10 seconds of the 90-second briefing countdown in `startBriefing()`.

**Prompt:**

> A single, soft, dry tick for a countdown. A short filtered noise burst of 30 ms with a fast attack and immediate decay, centred around 2 kHz, followed by a very quiet low marimba tap at 200 Hz with a 200 ms decay. The sound should be intimate and close, like a finger tapping a wooden desk, not a clock mechanism. Emotional register: quiet prompting, no anxiety. It must be unobtrusive enough to repeat ten times without becoming irritating.

**Technical notes:**

- Peak loudness target −22 LUFS integrated, true peak no higher than −1 dBTP. This is the quietest cue in the pack.
- Must be perfectly consistent on every repeat so the rhythm feels deliberate.
- No fade needed at this length, but avoid a click at the tail.
- Must degrade silently if the file is missing.

---

### 3.2 Briefing narration

Both narration scripts are written to be spoken over the briefing music bed. They contain **no apostrophes**, per the standing project rule. Voice direction is identical for both: accent-neutral British English, gender-neutral delivery, calm and authoritative, moderate pace around 140 words per minute, warm but not matey.

---

#### `nar-briefing-r1` — `nar-briefing-r1.mp3`

- **Duration:** 55–65 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** Round 1 briefing screen, beginning shortly after `sfx-intro` completes. The briefing screen runs a 90-second countdown, so the narration must finish comfortably before it expires.

**Script to be spoken:**

> Welcome to Leadership in Action. Over the next twelve months you will lead a division of JCB through a series of real decisions. Each scenario places you in a genuine leadership moment. You will choose an approach, weigh the information available, and live with the outcome. There are no perfect answers. There are only choices, and the consequences that follow them. You have fifteen minutes of gameplay time. Read each scenario carefully. Consider the additional information before you commit. Your decisions will shape growth, trust and the culture of your team. When you are ready, begin.

**Voice direction:**

- Tone: calm, assured, executive. The voice of a trusted senior leader, not a presenter or announcer.
- Pace: moderate, roughly 140 words per minute, with a deliberate pause after "There are no perfect answers."
- Accent: neutral British English. Avoid regional markers.
- Gender: gender-neutral or unspecified. Either a warm mid-range male or a warm mid-range female voice works.
- Energy: steady and grounded. No rising game-show intonation. No smiling through the words.
- Delivery note: the final sentence, "When you are ready, begin," should slow slightly and land with quiet authority.

**Technical notes:**

- Peak loudness target −16 LUFS integrated, true peak no higher than −1 dBTP.
- Leave 500 ms of silence at the head and 1 second at the tail.
- Must not autoplay on page load. Trigger from the briefing button click.
- If absent, the briefing screen must remain fully usable with the countdown and text alone.

---

#### `nar-briefing-r2` — `nar-briefing-r2.mp3`

- **Duration:** 45–55 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** Round 2 briefing screen, beginning shortly after `sfx-intro` completes.

**Script to be spoken:**

> Welcome back. You have led this division through one full year. Now the challenges become harder. Round Two tests the decisions that separate good managers from exceptional leaders. You will face a merger, an ethical line, a workforce in revolt, a succession crisis and a market disruption. The stakes are higher. The information is more ambiguous. The consequences last longer. You have fifteen minutes of gameplay time. Trust your judgement, but question your assumptions. Your second year begins now.

**Voice direction:**

- Tone: calm, assured, executive, with a subtle note of recognition that the player has earned their place here.
- Pace: moderate, roughly 140 words per minute, with a deliberate pause after "The stakes are higher."
- Accent: neutral British English. Avoid regional markers.
- Gender: gender-neutral or unspecified. Match the voice used for Round 1 so the two briefings feel like one continuous narrator.
- Energy: steady and grounded, slightly more weight on the final line.
- Delivery note: "Your second year begins now" should be delivered slowly and with finality.

**Technical notes:**

- Peak loudness target −16 LUFS integrated, true peak no higher than −1 dBTP.
- Leave 500 ms of silence at the head and 1 second at the tail.
- Must not autoplay on page load. Trigger from the briefing button click.
- If absent, the briefing screen must remain fully usable with the countdown and text alone.

---

### 3.3 Music beds

All three beds are designed to loop seamlessly and to sit well below narration and SFX in the mix. They should be composed so that removing them entirely leaves the game fully functional.

---

#### `mus-briefing-bed` — `mus-briefing-bed.mp3`

- **Duration:** 90 seconds, seamless loop
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** Briefing screen, starting with `startBriefing()` and looping until the player begins gameplay. Sits underneath `nar-briefing-r1` or `nar-briefing-r2`.

**Prompt:**

> A calm, premium corporate underscore for an executive briefing. Genre: minimal ambient corporate. Instrumentation: a soft analogue synth pad in C minor, a sparse upright piano playing single notes with long gaps, a very quiet low string-like pad, and occasional soft marimba accents. Tempo: 70 BPM, but with no percussion at all — the pulse should be implied by the piano phrasing rather than stated by drums. Mood arc: begins contemplative and slightly expectant, opens gently around the 40-second mark with a warmer major-third colour, then returns to the opening texture by 85 seconds so the loop point is invisible. Keep the dynamic range narrow and the high frequencies rolled off above 8 kHz so it never competes with speech. Emotional register: focused, serious, quietly optimistic. Think the background of a strategy away-day film, not a news sting.

**Technical notes:**

- Peak loudness target −24 LUFS integrated, true peak no higher than −1 dBTP. This is a bed, so it must sit well under narration.
- Loop point must be sample-accurate and gapless. Compose the final bar to resolve into the first bar.
- Fade in over 2 seconds on start, fade out over 2 seconds when the player leaves the briefing screen.
- Must degrade silently if the file is missing.

---

#### `mus-gameplay-bed` — `mus-gameplay-bed.mp3`

- **Duration:** 120 seconds, seamless loop
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** Scenario screen, starting from `startTimer()` and looping for the duration of gameplay. It must not distract from reading and decision-making.

**Prompt:**

> A restrained, focused corporate underscore for active decision-making. Genre: minimal electronic ambient with subtle tension. Instrumentation: a steady low synth pulse at 60 Hz on the beat, a soft filtered pad in D minor, a muted marimba pattern that repeats every four bars, and a very quiet high shimmer that appears only in the second half of the loop. Tempo: 80 BPM with a gentle, unobtrusive pulse — no snare, no hi-hat, no kick drum. Mood arc: begins neutral and alert, introduces a slight harmonic tension around 60 seconds, then resolves back to the opening texture by 115 seconds for a clean loop. Keep the arrangement sparse and leave clear space in the mid-range so it never masks speech or SFX. Emotional register: concentration, steady momentum, quiet stakes.

**Technical notes:**

- Peak loudness target −26 LUFS integrated, true peak no higher than −1 dBTP. This is the quietest bed in the pack because it plays for up to 15 minutes.
- Loop point must be sample-accurate and gapless.
- Fade in over 2 seconds on start, fade out over 2 seconds when the game ends.
- Must degrade silently if the file is missing.

---

#### `mus-results-bed` — `mus-results-bed.mp3`

- **Duration:** 60 seconds, seamless loop
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** Results screen, starting from `showResults()` and looping while the player reviews their outcome and downloads the executive summary.

**Prompt:**

> A warm, reflective corporate underscore for a results and reflection screen. Genre: minimal ambient corporate with a sense of arrival. Instrumentation: a soft piano playing a slow four-chord progression in F major, a warm analogue pad underneath, a gentle low string-like swell, and a single sustained marimba note that recurs every eight bars. Tempo: 65 BPM, no percussion. Mood arc: begins reflective and slightly open, builds gently to a warm resolution around 35 seconds, then settles back to the opening texture by 55 seconds for a clean loop. Keep the tone dignified and understated. Emotional register: quiet pride, thoughtful reflection, the end of a significant year. Avoid anything triumphant or sentimental.

**Technical notes:**

- Peak loudness target −22 LUFS integrated, true peak no higher than −1 dBTP.
- Loop point must be sample-accurate and gapless.
- Fade in over 2 seconds on start, fade out over 3 seconds when the player leaves the results screen.
- Must degrade silently if the file is missing.

---

### 3.4 Consequence videos

Every clip is exactly 5 seconds so it fits the consequence modal auto-advance, which fires after 5 seconds (see [`game-engine.js`](game-engine.js:2826)). All clips are 16:9, 1920×1080, H.264/AAC, and are designed to be played **muted** — the accompanying audio description is provided so a sound designer can optionally add a short bed, but the clip must work perfectly with no audio at all. Each clip should feel like a single, held cinematic moment rather than a montage.

**Shared visual direction for all fifteen clips:** premium corporate documentary style. Shallow depth of field, natural light, muted colour grade with JCB yellow used sparingly as an accent. Real engineering environments — factory floors, dealerships, meeting rooms, test sites. No stock-footage clichés such as handshakes, thumbs up, or slow-motion boardroom laughter. No on-screen text. No logos. Camera movement should be slow and deliberate: a gentle push-in, a slow lateral track, or a static hold.

---

#### `vid-consequence-01` — `vid-consequence-01.mp4` — THE INHERITANCE

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE INHERITANCE.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a quiet, modern meeting room at dusk. Three folders sit on a polished table, each labelled with a different initiative. A single overhead light casts a warm pool on the table while the rest of the room falls into shadow. Camera: a slow, steady push-in from a medium shot to a close-up of the three folders, moving no more than 30 centimetres over the five seconds. Pacing: unhurried, deliberate. Lighting: warm tungsten key light, cool blue ambient fill from a window. Colour grade: muted, desaturated, with a single JCB yellow folder tab as the only saturated element. Accompanying audio: a very quiet room tone with a low synth pad fading in over the final two seconds. No dialogue, no music sting.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default. The optional audio described above must not be required for comprehension.
- Must not autoplay with sound. If the file is absent, the CSS-only impact card must render exactly as it does today.
- Keep the file under 5 MB to avoid kiosk load stalls.

---

#### `vid-consequence-02` — `vid-consequence-02.mp4` — THE DATA DILEMMA

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE DATA DILEMMA.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: two printed reports lie side by side on a desk, their charts visibly contradicting one another. A hand enters frame and rests between them, still and thoughtful. Camera: a slow overhead top-down shot, drifting laterally by about 20 centimetres across the five seconds. Pacing: contemplative. Lighting: soft diffused daylight from the left, casting gentle shadows across the paper. Colour grade: cool and analytical, with the two reports subtly colour-coded in blue and red. Accompanying audio: a faint paper rustle and a low, unresolved synth tone that fades in over the last two seconds. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-03` — `vid-consequence-03.mp4` — THE SAFETY NEAR-MISS

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE SAFETY NEAR-MISS.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a distribution site yard at first light. A Telescopic Handler stands stationary, its boom lowered, with a single safety cone placed in front of it. The yard is empty of people. Camera: a slow, low-angle track moving from the machine wheel to the safety cone over the five seconds. Pacing: grave and still. Lighting: cool dawn light with a low mist, giving the scene a serious, reflective mood. Colour grade: desaturated steel greys and blues, with the safety cone as the only vivid element. Accompanying audio: distant industrial ambience and a single low, sustained tone. No dialogue, no alarm sounds.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-04` — `vid-consequence-04.mp4` — THE AMBIGUOUS SIGNAL

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE AMBIGUOUS SIGNAL.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a dealership forecourt on an overcast afternoon. A salesperson stands mid-conversation with a customer beside a compact machine, but the customer is looking away, distracted. The scene is deliberately unresolved — nobody is smiling, nobody is leaving. Camera: a slow lateral track from behind the salesperson, drifting right by about 40 centimetres across the five seconds. Pacing: uncertain, searching. Lighting: flat, diffused grey daylight. Colour grade: muted and slightly cool, with no saturated accents. Accompanying audio: faint forecourt ambience and a single sustained, unresolved synth note. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-05` — `vid-consequence-05.mp4` — THE COMPETITOR THREAT

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE COMPETITOR THREAT.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a dealership showroom floor. Two machines stand side by side — one in JCB yellow, one in a neutral competitor colour. A customer walks slowly between them, pausing to compare. Camera: a slow, steady dolly move following the customer from behind, keeping both machines in frame. Pacing: measured, evaluative. Lighting: bright, even showroom lighting with soft reflections on the machine paintwork. Colour grade: clean and neutral, with the JCB yellow reading as the warmest element in frame. Accompanying audio: quiet showroom ambience and a low, tense synth pulse. No dialogue, no voiceover.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-06` — `vid-consequence-06.mp4` — THE TALENT EXODUS

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE TALENT EXODUS.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: an open-plan office at the end of the day. A single desk is being cleared — a cardboard box, a framed photo, a laptop being closed. Colleagues in the background look on quietly but do not intervene. Camera: a slow push-in from a wide office shot to a close-up of the box on the desk. Pacing: sombre and unhurried. Lighting: warm low-angle evening light through large windows, casting long shadows. Colour grade: muted with a warm amber cast, evoking the end of something. Accompanying audio: faint office ambience and a soft, low piano note. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-07` — `vid-consequence-07.mp4` — THE DIFFICULT CONVERSATION

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE DIFFICULT CONVERSATION.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a small, private meeting room with the door closed. Two people sit across a table from one another. One is speaking calmly; the other looks down at their hands. A glass of water sits untouched between them. Camera: a static, respectful medium two-shot, with no movement at all, letting the stillness carry the weight. Pacing: held and uncomfortable. Lighting: soft overhead light with a slight shadow across the table. Colour grade: neutral and muted, with no warm accents. Accompanying audio: near-silence with a very faint room tone. No dialogue, no music.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-08` — `vid-consequence-08.mp4` — THE INNOVATION GAMBLE

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE INNOVATION GAMBLE.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: an R&D test facility. A hybrid-electric Loadall prototype sits under bright inspection lights, its panels partially open, cables running to diagnostic equipment. An engineer in the background studies a tablet. Camera: a slow, low tracking shot moving along the length of the machine from front to rear. Pacing: expectant and forward-looking. Lighting: cool, clinical inspection lighting with bright specular highlights on the machine bodywork. Colour grade: clean and technical, with a subtle JCB yellow accent on the machine. Accompanying audio: faint electrical hum and a rising synth tone. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-09` — `vid-consequence-09.mp4` — THE YEAR-END RECKONING

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE YEAR-END RECKONING.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a boardroom at night, seen from outside through a glass wall. A single figure stands at the head of a long table, looking out at the city lights. The room is otherwise empty. Camera: a slow, static wide shot from the corridor, with the glass wall framing the figure. Pacing: reflective and still. Lighting: cool blue city light from the windows, with a single warm lamp on the table. Colour grade: deep blues and blacks with a warm highlight on the figure. Accompanying audio: near-silence with a low, sustained synth pad. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-10` — `vid-consequence-10.mp4` — THE MERGER

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE MERGER.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a factory floor where two different machine liveries are visible on the same production line — one in JCB yellow, one in the acquired company colours. Workers from both teams stand together, some in different uniforms, looking at the line. Camera: a slow, wide crane-down from a high angle to eye level, revealing the two liveries side by side. Pacing: deliberate and hopeful. Lighting: bright industrial lighting with warm highlights on the machinery. Colour grade: neutral with both liveries reading clearly. Accompanying audio: factory ambience and a warm, resolving synth chord. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-11` — `vid-consequence-11.mp4` — THE ETHICAL LINE

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE ETHICAL LINE.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a hotel lobby or neutral meeting space in an overseas market. A briefcase sits closed on a low table. A hand reaches towards it, then stops and withdraws. The moment is held, unresolved. Camera: a tight, static close-up on the briefcase and the withdrawing hand, with no camera movement. Pacing: tense and still. Lighting: warm, slightly dim ambient lighting with a single overhead spot on the table. Colour grade: warm amber tones with deep shadows. Accompanying audio: near-silence with a single low, tense tone. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-12` — `vid-consequence-12.mp4` — THE REMOTE WORK REVOLT

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE REMOTE WORK REVOLT.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a half-empty open-plan office. Rows of desks are visible, but only a few are occupied. A single engineer works alone at one desk, headphones on, focused. The emptiness of the room is the subject. Camera: a slow, wide lateral track across the empty desks, ending on the lone engineer. Pacing: quiet and slightly melancholy. Lighting: flat overhead office lighting, slightly cool. Colour grade: desaturated and cool, emphasising the emptiness. Accompanying audio: faint keyboard tapping and a low, unresolved synth pad. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-13` — `vid-consequence-13.mp4` — THE SUCCESSION CRISIS

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE SUCCESSION CRISIS.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: an empty executive office. A desk is tidy, a chair is pushed back, and a nameplate on the desk is turned slightly away from the camera so it cannot be read. The room feels recently vacated. Camera: a slow push-in from the doorway towards the empty chair. Pacing: solemn and contemplative. Lighting: soft daylight through blinds, casting striped shadows across the desk. Colour grade: muted greys and browns with a cool cast. Accompanying audio: near-silence with a low, sustained tone. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-14` — `vid-consequence-14.mp4` — THE MARKET DISRUPTION

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE MARKET DISRUPTION.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a modern trade show or technology expo stand. A sleek, unfamiliar electric compact loader is displayed under dramatic lighting, surrounded by a small crowd of onlookers. The machine is clearly not a JCB product. Camera: a slow, low-angle push-in on the unfamiliar machine, with the crowd blurred in the foreground. Pacing: urgent and unsettling. Lighting: dramatic, high-contrast exhibition lighting with cool blue and white tones. Colour grade: cool and high-contrast, with no JCB yellow anywhere in frame. Accompanying audio: crowd murmur and a tense, rising synth tone. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

#### `vid-consequence-15` — `vid-consequence-15.mp4` — THE SECOND RECKONING

- **Duration:** 5.0 seconds
- **Format:** MP4, H.264, 1920×1080, 16:9, 25 fps, muted
- **Where it plays:** `showConsequence()` for the scenario titled THE SECOND RECKONING.

**Prompt:**

> A five-second cinematic clip for a corporate leadership simulation. Scene: a boardroom in daylight, seen from behind a seated figure who faces a wall of windows. On the table in front of them lies a single printed document. The figure is still, considering. Camera: a slow, static over-the-shoulder shot, holding steady for the full five seconds. Pacing: reflective and weighty. Lighting: bright, clean daylight from the windows, with the figure silhouetted against it. Colour grade: neutral and airy, with a warm highlight on the document. Accompanying audio: near-silence with a warm, resolving synth chord fading in over the final two seconds. No dialogue.

**Technical notes:**

- Must fit the 5-second consequence modal auto-advance. Do not exceed 5.0 seconds.
- Plays muted by default.
- Must not autoplay with sound. If absent, the CSS-only impact card renders as today.
- Keep the file under 5 MB.

---

### 3.5 Results and outcome audio

These four cues are mutually exclusive: exactly one plays on the results screen, chosen by the placement band returned by the scoring logic. All four share the same tonal world as `sfx-results-reveal` so the results screen feels coherent whichever band is reached.

---

#### `sfx-outcome-exceptional` — `sfx-outcome-exceptional.mp3`

- **Duration:** 3.0 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** `displayResults()` when the placement is the top band.

**Prompt:**

> A three-second outcome cue for the highest placement band of an executive leadership simulation. Begin with a warm F major synth pad fading in over 400 ms. At 0.5 seconds, play a rising four-note marimba figure — F4, A4, C5, F5 — each note 200 ms apart, clean and bright. At 1.4 seconds, add a soft, sustained string-like pad that swells gently. At 2.0 seconds, place a single soft cymbal swell that peaks at 2.4 seconds and decays naturally. Resolve on a sustained F major chord, fading out over the final 600 ms. No drums, no fanfare, no applause. Emotional register: earned excellence, quiet pride, the satisfaction of a year led well.

**Technical notes:**

- Peak loudness target −15 LUFS integrated, true peak no higher than −1 dBTP.
- Plays once, immediately after `sfx-results-reveal` or instead of it, depending on the final wiring decision.
- Fade out over the final 600 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-outcome-strong` — `sfx-outcome-strong.mp3`

- **Duration:** 2.5 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** `displayResults()` when the placement is the second band.

**Prompt:**

> A two-and-a-half-second outcome cue for a strong placement band of an executive leadership simulation. Begin with a warm C major synth pad fading in over 400 ms. At 0.4 seconds, play a rising three-note marimba figure — C4, E4, G4 — each note 220 ms apart, clean and rounded. At 1.2 seconds, add a soft sustained pad that swells gently to 2.0 seconds. Resolve on a sustained C major chord, fading out over the final 500 ms. No drums, no cymbal, no fanfare. Emotional register: solid achievement, quiet confidence, a year of good decisions.

**Technical notes:**

- Peak loudness target −16 LUFS integrated, true peak no higher than −1 dBTP.
- Plays once on the results screen.
- Fade out over the final 500 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-outcome-developing` — `sfx-outcome-developing.mp3`

- **Duration:** 2.5 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** `displayResults()` when the placement is the third band.

**Prompt:**

> A two-and-a-half-second outcome cue for a developing placement band of an executive leadership simulation. Begin with a soft A minor synth pad fading in over 400 ms. At 0.4 seconds, play a two-note marimba figure — A3 then C4 — 300 ms apart, with a slightly dampened mallet. At 1.3 seconds, add a low sustained pad that holds to 2.0 seconds. Resolve on a sustained A minor chord, fading out over the final 500 ms. No drums, no cymbal. Emotional register: honest reflection, room to grow, encouragement without celebration.

**Technical notes:**

- Peak loudness target −17 LUFS integrated, true peak no higher than −1 dBTP.
- Plays once on the results screen.
- Fade out over the final 500 ms.
- Must degrade silently if the file is missing.

---

#### `sfx-outcome-foundation` — `sfx-outcome-foundation.mp3`

- **Duration:** 2.5 seconds
- **Format:** MP3, 44.1 kHz, 192 kbps, stereo
- **Where it plays:** `displayResults()` when the placement is the lowest band.

**Prompt:**

> A two-and-a-half-second outcome cue for the lowest placement band of an executive leadership simulation. Begin with a soft D minor synth pad fading in over 500 ms. At 0.5 seconds, play a single low marimba note (D3) with a dampened mallet and a slow decay. At 1.2 seconds, add a low sustained pad at 90 Hz that holds to 2.0 seconds. Resolve on a sustained D minor chord, fading out over the final 600 ms. No drums, no cymbal, no dissonance. Emotional register: sober reflection, a foundation to build on, respectful rather than discouraging. The player should feel that the experience was worthwhile, not that they failed.

**Technical notes:**

- Peak loudness target −17 LUFS integrated, true peak no higher than −1 dBTP.
- Plays once on the results screen.
- Fade out over the final 600 ms.
- Must degrade silently if the file is missing.

---

## 4. Naming and folder convention

### 4.1 Recommended folder structure

Create a single `assets` folder alongside the game files, matching the structure already proposed in [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md:12):

```
v2/
├── index.html
├── game-engine.js
├── styles.css
├── scenarios.js
├── ...
└── assets/
    ├── audio/
    │   ├── sfx-intro.mp3
    │   ├── sfx-decision-positive.mp3
    │   ├── sfx-decision-negative.mp3
    │   ├── sfx-decision-neutral.mp3
    │   ├── sfx-consequence-sting.mp3
    │   ├── sfx-results-reveal.mp3
    │   ├── sfx-timer-warning.mp3
    │   ├── sfx-timer-critical.mp3
    │   ├── sfx-briefing-tick.mp3
    │   ├── sfx-outcome-exceptional.mp3
    │   ├── sfx-outcome-strong.mp3
    │   ├── sfx-outcome-developing.mp3
    │   ├── sfx-outcome-foundation.mp3
    │   ├── nar-briefing-r1.mp3
    │   ├── nar-briefing-r2.mp3
    │   ├── mus-briefing-bed.mp3
    │   ├── mus-gameplay-bed.mp3
    │   └── mus-results-bed.mp3
    └── video/
        ├── vid-consequence-01.mp4
        ├── vid-consequence-02.mp4
        ├── vid-consequence-03.mp4
        ├── vid-consequence-04.mp4
        ├── vid-consequence-05.mp4
        ├── vid-consequence-06.mp4
        ├── vid-consequence-07.mp4
        ├── vid-consequence-08.mp4
        ├── vid-consequence-09.mp4
        ├── vid-consequence-10.mp4
        ├── vid-consequence-11.mp4
        ├── vid-consequence-12.mp4
        ├── vid-consequence-13.mp4
        ├── vid-consequence-14.mp4
        └── vid-consequence-15.mp4
```

### 4.2 Filename convention

- **Prefix by asset class:** `sfx-` for sound effects, `nar-` for narration, `mus-` for music beds, `vid-` for video.
- **Lowercase, hyphenated, no spaces.** This matches the rule already stated in [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md:38).
- **The filename stem must equal the Asset ID.** For example, Asset ID `sfx-decision-positive` maps to `assets/audio/sfx-decision-positive.mp3`. This means a future wiring pass can derive the path directly from the Asset ID with no lookup table.
- **Video clips are numbered by scenario order**, `vid-consequence-01` through `vid-consequence-15`, in the same order the scenarios appear in [`scenarios.js`](scenarios.js:3) (Round 1 scenarios 1–9, then Round 2 scenarios 10–15). The mapping is listed in the inventory table in section 2.4.
- **Do not include version numbers in filenames.** If an asset is revised, overwrite it in place so the Asset ID remains stable.

### 4.3 Format and size rules

- Audio: `.mp3`, 44.1 kHz, 192 kbps. Keep SFX under 200 KB each.
- Video: `.mp4` (H.264/AAC), 1920×1080, 16:9, 25 fps. Keep each clip under 5 MB to avoid kiosk load stalls, per [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md:36).
- Music beds are the exception to the short-clip rule: they are longer loops, so allow up to roughly 2 MB each at 192 kbps.

---

## 5. Wiring notes for the developer

This section describes **where** each asset would be triggered in the game flow. It is prose only — no code. It is intended to make the prompts above directly actionable for a future wiring pass, and it is compatible with the approach sketched in [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md:66).

### 5.1 Briefing screen

- **`startBriefing()`** opens the briefing screen and starts the 90-second countdown. This is the correct trigger point for `sfx-intro`, `mus-briefing-bed`, and the round-appropriate narration (`nar-briefing-r1` or `nar-briefing-r2`).
- The intro sting should fire once, immediately on screen entry. The music bed should begin at the same moment and loop until the player leaves the briefing screen.
- Narration should begin after the intro sting has finished, not simultaneously with it, so the two do not compete.
- During the final 10 seconds of the 90-second countdown, `sfx-briefing-tick` should fire once per second. This is the only asset in the pack that repeats on a timer, so it must be guarded against double-firing.
- When the player leaves the briefing screen to begin gameplay, the music bed and any narration still playing should fade out.

### 5.2 Gameplay and scenario screen

- **`startTimer()`** begins the 15-minute gameplay countdown. This is the correct trigger point for `mus-gameplay-bed`, which should loop for the duration of gameplay.
- Inside the `startTimer()` interval, two one-shot cues are needed: `sfx-timer-warning` the first time the remaining time crosses 2 minutes, and `sfx-timer-critical` the first time it crosses 30 seconds. Both must fire once only, guarded by a flag, because the interval ticks every second.
- **`renderScenario(scenario)`** renders each scenario. No audio is required here, but if a per-scenario ambience is ever added, this is the natural hook.

### 5.3 Decision submission

- **`submitDecision()`** evaluates the player choices and computes the growth delta. This is the correct trigger point for the decision feedback cues.
- When the growth delta is positive, play `sfx-decision-positive`.
- When the growth delta is negative, play `sfx-decision-negative`.
- When the growth delta is zero, play `sfx-decision-neutral`.
- These three cues are mutually exclusive; exactly one should play per submission.

### 5.4 Consequence modal

- **`showConsequence(scenario, decision, deltas)`** opens the consequence modal. This is the correct trigger point for `sfx-consequence-sting` and, optionally, the scenario-specific video clip.
- The modal auto-advances after 5 seconds (see [`game-engine.js`](game-engine.js:2826)). Every video clip is therefore authored to exactly 5.0 seconds, and the sting is authored to 2.0 seconds so it completes well within the window.
- The video should be selected by matching the scenario to its numbered clip using the mapping in section 2.4. If no clip exists for a scenario, the modal must fall back to the existing CSS-only impact card with no empty video frame.
- Videos play muted. They must never autoplay with sound, and they must not block the auto-advance if they fail to load.

### 5.5 Results screen

- **`showResults()`** switches to the results screen. This is the correct trigger point for `mus-results-bed`, which should loop while the player reviews their outcome.
- **`displayResults(results)`** populates the results content. This is the correct trigger point for `sfx-results-reveal` and for the band-specific outcome cue.
- Exactly one outcome cue should play, selected by the placement band: `sfx-outcome-exceptional`, `sfx-outcome-strong`, `sfx-outcome-developing` or `sfx-outcome-foundation`. If `sfx-results-reveal` is also used, sequence the outcome cue after it rather than layering them.
- **`showFeedback(results)`** renders the written feedback. No additional audio is required here.
- When the player leaves the results screen, the music bed should fade out.

### 5.6 End of game and fallback behaviour

- **`endGame()`** is reached both when the timer expires and when the player completes the final scenario. Any looping gameplay bed should fade out here before the results screen takes over.
- **Silent graceful fallback is mandatory.** If any file is missing, the game must continue with no error, no empty player, and no broken layout. This mirrors the fallback rules in [`MEDIA_WIRING_GUIDE.md`](MEDIA_WIRING_GUIDE.md:175).
- **No autoplay on load.** All audio must be triggered from a user gesture. Because the player clicks START during registration, every later cue is permitted to play, but the intro sting must be triggered from the briefing button click rather than on page load.
- **A mute toggle is recommended.** The guide already proposes a `soundEnabled` flag and a `toggleMute()` control; if implemented, every cue in this pack should respect it, including the music beds.
