---
session: 2026-08-21T16:40Z
model: Claude Opus 5
also: []
description: >-
  Confetti end to end (ADR-0164), Chat home's rail and sessions column, #28,
  and the push gate cut from ~4m30s to ~2m16s by unpinning three gates that
  each ran one-at-a-time.
commits: 5cfff20..0039fa5
---

# 2026-08-21 — confetti, chrome, and the push gate

**State:** `main` pushed through `724311f`, tree clean, all gates green. Prime
**0.7.4**, daemon running detached. **A push now takes ~2m16s, down from
~4m30s this morning** — measured, see "The gate" below.

### Shipped

- **Chat home is a window you can navigate.** The command rail shows its
  labels (expanded by default, collapse remembered), the sessions column opens
  by default (#27's first half), and both remember the choice per machine.
- **#28 fixed.** "Half the history is Untitled" was never a naming problem: 41
  of 91 session logs held **no message at all**. Rhizome opens a session
  whenever it attaches to a vault, so every unused launch left a five-line
  husk. `list_sessions` drops them.
- **Confetti, end to end** — ADR-0164. A worker-owned canvas, one gate that
  decides (setting, reduced motion, 60s cooldown), two triggers (a goal
  reaching `completed`, and Prime's own `show_confetti` tool with prompt
  guidance in the vault skill), and a toast for the agent's words. Atticus
  confirmed it live.
- **The typecheck gate was a no-op.** `npx tsc --noEmit` typechecks **zero
  files** here — proven by appending a type error and watching it exit 0.
  `pnpm typecheck` (`tsc -b`) is now what AGENTS.md, CONTRIBUTING.md and
  CROSS-MODEL-HANDOFF.md all say to run. C35.
- The last two visual-audit items: Goal has one home, and nothing sits level
  with the traffic lights.

### The gate: three findings with one shape

A push took ~4m30s. Every fix was the same discovery, and none of them was
"this gate is too big":

| Where | Was | Now |
|---|---|---|
| Pre-push fallback | six gates one after another | three lanes at once |
| `playwright.smoke.config.ts` | `workers: 1` | `workers: 4` — 26 tests, 110s → 34s |
| Frontend coverage | hook pinned `CONCURRENCY=1` | unpinned — 124s → 85s |

Measured with all three lanes running together: **frontend 168s → ~120s**,
Rust 70s, Playwright 34s. The frontend lane is the critical path and coverage
is most of it. **Nothing was removed, so nothing stopped being protected.**

The instinct each time was to cut a test or drop a gate. Each time the
measurement said the work was fine and the parallelism was off. Measure the
lane before trimming its contents.

**Next cut is not a knob.** 85s of coverage is 5482 tests plus a fixed startup
cost; going below it means not running them all on every push (vitest
`--changed`, or full coverage in CI only). That is a tradeoff, not a free win.

### Two bugs the browser caught that jsdom could not

Both in the confetti work, both invisible to a green test suite:

1. **StrictMode blanked the app.** Handing a canvas to a worker is one-way and
   permanent for that element; React's development double-mount re-entered
   `createHost`, could not re-transfer, fell through to `getContext` — which
   *throws* on a transferred canvas — and the error took the window down.
2. **The goal watcher was in the wrong component.** Wired into
   `AgentActivityBand`, which `ChatHome` renders, so it only existed while the
   Chat destination was on screen. A goal completing while the user read notes
   was never noticed. The poll is now `usePrimeAgentActivity`, mounted once at
   app level — which is also candidate 4's "one producer".

**`pnpm dev` serves the whole app against `mock-tauri`**, so UI work can be
driven and screenshotted in a browser without the native window. That is the
cheap loop; no repo doc mentioned it before today.

### Open

- **C37** — the sidecar path itself. The `chunk` CLI is not installed, and
  `.chunk/config.json` still points at `refactoringhq/tolaria` from before this
  repo existed. Needs a CircleCI account decision from Atticus.
- **C33** — test files are excluded from the typecheck. Real, and now visible
  since the typecheck actually runs.
- **C34 / C18** — `pnpm l10n:translate` cannot run here (no `LARA_ACCESS_KEY_ID`
  / `SECRET`), so 19 locales are missing recent keys. The companion window also
  hardcodes `DEFAULT_APP_LOCALE`.
- **#28's root cause** — Rhizome still creates a session on every vault attach
  that it may never use. Filtering the display was the safe half; creating it
  lazily is the half that stops the litter.
- Architecture candidates 2 and 5; #26 (no in-app `prime-agent update`).

---
