---
session: 2026-09-07T08:08Z
model: Composer
description: >-
  Pickup brief for a NEW session: pinwheel lag audit (start / page switch /
  Settings). Prior diagnosis already exists; tonight’s multi-app mess made
  Apps vs debug hard to trust. Do not launch extra Rhizome copies.
commits: none
---

# Lag / pinwheel audit — start here (new session)

**Origin:** Composer · 2026-09-07 ~03:08  
**Ask:** Atticus — start, changing pages, Settings = beachball; wants an audit; maybe new session.

## First 60 seconds (before any fix)

1. **Count processes.** Only one `RhizomeAgent` / `ai.rhizome.agent` may run.  
   Quit Dock copies + Activity Monitor leftovers. Same bundle id → debug and  
   Applications **kill each other** and feel “laggy/haunted.”
2. **Name the binary.**  
   - Packaged: `/Applications/Rhizome Agent.app/.../RhizomeAgent`  
   - Debug: `src-tauri/target/debug/...` or `pnpm tauri`  
   At 03:08: **Applications app was missing** (only `Rhizome Agent.app.bak`).  
   If Atticus still sees lag with no Apps install, he is on a **leftover / debug**  
   path or something else — confirm with `lsof -c RhizomeAgent` → `txt` path.
3. **Do not** start parallel push/rebuild agents. That alone caused pinwheels tonight.

## Already diagnosed (read, don’t rediscover)

- [2026-09-07-0003-composer-beachball-lag.md](2026-09-07-0003-composer-beachball-lag.md) — ranked suspects:
  1. Session switch: 3 sync Prime calls + full transcript remount (no virtualization)
  2. Settings: full remount of huge panel + provider status IPC
  3. Cold start / Inbox: daemon ensure + vault + Graph if Notes open
- [2026-09-06-2359-composer-dev-vs-packaged.md](2026-09-06-2359-composer-dev-vs-packaged.md) — Applications smoother than `pnpm tauri`, same shapes remain
- [2026-09-07-0003…](2026-09-07-0003-composer-beachball-lag.md) also notes ~100 Prime session logs ≈ 21MB amplify list/switch cost

## Audit deliverable (this session’s job)

Write **one** handoff: `YYYY-MM-DD-HHMM-*-lag-audit-evidence.md` with:

| Moment | Binary path | Repro | Evidence (Instruments / time logs / IPC timing) | Top fix candidate |
|---|---|---|---|---|
| Cold start | | | | |
| Session / page switch | | | | |
| Open Settings | | | | |

Prefer **one** packaged build after a single clean install. Measure release before proposing debug-only optimizations.

## Likely first code bets (after evidence)

- Session switch: optimistic UI + parallelize or defer `read_prime_session_transcript`; virtualize message list
- Settings: keep panel mounted or lazy-split sections; don’t block UI on provider status
- Cold start: don’t build Graph until Notes/Inbox settled; shorter daemon wait UX

## Out of scope for the audit session

- Thinking-pill commit (local WIP)
- Grokbot #60–62 merges
- Another Applications rebuild unless Atticus asks **and** process count is zero
