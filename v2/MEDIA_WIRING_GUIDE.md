# Optional Audio / Video Wiring Guide

This document explains **how** to add optional audio and video assets to the
JCB Leadership in Action challenge. Nothing here is implemented yet — the game
currently runs entirely on CSS/JS animation so it works with zero media files.
Follow this guide only if you decide to add media later.

---

## 1. Where to put the files

Create a single `assets` folder next to the game files:

```
v2/
├── index.html
├── game-engine.js
├── styles.css
├── ...
└── assets/
    ├── audio/
    │   ├── intro.mp3
    │   ├── decision-positive.mp3
    │   ├── decision-negative.mp3
    │   ├── consequence-sting.mp3
    │   └── results-reveal.mp3
    └── video/
        ├── intro.mp4
        └── consequence-01.mp4
```

**Rules of thumb**

- Use `.mp3` for audio (universally supported) and `.mp4` (H.264/AAC) for video.
- Keep audio clips short (1–4 seconds) and under ~200 KB each.
- Keep video clips under ~10 seconds and under ~5 MB each, or the kiosk will
  stall on load.
- File names must be lowercase, hyphenated, no spaces.

---

## 2. Audio wiring

### 2.1 Add the audio elements to `index.html`

Place these just before the closing `</body>` tag (after the existing
`<script>` tags so they do not block parsing):

```html
<!-- Optional audio (preloaded, muted until first user gesture) -->
<audio id="sfx-intro" src="assets/audio/intro.mp3" preload="auto"></audio>
<audio id="sfx-positive" src="assets/audio/decision-positive.mp3" preload="auto"></audio>
<audio id="sfx-negative" src="assets/audio/decision-negative.mp3" preload="auto"></audio>
<audio id="sfx-sting" src="assets/audio/consequence-sting.mp3" preload="auto"></audio>
<audio id="sfx-results" src="assets/audio/results-reveal.mp3" preload="auto"></audio>
```

### 2.2 Add a mute toggle

Add a button to the HUD footer in `index.html`:

```html
<button class="btn-info" id="mute-toggle" onclick="game.toggleMute()">🔊 SOUND</button>
```

### 2.3 Add the JS hooks to `game-engine.js`

Add a `soundEnabled` flag to `this.state` and a small helper:

```js
// In the constructor state object:
soundEnabled: true,

// New methods on GameEngine:
toggleMute() {
  this.state.soundEnabled = !this.state.soundEnabled;
  const btn = document.getElementById("mute-toggle");
  if (btn) btn.textContent = this.state.soundEnabled ? "🔊 SOUND" : "🔇 MUTED";
},

playSound(id) {
  if (!this.state.soundEnabled) return;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    el.play().catch(() => {}); // ignore autoplay-block errors
  } catch (e) {
    /* no-op */
  }
},
```

Then call `this.playSound(...)` at the relevant moments:

| Moment | Hook location | Sound id |
|---|---|---|
| Briefing starts | `startBriefing()` | `sfx-intro` |
| Positive decision delta | `submitDecision()` when `deltas.growth > 0` | `sfx-positive` |
| Negative decision delta | `submitDecision()` when `deltas.growth < 0` | `sfx-negative` |
| Consequence card opens | `showConsequence()` | `sfx-sting` |
| Results reveal | `displayResults()` | `sfx-results` |

> **Browser autoplay note:** browsers block audio until the user interacts with
> the page. Because the player clicks "START" during registration, all later
> sounds will play. The intro sound should be triggered from the briefing
> button click, not on page load.

---

## 3. Video wiring

### 3.1 Intro video (optional)

Add a modal to `index.html`:

```html
<div id="intro-modal" class="modal">
  <div class="modal-content large">
    <video id="intro-video" src="assets/video/intro.mp4" controls playsinline></video>
    <div class="consequence-continue">
      <button class="btn-secondary" onclick="game.skipIntroVideo()">SKIP</button>
    </div>
  </div>
</div>
```

JS:

```js
playIntroVideo() {
  const modal = document.getElementById("intro-modal");
  const video = document.getElementById("intro-video");
  if (!modal || !video) return;
  modal.classList.add("active");
  video.play().catch(() => {});
  video.onended = () => this.skipIntroVideo();
},

skipIntroVideo() {
  const modal = document.getElementById("intro-modal");
  const video = document.getElementById("intro-video");
  if (video) video.pause();
  if (modal) modal.classList.remove("active");
},
```

### 3.2 Per-scenario consequence video (optional)

The consequence modal already has a `.video-container` wrapper. To show a
scenario-specific clip, add a `videoFile` property to each scenario in
`scenarios.js`:

```js
{
  id: 1,
  videoFile: "assets/video/consequence-01.mp4",
  // ...existing fields
}
```

Then in `showConsequence()` prepend a `<video>` element to the impact card:

```js
const videoHtml = scenario.videoFile
  ? `<video class="consequence-video" src="${scenario.videoFile}" autoplay muted playsinline></video>`
  : "";
```

If `videoFile` is absent, the CSS-only impact card renders exactly as it does
today — so this is fully backwards compatible.

---

## 4. Fallback behaviour (important)

- If an audio file is missing, `playSound()` silently does nothing.
- If a video file is missing, the `<video>` element shows a blank frame; guard
  with `scenario.videoFile` so no empty player appears.
- The game must remain fully playable with **no** `assets` folder at all. All
  current feedback (impact card, HUD deltas, placement reveal) is CSS/JS only.

---

## 5. Recommended minimal set (if you only add a little)

If time is tight, the highest-impact, lowest-effort additions are:

1. `sfx-positive.mp3` / `sfx-negative.mp3` — instant feedback on each decision.
2. `sfx-sting.mp3` — a short whoosh when the consequence card opens.
3. `sfx-results.mp3` — a reveal sound on the results screen.

Three short clips, wired through `playSound()`, transform the feel of the game
without any video production.
