---
session: 2026-10-15T00:05Z
model: Cursor Grok 4.6
description: >-
  Rebased PR #163 onto main after #166/#167. Kept the translated
  formatInboxDateLabel. App View 1-4 tests now blur the chat box first.
---

# PR #163 rebase after #166

**Origin:** Cursor Grok 4.6 · 2026-10-15 · rebase of app navigation onto main that already has #166

## Done

- Rebased `cursor/polish-app-navigation-924a` onto `origin/main` (`071e6bd`, includes #166 and #167).
- Kept only #163's translated `formatInboxDateLabel` in `src/utils/dateDisplay.ts`, after `formatSavedLabel`.
- `App.test.tsx` blurs the focused chat box before Cmd+1–4. View shortcuts yield while typing; the layout tests must not fire them from the composer.

## Tests

- `pnpm exec vitest run src/App.test.tsx src/utils/dateDisplay.test.ts src/lib/peerToolExit.test.ts src/hooks/useAppKeyboard.test.ts` — 136 passed.
