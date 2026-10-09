---
session: 2026-10-09T22:39Z
model: Grok 4.6 (Cursor)
description: >-
  ADR-0179: Rhizome is its own harness. Atticus / knispo room
  consensus reversing ADR-0177 option 1. Docs only; no app code.
commits: ac3b574
---

# ADR-0179 — Rhizome is its own harness

**Origin:** Cursor Grok 4.6 · 2026-10-09 · docs / ADR only

## Decision

Rhizome owns its agent loop, tool runner, plugins, and model routing.
Prime and Hermes are optional engines. Supersedes ADR-0177. Amends the
Prime-only execution lock in ADR-0168; borrow-care still holds. ADR-0163
stays as the Prime daemon transport.

## Files

- `docs/adr/0179-rhizome-is-its-own-harness.md`
- `docs/vendored-sources.md` (empty index; Library vs Copied convention)
- Status notes: 0177 superseded; 0168 / 0163 / 0178 / `harness-doctrine.md`
- Living docs: `docs/adr/README.md`, `HANDOFF.md`, `NEXT.md`,
  `ARCHITECTURE.md`, `ABSTRACTIONS.md`, `CONTEXT.md`, `IDENTITY.md`,
  `AGENTS.md`, `BOARD.md`, `ASTRA_PACKET.md`, `YOU-SHOULD-KNOW.md`

## Follow-ups recorded, not built

Phase 1: bare loop plus CI behavior tests (later PR). Harness plan doc
(another teammate). Re-read #45 and #48. #56 won't-remove; `ai_models.rs`
is a starting point. Hermes ACP and Prime daemon stay optional engines.
