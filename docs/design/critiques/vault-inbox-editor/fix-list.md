# Fix list: Vault inbox + editor + AI Chat

Source critique: [2026-10-10-design.md](./2026-10-10-design.md). When a new version comes in, change the status to `fixed` or `won't fix` instead of deleting the row.

**Open:** 0 blockers · 7 worth fixing · 5 minor

| ID | Severity | Category | Finding | Fix (tokens) | Status | First seen |
|---|---|---|---|---|---|---|
| V-W1 | worth fixing | hierarchy and layout | Empty AI Chat panel takes ~29% of the width | Collapsed by default; 320px when open | open | 2026-10-10 |
| V-W2 | worth fixing | visual design | Sparkle icon + generic copy in the chat empty state | No sparkle; "Ask Claude Code about this note" + suggestions from the note | open | 2026-10-10 |
| V-W3 | worth fixing | hierarchy and layout | Same date twice per row | One relative date in `--muted` | open | 2026-10-10 |
| V-W4 | worth fixing | interaction and states | Selected row: grey box (light) vs mint box (dark) | `--state-selected` + 2px `--accent` left bar in both | open | 2026-10-10 |
| V-W5 | worth fixing | type | Branch/change/build labels in Inter; "4Δ" | JetBrains Mono 11px; "4 changed" | open | 2026-10-10 |
| V-W6 | worth fixing | hierarchy and layout | Type-icon column crammed against the scrollbar | Leading `--muted` glyph or remove; 8px gutter | open | 2026-10-10 |
| V-W7 | worth fixing | copy | Excerpts show raw agent prompts | First prose paragraph or summary | open | 2026-10-10 |
| V-M1 | minor | copy | "Power User" chip unclear | "Full access" + tooltip | open | 2026-10-10 |
| V-M2 | minor | hierarchy and layout | Unlabelled rail icons | See app-navigation A-B1 | open | 2026-10-10 |
| V-M3 | minor | hierarchy and layout | Slug breadcrumb; 5 equal-weight icons | Folder › title; ☆ + ⋯ only | open | 2026-10-10 |
| V-M4 | minor | hierarchy and layout | Contribute/Docs in the status bar | Help menu + palette | open | 2026-10-10 |
| V-M5 | minor | type | H1 wraps a single word | `text-wrap: balance` | open | 2026-10-10 |
