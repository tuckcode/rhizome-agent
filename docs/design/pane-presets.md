# Pane presets — Astra implement packet

**Origin:** Cursor Composer · 2026-09-19 · Atticus: four legal layouts, widths
you can drag, no Hermes free-dock tree.

**Hand this whole file to Astra / Codex.** Implement this plan. Do the extra
tasks you need so the plan actually ships (tests, leftover locks, View menu
names). Do **not** invent a fifth layout or a drag-to-any-edge tree.

## Shipped correction (2026-09-26)

**Origin:** Cursor Grok 4.6 · verified against `src/lib/panePresets.ts`.

The packet below is the implement brief. The live contract is the fit
function, not the 1420 / 1180 compact thresholds named in §3.

- Four stored presets still: `chat` / `notes` / `read` / `workbench`.
- `fitPanePreset` also returns a **workspace state**:
  `conversation` (no note), `desk` (note beside Chat when both floors
  fit without folding a shown column), `stacked` (explicit On top),
  `focused` (Chat / Notes tabs when 420 + 280 cannot both fit).
- Opening a note does **not** fold the Notes list to manufacture a
  desk. That case focuses instead.
- A pinned Sessions rail that cannot take a column becomes a drawer
  (`railFits`). Closing the drawer does not clear the pin.
- Living docs: `ARCHITECTURE.md` § Chat-Centered Layout,
  `YOU-SHOULD-KNOW.md` §2, `CROSS-MODEL-HANDOFF.md` §26.

---

## 1. What this is

Rhizome already has pieces of a modular shell: a thin left rail, Notes
open/shut, Browse open/shut, and a note stacked or beside Chat. They are
separate switches, so the window can clip.

Replace that with **four named layouts**. Each one is a legal combination of
working-sized columns. The user can drag column widths inside a layout. The
window remembers the last layout and those widths.

This is **not** Hermes Desktop's layout tree. Hermes is documented here so you
do not rebuild it:

- User docs: https://hermes-agent.nousresearch.com/docs/user-guide/desktop
- Plugin pane API: https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk
- Tree model: `NousResearch/hermes-agent` `apps/desktop/src/components/pane-shell/tree/`
- Their useful limits: sessions rail 237–360px; under ~640px sides become a
  hover overlay; default tree / persisted tree / reset.

Copy the **limits**. Do not copy the free tree, tear-out, or plugin
contribution registry.

---

## 2. Hard rules (stop and ask if you would break one)

1. **ADR-0166 stays.** Chat is the centre. Do not make Chat a destination that
   replaces the window.
2. **Four layouts only.** Chat, Notes, Read, Workbench. No fifth. No floating
   panels. No dock-to-any-edge. No extra destinations (Research, Graph,
   Mycelium stay where they already live).
3. **Chat never goes under 420px** of content width. If a drag or a window
   shrink would do that, fold a side column instead of crushing Chat.
4. **Default launch is Chat** (Notes shut, Browse shut). Atticus asked this.
   Today's C72 default (`editor-list` = Notes open) is what you are changing.
5. **English only (C18).** Hardcode labels next to the control. Do not add
   `en.json` keys. Do not migrate strings.
6. **Do not** close GitHub issues from units. Do not merge PR #66. Do not
   bump Tiptap / hono / qs. Do not encode C66. Do not wire
   `mutate_queued_message`. Do not start `import_jsonl` (needs Atticus `1`).
7. **Commit only if Atticus says commit.** Stage named paths. Trailer:
   `Co-Authored-By: <your model> <noreply@…>`.
8. If a leftover lock in `src/lib/parked-organs.test.ts` or
   `src/lib/leftover-*.test.ts` still expects the old C72 default or the old
   View names, **update that lock in the same change**. Do not leave a failing
   lock and call it pre-existing.

---

## 3. The four layouts

| Id | User name | Columns | Maps from today |
|---|---|---|---|
| `chat` | Chat | Left rail + Chat | `viewMode: editor-only`, split unused |
| `notes` | Notes | Rail + Chat + Notes list | `editor-list`, stacked |
| `read` | Read | Rail + Chat + open note (beside). Notes list optional | `editor-list` or `editor-only` + `side-by-side` |
| `workbench` | Workbench | Rail + Chat + Notes list + Browse | `all` |

Always-on, not a fifth layout:

- Left **command rail** (46px collapsed / 180–360px when pinned).
  Files: `src/components/CommandRail.tsx`, `src/utils/trafficLights.ts`
  (`COMMAND_RAIL_WIDTH_PX = 46`, `COMMAND_RAIL_EXPANDED_WIDTH_PX = 240`).
- Closed Notes still leaves the **Show Notes** restore strip
  (`src/components/VaultPanel.tsx`). Do not invent a new strip.

Column floors / ceilings (px):

| Column | Min | Default | Max |
|---|---|---|---|
| Command rail (pinned) | 180 | 240 | 360 |
| Notes list | 200 | 240 | 360 |
| Browse | 200 | 240 | 320 |
| Chat content | **420** | flex | flex |
| Open note beside Chat | 280 | 360 | 480 |

Window shrink: below **640px** of shell width, fold Browse then Notes then the
pinned rail, in that order, until Chat still has 420. Do not hide Chat. The
current compact numbers in `src/hooks/useShellCompactLayout.ts`
(`SHELL_COLLAPSE_SESSIONS_WIDTH = 1420`, `SHELL_COLLAPSE_VAULT_PANEL_WIDTH = 1180`)
are too high for this product. Replace them with a function of the floors
above, not those two magic widths.

Reset: one command **Reset layout** returns to `chat` and the default widths.

---

## 4. Persistence (one object, not three switches)

Today's contract is split across:

- `view_mode` in vault config — `src/hooks/useViewMode.ts`
  (`editor-only` / `editor-list` / `all`; default today is `editor-list`)
- `chatNoteSplit` in localStorage — `src/components/chatNoteSplit.ts`
  (`stacked` / `side-by-side`)
- `resolveShellLayout()` — `src/lib/shellLayout.ts`

Keep those files as the compatibility layer so vault config does not break.
Add **one** preset object that is the source of truth at runtime:

```ts
type PanePresetId = 'chat' | 'notes' | 'read' | 'workbench'

type PanePresetState = {
  id: PanePresetId
  widths: {
    rail?: number
    notes?: number
    browse?: number
    note?: number
  }
}
```

Suggested home (create if needed): `src/lib/panePresets.ts`

Mapping you must keep lossless:

| Preset | `viewMode` | `split` |
|---|---|---|
| `chat` | `editor-only` | ignore |
| `notes` | `editor-list` | `stacked` |
| `read` | keep current `editor-list` or `editor-only` | `side-by-side` |
| `workbench` | `all` | `stacked` |

`bumpViewModeToOpenNotes` / `viewModeAfterCollapseNotes` /
`viewModeAfterToggleBrowse` in `src/lib/shellLayout.ts` become wrappers that
set a preset. Do not leave a second independent truth.

Fresh vault / first launch / no stored `view_mode`: **`chat`**, not
`editor-list`. That is the product change Atticus asked for.

---

## 5. Files you will almost certainly edit

Core:

- `src/lib/shellLayout.ts`
- `src/lib/shellLayout.test.ts`
- `src/hooks/useViewMode.ts`
- `src/hooks/useShellCompactLayout.ts`
- `src/components/chatNoteSplit.ts`
- `src/App.tsx` (`showVaultPanel = chatCentered && notesOpen` must stay true
  when the preset has Notes open)
- `src/components/CommandRail.tsx` (Chat / Research / Changes only; Notes is the right strip)
- `src/components/VaultPanel.tsx` (Show Notes strip stays)

Commands / names (C72 leftovers today):

- `src/hooks/commands/viewCommands.ts`
- `src/hooks/commands/viewCommands.c72.test.ts`
- `src/hooks/appCommandCatalog.ts`
- `src/hooks/appCommandCatalog.test.ts`
- `src/components/KeyboardShortcutsDialog.tsx`
- `src/shared/appCommandManifest.ts` (and `appCommandManifest.leftover.test.ts`)

Leftover locks that will fail if you change defaults and leave them:

- `src/lib/parked-organs.test.ts`
- `src/lib/leftover-chat-stays.test.ts`
- `src/App.layout-edges.test.ts`
- `src/components/VaultPanel.leftover.test.ts`
- `tests/smoke/unified-shell-layout.spec.ts`
  (line ~38 still says fresh launch is Notes open)

Do **not** open `src/lib/locales/en.json` to add keys. If a leftover test
reads an existing key, you may keep that key and change the English value
only if the product name changed (`Notes, Browse closed` → `Notes`). Prefer
hardcoded labels in the command file.

Do **not** touch:

- `src-tauri/tauri.conf.json` traffic lights (`x: 14`)
- `src/utils/trafficLights.ts` except if a comment must name the new default
- Prime / tray / provider files
- `docs/adr/0166-chat-centered-shell.md` (do not edit; add a new ADR if the
  persistence shape is a new contract)

New ADR only if you introduce `PanePresetState` as stored JSON. File:
`docs/adr/0173-pane-presets.md`. Supersedes the C72 “fresh launch opens
Notes” sentence, not ADR-0166.

---

## 6. Tests you write (TDD)

Red first.

1. `src/lib/panePresets.test.ts` (or extend `shellLayout.test.ts`)
   - `chat` ⇒ notes shut, browse shut, restore strip on
   - `notes` ⇒ notes open, browse shut
   - `read` ⇒ split `side-by-side`, Chat width floor 420
   - `workbench` ⇒ notes + browse
   - mapping back to `viewMode` is lossless
   - a width drag that would put Chat under 420 is clamped
   - shell width 639 folds a side; 640 can still show Notes if Chat keeps 420
2. `useViewMode`: missing stored mode returns the Chat preset
   (`editor-only`), not `editor-list`.
3. Update C72 command tests to the new names:
   - Chat
   - Notes
   - Read
   - Workbench
   Keep old command **ids** (`view-editor-only`, `view-editor-list`,
   `view-all`) if the menu already routes through them. Add a fourth id for
   Read rather than overloading split. Suggested: `view-read`.
4. Playwright: `tests/smoke/unified-shell-layout.spec.ts` — fresh launch
   does **not** show `vault-panel` until Notes is chosen. Hover rail still
   says **Notes**, not Inbox.

Do not tag cosmetic checks `@smoke`. Do not add a new smoke file unless a
core vault/chat path actually changed.

---

## 7. Suggested order (you may reorder if a test forces it)

1. Write the failing preset tests.
2. Add `src/lib/panePresets.ts` and teach `resolveShellLayout` to consume it.
3. Change `useViewMode` default to Chat.
4. Wire View menu + shortcuts + leftover locks.
5. Replace the 1420 / 1180 compact thresholds.
6. Persist widths per preset (rail already resizes; Notes / Browse / note
   beside should remember).
7. Run `pnpm lint`, `pnpm typecheck`, and the files you touched
   (`npx vitest run src/lib/shellLayout.test.ts src/lib/panePresets.test.ts
   src/hooks/useViewMode.ts src/hooks/commands/viewCommands.c72.test.ts`).
8. Write `docs/adr/0173-pane-presets.md` if you stored a new object.
   Stamp `docs/HANDOFF.md` State with one line: pane presets in source, not
   in `/Applications` until rebuild.
9. Session file: `docs/plans/handoffs/YYYY-MM-DD-HHMM-astra-pane-presets.md`
   with frontmatter `session`, `model`, `description`.
   `pnpm handoff:check` must pass.

Do not push. Do not rebuild `/Applications`.

---

## 8. Freedom you have

- File splits inside `src/lib/` if `panePresets.ts` would get huge.
- Exact View-menu copy as long as the four names stay Chat / Notes / Read /
  Workbench.
- Whether Read keeps the Notes list open (`editor-list` + beside) or hides
  it (`editor-only` + beside). Pick one and test it. Prefer **list hidden**
  so Read is visually distinct from Notes.
- Whether widths live in vault config or localStorage. Vault config is
  better if the same vault opens on two machines; localStorage is fine if
  you do not want a settings migration. Do not invent a third store.
- Extra unit tests you need to keep clippy / leftover locks green.

---

## 9. Freedom you do not have

- A Hermes-style layout tree, Dockview, or plugin pane registry.
- A fifth preset.
- Changing the rail icon that is Notes back to Inbox.
- Making Inbox a panel that expands on launch.
- Localization work.
- Closing #41 / #46 / #52 / #66 from this work.
- Claiming native QA. You will not have `/Applications` unless Atticus
  rebuilds.

---

## 10. Done when

- Fresh launch: Chat, Notes shut, Show Notes strip visible.
- Four View commands switch the four layouts.
- Dragging a divider remembers width for that layout and will not put Chat
  under 420px.
- Narrow window folds sides instead of clipping Chat.
- Leftover locks and C72 tests match the new names.
- Handoff file exists. No push. No rebuild.

If you get stuck, stop and write the blocker in the handoff. Do not invent
layout number five to get unstuck.
