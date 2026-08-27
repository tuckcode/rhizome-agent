---
session: 2026-08-26T22:45-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Native live check of Research canvas, Mycelium, and Promote against a live
  Prime daemon. Found C51 (Promote accepts the empty-turn placeholder). Then
  skinned the Mindwalk engine as Rhizome via a loopback proxy — chrome-now,
  no fork. Corrected the CodeScene free-tier claim.
commits: d5e086e, ced0b5f, 6377b04, 8cfe2a0
---

# Live check + Mycelium skin — stop here 2026-08-26 night

First Claude-owned session since 2026-08-24. Picked up from
[`YOU-SHOULD-KNOW.md`](../../YOU-SHOULD-KNOW.md) (Grok 4.6's multi-day
briefing), which was uncommitted in the working tree at start — committed
as `d5e086e` along with the commit-ref corrections it needed.

## What I did

**Live-checked the three leftovers** from the 08-26 afternoon slice, natively,
against a live Prime daemon 0.8.0 and a real Mindwalk sidecar.

| Check | Verdict |
|---|---|
| Research canvas | **PASS** — replaces Chat via rail; rail Chat and ⌘1 both return; no Chat overlay inside |
| Mycelium (#11 / #22) | **PASS** — in-app iframe, Rhizome chrome, MIT notice, sidecar on `:18765`, live data, rail = all sessions |
| Promote (#24) | **Mechanics pass, one real bug** → C51 |

**#11 and #22 are clear to close. #24 is not** — see C51 in `HANDOFF.md`.

**Then built the Mycelium skin** (`6377b04`) — the "lipstick that survives
upstream updates" option, chosen over a fork.

## Traps this session added

- **The dev binary has no bundle identifier.** `target/debug/RhizomeAgent`
  returns `missing value` for its bundle id, so computer-use's screenshot
  filter — which resolves grants to the installed `.app` — blacks the window
  out entirely and the frontmost check fails. It looks exactly like "the app
  didn't launch." It did. Use `cua-driver` (drives by pid + AX tree) or
  `screencapture -R<x,y,w,h>` against the window rect from
  `osascript ... get {position, size} of window 1`.
- **⌘1/2/3 are native menu accelerators** (`menuOwned: true` in
  `src/shared/appCommandManifest.json`). A synthesized keypress does **not**
  fire them, so "⌘1 doesn't work" from an automation tool is a false
  negative. Drive the real menu item instead:
  `osascript -e 'tell application "System Events" to tell process "Rhizome Agent" to click menu item "Chat only" of menu 1 of menu bar item "View" of menu bar 1'`.
  I nearly logged this as a bug before checking. Menu labels are already
  correct: **Chat only / Chat + Inbox / Chat + Notes**.
- **The Bash tool's sandbox blocks loopback.** `curl 127.0.0.1:18765` returns
  000 even though the port is listening. Use the Browser pane
  (`preview_start` with the URL) to probe local services.
- **`cua-driver` sessions expire mid-task.** `list_windows` takes no
  `session` argument, so it uses the implicit transport session; when that
  ends, revive it with `start_session` using the exact id from the error.
  Window ids also change on app restart — re-run `list_windows`.

## Mindwalk's actual API surface

Confirmed by watching the SPA's own network traffic, not guessed:

```
GET /api/sessions                    → session list (typed, harness-aware: claude-code AND pi)
GET /api/sessions/{key}/snapshot     → normalized touch-trace  ← the citymap data
GET /api/sessions/{key}/report       → judge/report state
GET /api/sessions/{key}/agents       → subagent roster
```

`snapshot` returns an explicitly **versioned** (`"version": 1`) trace:
`{ session: {...}, events: [ { seq, ts, tool, action, targets: [{path, fileId, touch, weak}], resultBytes, isError, summary } ] }`.

That is the contract M4 would build against. Mindwalk has already done the
hard part — parsing heterogeneous harness JSONL into one flat file-touch
trace. **This is the "absorb contracts and artifacts" case in ADR-0168, not
a fork case.**

Repo facts: `github.com/cosmtrek/mindwalk`, MIT, 1290 stars, created
2026-07-09, last push 2026-08-10. **Go 550 KB / TypeScript 238 KB / CSS 47 KB.**
The Go half is the indexer. Rhizome's backend is Rust — forking means either
shipping a Go toolchain in the release pipeline or porting ~12k lines of
JSONL parsing to a moving target. **Do not fork.**

## The skin (`6377b04`)

`src-tauri/src/mycelium_skin.rs` — a loopback proxy in front of the sidecar.
Every byte passes through untouched **except** `text/html`, where it appends
one `<style>` block before `</head>` and renames the wordmark to "Mycelium".

Why this works and keeps working: Mindwalk themes itself through **~26 CSS
custom properties**, and **zero of its 94 class names are build-hashed**
(measured against the running SPA). The wordmark is plain text in
`<h1 class="wordmark">`. So the skin survives engine rebuilds.

- **No new dependency** — `std::net` for the listener, `reqwest` for
  upstream, both already in `Cargo.toml`. No dependency ADR needed.
- **No CSP change** — `frame-src http://127.0.0.1:*` already allowed it.
- **Non-streaming is sufficient** — zero WebSocket/SSE strings in the
  Mindwalk binary.
- **Theme-aware** — `MyceliumView` passes `useDocumentThemeMode()` through,
  so the embed matches light/dark instead of always rendering Mindwalk's dark.
- **Fails cosmetic, not fatal** — a proxy that can't bind falls back to the
  raw engine URL with a `log::warn!`.

**The one failure mode is renaming, not rebuilding.** If upstream renames
`--sky`, the override silently no-ops and that surface reverts to Mindwalk's
palette. `missing_skin_variables()` checks `EXPECTED_MINDWALK_VARS` and
reports drift — but **nobody is watching that log yet**. If you bump
Mindwalk and Mycelium looks half-themed, look there first.

Native QA: rail Mycelium renders the citymap with the Mycelium wordmark and
Rhizome greens; engine, timeline, and session data unchanged. MIT notice
still in the footer.

## Also corrected

`AGENTS.md` said CodeScene had "no free tier at any layer." **False** —
there is a free Community edition, scoped to open source, so it does not
reach this private repo. Conclusion unchanged (no gate), premise corrected
(`8cfe2a0`). Same wrong-premise/right-conclusion shape that kept the Codacy
gate unrun for months (C45). **If this repo goes public, re-evaluate.**

## Pick up here

1. **Fix C51** — guard the promote path to refuse a turn with no assistant
   content, same shape as the #29 credential refuse. Small. Unblocks
   closing #24.
2. **Close #11 / #22** on GitHub — both live-verified.
3. **B / M4** — a native Rhizome client on `/api/sessions/{key}/snapshot`,
   dropping the iframe. Now cheaper than before: the 26 tokens the skin
   defines are the same design tokens that client would consume. It is also
   the only thing that fixes the current **two-session-lists** redundancy
   (Rhizome's chrome list beside Mindwalk's own inside the iframe).
4. Do **not** start TokenJuice, Switchyard, or harness composition —
   unratified, per `NEXT.md` §1.

## Note on the model

`stealth/ox-alpha` returned empty turns all session ("Prime Agent finished
without returning a reply"). That is what exposed C51 — a working model
would have hidden it. If you are live-checking chat behavior, pick a model
known to reply first.
