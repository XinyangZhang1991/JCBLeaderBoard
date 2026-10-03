# JCB Leadership in Action — Multiplayer Server

This project turns the single-player **JCB Leadership in Action** game into a
**multiplayer web application**. A Node.js server hosts the game, many people
play on their own devices (phones, tablets, laptops) at the same time, and a
shared **live leaderboard** updates in real time as each player finishes.

There are **no external dependencies** — the server uses only Node's built-in
modules, so there is nothing to `npm install`.

---

## Quick start

1. Make sure you have **Node.js 16 or newer** installed:
   ```
   node --version
   ```

2. From the project root (`e:/JCB leaderboard`), start the server:
   ```
   node server/server.js
   ```

3. The server prints the addresses to use:
   ```
   Local:    http://localhost:3001/
   Network:  http://192.168.0.6:3001/
   Display:  http://localhost:3001/display
   ```

4. **Players** open the **Network** URL on their own devices (they must be on
   the same Wi‑Fi/LAN as the server machine).

5. **Facilitator / projector**: open the **Display** URL
   (`http://<your-ip>:3001/display`) on the big screen to show the live
   leaderboard.

---

## Ports

The default port is **3001**. If that port is busy, choose another:

**Command Prompt (cmd.exe):**
```
set PORT=3005 && node server/server.js
```

**PowerShell:**
```
$env:PORT=3005; node server/server.js
```

If a port is already in use the server prints a clear error and exits.

> Note: ports `3000` and `8080` are often already taken on Windows machines
> (or blocked by policy), which is why `3001` is the default.

---

## What each URL does

| URL | Purpose |
|-----|---------|
| `/` | The game itself. Each player opens this on their own device. |
| `/display` | Host/projector view — the live leaderboard, auto-updating. |
| `/api/health` | Health check. Returns `{ ok: true, count, ... }`. |
| `/api/results` | `POST` a completed run (used automatically by the game). |
| `/api/cohort` | `GET` the full cohort of canonical records. |
| `/api/leaderboard` | `GET` the top-N leaderboard projection. |
| `/ws` | WebSocket endpoint for live updates. |

---

## How it works

```
 Player device 1 ─┐
 Player device 2 ─┤   HTTP (game + API)      ┌─ Static client files
 Player device N ─┼──────────────────────────►│  (main program v3)
                  │                            │
 Host display ────┘   WebSocket (/ws)          ├─ Results store (JSON file)
                      ◄────────────────────────┤  data/results.json
                                               └─ Validation + merge logic
```

- **Static client** — the existing game in `main program v3/` is served
  unchanged. It already probes for `/api/health` and, when found, routes each
  finished run to `POST /api/results` instead of downloading a file.
- **Results store** ([`server/results-store.js`](server/results-store.js)) —
  reuses the client's own [`results-store.js`](main program v3/results-store.js)
  so the canonical schema, consent rules, de-duplication and conflict
  resolution are identical on both sides. Records are persisted to
  `data/results.json` and merged on every write.
- **Validation** ([`server/validate.js`](server/validate.js)) — checks each
  incoming run for structural validity, hash integrity and plausible value
  bounds. It never rejects a legitimate run; it logs warnings and attaches them
  to the stored record.
- **WebSocket** ([`server/websocket.js`](server/websocket.js)) — a minimal,
  dependency-free RFC 6455 implementation. Every new/updated result is
  broadcast to all connected displays and player devices.
- **Live sync** ([`main program v3/live-sync.js`](main program v3/live-sync.js)) —
  a client module that connects to `/ws`, merges incoming records into the
  local stores (so the existing leaderboard and culture dashboard reflect the
  whole cohort), and provides a **🔴 LIVE LEADERBOARD** overlay on player
  devices.

The live-sync module is **inert** when the page is opened from `file://` or
from a host without `/ws`, so the original single-player kiosk behaviour is
completely unchanged.

---

## Privacy & consent

The shared surfaces respect the same consent rules as the rest of the app:

- Only runs with **public display consent** appear on the shared leaderboard
  (enforced by `ResultsStore.isPubliclyDisplayable`).
- The culture dashboard continues to use the existing eligibility and
  anonymisation rules (`isCultureEligible`, `anonymiseForCulture`).

---

## Data & resetting

- Results are stored in **`data/results.json`** (created automatically).
- To **reset** the leaderboard between sessions, stop the server and delete
  `data/results.json`, then start the server again.
- To keep results in a different location, set `DATA_DIR`:
  ```
  set DATA_DIR=D:\jcb-results && node server/server.js
  ```

---

## Configuration summary

| Environment variable | Default | Description |
|----------------------|---------|-------------|
| `PORT` | `3001` | HTTP/WebSocket port. |
| `HOST` | `0.0.0.0` | Bind address (all interfaces by default). |
| `DATA_DIR` | `./data` | Directory for `results.json`. |

---

## Files added for multiplayer

| File | Role |
|------|------|
| [`package.json`](package.json) | Project manifest + `npm start` script. |
| [`server/server.js`](server/server.js) | HTTP server, REST API, static hosting, WebSocket wiring. |
| [`server/results-store.js`](server/results-store.js) | Server-side store reusing the client's canonical logic. |
| [`server/validate.js`](server/validate.js) | Integrity + bounds validation for incoming runs. |
| [`server/websocket.js`](server/websocket.js) | Dependency-free WebSocket server. |
| [`server/public/display.html`](server/public/display.html) | Host/projector live leaderboard page. |
| [`server/public/display.css`](server/public/display.css) | Display styling. |
| [`server/public/display.js`](server/public/display.js) | Display client (WebSocket + rendering). |
| [`main program v3/live-sync.js`](main program v3/live-sync.js) | Player-device live sync + overlay. |

Modified: [`main program v3/index.html`](main program v3/index.html) (added the
live-sync script and a **LIVE LEADERBOARD** button) and
[`main program v3/styles.css`](main program v3/styles.css) (overlay styles).

---

## Troubleshooting

- **Players can't connect** — ensure their device is on the same network and
  that Windows Firewall allows Node.js on the chosen port. The server prints
  all available LAN addresses at startup; use the one that matches your
  network.
- **Port already in use** — pick another port with the `PORT` variable (see
  above).
- **Display shows "Reconnecting…"** — the WebSocket could not connect; confirm
  the server is running and the URL/port are correct.
- **No results appear** — a player must finish a full run; results are sent
  automatically when the game ends.
