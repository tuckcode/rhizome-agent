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

```bash
pnpm install
# Rust/Tauri toolchain same as desktop
pnpm tauri dev
```

Requires a normal Tauri/macOS dev environment. Prime Agent CLI is expected on the machine for harness integration work (`prime-agent`); it is not vendored in this repo yet.

## License

AGPL-3.0-or-later (inherited from the desktop snapshot). Confirm before any public release under `tuckcode`.
