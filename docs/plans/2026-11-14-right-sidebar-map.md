# Right sidebar state map

**Origin:** GPT-6.1 Terra · 2026-11-14 · source audit of `origin/main` at `8e704704`

This map describes the chat-centered shell. It is a static source audit. It does not establish native or browser behavior. The screenshots requested in the earlier run record are not part of this audit. Verify the interaction paths in a running app before choosing a replacement model.

## State and storage

The pane preset and the Notes panel mode are separate controls. `useViewMode` stores the active preset and each preset's saved widths in localStorage `rhizome:pane-presets:v1:<vault path>` (`src/hooks/useViewMode.ts:16`, `src/lib/panePresetStorage.ts:10`, `src/constants/appStorage.ts:5`). Preset changes also write vault config `view_mode` and localStorage `rhizome:chat-note-split` as compatibility mirrors (`src/hooks/useViewMode.ts:31`). A missing preset starts at Chat (`src/lib/panePresetStorage.ts:30`).

`useNotesPanelMode` stores Auto, Rail, or Open in localStorage `rhizome:notes-panel-mode:<window label>` (`src/lib/notesPanelMode.ts:11`, `src/hooks/useNotesPanelMode.ts:19`). Its default is Open because the command rail defaults to pinned (`src/lib/notesPanelMode.ts:20`, `src/lib/railChrome.ts:14`). `notesSessionOpen`, hover, focus, and menu state live in memory (`src/App.tsx:1457`, `src/App.tsx:1768`, `src/hooks/useHoverExpandPanel.ts:41`). The selected filter also lives in memory (`src/App.tsx:210`).

The fitted preset decides whether Notes and Browse fit. Stored Open falls back to Auto when Notes does not fit. A session-open request can override the fitted mode while Notes fits (`src/App.tsx:1770`). `showVaultPanel` renders a dock only when Notes fits and the effective mode is Open. Otherwise `NotesRail` renders unless a canvas hides it (`src/App.tsx:2147`).

## Triggers and transitions

Storage abbreviations: **P** is the per-vault preset key above. **M** is the per-window mode key. **Memory** means no persistent write for that transition. Preset writes also update the compatibility mirrors above.

| Trigger and source | Before → after | Storage |
|---|---|---|
| Panel control menu, `NotesPanelModeControl` (`src/components/NotesPanelModeControl.tsx:43`, `src/App.tsx:1786`) | Choose Open: clear session override, set mode Open, request Notes. Choose Auto or Rail: clear override, set mode, collapse Notes to Chat. The trigger opens a menu rather than directly toggling. | M and P |
| Cmd+Shift+Period on Mac, Ctrl+Shift+Period elsewhere (`src/lib/notesPanelMode.ts:87`, `src/hooks/useNotesPanelMode.ts:28`) | Cycle Auto → Rail → Open → Auto when focus is outside an editable control. This calls the hook's `setMode` directly, rather than the App menu handler. Its full visible effect from every preset is **unconfirmed**. | M |
| Auto hover or focus (`src/hooks/useHoverExpandPanel.ts:74`, `:90`, `:123`; `src/App.tsx:1781`) | Closed rail → overlay after 150 ms hover or immediately on focus. Pointer exit closes after 300 ms unless focus, menu, or typing holds it. Escape closes and returns focus. A left overlay blocks the request. Rail mode does not hover-expand. | Memory |
| Right rail Inbox, All Notes, Changes (`src/lib/notesRailItems.ts:15`, `src/components/NotesRail.tsx:151`, `src/App.tsx:2590`) | Select the corresponding filter and reset the list filter. Inbox exists only when explicit organization is enabled. The handler does not itself request a preset change. Auto hover or focus can expose the sheet around the click. | Memory |
| Recent note icon (`src/lib/notesRailItems.ts:51`, `src/App.tsx:2593`) | Select a note through the normal note handler. Up to five non-archived, non-binary entries appear by modified time. Opening a note can change fitted workspace geometry. The icons have accessible labels and tooltips, but no persistent text label. | Note selection state; preset geometry is fitted without a width write |
| Browse button or overflow action (`src/components/VaultPanel.tsx:67`, `:105`, `src/hooks/useChatCenteredShellLayout.ts:37`) | Notes → Workbench opens Browse. Workbench → Notes closes Browse. The same control is present in the overlay sheet. | P |
| Hide Chat / Show Chat (`src/components/VaultPanel.tsx:81`, `src/App.tsx:1761`, `:2188`) | Toggle Notes focus. When no note is active, the panel fills the available window and its resize handle is hidden. Opening or hiding Notes clears focus. | Memory |
| Show Notes restore (`src/components/VaultPanel.tsx:170`, `src/App.tsx:2618`) | Closed Notes → request Notes, preserving Workbench if already active. The restore button renders only when the rail does not. | P |
| Notes collapse fallback (`src/components/VaultPanel.tsx:140`, `src/App.tsx:1796`) | Set Auto and collapse to Chat. The usual mounted panel receives a mode control, so the fallback button's reachability in this shell is **unconfirmed**. | M and P |
| Graph status action or session footprint (`src/App.tsx:1801`, `:1812`) | Request Notes, select Changes, and open Graph or Mycelium in Connections. The separate left rail Graph/Mycelium destinations select canvas views (`src/App.tsx:622`, `:654`). | P for request; Connections request in memory |
| Pulse/history (`src/App.tsx:1774`, `:640`) | Set session-open, request Notes, select Pulse. | P and memory |
| Window width changes (`src/lib/panePresets.ts:64`) | Fit widths down to their minima. If still too narrow, fold Browse, Notes, pinned Sessions rail, then beside-note placement. Saved widths stay intact. A note can use desk, stacked, or focused workspace. | Memory only |
| Notes or Browse resize handle (`src/App.tsx:2190`, `src/components/VaultPanel.tsx:155`, `src/hooks/useChatCenteredShellLayout.ts:53`) | Change the fitted column width within its limits and available room. The dock has a Notes handle. The overlay child has a Browse handle but no equivalent Notes handle in this wiring. | P |
| Open note divider or Sessions rail resize (`src/App.tsx:2306`, `:2443`) | Change note or rail width when the relevant control is active. | P |

## Layout commands

The View menu and command palette provide the same named commands (`src/hooks/commands/viewCommands.ts:139`, `src/shared/appCommandManifest.json:825`). The shortcuts are Cmd on Mac and Ctrl elsewhere (`src/shared/appCommandManifest.json:199`). Each command changes the current preset from any prior preset. Narrow fitting and the separate panel mode still affect the rendered result.

| Command | Requested state | Storage |
|---|---|---|
| Chat, Cmd/Ctrl+1 | `chat`: Notes and Browse shut; an open note may still sit beside Chat if room permits. | P; session-open false |
| Notes, Cmd/Ctrl+2 | `notes`: Notes requested, Browse shut. | P; session-open true |
| Workbench, Cmd/Ctrl+3 | `workbench`: Notes and Browse requested. | P; session-open true |
| Read, Cmd/Ctrl+4 | `read`: new Read hides Notes and requests the open note beside Chat. A stored migrated Read can carry `readNotes`. The command creates a new active state without that flag. | P |
| Reset layout | Chat, clear saved preset widths, unpin Sessions rail. | P and `rhizome:command-rail-expanded` |

See `src/lib/panePresets.ts:34` for legacy mapping and `:64` for fitting. `src/App.tsx:1458` sets the session override for the first three commands. Read and Reset use separate handlers at `src/App.tsx:1931`.

## Widths

Values below are CSS pixels. Preset limits and defaults are in `src/lib/panePresets.ts:19`. The fit can reduce a displayed width or fold a column without saving that reduction. Chat has a 420 px minimum. The collapsed rail and restore strip are 46 px. The note divider is 4 px.

| Surface | Minimum | Default | Maximum | Storage |
|---|---:|---:|---:|---|
| Sessions rail, expanded | 180 | 240 | 360 | P |
| Notes list | 200 | 240 | 1200 | P |
| Browse | 200 | 240 | 320 | P |
| Open note beside Chat | 280 | 360 | 480 | P |
| Notes rail | 46 | 46 | 46 collapsed | Computed |
| Notes Auto overlay | 46 rail plus sheet | Notes + optional Browse fitted widths | Subject to fitted widths | P supplies widths; expansion is memory |

`NotesRail` reserves only 46 px when overlaying, positions the sheet over the adjacent content, and subtracts 46 px from the requested panel width for the sheet (`src/components/NotesRail.tsx:83`, `:111`, `:188`). Its child still receives the full Notes and Browse widths (`src/App.tsx:2583`). This is a source-level explanation for a possible width mismatch and clipping. Confirm the actual layout at runtime.

The classic shell has separate `rhizome:layout-panels` widths (`src/hooks/useLayoutPanels.ts:5`): sidebar 250/250/400, note list 220/240/500, inspector 240/280/500, graph preview 280/340/560, listed as minimum/default/maximum. The default note list uses the 240 px command rail width (`src/utils/trafficLights.ts:23`). The inspector is a separate editor panel. The classic values do not define the chat-centered preset limits.

## Row text

Sizes below are explicit pixel utilities. Weight 400 is inherited from the root or row where no child weight is set. `foreground` and `muted-foreground` are semantic color tokens.

| Row | Title | Preview | Meta |
|---|---|---|---|
| `NoteItem` | 13 px, 500; selected non-binary 600. `text-foreground`; binary uses `text-muted-foreground` (`src/components/NoteItem.tsx:286`). | 12 px, inherited 400, `text-muted-foreground`, up to two lines (`src/components/NoteItem.tsx:144`). | Date row 10 px, inherited 400, `text-muted-foreground` (`src/components/NoteItem.tsx:333`). A workspace badge has its own 9 px mono and accent-blue style (`:322`). |
| `PrimeSessionList` | 11 px, 400, `text-foreground` (`src/components/PrimeSessionList.tsx:322`). | No separate preview in this row. | 11 px, 400, mono, `text-muted-foreground` (`src/components/PrimeSessionList.tsx:352`). |

## Overlaps and unresolved questions

- The panel menu and preset commands both affect Notes, but persist under different scopes. The shortcut changes mode without invoking the menu's preset transition. Test their combinations, including after restart.
- ADR-0173 calls fresh launch Chat with Notes shut. The mode default is Open. The fit converts that mode to Auto when the Chat preset has no Notes column. This is consistent as separate state, but the apparent default depends on which state is inspected.
- ADR-0170 describes Graph and Mycelium beneath Notes. Current source also has full-canvas left rail destinations. The status Graph and session footprint use Connections. Check which entry points remain visible in the running build.
- The handoff estimates note title at 14 px and preview at 13 px. Source specifies 13 px and 12 px. The actual rendered appearance and the clipping report need runtime confirmation.
- The handoff records a possible transcript clearing when Notes opens as C104. That observation remains unconfirmed. This audit did not reproduce it.
