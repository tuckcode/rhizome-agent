---
session: 2026-10-10T21:00Z
model: Claude Opus 5.5
description: >-
  Long-haul plan (#119), pnpm live-ui (#118, ready), the Tier A review of
  2b (#116, 3 findings), and the DeepSeek audit check. Next for Claude:
  step 3a, keychain and key migration, in a fresh session.
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · long-haul start

## Branches and PRs

| PR | Branch | Step | State |
|---|---|---|---|
| #118 | `claude/issue-50-live-ui` | #50 `pnpm live-ui` | CI green, ready for review. Auto-fix on. |
| #119 | `claude/long-haul-plan` | Long-haul plan | Draft, docs only |
| #116 | `cursor/native-chat-2b-81d3` | 2b (Cursor) | Claude Tier A review posted: 3 findings |

## What landed

- `docs/plans/2026-10-10-long-haul-plan.md`: inventory, tiers, lanes, queues, run rhythm, stop conditions, and 12 questions for knispo.
- #50: `pnpm live-ui` reads the running `pnpm dev` (port 5202) as text. It exits 1 when nothing answers, when the server is not Rhizome, or when the dev app is older than the script.
- #116 review: (1) a stale approval waiter can clear a newer prompt id, (2) a frontend transcript-index save may overwrite native turns, (3) the quit bound is per session, not total.

## Next (Claude queue)

1. Step 3a: keychain module, `KeychainKeyStore`, migration with the ADR-0183 write, verify, remove rule and crash tests, `keyring` ADR. Do not run the migration on knispo's real keychain.
2. Review 2c PRs when Cursor opens them.

## Questions for knispo

The 12 in the long-haul plan §9. The first two matter now: who runs 2c (recommended: Cursor premium, Claude reviews), and the merge order (recommended: #117, #116, #115, #118).

## You should know

- `docs/plans/2026-10-10-deepseek-audit-check.md` (uncommitted, main checkout) ranks 25 survey findings. Group 1 can run between harness PRs.
- `ui-audit.spec.ts` audits Chat twice: the "Changes" rail button is gone, and the spec skips the click with no message.
- This Mac now has Playwright's `chromium-headless-shell` 1208 for local real-browser tests.
- The `vite-only` preview config runs `pnpm dev` in the main checkout, not in a worktree.

```text
Session 2026-10-10 Claude: long-haul plan #119 (draft), live-ui #118 (ready), 2b review on #116.
Docs: docs/plans/2026-10-10-long-haul-plan.md, docs/plans/2026-10-10-issue-50-plan.md,
docs/plans/2026-10-10-deepseek-audit-check.md (uncommitted).
#116 review: stale waiter clears a newer prompt; frontend index save may overwrite native turns; quit bound per session.
Next Claude: step 3a keychain + migration (fresh session).
Questions: long-haul plan §9 (12, with recommendations). First: 2c owner model; merge order #117, #116, #115, #118.
```
