---
session: 2026-09-19T01:48-05:00
model: Grok 4.6 (Cursor)
also: [GPT-5 (Codex)]
description: >-
  Finished the pane-preset source slice: leftover locks, Workbench preservation
  test, ADR-0173, and living docs. Full frontend and Rust gates green. No
  commit, push, or /Applications rebuild.
commits: none
---

# Pane presets — Cursor finish

**Origin:** Cursor Grok 4.6 · 2026-09-19 01:48 · source only.

Codex implementation:
[`2026-09-19-0130-codex-pane-presets-cursor-finish.md`](2026-09-19-0130-codex-pane-presets-cursor-finish.md).
Plan: [`docs/design/pane-presets.md`](../../design/pane-presets.md).
ADR: [`docs/adr/0173-pane-presets.md`](../../adr/0173-pane-presets.md).

## Done

- `useViewMode` loads vault-scope prefs as derived state. Persistence
  contract unchanged. Ref sync stays in an effect.
- Leftover locks now use Chat, Notes, Read, and Workbench. Old catalog
  aliases stay for search. Existing `en.json` view-command values match
  those names. No new locale keys.
- `ensureNotesOpen` keeps Workbench. Direct test added.
- Command handlers `onReadLayout` / `onResetLayout` were already in the
  catalog, dispatcher, and keyboard types.
- Living docs: `HANDOFF.md`, `ARCHITECTURE.md`, `GETTING-STARTED.md`,
  `YOU-SHOULD-KNOW.md`, `NEXT.md`.
- Packaged app is still `35f217f`. No native QA. No rebuild.

## Checks

- `pnpm lint` — pass
- `pnpm typecheck` — pass
- `pnpm test` — 768 files, 6652 tests, pass
- `pnpm test:coverage` — statements 85.22%, lines 88.48% (gate 70%)
- `pnpm test:mcp` — 90 pass
- `cargo test` — pass
- `cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings` — pass
- `cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check` — pass
- `cargo llvm-cov ... --fail-under-lines 85` — lines 85.37%
- `pnpm handoff:check` — pass
- Codacy opengrep on the five state modules — 0 findings

Localization: none — English only (C18).
PostHog: no new event. Codex already emits `pane_preset_changed` and
`pane_layout_reset`.
ADRs: `docs/adr/0173-pane-presets.md`. Did not edit ADR-0166.

## Constraints held

No commit. No push. No `/Applications` rebuild. No Tiptap/hono/qs bump.
Import still waits for `1`.
