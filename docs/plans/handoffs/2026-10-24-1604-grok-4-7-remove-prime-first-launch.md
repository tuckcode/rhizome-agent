---
session: 2026-10-24T16:04:00Z
model: Grok 4.7
description: ADR-0189 PR A. Removed the first-launch Prime setup screen. Chat engine resolution is native. Saved Prime or Hermes chat_engine values still migrate once.
---

**Origin:** Grok 4.7 · 2026-10-24 · cloud agent, branch `cursor/remove-prime-first-launch-7c75`

## What changed

A fresh install no longer stops on "Prime is ready" or the Agent runtime menu. After the vault is ready, the app opens on Rhizome's own engine.

- Deleted `AiAgentsOnboardingPrompt` and `useAiAgentsOnboarding`, and the Show AI Setup command that reopened that screen.
- `resolveEffectiveChatEngine` always returns `native`. External CLI sends still use `usesNativeChatStream`, which reads the target.
- `migrateRemovedHarnessChoices` already moved a saved `chat_engine` of Prime or Hermes to native and left chat rows in place. A test now locks that it runs once and leaves an already-native install untouched.
- `default_ai_agent` and `agent:prime` / `agent:hermes` conversation targets stay. Distill still reads `default_ai_agent`, and "Use Rhizome instead" still persists `agent:prime`.

## Left for follow-up

`src/lib/locales/en.json` keys `onboarding.ai.*` are unused. This PR does not edit locale files. Rust Prime and Hermes engine code is still in the tree.
