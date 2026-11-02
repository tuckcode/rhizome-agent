---
title: Set up models and keys
description: Add model providers, store keys in the system keychain, test the connection and use free models.
---

Choose which models Chat can use, store their API keys safely, and check that they answer. Keys are kept in your operating system's keychain, never in the vault.

## Engine

New chats use Rhizome's own engine (ADR-0187). Set up the models below in Settings → AI Agents.

## Connected

Settings → AI Agents opens with **Connected**: what's set up on this device, which models each gives, and what's missing. You can paste a key, test a connection, retry a failed list, or open install docs from that list.

The composer picker keeps providers that are not set up as disabled rows. A live model list that does not finish within 10 seconds says **Couldn't load models**, with **Retry**. The picker footer can open Connected.

Local CLI agents (Claude Code, Codex, and the other recognized CLIs) appear as cards. Rhizome does not offer **Use in chat** for those programs. An installed agent can copy MCP config so the CLI can use your vault.

## Add a provider

Settings → AI Agents has three tabs. **Local model** is for models on your computer. **API model** is for hosted models and holds **Taproot**.

| Kind | Examples | Needs |
|---|---|---|
| Hosted | OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral | API key, model ID |
| Local | Ollama, LM Studio | Base URL, model ID, usually no key |
| Your own | Any OpenAI-compatible server | Base URL, model ID, optional key and headers |

Anthropic models are not offered by Rhizome's own engine yet.

## Store the key

Under **API key storage**, pick one per provider:

- **Save locally in Rhizome (recommended).** Paste the key. Rhizome stores it in the system keychain: macOS Keychain, Windows Credential Manager, or Secret Service on Linux. Keys that older versions saved in a settings file move to the keychain the first time they're read.
- **Read from env var.** Give the variable's name. Rhizome reads the key from it.
- **No key.** For local servers that don't need one.

Don't edit a key file by hand.

## Test the connection

Click **Test model** on the provider. It sends one short request with no tools. If it passes, Settings says "Connection works. The model replied successfully."

## Use free models

**Taproot**, the free automatic router on the **API model** tab, lets Rhizome pick free hosted models for you and move on when one runs out. Each free provider needs its own key. See [Free models and routing](../concepts/free-models-and-routing.md).

## Pick the model for Chat

Choose a model, or **Taproot**, in the picker. The choice is saved with your settings.

## How long a turn may run

**Agent max steps** (Settings → AI Agents) is the number of model rounds in one turn. The default is 50. The smallest value is 1. There is no upper-bound control.

When the limit is reached, Chat pauses with **Continue**. Continue sends the same request on the same chat and adds 50 more rounds. Later normal turns use the configured limit again.

## If it doesn't connect

See [Model provider connection](../troubleshooting/model-provider-connection.md).
