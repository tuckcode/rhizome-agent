# #52 — Menu bar “agent is done”

**Status:** finish row is in source (`reconcile_finished_sessions`, keep
45s, label `Done: {title}`). No system notification. Native glance still
open — do not close #52 from tests.
**Origin:** Cursor Grok 4.6 · 2026-09-13 · GitHub [#52](https://github.com/tuckcode/rhizome-agent/issues/52), sibling [#13](https://github.com/tuckcode/rhizome-agent/issues/13)
**Code:** `src-tauri/src/menu_bar_companion.rs`
**Updated:** Cursor Grok 4.6 · 2026-09-19 · living-docs pass; packaged app still `712024d` until rebuild.

---

## Plain answer

The menu-bar menu lists chats that are **still working**, and the hover
text counts them. When a chat **leaves the running roster**, the menu
keeps `Done: {title}` for 45 seconds (`FINISHED_ROW_KEEP_MS`) or until
that row is opened. If nothing else is running, the tooltip says
`Rhizome — session finished`. There is no system notification.

A failed roster read must not invent finishes — `TrayFinishMemory`
stays as-is.

Native glance of the Done row is still open. Do not close #52 from
units.

---

## Shipped in source (needs rebuild to see in `/Applications`)

- Tray rows from `list_running_sessions` (same roster as the popover)
- Click a row → `menu-bar-open-session` → that chat; a Done click also
  drops that id from memory so the next poll does not put it back
- Tooltip: running count wins; else `Rhizome — session finished`; else `Rhizome`
- 15s background poll (no push event from Prime)
- #53: tray still builds if the quick-note window fails (`e469ee4`)
- Capture Area / Screen / Window → vault (issue job 3)
- #13 tray detail: a running row says what the chat is doing and how
  many helpers, including grandchildren

Tests: `tray_tooltip_*`, `running_session_rows_*`,
`reconcile_finished_sessions`, `finished_menu_label`,
`without_finished_session` in `menu_bar_companion.rs`.

---

## Leftover — native glance

Issue text: a count of turning sessions, **and a click that opens the
one that just finished**.

Source has the helper and the menu label. `/Applications` is still
`712024d` and does not include `35f217f`. Keep GitHub #52 **open**
until a native glance, or Atticus says the vanishing row was enough.

---

## Not leftover-small (do not start)

**Job 2:** hold a key, talk or type, screen goes to the agent. Mute-first hotkey → capture → composer focused. Voice later.

**Voice** is explicitly deferred by the issue.

**Job 3** capture is done. Do not add a fourth capture mode.
