# AI agent not found

Source: troubleshooting/ai-agent-not-found.md
URL: /troubleshooting/ai-agent-not-found

Rhizome runs Prime Agent as a separate program. It can only use Prime when Prime is installed and Rhizome can find it.

You don't need Prime for Chat. Rhizome's own engine is the only chat engine, and Prime is no longer a chat engine (ADR-0189); its leftover code is still in the repo until the follow-up PRs.

## Symptoms

- Chat says Prime is missing.
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

## Path issues

Desktop apps can get a different `PATH` from your terminal. Rhizome checks common install locations, but shell setup varies. Install command-line tools in standard locations, or make them available from your login shell.