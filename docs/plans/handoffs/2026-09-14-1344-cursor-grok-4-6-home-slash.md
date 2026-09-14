---
session: 2026-09-14T13:44-05:00
model: Grok 4.6 (Cursor)
description: >-
  vault_list refuses ~/ and HOME/ as vaults. NEXT session-import + #51
  Case 1 stamps. Did not close #46. No commit.
commits: none
---

# HOME slash + NEXT stamps — 2026-09-14 13:44

**Origin:** Cursor Grok 4.6 · leftover #46 test + living-docs · no commit

`reject_home_vault_list` already expanded `~`. New case locks `~/` and
`$HOME/` (trailing slash). `cargo test --lib vault_list` — **16/16**.

`docs/NEXT.md` later section: list-import blocked until **`1`**.
#51 Case 1 shipped; Case 2 parked.

Did not close #46. Did not change `normalize_cwd("")`.
