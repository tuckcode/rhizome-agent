---
title: AI agent not found
description: Fix "Prime is missing" when you chose Prime as an optional engine and Rhizome can't find it.
---

You don't need Prime to use Rhizome. Turn **Chat engine** on in Settings → AI Agents and stay on Rhizome's own engine.

If you did choose Prime, Rhizome talks to it as a separate program. It can only use Prime when Prime is installed and Rhizome can find it.

## Symptoms

- Chat says Prime is missing.
- Settings → AI Agents shows Prime Agent as **missing**.
- `prime-agent` works in one terminal but not from Rhizome.

## Checks

1. Open a terminal and run:

   ```bash
   prime-agent status
   ```

2. If the command isn't found, run `./install.sh` in your `rhizome-agent` folder. It installs Prime when it's missing.
3. If Prime is installed but not running, start the daemon:

   ```bash
   (prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
   ```

4. Look at Settings → AI Agents → Local agent → **Recognized local agents**. Prime Agent should show as installed, with its version.

## Path issues

Desktop apps can get a different `PATH` from your terminal. Rhizome checks common install locations, but shell setup varies. Install command-line tools in standard locations, or make them available from your login shell.
