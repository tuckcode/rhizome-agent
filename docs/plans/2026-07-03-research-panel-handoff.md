# Research Panel — Session Handoff (2026-07-03)

## Context

Session started by mapping what's implemented in Rhizome Desktop (rebranded from
Tolaria; codebase still has residual Tolaria references). Core app is mature
(editor, sidebar, AI workspace, sheets, whiteboard, git integration). The
**Research Panel** (`src/components/ResearchPanel.tsx`) is a 6-tab dialog
(Generate, Import, Distill, Library, Ask, History) that shells out to external
`rhizome-*` CLIs via `call_rhizome_tool` (`src-tauri/src/rhizome_commands.rs`).

Opus produced a phased implementation plan (see "Full plan" below). This
session executed **all of Phase 0, Phase 1, Phase 2, and 3.2 of Phase 3**,
across 6 commits, all local and unpushed (private `origin`, no push made).

## What shipped, in commit order

1. **`2b4f40bd`** — 0.1 + 0.2: Library items now open the real note via
   `onOpenNote`/`vaultBridge.openNoteByPath` instead of a dead
   `rhizome_search` call. `scan_vault_library` emits vault-relative `path`
   fields per item.
2. **`3f2f7507`** — 0.3: new `rhizome_discovery.rs` (modeled on
   `hermes_discovery.rs`) + `rhizome_check_availability` Tauri command.
   `ResearchPanel` checks on open, shows a "not installed" banner, and
   disables all 4 action buttons when the CLI toolkit is missing. Fails open
   on check error.
3. **`2d3eb8a9`** — Phase 1 + 2.1/2.2 combined: Generate depth, Distill kind,
   and Library search/sort are now controlled and actually reach the
   backend/filter the UI. Dead `+ Add` button removed, `Local` wired to the
   file picker. History auto-loads on tab switch. All raw `<select>`/
   `<textarea>` converted to shadcn/ui `Select`/`Textarea`.
4. **`5c0de549`** — 2.5: `open-research` command added to the command
   palette (Settings group), threaded through
   `settingsCommands.ts → useCommandRegistry.ts → useAppCommands.ts →
   App.tsx`. Previously only reachable via the floating Sparkle button.
5. **`c70c2b61`** — 2.6 + 2.7: every hardcoded string in `ResearchPanel.tsx`
   now goes through `createTranslator` via a `locale` prop wired from
   `App.tsx`'s `appLocale` (65 new `research.*` keys in `en.json`). PostHog
   events added: `research_generate`, `research_import`, `research_distill`,
   `research_ask`, `research_library_open`, with safe non-PII metadata only.
6. **`36dd2f92`** — 3.2: Ask tab now calls `rhizome_search` and renders real
   results (clickable cards → `onOpenNote`) instead of silently discarding a
   `rhizome_repo_research` call. See caveat below.

`ResearchPanel.test.tsx` grew from 0 → 15 tests across the session, all green.

## Known gaps / caveats to verify in a real environment

- **Rust is entirely unverified.** This sandbox has no MSVC linker
  (`link.exe` on PATH resolves to Git's coreutils shim; no Visual Studio
  Build Tools installed) and no network by default, so `cargo test`
  literally cannot run here. `rhizome_commands.rs` (path emission tests) and
  `rhizome_discovery.rs` (candidate-path tests) were manually reviewed by a
  second pass (cross-referencing every symbol against its actual definition)
  as a compiler stand-in, and came back clean — but **nobody has actually
  compiled this Rust code**. Run `cargo test` for real before trusting it.
- **`rhizome-search`'s `--format json` output shape is a guess.** Nothing in
  this repo documents it, and the external CLI isn't installed here to
  verify against. `parseAskResults()` in `ResearchPanel.tsx` tries several
  plausible field-name variants (`path`/`file`/`id`, `title`/`name`,
  `snippet`/`excerpt`/`description`/`preview`) and degrades to an empty
  result list on anything it doesn't recognize, rather than crashing or
  silently showing wrong data. **Verify field names against the real CLI
  output and fix `parseAskResults` if they're off.**
- **CodeScene before/after health checks never ran** — no MCP/CLI/API access
  this session. `AGENTS.md` makes this mandatory before push. Run it before
  the next push, in an environment where it's available.
- **Localization strings aren't translated.** `pnpm l10n:translate` needs
  `LARA_ACCESS_KEY_ID`/`LARA_ACCESS_KEY_SECRET`, unavailable here. 68
  `research.*`/`command.openResearch*` keys exist only in `en.json`;
  `pnpm l10n:validate` currently fails for all 18 target locales as
  expected. Run the real translation pass with credentials before release.
- **Full frontend suite has 11 pre-existing failures**, confirmed unrelated
  to every commit above (checked after each one): `App.test.tsx`,
  `FeedbackDialog.test.tsx`, `TelemetryConsentDialog.test.tsx`,
  `WelcomeScreen.test.tsx` — look like leftover Tolaria→Rhizome rebrand
  string mismatches (e.g. `WelcomeScreen.test.tsx` still asserts "Welcome to
  Tolaria"). Worth a separate fix, out of scope for this plan.
- **`AGENTS.md` claims "no origin remote is configured"** — that's stale.
  `origin` is set to `https://github.com/knispo/rhizome-desktop.git` and is
  private. Worth updating that doc.

## Not done — remaining plan items

**Phase 3 (stretch), 2 of 3 items still open:**

- **3.1 — streaming progress.** `run_cli` in `rhizome_commands.rs` busy-polls
  with a 100ms sleep loop and a 120s timeout, returning only final stdout —
  long research runs give zero feedback until they finish or time out.
  Needs a channel-based reader thread emitting Tauri events
  (`app.emit("rhizome-progress", …)`) consumed via `listen` in
  `ResearchPanel`. **Not attempted this session** — it's a real architecture
  change (threading, event emission, command signature) that I have no way
  to compile or test in this sandbox, and the risk of shipping a subtly
  broken threading change unverified outweighed doing it "blind." Needs a
  real dev environment.
- **3.3 (partial) — auto-open the newest created artifact.** The "trigger
  vault watcher refresh" half of this item is **already satisfied** —
  `vault_watcher.rs` watches the vault path recursively via the OS-level
  `notify` crate (`RecursiveMode::Recursive`), so files written by the
  external `rhizome-*` CLIs are picked up the same as any other external
  edit, no code needed. The "auto-select the newest note after
  Generate/Import/Distill" half was **not attempted** — it would require
  parsing the created file's path out of the CLI's raw stdout, and unlike
  `rhizome-search` those commands don't even request `--format json`, so the
  output is presumably free-form text with an even less certain shape than
  the Ask-tab guess above. Left alone rather than guessed at.

## Full plan (Opus, for reference)

Key files: `src/components/ResearchPanel.tsx`,
`src-tauri/src/rhizome_commands.rs`, `src-tauri/src/rhizome_discovery.rs`,
`src/App.tsx`, `src/hooks/useVaultBridge.ts`, `src/hooks/useCommandRegistry.ts`,
`src/hooks/useAppCommands.ts`, `src/hooks/commands/settingsCommands.ts`,
`src/lib/locales/en.json`, `src/lib/telemetry.ts`,
`src-tauri/src/hermes_discovery.rs` (template used for the new discovery
module), `src-tauri/src/lib.rs` (command registration).

Original grounding notes: the panel's open trigger was the floating Sparkle
button at `App.tsx:1732`/`App.tsx:1813` — already wired, just not
discoverable before 2.5 added the command-palette entry. The real note-open
path is `vaultBridge.openNoteByPath` (`useVaultBridge.ts:133`), reused for
both Library and Ask-tab result clicks.
