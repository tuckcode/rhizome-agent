---
session: 2026-10-15T21:12Z
model: Grok 4.6 (Cursor)
description: >-
  PR #168: Graphite remains the unsaved-dark default (e09bb88);
  System stays selectable when Graphite is only inferred.
commits: this slice
---

# PR #168 Graphite default (knispo)

**Origin:** Grok 4.6 (Cursor) · 2026-10-15 · knispo item 3

Graphite is the default for anyone with no saved color, including
existing dark-mode users. Saved Light stays Earth light. Saved System
follows the OS and is not written as a color slug. Settings keeps Match
system enabled while Graphite is only inferred; picking Graphite still
pins the mode toggle.
