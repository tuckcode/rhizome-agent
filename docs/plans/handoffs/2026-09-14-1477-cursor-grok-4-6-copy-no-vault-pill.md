---
session: 2026-09-14T14:55-05:00
model: Grok 4.6 (Cursor)
description: >-
  Right-click Copy still works on the assistant reply block. Composer
  has no vault switcher. git add -n .cursor is still ship-skill only.
commits: uncommitted
---

# Reply Copy + no composer vault pill

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:55 · leftover tests.

Selected answer text still gets the OS Copy menu. The composer strip
still has no vault switcher — vault stays on the bottom-left bar.

```bash
npx vitest run src/utils/nativeContextMenu.test.ts src/components/ChatComposerDeck.contextPill.test.tsx -t "assistant reply|vault switcher"
git add -n .cursor
```

**2/2 PASS.** Dry-add still lists only `.cursor/skills/rhizome-ship/SKILL.md`.
Do not add `.cursor/skills/impeccable/`. No product edit.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
