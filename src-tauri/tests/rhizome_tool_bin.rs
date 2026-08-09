//! End-to-end tests for the `rhizome-tool` sidecar binary (ADR-0152, MCP
//! bridge Phase 2). Exercises the real compiled process via argv, not the
//! `rhizome_api` functions directly — proves the CLI wiring itself works.
//!
//! `search` isn't covered here: `rhizome_api::search_standalone` always
//! builds a real `FastEmbedTextEmbedder`, which downloads a model on first
//! use — unsuitable for a deterministic, network-free test gate. Coverage
//! for the search path lives in `rhizome_api`'s own tests (fake embedder).

use std::path::Path;
use std::process::Command;
use tempfile::TempDir;

fn rhizome_tool_bin() -> &'static str {
    env!("CARGO_BIN_EXE_rhizome-tool")
}

fn run(args: &[&str]) -> std::process::Output {
    Command::new(rhizome_tool_bin())
        .args(args)
        .output()
        .expect("failed to spawn rhizome-tool")
}

#[test]
fn unknown_subcommand_exits_nonzero_with_stderr_message() {
    let dir = TempDir::new().unwrap();
    let output = run(&["frobnicate", dir.path().to_str().unwrap()]);

    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("unknown subcommand"), "stderr: {stderr}");
}

#[test]
fn missing_subcommand_exits_nonzero() {
    let output = run(&[]);
    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("missing subcommand"), "stderr: {stderr}");
}

#[test]
fn search_rejects_bad_argv_before_touching_the_vault() {
    let dir = TempDir::new().unwrap();
    let output = run(&["search", dir.path().to_str().unwrap()]);

    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("usage"), "stderr: {stderr}");
}

/// The distill verb seeds an empty destination vault before doing its real
/// work (`rhizome_api::distill`'s `seed_vault_if_empty`), and the CLI wiring
/// must reach that call. The downstream agent invocation itself is expected
/// to fail in this test environment (no CLI installed) — that's fine, the
/// point is proving argv → `rhizome_api::distill` → seed happens through the
/// real binary, not just the library function.
#[test]
fn distill_through_the_real_binary_seeds_an_empty_vault() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path();

    let _ = run(&[
        "distill",
        vault.to_str().unwrap(),
        "--text",
        "some text about rhizome",
    ]);

    assert!(seeded(vault));
}

fn seeded(vault: &Path) -> bool {
    vault.join("RHIZOME_VAULT.md").is_file()
}
