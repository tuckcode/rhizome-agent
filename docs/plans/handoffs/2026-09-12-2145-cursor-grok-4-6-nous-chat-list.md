---
session: 2026-09-12T21:45-05:00
model: Cursor Grok 4.6
description: >-
  Nous Portal sits in the Chat model list. Settings can tick unused models
  off. Expanded left rail keeps Settings as a gear; pin is on the left.
commits: 476756c
---

# Nous Portal in Chat + Settings gear

**Origin:** Cursor Grok 4.6 · 2026-09-12 · this file

Atticus: Nous Portal was a Settings card you could not reach from the Chat
model menu. He also wanted a Settings list to tick unused models off. Then
the expanded rail word "Settings" looked wrong next to the collapsed gear.

## What landed

- Settings → AI Agents → Nous Portal → **Add to Chat list** fetches
  `https://inference-api.nousresearch.com/v1/models` and merges
  `nous-portal` into `~/.prime/agent/models.json` (env var name only, never
  the key, never `auth.json`). Then reload. Chat's picker can list them next
  to OpenRouter / Anthropic.
- **Copy key command** still copies `export NOUS_API_KEY=…`.
- Chat model menu: check models to keep. Uncurated view shows **provider
  names**, not 501 checkboxes. Search still works.
- PostHog: `nous_portal_added_to_chat`.
- Expanded command rail: Settings stays a **gear**. Pin on the left, gear
  on the right. Collapsed still stacks gear then pin.

## Left alone

Unrelated dirty tree: `lara.lock` delete, `.gitleaksignore`, `AGENTS.md`,
`BOARD.md`, `CROSS-MODEL-HANDOFF.md`.
