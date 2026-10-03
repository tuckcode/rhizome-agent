---
session: 2026-09-28T13:44-05:00
model: Cursor Grok 4.7
description: >-
  Stall plan for the pinwheel on startup, Settings, and AI Agents, revised
  for an Opus 5.5 review. Vault index gate and Source control are
  uncommitted and not rebuilt. No click was timed on the live app.
commits: none
---

# Stall plan

**Origin:** Cursor Grok 4.7 · 2026-09-28.

## What this session leaves

The plan is [`docs/plans/2026-09-28-rhizome-stall-plan.md`](../2026-09-28-rhizome-stall-plan.md).

`prime-agent --version` was 0.07 seconds. That is not the pinwheel.

The plan's mechanism is synchronous Prime commands on the main thread, including a 30 second daemon wait. That is read from the code. It is not a sampled click.

## Uncommitted, not in /Applications

- Vault index waits for the notes dock (`notesDockRequested`, `loadIndex`).
- Note bar **Source** / **Editor** control.

Do not treat either as the whole stall fix. Do not revert them while executing the plan.
