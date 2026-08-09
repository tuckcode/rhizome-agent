# Alpha-4 (destination vault) — session status

Picks up `2026-07-10-rhizome-desktop-alpha-roadmap.md`'s Alpha-4 phase,
next of the alpha critical path (`0 → 1 → 2 → 3 → 4`, now all four done).
Scoped from `docs/plans/2026-07-05-research-panel-future-ideas.md` section 2
(the only detail doc for this phase — the roadmap itself only one-lines it).
Also resolved a separate user-reported issue this session: Research panel
appeared "not working" — root cause was a locally expired `claude` CLI OAuth
session, not an app bug (documented in HANDOFF.md, not fixed in code since
it's account auth outside this agent's ability to touch).

## Pushed this session

```
<hash> feat: agent_memory_vault_path setting (Alpha-4 task 1)
<hash> feat: Research panel targets agent_memory_vault_path, not editor vault (Alpha-4 task 2)
<hash> feat: destination dropdown + confirm-before-send + button labels (Alpha-4 task 3)
<hash> fix: pass known vaults into ResearchPanel destination picker
<hash> feat: "Set as default" persists agent_memory_vault_path from the panel (Alpha-4 task 4)
<hash> docs: ADR-0153 + ARCHITECTURE.md Alpha-4 section (destination vault)
<hash> feat: PostHog events for destination override and set-as-default (Alpha-4)
```
(plus this docs commit.)

## Done

- **Task 1 — settings field**: `agent_memory_vault_path: Option<String>` on
  the global `Settings` struct (`settings.rs`), normalized/trimmed the same
  way as `default_ai_target`. TDD: roundtrip test + save/reload trim test.
- **Task 2 — destination wiring**: `ResearchPanel` computes
  `destinationVaultPath = agentMemoryVaultPath || vaultPath` and switches
  all six `rhizome_*` invoke call sites (scan_library, repo_research,
  import_source, distill, search, read_events) off the raw `vaultPath` prop
  onto it. `App.tsx` threads `settings.agent_memory_vault_path` through.
- **Task 3 — dropdown + confirm + labels**: destination `Select` in the
  panel header sourced from `vaultSwitcher.allVaults`; per-session
  `destinationOverride` local state; confirm-before-send dialog gates only
  the three write actions (Generate/Import/Distill) and only when the pick
  differs from the *persisted default* (not the editor's open vault);
  button labels compose `"{verb} → {destination}"` at render time (not
  baked into a single localized string, so translators don't handle an
  embedded arrow per language).
- **Task 3 follow-up fix**: `App.tsx` wasn't actually passing
  `vaultSwitcher.allVaults` into the new `vaults` prop — caught via live
  browser QA (dropdown only had one option), separate small commit.
- **Task 4 — persistence**: `onSetDefaultDestination` prop, wired to
  `saveSettings` in `App.tsx`. A "Set as default" link-button appears next
  to the dropdown whenever the current pick differs from the saved
  default, letting users persist their Rhizome Vault choice from where
  they actually pick it — chosen over threading a new field through
  `SettingsPanel`'s large draft/save pipeline this round.
- **ADR-0153**: documents the decision + the three explicitly deferred
  pieces (first-run two-choice prompt, "+ New Vault…" in the dropdown,
  SettingsPanel field).
- **PostHog**: `research_destination_override` (picking non-default) and
  `research_destination_set_default` (persisting one), no path/PII in
  metadata, matching the file's existing `research_*` event style.
- **Live browser QA** (vite-only preview, mock Tauri layer): opened
  Research panel, confirmed destination dropdown lists real known vaults,
  button label updates reactively on selection, confirm dialog renders
  correctly nested over the main panel (not closing it — verified this
  isn't the classic "two independent Radix Dialog roots stomp each other"
  bug), Send proceeds through the real write path, Cancel/switch-back-to-
  default clears the pending confirm silently.
- Suite green: 1150 Rust tests (10 ignored — all live/agent,
  **85.10% line coverage, clean build** — the `--no-clean` invocation from
  AGENTS.md's check-suite snippet read **83.47%** on this machine this
  session because of stale profile data mixed in from earlier
  non-instrumented `cargo build`/`cargo test` runs; re-ran clean to get the
  authoritative number, which passes the 85% gate), 4869 frontend tests
  across 456 files (84.93% line coverage), lint/`tsc -b`/build clean.

## Deviations from the plan (all deliberate, see ADR-0153)

- **No first-run two-choice prompt** ("import existing vault" vs "create
  new Rhizome Vault"). "Set as default" gives the persistence outcome with
  far less new surface area than a new onboarding flow.
- **No "+ New Vault…" entry in the destination dropdown.** Needs
  `create_empty_vault` wired *without* the side effect of switching the
  main editor's active vault (today's `vaultSwitcher.handleCreateEmptyVault`
  always does both) — real, but separable follow-up.
- **No SettingsPanel field for `agent_memory_vault_path`.** SettingsPanel's
  draft/save pipeline is large and deeply prop-drilled across several
  nested components; not worth the blast radius this round given "Set as
  default" already covers the functional need.

## Known gaps / notes for next session

- **Codacy scan not run** — no Codacy MCP connected this session and no
  local `.codacy/cli.sh` present in this repo. Someone with MCP access
  should scan the touched files (`settings.rs`, `ResearchPanel.tsx`,
  `App.tsx`, `useSettings.ts`, `mock-handlers.ts`) before/alongside next
  release-readiness pass.
- **l10n stale** for the five new `research.destination.*` keys — same gap
  as Alpha-3, no LARA creds in this environment.
- **Research panel's "not working" report resolved as environmental**: the
  local `claude` CLI's OAuth session was expired on this machine. Not a
  code fix — documented in HANDOFF.md with the actual re-auth step and the
  "no bundled free AI" design rationale (the app never ships credentials,
  so it never eats inference cost on a user's behalf). Confirmed via a
  quick audit this session: only `claude` and `hermes-venv` are installed
  locally, no `ANTHROPIC_API_KEY` in the environment.
- **Alpha-5 is next** (cancel affordance + MCP sidecar Phase 2), then
  Alpha-6/step-6 (physical layout, Memory) — completes the solo-usable
  alpha critical path started at Alpha-0.
