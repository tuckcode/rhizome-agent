# Menu-bar companion skeleton — session status (2026-07-19)

Skeleton only for the macOS menu-bar companion (tray mark + popover
webview). Design sources: `design/menu-bar-companion/index.html`,
integration contracts in `docs/design/shell-final-direction.md` §5.

**UPDATE 2026-07-19 (later session):** skeleton committed, plus three of
the "next slices" below are now WIRED + committed (`11e7ca65`): capture →
`create_note_content`, activity feed → `rhizome_read_events`, and vault
context → `load_vault_list` (new `useMenuBarCompanionVault` hook +
`menuBarCapture`/`menuBarActivity` pure helpers, 20 tests). Type chips now
show the real seeded set (Note + 7 Portent types). **Native tray QA still
pending.** The "Not done" list below is accurate MINUS those three items.
Per user, the next-session priority is save-to-wiki reliability, not
finishing the remaining companion stubs — see HANDOFF pickup item 1.

## Done

- **Rust tray + window** (`src-tauri/src/menu_bar_companion.rs`):
  - Tray template icon from `src-tauri/icons/tray/mark-template-32.png`
    (geometry from companion `mark-white.svg`; macOS `set_icon_as_template(true)`).
  - Left-click toggles popover; positions under tray rect.
  - Right-click menu: Open Rhizome / Quit Rhizome.
  - Hidden webview label `menu-bar-companion`, 360×480, undecorated,
    always-on-top, skip taskbar.
  - Commands: `toggle_menu_bar_companion`, `hide_menu_bar_companion`,
    `open_main_from_menu_bar_companion`.
  - Wired in `lib.rs` setup + `generate_handler!`.
- **Capabilities:** `menu-bar-companion` added to
  `src-tauri/capabilities/default.json` windows list.
- **Frontend route:** `isMenuBarCompanionWindow()` in
  `src/utils/windowMode.ts`; `App.tsx` branches to
  `MenuBarCompanionApp` before AI-workspace / main.
- **Skeleton UI** (`src/components/MenuBarCompanionApp.tsx`): capture
  field, Tab type chips, Distill clipboard / Search vault rows (stubs),
  empty network activity, vault unset row, Open Rhizome footer; blur
  hides popover.
- **i18n:** keys under `menuBarCompanion.*` in `src/lib/locales/en.json`
  (other locales fall back to en until `pnpm l10n:translate`).
- **Tests:**
  - `cargo test --lib menu_bar_companion` green.
  - Vitest: `MenuBarCompanionApp.test.tsx`, `windowMode` companion
    cases, capabilities window-label assertion — 28 tests green in that
    slice.

## Not done (next slices)

- Capture Enter → `create_note_content` (+ optional type chip).
- Distill clipboard → `start_rhizome_job` / `rhizome_distill` with
  `trigger: "menu_bar"` (prototype footer note).
- Search vault → focus main + open search (not just Open Rhizome).
- Network activity feed from shared vault-activity stream
  (`.rhizome/events.jsonl` / `rhizome_read_events`) — same verbs as
  shell §5 (wrote / distilled / edited).
- Vault name + sync meta row from selected vault.
- Tray status-dot grammar (off / quiet / pulse / error) shared with
  rail/agents pill.
- Global shortcuts ⌥V / ⌥F / ⌥R (no `global-shortcut` plugin yet).
- Native QA on real tray (`pnpm tauri dev`).
- Commit + `pnpm l10n:translate` for non-en locales.

## Key paths

| Path | Role |
|------|------|
| `src-tauri/src/menu_bar_companion.rs` | Tray + window + commands |
| `src-tauri/icons/tray/` | Template PNGs |
| `src/components/MenuBarCompanionApp.tsx` | Popover UI skeleton |
| `src/utils/windowMode.ts` | Label/query detection |
| `design/menu-bar-companion/index.html` | Design source of truth |
| `docs/HANDOFF.md` | Pickup checklist item 4 |

## Pickup command

```bash
cd ~/code/projects/rhizome-desktop
pnpm tauri dev
# click menu-bar Rhizome mark → popover; Open Rhizome focuses main
```
