# Rhizome Agent

[![repowise](https://api.repowise.dev/badge/wiki/tuckcode/rhizome-agent.svg)](https://repowise.dev/repo/tuckcode/rhizome-agent)
[![Code health](https://api.repowise.dev/badge/health/tuckcode/rhizome-agent.svg)](https://repowise.dev/repo/tuckcode/rhizome-agent)

![Rhizome Agent — Your work. Your memory.](src/assets/brand/rhizome-organic-hero.png)

**A harness that doesn't forget.**
Built around [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent), with useful tools from Claude Code, Hermes Agent, and DeepSeek. The built-in vault is your memory, wiki, and second brain, beside a research panel. What you save stays as plain Markdown on your disk, where you and the agent can both read it.

This is a developer preview. Prime Agent and Node are not bundled. There is no signed download.

| | |
|---|---|
| Getting started | [docs/start](docs/start/README.md) |
| Agent instructions | [docs/agent](docs/for-agents/README.md) — a block you can paste |

## Getting started

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs this repo and fetches Prime Agent when that program is not already on the machine. Chat needs Prime. The script downloads the command-line tool Prime publishes. There is no smaller copy inside Rhizome.

The full list of tools, the first minute in the app, and what to do when it fails: [Getting started](docs/start/README.md).

`prime-agent` stops when that terminal closes. To leave it running:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

Quit `/Applications/Rhizome Agent.app` before `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, and a second launch attaches to the one already open.

To look at the interface without a live Prime session: `pnpm dev`, then http://localhost:5202.

### First minute

1. The first launch may ask **Help improve Rhizome**. You can decline. Telemetry stays off until you accept, and a build without a Sentry or PostHog key sends nothing.
2. Chat opens. The sessions list opens with it on a first launch.
3. Create a local vault, or open a folder you already have.
4. Send one message. You should get an answer, or a clear failure: Prime is missing, the provider login expired, or the connection dropped.
5. Show Notes (View menu, or Cmd+2). Save a note, quit, and reopen the same file.

Notes live in the vault folder you opened. Chat transcripts live with Prime, under `~/.prime/agent/sessions/`.

If something fails, the longer recovery page is [`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md). Ports and tests are in [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

https://github.com/user-attachments/assets/c373461f-1dd7-438b-ac89-0f98856be89e

## Hand this to an agent

The copy-paste block, and a one-line version, live on their own page: [Agent instructions](docs/for-agents/README.md).

The full rules for an agent that edits this tree are in [AGENTS.md](AGENTS.md).

Prime Agent runs the chat: session, tools, skills, and provider login. Rhizome reaches the vault through MCP when a vault is attached.

| | |
|---|---|
| Product | Rhizome Agent |
| Bundle id | `ai.rhizome.agent` |
| Package | `rhizome-agent` |
| Chat | Prime Agent, plus tools from Claude Code, Hermes Agent, and DeepSeek |
| Notes | Plain Markdown, in a local vault you open |

Names and remotes: [`docs/IDENTITY.md`](docs/IDENTITY.md).

## Contributing

A small pull request is enough. Open an issue if you are not sure the change is wanted. Details: [CONTRIBUTING.md](CONTRIBUTING.md).
Security reports: [SECURITY.md](SECURITY.md). Do not file a vulnerability as a public issue.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).

Rhizome Agent is a modified version of
[Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi (AGPL-3.0).
The Mycelium view embeds Mindwalk (MIT) © 2026 Ricko Yu.
