---
session: 2026-09-07-0004
model: Composer
description: Review of Grokbot/Cursor area A–F cleanup PRs #58–#63 — verdicts only, no merge/close
---

# Grokbot / Cursor area A–F PR review (#58–#63)

**Origin:** Composer · 2026-09-07 · review-only (no merge, no close)

## Who opened these?

All six are **Cursor cloud-agent PRs** (bodies wrapped in `CURSOR_AGENT_PR_BODY_*`, `bc-*` footers, branches `cursor/area-*`). GitHub author is `tuckcode` because the agent used that account — **not** a human-authored Atticus PR series.

Atticus said earlier he **did not mean to open a PR**. Treat the set as **agent-opened cleanup drafts**, not an intentional release train.

## Shared blockers (every PR)

| Issue | Detail |
|---|---|
| Merge conflicts | All six `mergeable: CONFLICTING` vs `main` — mainly overlapping `docs/HANDOFF.md` (each area wrote its own session + C69 notes). Several also touch `helpers.ts` / `lib.rs` / living docs. |
| Linux CI | #58–#62: Frontend + macOS Rust green; **Linux build verification fails** on pre-existing Clippy unused macOS-only helpers (`menu_bar_capture` / `should_reopen_main_window`) — tracked as **C69**, not introduced by these diffs. |
| #63 CI | All four jobs failed immediately — **billing/spending-limit**, not a code signal. Local MCP/Rust checks claimed in the PR body. |

**Do not merge any of these until rebase/conflict resolution.** Serial land only (A→B→…); parallel merges will fight on HANDOFF.

## Verdict table

| PR | Area | +/− | Verdict | One plain reason |
|---|---|---|---|---|
| [#58](https://github.com/tuckcode/rhizome-agent/pull/58) | A — orphaned e2e + unused scripts | +33 / −5622 | **merge** (after rebase) | Deletes unused root `e2e/` (live Playwright is `tests/smoke/`); does not touch `cli-call`, Research, or live smoke suites. Mild soft risk: drops helper scripts (`windows-prime-daemon.ps1`, appimage tools) that were unwired — docs claim kept. |
| [#59](https://github.com/tuckcode/rhizome-agent/pull/59) | B — orphan hooks | +85 / −1146 | **merge** (after rebase) | Dead hooks (`useMcpBridge`, Claude onboarding/status, `useNoteLayout`) have no production importers; live MCP path is `useMcpBridgeVaultSync`. |
| [#63](https://github.com/tuckcode/rhizome-agent/pull/63) | F — Grok-wiki MCP + parked smoke | +72 / −1191 | **merge** (after rebase + CI re-run) | Matches AGENTS (“Grok wiki out of scope”). Unadvertises wiki MCP verbs; **keeps** `mcp-server/cli-call.mjs` and in-app Research `rhizome_repo_research` via `call_rhizome_tool`. Only deletes parked/skipped smoke files. |
| [#60](https://github.com/tuckcode/rhizome-agent/pull/60) | C — orphan UI | +124 / −1735 | **needs-fix** | Safe-looking deletes (`CreateNoteDialog`, Claude onboarding UI, `NoteAutocomplete`) but **edits live `ResearchPanel.tsx`**. App already uses `variant="pane"`; dialog branch looks dead — still needs a human skim + conflict rebase before merge. |
| [#62](https://github.com/tuckcode/rhizome-agent/pull/62) | E — Tauri dead IPC + iOS gen | +67 / −37009 | **needs-fix** | Frontend Keep working / Stop use `settle_prime_session` (stays); Mycelium uses `start_mindwalk_sidecar` (stays). Dropping `promote_owned_prime_session` IPC wrappers looks unused from TS — still product-adjacent; rebase + confirm `generate_handler!` still registers settle/sidecar before merge. iOS `gen/apple` wipe is fine. |
| [#61](https://github.com/tuckcode/rhizome-agent/pull/61) | D — Tolaria docs archive | +138 / −32910 | **needs-fix** (or **close** if Atticus never wanted a docs purge PR) | No `src/` / `src-tauri/` product code — good. Deletes `YOU-SHOULD-KNOW.md`, VitePress `site/`, design `.pen`s, old plans. Living `NEXT.md` on the branch already drops the YOU-SHOULD-KNOW pointer, but this is irreversible archive loss and huge conflict surface. Confirm intent before merge. |

## Live-path safety checks (this review)

| Path | Result |
|---|---|
| `mcp-server/cli-call.mjs` | **Not deleted** in any of #58–#63 |
| Live `tests/smoke/` suite | #58 leaves it; #63 only removes parked/fixme junk + unused helper |
| Research panel | Remains imported in `App.tsx`; #60 trims dead dialog path; #63 keeps Rust Research verb |
| Keep working / Stop | `usePrimeActiveClose` → `settle_prime_session` — **not** the IPC names #62 removes |
| Mycelium | `start_mindwalk_sidecar` / `stop_mindwalk_sidecar` — **not** the `bridge_prime_session` wrappers #62 removes |

## Ranked list (safest → riskiest)

1. **#58** — merge after rebase  
2. **#59** — merge after rebase  
3. **#63** — merge after rebase + re-run Actions  
4. **#60** — needs-fix (ResearchPanel skim)  
5. **#62** — needs-fix (IPC registry confirm)  
6. **#61** — needs-fix / optional close (docs intent)

## Overall recommendation

**Park the queue.** These are agent-opened cleanup PRs Atticus did not deliberately request as a PR train. Nothing here is on fire; all conflict with `main`.

**Safest next action (≈2 min):** Ask Atticus one question — *close all six, or rebase-and-land starting at #58?*  
If land: rebase **#58 only**, resolve HANDOFF once, merge, then repeat for #59 → #63; hold #60/#62/#61 for a short human skim. Do **not** batch-merge. Do **not** fix C69 inside these PRs unless intentionally expanding scope.

## Not done (per brief)

- No merge  
- No close  
- No push  
