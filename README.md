# Rhizome Agent

![Rhizome Agent — Your work. Your memory.](docs/assets/rhizome-hero-animated.webp)

**A macOS chat app for [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) that remembers your work in a plain-markdown vault you own.**
Bring your own model. Chat, open notes beside the conversation, and keep what matters as notes on disk.

<!-- Demo GIF goes here: record the packaged app (Cmd+Shift+5), then
     ![Rhizome Agent demo](docs/assets/readme-demo.gif) -->

## Install (developer preview, macOS)

```bash
npm i -g prime-agent && prime-agent          # install Prime and log in once
git clone https://github.com/tuckcode/rhizome-agent && cd rhizome-agent && pnpm install && pnpm tauri dev
```

Needs Node ^20.19.0 or >=22.12.0, pnpm, and the Rust/Tauri toolchain.
Details: [`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md).

| | |
|---|---|
| Bundle id | `ai.rhizome.agent` |
| Product name | Rhizome Agent |
| Package | `rhizome-agent` |
| Baseline | Snapshot of Rhizome desktop source, then diverged |

Not [Rhizome Desktop](https://github.com/knispo/rhizome), a separate app.
The agent **harness** is Prime Agent (session, tools, skills, OAuth
providers, compaction / RLM). Rhizome’s vault tools reach it through MCP
when you attach a vault.

## Identity

Read [`docs/IDENTITY.md`](docs/IDENTITY.md) before changing names, bundle ids, or remotes.

Brand artwork and the dither/ASCII variants: [Rhizome visual identity](docs/design/brand/2026-09-13/README.md).

## Setup

This is a **macOS developer preview**, not a self-contained public install.
Prime Agent and Node are prerequisites. They are not bundled.

Stranger / first-run path, supported scope, recovery, permissions,
telemetry, and the license inventory:
[`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md).

Developer path (ports, tests, landmines):
[`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

```bash
# Node ^20.19.0 or >=22.12.0 — Vite 7 rejects Node 18
pnpm install
# Rust/Tauri toolchain. Quit /Applications/Rhizome Agent.app first (C65).
pnpm tauri dev
```

Browser mock (no live Prime): `pnpm dev` then http://localhost:5202.
Requires a normal Tauri/macOS environment. Install Prime separately:
`npm i -g prime-agent`.

Parked ideas:
[`docs/plans/2026-09-20-public-readiness-inventory.md`](docs/plans/2026-09-20-public-readiness-inventory.md).
A roadmap row is not implementation approval. Do not merge
[PR #66](https://github.com/tuckcode/rhizome-agent/pull/66).

## Contributing

If you like the app, contributions are welcome. A small pull request is enough. Open an issue if you are not sure the change is wanted. Details: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE). Atticus confirmed this on
2026-09-26 as the license for the public `tuckcode` release. It is inherited
from the Rhizome Desktop snapshot this repo started from.

Rhizome Agent is a modified version of Rhizome Desktop, which builds on
[Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi (AGPL-3.0).
The Mycelium view embeds Mindwalk (MIT) © 2026 Ricko Yu. The check in
[`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md) is an inventory, not a
legal determination.
