---
session: 2026-09-06T22:15Z
model: Composer
description: >-
  After Stop, Chat looked idle but Enter failed with “queued session input is
  suspended.” Prompt retry only handled transport Err; daemon returns
  success:false. Also composer DOM vs React draft for mid-turn send/steer.
commits: uncommitted
---

# Suspend-retry + composer DOM send

**Origin:** Composer · 2026-09-06

## Problem

1. **Suspended pump:** Prime `abort` pauses session input. Rhizome already
   called `resume_queue` on Stop, but the next `prompt` still failed when the
   refusal came as `success: false` (not a socket error). Chat showed Idle and
   then `Cannot admit a session action while queued session input is suspended.`

2. **Stale draft:** Computer-use / paste can fill the contenteditable without
   firing `input`, so React’s draft stays empty. Mid-turn chrome showed Stop;
   click/Enter sent empty or stopped the turn (`?w` / “Stopped.”).

## Fix

- Rust: `send_prompt_command` — on suspended `success: false`, `resume_queue`
  once and re-send. Test:
  `prompt_retries_after_suspended_input_refusal`.
- FE: Enter + Send/Steer/Stop read live DOM text (`serializeInlineNode`);
  Stop-with-text steers when `onSteer` is present.

## Verify

- Unit: Rust suspend-retry; `AiPanelComposer.steer` DOM steer; WikilinkChatInput
  stale-draft submit.
- Live: app rebuilt into `pnpm tauri dev` (~16:45). Full mid-turn two-bubble
  dogfood still pending (CUA automation approvals blocked mid-run).

## Daily-drive goal

Not complete — need live two-bubble mid-turn proof; C57; session-import UI;
Anthropic/xAI reconnect. Packaging deferred.
