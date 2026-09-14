---
session: 2026-09-14T15:31-05:00
model: Grok 4.6 (Cursor)
description: >-
  Leftover locks: Settings import stays vault-only (no import_jsonl
  invoke). Last-conversation restore needs no vault path.
commits: uncommitted
---

# Import vault-only + last-idle leftover

**Origin:** Cursor Grok 4.6 · 2026-09-14 15:31 · leftover.

Settings still says **Import to vault**. It does not call
`import_jsonl`. Last-conversation restore still has no `vaultPath`.
Native last-idle relaunch is still **NOT RUN**.

## Not this window

- C64 / W4 / hide / last-idle still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45. No push. No rebuild.
- Silence is not `1`.
