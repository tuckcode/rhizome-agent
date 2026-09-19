# Hide-on-close helpers

**Status:** unambiguous slice is **in the tree** (`43059e3e`, 2026-09-12).
**C75 (2026-09-15, `cb74b28`) settled the gray zone in code:** hide leaves
a Rhizome-spawned Prime daemon warm. `hidden_window_helper_stops` is
`["ws_bridge", "mindwalk"]` only. Board pile item 6 remainder is a
**native live-check**, not a rewrite.
**Verified 2026-09-19** against `lib.rs` + `leftover-hide-close-names.test.ts`.
Do not recode. Do not add `spawned_prime_daemon` back to the hide stop list.
**Origin:** C22 + Atticus 2026-09-12 + C75.
**Related:** [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md) (transport), [ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md) (lifecycle).

---

## Done / now / next

- **Done:** red button **hides**. **Cmd+Q** quits. Dock click / tray restores (C22). On hide, `release_helpers_for_hidden_window` stops Mindwalk sidecar and the ws-bridge child. The spawned Prime daemon **stays** (`stop_spawned_daemon` is not on this path) so cold reopen does not pay spawn again. Keep-working sessions also leave that daemon.
- **Now:** name-list test exists in `lib.rs`. Native live-check still **NOT RUN**. Do not recode. Do not launch `/Applications`.
- **Next:** confirm on a rebuilt `.app` that hide leaves Rhizome in the Dock, Chat comes back without a full Prime spawn, and no extra Mindwalk / ws-bridge child stays as a second Dock story.

**Done when:** hide leaves Rhizome in the Dock, Chat can come back, ws-bridge and Mindwalk from this pid are gone, and the spawned Prime daemon is still listening. Cmd+Q still full-quits.

---

## Settled UX

| Action | Window | Rhizome process | Meaning |
|---|---|---|---|
| Red close | hide | stays in Dock | C22 |
| Cmd+Q | gone | exits | full quit |
| Dock / tray | show | already there | restore |

Vite / `mock-tauri` is not this path. Native `/Applications` only.

---

## The tension (settled in code by C75)

Three true statements already on the books:

1. **ADR-0163:** Rhizome is a client of Prime’s daemon. It does not own the daemon’s lifetime. A user-started background service may outlive the window.
2. **ADR-0167:** hide is **not** a background grant. `client_owned` is the default. Work does not keep going just because the window hid.
3. **Atticus (2026-09-12):** hide-on-close still leaves Prime and MCP helpers running with a Dock indicator. **Stop those helpers after a normal close**, not only after quit or leftover `.app` copies.

**C75 product call (in tree, packaged in `712024d`):** a daemon Rhizome
spawned because none was listening is treated as **the user’s daemon for
reopen speed**, not as a hide helper. Stop ws-bridge and Mindwalk. Leave
`spawned_prime_daemon`. A user-started background Prime service still
outlives hide (ADR-0163). Do not invent a new daemon-ownership model.

---

## Smallest slice (shipped)

On **hide** (not Cmd+Q):

1. Stop **Mindwalk / Mycelium sidecar** (`stop_mindwalk_sidecar`).
2. Stop **MCP helper processes Rhizome started** for this app instance (ws-bridge child), not the user’s other MCP configs.
3. Do **not** `prime-agent stop` against a daemon this process spawned, and do not stop a daemon that `prime-agent status` already reported as the default background service **before** this launch.
4. Do **not** change red-close into quit.

**Done when:** after hide, `ps` no longer shows a Mindwalk sidecar or Rhizome-owned MCP child from this pid; Dock still shows Rhizome Agent; reopen Chat works; spawned Prime is still up.

---

## Files to read when building

- `src-tauri/src/lib.rs` — close/hide, `should_reopen_main_window`, `hidden_window_helper_stops`
- `src-tauri/src/prime_session_host.rs` — `spawn_prime_daemon`, `warm_daemon_in_background`
- `src-tauri/src/mycelium.rs` — sidecar start/stop
- `docs/ARCHITECTURE.md` → Prime Agent
- `docs/CROSS-MODEL-HANDOFF.md` §21

---

## Out of scope

- Making hide quit (explicitly rejected).
- In-app updater.
- Windows close/minimize (C42 — app never launched there).
- Global `keep_sessions_running_on_quit` redesign.
