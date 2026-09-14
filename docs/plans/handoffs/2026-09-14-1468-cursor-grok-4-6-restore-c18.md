---
session: 2026-09-14T14:45-05:00
model: Grok 4.6 (Cursor)
description: >-
  Last-conversation restore needs no vault path. C18 keeps Download
  words in en.json. Do not close #46. Do not rewrite en.json.
commits: uncommitted
---

# Restore without vault + C18

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:45 · leftover tests.

Last conversation lives on Prime disk. `usePrimeSessionRestore` has no
`vaultPath`. AiPanel does not pass one. Do not close #46.

C18: `onboarding.welcome.templateDescription` stays
“Download the Getting Started vault”. Do not migrate `en.json`.

```bash
npx vitest run src/hooks/usePrimeSessionRestore.test.ts \
  src/components/AiPanel.test.tsx src/components/WelcomeScreen.test.tsx
```

**92/92 PASS.** No product edit.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- Native last-conversation relaunch still **NOT RUN**.
- D6 commits wait ~15:45.
