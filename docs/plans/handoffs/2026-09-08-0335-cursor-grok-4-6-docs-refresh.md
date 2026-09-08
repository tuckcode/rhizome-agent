---
session: 2026-09-08T03:35Z
model: Cursor Grok 4.6
description: >-
  Docs automation: living architecture, briefing, and Getting Started
  corrected against the shipped shell, Prime chat, MCP, and first-run
  scaffold. Adds ADR-0171 (Graph on Changes only).
commits: pending
---

# Living docs catch-up (2026-09-08)

**Origin:** Cursor Grok 4.6 · 2026-09-08 · cron documentation automation

Verified against source, then updated existing pages. No product code.

## What was stale

- `ARCHITECTURE.md` still said Notes start closed and Graph/Mycelium sit
  under every Notes view. Code: `useViewMode` defaults `editor-list`;
  `ConnectionsPanel` mounts only on Changes.
- `YOU-SHOULD-KNOW.md` still mapped Graph/Mycelium as center-canvas
  destinations and described thinking as a one-click binary toggle.
- MCP section still advertised `rhizome_grok_import` / `generate_wiki` /
  `repo_research` and `grok-import` as a live `rhizome-tool` subcommand.
- `GETTING-STARTED.md` still said first-run clones the public Tolaria
  starter.

## What to read

- Layout: `docs/ARCHITECTURE.md` §Chat-Centered Layout · ADR-0171
- Prime chat: same file, thinking / names / skip-ensure / mid-turn
- First-run + pitfalls: `docs/GETTING-STARTED.md`
- Briefing correction: `docs/YOU-SHOULD-KNOW.md` §2
