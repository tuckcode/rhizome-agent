---
session: 2026-10-19T16:01Z
model: Grok 4.7
description: >-
  Docs only: step limit and Continue, and native chat image caps,
  are now in the Chat guides. Unknown vision asks; it does not refuse.
---

**Origin:** Grok 4.7 · 2026-10-19 · weekly docs automation

Starlight still described a turn as running until the answer was done,
and it never said Chat accepts images. Both behaviors shipped on
2026-10-18 (step cap in #254, images in #250). `docs/ARCHITECTURE.md`
already had the step cap. Its image sentence treated a missing catalog
row as a refusal.

## What landed

Docs only. No product code.

Verified against:

- `src/components/SettingsPanel.tsx` — Agent max steps, minimum 1, Continue adds 50
- `src-tauri/src/engines/native.rs` — continuation uses `DEFAULT_STEP_CAP` (50), then restores the setting
- `src-tauri/src/rhizome_loop/driver.rs` — `DEFAULT_STEP_CAP` is 50
- `src/components/AiMessage.tsx` — `Continue (steps/max_steps)`
- `src/components/AiPanelChrome.tsx` — Continue only on the latest non-marker turn, and only while idle
- `src/lib/aiAgentSession.ts` — `Continue couldn't start:`; read-only and a live turn do not continue
- `src/lib/chatRunLiveStatus.ts` — "Paused at step limit. Continue available."
- `src/lib/nativeChatTranscript.ts` — reopen keeps `TurnCapped`
- `src/lib/composerAttachments.ts` and `src/components/useAiPanelAttachments.ts` — 4 images, 5 MB, PNG JPEG GIF WebP
- `src-tauri/src/chat_images.rs` — 12 MB encoded budget, last two turns, text-only refusal
- `src/lib/visionChoice.ts` — Send anyway in `localStorage` key `rhizome.visionSendAnyway`
- `src-tauri/src/rhizome_routing/mod.rs` — cooling vision routes refuse instead of using a text-only model

Pages updated: Starlight concepts/ai, guides/use-ai-panel,
guides/configure-ai-models, guides/sessions,
troubleshooting/chat-doesnt-answer, and the native-chat paragraph in
`docs/ARCHITECTURE.md`. The in-app agent-docs bundle was regenerated
from those pages.

## Left as it is

ADR-0188 still quotes `DEFAULT_STEP_CAP` as 8. The constant is 50.
ADRs are not edited in place.

Reasoning level is saved and sent on the native chat command. There is
no settings control for it yet, so these pages do not describe one.

The board module (`src-tauri/src/board/`) has ADR-0188 and its own
module comments. Listing boards has no command yet, so there is no
user guide for it.
