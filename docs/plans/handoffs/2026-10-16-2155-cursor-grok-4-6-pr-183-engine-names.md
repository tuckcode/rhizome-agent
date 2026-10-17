---
session: 2026-10-16T21:55Z
model: Grok 4.6 (Cursor)
description: >-
  PR #183: knispo final naming — Prime engine stays Prime, native engine is
  Rhizome, composer placeholder follows the engine.
commits: this slice
---

# PR #183 engine display names

**Origin:** Grok 4.6 (Cursor) · 2026-10-16

Undo the Prime-to-Rhizome rename on the agent picker, onboarding, and
Settings. `AI_AGENT_DEFINITIONS.prime.label` is `Prime Agent` again.
`SettingsPanel.tsx` Chat-engine status stays hardcoded `Prime Agent`.

Composer / empty-state / Cmd+K copy uses `composerAgentLabel`: Prime chats
say Prime (`Ask Prime`), native chats say Rhizome (`Ask Rhizome`).
`CommandPaletteAiMode` still interpolates `ai.panel.placeholder.ready`.

Provider display names and `docs/screenshots/pr-183/` stay. Did not edit
`HANDOFF.md`.
