---
session: 2026-09-07-0110
model: Composer
description: Rebase safer Grokbot cleanup PRs #58 #59 #63 onto origin/main; force-with-lease; no merge
---

# Safer Grokbot rebase — #58, #59, #63

**Origin:** Composer · 2026-09-07 · rebase-only (no merge; #60/#61/#62 held)

Base: `origin/main` @ `047c416` (docs land on top of daily-drive `f76b46c` / `ac36e10`).

## Per-PR

### #58 — area A orphaned e2e + unused scripts

- **URL:** https://github.com/tuckcode/rhizome-agent/pull/58
- **Branch:** `cursor/area-a-orphaned-e2e-4e29` → `c2b19a5`
- **Rebase:** success (1 commit)
- **Conflicts:** `docs/HANDOFF.md` Recent sessions only — kept main daily-drive list; folded area-A session bullet
- **Force-with-lease:** yes
- **Mergeable (GitHub):** MERGEABLE
- **CI after rebase:** all four jobs **FAILURE** in ~8s ([run](https://github.com/tuckcode/rhizome-agent/actions/runs/34089795189)) — GitHub annotation: **account payments failed / spending limit** (jobs never started). Not a code signal.
- **Still only stale trash?** yes — deletes unused root `e2e/`, unwired scripts, unused `biome.json`, leftover `mcp-server/package-lock.json`, unused `verifyFocusable`. Live `tests/smoke/` kept; `mcp-server/cli-call.mjs` kept.
- **Ready for Atticus merge?** **yes** (content). Soft risk: drops unwired `scripts/windows-prime-daemon.ps1` / appimage helpers — docs previously claimed some kept; still unused from package scripts.
- **Do not merge until Atticus says.**

### #59 — area B orphan hooks

- **URL:** https://github.com/tuckcode/rhizome-agent/pull/59
- **Branch:** `cursor/area-b-orphan-hooks-a307` → `5f0f375`
- **Rebase:** success (4 original commits + 1 docs fixup)
- **Conflicts:** `docs/HANDOFF.md` on every commit — kept main State / daily-drive sessions; folded area-B session + **C69 Linux Clippy** open-thread note. First fold briefly prepended stale `a309a17` State lines → fixed in `5f0f375`.
- **Force-with-lease:** yes (twice: after rebase, after State fix)
- **Mergeable (GitHub):** MERGEABLE
- **CI after rebase:** all four jobs **FAILURE** instantly ([run](https://github.com/tuckcode/rhizome-agent/actions/runs/34089947425)) — same **billing/spending-limit** annotation; C69 Clippy still tracked for when Linux CI actually runs.
- **Still only stale trash?** yes — deletes `useMcpBridge`, Claude onboarding/status hooks, `useNoteLayout`, TS Mindwalk duplicate. Live MCP status hooks remain. App.tsx only inlines away dead `aiWorkspaceWindow` false constant.
- **Ready for Atticus merge?** **yes** (content). Prefer merge **after** #58 if both land (HANDOFF session list order).
- **Do not merge until Atticus says.**

### #63 — area F Grok-wiki MCP + parked smoke

- **URL:** https://github.com/tuckcode/rhizome-agent/pull/63
- **Branch:** `cursor/area-f-mcp-wiki-smoke-f1ef` → `28398e6`
- **Rebase:** success (2 commits)
- **Conflicts:** `docs/HANDOFF.md` only — main State kept; area-F session folded
- **Force-with-lease:** yes
- **Mergeable (GitHub):** MERGEABLE (checks were QUEUED at push time)
- **CI after rebase:** all four jobs **FAILURE** ([run](https://github.com/tuckcode/rhizome-agent/actions/runs/34090006676)) — same **billing/spending-limit** annotation
- **Still only stale trash?** yes — drops Grok-wiki MCP advertising + `rhizome_grok_import` module; removes parked/skipped smoke (`fixme`, latency wish, skipped relationship TODO). **`cli-call.mjs` kept**; in-app Research `call_rhizome_tool` / `rhizome_repo_research` kept (MCP list may no longer advertise `rhizome_repo_research` — intentional for out-of-scope wiki surface; Research panel path unchanged).
- **Ready for Atticus merge?** **yes** (content), after #58/#59 if serial-landing HANDOFF.
- **Do not merge until Atticus says.**

## Held (untouched)

- #60, #61, #62 — not rebased, not closed

## Remaining risks

1. **CI not green** on all three — confirmed billing/spending-limit (jobs never started). Fix GitHub billing, then re-run. C69 Linux Clippy still real when Linux job runs.
2. **Serial land only** — each PR touches `docs/HANDOFF.md`; merging out of order or in parallel will re-conflict.
3. **#58 soft:** unused helper script deletes (`windows-prime-daemon.ps1`, appimage tools) — confirm Atticus does not want those kept as docs-only utilities.
4. **#63:** MCP no longer lists some research/wiki verbs; in-app Research still works via Tauri `call_rhizome_tool`.

## Not done

- No merges
- No closes of #60/#61/#62
- No Chat performance code changes
