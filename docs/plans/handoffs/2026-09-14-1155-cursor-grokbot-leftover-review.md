---
session: 2026-09-14-1155
model: Composer (Cursor)
description: >-
  Accept/defer/not-found on Grokbot nightly audit leftovers that did not become
  PRs #58–#63. Paper only — no product code, no issues, no CodexGPT.
---

# Grokbot leftover review — rhizome-agent

**Origin:** Composer (Cursor) · 2026-09-14 · BOARD pile #7

## Scope

- **In:** Grokbot / Cursor cloud-agent **nightly-style audit** (Areas A–F → PRs
  [#58](https://github.com/tuckcode/rhizome-agent/pull/58)–[#63](https://github.com/tuckcode/rhizome-agent/pull/63)).
  Primary sources: area handoffs under `docs/plans/handoffs/2026-09-06-*-area-*`,
  [0004 PR review](2026-09-07-0004-composer-grokbot-prs-review.md),
  [1819 park note](2026-09-06-1819-composer-park-grokbot-audits-tonight.md).
- **Out:** CodexGPT lob (hard no this session), product code, GitHub issues,
  `import_jsonl`, #66, Applications rebuild.

## Audit artifact

No standalone “full Grokbot audit” markdown exists for **rhizome-agent**. The
audit **is** the six Area A–F subtraction PRs plus their session handoffs.
`~/.grokbot/` holds daemon config only (no audit dump). CodexGPT has a
narrower [`codexgpt/.lob/audit.md`](file://~/code/projects/CodexGPT/codexgpt/.lob/audit.md)
(2026-08-30) — different repo.

## PR train — all six areas on `origin/main`

| PR | Area | Landed how | When |
|---|---|---|---|
| #58 | A — orphaned `e2e/` + unused scripts | GitHub merge | 2026-09-07 |
| #59 | B — orphan hooks / Claude leftovers | GitHub merge | 2026-09-07 |
| #63 | F — Grok-wiki MCP + parked smoke | GitHub merge | 2026-09-07 |
| #62 | E — dead Tauri IPC + iOS gen | Detached HEAD → main (PR closed) | 2026-09-06+ |
| #60 | C — orphan UI | Detached HEAD → main `f177fb7` (PR closed) | 2026-09-12+ |
| #61 | D — Tolaria/docs archive | GitHub merge (rebase kept `YOU-SHOULD-KNOW.md`) | 2026-09-12 |

Verified on tree: no `e2e/`, no `CreateNoteDialog`, no `useMcpBridge.ts`, no
`rhizome_grok_import.rs`, no `get_prime_session_messages` in `lib.rs`, no
`site/`, no `windows-prime-daemon.ps1`.

---

## Leftover findings (did **not** become PRs)

Items explicitly **skipped**, **left alone**, or **not touched** in area
handoffs — not shipped as subtraction work.

| # | Finding | Source | Verdict | Notes |
|---|---|---|---|---|
| 1 | **Second provider / dual execution (#56, `ai_models.rs`)** | Area B/E “dual-shell / #56”; Area E left `ai_models` alone | **Defer** | Open [#56](https://github.com/tuckcode/rhizome-agent/issues/56). Doctrine vs code; Atticus keep/remove/amend. Not a dead-code delete. |
| 2 | **shadcn/ui migrations (raw HTML → components)** | Area C skip list | **Defer** | Inherited Desktop rule in `AGENTS.md`; large sweep. Not audit subtraction. |
| 3 | **Sheet-editor merge / consolidation** | Area C skip; Area E “sheet engine” left alone | **Defer** | Live `SheetEditor` + IronCalc path (ADR-0143). Merge is refactor, not orphan delete. |
| 4 | **DEV memory probe** | Area C skip list only | **Not found** | No script, module, or test name in tree. Likely an planned probe never committed. |
| 5 | **`session_import/**` cleanup** | Area E left alone | **Defer** | Live Rust import pipeline (`src-tauri/src/session_import/`). Separate from list-row `import_jsonl` (blocked). |
| 6 | **Dual search** | Area E left alone | **Not found** | Single handoff mention; no module, doc section, or symbol match in repo. |
| 7 | **Inbox watcher subtraction** | Area E left alone | **Defer** | Live `inbox_watcher.rs` + `useInboxWatcher` (ADR-0158). Intentionally not cut. |
| 8 | **`prime_session_host` split** | Area E left alone | **Defer** | Architectural refactor (~6k-line module). Audit scope was dead IPC only. |
| 9 | **`event_tx` / `format_empty_turn` `dead_code` allows** | Area E left alone | **Defer** | Still present in `prime_session_host.rs` / `prime_events.rs`. Not made unused by Area E. |
| 10 | **CodexGPT lob full audit walk** | [1819 park](2026-09-06-1819-composer-park-grokbot-audits-tonight.md) | **Defer** | Out of repo. `.lob/audit.md` is 2026-08-30 glue gaps, not rhizome-agent. |
| 11 | **Living-docs stale-claim sweep** | Evening dump 2026-09-07 (adjacent, not Area A–F) | **Defer** | Partial W1 passes; not part of subtraction PRs. |
| 12 | **AI workspace pop-out / dual-window shell** | Area B removed dead `aiWorkspaceWindow === false` branch only | **Defer** | `AiWorkspaceWindowApp` + pop-out still live (ADR-0128). Not the same as #56. |
| 13 | **Restore deleted helper scripts as docs-only utilities** | [0004 review](2026-09-07-0004-composer-grokbot-prs-review.md) #58 soft risk | **Defer** | `windows-prime-daemon.ps1`, appimage tools gone with #58. Recreate only if Atticus wants doc companions. |

### Leftover verdict totals

| Verdict | Count |
|---|---|
| **Defer** | 9 |
| **Not found** | 2 |
| **Accept** | 0 |
| **Already landed** | 0 |

*(Accept = agree to pursue as product work soon. None qualify without owner
calls on #56, import route, or intentional refactors.)*

---

## Already landed via PR train (audit subtraction shipped)

| # | Shipped item | PR / area |
|---|---|---|
| 1 | Root `e2e/` (24 specs), unused scripts, `biome.json`, `mcp-server/package-lock.json` | #58 / A |
| 2 | `useMcpBridge`, Claude onboarding/status hooks, `useNoteLayout`, TS Mindwalk duplicate, dead app-core exports | #59 / B |
| 3 | `CreateNoteDialog`, `NoteAutocomplete`, `ClaudeCodeOnboardingPrompt`, dead Research dialog branch, orphan exports | #60 / C |
| 4 | Tolaria `site/`, stale plans/design `.pen`s, release-notes archive, l10n invitation scripts | #61 / D |
| 5 | Dead Tauri IPC wrappers, `gen/apple/`, launch-time `~/Laputa` migrate, `mobile.json` | #62 / E |
| 6 | MCP unadvertise `rhizome_grok_import` / `generate_wiki` / external `repo_research`; delete `rhizome_grok_import.rs`; parked smoke junk | #63 / F |
| 7 | **C69** Linux Clippy — `menu_bar_capture` / `should_reopen_main_window` cfg-gated | #62 / E (HANDOFF closed) |
| 8 | **`YOU-SHOULD-KNOW.md` kept** (Area D rebase override) | #61 rebase |
| 9 | In-app Research `rhizome_repo_research` via `call_rhizome_tool` (MCP list trimmed only) | #63 / F |
| 10 | `mcp-server/cli-call.mjs` kept (knip ignore still valid) | all areas |

### Already-landed total: **10** discrete shipped outcomes (6 PR areas + 4 cross-cutting)

---

## BOARD #7 — close?

**Yes, for rhizome-agent.** The subtraction audit shipped through #58–#63.
Remaining rows are **Defer** (owner/product) or **Not found** (never existed in
tree). CodexGPT lob stays a separate defer unless Atticus opens that repo.

**Not done (per brief):** product code, commit, GitHub issues, CodexGPT start.

---

## References

- [1819 park Grokbot audits](2026-09-06-1819-composer-park-grokbot-audits-tonight.md)
- [0004 Grokbot PR review #58–#63](2026-09-07-0004-composer-grokbot-prs-review.md)
- Area handoffs: `2026-09-06-2141` (A), `2145` (B), `2155` (C), `2215` (D), `2230` (E), `2236` (F)
- [#57 ghost-compat spec](../issue-57-ghost-compat.md) — overlaps Area E; tracked separately
