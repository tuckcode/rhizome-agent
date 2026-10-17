---
session: 2026-10-17T17:35Z
model: Cursor Grok 4.6
description: >-
  Fourth HOLD on #218: Cmd+K stays typable when Codex is missing,
  empty Use Rhizome stays open, queue send-once tests.
---

# HOLD #218 — typable Cmd+K when Codex is missing

**Origin:** Cursor Grok 4.6 · 2026-10-17 · this session

Combined HOLD 4 at `e4651e47`. Design passed. Merged `origin/main` (community files). Draft stays draft.

## Done here

1. **MUST-FIX.** AI-mode Cmd+K keeps typing enabled when the selected agent is missing. Sending stays blocked. Empty **Use Rhizome instead** retargets, leaves the palette open in Rhizome mode, and focuses the input. A typed prompt still queues and closes.
2. Use Rhizome focus ring has `focus:ring-offset-2 focus:ring-offset-popover`. Queue send-once has a direct hook test. Leftover Prime/Hermes chips use the Rhizome brand mark. Native session empty copy says Rhizome.
3. Codacy's only new finding was a timing-attack warning on the retarget token `===` in `AiWorkspace.tsx`. That token is a React counter, not a secret. Switched to a monotonic `<=` check.

## Tests

- Focused Vitest: CommandPalette, App, AiWorkspace, PrimeSessionList, useAiPanelPromptQueue — passed
- `pnpm typecheck` / eslint on touched files: pass
- No Rust files in this HOLD

## Review shots

`docs/review-shots/prime-hermes-picker/`

- `graphite-cmdk-codex-missing.png` / `earth-light-cmdk-codex-missing.png`
  (typed with `pressSequentially`, then Tab to Use Rhizome)
- `graphite-workspace-after-use-rhizome.png` /
  `earth-light-workspace-after-use-rhizome.png`

Stay out of `ChatHome.tsx` beyond the shared empty-state string,
`ResearchPanel`, Taproot. `ApprovalRequested.args` stays literal.
 The "Codex missing" tab title is unchanged.
