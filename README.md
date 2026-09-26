# Rhizome Agent

![Rhizome Agent — Your work. Your memory.](src/assets/brand/rhizome-organic-hero.png)

[Watch the 20 second demo](docs/assets/rhizome-agent-demo.mp4)

**A harness that doesn't forget.**
Built around [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent), with useful tools from Claude Code, Hermes Agent, and DeepSeek. The built-in vault is your memory, wiki, and second brain, beside a research panel. What you save stays as plain Markdown on your disk, where you and the agent can both read it.

This is a developer preview. Prime Agent and Node are not bundled. There is no signed download.

## Get started

This is a macOS developer preview. There is no signed download. Prime Agent and Node are not bundled.

You need:

1. macOS, with Xcode Command Line Tools.
2. Node.js `^20.19.0` or `>=22.12.0`.
3. pnpm.
4. Rust `1.77.2` or newer, and the Tauri toolchain.
5. git.

```bash
npm i -g prime-agent
prime-agent
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
pnpm install
pnpm tauri dev
```

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

## Hand this to an agent

Agent instructions for this repo are in [AGENTS.md](AGENTS.md). A new agent should read that file before editing.

Paste this:

```text
This is Rhizome Agent, repo tuckcode/rhizome-agent, bundle id ai.rhizome.agent.
It is not Rhizome Desktop. Do not add knispo/rhizome as a remote.
Read AGENTS.md before you change code. English only.
The vault is plain Markdown on disk. You and the person can both read it.
```

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
