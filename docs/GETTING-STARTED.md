# Getting Started

How to navigate the **Rhizome Agent** codebase, run the app, and find what you need.

> This is Rhizome Agent (`ai.rhizome.agent`, `tuckcode/rhizome-agent`), not Rhizome Desktop (`knispo/rhizome`, `ai.rhizome.desktop`) — see `docs/IDENTITY.md`. Product overview and roadmap: [README.md](../README.md). Some filenames and sidecar labels still use older internal names (`tolaria_*`, etc.) — treat those as implementation identifiers, not the product name.
>
> **Stamped 2026-09-20 Lane I:** local product checkpoint `4f9b4c4`
> (**unpushed**); `origin/main` `dc44d84`; planning local `bcd4b87`
> (**unpushed**); installed app still `6860762`. C76 source is in this
> commit series. Still Agent, not Desktop. No push. No rebuild.
>
> Stranger / first-run path:
> [`PUBLIC-PREVIEW.md`](PUBLIC-PREVIEW.md). This page is the developer
> path.

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0` (Vite 7) and **pnpm**
- **Rust** 1.77.2+ (for the Tauri backend)
- **git** CLI (required by the git integration features)
- **Prime Agent** on `PATH` for live Chat (`npm i -g prime-agent`). Not vendored.

### Linux system dependencies

If you run the desktop app on Linux, install Tauri's WebKit2GTK 4.1 dependencies first:

- Arch / Manjaro:
  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
    appmenu-gtk-module libappindicator-gtk3 librsvg
  ```
- Debian / Ubuntu (22.04+):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
    libsoup-3.0-dev patchelf
  ```
- Fedora 38+:
  ```bash
  sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
    libappindicator-gtk3-devel librsvg2-devel
  ```

### Linux AppImage Wayland troubleshooting

On some Wayland systems, the Linux AppImage may fail to launch with:

```text
Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...
```

Recent Linux builds automatically disable the unstable WebKitGTK DMABUF renderer on native Wayland launches. AppImage launches also disable WebKitGTK compositing as a last-resort sealed-runtime fallback and retry startup with an architecture-matching system Wayland client library when they detect this class of AppImage + Wayland environment. If you are running an older build, use this workaround:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LD_PRELOAD=/usr/lib64/libwayland-client.so.0 ./Rhizome*.AppImage
```

If your distribution stores the 64-bit library elsewhere, use that path instead, for example `/usr/lib/x86_64-linux-gnu/libwayland-client.so.0`. On 64-bit Fedora, avoid `/usr/lib/libwayland-client.so.0`; that path can point at a 32-bit library and be ignored by the loader with a wrong ELF class warning.

### Linux AppImage packaging checks

Linux release CI currently uses Tauri's stock linuxdeploy AppImage output plugin:

```bash
pnpm tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm,appimage
```

Release validation verifies that the Linux job produced an AppImage and at least one installer bundle. There is no in-app update feed: `createUpdaterArtifacts` is false and the updater endpoint list is empty, so updater signature files are not required.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run in browser (no Rust needed — uses mock data)
pnpm dev
# Open http://localhost:5202
# Vite pins 5202. 5173 is wrong. Playwright's config default is 5201
# when BASE_URL is unset.

# Run with Tauri (full app, requires Rust)
pnpm tauri dev

# Run tests
pnpm test    # Vitest unit tests
cargo test   # Rust tests (from src-tauri/)

# Or, run Rust tests from root project directory
cargo test --manifest-path src-tauri/Cargo.toml

# E2E tests
pnpm playwright:smoke       # Curated Playwright core smoke lane (~5 min)
pnpm playwright:regression  # Full Playwright regression suite
```

## Chunk Sidecar Validation

The experimental `.chunk/config.json` mirrors the portable parts of the local git hook gate as named validations. Use it for inner-loop checks before running the full pre-push hook:

```bash
chunk validate --list
chunk validate lint
chunk validate typecheck
chunk validate frontend-coverage
```

Remote sidecar validation requires CircleCI authentication:

```bash
chunk auth set circleci
chunk sidecar setup --name tolaria-hooks
chunk validate --remote lint
```

For Playwright smoke, prefer the shared-server shard runner after setup:

```bash
chunk sidecar ssh --sidecar-id <playwright-sidecar-id> -- 'cd /home/user/rhizome-agent && PLAYWRIGHT_CONCURRENCY=4 bash .chunk/run-playwright-shards.sh 8'
```

The pre-push hook uses the faster sidecar path automatically when Chunk is available. It syncs the checkout to three independent sidecars and fans out the automatic gates:

- `tolaria-hooks-frontend-2`: lint and build first, then frontend coverage.
- `tolaria-hooks-rust`: clippy, rustfmt, and Rust coverage.
- `tolaria-hooks-playwright`: curated Playwright smoke with a shared Vite server and eight shards.

Set `LAPUTA_PREPUSH_LOCAL=1` to force the local fallback path. If CircleCI has duplicate sidecar names, pin lanes with `SIDECAR_FRONTEND_ID`, `SIDECAR_RUST_ID`, and `SIDECAR_PLAYWRIGHT_ID`.

The sidecar is Linux-based, so keep native macOS Tauri QA and app-focus screenshot checks on the host machine. The Chunk config is intended for portable frontend, Rust, coverage, and Playwright smoke checks. Avoid starting multiple `chunk validate --remote ...` processes against the same sidecar at once; each validate run syncs the checkout, so concurrent validates can race.

## Starter Vaults And Remotes

**Default first-run / Restore is a local Rhizome scaffold** — folders and
type documents only, no personal notes, no network
(`create_local_rhizome_scaffold` in `src-tauri/src/vault/getting_started.rs`).
It does **not** clone `refactoringhq/tolaria-getting-started` unless
`RHIZOME_GETTING_STARTED_REPO_URL` is set. The old `TOLARIA_*` /
`LAPUTA_*` names are not read. C11’s Rhizome-owned remote starter is
still deferred.

When a remote URL *is* set, `create_getting_started_vault` clones that repo
and then removes every git remote from the new local copy, so the vault
still opens local-only. Users connect a compatible remote later through the
bottom-bar `No remote` chip or the command palette, both of which feed the
same `AddRemoteModal` and `git_add_remote` backend flow.

Linux AppImage builds still use the user's system `git` and `node`. Before the app spawns those Git or MCP Node subprocesses, it removes AppImage loader overrides such as `LD_LIBRARY_PATH`, `LD_PRELOAD`, and `GIT_EXEC_PATH` so HTTPS clone helpers and MCP tooling use the host library stack instead of bundled AppImage libraries.

## Multiple Vaults At The Same Time

The `settings.multi_workspace_enabled` flag turns the registered vault list into a unified graph. When enabled, `useVaultLoader` loads every available mounted vault, annotates entries with workspace provenance, and lets note lists, quick open, keyword search, backlinks, and wikilink navigation span those vaults.

The selected/default vault remains the write target for new notes and Type documents when `defaultWorkspacePath` points at an available mounted vault. Git status, changes, AutoGit checkpointing, and sync operate across the active mounted repository set, while history, diff, repair, and file operations still resolve explicit repository roots from the selected surface or entry provenance. Saved Views are listed from every mounted vault with source-vault identity, so duplicate view filenames remain separate and edits persist back to the view's owning vault.

The bottom-left `VaultMenu` exposes quick include/exclude controls and a `Manage vaults` entry. The Vaults settings section owns the full identity controls: display name, short label, read-only alias, accent color, removal, and default destination for new notes.

## Directory Structure

```
rhizome-agent/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point (renders <App />)
│   ├── App.tsx                   # Root component — wires layout + state hooks
│   ├── App.css                   # App shell layout styles
│   ├── types.ts                  # Shared TS types (VaultEntry, Settings, etc.)
│   ├── mock-tauri.ts             # Mock Tauri layer for browser testing
│   ├── theme.json                # Editor typography theme configuration
│   ├── index.css                 # Semantic app theme variables + Tailwind setup
│   │
│   ├── components/               # UI components (~100 files)
│   │   ├── Sidebar.tsx           # Left panel: filters + type groups
│   │   ├── SidebarParts.tsx      # Sidebar subcomponents
│   │   ├── NoteList.tsx          # Second panel: filtered note list
│   │   ├── NoteItem.tsx          # Individual note item
│   │   ├── PulseView.tsx         # Git activity feed (replaces NoteList)
│   │   ├── Editor.tsx            # Third panel: editor orchestration
│   │   ├── EditorContent.tsx     # Editor content area
│   │   ├── EditorRightPanel.tsx  # Right panel toggle
│   │   ├── editorSchema.tsx      # BlockNote schema + wikilink type
│   │   ├── RawEditorView.tsx     # CodeMirror raw editor
│   │   ├── Inspector.tsx         # Fourth panel: metadata + relationships
│   │   ├── DynamicPropertiesPanel.tsx  # Editable frontmatter properties
│   │   ├── AiWorkspace.tsx       # Multi-chat AI workspace orchestration (docked or native window)
│   │   ├── AiWorkspaceChrome.tsx # AI workspace header and vault-guidance chrome
│   │   ├── AiWorkspaceResizeHandles.tsx # AI workspace edge resize handles
│   │   ├── AiWorkspaceSideHeader.tsx # Side-mode AI workspace chat tabs and chrome
│   │   ├── AiPanel.tsx           # AI transcript/composer surface (selected target + per-vault permission mode)
│   │   ├── AiMessage.tsx         # Agent message display
│   │   ├── AiActionCard.tsx      # Agent tool action cards
│   │   ├── AiAgentsOnboardingPrompt.tsx # First-launch AI agent installer prompt
│   │   ├── SearchPanel.tsx       # Search interface
│   │   ├── SettingsPanel.tsx     # App settings
│   │   ├── StatusBar.tsx         # Bottom bar: vault picker + sync
│   │   ├── CommandPalette.tsx    # Cmd+K command launcher
│   │   ├── BreadcrumbBar.tsx     # Breadcrumb + word count + actions
│   │   ├── WelcomeScreen.tsx     # Onboarding screen
│   │   ├── LinuxTitlebar.tsx     # Linux/Windows custom window chrome + controls
│   │   ├── MacOSTitlebar.tsx     # macOS 32px overlay chrome + Command Palette
│   │   ├── LinuxMenuButton.tsx   # Linux titlebar menu mirroring app commands
│   │   ├── CloneVaultModal.tsx   # Clone a vault from any git URL
│   │   ├── AddRemoteModal.tsx    # Connect a local-only vault to a remote later
│   │   ├── ConflictResolverModal.tsx # Git conflict resolution
│   │   ├── CommitDialog.tsx      # Git commit modal
│   │   ├── CreateNoteDialog.tsx  # New note modal
│   │   ├── CreateTypeDialog.tsx  # New type modal
│   │   ├── UpdateBanner.tsx      # In-app update notification
│   │   ├── inspector/            # Inspector sub-panels
│   │   │   ├── BacklinksPanel.tsx
│   │   │   ├── RelationshipsPanel.tsx
│   │   │   ├── GitHistoryPanel.tsx
│   │   │   └── ...
│   │   └── ui/                   # shadcn/ui primitives
│   │       ├── button.tsx, dialog.tsx, input.tsx, ...
│   │
│   ├── hooks/                    # Custom React hooks (~90 files)
│   │   ├── useVaultLoader.ts     # Loads vault entries + content
│   │   ├── useVaultSwitcher.ts   # Multi-vault management
│   │   ├── useVaultConfig.ts     # Per-vault UI settings
│   │   ├── useNoteActions.ts     # Composes creation + rename + frontmatter
│   │   ├── useNoteCreation.ts    # Note/type creation
│   │   ├── useNoteRename.ts     # Note renaming + wikilink updates
│   │   ├── useCliAiAgent.ts      # Selected AI agent state + normalized session pipeline
│   │   ├── aiAgentPermissionMode.ts # Limited-tools/Power User mode; Prime always power_user
│   │   ├── useAiAgentsStatus.ts  # Claude/Codex/OpenCode/Pi/Antigravity/Kiro availability polling
│   │   ├── useAiAgentPreferences.ts # Default-agent persistence + cycling
│   │   ├── useAiActivity.ts      # MCP UI bridge listener
│   │   ├── useAutoSync.ts        # Auto git pull/push
│   │   ├── useConflictResolver.ts # Git conflict handling
│   │   ├── useEditorSave.ts      # Auto-save with debounce
│   │   ├── useTheme.ts           # Flatten theme.json → CSS vars
│   │   ├── useUnifiedSearch.ts   # Keyword search
│   │   ├── useNoteSearch.ts      # Note search
│   │   ├── useCommandRegistry.ts # Command palette registry
│   │   ├── useAppCommands.ts     # App-level commands
│   │   ├── useAppKeyboard.ts     # Keyboard shortcuts
│   │   ├── appCommandCatalog.ts  # Shortcut combos + command metadata
│   │   ├── appCommandDispatcher.ts # Shared shortcut/menu command IDs + dispatch
│   │   ├── useSettings.ts        # App settings
│   │   ├── useGettingStartedClone.ts # Shared Getting Started clone action
│   │   ├── useOnboarding.ts      # First-launch flow
│   │   ├── useCodeMirror.ts      # CodeMirror raw editor
│   │   ├── useMcpStatus.ts       # Explicit external AI tool connection status + connect/disconnect actions
│   │   ├── useUpdater.ts         # In-app updates
│   │   └── ...
│   │
│   ├── utils/                    # Pure utility functions (~48 files)
│   │   ├── wikilinks.ts          # Wikilink preprocessing pipeline
│   │   ├── frontmatter.ts        # TypeScript YAML parser
│   │   ├── plainTextPaste.ts     # Shared Paste without Formatting command target registry
│   │   ├── platform.ts           # Runtime platform + Linux chrome gating helpers
│   │   ├── ai-agent.ts           # Agent stream utilities
│   │   ├── ai-chat.ts            # Token estimation utilities
│   │   ├── ai-context.ts         # Context snapshot builder
│   │   ├── noteListHelpers.ts    # Sorting, filtering, date formatting
│   │   ├── wikilink.ts           # Wikilink resolution
│   │   ├── configMigration.ts    # localStorage → vault config migration
│   │   ├── iconRegistry.ts       # Phosphor icon registry
│   │   ├── propertyTypes.ts      # Property type definitions
│   │   ├── vaultListStore.ts     # Vault list persistence
│   │   ├── vaultConfigStore.ts   # Vault config store
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── aiAgents.ts           # Shared agent registry + status helpers
│   │   ├── appUpdater.ts         # Frontend wrapper around channel-aware updater commands
│   │   ├── i18n.ts               # App-owned localization runtime and locale resolution
│   │   ├── locales/              # JSON locale catalogs (English source + translated locales)
│   │   ├── releaseChannel.ts     # Alpha/stable normalization helpers
│   │   └── utils.ts              # Tailwind merge + cn() helper
│   │
│   └── test/
│       └── setup.ts              # Vitest test environment setup
│
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # Tauri app configuration
│   ├── capabilities/             # Tauri v2 security capabilities
│   ├── src/
│   │   ├── main.rs               # Entry point (calls lib::run())
│   │   ├── lib.rs                # Tauri setup + command registration
│   │   ├── commands/             # Tauri command handlers (split into modules)
│   │   ├── vault/                # Vault module
│   │   │   ├── mod.rs            # Core types, parse_md_file, scan_vault
│   │   │   ├── cache.rs          # Git-based incremental caching
│   │   │   ├── parsing.rs        # Text processing + title extraction
│   │   │   ├── rename.rs         # Rename + cross-vault wikilink update
│   │   │   ├── image.rs          # Image attachment saving
│   │   │   ├── migration.rs      # Frontmatter migration
│   │   │   └── getting_started.rs # First-run local scaffold (optional remote clone)
│   │   ├── frontmatter/          # Frontmatter module
│   │   │   ├── mod.rs, yaml.rs, ops.rs
│   │   ├── git/                  # Git module
│   │   │   ├── mod.rs, command.rs, remote_config.rs, commit.rs, status.rs
│   │   │   ├── history.rs, clone.rs, connect.rs, conflict.rs, remote.rs, pulse.rs
│   │   ├── telemetry.rs          # Sentry init + path/token scrubber
│   │   ├── secure_fs.rs          # Owner-only atomic writes (settings + secrets)
│   │   ├── search.rs             # Keyword search (walkdir-based)
│   │   ├── ai_agents.rs          # CLI-agent request normalization + adapter dispatch
│   │   ├── cli_agent_runtime.rs  # Shared CLI-agent runtime process/prompt/MCP helpers
│   │   ├── claude_cli.rs         # Claude CLI adapter
│   │   ├── codex_cli.rs          # Codex CLI adapter
│   │   ├── pi_cli.rs             # Pi CLI adapter
│   │   ├── kiro_cli.rs           # Kiro CLI adapter
│   │   ├── mcp.rs                # MCP server lifecycle + explicit config registration/removal
│   │   ├── app_updater.rs        # Alpha/stable updater metadata resolution
│   │   ├── settings.rs           # App settings persistence
│   │   ├── vault_config.rs       # Per-vault UI config
│   │   ├── vault_list.rs         # Vault list persistence
│   │   └── menu.rs               # Native macOS menu bar
│   └── icons/                    # App icons (regenerate: edit icons/icon-source.svg,
│                                 #   rasterize to icon-source.png at 1024×1024, run
│                                 #   `pnpm tauri icon src-tauri/icons/icon-source.png`,
│                                 #   then `sips -z 512 512 …` for 512x512{,-dark}.png
│                                 #   and `sips -z 256 256 …` for 256x256.png)
│
├── mcp-server/                   # MCP bridge (Node.js or Bun)
│   ├── index.js                  # MCP server entry (stdio tools)
│   ├── vault.js                  # Vault file ops — data-only frontmatter (no gray-matter)
│   ├── ws-bridge.js              # WebSocket bridge (ports 9710, 9711)
│   ├── test.js                   # MCP server tests
│   └── package.json
│
├── tests/smoke/                  # Playwright specs (full regression + @smoke subset)
├── demo-vault-v2/                # Curated local QA fixture for native/dev flows
├── scripts/                      # Build/utility scripts
│
├── package.json                  # Frontend dependencies + scripts
├── vite.config.ts                # Vite bundler config
├── tsconfig.json                 # TypeScript config
├── playwright.config.ts          # Full Playwright regression config
├── playwright.smoke.config.ts    # Curated pre-push Playwright config
├── AGENTS.md                     # Canonical shared instructions for coding agents
├── CLAUDE.md                     # Claude Code compatibility shim importing AGENTS.md as an organized Note
└── docs/                         # This documentation
```

## Key Files to Know

### Fixtures

- `demo-vault-v2/` is the small checked-in QA fixture used for native/manual Rhizome Agent flows. It is intentionally curated around a handful of search, relationship, project-navigation, and attachment scenarios.
- `tests/fixtures/test-vault/` is the deterministic Playwright fixture copied into temp directories for isolated integration and smoke tests.

### Start here

| File | Why it matters |
|------|---------------|
| `src/App.tsx` | Root component. Shows the 4-panel layout, state flow, and how orchestration hooks connect. |
| `src/types.ts` | All shared TypeScript types. Read this first to understand the data model. |
| `src-tauri/src/commands/` | Tauri command handlers (split into modules). This is the frontend-backend API surface. |
| `src-tauri/src/lib.rs` | Tauri setup, command registration, startup tasks, WebSocket bridge lifecycle. |

### Data layer

| File | Why it matters |
|------|---------------|
| `src/hooks/useVaultLoader.ts` | How vault data is loaded and managed. The Tauri/mock branching pattern. |
| `src/hooks/useNoteActions.ts` | Orchestrates note operations: composes `useNoteCreation`, `useNoteRename`, frontmatter CRUD, and wikilink navigation. |
| `src/hooks/useVaultSwitcher.ts` | Multi-vault management, vault switching, and persisting cloned vaults in the switcher list. |
| `src/hooks/useGettingStartedClone.ts` | Shared Restore / Getting Started action (local scaffold by default; remote clone only with env override). |
| `src/hooks/useNoteWindowLifecycle.ts` | Note-window URL opening, asset-scope sync, and window-title updates. |
| `src/hooks/useVaultRenameDetection.ts` | Focus-triggered Git rename detection and wikilink update action wiring. |
| `src/hooks/useStartupScreenState.ts` | Startup-screen and vault-content loading visibility decisions. |
| `src/hooks/useGitFileWorkflows.ts` | Git diff/history/discard wiring and deleted-note preview workflow. |
| `src/components/AddRemoteModal.tsx` | Modal UI for connecting a local-only vault to a compatible remote. |
| `src/mock-tauri.ts` | Mock data for browser testing. Shows the shape of all Tauri responses. |

### Backend

| File | Why it matters |
|------|---------------|
| `src-tauri/src/vault/mod.rs` | Vault scanning, frontmatter parsing, entity type inference, relationship extraction. |
| `src-tauri/src/vault/cache.rs` | Git-based incremental caching — how large vaults load fast. |
| `src-tauri/src/frontmatter/ops.rs` | YAML manipulation — how properties are updated/deleted in files. |
| `src-tauri/src/git/` | All git operations (clone, commit, pull, push, conflicts, pulse, add-remote). |
| `src-tauri/src/search.rs` | Keyword search — scans vault files with walkdir. |
| `src-tauri/src/ai_agents.rs` | CLI-agent request normalization, availability aggregation, adapter dispatch, and Claude event mapping. |
| `src-tauri/src/cli_agent_runtime.rs` | Shared CLI-agent request shape, prompt wrapping, JSON subprocess lifecycle, version probing, and MCP path helpers. |
| `src-tauri/src/claude_cli.rs`, `src-tauri/src/codex_cli.rs`, `src-tauri/src/opencode_cli.rs`, `src-tauri/src/pi_cli.rs`, `src-tauri/src/antigravity_cli.rs`, `src-tauri/src/kiro_cli.rs` | Per-agent command, config, discovery, and event adapters. |
| `src-tauri/src/app_updater.rs` | App-update stub. It reports that no release feed is configured. |

### Editor

| File | Why it matters |
|------|---------------|
| `src/components/Editor.tsx` | BlockNote setup, breadcrumb bar, diff/raw toggle. |
| `src/components/SingleEditorView.tsx` | Shared BlockNote shell, formatting controllers, and suggestion menus. |
| `src/components/editorSchema.tsx` | Custom wikilink inline content type definition. |
| `src/components/rhizomeEditorFormatting.tsx` | Markdown-safe formatting toolbar surface for BlockNote. |
| `src/components/rhizomeEditorFormattingConfig.ts` | Filters toolbar and slash-menu commands to markdown-roundtrippable actions. |
| `src/utils/wikilinks.ts` | Wikilink preprocessing pipeline (markdown ↔ BlockNote). |
| `src/components/RawEditorView.tsx` | CodeMirror 6 raw markdown editor. |

### AI

| File | Why it matters |
|------|---------------|
| `src/components/AiWorkspace.tsx` | Multi-chat AI workspace orchestration — chat sessions, sidebar tabs, target/permission controls, and dock/pop-out wiring. |
| `src/components/AiWorkspaceChrome.tsx` | Header and vault-guidance chrome shared by docked and popped-out AI workspace modes. |
| `src/components/AiWorkspaceResizeHandles.tsx` | Edge resize affordances for docked/side AI workspace layouts. |
| `src/components/AiWorkspaceSideHeader.tsx` | Side-mode AI workspace chat tabs, rename controls, and compact header chrome. |
| `src/components/aiWorkspaceConversations.ts` | Conversation metadata state, settings persistence, default title generation, and target resolution. |
| `src/components/aiWorkspaceSizing.ts` | AI workspace sizing, localStorage persistence, class names, and layout style helpers. |
| `src/components/AiPanel.tsx` | Reusable AI transcript/composer surface — selected target with tool execution, reasoning, actions, and per-vault permission mode. |
| `src/components/PrimeThinkingToggle.tsx` | Composer thinking-level menu. Levels come from the host and are filtered to the model's own set; no hardcoded list. |
| `src/components/usePrimeSessionSwitcher.ts` | Session list switch / fork / branch. Skips `ensure_prime_session_host` when the host is already running. Clears the transcript on the same click as the row highlight. |
| `src/lib/replySuggestions.ts` | Rules-first reply pills and Tab ghost-text (#51 Case 1). Options win over completion. Model-backed suggestions are not built. |
| `src/components/chatNoteSplit.ts` | On top / Beside for an open note over Chat. Beside forces compact Sessions/Notes. |
| `src/App.tsx` `handleAskAgentAboutNote` | Right-click a list row → Ask the agent about this note. Keeps Chat and opens that note (`App.test.tsx`). |
| `src/hooks/useNoteLockMode.ts` | Ephemeral per-note lock. Locked notes make BlockNote/raw read-only (`EditorContentLayout.test.tsx`). Not vault `editor_mode`. |
| `src/components/PrimeExtensionsSection.tsx` | Settings → Packages hub. Catalog is npm `pi-package`; install is the Prime CLI, not a daemon command. |
| `src/lib/primePackages.ts` | Catalog search URL, install spec (`npm:` prefix), and Ask-Chat fallback prompt. |
| `src/hooks/useViewMode.ts` | Runtime pane preset (`chat` / `notes` / `read` / `workbench`). Legacy `editor-only` / `editor-list` / `all` remain compatibility mirrors. Fresh default is Chat. |
| `src/components/ConnectionsPanel.tsx` | Graph/Mycelium cell. Chat-centered shell mounts this only on Changes. |
| `src/utils/openAiWorkspaceWindow.ts` | Native Tauri AI workspace window creation, focus, and dock-back traffic-light handling. |
| `src/hooks/useCliAiAgent.ts` | Thin React owner for the selected CLI agent session state. |
| `src/lib/aiAgentSession.ts` | Single message/session lifecycle for prompt normalization, history, streaming, and reset behavior. |
| `src/lib/aiAgentPermissionMode.ts` | Limited-tools/Power User mode normalization, Prime power-user default, display labels, and local transcript marker text. |
| `src/lib/aiAgentFileOperations.ts` | Detects agent-created or modified vault files from normalized tool inputs. |
| `src/lib/aiAgents.ts` | Supported agent definitions, status normalization, and default-agent helpers. |
| `src/utils/ai-context.ts` | Context snapshot builder for AI conversations. |

### Styling

| File | Why it matters |
|------|---------------|
| `src/index.css` | Semantic CSS custom properties for app-owned light/dark themes; System mode resolves to one of these at runtime. |
| `src/theme.json` | Editor-specific typography theme (fonts, headings, lists, code blocks). |

### Settings & Config

| File | Why it matters |
|------|---------------|
| `src/hooks/useSettings.ts` | App settings (telemetry, release channel, theme mode, UI language, date display format, Git visibility, auto-sync interval, default note width, sidebar type pluralization, default AI agent). |
| `src/lib/releaseChannel.ts` | Normalizes persisted updater-channel values (`stable` default, optional `alpha`). |
| `src/lib/appUpdater.ts` | Frontend wrapper for channel-aware updater commands. |
| `src/hooks/useMainWindowSizeConstraints.ts` | Derives the main-window minimum width from the visible panes and asks Tauri to grow back to fit wider layouts. |
| `src/hooks/useVaultConfig.ts` | Per-vault local UI preferences (zoom, view mode, colors, Inbox columns, explicit organization workflow, Git setup prompt preference, AI permission mode). |
| `src/components/SettingsPanel.tsx` | Settings UI for telemetry, release channel, Git visibility, sync interval, UI language, content display preferences, default AI agent, and the vault-level explicit organization toggle. |
| `src/hooks/useUpdater.ts` | App-update UI. The host currently reports that no feed is configured. |

## Architecture Patterns

### Tauri/Mock Branching

Every data-fetching operation checks `isTauri()` and branches:

```typescript
if (isTauri()) {
  result = await invoke<T>('command', { args })
} else {
  result = await mockInvoke<T>('command', { args })
}
```

This lives in `useVaultLoader.ts` and `useNoteActions.ts`. Components never call Tauri directly.

### Props-Down, Callbacks-Up

No global state management (no Redux, no Context). `App.tsx` owns the state and passes it down as props. Child-to-parent communication uses callback props (`onSelectNote`, etc.).

### Discriminated Unions for Selection State

```typescript
type SidebarSelection =
  | { kind: 'filter'; filter: SidebarFilter }
  | { kind: 'sectionGroup'; type: string }
  | { kind: 'folder'; path: string }
  | { kind: 'entity'; entry: VaultEntry }
  | { kind: 'view'; filename: string }
```

### Command Registry

`useCommandRegistry` + `useAppCommands` build a centralized command registry. Commands are registered with labels, shortcuts, and handlers. The `CommandPalette` (Cmd+K) fuzzy-searches this registry. Settings commands can update installation-local preferences directly when they reuse an existing settings path, such as the Light/Dark/System theme-mode actions writing `settings.theme_mode`. Shortcut combos live in `appCommandCatalog.ts`; real keypresses always flow through `useAppKeyboard`, native menu clicks emit the same command IDs through `useMenuEvents`, and `appCommandDispatcher.ts` suppresses the duplicate native/renderer echo from a single shortcut. Plain-text paste follows this same path: the command owns `Cmd+Shift+V`, the menu and palette expose the same action, and `plainTextPaste.ts` resolves the active rich/raw editor target or focused text control before reading clipboard text. On macOS, any browser-reserved chord that WKWebView swallows before that path must also be added to the narrow `tauri-plugin-prevent-default` registration in `src-tauri/src/lib.rs`. On Linux and Windows, `LinuxTitlebar.tsx` and `LinuxMenuButton.tsx` reuse the same command IDs through `trigger_menu_command` because those builds use this app's own custom chrome instead of the native desktop menu bar. The same shortcut manifest also declares the deterministic QA mode for each shortcut-capable command.

Commands whose availability depends on the current note or Git state must also flow through `update_menu_state` so the native menu stays in sync with the command palette. The deleted-note restore action in Changes view is the reference example: the row opens a deleted diff preview, the command palette exposes "Restore Deleted Note", and the Note menu enables the same action only while that preview is active.

Current-note find/replace is a surface-aware command: editor focus enables "Find in Note" / "Replace in Note" and routes Cmd+F into raw CodeMirror mode; note-list focus enables existing note-list search instead. When adding another focus-dependent command, mirror this pattern with an availability event consumed by `useMenuEvents.ts` and `update_menu_state`.

For automated shortcut QA, use the explicit proof path from `appCommandCatalog.ts`:

- `window.__rhizomeTest.triggerShortcutCommand()` for deterministic renderer shortcut-event coverage
- `window.__rhizomeTest.triggerMenuCommand()` for deterministic native menu-command coverage

That browser harness is a deterministic desktop command bridge, not real native accelerator QA. For macOS browser-reserved chords, still perform native QA in the real Tauri app because the webview-init prevent-default layer is only active there. Do not treat flaky synthesized macOS keystrokes as proof that a shortcut works unless you also confirm the visible app behavior.

## Developer pitfalls (current tree)

**Origin:** PR #66 KEEP · 2026-09-14 · not a merge.

Verified against source 2026-09-14. Longer landmine list:
[`CROSS-MODEL-HANDOFF.md`](CROSS-MODEL-HANDOFF.md).

- **One Rhizome at a time.** Debug bundle and `/Applications/Rhizome Agent.app`
  share `ai.rhizome.agent`. Launching a second copy silently forwards to the
  first. Quit the installed app before `pnpm tauri dev`.
- **Chat default.** `useViewMode` returns the Chat preset (`editor-only`) when
  nothing is stored. Notes shut leaves `VaultPanelRestoreButton` (46px rail,
  32px hit target). Inbox toggles; it does not mount Graph. Beside an open
  note folds Sessions/Notes — do not restore hover-collapse on that pane
  (`App.layout-edges.test.ts`). ADR-0173.
- **Graph/Mycelium only on Changes.** `ConnectionsPanel` is gated on
  `isChangesSelection` (`App.layout-edges.test.ts`). Inbox rail is a
  Notes filter. Do not remount Graph under Inbox.
- **Thinking levels come from the host.** Call `get_prime_thinking_levels`
  for the scale and `get_prime_supported_thinking_levels` for the attached
  model's subset of it. Do not hardcode Off → Max in the frontend, and do not
  offer a level the model refuses — Prime clamps it and the click looks dead.
- **Session switch skip-ensure.** `usePrimeSessionSwitcher` skips
  `ensure_prime_session_host` when `hostRunning` is true. Status-poll retry
  of ensure is still required when the host is down. The click must clear the
  transcript immediately; leaving the old messages up is the beachball.
- **Settings catalog is lazy.** Do not fetch `get_available_prime_models` or
  `get_prime_provider_status` until Agents is visible. Do not search the
  Packages catalog until that section is opened. Do not cache a failed
  “host is not running” catalog.
- **Chat default stays Prime.** Settings must not present Prime as an
  optional local-agent alternative. An API-model default must say it
  skips Prime sessions and vault tools.
- **Hide stops ws-bridge and Mindwalk, not spawned Prime.** Red-button
  close hides (C22). `release_helpers_for_hidden_window` stops the
  app-owned MCP bridge and Mindwalk sidecar. **C75:** a Prime daemon
  this process spawned stays warm for fast reopen. Keep-working still
  settles the session as `resident`; it does not change whether the
  daemon stays. Never send Prime `shutdown`. Cmd+Q is the real quit.
- **Packages install is CLI, not the daemon.** `install_prime_package` runs
  `prime-agent package install` (180s). Confirm full system access once.
- **Tab completion is rules-first.** `suggestReply` only. Do not add
  model-backed ghost text (#51 Case 2) without a separate decision.
- **MCP wiki verbs are gone.** `listTools` must not include
  `rhizome_grok_import`, `rhizome_generate_wiki`, or `rhizome_repo_research`.
  Graph queries need `RHIZOME_TOOL_PATH` / packaged `cli-call.mjs`.
  Skill examples must carry a resolved `node` binary and a GUI-safe `PATH`
  (`$HOME/.local/bin` is a `find_node` fallback). Do not tell the in-app
  agent to `import rhizome_vault` or to open `agents/claude/vault-context.md`.
- **MCP frontmatter is data-only.** `mcp-server/vault.js` must not call
  `gray-matter` (its default JS engine evaluates `---javascript`).
  Coffee / coffeescript / cson / `searchNotes` stay data-only too
  (`vault.security.test.js`). The packaged MCP bundle is generated
  (`src-tauri/.gitignore`) — the stamped `/Applications` app `6860762`
  will not pick later MCP bundle work until a separately authorized
  rebuild.
- **Ask the agent about this note** keeps Chat and opens that note
  (`App.test.tsx`). Locked notes are read-only in BlockNote and raw
  (`EditorContentLayout.test.tsx`). Not vault `editor_mode`. Sheets do
  not get a lock this window.
- **Agents idle/working** sits on the Chat composer next to thinking
  (`ChatHome.test.tsx`). The skills pill stays `rhizome-vault` — not a
  vault switcher. A Settings API default remaps to the Prime harness
  (`ChatHome.test.tsx`). Inbox shows in the Notes list only when folder
  mode is on (`App.layout-edges.test.ts`). A long context chip
  truncates and keeps the full name on hover; queued follow-up text
  stays 12px.
- **S3 leftover prefixes** in JS: `ghr_` / `ghu_` / `sk_test_` plus Slack
  `xoxa-` / `xoxr-` / `xoxs-` / `xoxe-` (`sensitiveTextRedaction.test.ts`).
  Native Sentry also scrubs those Slack prefixes plus `hf_` / `npm_` /
  `glpat-`. It still does not scrub `ghr_` or `sk_test_` / `sk_live_` —
  do not widen rust this window.
- **Settings and secrets writes** go through `secure_fs::write_owner_only_atomic`.
  Do not write the real app-support settings or key file in tests.
- **Session-list import** stays blocked until Atticus types **`1`**.
  Do not speak `import_jsonl`. Vault `Imports/` writer already exists.
- **Chat still mounts with no vault** (`ChatHome.test.tsx`). Preflight
  still runs with an empty vault (`ChatPreflightBanner.test.tsx`). Host
  status still polls with an empty path (`usePrimeHostStatus.test.ts`).
  Last-conversation restore needs no vault path. Sessions list still
  loads without `ensure_prime_session_host`. New chat still works with
  no vault. Live Chat-without-vault is **NOT RUN**. Do not close #46
  from units. Welcome Download words stay in `en.json` (C18).
  Chat history shows the C70 clock when a turn has `createdAtMs`.
  Linux titlebar uses `useDragRegion`. #51 Case 2 and #36 timezone
  stay unbuilt. D6 landed `c44ee2b`. Do not `git add -A`.
  Nous Portal models share the Chat picker when the
  catalog includes them. Packaged MCP stays generated/gitignored.
- **First-run Getting Started** is a local folder scaffold (no clone)
  unless `RHIZOME_GETTING_STARTED_REPO_URL` is set. Welcome stays
  clickable offline (`WelcomeScreen.test.tsx`). The ready toast says
  **created and opened**, not cloned (`App.layout-edges.test.ts`).
  Welcome still says Download — leftover words. Do not rewrite `en.json`
  this window (C18). Local scaffold failures say **create**; git-clone
  failures (C11) still say **download** (`gettingStartedVault.test.ts`).
- **`pnpm typecheck` is `tsc -b`.** `npx tsc --noEmit` compiles zero files.
- **English only.** Do not add `en.json` keys or run `pnpm l10n:translate`.
- **ASCII mark.** Copyable fence: [`docs/design/brand/2026-09-13/README.md`](design/brand/2026-09-13/README.md) — the PNG is not selectable text.

## Running Tests

```bash
# Unit tests (fast, no browser)
pnpm test

# Unit tests with coverage (must pass ≥70%)
pnpm test:coverage

# Rust tests
cargo test

# Rust coverage (must pass ≥85% line coverage)
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --ignore-filename-regex "lib\.rs|main\.rs|menu\.rs" --fail-under-lines 85

# Playwright core smoke lane (requires dev server)
BASE_URL="http://localhost:5202" pnpm playwright:smoke

# Full Playwright regression suite
BASE_URL="http://localhost:5202" pnpm playwright:regression

# Single Playwright test
BASE_URL="http://localhost:5202" npx playwright test tests/smoke/<slug>.spec.ts
```

## Common Tasks

### Add a new Tauri command

1. Write the Rust function in the appropriate module (`vault/`, `git/`, etc.)
2. Add a command handler in `commands/`
3. Register it in the `generate_handler![]` macro in `lib.rs`
4. Call it from the frontend via `invoke()` in the appropriate hook or utility, keeping native-only permission work behind the Tauri command boundary
5. Add a mock handler in `mock-tauri.ts`

### Add a new component

1. Create `src/components/MyComponent.tsx`
2. If it needs vault data, receive it as props from the parent
3. Wire it into `App.tsx` or the relevant parent component
4. Add a test file `src/components/MyComponent.test.tsx`

### Add a new entity type

1. Create a type document at the vault root: `mytype.md` with `type: Type` frontmatter (icon, color, order, etc.)
2. The sidebar section groups are auto-generated from type documents — no code change needed if `visible: true`
3. Update `CreateNoteDialog.tsx` type options if users should be able to create it from the dialog
4. Notes of this type are created at the vault root with `type: MyType` in frontmatter — no dedicated folder needed

### Add a command palette entry

1. Register the command in `useAppCommands.ts` via the command registry
2. Add a corresponding menu bar item in `menu.rs` for discoverability
3. If it has a keyboard shortcut, register it in `appCommandCatalog.ts` with the canonical command ID, modifier rule, and deterministic QA mode, then wire the matching native menu item in `menu.rs` if it should also appear in the menu bar
4. If its enabled state depends on runtime selection (active note, deleted preview, Git status, etc.), thread that flag through `useMenuEvents.ts` and `update_menu_state` so the native menu enables/disables correctly

### Modify styling

1. **Global app/theme variables**: Edit `src/index.css`
2. **Editor typography**: Edit `src/theme.json`

### Work with the AI agent

1. **Agent system prompt**: Edit `src/utils/ai-agent.ts` (inline system prompt string)
2. **Context building**: Edit `src/utils/ai-context.ts` for what data is sent to the agent
3. **Tool action display**: Edit `src/components/AiActionCard.tsx`
4. **Permission-mode UI and request plumbing**: Edit `src/lib/aiAgentPermissionMode.ts`, `src/components/AiPanel*.tsx`, `src/hooks/useCliAiAgent.ts`, and `src/utils/streamAiAgent.ts`
5. **Shared CLI runtime behavior**: Edit `src-tauri/src/cli_agent_runtime.rs` for process lifecycle, prompt wrapping, version probing, and common Rhizome MCP path handling.
6. **Agent-specific arguments/events**: Edit the per-agent adapter modules (`claude_cli.rs`, `codex_cli.rs`, `opencode_*`, `pi_*`, `antigravity_*`, `kiro_*`). Keep Codex Safe on `read-only` + `untrusted` and Codex Power User on active-vault `workspace-write` + `never`, keep Pi, Antigravity, and Kiro on transient MCP config, and do not use dangerous permission bypasses unless an ADR explicitly designs a new mode. Pi's transient agent directory must be seeded from the user's existing Pi agent directory before Rhizome MCP is merged so standalone provider/auth setup keeps working. Antigravity Safe uses sandboxed `proceed-in-sandbox`, Power User uses `always-proceed` without `--dangerously-skip-permissions`, and workspace MCP config lives in `.agents/mcp_config.json`. Kiro receives prompt content over stdin and writes Rhizome MCP config into `.kiro/settings/mcp.json` in the active vault.
7. **Availability probing**: Edit `src/hooks/useAiAgentsStatus.ts` and `src-tauri/src/ai_agents.rs` for AI-agent install/status detection. Keep renderer probing deferred until after first paint, skip it when AI features or AI surfaces are unavailable, and keep backend per-agent CLI checks parallel so missing tools do not serialize shell startup cost.

### Work with external MCP setup

1. **Backend registration/status/snippets**: Edit `src-tauri/src/mcp.rs` and its `src-tauri/src/mcp/` helpers; registration and manual config generation must resolve an MCP runtime via `find_mcp_runtime` (Node.js 18+ preferred, Bun 1+ fallback) first, resolve the packaged `mcp-server/` for macOS, Windows executable-adjacent installs such as `%LOCALAPPDATA%\Rhizome` (legacy `%LOCALAPPDATA%\Tolaria` is still accepted), Linux package roots under `usr/lib/rhizome` (legacy `tolaria` dirs are still accepted), and AppImage installs, and use a vault-neutral entry with `WS_UI_PORT=9711`. Client-facing Node script paths strip Windows extended-length `\\?\` prefixes before Rhizome writes durable config or transient agent entries, because stdio MCP clients pass that argument back to Node as the main module path. Linux AppImage startup must extract `mcp-server/` to the app data dir `rhizome/mcp-server` (on Linux, `~/.local/share/rhizome/mcp-server/`) before durable registration uses that stable path. App-owned bridge launches still pass `VAULT_PATH`/`VAULT_PATHS`; durable external registrations rely on the MCP server reading `vaults.json` at tool-call time.
2. **Setup dialog copy/actions**: Edit `src/components/McpSetupDialog.tsx` and `src/hooks/useMcpStatus.ts`; users should see the runtime prerequisite (Node.js 18+ or Bun 1+), the exact generated standard `mcpServers` manual config, the exact generated OpenCode top-level `mcp` config, and copy actions before Rhizome writes third-party config files
3. **Status hook/toasts**: Edit `src/hooks/useMcpStatus.ts` when setup, reconnect, disconnect, or failure messaging changes
4. **Antigravity CLI compatibility**: Keep `~/.gemini/config/mcp_config.json` in the registration path list and keep optional `GEMINI.md` generation behind `restore_vault_ai_guidance`; app-managed Antigravity sessions still require the user to install and sign in to `agy`, but Rhizome supplies workspace MCP config when Antigravity is selected as the default AI agent
5. **OpenCode compatibility**: Keep `~/.config/opencode/opencode.json` in durable registration. OpenCode uses the top-level `mcp` key, `command` as an array, `environment` for env vars, `type: "local"`, and `enabled: true`; it must remain vault-neutral like the standard `mcpServers` entry.
6. **Process lifecycle and vault guidance**: Stdio MCP servers in `mcp-server/index.js` must exit when their external client closes stdin, and the desktop-owned `ws-bridge.js` child must be stopped on vault deselection, vault switch, and app exit. MCP context must include root `AGENTS.md` instructions for every active mounted workspace when those files exist.
