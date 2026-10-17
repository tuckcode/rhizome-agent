# Contributing

Thanks for your interest in Rhizome. A small, focused pull request is the most useful kind.

## Before you start

- Open an [issue](https://github.com/tuckcode/rhizome-agent/issues) if you are not sure the change is wanted.
- Security problems: [SECURITY.md](SECURITY.md) (private reporting only; not a public issue).
- Agent and maintainer workflow details: [AGENTS.md](AGENTS.md).

## License and sign-off

This project is licensed under [AGPL-3.0-or-later](LICENSE).

By contributing, you agree that your contributions are licensed under the same terms (**inbound = outbound**). There is **no Contributor License Agreement (CLA)**.

Each commit must include a [Developer Certificate of Origin (DCO)](https://developercertificate.org/) sign-off. Add it with:

```bash
git commit -s -m "your message"
```

That adds a `Signed-off-by:` trailer with your name and email. Use the same identity you want attributed in git history.

## Development setup

From the repository root:

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh    # or: pnpm install
```

Prerequisites and platform notes (Node, pnpm, Rust, Linux WebKit packages): [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

Quick paths:

```bash
pnpm dev              # browser UI at http://localhost:5202 (mock Tauri)
pnpm tauri dev        # full desktop app (requires Rust)
```

## Build and test

Commands below match [package.json](package.json), [src-tauri/Cargo.toml](src-tauri/Cargo.toml), and [CI](.github/workflows/ci.yml).

### Frontend

```bash
pnpm lint
pnpm typecheck
pnpm build              # tsc -b && vite build
pnpm test               # Vitest unit tests
pnpm test:coverage      # coverage gate (≥70%)
pnpm test:mcp           # mcp-server node:test suite
```

### Rust (Tauri backend)

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path=src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean \
  --ignore-filename-regex 'lib\.rs|main\.rs|menu\.rs' --fail-under-lines 85
```

(`cargo llvm-cov` needs the `llvm-tools-preview` component; see AGENTS.md.)

### End-to-end

```bash
pnpm playwright:smoke       # curated core smoke lane
pnpm playwright:regression  # full Playwright regression under tests/smoke/
```

## Git hooks

`pnpm install` runs Husky and installs hooks from `.husky/`. See [.github/HOOKS.md](.github/HOOKS.md).

- **Pre-commit** runs lint and frontend tests on staged TypeScript (and related checks documented there).
- **Pre-push** runs the full release-style gate suite (build, frontend coverage, Rust quality when `src-tauri/` changed, Playwright smoke). Never use `--no-verify`.

Maintainers who work directly on `main` rely on these hooks before pushing to `origin/main`. **Contributors should open a pull request**; GitHub Actions runs the same broad checks on PRs to `main`.

## Branches and pull requests

1. Branch from `main` (for example `cursor/my-change-fdb3` or your own naming scheme).
2. Keep commits focused; sign off each commit with `-s`.
3. Open a pull request against `main`. Fill in the PR template.
4. Link related issues when they exist.
5. Wait for CI. Fix failures before merge.

Code style: match surrounding code. Agents editing this tree also follow [AGENTS.md](AGENTS.md) (tests, commit messages, no secrets in the tree).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
