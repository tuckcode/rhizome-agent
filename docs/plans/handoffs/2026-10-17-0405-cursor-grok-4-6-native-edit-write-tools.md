---
session: 2026-10-17T04:05Z
model: Cursor Grok 4.6
description: >-
  Native loop mutate tools: edit_file and write_file on the #195 registry,
  with path sandbox, atomic writes, and an approval card that shows a diff.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · native file-tools PR 3 (edit/write)

`edit_file` and `write_file` sit on `rhizome_loop/tools` with
`ToolPolicy::Mutate`. They reuse the read-tools sandbox. They ask in
Limited tools and Power User. Allow for session covers later calls of
the same tool against the same path only. Writes are temp-file + rename.
Line endings and existing file modes are kept.

The Chat card shows the path and a unified-style preview. Review shots:
`docs/review-shots/edit-tools/`.

Localization: none — English only (C18).
PostHog: no event needed because approval answers are frequent and say
little about adoption (harness remaining threads 4a).
