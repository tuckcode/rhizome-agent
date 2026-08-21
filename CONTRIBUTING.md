# Contributing to Rhizome

Rhizome is a **public AGPL-3.0** project in **alpha**. Outside contributions are welcome; the bar is intentional quality, not bureaucracy.

## Before you open a PR

1. Read [AGENTS.md](AGENTS.md) for TDD, coverage gates, and commit style.
2. Run the local gates you touch:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   # if you change Rust:
   cargo test --manifest-path src-tauri/Cargo.toml
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   ```
3. Keep PRs focused. Prefer small, reviewable diffs over mega-refactors.

## Issues

- Bugs and feature ideas: open a GitHub issue with repro steps when possible.
- **Security**: do **not** open a public issue for exploits — use [SECURITY.md](SECURITY.md).

## What "alpha" means

- **Source is public** — clone, build, fork.
- **Signed installers** (Apple/Windows code-signing) may lag; build from source is the supported path until a release channel is polished.
- APIs and vault-layout details can still move; see [`docs/VAULT_CONTRACT.md`](docs/VAULT_CONTRACT.md) and ADRs under [`docs/adr/`](docs/adr/).

## Related repo

- [`knispo/rhizome-cli`](https://github.com/knispo/rhizome-cli) — older public Python CLI toolkit. This desktop app is the intended successor for most users.

## Code of conduct

Be kind. No harassment. Assume good faith. Maintainers may close bad-faith PRs without debate.
