---
session: 2026-09-06-2153
model: Composer
description: >-
  #51 Case 1 Tab ghost-text shipped 2026-09-12; Case 2 model-backed
  remainder stays deferred.
---

# #51 — Tab remainder (Case 2)

**Origin:** Composer · 2026-09-06, **status corrected 2026-09-13** against the tree.  
Issue: [#51](https://github.com/tuckcode/rhizome-agent/issues/51).

Pills (forks) vs Tab ghost text (one continuation): pills win when both apply; never both; action labels must name the action.

---

## Done / now / next

| Piece | State |
|---|---|
| Closed-question **options pills** | **Shipped** (pre-2026-09-12) |
| Case 1 — rules-first `completion` + Tab ghost text | **Shipped 2026-09-12** (`5c04828`). `suggestReply()` emits `{ kind: 'completion'; text }`; composer ghost text; Tab accept. |
| Case 2 — model-backed / state-derived suggestions | **Deferred.** This is the remainder. |
| Settings toggle for v2 | Not started |

Related: ~~C71~~ up-arrow history shipped 2026-09-06.

**Done when (Case 2):** Tab ghost text can come from a model or from session/git/gate state, still idle+empty only, still loses to pills, still names the action. Not required for daily-drive.

---

## Files (Case 1 — do not re-implement)

- `src/lib/replySuggestions.ts` (+ `.test.ts`)
- `src/components/AiPanelChrome.tsx` — `ComposerReplySuggestions` + completion placeholder
- `src/lib/productAnalytics.ts` — shown/accepted/dismissed (enums only, never the text)
- Research (vault): `projects/rhizome-agent/sub-agents/2026-09-01-tab-completion-ux-research.md`

---

## Case 2 (when claimed)

State-derived or model-backed phrasing. Research called this opt-in later (v2). Code comments still say deferred.

Suggested bound (from research, not a new system):

1. Only when Case 1 rules return null and pills do not match.
2. Idle + empty input only.
3. If `options`, never show ghost text.
4. No autofill of bare `"yes"`.
5. No second suggestion system that fights pills.
6. No menu-bar companion Tab in the same slice.

---

## Do-not-scope

- Rebuilding Case 1
- Fighting pills
- Push-agent paths unless this slice lands product code
