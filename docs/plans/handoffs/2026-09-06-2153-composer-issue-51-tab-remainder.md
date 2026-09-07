---
session: 2026-09-06-2153
model: Composer
description: #51 reply pills shipped; Tab ghost-text completion + rules emitter still open
---

# #51 — Tab remainder (planning only)

**Origin:** Composer · 2026-09-06 · research only (no product code)

Issue: [#51](https://github.com/tuckcode/rhizome-agent/issues/51) open, `ready-for-agent`.
Owner comments split **pills** (forks) vs **Tab ghost text** (one continuation);
pills win when both apply; never both; action labels must name the action.

## Status

| Piece | State |
|---|---|
| Case 1 — closed-question **options pills** | **Shipped** |
| `completion` type + Tab ghost text | **Planned only** — type exists; nothing emits or renders it |
| Case 2 — state-derived suggestions | Explicitly deferred in code comments / #51 |
| Model-backed phrasing | Research: opt-in later (v2) |

`suggestReply()` only returns `options` or `null` (numbered / bullet / `or` /
imperative yes-no). UI drops any non-`options` result.

Related (not this slice): ~~C71~~ up-arrow history already shipped.

## Files

- `src/lib/replySuggestions.ts` (+ `.test.ts`) — parser; `completion` union unused
- `src/components/AiPanelChrome.tsx` — `ComposerReplySuggestions` (`kind === 'options'` only)
- `src/components/AiPanelChrome.replySuggestions.test.tsx`
- Research (vault): `projects/rhizome-agent/sub-agents/2026-09-01-tab-completion-ux-research.md`

## Recommended next slice (~1–2h)

1. Rules-first emitters that return `{ kind: 'completion'; text }` when pills
   do not match (research table: soft “want me to…”, “ready”, next-step echo;
   **null** on open questions).
2. Composer ghost text (gray italic after cursor); **Tab** accept, Esc/typing
   dismiss; idle + empty input only.
3. Keep precedence: if `options`, never show ghost text.
4. Unit + chrome tests; PostHog shown/accepted/dismissed if meaningful.

## Do-not-scope

- Case 2 (git status / gate / session state → suggestions)
- Model-backed completion or Settings toggle for v2
- Menu-bar companion Tab
- A second suggestion system that fights pills
- Autofill bare `"yes"` for ghost text (safety: name the action)
- Push-agent paths: `getting_started.rs`, `aiAgentSession*.test.ts`,
  `SettingsPanel.test.tsx`, `HANDOFF.md`, `NEXT.md`
