# HANDOFF.md — Section Classification (2026-07-25)

Mechanical rule: if the section contains a date, commit hash, or past-tense narration → history, belongs in `docs/plans/`. Otherwise → current state, stays in HANDOFF.md.

## Results

| Classification | Section | Reason |
|---|---|---|
| **HISTORY → docs/plans/** | Pickup checklist (any agent, next session) | Contains dates (2026-07-25, 2026-07-24, 2026-07-21), commit hashes (082ab1c0, 484caf3f, etc.), past-tense narration ("was wrong", "has been", "are now") |
| **HISTORY → docs/plans/** | Where things stand (2026-07-12) | Date in title (2026-07-12), commit hashes throughout, past-tense narration |
| **HISTORY → docs/plans/** | What happened this session (2026-07-12) | Date in title (2026-07-12), past-tense narration for every entry |
| **CURRENT → stays** | Key decisions (locked, don't re-litigate) | No dates, no hashes, no past-tense narration — perpetual rules |
| **HISTORY → docs/plans/** | Warnings and gotchas (must read before touching code) | Contains past-tense narration ("is dead code", "was removed", "has been", "was deliberately left"), commit hashes |
| **CURRENT → stays** | Git state | Reference section with git remote config — no dates, hashes, or past-tense narration |
| **CURRENT → stays** | Reading order for a fresh session | Reference/instruction — no dates, no past-tense narration |

## Action

The 5 HISTORY sections should be moved to `docs/plans/2026-07-25-handoff-history.md` (or similar dated plan file) and replaced with a concise summary + link. The 3 CURRENT sections remain in HANDOFF.md.
