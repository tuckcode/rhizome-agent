# Research Panel — Future Ideas (not scheduled)

Captured from a UI-QA session on 2026-07-05. None of this is started; this is a
holding pen for ideas discussed but deliberately deferred.

## 1. Unified AI + Research side panel

Currently two separate surfaces: `AiWorkspace` (docks/floats/pops out, side mode
default) and `ResearchPanel` (a floating dialog, entry point now lives in the
StatusBar). Idea: make the AI side panel a two-mode surface — "AI chat" and
"Research" as switchable tabs/modes within the same docked panel, instead of
two independent UI surfaces.

Why deferred: real redesign, not a bug fix. Reworks 6 Research tabs into
~320-400px of side-panel width (current side panel default width is 320px,
see `DEFAULT_SIDE_WORKSPACE_WIDTH` in `aiWorkspaceSizing.ts`). Would need its
own ADR (new core UI abstraction, touches ADR 0011/0012 AI integration
pattern).

Related nit (2026-07-05): after moving Research's entry point to the
StatusBar, the AI floating bubble (`AiWorkspaceFloatingButton`) is now the
only floating button left — user likes the bubble itself (the orange Claude
accent color "sticks out" in a good way) but flagged that it no longer reads
as intentional now that Research isn't floating beside it. Revisit bubble
vs. static-button placement together when this unified-panel redesign
happens, rather than patching it in isolation again.

## 2. Destination-vault picker for Research operations

Today, every `rhizome_*` call (Generate/Import/Distill/Ask) always targets
whatever vault is currently open in the editor (`vaultPath` prop threaded from
`activeEditorVaultPath`). No separate "memory vault" concept exists.

Desired behavior (per user, 2026-07-05):
- Agent/wiki-related Research output should default to a fixed **Rhizome
  Vault** (`~/Documents/Rhizome Vault` today), independent of whichever vault
  is open/being edited in the main window.
- User should be able to override the destination per Research session —
  pick a different existing vault, or spin up a brand-new one on the spot
  (e.g. a school-project vault kept separate from everything else).
- Confirmation-before-send should trigger **only when destination differs
  from the default** (Rhizome Vault) — not on every single action, to avoid
  alert fatigue. When already on default, no popup.
- Show the destination vault name directly on the action buttons themselves
  (e.g. "Generate → Rhizome Vault") so it's visible without a separate glance
  at a selector.
- Stretch/deferred further: multi-select destinations (send the same
  research output to 2+ vaults at once). Cheap to add later — just loop the
  CLI call per selected vault — but not in v1.

First-run setup (added 2026-07-05, per user request): when
`agent_memory_vault_path` has never been set, prompt explicitly instead of
silently defaulting — "Import an existing vault (e.g. from Obsidian) as your
Rhizome Vault?" vs "Create a new Rhizome Vault for wiki/agent use" (with a
heads-up message before creating, not silent). This replaces today's silent
first-run behavior of auto-seeding a blank scaffold vault
(`Rhizome Desktop Vault`) with no explanation — see item 3 below for what
that looked like this session. Separate from the general "open/create any
vault" WelcomeScreen flow, which stays as-is for the personal/editing vault.

Implementation sketch (not started):
- New persisted setting: `agent_memory_vault_path`, defaults to first vault
  found with a `.rhizome/` marker directory, or user-set once.
- New `ResearchPanel` state: `destinationVaultPath`, seeded from the setting,
  overridable via a dropdown populated from the existing multi-vault list
  (`vaults.json` / `vaultSwitcher.allVaults`), plus a "+ New Vault..." entry
  reusing the existing `vaultSwitcher.handleCreateEmptyVault` flow.
- All `rhizome_*` invoke calls in `ResearchPanel.tsx` switch from `vaultPath`
  (active editor vault) to `destinationVaultPath`.
- Needs an ADR (new storage-destination concept, per AGENTS.md rules on when
  ADRs are required).

## 3. Two distinct vault roles observed this session

- `~/Documents/Rhizome Desktop Vault` — personal vault (formerly the
  Obsidian-facing default), used for day-to-day notes.
- `~/Documents/Rhizome Vault` — agent/wiki/project memory vault, has real
  `.rhizome/` data (events, repo-cache, repo-runs) and rich content
  (concepts/, entities/, governance/, projects/, research/, sources/,
  synthesis/). This is the vault the "destination-vault" work above should
  default to.

Note: as of this session, the app's current bundle identity
(`ai.rhizome.desktop`) had never been run before — no Application Support
config existed — so it was auto-onboarding into a blank scaffold vault
(`Rhizome Desktop Vault`, at that path, containing only boilerplate files)
every launch. Confirm on next real use that switching to the actual
`Rhizome Vault` via the vault switcher persists correctly across restarts.

## 4. Rhizome MCP integration — confirmed already correct

Checked 2026-07-05: `claude_invocation.rs` already auto-injects
`--mcp-config` (pointing at the bundled `tolaria` Node MCP server) plus
`--strict-mcp-config` on every `claude -p` the app spawns. No manual
external-tool setup needed by end users. No action needed here — just
documenting that this was verified, not assumed.
