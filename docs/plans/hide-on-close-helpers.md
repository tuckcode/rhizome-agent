# Hide-on-close helpers

**Status:** C75 decided the gray zone. Hide stops ws-bridge + Mindwalk.
The spawned Prime daemon stays warm. Native live-check of the Dock story
is still **NOT RUN**. Do not recode.
**Verified 2026-09-19** against `lib.rs` (`hidden_window_helper_stops`
is `["ws_bridge", "mindwalk"]`; `release_helpers_for_hidden_window`
does not call `stop_spawned_daemon`).
**Origin:** C22 + Atticus 2026-09-12, then C75 (`cb74b28`, 2026-09-15).
**Related:** [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md) (transport), [ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md) (lifecycle).

---

## Done / now / next

- **Done:** red button **hides**. **Cmd+Q** quits. Dock click / tray restores (C22). On hide, `release_helpers_for_hidden_window` stops Mindwalk sidecar and the ws-bridge child. The spawned Prime daemon **stays warm** so reopen does not pay a multi-second spawn (C75).
- **Now:** name-list test exists in `lib.rs` (`leftover-hide-close-names.test.ts`). Native live-check still **NOT RUN**. Do not restore `stop_spawned_daemon` on hide.
- **Next:** native glance that hide leaves Rhizome in the Dock, Chat comes back fast, and ws-bridge / Mindwalk are gone. Cmd+Q still full-quits.

**Done when:** hide leaves Rhizome in the Dock, Chat can come back without a cold daemon spawn, and no extra MCP / Mindwalk helper processes stay as a second Dock story. Cmd+Q still full-quits.

---

## Settled UX

| Action | Window | Rhizome process | Prime daemon | Meaning |
|---|---|---|---|---|
| Red close | hide | stays in Dock | stays warm | C22 + C75 |
| Cmd+Q | gone | exits | stop unless Keep working | full quit |
| Dock / tray | show | already there | already listening | restore |

Vite / `mock-tauri` is not this path. Native `/Applications` only.

Keep-working still settles the **session** as `resident`. It does not
change whether the daemon process stays on hide — hide leaves it either
way.

---

## What C75 settled (was the gray zone)

Rhizome-spawned `prime-agent --mode daemon` when the socket was empty at
connect:

- **Leave it on hide** — matches ADR-0163 “never stops the daemon,” and
  is the cold-reopen fix. Encoded in `hidden_window_helper_stops`.
- Stop it only on **quit**, unless Keep working left a resident session.
  Still never send Prime `shutdown`.

Do not reopen the “is a spawn a helper?” argument from source that still
says hide stops the daemon. That text is stale.

---

## Files to read when building

- `src-tauri/src/lib.rs` — close/hide, `hidden_window_helper_stops`, `release_helpers_for_hidden_window`
- `src-tauri/src/prime_session_host.rs` — `warm_daemon_in_background`, `spawn_prime_daemon`, `stop_spawned_daemon`
- `src-tauri/src/mycelium.rs` — sidecar start/stop
- `docs/ARCHITECTURE.md` → Prime Agent

---

## Out of scope

- Making hide quit (explicitly rejected).
- In-app updater.
- Windows close/minimize (C42 — app never launched there).
- Global `keep_sessions_running_on_quit` redesign.
