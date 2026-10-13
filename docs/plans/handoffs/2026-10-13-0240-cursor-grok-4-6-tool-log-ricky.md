---
session: 2026-10-13T02:40Z
model: Grok 4.6 (Cursor)
description: >-
  Ricky review on #167: only rewrite a real run log, keep body lines and
  frontmatter lists, then rebase onto #164.
commits: this slice; rebase onto #164 follows
---

# Tool log note — Ricky review

**Origin:** Cursor Grok 4.6 · 2026-10-13 · review on #167.

## What changed

- A note is a run log only when it has an unquoted, unfenced
  `[tool] … is running.` line plus a lifecycle tag or `agent:`/`mode:`.
  Two quoted `[tool]` lines in an ordinary note stay as written.
- When it does rewrite, task items, link-start lines, extra `# ` headings,
  and fenced code stay in the body. Only raw tool-call lines go into the
  collapsed log.
- Existing frontmatter is kept. Tag lists and inline `[a, b]` lists survive.
  `agent`/`mode` are appended only when missing.
