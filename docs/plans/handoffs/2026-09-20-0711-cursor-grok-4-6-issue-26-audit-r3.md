---
session: 2026-09-20T07:11-05:00
model: Grok 4.6 (Cursor)
description: >-
  Audit r3 for #26: host is_streaming() is the apply guard, two new
  en.json keys inlined, mock check/list seeded for 5202. CPR next.
commits: this-commit
---

# Issue #26 — audit round 3

**Origin:** Grok 4.6 · Cursor · 2026-09-20 07:11.

- `apply_prime_update` reads `prime_session_host::is_streaming()`. The
  client `chatBusy` flag is only a hint.
- `versionUpdate.primeHeading` and `primeNeverAutoUpdates` are inline
  English in `VersionUpdateIndicator.tsx`. They are not new `en.json` keys.
- Mock `check_prime_update` returns 0.9.4. `list_prime_sessions` has rows.
  One summary title is a history blob so the rail unwrap can be seen.
- The hook also checks in the browser, so 5202 can click Update now.
- Live native apply is still unverified until a rebuild and a click on
  this machine’s 0.9.3 install.
