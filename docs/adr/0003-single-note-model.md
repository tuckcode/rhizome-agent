---
type: ADR
id: "0003"
title: "Single note open at a time (no tabs)"
status: active
date: 2026-03-24
---

## Context

The app originally had a tab bar allowing multiple notes to be open simultaneously (similar to a browser or code editor). After building and shipping it, the tab model was found to add significant UI complexity, state management overhead, and confusion — without a proportional benefit for a notes app.

## Decision

**Remove the tab bar. Only one note is open at a time.** Navigation history (Back/Forward with Cmd+[/]) replaces tabs for moving between recently visited notes. Closed tab history and `useTabManagement` are removed.

## Alternatives considered

- **Keep tabs**: familiar UX, allows comparing notes side by side. Rejected — adds ~2000 lines of complexity, confusing state (which tab is "active"?), and breaks the "editor is sacred" principle.
- **Tabs + single-note toggle**: configurable per user. Rejected — doubles the state surface and testing burden.
- **Split pane (two notes at once)**: useful for reference. Deferred — can be added later without tabs, via a dedicated split layout.

## Consequences

- Removes ~2000 lines of code (`TabBar`, `useClosedTabHistory`, `useEditorTabSwap`, `tabLayout`)
- `handleSelectNote` replaces the current note instead of adding a tab
- Cmd+W (close tab) and Cmd+Shift+T (reopen closed tab) removed from shortcuts
- Back/Forward navigation (Cmd+[/Cmd+]) preserves history without tab state
- Significant simplification of `App.tsx` and editor state
- Triggers re-evaluation if: multi-note workflows become a top user request
