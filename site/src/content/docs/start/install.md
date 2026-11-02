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

Prime Agent is not required for Chat. Rhizome's own engine is the only chat engine. Prime and Hermes are no longer chat engines (ADR-0189); leftover code is still in the repo until the follow-up PRs.

## Build and run

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs the project's dependencies. If Prime Agent isn't on the machine, it may still download Prime's command-line tool. Chat doesn't use it (ADR-0189), and that step comes out with the leftover engine code. Rhizome doesn't include a copy of Prime or Node. Chat runs on Rhizome's own engine.

`pnpm tauri dev` builds the app and opens it.

## Set up Prime (legacy)

Skip this section unless you use Prime from the CLI. New chats use Rhizome's own engine. Add a provider key or use **Taproot** in Settings → AI Agents. See [Set up models and keys](../guides/configure-ai-models.md).

The first time `prime-agent` runs in a terminal, it asks you to run `/login` and choose a model provider. Rhizome's Settings no longer has a Prime sign-in.

Prime stops when the terminal that started it closes. To keep it running in the background:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

## If you already have a built copy

Quit `/Applications/Rhizome.app` before you run `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, so a second launch attaches to the copy that's already open.

## Look at the interface without an engine

```bash
pnpm dev
```

Then open `http://localhost:5202`. This runs the interface in a browser. Chat doesn't answer.

## Next

[First launch](first-launch.md): open a vault and send your first message.
