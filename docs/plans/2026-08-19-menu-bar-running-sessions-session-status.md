# Session status — 2026-08-19 (#13 menu bar shows what is running)

Claude Opus 5. Picked up after closing out C29 and issues #19/#20.

## Shipped

**#13 — the menu-bar dropdown now lists running Prime sessions beneath quick
capture.** Quick capture is untouched and still first; the roster renders only
when something is running, and disappears entirely when nothing is.

- `list_prime_running_sessions` (Rust) — one-shot daemon `list` query
- `src/lib/primeRunningSessions.ts` — all the shaping, pure and testable
- `useMenuBarRunningSessions` — mount fetch + poll-while-visible
- `useMenuBarSessionOpen` — main window lands on the clicked session
- `trackMenuBarSessionOpened` — PostHog

## The probe caught two things the types would have got wrong

Per `CROSS-MODEL-HANDOFF.md` §16, probed the live daemon (0.7.2, protocol 7)
before writing anything. Two divergences from `daemon-session-list.d.ts`:

1. **`sessionName` is declared but never sent.** No live session carries it;
   `prime-agent list` prints an empty `name` column too. A row title built on
   `sessionName` would have rendered blank for every real session. Titles fall
   back to `firstMessage`, then the cwd folder, then the short id.
2. `summary` **is** present and is exactly the "what is it doing" line the
   issue asks for — the flag-derived labels (`Compacting`, `Running a command`,
   `Running tools`, `Replying`) are only the fallback before one exists.

What "running" means mirrors Prime's own `classifySessionRosterStatus` rather
than a second definition invented here: `activeSessionId` present, and any of
`hasActiveHeartbeat` / `activity === "working"` / `isSessionActive` /
`hasRunningRlmChildren`.

**Not confirmed live: subagent parentage.** No subagents were running at any
point, so the `parentActiveSessionId` → `activeSessionId` link follows the
daemon's own source (`buildRlmChildSnapshots`, which walks that field and says
it includes grandchildren) rather than observation. Counts are of *all*
descendants, not direct children. If subagent counts ever read wrong, that is
the first place to look — it is the one part of this feature standing on read
source instead of a probe.

## Verification

- `pnpm test` — 5433 tests / 518 files
- `cargo test` — 1499 (baseline 1491; +8 roster tests, +2 socket-absent)
- `pnpm test:mcp` — 13
- `pnpm playwright:smoke` — 26 passed, 1.8m
- Frontend coverage 88.06% lines (gate 70)
- Rust coverage **85.03%** lines (gate 85) — see the warning below
- **Live end-to-end:** `roster_against_the_live_daemon`, an `#[ignore]` test
  run by hand against the real daemon, reported 2 top-level working sessions
  with the expected fields. Every other roster test speaks to a fake daemon of
  our own making; this is the only one that proves the real daemon answers
  `list` the way this client reads it.

## ⚠️ Rust coverage headroom is nearly gone

**85.03% against an 85% gate.** It was 85.26% at the start of this session; the
new `#[cfg(desktop)]` command wrappers are not unit-testable and ate most of the
margin. That is roughly **5 lines**. Adding untested Rust will break the push
gate for everyone — see C27, which blocked every push for weeks over the same
thing. Budget tests with any new Rust, or claw coverage back first.

## Open, tracked as C-numbers

- **C31** — `pnpm test` produced one unreproducible unhandled error (1 run in 4)
- **C32** — `ARCHITECTURE.md` / `ABSTRACTIONS.md` say nothing about Prime

## Not done

- **Native QA with the main window closed** — the issue's last acceptance
  criterion. Not demonstrated; see HANDOFF for what remains.
- C12 (needs a human), #14, #21.
