---
session: 2026-11-16T18:25Z
model: Claude
description: First-run model step after the vault step, with Set up later and a fresh-profile smoke test.
---

# First-run model step

First run now goes consent, welcome, vault, model step, shell (run plan 3.4).
The step shows once, for a user who just finished the vault step and has no
model provider saved. Users who finished first run before this change never
see it.

## What the step offers

1. **Local model:** probes Ollama, then LM Studio. If one answers with models,
   this path leads and "Use <model>" saves the provider row and sets
   `native_chat_target`.
2. **ChatGPT sign-in:** leads when nothing local answers. Reuses
   `useOauthAccounts` (ADR-0186). Continue picks the first account model.
3. **API key:** OpenAI, Gemini, OpenRouter, xAI, Groq. The key is tested
   first, then saved to the keychain only. Anthropic is left out because chat
   does not run it yet.

"Set up later" ends the step for good. Nothing is saved.

## Where things are

- `src/lib/firstRunModelStep.ts`: pending flag, recommendation, provider rows.
  `FIRST_RUN_MODEL_PATHS` is the extension point for a new engine such as
  Claude Code (ADR-0191): add an id, a case in `recommendedModelPath`, and a
  panel in `FirstRunModelStep.tsx`.
- `src/components/FirstRunModelStep.tsx`: the screen.
- `useOnboarding.markVaultReady` sets the flag. `useStartupScreenState` and
  `StartupScreen` show the step. The flag lives in localStorage under
  `APP_STORAGE_KEYS.firstRunModelStep`.
- `tests/smoke/first-run-model-step.spec.ts`: fresh profile through the step.
  Existing onboarding specs now press "Set up later" after the vault step.

## Not done

- No Claude Code option. The engine work owns that.
- No "no model connected" state in chat after Set up later.
- Consent order and welcome copy are still open decisions.
- The Playwright specs were not run in the session that wrote them, because
  Chromium could not be downloaded there.
