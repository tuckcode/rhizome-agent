# Rhizome

[![repowise](https://api.repowise.dev/badge/wiki/tuckcode/rhizome-agent.svg)](https://repowise.dev/repo/tuckcode/rhizome-agent)
[![Code health](https://api.repowise.dev/badge/health/tuckcode/rhizome-agent.svg)](https://repowise.dev/repo/tuckcode/rhizome-agent)

A coding harness that doesn't forget. Rhizome runs its own agent loop on any model, free ones included, and keeps what matters as plain Markdown in a vault you own.

This is a developer preview. There is no signed download. Chat runs on Rhizome's own engine, the only chat engine. Prime and Hermes are no longer chat engines ([ADR-0189](docs/adr/0189-no-ties-to-outside-harnesses.md)); leftover code is still in the repo until the follow-up PRs. You read and diff notes in the app. The native engine can read, search, and edit vault files. It cannot search old Mycelium sessions.

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

`./install.sh` installs this repo and may fetch Prime Agent when that program is not already on the machine. Chat runs on Rhizome's own engine (ADR-0187). Chat does not use Prime. That install step comes out with the leftover engine code.

The full list of tools, the first minute in the app, and what to do when it fails: [Getting started](docs/start/README.md).

`prime-agent` stops when that terminal closes. To leave it running for CLI use outside Rhizome:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

Quit the installed Rhizome app before `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, and a second launch attaches to the one already open. A current install may still be named `Rhizome Agent.app`; a new build uses `Rhizome.app`. The executable inside stays `RhizomeAgent`.

To look at the interface without a live engine: `pnpm dev`, then http://localhost:5202.

### First minute

1. The first launch may ask **Help improve Rhizome**. You can decline. Telemetry stays off until you accept, and a build without a Sentry or PostHog key sends nothing. Graphite is the default theme. Dark is Graphite, Light is Earth light, and System follows the OS between those two. Earth dark, Loam, and Mycelium are color skins.
2. Chat opens on Rhizome's own engine. There is no Prime setup screen. The sessions list opens with it on a first launch. The left rail holds sessions, Views (Research, Graph, Mycelium, History), and Settings. Changes sits next to Notes. Views use Ctrl+Cmd+1–4 on Mac and Ctrl+Shift+1–4 on Windows.
3. Create a local vault, or open a folder you already have.
4. Send one message. You should get an answer, a notice if a non-fatal error occurred, or a clear failure (no provider key, for example). Add a key or Taproot in Settings → AI Agents → Connected.
5. Show Notes (View menu, or Cmd+2). Save a note, quit, and reopen the same file.

Notes live in the vault folder you opened. Native chat logs live in the app config folder (`com.rhizome.app/native-sessions`).

Provider keys live in the system keychain. Do not edit a JSON key file.

If something fails, the longer recovery page is [`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md). Ports and tests are in [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

https://github.com/user-attachments/assets/c373461f-1dd7-438b-ac89-0f98856be89e

## Hand this to an agent

The copy-paste block, and a one-line version, live on their own page: [Agent instructions](docs/for-agents/README.md).

The full rules for an agent that edits this tree are in [AGENTS.md](AGENTS.md).

Rhizome owns the chat loop (ADR-0187). Rhizome reaches the vault through MCP when a vault is attached. The native engine can read, search, edit, and create notes in the open vault, and can run a Power User shell command after approval.

| | |
|---|---|
| Product | Rhizome |
| Bundle id | `ai.rhizome.agent` |
| Package | `rhizome-agent` |
| Chat | Rhizome's engine only (ADR-0187) |
| Notes | Plain Markdown, in a local vault you open |

Names and remotes: [`docs/IDENTITY.md`](docs/IDENTITY.md).

## Contributing

A small pull request is enough. Open an issue if you are not sure the change is wanted. Details: [CONTRIBUTING.md](CONTRIBUTING.md).
Security reports: [SECURITY.md](SECURITY.md). Do not file a vulnerability as a public issue.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).

Thanks to [Tolaria](https://github.com/refactoringhq/tolaria) (AGPL-3.0), whose editor code Rhizome adapted.
The Mycelium view embeds Mindwalk (MIT) © 2026 Ricko Yu.
