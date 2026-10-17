---
title: Install
description: Build and run the Rhizome developer preview from source on macOS.
---

You build Rhizome from source on a Mac and run it from there. This takes a few minutes, mostly for the first build.

:::note
**Developer preview.** macOS only. There is no signed download, no Homebrew package and no in-app updater yet. See [Platforms and updates](../reference/platforms-and-updates.md).
:::

## Before you start

You need:

1. macOS with the Xcode Command Line Tools (`xcode-select --install`)
2. Node.js `^20.19.0` or `>=22.12.0`
3. pnpm
4. Rust `1.77.2` or newer
5. git

Prime Agent is optional. You need it only if you turn **Chat engine** off. Rhizome's own engine is the default.

## Build and run

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs the project's dependencies. If Prime Agent isn't on the machine, it also downloads Prime's command-line tool so you can switch to that engine later. Rhizome doesn't include a copy of Prime or Node. Chat starts on Rhizome's own engine.

`pnpm tauri dev` builds the app and opens it.

## Pick an engine

Chat runs on one of two engines. You can switch new chats with **Chat engine** in Settings → AI Agents. An open chat keeps the engine it started with.

- **Rhizome's own engine (default).** The switch is on. It doesn't need Prime. Add a provider key, or use **Taproot**. See [Set up models and keys](../guides/configure-ai-models.md).
- **Prime Agent.** Turn **Chat engine** off. Set Prime up below.

## Set up Prime

Skip this section if you use Rhizome's own engine.

The first time `prime-agent` runs in a terminal, it asks you to run `/login` and choose a model provider. You can also sign in from Settings → AI Agents → Local agent: each provider card has a **Sign in** button that runs Prime's login for you.

Prime stops when the terminal that started it closes. To keep it running in the background:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

## If you already have a built copy

Quit `/Applications/Rhizome Agent.app` before you run `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, so a second launch attaches to the copy that's already open.

## Look at the interface without an engine

```bash
pnpm dev
```

Then open `http://localhost:5202`. This runs the interface in a browser. Chat doesn't answer.

## Next

[First launch](first-launch.md): open a vault and send your first message.
