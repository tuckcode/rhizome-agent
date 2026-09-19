---
session: 2026-09-19T01:30-05:00
model: GPT-5 (Codex)
description: >-
  Implemented the four pane presets, persisted per-preset widths, Chat width
  floors, responsive folding, View commands, and focused browser coverage.
  Cursor must finish the remaining stale locks, full coverage cleanup, ADR,
  and handoff index updates before any commit or push.
commits: none
---

# Pane presets — Cursor finish handoff

## Current result

The implementation is in the working tree. No commit, push, or installed-app
rebuild was made. The source plan is [`docs/design/pane-presets.md`](../../design/pane-presets.md).

The runtime now has four preset ids:

- `chat`: Chat plus the command rail. Notes is closed and the Show Notes strip remains.
- `notes`: Notes list open. Browse is closed.
- `read`: beside-note posture. New Read hides the Notes list. A migrated Read state may keep it open.
- `workbench`: Notes list and Browse open as separate columns.

The preset state lives in `src/lib/panePresets.ts`. Storage lives in
`src/lib/panePresetStorage.ts`. `useViewMode` mirrors the legacy
`view_mode` and `chatNoteSplit` contracts while the preset remains the runtime
source of truth. Storage is keyed by vault path and stores active preset plus
widths for each preset.

The shell uses these limits:

- Chat content floor: 420px.
- Collapsed command rail: 46px.
- Pinned rail: 180–360px, default 240px.
- Notes list: 200–360px, default 240px.
- Browse: 200–320px, default 240px.
- Beside note: 280–480px, default 360px.

Below the available budget, the shell folds Browse, then Notes, then the
pinned rail. Read temporarily stacks the note when beside mode cannot keep
Chat at 420px. Width drags clamp before they consume Chat space.

The View command names are Chat, Notes, Read, Workbench, and Reset layout.
The old command ids remain for Chat, Notes, and Workbench. `view-read` and
`view-reset-layout` are new ids. `pane_preset_changed` and
`pane_layout_reset` telemetry events are emitted.

## Verified

These focused tests pass:

- `src/lib/panePresets.test.ts` — 13 tests.
- `src/lib/shellLayout.test.ts`.
- `src/hooks/useViewMode.test.ts` — includes restart, per-vault isolation, and damaged-storage cases.
- `src/hooks/useChatCenteredShellLayout.test.ts`.
- `src/hooks/useShellCompactLayout.test.ts`.
- `src/components/chatNoteSplit.test.ts`.
- `src/hooks/appCommandDispatcher.test.ts`.
- `src/App.test.tsx` — 55 tests.
- `tests/smoke/unified-shell-layout.spec.ts` — 3 original layout tests plus the new preset geometry test.

The new Chromium geometry test passed. It checks divider drags, width memory,
Chat at narrow widths, folding at 639px, Read stacking and restoration, and
Reset layout. Screenshots were captured at `/tmp/pane-presets-narrow.png` and
`/tmp/pane-presets-workbench.png`.

Codacy opengrep found zero findings in the three new/changed state modules.
Codacy lizard found no complexity threshold violations. Trivy completed, but
reported the repository's existing dependency advisories. It reported zero
Critical findings and existing High findings in dependencies including
`fast-uri`, `js-yaml`, `@tiptap/*`, and others. Do not bump those packages in
this task because the plan explicitly forbids it.

`pnpm handoff:check` passes.

## Required finish work

1. Run `pnpm lint` and `pnpm typecheck`. The last full lint run had one
   `react-hooks/set-state-in-effect` warning in `src/hooks/useViewMode.ts`
   from the vault-scope change path. Keep the immediate derived load, but
   remove the lint violation without changing the persistence contract.

2. Run the full frontend suite. The first coverage run was started before the
   latest stale-lock edits and reported 25 failures. Most failures were old
   expectations for `Chat only`, `Notes, Browse closed`, `Notes, Browse open`,
   or a fresh `editor-list` launch. Search all failures again instead of
   assuming the old list is still exact.

   Known files that still need review:

   - `src/lib/leftover-browse-commands.test.ts`
   - `src/lib/leftover-chat-only-en.test.ts`
   - `src/lib/parked-organs.test.ts`
   - `src/components/KeyboardShortcutsDialog.test.tsx`
   - Any remaining `App.test.tsx` assertions that assume Notes opens by default.

   Update locks to the product names Chat, Notes, Read, and Workbench. Do not
   remove a lock only because it is inconvenient.

3. Fix the command catalog type wiring if lint or typecheck exposes it. The
   new `onReadLayout` and `onResetLayout` handlers must be present in the
   keyboard/menu handler types and in `SIMPLE_HANDLER_EXECUTORS`.

4. Review `src/hooks/useChatCenteredShellLayout.ts` and
   `src/lib/shellLayout.ts` for one remaining semantic concern: the helper
   names are compatibility wrappers, but `ensureNotesOpen` should preserve
   Workbench when Workbench is already active. The focused behavior tests cover
   Notes and Workbench switching. Add a direct Workbench-preservation test if
   the implementation changes.

5. Add `docs/adr/0173-pane-presets.md`. State that `PanePresetState` is the
   runtime source of truth, legacy `view_mode` and `chatNoteSplit` remain
   compatibility mirrors, fresh launch defaults to Chat, and the four presets
   are the complete legal set. Reference ADR-0166 without editing it.

6. Update `docs/HANDOFF.md` State and Recent sessions. This handoff must be the
   newest entry. Mention that pane presets are in source only and the
   packaged app is unchanged.

7. Update the session file name if the final Cursor session time differs. Keep
   this file's frontmatter shape and do not paste a session narrative into
   `docs/HANDOFF.md`.

8. Run the required final checks after all edits:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm test:coverage
   pnpm test:mcp
   cargo test
   cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings
   cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
   pnpm handoff:check
   ```

   Run the Rust coverage lane when the frontend checks are green. Do not claim
   native QA. Do not rebuild `/Applications`.

9. Do not commit or push unless Atticus gives that instruction. If he does
   authorize a commit later, stage named paths only and include the model
   trailer required by `AGENTS.md`.

## Files changed by this session

The working tree includes the intended pane work in these areas:

- `src/lib/panePresets.ts`, `src/lib/panePresets.test.ts`
- `src/lib/panePresetStorage.ts`
- `src/lib/shellLayout.ts` and its tests
- `src/hooks/useViewMode.ts` and its tests
- `src/hooks/useChatCenteredShellLayout.ts` and its tests
- `src/hooks/useShellCompactLayout.ts` and its tests
- `src/hooks/useAppWindowControls.ts`
- `src/hooks/useAppCommands.ts`, `src/hooks/useCommandRegistry.ts`,
  `src/hooks/appCommandDispatcher.ts`, and command tests
- `src/components/CommandRail.tsx`, `src/components/VaultPanel.tsx`,
  `src/components/chatNoteSplit.ts`, and `src/App.tsx` / `src/App.css`
- `src/shared/appCommandManifest.json`
- stale C72 locks and `tests/smoke/unified-shell-layout.spec.ts`

`docs/BOARD.md`, `docs/HANDOFF.md`, and the existing Composer handoff were
already dirty before this handoff. Preserve their unrelated edits.
