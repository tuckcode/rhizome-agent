# Fix list: App navigation (tool and view entry points)

Source critique: [2026-10-10-design.md](./2026-10-10-design.md). When a new version comes in, change the status to `fixed` or `won't fix` instead of deleting the row.

**Open:** 1 blocker · 9 worth fixing · 4 minor

| ID | Severity | Category | Finding | Fix (tokens) | Status | First seen |
|---|---|---|---|---|---|---|
| A-B1 | blocker | hierarchy and layout | Research/Graph/Mycelium/Changes/History spread over 7 surfaces; none always visible; Mycelium absent from ⌘K and menus | One "Views" group in `CommandRail`, fixed order, always present | open | 2026-10-10 |
| A-W1 | worth fixing | hierarchy and layout | `NotesChromeShortcuts` in the list header mixes 3 destinations + Settings; collapses into the overflow | Remove the group; header keeps sort/columns | open | 2026-10-10 |
| A-W2 | worth fixing | copy | Graph has 4 names, Mycelium 3, Changes 2 commands | Research · Graph · Mycelium · Changes · History; "Show in …" for context actions | open | 2026-10-10 |
| A-W3 | worth fixing | hierarchy and layout | Status bar carries destination buttons; contents change with pill mode | Status only; counts may link | open | 2026-10-10 |
| A-W4 | worth fixing | interaction and states | No tool shortcuts; Research filed under Settings in ⌘K; Go menu incomplete | ⌥⌘1–5 in the manifest, Go menu, ⌘K "Views" group, ⌘/ sheet | open | 2026-10-10 |
| A-W5 | worth fixing | interaction and states | Session "Node map" and note "Mycelium report" ignore their target | Pass the path, or remove | open | 2026-10-10 |
| A-W6 | worth fixing | hierarchy and layout | Composer + menu mixes attach with Research/Mycelium | + menu = message inputs only | open | 2026-10-10 |
| A-W7 | worth fixing | visual design | Research = Sparkle (anti-pattern); Graph = ShareNetwork | MagnifyingGlassPlus/Books; Phosphor `Graph`; GitDiff; ClockCounterClockwise | open | 2026-10-10 |
| A-W8 | worth fixing | interaction and states | Peer tools open in 3 different containers; all exit "Back to chat" | Main area + rail current state; "← {origin}"; ⌘[ / Esc | open | 2026-10-10 |
| A-W9 | worth fixing | hierarchy and layout | Changes among note filters, no count, hard-coded English | Move to rail Views with a `--muted` count badge | open | 2026-10-10 |
| A-M1 | minor | hierarchy and layout | Settings ×5, two gears visible at once | Rail footer + menu + ⌘, only | open | 2026-10-10 |
| A-M2 | minor | hierarchy and layout | Contribute/Docs in the status bar | Help menu + ⌘K | open | 2026-10-10 |
| A-M3 | minor | interaction and states | Placement "off" still shows entry points that lead to "Enable…" | Hide or disable the rail item with a tooltip | open | 2026-10-10 |
| A-M4 | minor | interaction and states | View menu order ⌘1, ⌘2, ⌘4, ⌘3 | Re-key to 1–4 in menu order | open | 2026-10-10 |
