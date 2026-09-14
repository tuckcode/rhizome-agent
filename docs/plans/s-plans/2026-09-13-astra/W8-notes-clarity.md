# W8 — C72 Notes clarity

**Owner:** Cursor Grok 4.6 (W8 Notes spec).
**State:** complete (spec + tree labels). Leftover is packaged `476756c`.
**Start:** 2026-09-14 ~11:17 CT. Follow the [parent contract](README.md).

```text
Owner: Cursor Grok 4.6 (W8 Notes spec)
State: complete (tree labeled; leftover is app 476756c)
Starting revision: 4416411
Owned paths: docs/plans/c72-notes-delta.md, docs/plans/s-plans/2026-09-13-astra/W8-notes-clarity.md
Sibling overlap: none on these paths; do not edit ADR-0166, ADR-0170, BOARD, HANDOFF
One bounded change: one-page C72 delta spec; no product code
Acceptance: one leftover named; Inbox stays the folder; smallest label change recorded; ADR = no for this delta
Evidence: 2151 brief + CommandRail/VaultPanel/viewCommands/YOU-SHOULD-KNOW ⌘2 wording
Commit: none (per task)
Pushed: no
Installed build tested: no — spec lane
Unverified behavior: native View menu / ⌘2 label on /Applications **476756c** (tree already says Notes, Browse closed / open)
Blocker and next action: none for labels. Rebuild picks them up. Do not close C72 from units.
```

Read [the corrected C72 brief](../../handoffs/2026-09-06-2151-composer-c72-ready-brief.md).
Result page: [`docs/plans/c72-notes-delta.md`](../../c72-notes-delta.md).

1. Named leftover **now:** packaged **`476756c`** still has old View names. Tree `4416411`+ already says ⌘2 **`Notes, Browse closed`** / ⌘3 **`Notes, Browse open`**.
2. Inbox stays the folder name. No replacement.
3. Smallest change **landed in tree:** `Chat + Inbox` → **`Notes, Browse closed`**. Keep Show Notes. Keep `Go to Inbox`.
4. New ADR: **no** for that label. Yes only for a right icon rail or a new restore strip. Do not edit ADR-0166 or ADR-0170.
5. Tests: `viewCommands.c72.test.ts`, `navigationCommands.c72.test.ts`, `KeyboardShortcutsDialog.test.tsx` (⌘2/⌘3 names).

**Done:** spec + tree labels. Packaged leftover until rebuild.
**Stop:** no right icon rail, new launch default, third panel control, or folder rename.
Chat stays visible. Notes keeps the 46px Show Notes strip and shipped default.
