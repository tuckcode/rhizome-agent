# End-to-end audit: first launch → memory saved (2026-07-26)

Audit of the full path a new user walks: first launch → onboarding → an agent
saving a memory → that memory landing correctly in the vault. Four connected
areas, plus a fifth composite finding.

**Verified facts only.** Every claim cites file:line so any agent can
re-verify rather than trust.

---

## 1. First launch flow — gate to walking

### Components

| File | Role |
|---|---|
| `WelcomeScreen.tsx` | Two modes: `'welcome'` (first launch) and `'vault-missing'`. Creates a vault (template or empty) or opens a folder. |
| `OnboardingShell.tsx` | Centering container with drag-to-move support. Pure layout. |
| `AiAgentsOnboardingPrompt.tsx` | Checks installed agents (Claude Code, Codex, Hermes, Pi, Kiro, etc.), shows status. `onContinue` → proceeds to main app. |

### Walkthrough tour

`docs/design/onboarding-walkthrough.md` is a 22KB, 10-step design spec.
**Zero code exists.** The spec's stated goal — *"teach the user what happens
when an AI agent saves text or memories"* — is exactly this workstream's
question, which means the tour is both the *educational answer* to the
question and *unbuilt*.

**Decision open per the pickup plan:** build the tour (10 steps, spotlight-style)
or drop it. The spec is complete enough to build from, but no code, no
i18n strings, no component exists. If built it answers the user's question
directly. If dropped, the AGENTS.md doc (see §4) carries the whole burden.

---

## 2. Vault structure vs VAULT_CONTRACT.md

### The write contract (VAULT_CONTRACT.md)

Defines canonical paths under `wiki/`:

```
<vault>/
└── wiki/
    ├── sources/repos/<slug>.md     # RepoWiki
    ├── sources/documents/<slug>.md  # Document
    ├── entities/<slug>.md           # Entity
    └── concepts/<slug>.md           # Concept
```

Inbox drops (unprocessed inputs) go to `raw/inbox/` outside `wiki/`.

### `rhizome_write_location.rs` — verified congruent

`src-tauri/src/rhizome_write_location.rs` defines 4 `ArtifactKind` variants
matching the contract exactly: `RepoWiki`, `Document`, `Entity`, `Concept`.
Each maps to the correct path:

```rust
ArtifactKind::RepoWiki => "wiki/sources/repos"
ArtifactKind::Document => "wiki/sources/documents"
ArtifactKind::Entity   => "wiki/entities"
ArtifactKind::Concept  => "wiki/concepts"
```

Flat-layout detection (`vault_uses_flat_layout`) handles pre-`wiki/` vaults:
detects `RHIZOME_VAULT.md` or `.rhizome/` without a `wiki/` dir, writes
to `sources/`, `entities/`, `concepts/` at root instead.

`default_frontmatter` and `push_frontmatter_field` produce the contract's
required skeleton. `unique_slug_path` handles dedup.

**Verdict: the writer code and the contract are congruent.** The real vault
(~/Documents/Rhizome Vault) uses flat layout (old Python CLI layout), which
is correctly handled.

### Inbox contract: `inbox_action` frontmatter

`src-tauri/src/inbox_action.rs` defines `inbox_action: save | distill | import`.
A declared action beats the extension heuristic (`classify_inbox_file`).
When a drop declares `inbox_action: save`, it files directly into
`wiki/sources/documents/` without an agent round-trip.

---

## 3. Six save triggers — each verified against code

### 3a. Research panel (Distill button)

**Path:** `ResearchPanel.tsx:401` → `jobs.startJob('rhizome_distill', args)` →
`rhizome_jobs.rs` → `rhizome_distill::run_distill_via_target` →
`rhizome_distill.rs:232` → `append_distill_event(vault_path, project, trigger, artifact_path)`

**Trigger value:** `"manual"` (passed through from the job args; no explicit
trigger value in `ResearchPanel.tsx` args, so it gets the default).

**Events logged?** ✅ Yes — `append_distill_event` at `rhizome_distill.rs:295`
writes `{"type":"distill","trigger":"manual","artifact_path":"wiki/concepts/..."}`
to `.rhizome/events.jsonl`.

**Lands per contract?** ✅ Writes to `wiki/concepts/` via
`rhizome_write_location::ArtifactKind::Concept`.

### 3b. Menu-bar capture

**Path:** `menu_bar_capture.rs:100` → `write_capture_files` writes PNG to
`attachments/` + markdown to `raw/inbox/{capture}.md` → line 129:
`append_vault_event(vault_path, "capture", None, "menu_bar", note_relative)`

**Trigger value:** `"menu_bar"`

**Events logged?** ✅ Yes — `append_vault_event` at line 129, type `"capture"`.

**Lands per contract?** ✅ Drops into `raw/inbox/` for inbox watcher to pick up.
The capture itself is a note with `source: menu_bar` and `capture: <kind>`
frontmatter, plus an `![[attachments/...png]]` link.

### 3c. Inbox watcher

**Path:** `inbox_watcher.rs` → watch `raw/inbox/` → `process_inbox_file` →
classify (`classify_inbox_file`) → dispatch to `run_distill` or `run_import`
with trigger `"inbox"`.

**Trigger value:** `"inbox"` (hardcoded per `inbox_watcher.rs:117`).

**Events logged?** ✅ Yes — the distill/import paths both call
`append_distill_event` or `append_import_event` with trigger `"inbox"`.

**Lands per contract?** ✅ Distill → `wiki/concepts/`. Import →
`wiki/sources/documents/`.

**Default quirk:** `isInboxAutomationEnabled` (`inboxAutomation.ts:9`) returns
`value !== false` — ON when unset, which is correct for new vaults. But vaults
that were opened while the *old* default was OFF have an explicit `false`
persisted in their config. **No migration flips them to `true` or removes the
key.** Noticed in the pickup plan §12.

### 3d. MCP / LLM tool: `create_note`

**Path:** `ai_model_tools.rs:5` → `create_note_from_tool_args` →
`file_cmds.rs:162` → `vault/file.rs:174` → writes file.

**Events logged?** ❌ **No.** `vault/file.rs::create_note_content` writes the
file but never appends to `.rhizome/events.jsonl`. This means MCP-created
notes are invisible to the History panel, menu-bar activity feed, and any
event-driven UI.

**Lands per contract?** Depends on the path the agent provides. The tool
accepts an arbitrary `path` parameter. Agents following the AGENTS.md guidance
would write to `wiki/concepts/`, but there's no enforcement.

### 3e. CLI / `rhizome-tool`

**Path:** `rhizome_tool.rs` → `SaveCapture`/`SaveDistill`/`Import` →
`inbox_action::save_capture` or `rhizome_distill::run_distill_via_target` or
`rhizome_import::run_import_via_source`.

**Events logged?** ✅ Yes — all three paths go through the event-logging
wrappers (`append_vault_event`, `append_distill_event`, `append_import_event`).

**Lands per contract?** ✅

### 3f. Hand-edit / in-app note creation

**Path:** Editor save (Cmd+S) or Cmd+N → `file_cmds.rs:162` (create_note_content)
or `save_note_content` → `vault/file.rs:155` or `:174`.

**Events logged?** ❌ **No.** Neither `save_note_content` nor
`create_note_content` in `vault/file.rs` logs events. The same gap as 3d.

**Lands per contract?** Hand-edits go wherever the user points them. In-app
note creation (Cmd+N) creates at the vault root by default.

### Summary table

| Trigger | Events logged? | Contract path? | Notes |
|---|---|---|---|
| Research panel (Distill) | ✅ `"manual"` | ✅ `wiki/concepts/` | |
| Menu-bar capture | ✅ `"menu_bar"` | ✅ `raw/inbox/` | |
| Inbox watcher | ✅ `"inbox"` | ✅ per classified action | |
| MCP `create_note` tool | ❌ **gap** | Depends on agent | Also no contract enforcement |
| CLI `rhizome-tool` | ✅ per verb | ✅ per verb | |
| Hand-edit / Cmd+N | ❌ **gap** | Vault root | Same root cause as MCP |

---

## 4. Docs that govern saving

### The canonical AGENTS_MD (`getting_started.rs:314`)

`src-tauri/src/vault/getting_started.rs:314` defines the current `AGENTS_MD`
constant — the file seeded into every cloned vault. It includes a strong
"Saving durable knowledge (memory)" section (lines 425–436) that:

- Names `rhizome_distill` and `create_note` tools
- Lists proactive triggers (durable facts, decisions, workflows, explicit "remember this")
- Maps card kinds to `wiki/concepts/`
- Suggests `concept` as the safe default kind
- Lists what not to distill

This is the primary lever on *when* an agent saves. It's well-written —
matches the Claude 5 "rich references" rule (names actual tools, paths) and
avoids vague exhortations.

### The actual vault's AGENTS.md

`~/Documents/Rhizome Vault/AGENTS.md` still opens with `# AGENTS.md — Tolaria
Vault` and links `refactoringhq/tolaria`. 9 occurrences. It describes Tolaria
conventions (`.view.json` files, `is_a:` type aliases, "Do not add `title:`
frontmatter") that are **wrong for Rhizome**. Agents reading this every
session get product guidance for the wrong tool.

**Detection exists but never fires on existing vaults:**
`getting_started.rs:244` defines `OUTDATED_AGENTS_MARKERS` containing
`"# AGENTS.md — Tolaria Vault"`. `can_be_refreshed()` at line 295 returns
`true` for this vault's file today. But `refresh_cloned_vault_config_files`
at line 585 is called from exactly one place — the *clone* path (line 560).
Never for an existing vault.

### `~/CLAUDE.md` chain

The user's `CLAUDE.md` session-start chain (the Obsidian vault file) is
outside this repo's control. The repo's `AGENTS.md` (§ What agents should do)
defers to vault-level guidance, and the vault's AGENTS.md is stale. This
chain's weakness is the stale vault doc.

---

## 5. Composite findings

### F1 — Event logging gap: create_note / hand-edit

Two write paths produce no `.rhizome/events.jsonl` entries:
- `vault/file.rs::create_note_content` (line 174)
- `vault/file.rs::save_note_content` (line 155)

This means:
- Notes created through MCP `create_note` tool are invisible in History
- Notes created through the in-app editor (Cmd+N) are invisible in History
- The menu-bar activity feed won't show them
- Any future event-driven UI relies on a log that's missing entries

The fix is straightforward: `create_note_content` and `save_note_content`
should call `append_vault_event` with trigger values like `"mcp_tool"` and
`"manual_edit"` (or similar).

### F2 — Vault AGENTS.md stale for existing vaults

The actual vault at `~/Documents/Rhizome Vault/AGENTS.md` still teaches
Tolaria conventions. The refresh mechanism exists but only fires during clone.
No existing vault gets its AGENTS.md updated.

Two-part fix per the pickup plan: (1) rewrite this vault's file now (one-shot),
(2) wire the refresh for already-open vaults as a separate commit (detect
stale markers at launch, rewrite, commit).

### F3 — Walkthrough tour: build vs drop

The 10-step design spec addresses the user's exact question (*"what happens
when an agent saves"*) but has zero code. This is a human decision.

- **Build:** 10 spotlight-style steps, ~half a session of UI work. Would close
  the question directly.
- **Drop:** Commit to the AGENTS_MD doc as the sole vehicle for agent-save
  education. Lower cost, but less discoverable.

### F4 — Inbox migration gap

`isInboxAutomationEnabled` correctly defaults to ON when unset. But vaults
opened during the period the default was OFF have an explicit `false` in
config, and there's no migration path. A one-time migration that either
removes the key or flips it to `true` would fix them.

### F5 — No contract enforcement on `create_note` tool path

The MCP `create_note` tool accepts an arbitrary `path` parameter with no
validation against `VAULT_CONTRACT.md` paths. An agent could write notes
anywhere in the vault. The AGENTS_MD guidance tells agents what to do, but
there's no code-level enforcement.

---

## Action items (in priority order)

1. **Fix event logging gap** — Add `append_vault_event` calls to
   `create_note_content` and `save_note_content` in `vault/file.rs`.
2. **Rewrite vault AGENTS.md** — One-shot fix for the real vault.
3. **Wire AGENTS.md refresh for existing vaults** — Detect stale markers on
   vault open, rewrite, and auto-commit.
4. **Decide build/drop on the walkthrough tour** — Human call.
5. **Inbox migration** — One-time migration for vaults with persisted `false`.
6. **Contract enforcement on `create_note`** — Validate paths against
   `rhizome_write_location` in the tool path.
