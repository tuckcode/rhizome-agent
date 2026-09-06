---
session: 2026-09-06T21:55Z
model: Grok 4.6 (Cursor)
description: >-
  Area C subtraction: deleted orphan components under src/components/, unused
  exports, and dead dialog/docked/right-panel-chat branches. GraphView default
  export kept (lazy import).
commits: a1cea22
---

# Area C — orphan UI cleanup

**Origin:** Grok 4.6 · 2026-09-06

Verified zero production importers (tests-only does not count as live), then deleted.

## Whole files
`ClaudeCodeOnboardingPrompt`, `CreateNoteDialog`, `NoteAutocomplete`, `NoteIcon`
(+ tests). Removed unused `.note-icon-*` CSS (only those files used it). Live
icon path remains `NoteTitleIcon` / `resolveNoteIcon`.

## Dead exports
`AiPanelContextBar`, `DeletedNotesBanner` (kept `EmptyMessage`), Claude status
badge + `kind: 'claude'`, `LabeledSelect` / `LabeledNumberInput`,
`DISABLED_STYLE`, `getAnchoredDropdownLeft` re-export. Dropped unused default
exports on `ChatPreflightBanner`, `ConfettiCannon`, `GraphControls`,
`GraphLegend`, `PrimeProviderStatusSection`. **Kept** `GraphView` default —
`lazy(() => import(...))` uses it.

## Dead branches
Research is pane-only. AiWorkspace is `side` | `window` (default `side`).
Editor right panel is inspector / TOC only; chat stays the center canvas.
Command palette uses `aiAgentReady` only.

Skipped per brief: dual-shell flags, shadcn migrations, sheet-editor merge,
areas A/B, Tolaria/IPC/MCP grok, DEV memory probe.
