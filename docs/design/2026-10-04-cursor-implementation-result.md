---
session: 2026-10-04T14:54:00-05:00
model: Cursor Grok 4.7
description: >-
  Result of the bounded design corrections from the Astra Cursor handoff.
  Uncommitted. Browser evidence on Windows. Native app not driven.
---

# Cursor implementation result: design defect corrections

**Origin:** Cursor Grok 4.7 · 2026-10-04 · working tree on `main` at `9a48e00`.

This note returns the bounded work in
`docs/plans/handoffs/2026-10-04-1422-astra-cursor-implementation.md`.
It does not update `docs/HANDOFF.md`. Astra owns that status.
The changes are uncommitted. Nothing was pushed. The installed application was not rebuilt.

A later check on this same Windows browser session reported that C89–C92 meet their acceptance conditions in the browser. This note keeps that report separate from the measurements below.

## Checkout

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `9a48e00` (`Run the fake-daemon tests on Windows`) |
| Ahead of `origin/main` | 15 commits, unchanged by this work |
| Commit state | Uncommitted. Do not `git add -A`. |

Unrelated dirty paths were left alone: `.gitignore`, `AGENTS.md`, `README.md`, `demo-vault-v2/AGENTS.md`, `docs/HANDOFF.md`, older plans, `my-marketplace/`, and the audit evidence under `docs/design/2026-10-04-ui-audit/`.

## Changed paths

Product:

- `index.html`
- `src/main.tsx`
- `src/index.css`
- `src/lib/themeMode.ts`
- `src/components/BootSplash.tsx`
- `src/components/BootSplash.css`
- `src/components/SettingsPanel.tsx`
- `src/components/SettingsFooter.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/badge.tsx`
- `src/components/BulkActionBar.tsx`

Tests:

- `src/main.test.ts`
- `src/lib/themeMode.test.ts`
- `src/index.bootAppearance.test.ts` (new)
- `src/components/BootSplash.test.tsx`
- `src/components/SettingsPanel.test.tsx`
- `src/components/ui/button.destructive.test.tsx` (new)

`BulkActionBar.tsx` and `badge.tsx` are outside the handoff file list. Both repeated the destructive hover treatment that drops light-mode text below 4.5:1. The shared button change would not have won there, because those call sites pass their own hover class.

## What changed

### C89 / F01–F03 — splash continuity

The HTML bootstrap now reads `rhizome-theme`, `rhizome-color-theme`, and `rhizome-accent` first, then the `tolaria-*` keys, and copies a legacy value forward. It no longer prefers `tolaria-theme` or falls back to `laputa-theme`. That matches `readStoredThemeMode`, `readStoredColorTheme`, and `readStoredAccentColor`.

System mode still uses `prefers-color-scheme`. A named theme still pins polarity before the first paint. React's first paint calls `applyStoredAppearance`, so it no longer overwrites that polarity with theme mode alone.

The first-paint page background is the current sidebar surface (`#E9ECE5` / `#10150E`). The splash card dark surface is the current panel (`#151A12`). Accent attributes set `--primary` to the same hex values the theme uses, until `index.css` loads and replaces them.

`BootSplash.css` declares the local JetBrains Mono 600 face from `src/assets/fonts/jetbrains-mono-600-latin.woff2`. The HTML splash records `window.__rhizomeBootStartedAt`. The React splash sets `--boot-elapsed` from that clock, and the entrance delays subtract it. Reduced motion, the hidden-document pause, and the startup reload script are unchanged. Readiness is not delayed for the animation.

### C90 / F04 — dark variants and destructive contrast

`src/index.css` sets Tailwind's dark variant to `&:where(.dark, .dark *)`. Portaled controls under `html.dark` follow the application theme. The default `--primary: var(--accent-blue)` alias was not changed.

Destructive buttons and badges no longer use `dark:bg-destructive/60`. Hover is `destructive/95` so the light-mode composited text stays at or above 4.5:1. Disabled controls still use the shared `disabled:opacity-50` treatment.

### C91 / F05 — Settings dialog and focus

The settings panel is one `role="dialog"` with `aria-modal="true"` and the name "Settings". The existing focus trap remains the only trap. On open, the panel remembers the focused control. On close, it returns focus there. Escape does not close Settings when the event is inside a settings portal, listbox, menu, or a different dialog.

Cancel, Save, and immediate appearance persistence were not changed. F07 stays open.

### C92 — labels and the shortcut only

Color theme controls are shadcn buttons in two columns, with wrapping 12px labels. At a viewport of 520px or narrower the grid is one column. The footer uses `getAppCommandShortcutDisplay` for `app-settings` (`CmdOrCtrl+,` in the manifest). On this Windows browser that text is `Ctrl+, to open settings`. The macOS string remains `⌘, to open settings` when the user agent is Macintosh.

This does not close the rest of C92.

## Commands and results

Focused tests, exit 0:

```text
pnpm exec vitest run src/components/BootSplash.test.tsx src/components/BrandMark.test.tsx src/main.test.ts src/lib/themeMode.test.ts src/index.theme.test.ts src/index.bootAppearance.test.ts src/components/SettingsPanel.test.tsx src/components/ui/button.destructive.test.tsx
```

A later run of the correction files was 126 passed. The destructive-button file was re-run after the assertion was reworded: 1 passed. An independent check of 8 files reported 131 passed, exit 0.

`pnpm typecheck` (`tsc -b`): exit 0.

`pnpm lint` (`eslint . --max-warnings=0`): exit 1. The only error is pre-existing and outside this change:

```text
my-marketplace/plugins/turn-tally/hooks/register.ts
  7:24  error  Unnecessary escape character: \/  no-useless-escape
```

That tree was left untouched. `eslint` on the TypeScript files in this change: exit 0.

`pnpm test`: exit 1. 794 files passed, 1 skipped, 2 failed. 6927 tests passed, 1 skipped, 2 failed. Both failures expect `fast-uri: 3.1.6` in the workspace pin. HEAD already contains `672fde0` (`Bump fast-uri override to 3.1.7`). This change does not edit that pin.

`pnpm test:coverage`: exit 1, same two failures, same counts (duration 346s). The script stopped before it printed a coverage percentage, and `coverage/coverage-summary.json` was not written. The 70% line was therefore not measured on this run.

`pnpm build`: exit 0 (21.6s on the second run). The production stylesheet is linked from `dist/index.html` before the splash markup. It contains:

```text
@font-face{font-family:JetBrains Mono;font-weight:600;src:url(/assets/jetbrains-mono-600-latin-DGStcf2-.woff2)}
```

That file exists at `dist/assets/jetbrains-mono-600-latin-DGStcf2-.woff2`. The built CSS uses `.dark` (`:where(.dark,.dark *)`) and contains no `prefers-color-scheme: dark` rule. The Google Fonts link for Inter and IBM Plex Mono is still in `index.html`. The wordmark face does not depend on it.

## Browser evidence (Windows, Vite at `http://localhost:5202/`)

This is browser evidence, not a native WebView2 session.

With only `rhizome-theme=dark`, after load:

- `data-theme` is `dark`
- `html` has the `dark` class
- the document background is `rgb(16, 21, 14)` (`#10150E`)

The splash node was already gone when the first probe ran, so this session did not photograph the HTML-to-React animation handoff. The boot script test executes the inline script. The dev server did request `http://localhost:5202/src/assets/fonts/jetbrains-mono-600-latin.woff2`.

Settings, opened from the Settings button:

- dialog name "Settings", `aria-modal="true"`
- footer text `Ctrl+, to open settings`
- at 1400×900 the theme grid is `206.5px 206.5px`; no label clipped
- at 834×700 the grid is `233px 233px`; no label clipped; no horizontal page overflow
- at 480×400 the grid is one `343px` column; dialog width 432px; no label clipped; no horizontal page overflow
- Escape closed Settings and focus returned to the Settings button

Destructive probe on the live theme tokens, after the color transition:

| Application theme | State | Text | Composited background | Contrast |
|---|---|---|---|---|
| Dark | normal | `rgb(14, 18, 12)` | `rgb(232, 131, 124)` | 7.176:1 |
| Dark | hover 95% | `rgb(14, 18, 12)` | `rgb(221, 126, 119)` over panel `rgb(21, 26, 18)` | 6.596:1 |
| Light | normal | `rgb(247, 248, 245)` | `rgb(192, 61, 48)` | 4.986:1 |
| Light | hover 95% | `rgb(247, 248, 245)` | `rgb(195, 70, 58)` over panel `rgb(247, 248, 245)` | 4.627:1 |

Light mode had no `dark` class, so the operating-system preference was not selecting the dark treatment. Focus keeps the opaque fill. The ring does not replace it.

Disabled, calculated from `opacity: 0.5` over the panel, not from a forced browser pseudo-class:

- light 2.152:1
- dark 2.712:1

That is the existing disabled treatment. It was not used as a reason to leave the normal or hover fill translucent.

An independent browser pass on this machine later reported all four corrections accepted, including all four operating-system/application light-dark combinations for C90. Those four OS combinations were not re-measured in the Cursor browser session above. The CSS build shows the dark variant is class-based, which is what makes the application theme win over the operating-system preference.

## Native evidence (Windows, cua-driver, added after the Cursor session)

The native Windows app was run from this same checkout via `pnpm tauri dev`
(PowerShell with the Machine+User PATH reset, because git-bash's GNU
coreutils `link` poisons cargo). The active model drives it with the
`computer_use` tool, which uses cua-driver — a separate mechanism from the
`computer-use` / Orca skill. Orca is not needed for this path.

- Dark mode renders on window load. The wordmark `rhizome` is present.
- `Ctrl+,` opens Settings from the frontmost Rhizome window. The footer
  text `Ctrl+, to open settings` and the Cancel/Save buttons appeared
  when Settings was open. The native accelerator matches the displayed
  hint.
- Settings exposes a modal overlay: a full-window `Close settings` control
  bounds the backdrop, plus a visible `Settings` title and sidebar
  (Sync & Updates, Vaults, Git, Appearance, Content, AI Agents, Packages,
  Workflow, Telemetry, About).
- The color-theme area is a two-column grid. The AX tree lists all 15
  names with no truncation: Rhizome, Dracula, Nord, Gruvbox Dark,
  Gruvbox Light, Solarized Light, Solarized Dark, Catppuccin Mocha,
  Catppuccin Latte, Tokyo Night, One Dark, Rosé Pine, GitHub Light,
  Everforest, Monokai Pro. Escape closed the modal back to the app.
- An observed `EPERM ... rename ...session-leases...lock` was Prime
  session-lease noise, not an app defect; it cleared on a manual refresh
  and did not affect the checks above.

No installer was built. The MacBook review is still outstanding.

## Acceptance not verified here

- A photographed HTML splash and React splash in one delayed navigation, including the animation clock across the replacement.
- Named-theme colors before `themes.css` loads. Polarity and `data-color-theme` are set first. The named palette still arrives with the stylesheet.
- The four operating-system preference × application theme combinations inside one Cursor-driven page. The class selector and the later browser pass cover that claim.
- A printed frontend coverage percentage. The coverage command ran and failed closed on the two pre-existing `fast-uri` tests.
- `pnpm lint` for the whole repo, because of the untouched `my-marketplace` escape warning.
- Native macOS.
- F07 (Cancel versus immediate appearance save).
- The rest of C92.

## Unresolved defects

- F07 / the rest of C92. Appearance still applies immediately. Cancel and Save were not redesigned.
- Repo lint is red on `my-marketplace/plugins/turn-tally/hooks/register.ts`.
- `pnpm test` and `pnpm test:coverage` are red on the `fast-uri: 3.1.6` pin assertions. The pin on HEAD is 3.1.7.
- Disabled destructive text remains under 4.5:1 because the control is at 50% opacity.
