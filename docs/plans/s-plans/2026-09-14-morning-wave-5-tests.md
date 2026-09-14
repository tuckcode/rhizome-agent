---
session: 2026-09-14T11:46-05:00
model: Composer (Cursor)
description: >-
  Wave 5. Neighbor unit tests for shipped C70/C71 chrome only.
  No product features. No commit.
---

# Morning wave 5 — tests

**Origin:** Cursor Composer · 2026-09-14 · morning burn wave 5.

Tests only. TDD against behavior already in the tree. No new exports.
No architecture invented — Astra docs pending.

## Added

1. **`composerPromptHistory` edge cases** — `src/lib/composerPromptHistory.test.ts`
   - Blank/whitespace sends do not append; browse state resets.
   - Caret spanning a selection blocks Up/Down recall.
   - Empty history: ArrowUp is not handled.
   - ArrowUp at the oldest entry stays put (index 0).

2. **`messageTimestamp` invalid input** — `src/utils/messageTimestamp.test.ts`
   - `normalizeMessageTimestampMs` rejects `undefined`, `null`, `NaN`, `Infinity`.
   - Millisecond timestamps (≥ 1e12) pass through unchanged.
   - `formatMessageClock` returns `''` for unusable values.

## Skipped (already covered)

- **`AiMessage` action tooltips** — accessible names for Regenerate / Copy / Save / Fork
  already asserted in `src/components/AiMessage.test.tsx`; no new tooltip tests.
- **Hide-on-close / Packages / C72** — wave 4; not duplicated.

## Ran

```bash
npx vitest run \
  src/lib/composerPromptHistory.test.ts \
  src/utils/messageTimestamp.test.ts
```

**Result:** 2 files, 14 tests, pass.

## Not this wave

- list-import / `import_jsonl`
- merge PR 66
- `/Applications` rebuild
- other locales (C18)
- git commit / push / rebuild
