---
session: 2026-09-14T14:52-05:00
model: Grok 4.6 (Cursor)
description: >-
  Expired Anthropic OAuth says Reconnect, same as Grok. DeepSeek stays
  Add key. No product edit.
commits: uncommitted
---

# Anthropic Reconnect / DeepSeek Add key

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:52 · leftover test.

Settings → Agents still treats expired Anthropic OAuth like Grok:
the button says **Reconnect**. DeepSeek stays **Add key**.

```bash
npx vitest run src/components/PrimeProviderStatusSection.test.tsx -t "Anthropic|DeepSeek as Add"
```

**2/2 PASS.** `PrimeProviderStatusSection.test.tsx` added to D6 group 3.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
