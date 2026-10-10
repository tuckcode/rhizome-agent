# Hide-on-close helpers

**Status:** ADR-0179 changed the default. Red X **quits** unless Settings →
Keep in taskbar. Hide + C75 (warm spawned Prime) is the opt-in path.
**Origin:** C22 + Atticus 2026-09-12. **Origin:** Cursor Grok 4.6 · 2026-10-06 ·
Atticus: close app-related helpers unless keep in taskbar.
**Related:** [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md),
[ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md),
[ADR-0179](../adr/0179-red-close-quits-unless-keep-in-taskbar.md).

---

## Done / now / next

- **Done:** default red button **quits**. `release_helpers_on_quit` stops
  Mindwalk, the ws-bridge child, and a Prime daemon this process spawned
  unless Keep working left the session resident. Keep in taskbar restores
  hide; on hide, C75 still leaves spawned Prime warm.
- **Now:** name-list tests in `lib.rs`. Native live-check still **NOT RUN**.
- **Next:** a user-started background Prime service must still outlive quit
  (ADR-0163). Do not send `shutdown`.

**Done when:** default red X leaves no Rhizome-owned helper and no this-process
Prime supervisor. Keep in taskbar still Dock-restores Chat. Shared Prime
survives.

---

## Settled UX

| Action | Window | Rhizome process | Meaning |
|---|---|---|---|
| Red close (default) | gone | exits | full quit; stop owned helpers |
| Red close + Keep in taskbar | hide | stays in Dock | C22 + C75 |
| Cmd+Q | gone | exits | full quit |
| Dock / tray after hide | show | already there | restore |

Vite / `mock-tauri` is not this path. Native `/Applications` only.

---

## The tension (do not paper over)

1. **ADR-0163:** Rhizome is a client of Prime’s daemon. It does not own the
   daemon’s lifetime. A user-started background service may outlive the app.
2. **ADR-0167:** close is **not** a background grant. `client_owned` is the
   default. Keep working is the explicit promote.
3. **Atticus (2026-10-06):** red X closes background processes related to the
   app, unless keep in taskbar.

C75 still applies **on hide**. Do not recode hide to stop
`spawned_prime_daemon`. Do recode **quit** to stop it unless Keep working.

---

## Files to read when building

- `src-tauri/src/lib.rs` — close/hide/quit, `keep_in_taskbar_on_close`
- `src-tauri/src/prime_session_host.rs` — `stop_spawned_daemon`
- `src-tauri/src/mycelium.rs` — sidecar start/stop
- `docs/ARCHITECTURE.md` → Prime Agent

---

## Out of scope

- In-app updater.
- Windows close/minimize (C42 — app never launched there).
- Global `keep_sessions_running_on_quit` redesign.
