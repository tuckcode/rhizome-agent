---
title: Set up models and keys
description: Add model providers, store keys in the system keychain, test the connection and use free models.
---

Choose which models Chat can use, store their API keys safely, and check that they answer. Keys are kept in your operating system's keychain, never in the vault.

## Choose an engine first

**Chat engine** in Settings → AI Agents decides who runs Chat:

- **Off (default):** Prime handles its own provider login. Sign in from Settings → AI Agents → Local agent, or run `prime-agent` in a terminal and use `/login`.
- **On:** Rhizome's own engine runs new chats with the models you set up below. It doesn't need Prime.

## Add a provider

Settings → AI Agents has three tabs. **Local model** is for models on your computer. **API model** is for hosted models and holds **Taproot**.

| Kind | Examples | Needs |
|---|---|---|
| Hosted | OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral | API key, model ID |
| Local | Ollama, LM Studio | Base URL, model ID, usually no key |
| Your own | Any OpenAI-compatible server | Base URL, model ID, optional key and headers |

Anthropic models aren't offered by Rhizome's own Chat engine yet.

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

## If it doesn't connect

See [Model provider connection](../troubleshooting/model-provider-connection.md).
