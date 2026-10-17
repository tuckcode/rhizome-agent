---
session: 2026-10-17T02:05Z
model: Grok 4.6 (Cursor)
description: >-
  PR #190 review HOLD: per-vendor apiKeyEnvVar, OpenAI default, Anthropic
  note, contrast, dirty-field preset switch, and new review shots.
commits: this slice
---

# Provider preset review fixes

**Origin:** Grok 4.6 (Cursor) · 2026-10-17

Ricky/Critiquito HOLD on #190 at `f0893f1`. Compatible presets no longer
inherit `OPENAI_API_KEY`. OpenAI is first and the default. Anthropic stays
in the list with “Not in Rhizome chat yet”. Edited URL/name survive a
preset switch; the pasted key does not.

## C-numbers

None.
