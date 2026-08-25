---
session: 2026-08-24T20:35-05:00
model: Grok 4.6 (Cursor)
description: >-
  First user-pulled Prime slice: Chat shows the live session's RLM children
  from the daemon list roster; Stop → cancel_rlm_child. Not #17 fork tree.
  Not a plugin kernel.
commits: ea105fa..HEAD
---

# RLM family in Chat (roster, not the fork tree)

User pulled RLM. Composition stays option 2: Prime is the engine, Rhizome
surfaces what the daemon already has. No Cordis. `get_session_tree` is
fork/branch history (#17) — different product.

## What landed

- `familyForRoot` + `RlmFamilyBand` under the activity band in Chat
- Tauri `cancel_prime_rlm_child` → host `cancel_rlm_child`
- Join Chat's durable `sessionId` to the roster handle; Stop sends
  `rlmChildId`, not the child's daemon handle
- Locale: `ai.activity.rlmFamily` / `ai.activity.rlmStop`; event
  `prime_rlm_child_stopped` (no child id)

## Still open

- Stop against a live child has not been probed; if it no-ops, the roster
  `rlmChildId` field is the first place to look
- Next Prime surfaces: queue visibility, then #17, then #14 create
  schedules
- Origin-tags commit `ea105fa` may still be local-only; this slice sits
  on top of it
