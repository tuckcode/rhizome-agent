---
session: 2026-09-14T16:23-05:00
model: Grok 4.6 (Cursor)
description: >-
  Hide-on-close helpers: code on main, name-list tests exist, native
  process lifecycle live-check NOT RUN. Do not recode.
commits: none
---

# Hide-on-close helpers — findings

**Origin:** Cursor Grok 4.6 · 2026-09-14 16:23 · paper only.  
**Sources:** [`docs/plans/hide-on-close-helpers.md`](../hide-on-close-helpers.md) · `src-tauri/src/lib.rs` · sibling handoffs (1410, 1120, 1463).

Did not edit product code. Did not launch `/Applications/Rhizome Agent.app`. Did not run `ps` against a live hide. Did not commit.

## Status

| Layer | State |
|---|---|
| Product slice | **On main** (`43059e3e`, `release_helpers_for_hidden_window`) |
| Name-list tests | **Exist** (Rust + TS source guards) |
| Native live-check | **NOT RUN** |
| Gray zone (Rhizome-spawned daemon vs user daemon) | **Unpicked** — Atticus call still needed |

Board pile item 6 remainder is verification, not a rewrite.

## What the code does

### `idle_main_window_close_intent`

Returns `SessionCloseIntent::Stop`. Idle red-close is not a background grant (ADR-0167). The window hides (C22); owned work stops.

### `release_helpers_for_hidden_window`

Called on three paths:

1. **Idle hide** — `CloseRequested` on `main` when not streaming: `settle_session(idle_main_window_close_intent())`, then release helpers, then `window.hide()`.
2. **Active hide** — `settle_prime_session` Tauri command (Prime-active-close dialog): settle, then release helpers (hide does not re-fire `CloseRequested`).
3. **Quit** — `RunEvent::Exit`: `settle_session_on_quit()`, then release helpers.

Implementation stops, in order:

- `set_host_suspended(true)`
- `stop_spawned_daemon()` — **unless** Keep-working disposition
- ws-bridge MCP child (`stop_ws_bridge_child`)
- Mindwalk sidecar (`mycelium::stop_mindwalk_sidecar`)

Does **not** send Prime `shutdown` RPC (ADR-0163 — other clients may share the daemon).

### `hidden_window_helper_stops(keep_prime_daemon)`

Diagnostic name list logged at hide:

| `keep_prime_daemon` | Stops |
|---|---|
| `false` (default idle hide) | `spawned_prime_daemon`, `ws_bridge`, `mindwalk` |
| `true` (Keep working) | `ws_bridge`, `mindwalk` only |

## Tests (name-list only)

These assert **names and wiring in source**, not process lifecycle.

| File | What it locks |
|---|---|
| `src-tauri/src/lib.rs` `mod tests` | `idle_window_close_stops_owned_work` · `hide_stops_owned_helpers_except_keep_working_prime` |
| `src/lib/parked-organs.test.ts` | helper string literals + `fn release_helpers_for_hidden_window` |
| `src/lib/leftover-chrome-1616.test.ts` | `fn idle_main_window_close_intent` + `SessionCloseIntent::Stop` |

Related but separate: `PrimeActiveCloseDialog.test.tsx` (Cancel must not Stop/Keep-working) — dialog UX, not `ps` proof.

`prime_session_host.rs` has `stop_spawned_daemon_kills_the_process_group` — unit test on the stop helper itself, still not an end-to-end hide check.

## Native live-check (NOT RUN)

Per [`hide-on-close-helpers.md`](../hide-on-close-helpers.md) and [`morning-native-observer.md`](../morning-native-observer.md):

1. Launch packaged `/Applications/Rhizome Agent.app` (not Vite / `mock-tauri`).
2. Before hide: note Rhizome pid and child processes (`ps` / Activity Monitor).
3. **Red close** (hide): Rhizome stays in Dock; window hidden.
4. After hide: confirm no Rhizome-owned Mindwalk sidecar, ws-bridge child, or spawned Prime daemon remains — **except** when Keep working was explicitly chosen.
5. **Dock click**: Chat restores (`focus_main_window` unhides app then shows main).
6. **Cmd+Q**: full quit; helpers gone.

**Pass criteria:** hide leaves Rhizome in Dock, reopen works, no extra helper Dock story from this pid.

**Do not mass-kill:** leftover `mcp-server/index.js` from Cursor/ChatGPT is not ws-bridge (ADR-0163). Only count children of **this** Rhizome session.

## Tensions (unchanged)

1. **ADR-0163:** Rhizome is a daemon client; a user-started background Prime may outlive the window.
2. **ADR-0167:** hide is not a background grant; default is stop owned work.
3. **Atticus 2026-09-12:** hide must stop Rhizome-started helpers, not only on quit.

Current code treats Rhizome-**spawned** daemon as stoppable on hide (unless Keep working). Whether that spawn is always a "helper" vs "the user's daemon" when another client (TUI) attached mid-session remains the gray zone — record Atticus pick in HANDOFF; do not encode new ADR until then.

## Do not

- Recode the unambiguous slice — it is already in the tree.
- Launch `/Applications` from this agent session (owner rule).
- Treat name-list test green as process-lifecycle proof.

## Next

Native live-check on packaged app when Atticus or morning observer runs W4 pile item 6. Note `ps` before/after hide and any gray-zone daemon behavior. One-line Atticus call on Rhizome-spawned daemon ownership if live-check surfaces ambiguity.
