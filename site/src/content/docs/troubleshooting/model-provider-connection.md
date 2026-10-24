---
title: Model provider connection
description: What to check when a local or hosted model provider won't connect.
---

Use this checklist when a model provider doesn't answer. It applies to Rhizome's own engine. Settings → AI Agents opens on **Connected**, which shows Ready, Needs a key, Not running, or Couldn't load models.

## Local providers

For Ollama or LM Studio:

1. Start the local model server.
2. Check that the base URL in Settings → AI Agents → Local model matches the server.
3. Check that the model ID is installed and loaded.
4. Click **Test model** again.

## Hosted providers

1. Check the provider kind and endpoint.
2. Check that the model ID exists for your account.
3. Check the key. With **Save locally in Rhizome**, the key is in the system keychain. With **Read from env var**, the variable must be set for the app, not only in your terminal.
4. Click **Test model**. It sends one short request with no tools. You can also paste a key and test from **Connected**.
5. If the picker says **Couldn't load models**, wait for Retry. The live list gives up after 10 seconds.

Never store keys in the vault. Vault notes are committed and can be pushed.

## Keychain problems

If a Free tier provider row says **Keychain error**, the system keychain is locked or Rhizome isn't allowed to use it. Unlock it or allow access, then reopen Settings. Keys from older versions move to the keychain the first time they're read; don't edit a key file by hand.

## Taproot can't route

If no free provider has a key, Settings says "Add a key to at least one provider to use Taproot." Turn on a provider and paste its key. With **Strict mode** on, only Groq and your own endpoint are used. See [Free models and routing](../concepts/free-models-and-routing.md).

## No file tools

Rhizome's engine can read, search, edit, and create notes in the open vault. See [Agents, engines and models](../concepts/ai.md).
