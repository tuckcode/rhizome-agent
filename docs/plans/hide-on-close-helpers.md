# Hide-on-close helpers

**Status:** unambiguous slice is **in the tree** (`43059e3e`, 2026-09-12). Board pile item 6 is a live-check, not a rewrite.  
**Verified 2026-09-13 night:** `release_helpers_for_hidden_window` is still in `lib.rs`. Do not recode. Remainder is native live-check (leftover Prime-spawned `mcp-server/index.js` is not ws-bridge; do not mass-kill — ADR-0163).  
**Origin:** C22 + Atticus 2026-09-12 (`AGENTS.md` Learned + [`BOARD.md`](../BOARD.md) pile item 6).  
**Related:** [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md) (transport), [ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md) (lifecycle).

---

## Done / now / next

- **Done:** red button **hides**. **Cmd+Q** quits. Dock click / tray restores (C22). On hide, `release_helpers_for_hidden_window` stops Mindwalk sidecar, ws-bridge child, and a Prime daemon **this process spawned** (`stop_spawned_daemon`). Keep-working sessions are the exception.
- **Now:** name-list test exists in `lib.rs`. Native live-check still **NOT RUN** (16:26). D6 already landed `secure_fs` + hide names. Do not recode. Do not launch `/Applications`.
- **Next:** gray zone only — a user-started background Prime service must still outlive hide (ADR-0163). Do not invent a new daemon-ownership model.

**Done when:** hide leaves Rhizome in the Dock, Chat can come back, and no extra Prime/MCP/Mindwalk helper processes stay as a second Dock story. Cmd+Q still full-quits.

---

## Settled UX

| Action | Window | Rhizome process | Meaning |
|---|---|---|---|
| Red close | hide | stays in Dock | C22 |
| Cmd+Q | gone | exits | full quit |
| Dock / tray | show | already there | restore |

Vite / `mock-tauri` is not this path. Native `/Applications` only.

---

## The tension (do not paper over)

Three true statements already on the books:

1. **ADR-0163:** Rhizome is a client of Prime’s daemon. It does not own the daemon’s lifetime. A user-started background service may outlive the window.
2. **ADR-0167:** hide is **not** a background grant. `client_owned` is the default. Work does not keep going just because the window hid.
3. **Atticus (2026-09-12):** hide-on-close still leaves Prime and MCP helpers running with a Dock indicator. **Stop those helpers after a normal close**, not only after quit or leftover `.app` copies.

The product call that is still thin: if Rhizome **spawned** a daemon because none was listening (`spawn_prime_daemon` in `prime_session_host.rs`, detached process group), is that spawn a **helper** (stop on hide) or the **user’s daemon** (leave it)?

**Do not guess.** Until Atticus picks, implement the unambiguous part first.

---

## Smallest slice (unambiguous)

On **hide** (not Cmd+Q):

1. Stop **Mindwalk / Mycelium sidecar** (`stop_mindwalk_sidecar` already exists; `lib.rs` already stops it on some exit paths).
2. Stop **MCP helper processes Rhizome started** for this app instance (packaged `mcp-server` / `cli-call.mjs` children), not the user’s other MCP configs.
3. Do **not** `prime-agent stop` against a daemon that `prime-agent status` already reported as the default background service **before** this launch.
4. Do **not** change red-close into quit.

**Done when:** after hide, `ps` no longer shows a Mindwalk sidecar or Rhizome-owned MCP child from this pid; Dock still shows Rhizome Agent; reopen Chat works.

---

## Gray zone (needs a one-line Atticus call)

Rhizome-spawned `prime-agent --mode daemon` when the socket was empty at connect.

- Leave it → matches ADR-0163 “never stops the daemon,” can leave a Dock-looking helper.
- Stop it → matches the 2026-09-12 helper sentence, can kill a daemon another client (TUI) just attached to.

Record the call in HANDOFF when made. Do not encode a new ADR until then.

---

## Files to read when building

- `src-tauri/src/lib.rs` — close/hide, `should_reopen_main_window`
- `src-tauri/src/prime_session_host.rs` — `spawn_prime_daemon`
- `src-tauri/src/mycelium.rs` — sidecar start/stop
- `docs/ARCHITECTURE.md` → Prime Agent

---

## Out of scope

- Making hide quit (explicitly rejected).
- In-app updater.
- Windows close/minimize (C42 — app never launched there).
- Global `keep_sessions_running_on_quit` redesign.
