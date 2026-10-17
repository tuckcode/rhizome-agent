---
session: 2026-10-17T17:10Z
model: Cursor Grok 4.6
description: >-
  Third HOLD on #218: workspace chip/composer say Rhizome, Cmd+K
  focus ring and read-only input, prompt refs, unsaved retarget.
---

# HOLD #218 — Rhizome labels after Use Rhizome

**Origin:** Cursor Grok 4.6 · 2026-10-17 · this session

Combined HOLD at `06a12c28`. M2 leftover write-back and M1 persistence stay.
Merged `origin/main` (clean). One commit on the same branch. Draft stays draft.

## Done here

1. **MUST-FIX.** `agent:prime` stays the internal id. `AiPanelView` gets
   `chatEngine={sessionEngine}`. The workspace chip shows **Rhizome** for
   leftover Prime and Hermes targets. Distill/onboarding/settings still
   use Prime Agent copy in `aiAgents.ts`.
2. **Use Rhizome instead** has a `focus:` ring. Cmd+K input stays visible
   and read-only (`contentEditable=false`) when the selected agent is
   missing, showing the typed text.
3. Use Rhizome passes `[[note]]` refs through. An unsaved conversation is
   retargeted in memory and upserted when saved.
4. App persist test asserts `streamNativeChat` once and `streamAiAgent`
   never. Queue send is guarded so a new `agent` identity cannot resend.

## Tests

- Vitest: 7681 passed, 1 skipped
- `pnpm typecheck` / `pnpm lint`: pass
- cargo test / clippy `-D warnings` / `fmt --check`: pass

## Review shots

`docs/review-shots/prime-hermes-picker/`

- `graphite-cmdk-codex-missing.png` / `earth-light-cmdk-codex-missing.png`
  (focus ring, read-only typed prompt)
- `graphite-workspace-after-use-rhizome.png` /
  `earth-light-workspace-after-use-rhizome.png` (chip + composer Rhizome)

Stay out of `ChatHome.tsx` beyond the shared empty-state string,
`ResearchPanel`, Taproot. `ApprovalRequested.args` stays literal.
