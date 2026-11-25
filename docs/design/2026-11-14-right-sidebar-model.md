# Right sidebar and note list: design decision

**Origin:** Claude Fable 5.2 (Claude Code desktop) · 2026-11-14 · front-end run, plan item 11

Atticus asked for a rethink of the side panels on 2026-11-14. He named three things: the panel widths, the note title that blends into the preview, and how the right sidebar opens and closes.

This note is the decision. It is the input for the implementation PRs. The evidence is the source map in `docs/plans/2026-11-14-right-sidebar-map.md` (PR #293) and the screenshots in `docs/review-shots/ux-baseline/` (PR #291).

## 1. What is wrong today

**Two state machines control one panel.**

- The pane preset (Chat, Notes, Workbench, Read) is stored per vault. ADR-0173 calls it the runtime source of truth.
- The Notes panel mode (Auto, Rail, Open) is stored per window. No ADR records it.
- A preset command and the mode menu both open and close Notes. They write to different keys. The result depends on which one the user touched last.
- The mode shortcut changes the mode and skips the preset change that the mode menu makes.

**The same rail icon does different things.**

- Inbox, All Notes and Changes on the right rail select a filter. They do not open the panel.
- Changes in the Browse tree selects the same filter and does open the panel.
- In Auto mode a hover or a focus opens a sheet over the content. So one click can show the list, and the next click on the same icon can show nothing.

**The sheet covers the content and cuts its own rows.**

- The sheet lies over the open note, the Command Palette button and the Send button (`graphite-note-open.png`, `graphite-notes-panel.png`).
- The rail subtracts 46px from the sheet width, but the list inside still gets the full width. The source map names this as the probable cause of the cut rows.

**The text in a row has no clear order.**

| Row | Title | Preview | Meta |
|---|---|---|---|
| Note | 13px, weight 500 | 12px, weight 400 | 10px |
| Session | 11px, weight 400 | none | 11px mono |

- A note title is 1px larger than its preview. The title and the preview read as one block.
- A session title and its meta line have the same size and the same weight.
- 10px meta text and a 9px badge are below the 11px floor in `docs/design/ui-rules.md`.

**Other points.**

- "Notes" shows twice as a heading.
- The right rail shows up to five recent notes as type icons with no text. Five notes of one type show five equal icons.
- The Notes list can be 1200px wide. The Browse column stops at 320px.

## 2. Decision

### 2.1 One state

**The right side has two states: closed and docked.** The user sees a 46px rail, or the rail and the Notes list beside the content.

- The pane preset is the only stored state (ADR-0173). The per-window mode key goes.
- The Auto mode and the Rail mode go. No surface opens on hover.
- The "Panel" control becomes one toggle button. It has no menu. Its label is "Show notes" or "Hide notes".
- `Cmd+Shift+Period` (Mac) and `Ctrl+Shift+Period` do the same toggle.
- The preset commands keep their meaning: Chat closes Notes, Notes docks it, Workbench docks Notes and Browse, Read puts the open note beside Chat.

### 2.2 A docked list pushes the content

- A docked list never lies over the note, the chat header or the composer. The content gets narrower.
- If the window is too narrow to dock the list (Chat keeps its 420px floor), a click on the toggle opens the list as a sheet. A click opens it. Esc, a click outside it, or the choice of a note closes it. The sheet has the same width as the docked list, so no row is cut.

### 2.3 The rail

- Inbox, All Notes and Changes each open the docked list with that filter. A click on the icon of the filter that is already shown closes the list.
- The recent-note icons leave the rail. The same notes are the first rows of the list.
- Each rail icon keeps its `aria-label` and its tooltip.

### 2.4 Widths

| Surface | Minimum | Default | Maximum |
|---|---|---|---|
| Sessions rail, expanded | 200 | 240 | 360 |
| Notes list | 240 | 300 | 420 |
| Browse | 200 | 240 | 320 |
| Open note beside Chat | 320 | 420 | 640 |

- A note list at 240px cuts a two-line preview after about 5 words. 300px gives about 8.
- A note beside Chat at 360px is too narrow to read. 420px is the default and 640px is the limit.
- A stored width outside the new limits is clamped when it is read. No migration step is necessary.

### 2.5 Row text

All sizes use the tokens from PR #294.

| Row | Title | Preview | Meta |
|---|---|---|---|
| Note | `text-body` (14px), weight 600, `text-foreground`, one line | `text-small` (12px), weight 400, `text-muted-foreground`, two lines | `text-meta` (11px), `text-muted-foreground` |
| Session | `text-control` (13px), weight 500, `text-foreground`, one line | none | `text-meta` (11px), mono, `text-muted-foreground` |

- Size, weight and color each separate the title from the preview. One of the three alone is too weak.
- 4px between the title and the preview. 6px between the preview and the meta line.
- The workspace badge moves from 9px to `text-meta`.
- A selected row keeps `--state-selected` and a 2px bar. The bar uses `primary`, so the accent picker applies. The selected title keeps weight 600. Selection does not change the weight.

### 2.6 One heading

- The panel header shows the name of the filter (Inbox, All Notes, Changes) and the count. It replaces both "Notes" headings.
- Sort, search and the overflow menu stay at the right of that header.

## 3. Check in the running app first

The source map is a static audit. The first implementation PR must confirm these four points in the browser build, with a screenshot of each, before it changes behaviour:

1. With the Chat preset, a click on All Notes in the rail. Does the list show?
2. The same in each of the three modes.
3. The cut rows at the right edge of the sheet, and the 46px cause.
4. C104: does the transcript clear when the Notes panel opens?

If a point differs from section 1, record it in the PR and adjust the fix. Do not adjust the decision in section 2 without a note to Atticus.

## 4. Implementation order

| PR | Content | Depends on |
|---|---|---|
| 11a | Row text (2.5), one heading (2.6), the 2px bar on `primary`. No behaviour change. | #294 |
| 11b | Widths (2.4) with the clamp on read. | none |
| 11c | One state (2.1), the docked list and the sheet (2.2), the rail (2.3). An ADR records the removal of the Auto and Rail modes. | 11a, 11b |

Each PR has before and after screenshots in Graphite and Earth light. 11c changes its tests to the new behaviour. `src/lib/notesPanelMode.ts` and `useHoverExpandPanel.ts` lose their callers in 11c. Grep for the file names before a delete, as `AGENTS.md` says.

## 5. What this does not change

- ADR-0170: Notes stays the heavy right panel, and Graph and Mycelium keep their place.
- ADR-0173: the four presets stay, and Chat stays the fresh-launch default.
- The classic shell (`ff_shell_command_rail=false`) and its `rhizome:layout-panels` widths.

## 6. For Atticus

- **The Auto mode and the Rail mode go.** If you use the hover behaviour, say so before 11c starts.
- **The recent-note icons leave the rail.** A pinned-notes rail is a possible later feature. It needs labels.
