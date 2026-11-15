---
session: 2026-10-24T19:00Z
model: Cursor Grok 4.6
description: >-
  Docs only: first launch is native with no Prime setup, Rhizome-only
  in-app updater, Connected providers, native images, and step-cap Continue.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-24 · weekly docs automation

Living Starlight and briefing pages still described a Prime first-launch
path, a Prime Chat-engine **Update now** offer, and text-only native
chat. Source on `37f5b0bb` disagrees.

## What landed

Docs only. No product code.

Verified against:

- `src/lib/effectiveChatEngine.ts` — always `native`
- `src/lib/chatEngine.ts` — leftover `chat_engine` values are native
- `src/components/ConnectedProvidersSummary.tsx` — Connected list
- `src/components/LocalAgentCards.tsx` — no Use in chat
- `src/components/NativeChatModelPicker.test.tsx` — disabled rows, 10s timeout
- `src/lib/composerAttachments.ts` + `src-tauri/src/chat_images.rs` — ADR-0190
- `src/components/SettingsPanel.tsx` — Agent max steps, default 50
- `src-tauri/src/app_updater.rs` — Rhizome updater; placeholder refused
- `src-tauri/src/git/remote_url.rs` — option / transport URL reject
- ADR-0189 follow-ups: first-launch Prime screen and Prime update offer gone

Pages updated: README, GETTING-STARTED, PUBLIC-PREVIEW, YOU-SHOULD-KNOW,
CROSS-MODEL-HANDOFF §28, docs/start, and Starlight start / guides /
concepts / troubleshooting / platforms-and-updates.

## Not in this change

No product code. Leftover Prime/Hermes engine code stays in the tree.
No Kanban UI. Reasoning-level catalog exists in Rust; this PR does not
claim a composer thinking menu.
