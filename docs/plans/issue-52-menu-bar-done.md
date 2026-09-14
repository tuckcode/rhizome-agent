# #52 — Menu bar “agent is done”

**Status:** leftover only. Job 1 **running list is in the tree.** Do not recode it. Do not add a Done TTL this window.  
**Stamped 16:20:** still no TTL. Do not recode.  
**Origin:** Cursor Grok 4.6 · 2026-09-13 · GitHub [#52](https://github.com/tuckcode/rhizome-agent/issues/52), sibling [#13](https://github.com/tuckcode/rhizome-agent/issues/13)  
**Code:** `src-tauri/src/menu_bar_companion.rs`

---

## Plain answer

The menu-bar menu already lists chats that are **still working**, and the hover text counts them. When a chat **finishes**, that row disappears. There is no ding, and no “just finished — click to open” line.

That missing finish-signal is the remainder of job 1. Jobs 2 and 3 below are not a small fix.

---

## Shipped (do not rebuild)

- Tray rows from `list_running_sessions` (same roster as the popover)
- Click a row → `menu-bar-open-session` → that chat
- Tooltip: `Rhizome` / `1 session running` / `N sessions running`
- 15s background poll (no push event from Prime)
- #53: tray still builds if the quick-note window fails (`e469ee4`)
- Capture Area / Screen / Window → vault (issue job 3)

Tests: `tray_tooltip_*`, `running_session_rows_*` in `menu_bar_companion.rs`.

---

## Leftover job 1 — “the one that just finished”

Issue text: a count of turning sessions, **and a click that opens the one that just finished**.

Today, finish = the row vanishes on the next 15s poll. If you are not looking at the menu, you never hear it.

Narrow later slice (not invented UX beyond the issue):

- Remember last poll’s running ids
- When an id drops off, keep a **Done: {title}** row (same click path) for a short TTL
- Tooltip can say `Rhizome — session finished` until the next poll after that TTL
- No macOS notification banner unless Atticus asks — the issue named the **menu**, not a system alert
- TDD on a pure helper next to `running_session_rows` (previous ids + current roster → done rows)

Do not ship a 15s-late “done” row without that TTL helper and a test. Native QA only after the helper is green.

---

## Not leftover-small (do not start)

**Job 2:** hold a key, talk or type, screen goes to the agent. Mute-first hotkey → capture → composer focused. Voice later.

**Voice** is explicitly deferred by the issue.

**Job 3** capture is done. Do not add a fourth capture mode.

Keep GitHub #52 **open** until the done-row (or Atticus says the vanishing row is enough).
