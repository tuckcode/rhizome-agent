---
session: 2026-09-12T22:21Z
model: Cursor Composer
also: [DeepSeek V4 Flash (Rhizome Chat)]
description: >-
  Daily-drive batch before push: land the thinking-pill model filter, paint the
  Notes list with the sidebar surface, and highlight the session row as soon as
  you click it.
commits: TBD
---

# Daily-drive batch (thinking pill + Notes color + session highlight) — 2026-09-12

**Origin:** Cursor Composer · Atticus: knock out more daily-driver shortlist
fixes before pushing. Rhizome Chat wrote the thinking-pill fix then timed out
with no reply; that work was already in the tree.

## Done

1. **Thinking pill / model picker** — only offers levels the attached model
   can run (`get_prime_supported_thinking_levels`). On `deepseek-v4-flash`
   that is Off / High / X-High; Medium no longer looks stuck. Caption when
   the menu is shorter than the host scale. Detail:
   [1714](2026-09-12-1714-rhizome-deepseek-v4-flash-thinking-pill.md).
2. **Notes list surface** — `NoteListLayout` uses `bg-sidebar` instead of
   `bg-card`, so the right Notes column matches the left Sessions rail color
   (not near-white card).
3. **Session switch highlight** — `activeSessionPath` updates as soon as you
   click a row; a failed host switch rolls it back. Softens the
   session-switch beachball feel without changing the host call order.

## Not done / parked

- C64 first-2s native verify; #47 confirm-close; #51 Tab; Prime list-import;
  lag deeper cuts (Settings remount, transcript virtualization); push itself.

## Gates (this session)

- `pnpm vitest run` thinking + session switcher suites — 52 passed
- `cargo test --lib supported_levels` — 6 passed

## Next

Commit locally. Push when ready. Rebuild `/Applications` after push.
