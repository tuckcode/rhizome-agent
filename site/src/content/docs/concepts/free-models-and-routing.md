---
title: Free models and routing
description: How Rhizome routes Chat across free hosted models and falls back when one fails.
---

**Taproot** is Rhizome's free automatic router. It runs Chat on free hosted models without you picking one. It tries free providers in a fixed order. When a provider fails, rate-limits you or runs out of free use, Rhizome moves to the next one. You can add your own endpoint as the last stop.

This works with Rhizome's own engine. Choose **Taproot** in the model picker.

## What you get

- **No model shopping.** One choice, and Rhizome picks a working free model for each step.
- **Fewer dead ends.** A provider that's down or out of quota is skipped for a while instead of failing your chat.
- **No surprise restarts.** Rhizome switches provider only before any reply text arrives. Once the model has started answering or called a tool, an error ends that step. The half-finished answer isn't silently started again somewhere else.
- **Your keys stay on your computer.** Each provider needs its own free API key, kept in the OS keychain.
- **Your prompts aren't used for training.** Models whose free tier trains on prompts are left out of the list Rhizome routes to, along with free tiers that don't renew or have poor terms.

## The providers

In order:

1. Groq
2. Mistral
3. LLM7
4. OpenRouter (free models only)
5. NVIDIA NIM
6. Your own endpoint, if you picked one

Cloudflare Workers AI is off by default. It needs an account ID as well as a key, and turning it on shows a billing warning first. When on, it's tried after NVIDIA NIM.

The order is fixed. Settings shows it read-only under **Fallback order**.

## Set it up

1. In Settings → AI Agents, open the **API model** tab and find **Taproot**.
2. For each provider you want, turn it on and paste its API key. The row shows **Key saved**, **No key**, or **Keychain error** if the keychain is locked or access was denied.
3. Optional: choose an **Own endpoint** and **Own endpoint model**: any OpenAI-compatible server you've set up as a provider, local or hosted.
4. Optional: turn on **Strict mode**. It uses only providers that document a hard stop at the free limit (Groq today), plus your own endpoint.
5. In the model picker, choose **Taproot**. Until at least one provider has a key, Settings says "Add a key to at least one provider to use Taproot."

## How a provider gets skipped

Rhizome keeps three kinds of cooldown:

- **Provider:** after repeated timeouts or server errors, the provider is paused and tried again later.
- **Key:** a key that's rate-limited cools down on its own.
- **Model:** a model that's out of quota is locked out. A daily quota stays locked until it resets at midnight UTC.

Each step has a 45-second budget for retries. Your own endpoint is still tried after the budget runs out.

## Things to know

- Free tiers change. A provider's limits, terms and models are set by that provider, not by Rhizome.
- Some free tiers are for prototyping and evaluation only.
- Settings doesn't show each provider's terms or training policy. Models that train on prompts are left out automatically, but check a provider's terms yourself before using it for real work.
- Anthropic models aren't offered by Rhizome's own engine yet. To use Claude, use Prime and sign in on the Anthropic card in Settings → AI Agents → Local agent. See [Agents, engines and models](ai.md).

## Credits

- [OmniRoute](https://github.com/diegosouzapw/OmniRoute) (MIT) © 2026 diegosouzapw: the provider catalog data and cooldown rules are ported from it.
- [freellmapi](https://github.com/tashfeenahmed/freellmapi) (MIT): used as an edge-case checklist for retries and failover. No code or hosted catalog is copied.

See [Credits and licences](../reference/credits.md).

## Related

- [Set up models and keys](../guides/configure-ai-models.md)
- [Agents, engines and models](ai.md)
