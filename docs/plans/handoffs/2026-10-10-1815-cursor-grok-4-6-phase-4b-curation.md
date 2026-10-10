---
session: 2026-10-10T10:13Z
model: Grok 4.6 (Cursor)
description: >-
  ADR-0182 default-on set and provider-curation stance. One
  amendment line on ADR-0180. Docs only. HANDOFF.md untouched.
commits:
---

# ADR-0182 — default-on set and curation stance

**Origin:** Cursor Grok 4.6 · 2026-10-10 · docs / ADR only

knispo follow-up on draft #106. Did not touch Claude's #108 code.
Did not edit `docs/HANDOFF.md`.

## Settled

- Default-on: Groq, Mistral, LLM7, OpenRouter `:free` ids, NVIDIA NIM,
  plus a user OpenAI-compatible endpoint.
- Cloudflare Workers AI opt-in with card-on-file warning.
- Dropped Cerebras and GitHub Models.
- Missing `hardStop` means "not established", not "bills you".
- Optional strict mode: flagged hard-stop providers only.
- Open follow-up: GLM 5.3 vs NVIDIA's own catalog.
- ADR-0180: one amendment line pointing at 0182 for curation.

## Files

- `docs/adr/0182-free-tier-provider-routing.md`
- `docs/adr/0180-rhizome-is-its-own-harness.md`
