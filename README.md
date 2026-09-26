# Rhizome Agent

![Rhizome Agent — Your work. Your memory.](src/assets/brand/rhizome-organic-hero.png)

**Not [Rhizome Desktop](https://github.com/knispo/rhizome).** Separate private app.

Desktop chat shell whose **harness** is [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) (session, tools, skills, OAuth providers, compaction / RLM). Rhizome’s vault capabilities show up through MCP when you attach a vault — the product center of gravity is **chat + agent harness**, not the full desktop wiki UI.

| | |
|---|---|
| Bundle id | `ai.rhizome.agent` |
| Product name | Rhizome Agent |
| Package | `rhizome-agent` |
| Baseline | Snapshot of Rhizome desktop source, then diverged |

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
from the Rhizome Desktop snapshot this repo started from. The check in
[`docs/PUBLIC-PREVIEW.md`](docs/PUBLIC-PREVIEW.md) is an inventory, not a
legal determination.
