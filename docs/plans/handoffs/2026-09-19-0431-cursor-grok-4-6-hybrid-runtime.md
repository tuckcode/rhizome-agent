---
session: 2026-09-19T04:31-05:00
model: Grok 4.6 (Cursor)
description: >-
  Hybrid runtime without a second engine: rhizome-vault skill now bakes
  find_node(), a GUI-safe PATH, and Hermes/Pi short-reply manners. Live
  SKILL.md reseeded and mode 444. No commit, push, or rebuild.
commits: none
---

# Hybrid Chat runtime — skill metabolites

**Origin:** Cursor Grok 4.6 · 2026-09-19 04:31 · source + live skill.

Prime stays the only execution core (ADR-0168 / C50). Hermes and DSH
are not wired in. Thinking defaults are still Prime's settings file.

## What changed

- `src-tauri/src/prime_vault_skill.rs` — skill examples use `find_node()`
  plus `PATH=$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH`.
  New "How to work in this chat" block: answer first, CLI not IPython,
  stdout is text, stop after one environment error, do not open
  `agents/claude/vault-context.md`.
- `src-tauri/src/mcp/runtime.rs` — `~/.local/bin/node` is a `find_node`
  home candidate.
- Live vault skill
  `/Users/dtc/Documents/Rhizome Vault/.prime/agent/skills/rhizome-vault/SKILL.md`
  reseeded from this source. Mode **444** so the packaged app's old seed
  cannot overwrite it on `ensure_host_for_cwd`. After a rebuild:
  `chmod u+w` that file.

This machine's skill currently points `node` at
`/Users/dtc/.local/bin/node` and `cli-call.mjs` at the repo resource
copy (the cargo test seeder, not `/Applications`). Graph sidecar is
still the packaged `rhizome-tool`.

## What did not change

- Pane-preset source is still uncommitted; do not mix it into this.
- No commit, push, or `/Applications` rebuild.
- No junk-distill / wikilink-in-code follow-up.
- Import `jsonl` still waits for Atticus `1`.
- Localization: none — English only (C18).
- PostHog: no event; this is agent operating text, not a new user
  control.

## QA

- `cargo test --lib prime_vault_skill` and `home_binary_candidates`.
- `cargo clippy -- -D warnings`.
- Live `SKILL.md` contains "Answer in the chat first" and the resolved
  node path. Native Chat turn not re-probed this slice.
