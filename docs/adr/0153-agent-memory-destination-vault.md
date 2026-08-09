---
type: ADR
id: "0153"
title: "Research panel targets a persisted destination vault, not the open editor vault"
status: active
date: 2026-07-11
---

## Context

Before Alpha-4, every `rhizome_*` call from the Research panel
(Generate/Import/Distill/Ask, plus the Library and History reads) targeted
`vaultPath` — whichever vault happened to be open in the main editor. There
was no separate concept of "the agent/wiki memory vault." Per
`docs/plans/2026-07-05-research-panel-future-ideas.md` (section 2, captured
2026-07-05), this produced two concrete problems observed in QA:

1. Opening a personal notes vault and running Generate/Distill silently wrote
   agent output into that personal vault instead of the dedicated Rhizome
   Vault (`~/Documents/Rhizome Vault`), with no warning.
2. There was no way to keep a scratch/one-off destination (e.g. a school
   project) separate from the default wiki without permanently switching the
   editor's open vault.

The roadmap (`docs/plans/2026-07-10-rhizome-desktop-alpha-roadmap.md`,
Alpha-4) calls for a persisted `agent_memory_vault_path` setting as the
default destination, with a per-session override and confirmation before
writing somewhere non-default.

## Decision

**What was decided.**

1. **New global setting `agent_memory_vault_path: Option<String>`** on the
   Rust `Settings` struct (`src-tauri/src/settings.rs`), normalized the same
   way as `default_ai_target` (trim, empty → `None`). No allow-list — any
   vault path the user has open/known is valid.
2. **`ResearchPanel` computes `destinationVaultPath` independently of
   `vaultPath`**: `agentMemoryVaultPath || vaultPath` as the default, with a
   per-session `destinationOverride` local state layered on top. All six
   `rhizome_*` invoke call sites (scan_library, repo_research, import_source,
   distill, search, read_events) use `destinationVaultPath`, never the raw
   `vaultPath` prop.
3. **Destination dropdown** in the panel header, sourced from the app's known
   vault list (`vaultSwitcher.allVaults`) plus the current default. Selecting
   a vault not yet in that list is not supported in v1 (matches "no +New
   Vault in v1" below).
4. **Confirm-before-send gates only the three write actions** (Generate,
   Import, Distill) and only fires when the picked destination differs from
   the *persisted default*, not from the open editor vault. Ask/Library/
   History are read-only and ungated. Switching the dropdown back to the
   default silently clears the pending confirm — no alert fatigue on the
   common path, per the spec doc's explicit requirement.
5. **Button labels show the destination** (`"Generate → Rhizome Vault"`)
   composed at render time from the translated action verb + a resolved
   vault label, not baked into a single localized string — keeps translators
   from having to handle an embedded arrow/interpolation per language.
6. **"Set as default"** persists the current destination as the new
   `agent_memory_vault_path` via `saveSettings`, surfaced directly next to
   the dropdown when the current pick differs from the saved default.

## Deferred (documented, not oversights)

- **No first-run two-choice prompt** ("import existing vault" vs "create new
  Rhizome Vault") from the spec doc's section 2. "Set as default" (decision
  6) gives users a persistence path with far less surface area than a new
  onboarding flow; the elaborate first-run modal can follow if it's still
  wanted after real usage.
- **No "+ New Vault…" entry in the destination dropdown.** Creating a vault
  from inside the dropdown needs the `create_empty_vault` command wired
  *without* the side effect of switching the main editor's active vault
  (today's `vaultSwitcher.handleCreateEmptyVault` always does both) — a
  real but separable follow-up.
- **No SettingsPanel field for `agent_memory_vault_path`.** SettingsPanel's
  draft/save pipeline is large and deeply prop-drilled; "Set as default"
  achieves the same persisted outcome without touching it this round.

## Consequences

Easier: agent-authored content lands where it's meant to by default,
independent of whatever the user happens to have open for editing;
overriding for a one-off destination no longer requires switching vaults.

Harder: two vault-path concepts now exist in the Research panel
(`vaultPath` for the editor, `destinationVaultPath` for writes) — future
contributors touching `ResearchPanel.tsx` must use the right one per call
site; got this wrong once already inside this task's own history (the
header display and the `noVaultWarning` gate were briefly left on
`vaultPath` before being corrected to `destinationVaultPath`).

Re-evaluate if users want to send research output to a destination that
doesn't already appear in `vaultSwitcher.allVaults` — that's the "+ New
Vault…" follow-up above.
