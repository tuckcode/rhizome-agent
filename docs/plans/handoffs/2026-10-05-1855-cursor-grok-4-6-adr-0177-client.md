---
session: 2026-10-05T18:55Z
model: Grok 4.6 (Cursor)
description: >-
  ADR-0177: Rhizome is a client of harnesses. Atticus / knispo room
  consensus on #40 option 1. Docs only; no app code.
commits: pending
---

# ADR-0177 — Rhizome is a client of harnesses

**Origin:** Cursor Grok 4.6 · 2026-10-05 · docs / ADR only

## Decision

Option 1: Rhizome is a client of harnesses. It does not own the agent loop.
Generalizes ADR-0163. Closes the composition gap left by ADR-0168. Options 2
and 3 rejected.

## Files

- `docs/adr/0177-rhizome-is-a-client-of-harnesses.md`
- Index rows: `docs/adr/README.md`, `docs/ASTRA_PACKET.md`, `docs/NEXT.md`,
  `docs/HANDOFF.md` C50

## Follow-ups recorded, not built

Hermes ACP (Dank.bot), ACP on the roadmap, #81 memory work (G-baby),
deepseek-harness as a later client target only. Close #40 when the ADR is on
`main`. Do not close #5.
