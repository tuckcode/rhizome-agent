---
session: 2026-09-14T13:28-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat reply actions stay named icons (svg, no visible text).
  AiMessage.test 45/45. No commit.
commits: none
---

# Chat action icons — 2026-09-14 13:28

**Origin:** Cursor Grok 4.6 · leftover chrome test · no commit

Learned pref: regenerate / copy / save / fork are icons with names,
not text-only controls. Existing test locked the accessible names.
New test locks each button has an svg and empty visible text.

`npx vitest run src/components/AiMessage.test.tsx` — **45/45**.
D6 group 3 names `AiMessage.test.tsx`.
