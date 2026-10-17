---
session: 2026-10-17T16:12Z
model: Cursor Grok 4.6
description: >-
  Second HOLD on #218: persist Use Rhizome, best-effort leftover
  chat_engine write-back, Cmd+K focus and CLI status nits.
---

# HOLD #218 — persist Use Rhizome

**Origin:** Cursor Grok 4.6 · 2026-10-17 · this session

Combined HOLD at `7b412de8`. One commit on the same branch. Draft stays draft.

## Done here

1. **Use Rhizome instead** writes `default_ai_target` and the active
   conversation `target_id`. `default_ai_agent` is untouched. The typed
   prompt is queued to `agent:prime`. `migrateStoredAiTarget` keeps
   `agent:prime` so a later save does not wipe it.
2. Leftover `chat_engine` write-back is best-effort and at most once per
   process. A failing write still returns `Ok` with normalized settings.
3. Cmd+K missing-agent focus lands on **Use Rhizome instead**. Install
   Codex uses `openExternalUrl`. Settings CLI status covers OpenCode,
   Antigravity, and Kiro. `ai.panel.empty.noContextDescription` uses
   Rhizome wording.

## Tests

- Vitest: 7585 passed, 1 skipped
- `pnpm typecheck` / `pnpm lint`: pass
- cargo test: 2522 passed, 25 ignored

## Review shots

`docs/review-shots/prime-hermes-picker/`

- `graphite-cmdk-codex-missing.png` / `earth-light-cmdk-codex-missing.png`
  (focus on Use Rhizome, no mint input ring)
- `graphite-cmdk-after-use-rhizome.png` (Ask Rhizome after reopen)

Stay out of `ChatHome.tsx` beyond the shared empty-state string,
`ResearchPanel`, Taproot. `ApprovalRequested.args` stays literal.
