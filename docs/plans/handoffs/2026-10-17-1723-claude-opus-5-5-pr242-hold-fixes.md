---
session: 2026-10-17T17:23
model: Claude Opus 5.5 (Claude Code desktop)
description: >-
  PR #242 (board C, conflict-checked save) hold fixes: the save baseline
  has its own map, a conflict goes to a "(conflict)" copy with Keep mine /
  Reload, and Rust replays the board's Status write for the splice.
commits: b62e773e, aafc6df4, bdda0f04
---

# PR #242 hold fixes

The hold review is in the Rhizome Vault session log
`agents/claude/session-logs/2026-10-17 - pr242 hold review.md`.

## Must-fix

1. **Save baseline.** `noteContentCache.ts` has a separate per-path
   baseline map (`setSaveBaseline`, `getSaveBaseline`, `moveSaveBaseline`,
   `clearSaveBaseline`, `clearSaveBaselines`). The preload cache no longer
   holds it. Open, load, save, property edit, create and rename set it.
   Close, a failed open and opening another note clear it. Vault switch
   closes all tabs, which clears it. PROBE1 to PROBE3 are in
   `src/hooks/useSaveNote.baseline.test.ts`.
2. **Conflict trap.** A "Save conflict:" error now writes the editor text
   to `<name> (conflict).md` next to the note (`stashConflictCopy`), drops
   the pending buffer, and lets the flush resolve. Navigation goes ahead.
   Later conflicts on the same note update the same copy. If the copy
   cannot be written, the old behavior stays. The toast offers Keep mine
   and Reload (`App.tsx`, `Toast.tsx` second action).
3. **In-flight splice.** The TS frontmatter swap is gone. Rust compares
   the disk with the baseline text and accepts a change only when
   `set_status(baseline, disk_status) == disk`. Edits typed during a
   spliced save keep the pre-splice text as their baseline, so the next
   save splices only the Status value in Rust. PROBE4 to PROBE6 are in
   `src/hooks/useEditorSave.conflict.test.ts` and
   `board::tests::splice_keeps_edits_typed_during_a_spliced_save`.

## Should-fix: done

- `flushEditorContent` fallback uses the checked save and moves the baseline.
- `fs::read` in the checked save retries like the write.
- A no-op save writes nothing and logs no `manual_edit`.
- Board false conflicts (list-form, empty, duplicate `Status`/`status`,
  same status on both sides) are gone: the replay covers them.
- A deleted, moved or non-UTF-8 note is still a conflict, but it no
  longer traps the editor: the text goes to the conflict copy.

## Deferred

- Typed `{kind: "conflict"}` result in place of the `"Save conflict:"`
  string. The prefix is now one constant on each side
  (`SAVE_CONFLICT`, `SAVE_CONFLICT_PREFIX`).
- Nits: refuse `...` as a frontmatter close, the unused `contentHash` on
  the TS side, the full text sent twice over IPC, and the Playwright mock
  that skips the check.
