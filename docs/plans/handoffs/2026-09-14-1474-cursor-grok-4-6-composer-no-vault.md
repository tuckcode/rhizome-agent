---
session: 2026-09-14T14:51-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat still mounts the Prime composer deck with no vault. Model
  picker / thinking / Agents pills are not vault-gated. Do not close #46.
commits: uncommitted
---

# Composer chrome without a vault

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:51 · leftover test.

ChatHome still renders `ChatComposerDeck` when `vaultPath` is empty.
The stub sees `composer-controls` = yes. No vault gate around the deck.

```bash
npx vitest run src/components/ChatHome.test.tsx -t "composer deck|composer chrome"
```

**2/2 PASS.** No product edit. Do not close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
