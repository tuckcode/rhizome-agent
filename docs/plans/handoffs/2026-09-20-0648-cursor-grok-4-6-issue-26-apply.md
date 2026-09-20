---
session: 2026-09-20T06:48-05:00
model: Grok 4.6 (Cursor)
description: >-
  Issue #26 Chat-engine apply is in the shared tree, uncommitted. Update now
  runs apply_prime_update. No new session. App updater stays stubbed. No push.
commits: this-commit
---

# Issue #26 — in-app Chat-engine apply

**Origin:** Grok 4.6 · Cursor · 2026-09-20 06:48.

Writers: Rust worktree `issue-26-rust`, UI worktree `issue-26-ui`. Joined
here. Not committed. `prime_vault_skill.rs` dirt is not this slice.

- Command: `apply_prime_update({ expectedVersion, chatBusy })`.
- Refuses busy chat, empty offer, missing binary, stale GitHub version.
- Runs `prime-agent update`, one `--force` retry when the CLI says already
  latest. Then `reload_attached_session`. Does not create a session.
- Modal heading is Chat engine. GitHub is a fallback after mise / asdf /
  unknown failure copy (“release page”).
- PostHog: `engine_update_offered` / `accepted` / `failed`.
- App updater (`app_updater.rs`) still returns no feed. Do not treat that
  as a #26 defect.
- Live apply is unverified. Do not close #26 until a native click updates
  this machine’s 0.9.3 install.
- Focused: 23 Rust `prime_update` tests, 151 named frontend tests, clippy,
  `tsc -b`.

Do not commit `prime_vault_skill.rs` with this slice.
