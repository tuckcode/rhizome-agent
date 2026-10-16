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

Prime Agent is optional. Rhizome's Chat engine does not need it. Install Prime only if you want that extra engine.

## Build and run

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs the project's dependencies. Rhizome doesn't include a copy of Prime or Node. If you want Prime as an optional engine and it isn't on the machine, the script can also download Prime's command-line tool.

`pnpm tauri dev` builds the app and opens it.

## Pick an engine

Chat runs on Rhizome's own engine. Turn **Chat engine** on in Settings → AI Agents, then add a provider key or use **Free tier (auto)**. See [Set up models and keys](../guides/configure-ai-models.md). You do not sign in to Prime to use Rhizome.

Prime Agent is an optional engine. Switch to it in the same Settings tab only if you want it.

## Set up Prime

This section is optional. Skip it unless you choose Prime.

Prime handles its own provider login. If you use Prime, the first time `prime-agent` runs in a terminal it asks you to run `/login`. You can also sign in from Settings → AI Agents → Local agent: each provider card has a **Sign in** button that runs Prime's login for you. That login is for Prime, not for Rhizome.

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
