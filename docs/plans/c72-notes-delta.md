---
type: spec
status: ready
origin: Cursor Grok 4.6 · 2026-09-14 · W8 C72
---

# C72 Notes delta

**Origin:** Cursor Grok 4.6 · 2026-09-14 · W8.  
**Stamped 15:34:** packaged leftover still **`476756c`**. Tree labels stay
`Notes, Browse closed` / `Notes, Browse open`. Inbox stays the folder.  
Brief: [2026-09-06-2151](handoffs/2026-09-06-2151-composer-c72-ready-brief.md).  
Settled stack: ADR-0170 (Notes right). Do **not** edit ADR-0166 or ADR-0170.

Spec only. No UI this morning.

## Plain answer

Notes is already findable. Tree leftover was the shortcuts sheet still saying **Editor + notes**. Packaged leftover is **`476756c`**.

Inbox stays the folder name. Do not invent a new one.

## One remaining ambiguity

**⌘2 / View / Cmd+K in this tree says `Notes, Browse closed`.** ⌘3 says **`Notes, Browse open`**. The same column also has a folder named Inbox.

The leftover mix-up is the **packaged app** (`476756c`), not the working tree.

Evidence (tree `4416411`+):

- Left rail label is **Notes** (`CommandRail` `rail.notes`; test expects accessible name `Notes`).
- Shut Notes is the **46px** strip labeled **Show Notes** (`VaultPanel`).
- Fresh vaults open Notes (`editor-list`).
- Inbox in the list is the folder/filter (`SidebarTopNav` `sidebar.nav.inbox`).
- `Go to Inbox` jumps to that folder. Keep it.
- Tree panel name: `viewCommands.ts` + View menu + `en.json` `command.view.editorNoteList` say `Notes, Browse closed`. Catalog keeps `Chat + Inbox` as a search alias only.

Already decided (`YOU-SHOULD-KNOW.md`): ⌘1 Chat only. ⌘2 Notes, Browse closed. ⌘3 Notes, Browse open.

## Inbox stays a folder

Keep **Inbox** on:

- the Notes-list row
- `Go to Inbox`
- the vault Inbox folder
- Settings organize / Inbox columns

Do not rename the folder. Do not add a second Inbox.

## Smallest discoverability change

Relabel ⌘2 only: `Chat + Inbox` → **`Notes, Browse closed`**.

⌘3 matched to **`Notes, Browse open`**. Old `Chat + Notes` stays a catalog search alias.

Keep **Show Notes**. Do not retint it. Do not add a control.

Five label sites. Implemented 2026-09-14 in tree: `viewCommands.ts`, `en.json` (English only), `appCommandManifest.json`, catalog aliases kept, `KeyboardShortcutsDialog` overrides. Native View menu on `476756c` still old until rebuild.

## New ADR?

**No** for this label fix. Rail policy does not change.

Write a **new** ADR only if someone later wants a right icon rail, a different Show Notes strip, or a new way to open the same column. Do not edit ADR-0166 or ADR-0170.

## Stop

- No right icon rail.
- No new launch default.
- No third panel control (rail Notes, Show Notes, ⌘2/⌘3 already cover it).
- Chat stays visible. Notes keeps the 46px restore and the inner seam.

**Done when:** Inbox means the folder everywhere a person can see it. ⌘2 does not say Inbox.
