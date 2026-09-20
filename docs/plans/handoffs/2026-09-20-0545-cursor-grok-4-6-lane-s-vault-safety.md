---
session: 2026-09-20T05:45-05:00
model: Grok 4.6 (Cursor)
description: >-
  Lane S vault safety and publication review. JS now refuses ~ and ~/.
  Live #46 Chat-without-vault still NOT RUN. No commit.
commits: none
---

# Lane S handoff — vault safety and publication review

**Origin:** Cursor Grok 4.6 · 2026-09-20 05:45 · Lane S
**Worktree:** `/Users/dtc/code/projects/rhizome-agent/.worktrees/lane-s`
**Branch:** `cursor/lane-s-vault-safety`
**Issue:** [#46](https://github.com/tuckcode/rhizome-agent/issues/46) stays **OPEN**.

Did not commit. Did not push. Did not rebuild. Did not merge #66.
Did not change `normalize_cwd("")`. Did not run coverage or Playwright.

## 1. Baseline revision and dirty snapshot

- Requested baseline: `4f9b4c4` (`feat: make the command rail sessions-only`).
- Worktree HEAD: `4f9b4c433e9e4a2d87e7150a46a72de72cdaa82d`.
- Shared-tree `origin/main` at lane start: `dc44d84`.
- Shared-tree main at lane start had already moved to `bcd4b87`. This lane stayed on `4f9b4c4`.
- Dirty rail/reasoning snapshot: **not applied**. Coordinator owns C76 (`normalizeReasoningDisplay` + `AiMessage` tests). This lane did not touch those files.

## 2. Owned files and behavior changed

| Path | Change |
|---|---|
| `mcp-server/vault-path.js` | Expand a leading `~` / `~/` before HOME compare and before returning vault paths. `~` and `~/` now fail as HOME. Nested `~/Documents` still passes and returns the expanded path. |
| `mcp-server/test.js` | Same HOME/tilde lock inside the existing MCP suite. |
| `mcp-server/vault-path.test.js` | Same lock without the MCP SDK, so this worktree can run it. |
| `src-tauri/src/prime_vault_skill.rs` | Nested-under-HOME vault still looks like a vault. Seed keeps unrelated vault-local settings keys. |
| `src-tauri/src/vault_list.rs` | Nested `~/Documents/Synthetic Vault` is accepted. HOME / `~` / symlink-to-HOME stay refused. |

Unchanged on purpose:

- `normalize_cwd("")` still returns `$HOME`. That is Chat-without-vault, not MCP scope.
- Rust `looks_like_vault` / `is_home_directory` / `save_vault_list` / MCP bridge already refused HOME, trailing slash, symlink-to-HOME, and `~`.
- Connect still scrubs only a Rhizome-authored global `rhizome-vault` skill.

## 3. Reproduction, failing test, passing result

**Bug:** JS `isHomeVaultPath("~")` and `isHomeVaultPath("~/")` were false. `requireVaultPaths({ VAULT_PATH: "~" })` did not throw. Rust already refused those aliases.

**Red:** a direct node probe on the baseline module returned `isHome: false` for `~` and `~/`, and `require ~ : no throw`.

**Green:**

- `node --test mcp-server/vault-path.test.js` — 3/3 PASS
- `node --test mcp-server/vault.security.test.js` — 18/18 PASS
- Focused Rust: `prime_vault_skill` 25 passed / 1 ignored, plus vault-list HOME/nested, `normalize_cwd_falls_back_to_home_for_blank_paths`, and `command_skips_a_skill_symlink_that_points_at_itself` — all PASS

## 4. Tests and evidence

**Source**

- `node --test mcp-server/vault-path.test.js`
- `node --test mcp-server/vault.security.test.js`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib prime_vault_skill`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib save_refuses`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib save_accepts_a_nested`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib normalize_cwd_falls_back`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib command_skips_a_skill_symlink`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — PASS
- `pnpm test` — **NOT RUN**. This worktree has no `node_modules`. Schedule through C.
- `pnpm test:mcp` — **NOT RUN** for the same reason. `test.js` still imports the MCP SDK.

**Browser:** NOT RUN. No UI change.

**Native / live machine (read-only, no values published)**

| Check | Result |
|---|---|
| Chat without vault, one live turn | **NOT RUN** (Q owns the app slot) |
| Global `~/.prime/agent/skills/rhizome-vault` | Absent. Skills root is empty. |
| `~/.prime/agent/settings.json` | Present. Top keys: `defaultModel`, `defaultProvider`, `defaultThinkingLevel`, `onboardingShown`, `recentModels`, `telemetry`. No `mcpServers` block. No HOME `VAULT_PATH`. |
| `~/.config/com.rhizome.app/vaults.json` | 2 vaults, both nested-under-home. Active and default are nested-under-home. None are HOME aliases. |
| `~/.config/com.tolaria.app/vaults.json` | 4 vaults, all nested-under-home. |
| C58 `~/.pi/agent/skills/hyperframes` self-symlink | **Gone**. 40 other Pi skill symlinks resolve. 0 self-loops. 0 broken. Source skip still PASS. |

Synthetic fixtures only. Did not print vault paths, model names, or token values.

## 5. Remaining failures or unverified assumptions

- **#46 stays OPEN.** Source and this machine’s current Prime global files are clean. Live Chat-without-vault connect is still required before close.
- `$HOME` as a literal string is not expanded in JS or Rust. That matches `expand_tilde`.
- Windows HOME aliases remain untested (C42 / #32).
- Native vs JS redaction residual is still real: Rust Sentry leaves `ghr_`, `sk_live_`, and `sk_test_`. JS already redacts those. See `src-tauri/src/telemetry.rs` parked test.
- Tiptap High `GHSA-j95f-988m-3j2f` is still in `pnpm-lock.yaml` at `@tiptap/core` 3.19.0 and 3.22.5. `src/` still has no `@tiptap/core` import. Note ingest is still BlockNote/remark. Dated 13:10 reachability still holds. Do not blanket-bump.
- README still says “Confirm before any public release under `tuckcode`.” Lane I owns that confirmation.
- `SECURITY.md` asks for GitHub private vulnerability reporting. That channel needs a public-repo settings check by I/C before publication.

## 6. Commit / patch

No commit authorized.

Uncommitted delta vs `4f9b4c4`:

- `mcp-server/vault-path.js`
- `mcp-server/test.js`
- `mcp-server/vault-path.test.js` (untracked)
- `src-tauri/src/prime_vault_skill.rs`
- `src-tauri/src/vault_list.rs`

Patch copy: `/tmp/lane-s-security/lane-s.patch`.

## 7. Dependencies and next integration action

C should cherry-pick or apply this patch after A’s candidate lands. The files do not overlap C76.

Q should run the #46 live checklist on the integrated candidate:

1. Chat with no vault. Send one turn.
2. Confirm no Rhizome-generated global `rhizome-vault` skill returns.
3. Snapshot `~/.prime/agent/settings.json` first. Confirm it gains no `mcpServers.rhizome` with HOME `VAULT_PATH`.
4. Nested attached vault still works.

Do not close #46 from this source slice.

I should keep the README license-confirmation note and the private-report channel on the publication checklist.

## Publication review (P3)

**Secrets / history**

- `gitleaks detect` on 635 commits: 2 hits, both `src-tauri/src/telemetry.rs` lines 346–347.
- Category: synthetic Slack fixture prefixes (`xoxa-` / `xoxr-` style) inside a unit test. Not live credentials.
- Workdir `--no-git` added one `generic-api-key` in `src-tauri/target/debug/deps/*.rmeta` (build artifact). Ignore.
- **Rotation:** not required.
- **History rewrite:** not required. Do not run `git filter-repo` or rotate keys from this lane.

Prepared action if a later scan finds a real credential (do not run now):

1. Name the path, commit, and category only.
2. Ask Atticus to rotate the named provider credential.
3. After rotation, request an explicit history-rewrite approval with the exact path set and the replacement command.
4. Do not rewrite `main` without that approval.

**Trivy (live lockfiles, 2026-09-20)**

| Severity | What |
|---|---|
| High (vuln) | `@tiptap/core` 3.19.0 and 3.22.5 — `GHSA-j95f-988m-3j2f` only. Still not a first-party call. |
| High (secret scanner) | 4 Slack-token hits in `telemetry.rs` fixtures. False positive. |
| Medium | `@opentelemetry/core` 2.2.0/2.6.0, Tiptap `GHSA-cp6q-959q-f8rh`, `fflate` 0.4.8, `hono` 4.12.34 (3 CVEs), `qs` 6.15.2 (2 CVEs), `glib` 0.18.5 |
| Low | `body-parser`, `esbuild`, `lru`, `rand` |
| Cleared vs Sept 14 | `js-yaml` 3.15.2 and `fast-uri` 3.1.6 still absent from High/Medium |

September 14 deferral is not a clearance. Reachability recheck: no `src/` import of `@tiptap/core` or the named Markdown helpers. Keep Tiptap parked. Do not bump Hono / qs / fflate / otel / glib in this slice.

**Opengrep** on owned paths: 2 findings, both pre-existing test-only `unsafe` `set_var` / `remove_var` in `prime_vault_skill.rs` 828 and 830. Not a release blocker.

## Stop

- Do not close #46.
- Do not change `normalize_cwd("")`.
- Do not invent a Prime sandbox.
- Do not edit the live Prime global settings file to pass a check.
- Do not mass-delete `~/.prime/agent/skills/`.
- Do not execute rotation or history rewrite.
