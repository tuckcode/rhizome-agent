---
type: ADR
id: "0030"
title: "Rust commands/ module split by domain"
status: active
date: 2026-03-30
---

## Context

`src-tauri/src/commands.rs` grew to 937 lines as Tauri command handlers accumulated for vault CRUD, git/GitHub sync, AI, system, and window operations. All commands shared a single file with no domain separation, making it hard to navigate, review, and extend. The file was a CodeScene hotspot dragging down overall code health.

## Decision

**Replace `commands.rs` with a `commands/` module split by domain: `vault.rs`, `git.rs`, `github.rs`, `ai.rs`, `system.rs`, and `mod.rs` (shared utilities + re-exports).** Each file owns the Tauri command handlers for its domain and the `#[cfg(desktop)]` / `#[cfg(mobile)]` stubs for platform-conditional availability. `mod.rs` is kept thin (≤100 lines) with no command logic — only re-exports and shared helpers (`expand_tilde`, `parse_build_label`).

## Options considered

- **Option A** (chosen): Domain-based module split — mirrors the TypeScript `hooks/commands/` pattern (ADR-0029). Each file is independently reviewable and scores well on code health. Downside: more files to navigate.
- **Option B**: Split by platform (`desktop.rs`, `mobile.rs`) — aligns with `#[cfg(...)]` guards but mixes domain concerns. Harder to find a specific command.
- **Option C**: Keep monolith but add section comments — zero file-count cost, but doesn't solve complexity or reviewability.

## Consequences

- `github.rs` separates GitHub OAuth/API commands from git sync commands (`git.rs`), matching the underlying Rust module split (`github/` vs `git/`).
- Platform stubs (`#[cfg(mobile)]` error returns) live alongside the desktop implementation in the same domain file.
- `mod.rs` re-exports all command functions so `lib.rs` `invoke_handler!` registration is unchanged.
- New Tauri commands go into the appropriate domain file; if no domain fits, create a new one rather than putting it in `mod.rs`.
- Re-evaluation trigger: if a single domain file (e.g. `vault.rs`) itself grows beyond ~300 lines and becomes a hotspot.
