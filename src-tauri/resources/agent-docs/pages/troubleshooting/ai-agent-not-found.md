# AI agent not found

Source: troubleshooting/ai-agent-not-found.md
URL: /troubleshooting/ai-agent-not-found

Chat runs on Rhizome's own engine, which is built into the app and needs nothing else installed. Other agents, such as a command-line tool you picked as a chat target, run as separate programs. Rhizome can only use one when it is installed and Rhizome can find it.

Prime and Hermes are no longer chat engines (ADR-0189). A chat that used to run on them now runs on Rhizome's engine.

## Symptoms

- The command palette says an agent "is not available on this machine".
- The agent's command works in one terminal but not from Rhizome.

## Fixes

1. Click **Use Rhizome instead** to send the prompt to Rhizome's own engine.
2. Or click **Install**, follow that agent's install steps, then try again.
3. If the agent is installed but still not found, check your `PATH` below.

## Path issues

Desktop apps can get a different `PATH` from your terminal. Rhizome checks common install locations, but shell setup varies. Install command-line tools in standard locations, or make them available from your login shell.