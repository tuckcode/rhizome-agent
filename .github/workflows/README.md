# GitHub Actions — Rhizome Agent

**Origin:** Rewritten 2026-09-01 (Cursor) — replaces Italian bootstrap copy from
Rhizome Desktop (`11e1315`, 2026-08-09). Align with the workflow YAML files
here, not `AGENTS.md` alone; local **pre-push** hooks are the primary gate on
`main`.

English only (C18). This repo is **private**; several workflows are
**manual-only** until billing or GitHub Pages access changes.

---

## Workflow files

| File | Purpose | Trigger (today) |
|---|---|---|
| [`ci.yml`](ci.yml) | PR verification: lint, build, tests, coverage | `pull_request` → `main`, `workflow_dispatch` |
| [`release.yml`](release.yml) | Alpha release build + GitHub Release | `workflow_dispatch` only |
| [`release-stable.yml`](release-stable.yml) | Stable release | `workflow_dispatch` only |
| [`release-build-artifacts.yml`](release-build-artifacts.yml) | Shared macOS artifact build (called by release workflows) | `workflow_call` |
| [`deploy-docs.yml`](deploy-docs.yml) | VitePress docs site → GitHub Pages | `workflow_dispatch` only (private repo) |
| [`auto-update-prs.yml`](auto-update-prs.yml) | Rebase open PRs onto latest `main` | `workflow_dispatch` only |

**Not automatic on push to `main`:** `ci.yml`, release workflows, and
`auto-update-prs.yml` intentionally omit `push:` triggers. Local **pre-push**
(`.husky/pre-push`) runs the full check suite before `git push` succeeds.
Re-enable cloud CI on every push only when billing and duplicate-run cost are
acceptable — see comments in each YAML.

---

## `ci.yml` jobs

| Job | Runner | What it checks |
|---|---|---|
| **Frontend Static Quality Checks** | `macos-15` | `tsc --noEmit`, `vite build`, optional `pnpm docs:build`, docs reminder (warning only), `pnpm lint` |
| **Frontend Tests & Coverage** | `macos-15` | `pnpm test:coverage` — **≥70%** lines/functions/branches/statements (`vite.config.ts`) |
| **Rust Tests & Quality Checks** | `macos-15` | `cargo llvm-cov` **≥85%** lines (ignores `lib.rs`, `main.rs`, `menu.rs`), `cargo clippy -D warnings`, `cargo fmt --check` |
| **Linux build verification** | `ubuntu-22.04` | PR / manual only — `pnpm build`, `cargo check`, `cargo clippy` |

**CodeScene:** not used. Dropped 2026-07-09 (ADR-0149); no gate on private repo.

**Documentation check:** warning only — does not fail CI. If `src/` or
`src-tauri/` changed without `docs/`, CI prints a reminder. Suppress with
`[skip docs]` in the commit message when the change does not affect documented
architecture.

**Codecov:** uploads `coverage/lcov.info` and `coverage/rust.lcov` via OIDC
(no `CODECOV_TOKEN`). Fork PRs skip upload. Upload failure does not fail CI
(`fail_ci_if_error: false`).

---

## Release workflows

Alpha and stable releases are **cut manually** from the Actions tab until
auto-release on every `main` push is re-enabled.

Release builds run on **`macos-15`**, produce Apple Silicon (aarch64) bundles,
and may upload DMG artifacts when configured. See comments in
`release-build-artifacts.yml` for cache keys and Node heap sizing.

### Secrets for release builds

Telemetry (without these, toggles in Settings exist but PostHog/Sentry may not
initialize in shipped builds):

```
VITE_SENTRY_DSN=
SENTRY_DSN=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Windows Authenticode (optional — Windows installers publish unsigned with a
warning if missing):

```
WINDOWS_CODE_SIGNING_CERTIFICATE=
WINDOWS_CODE_SIGNING_CERTIFICATE_PASSWORD=
WINDOWS_CODE_SIGNING_CERTIFICATE_THUMBPRINT=   # optional
WINDOWS_CODE_SIGNING_TIMESTAMP_URL=            # optional
```

---

## Local checks (match CI + pre-push)

Primary gate before push:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage
pnpm test:mcp
cargo test
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean \
  --ignore-filename-regex 'lib\.rs|main\.rs|menu\.rs' --fail-under-lines 85
cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
```

Playwright smoke and sidecar lanes may run via pre-push — see `.husky/pre-push`
and `AGENTS.md` § Check suite.

Manual cloud verification when you want a clean-room run:

**Actions → CI → Run workflow**

---

## Deploy docs

`deploy-docs.yml` builds `pnpm docs:build` and publishes to GitHub Pages.
**Manual only** while the repo is private (Pages needs Pro+ or a public repo).
Re-add a `push:` trigger when Pages is enabled.

---

## Why this file went stale

Copied verbatim at repo bootstrap from Rhizome Desktop (`11e1315`). Agent audits
since then focused on `AGENTS.md` and product docs, not `.github/workflows/`.
No hook validates workflow README language or accuracy against YAML. If you
change triggers or jobs, update this file in the same commit.
