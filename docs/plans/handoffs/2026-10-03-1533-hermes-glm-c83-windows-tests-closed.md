---
session: 2026-10-03T11:00–15:35 -05:00
model: Hermes Agent · GLM
description: >-
  C83 closed out: all 24 Windows Rust test failures fixed (1770 pass / 0
  fail), all 13 clippy all-targets warnings resolved with cfg gates, fmt
  clean, frontend gates green. Two real Windows bugs found and fixed in the
  sweep (classify_repo_reference absolute paths, relative_to_vault
  separators). Not committed yet at write time; commit follows this file.
---

# 2026-10-03 · C83 Windows test suite closed out

Surface: Hermes desktop, Windows 11. Picked up Claude Opus 5.5's 10 unpushed
commits and the C83 remainder.

## What was fixed

**24 test failures → 0.** Root causes and fixes:

| Cause | Files | Fix |
|---|---|---|
| Tilde assertions expect `/` | `commands/mod.rs`, `commands/ai.rs` | Compare as `Path`, not string |
| Discovery fixtures extensionless | `antigravity_discovery.rs`, `pi_discovery.rs`, `opencode_discovery.rs`, `codex_cli.rs`, `mcp/runtime.rs` | Write `.cmd`/`.exe` on Windows (`if cfg!(windows)`) |
| Tests spawn `sh` | `rhizome_commands.rs` ×3 | `node -e` instead (crate already requires node) |
| CRLF from git checkout | `git/mod.rs` (`setup_git_repo`, `setup_remote_pair` both clones), `commands/git.rs` (`create_initialized_vault`) | Pin `core.autocrlf=false` in the test repo config |
| `:` PATH-join expectation | `git/mod.rs` | Expectation built with `std::env::split_paths`/`join_paths`, mirroring `path_with_git_parent` exactly |
| Separator `ends_with` | `vault/rename.rs` ×2, `commands/vault/rename_cmds.rs`, `git/status.rs` | Normalize `\` → `/` before the assertion |

**13 clippy all-targets warnings → 0.** All were Unix-only test helpers (or
their imports) that Windows compiles but never uses. Fixed with
`#[cfg(unix)]` on the helpers and the imports — no `#[allow(...)]`, per
AGENTS.md. One subtlety: gating a helper cascades — its imports become dead
too. Three rounds to converge: helper gates, then `AiAgentPermissionMode`
imports, then the `use super::*` globs in the fully-Unix modules
(`antigravity_cli`, `opencode_cli`, `pi_cli`, `secure_fs`,
`ai_agent_processes`, `commands/clipboard`).

`prime_session_host::enter_isolated_live_test`: every caller is a
`#[cfg(unix)]` `#[ignore]`d live test, so the helper is `#[cfg(unix)]` now
too. A first attempt used `#[allow(dead_code)]` — removed, that pattern is
banned here.

## Two real product bugs (found while fixing tests)

1. `rhizome_repo_research.rs::classify_repo_reference` — a Windows absolute
   path (`C:\code\repo`) fell through the `/`-prefix check into the
   owner/repo parse and errored "Cannot interpret ... as a local directory".
   Fix: `Path::new(repo).is_absolute()` added to the local-path branch
   (covers drives and UNC).
2. `rhizome_write_location.rs::relative_to_vault` — on Windows the
   `artifact_path` field in `events.jsonl` was written with `\` separators.
   That file is cross-platform data. Fix: join components with `/` always.

## Verification (all on this Windows machine)

- `cargo test --lib`: **1770 passed, 0 failed**, 14 ignored.
- `cargo clippy --all-targets`: **0 warnings**, exit 0.
- `cargo clippy -- -D warnings` (push-gate lib lane): clean.
- `cargo fmt --check`: clean.
- `pnpm lint`: clean. `pnpm typecheck` (`tsc -b`): clean.
- `pnpm test`: **6903 passed**, 1 skipped.
- `pnpm test:mcp`: 93 pass / 0 fail (6 skip: Windows symlink/RHIZOME_TOOL_PATH).

## Tree state

Committed this session: none yet at write time — commit follows this file,
staged by name:

- Rust fixes: the 19 files listed in the table above plus
  `prime_session_host.rs`, `rhizome_repo_research.rs`,
  `rhizome_write_location.rs`, `claude_cli.rs`, `hermes_cli.rs`,
  `secure_fs.rs`, `ai_agent_processes.rs`, `commands/clipboard.rs`.
- Docs: `docs/HANDOFF.md` (C83 → FIXED-SOURCE), this handoff file.

Pre-existing dirt left alone: `AGENTS.md`, `README.md`,
`docs/plans/2026-09-27-cursor-swarm-plan.md` (modified at session start),
`demo-vault-v2/AGENTS.md` (app-written during boot), untracked
`DOpus-Noir-Themes.zip`, `docs/CHOPPING-BLOCK.md`, `docs/harness-field-guide*`,
`.hermes/`, one old handoff file.

## Next moves

1. Commit (staged by exact name, `git commit -- <paths>`, Co-Authored-By
   trailer). Push when ready — C81 (Playwright install hang) still affects
   the pre-push browser lane; C82's fix covers the pnpm spawn.
2. macOS side must still pass its own lane; these fixes are test-side and
   platform-neutral except the two product fixes (both safe cross-platform).
3. C85 end-to-end sign-in on a real account is still untested.
4. The ~5s stalls (once a minute, recovers) from the Claude handoff remain
   undiagnosed.
