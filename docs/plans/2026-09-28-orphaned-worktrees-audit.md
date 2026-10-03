# Orphaned worktrees audit (2026-09-28)

**Found by:** Claude Sonnet 5.5 (`claude-sonnet-5-5`), 2026-09-28, during a folder cleanup.
**Where found:** `.worktrees/` inside this repo. All eight date from 2026-09-18 to 2026-09-20.
**Compared against:** `origin/main` at `ff9909a`.

## The question for each item

1. Did the work land in `main`?
2. Did a log or handoff record it?
3. Does it still make sense?

## How the check worked

- `git cherry` marks most commits in these branches as already in `main`. `main` was rewritten, so the raw "ahead by 600" counts mean nothing.
- The real unique work is the last commit (clean worktrees) or the uncommitted edits (dirty worktrees).
- For clean worktrees, I searched the `main` log for the same commit subject.
- For dirty worktrees, I ran `git apply -R --check` of the uncommitted diff against `main`. A clean reverse check means `main` already holds those exact edits. An error means `main` changed that file after the worktree branched. It does not prove the work is missing.
- Nobody read the code line by line. Every "needs review" row below needs a human or agent decision.

## Clean worktrees (work was committed)

| Worktree | Branch | Date | Change | Landed in main? | Verdict |
|---|---|---|---|---|---|
| `c77-contrast` | `cursor/c77-contrast` | 2026-09-20 | Restore first-run Chat guidance contrast (remove extra opacity) | **Yes.** `101cf2f` has the same subject. | Done. Safe to delete. |
| `chrome-group` | `cursor/chrome-group` | 2026-09-20 | Group workspace destinations, keep Inbox readable | **Yes.** `e80a3f6` | Done. Safe to delete. |
| `notes-width` | `cursor/notes-width` | 2026-09-20 | Stop beside-Notes width drag from fighting the pointer | **Yes.** `3225bce` | Done. Safe to delete. |

Not one of the three was on any remote. The commits reached `main` under new SHAs.

## Dirty worktrees (uncommitted work)

| Worktree | Branch | Date | Uncommitted work | Result of check | Verdict |
|---|---|---|---|---|---|
| `lane-b` | `cursor/lane-b-chat-reliability` | 2026-09-20 | Session title labels, stream callbacks, and a new `chatTurnOutcome.ts` with tests | Edits to existing files are **already in main**. `src/lib/chatTurnOutcome.ts` and its test are **not in main**, and nothing in `main` imports them. The recipe doc is in `main`. | **Needs review.** Decide whether the chat turn outcome helper is still wanted. |
| `lane-s` | `cursor/lane-s-vault-safety` | 2026-09-20 | Vault path safety (`vault-path.js`, `vault_list.rs`, `prime_vault_skill.rs`) | Mostly in `main`. `vault-path.test.js` and the handoff doc are in `main`. One hunk in `prime_vault_skill.rs` no longer applies. | **Mostly done.** Check that one hunk, then delete. |
| `lane-i` | `cursor/lane-i-install-docs` | 2026-09-20 | Public-preview docs (README, SECURITY, GETTING-STARTED, NEXT, HANDOFF) | `docs/PUBLIC-PREVIEW.md` and the claims test are in `main`. The doc edits no longer apply because those docs changed later. | **Probably stale.** Docs have moved on. Safe to delete unless someone wants the old wording. |
| `issue-26-rust` | `issue-26-rust` | 2026-09-20 | Rust update-check changes (about 550 lines) | Only `prime_update.rs` has diverged. The other three files match `main`. | **Needs review.** Compare `prime_update.rs` with `main`. |
| `issue-26-ui` | `issue-26-ui` | 2026-09-20 | UI side of the same update work (about 580 lines) | Several files diverged: `mock-handlers.ts`, `parked-organs.test.ts`, `en.json`, and others. | **Needs review.** Pair it with `issue-26-rust`. |

The commit `f75931d` (refuse tilde aliases of HOME as a vault path) and the `conversation_history` fixes are in `main` (`e7f1b26`, `00a6df0`). Both issue-26 branches carried them.

## Also in `.worktrees/`

`lane-q-notes.md` is a loose note from a Grok 4.6 native QA prep on 2026-09-20. It documents a build installed 2026-09-19 (`6860762`). The build is now old. Keep the note only for history.

## Removed in this cleanup (for the record)

- 21 `wave-*` worktrees. All branches were merged into `origin/main`. The `cursor/wave-*` branches still exist in git.
- `rhizome-agent-blocknote`, `-pr-60`, `-pr-62` and `-pr-64`. All commits are on `origin`.
- 9 clean, pushed worktrees: `d1-d2-rail`, `d3-on-top`, `d4-view-mode`, `d5-d6-names`, `d7-browse`, `edit-list-ux`, `pr-58`, `pr-59`, `pr-63`.
- `.claude/worktrees/rhizome-agent-pi-registry-items` (pushed).
- `src-tauri/target` (73 GB build cache), `coverage/`, `dist/`.
- `.tmp-look/` (29 MB of screenshots). Git did not track this folder, so the screenshots are **gone**.
- I deleted `.tmp-c64/` by mistake. Git tracks it. I restored all 22 files with `git checkout`.

## Next steps

1. Delete `c77-contrast`, `chrome-group` and `notes-width`. Nothing is lost.
2. Review `lane-b` (`chatTurnOutcome.ts`) and the two `issue-26` worktrees.
3. Check the one `lane-s` hunk, then delete `lane-s` and `lane-i`.
