---
session: 2026-09-14T11:28-05:00
model: Composer
description: >-
  Codacy CLI gate on W7 paths (4416411). OpenGrep 2 Medium in test-only unsafe;
  Trivy CRITICAL 0 repo-wide. No Critical/High introduced by W7.
---

# W7 Codacy gate — 2026-09-14 11:28

**Origin:** Composer · W7 commit `4416411` · paths from last night's HOME/MCP hardening

## CLI status

`codacy-cli` **installed** at `/opt/homebrew/bin/codacy-cli`. Both commands ran locally (no account, no payment).

First `trivy` invocation failed on a corrupted CLI tarball download; immediate retry succeeded.

## OpenGrep — W7 paths

```bash
codacy-cli analyze --tool opengrep \
  mcp-server/vault-path.js \
  mcp-server/cli-call.mjs \
  src/lib/sensitiveTextRedaction.ts \
  src-tauri/src/prime_vault_skill.rs \
  src-tauri/src/vault_list.rs
```

| Metric | Result |
|---|---|
| Files | 5 |
| Rules run | 92 |
| Findings | **2** |

Both findings: `rust.lang.security.unsafe-usage.unsafe-usage` in `src-tauri/src/prime_vault_skill.rs` lines 634 and 636 — test-only `std::env::set_var` / `remove_var` inside `seed_honors_rhizome_tool_path_env_when_file_exists`, already marked `// SAFETY: test-only`.

Clean on the other four W7 files: `vault-path.js`, `cli-call.mjs`, `sensitiveTextRedaction.ts`, `vault_list.rs`.

**Severity:** Medium (audit). **Not Critical/High.**

## Trivy — whole repo

```bash
codacy-cli analyze --tool trivy
```

| Target | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| `pnpm-lock.yaml` | 0 | 7 | 10 | 2 |
| `src-tauri/Cargo.lock` | 0 | 0 | 1 | 3 |
| worktree lockfiles (×6) | 0 | (same pattern) | — | — |

Representative pre-existing HIGH advisories in main lockfiles: `fast-uri` (SSRF), `js-yaml` (DoS), `@tiptap/core` (ReDoS). W7 did not touch lockfiles or add dependencies.

**CRITICAL: 0** everywhere. No new Critical/High introduced by W7.

## Verdict

**No Critical or High findings introduced by W7.** Two Medium OpenGrep hits are expected test-only `unsafe` for env mutation; not silenced.

## If CLI missing (reference)

```bash
brew install codacy/codacy-cli-v2/codacy-cli-v2
codacy-cli init && codacy-cli install
```
