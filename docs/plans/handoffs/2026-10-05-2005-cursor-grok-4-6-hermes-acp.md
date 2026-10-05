---
session: 2026-10-05T20:05Z
model: Grok 4.6 (Cursor)
description: >-
  Generic ACP client plus Hermes adapter. One-shot chat stays as
  fallback. Fixture-tested; not run against real Hermes.
commits: pending
---

# Hermes ACP client (ADR-0178)

**Origin:** Cursor Grok 4.6 · 2026-10-05 · implements ADR-0177 consequence 1

## What landed

- Generic ACP stdio JSON-RPC client in `src-tauri/src/acp_client/`.
- Hermes prefers `hermes acp` when `hermes acp --check` succeeds.
- `hermes chat --quiet --source tool` remains the automatic fallback.
- Permission / edit-approval go through the existing Limited tools /
  Power User policy. Decisions appear as tool events. No new approval card.
- Session resume via `session/resume` or `session/load` when advertised.

## Tests

- Fake ACP agent: `src-tauri/tests/fixtures/acp_fake_agent.cjs`.
- Not tested against a real `hermes acp` install (none on this VM).

## Follow-up

Atticus / knispo: run a Hermes turn on the Mac with the ACP extra
installed. Confirm session list, permission prompts, and resume. Retire
the chat fallback only after that.
