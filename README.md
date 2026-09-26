# Rhizome Agent

![Rhizome Agent — Your work. Your memory.](src/assets/brand/rhizome-organic-hero.png)

[Watch the 20 second demo](docs/assets/rhizome-agent-demo.mp4)

**A harness that doesn't forget.**
Built around [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent), with useful tools from Claude Code, Hermes Agent, and DeepSeek. The built-in vault is your memory, wiki, and second brain, beside a research panel. What you save stays as plain Markdown on your disk, where you and the agent can both read it.

This is a developer preview. Prime Agent and Node are not bundled. There is no signed download.

## Run it

You need macOS, Node `^20.19.0` or `>=22.12.0`, pnpm, Rust, and the Tauri toolchain.

```bash
npm i -g prime-agent && prime-agent
git clone https://github.com/tuckcode/rhizome-agent && cd rhizome-agent
pnpm install && pnpm tauri dev
```

Quit `/Applications/Rhizome Agent.app` first if it is open. The installed app and this dev build share the bundle id `ai.rhizome.agent`.

Browser UI without a live Prime session: `pnpm dev`, then http://localhost:5202.

Setup, scope, and recovery: [`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md).
Ports and tests: [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

## What it is

| | |
|---|---|
| Product | Rhizome Agent |
| Bundle id | `ai.rhizome.agent` |
| Package | `rhizome-agent` |
| Harness | Prime Agent |
| Notes | Plain Markdown, in a local vault you open |

Prime Agent runs the chat: session, tools, skills, and provider login. Rhizome reaches your vault through MCP when you attach one.

Names and remotes: [`docs/IDENTITY.md`](docs/IDENTITY.md).
Brand artwork: [Rhizome visual identity](docs/design/brand/2026-09-13/README.md).

## Contributing

A small pull request is enough. Open an issue if you are not sure the change is wanted. Details: [CONTRIBUTING.md](CONTRIBUTING.md).
Security reports: [SECURITY.md](SECURITY.md). Do not file a vulnerability as a public issue.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).

Rhizome Agent is a modified version of
[Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi (AGPL-3.0).
The Mycelium view embeds Mindwalk (MIT) © 2026 Ricko Yu.
