---
session: 2026-09-06-1812
model: Composer
description: C70 message clocks + C71 Ask-box up-arrow history shipped in working tree
---

# C70 + C71 — Chat clocks and prompt recall

**Origin:** Composer · 2026-09-06 · daily-drive leftovers (forked subagent)

## Shipped

### C70 — per-message timestamps
- `AiAgentMessage.createdAtMs` on live append + Prime transcript replay
- Clock under the user bubble as `3:35p` (`formatMessageClock`)
- Tests: formatter, conversation append, transcript map, `AiMessage` UI

### C71 — composer Up/Down history
- In-memory session history (cap 50) via `composerPromptHistory` + `useComposerPromptHistory`
- Wired through `AiPanelComposer` send/steer + `InlineWikilinkInput` ArrowUp/Down
- **Gating:** only when the box is empty **or** the caret is collapsed at the start; never while wikilink/slash suggestion menus are open (mid-line Up keeps normal caret move)
- Tests: pure lib + composer integration (recall + restore draft)

## Not done here
- Commit (Atticus must ask)
- Live native QA of the clock / Up-arrow in `pnpm tauri dev`
- C57 / session-import UI / first-run vault (other tracks)

## Verify
```bash
npx vitest run \
  src/utils/messageTimestamp.test.ts \
  src/lib/composerPromptHistory.test.ts \
  src/lib/aiAgentConversation.test.ts \
  src/lib/primeTranscriptToConversation.test.ts \
  src/components/AiMessage.test.tsx \
  src/components/AiPanelComposer.history.test.tsx \
  src/components/AiPanelComposer.steer.test.tsx
```
85 passed.
