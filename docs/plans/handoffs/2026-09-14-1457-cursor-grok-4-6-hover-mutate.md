---
session: 2026-09-14T14:26-05:00
model: Grok 4.6 (Cursor)
description: >-
  Notes do not collapse on hover. Chat does not speak
  mutate_queued_message. Paper leftover stays paper.
commits: uncommitted
---

# Hover stay + no mutate_queued

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:26 · leftover chrome lock.

Notes shut on the header / ⌘1 / Show Notes strip — not because the
pointer left the pane. Chat already add/list/clear queued lines.
Edit-one (`mutate_queued_message`) waits for Atticus.

## Tests

`src/App.layout-edges.test.ts` **10/10** (added 1): no
`collapseNotes` on mouse enter/leave.

`src/components/AiPanelComposer.queue.test.tsx` **6/6** (added 1):
`AiPanel` / `AiPanelChrome` do not contain `mutate_queued_message`.

Paper: `docs/plans/mutate-queued-message.md`.

## Not this window

- Do not speak `mutate_queued_message`
- Do not invent hover-collapse
- Native hide / #41 still NOT RUN
- D6 commits wait ~15:45
