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
  criterion. **Attempted and blocked by the machine, not by the code.**

  `pnpm tauri dev` built and ran fine; `cua-driver list_windows` found
  `RhizomeAgent` pid 88381 with the main window (`379`, titled "Rhizome
  Agent") and the hidden companion popover (`381`). Both observation routes
  then failed:

  - **Pixel capture:** `px_capture_unavailable` — "ScreenCaptureKit capture
    failed ... Failed to start stream due to audio/video capture failure",
    and the `screencapture` shell fallback failed too ("could not create
    image from window"). A full-desktop grab returned a uniformly black
    image.
  - **Accessibility:** `ax_window_unresolved` — zero `AXWindow` elements
    under that pid report window 379's CGWindowID, so the tree came back
    deliberately empty.

  `check_permissions` reported `accessibility: true` and
  `screen_recording: true`, so this is **not** a TCC grant problem. A black
  full-screen capture while `list_windows` still enumerates everything is
  consistent with the display being locked or asleep — capture is refused at
  the system level while window metadata keeps working.

  **Next session: check the screen is awake and unlocked before spending
  anything on native QA**, and expect the AX side to stay empty regardless —
  the field notes already record that `pnpm tauri dev` produces a bare
  binary rather than a registered `.app`, so a `pnpm tauri build` bundle is
  the route that actually exposes the window. The roster itself is verified
  by the live-daemon test above; what is unverified is only the popover's
  on-screen rendering.
- C12 (needs a human), #14, #21.
