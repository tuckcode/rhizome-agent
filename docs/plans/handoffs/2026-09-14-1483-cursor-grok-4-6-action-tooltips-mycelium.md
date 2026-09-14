---
session: 2026-09-14T15:09-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat action icons still show full hover tooltips. Mycelium stays an
  iframe, not a browser tab. No commit.
commits: uncommitted
---

# Action tooltips + Mycelium iframe leftover

**Origin:** Cursor Grok 4.6 · 2026-09-14 15:09 · leftover tests.

Chat reply actions stay icons. Hover still shows the full words
(Regenerate / Copy). Mycelium still embeds in-app. It does not call
`window.open`.

```bash
npx vitest run src/components/AiMessage.test.tsx \
  src/components/MyceliumView.test.tsx \
  -t "hover tooltip|Rhizome chrome"
```

**PASS.** No product edit. Do not launch Mindwalk in a browser.
Do not turn action icons back into text.

## Not this window

- C64 / W4 / hide live-check / last-idle relaunch still **NOT RUN**.
  App still `476756c`. Do not launch.
- D6 commits wait ~15:45.
