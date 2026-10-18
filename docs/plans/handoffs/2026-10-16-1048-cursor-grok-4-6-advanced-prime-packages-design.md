---
session: 2026-10-16-1048
model: Cursor Grok 4.6
description: Design follow-up for Advanced Prime Packages (PR #181).
---

# Advanced Prime Packages design follow-up

**Origin:** Cursor Grok 4.6 · 2026-10-16 · this session

Eight UI fixes on `cursor/move-prime-packages-advanced-a4a3`:

- Packages is a `text-sm` subsection with no icon.
- Full-system-access warning is its own amber line with a warning icon.
- Prime install status and Copy MCP sit above Packages.
- Catalog starts collapsed behind **Browse packages**, then caps at about five rows.
- Copy does not name Pi. Status reads `Prime is installed` plus version.
- Descriptions clamp to two lines. Install buttons stay top-aligned.
- GitHub Actions is not shown as an author; repo owner or npm scope is used.
- Active catalog tabs use a foreground fill, not the mint accent.
