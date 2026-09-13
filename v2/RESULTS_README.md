# Results & Leaderboard — Facilitator Guide

This guide is for the person running the JCB Leadership in Action session. It
explains how to keep **one consistent leaderboard** across several computers and
how to **combine everyone's results** into a single report.

You do **not** need to be technical. There are three ways results are saved, and
the game picks the best one automatically. You only need to do one of the
"Collecting results" options below.

---

## 1. What happens when a player finishes

Every completed run is saved in **two** places:

1. **In the browser** (a local cache) — this is what the on-screen leaderboard
   shows on that computer.
2. **In the `results/raw/` folder** — one small JSON file per run, named after
   the run. This is the durable, portable copy.

The game chooses how to write the file automatically, in this order:

| Order | Method                  | When it is used                                                                                                                     |
| ----- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Helper server**       | You started the server (recommended). Every player on the same server shares one leaderboard.                                       |
| 2     | **Direct folder write** | Chrome/Edge, game opened from `http://localhost` or `https://`, no server. The game asks you to pick the `results/raw` folder once. |
| 3     | **Download**            | Any other case, including opening the file directly (`file://`). The run file lands in your **Downloads** folder.                   |

You never have to configure this — it is detected at runtime.

---

## 2. Recommended: run the helper server

This gives the most consistent experience: everyone who opens the game from the
same address sees the same leaderboard.

1. Install [Node.js](https://nodejs.org) if it is not already installed.
2. Open a terminal in the `v2` folder.
3. Run:

   ```
   node tools/serve.js
   ```

4. The terminal prints the address to open, for example:

   ```
   Open the game at:  http://127.0.0.1:8080/
   ```

5. Open that address in the browser. Players' results are written straight into
   `results/raw/` on this computer.

To use a different port: `node tools/serve.js --port 3000`.

Press `Ctrl+C` in the terminal to stop the server.

---

## 3. Collecting results from several computers

Each computer keeps its own `results/raw/` folder. To combine them:

1. On each computer, copy its **`results/raw`** folder.
2. Bring them together on one computer, for example:

   ```
   incoming/PC2/results/raw
   incoming/PC3/results/raw
   ```

   (Any folder names work — the merge tool reads every `.json` file inside.)

3. Run the merge command (see below).

If a computer could not use the server or direct folder write, its runs were
**downloaded** instead. Collect those `.json` files from the Downloads folder
and put them in a folder such as `incoming/PC2/results/raw` before merging.

---

## 4. Merging into one leaderboard and one report

From the `v2` folder run:

```
node tools/merge-results.js --in results/raw --in incoming/PC2/results/raw --in incoming/PC3/results/raw --out results/merged --top 10
```

- `--in` can be repeated for as many computers as you like.
- `--out` is where the combined files are written (default `results/merged`).
- `--top` sets how many rows appear in the combined leaderboard (default 10).

The command prints a summary and writes three files into `results/merged/`:

| File                  | What it is                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `leaderboard.json`    | The combined, ranked top-N leaderboard.                                                            |
| `cohort.json`         | **Every** de-duplicated run — feed this to the culture analysis and executive summary.             |
| `merge-manifest.json` | An audit trail: which folders were read, how many files, duplicates removed, and anything skipped. |

The merge is **safe to run again**: the same input always produces exactly the
same output, and runs are never counted twice (each run has a unique ID).

---

## 5. Producing the combined executive summary

The combined `results/merged/cohort.json` is the single source of truth for the
whole group. Point the culture analysis / executive summary at that file (or use
the in-game **Company Culture Analysis** screen after importing the cohort) to
produce **one** combined report for everyone.

---

## 6. Moving old results (migration)

If you have results from before this update, they live only in the browser.

- **Export:** on the welcome screen click **⬇️ EXPORT RESULTS**. This downloads
  a `jcb_cohort_export_<date>.json` file containing the whole local cohort.
- **Import:** click **⬆️ IMPORT RESULTS** and choose a results file. Its runs are
  merged into the local cohort (duplicates are ignored).

You can also pass an exported file straight to the merge tool — it accepts the
exported format, a single run file, or a folder of run files.

---

## 7. Folder layout

```
v2/
├── results/
│   ├── raw/        one JSON file per run (the durable store)
│   ├── merged/     leaderboard.json, cohort.json, merge-manifest.json
│   └── archive/    optional: move processed source folders here
└── tools/
    ├── serve.js          helper server (static + results API)
    └── merge-results.js  combine results folders
```

---

## 8. Troubleshooting

| Symptom                                       | What to do                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Leaderboard differs between computers         | Make sure everyone opens the game from the **same server address** (`node tools/serve.js`).                     |
| No files appear in `results/raw/`             | The game fell back to **download**. Check the Downloads folder and move the `.json` files into `results/raw/`.  |
| "source directory not found" when merging     | Check the `--in` paths exist and are spelled correctly.                                                         |
| A run appears twice                           | It should not — runs are de-duplicated by their unique ID. Check `merge-manifest.json` for the duplicate count. |
| Merge output looks identical after re-running | That is correct: the merge is deterministic and idempotent.                                                     |
