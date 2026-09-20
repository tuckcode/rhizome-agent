---
session: 2026-09-20T05:38-05:00
model: Grok 4.6 (Cursor)
description: >-
  Coordinator review of the rail/reasoning slice. Product files already sit in
  local 4f9b4c4. Focused 292 tests and typecheck pass. C76 incomplete-history
  display remains. Planning docs still dirty and falsely claim a push.
commits: none (reviewed 4f9b4c4; did not commit or push)
---

# Rail/reasoning slice review — coordinator

**Origin:** Grok 4.6 · Cursor · 2026-09-20 05:38.

Atticus asked the coordinator to reconcile the dirty rail/reasoning slice
with named paths, then stop at review evidence and a commit proposal.
This session did not commit, push, rebuild, publish, or merge #66.

## Ownership snapshot

| Item | Value |
|---|---|
| Local `main` HEAD | **`4f9b4c4`** `feat: make the command rail sessions-only` |
| Local `origin/main` | **`dc44d84`** (no fetch this session) |
| Unpushed | `4f9b4c4` only |
| Installed app | `/Applications/Rhizome Agent.app` mtime **2026-09-19 11:27**, bundle version `0.1.0`. Last documented git identity remains **`6860762`**. Info.plist does not store that SHA. |
| Other writers | Composer conversation `rhizome-agent-vault-audit-verify` authored `4f9b4c4` at 05:31. It still appears to own the dirty planning docs. |
| Worktrees | Several older PR/area worktrees exist. None own this slice. |
| Native app / Vite | No Rhizome Agent process was running during this review. |

The user prompt still named HEAD as `dc44d84` with a dirty product tree.
That snapshot is stale. Composer committed the product files before this
coordinator turn finished bootstrap.

## What `4f9b4c4` contains

Named paths already in that local commit:

```
docs/ARCHITECTURE.md
src/App.test.tsx
src/App.tsx
src/components/AiMessage.test.tsx
src/components/AiMessage.tsx
src/components/CommandRail.test.tsx
src/components/CommandRail.trafficLights.test.tsx
src/components/CommandRail.tsx
src/components/StatusBar.test.tsx
src/components/status-bar/StatusBarSections.tsx
src/lib/leftover-research-rail.test.ts
src/lib/locales/en.json
src/lib/normalizeReasoningDisplay.test.ts
src/lib/normalizeReasoningDisplay.ts
src/lib/parked-organs.test.ts
src/lib/productAnalytics.ts
tests/smoke/example.spec.ts
tests/smoke/ui-audit.spec.ts
tests/smoke/unified-shell-layout.spec.ts
```

Behavior matches the 04:38 pickup:

- Left rail is sessions + Settings + pin. Chat and Research destination
  buttons are gone.
- Research stays on `status-research`. Status bar hides only the duplicate
  Settings gear when the rail is active.
- Graph / Mycelium / Research exits call `handleRailSelectChat`.
- `en.json` exit labels are “Back to chat” (value edits only; C18 still holds).
- Complete `<conversation_history>…</conversation_history>` blocks are
  stripped for display. AiMessage hides the fold when nothing remains.
- `trackRailDestinationClicked` / `rail_destination_clicked` are gone.
  `command_rail_pin_changed` remains.

## Review findings

1. **C76 still open.** Complete history blocks disappear. An unclosed
   opening tag plus unfinished history stays visible. Confirmed by a
   direct import of `normalizeReasoningDisplay` on `4f9b4c4`.
2. **`ARCHITECTURE.md` residue.** The commit updates the status-bar
   paragraph to “sessions-only.” A later Command-Rail paragraph still says
   the session list mounts “below every destination.”
3. **Commit message trailers did not parse.** The body stores literal
   `\n\n` characters, so `Co-Authored-By: Cursor Composer` is not a git
   trailer. Do not amend unless Atticus asks.
4. **Dirty planning docs claim a push that did not happen.** `HANDOFF.md`
   and `NEXT.md` say the product commit and a planning commit were pushed
   together. `origin/main` is still `dc44d84`. There is no planning commit.
   Do not commit those docs until that claim is corrected.

## Tests this session

```bash
pnpm typecheck
# PASS (tsc -b)

pnpm exec vitest run \
  src/App.test.tsx \
  src/components/AiMessage.test.tsx \
  src/components/CommandRail.test.tsx \
  src/components/CommandRail.trafficLights.test.tsx \
  src/components/StatusBar.test.tsx \
  src/lib/leftover-research-rail.test.ts \
  src/lib/normalizeReasoningDisplay.test.ts \
  src/lib/parked-organs.test.ts
# Test Files  8 passed (8)
# Tests  292 passed (292)
```

Direct probe (Node `--experimental-strip-types`):

| Input | Result |
|---|---|
| complete history only | empty (fold would hide) |
| complete history + real thought | `I will answer.` |
| real thought only | newlines kept |
| incomplete `<conversation_history>old exchange` | tag and text remain |
| incomplete history + later sentence | tag, history, and sentence remain |

Full push gates, Playwright, native QA, and security scans were not run.

## Named-path commit proposal

**Product slice: already committed. Do not add these paths again.**

Keep `4f9b4c4` as the local product checkpoint. Do not amend it. Do not
push it unless Atticus asks. Do not rebuild `/Applications`.

If Atticus later asks to push this slice alone:

```bash
git push origin main
# pushes 4f9b4c4 onto dc44d84
```

**Planning overlay: do not commit yet.**

These paths are dirty or untracked. They mix true planning with a false
push claim:

```
docs/BOARD.md
docs/HANDOFF.md
docs/NEXT.md
docs/plans/2026-09-20-cursor-public-readiness-swarm.md
docs/plans/2026-09-20-public-readiness-inventory.md
docs/plans/2026-09-20-public-readiness-plan.md
docs/plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md
docs/plans/handoffs/2026-09-20-0506-gpt-6-public-readiness-plan.md
docs/plans/handoffs/2026-09-20-0538-cursor-grok-4-6-rail-slice-review.md
```

After Lane I corrects “pushed together” to “local `4f9b4c4`, unpushed;
planning still dirty,” a later authorized commit can use exactly those
paths:

```bash
git add \
  docs/BOARD.md \
  docs/HANDOFF.md \
  docs/NEXT.md \
  docs/plans/2026-09-20-cursor-public-readiness-swarm.md \
  docs/plans/2026-09-20-public-readiness-inventory.md \
  docs/plans/2026-09-20-public-readiness-plan.md \
  docs/plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md \
  docs/plans/handoffs/2026-09-20-0506-gpt-6-public-readiness-plan.md \
  docs/plans/handoffs/2026-09-20-0538-cursor-grok-4-6-rail-slice-review.md
git commit -- \
  docs/BOARD.md \
  docs/HANDOFF.md \
  docs/NEXT.md \
  docs/plans/2026-09-20-cursor-public-readiness-swarm.md \
  docs/plans/2026-09-20-public-readiness-inventory.md \
  docs/plans/2026-09-20-public-readiness-plan.md \
  docs/plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md \
  docs/plans/handoffs/2026-09-20-0506-gpt-6-public-readiness-plan.md \
  docs/plans/handoffs/2026-09-20-0538-cursor-grok-4-6-rail-slice-review.md
```

Suggested message after the correction:

```
docs: stamp public-readiness plan against local 4f9b4c4

Record the sessions-only rail checkpoint as local-only. Keep origin at
dc44d84 until Atticus asks to push. Leave C76 and native QA open.
```

## C76 follow-up in this same session

Atticus asked this chat to do Lane A next. Red then green:

- Added incomplete-stream, real-before-unclosed, and unclosed-plus-later tests.
- Added an AiMessage hide test for an unclosed dump.
- After complete blocks are removed, an leftover opening tag now drops from
  that tag through the end of the display string. Persisted reasoning is
  unchanged.

`pnpm exec vitest run` on the two files: 58 passed. Repeat of the eight
focused files: see the coordinator reply. Direct probe now returns empty
for incomplete history and keeps real text that appears before the tag.

These C76 edits are **uncommitted** in the shared tree:

```
src/lib/normalizeReasoningDisplay.ts
src/lib/normalizeReasoningDisplay.test.ts
src/components/AiMessage.test.tsx
```

Do not fold them into `4f9b4c4`. If Atticus authorizes a later commit:

```bash
git add \
  src/lib/normalizeReasoningDisplay.ts \
  src/lib/normalizeReasoningDisplay.test.ts \
  src/components/AiMessage.test.tsx
git commit -- \
  src/lib/normalizeReasoningDisplay.ts \
  src/lib/normalizeReasoningDisplay.test.ts \
  src/components/AiMessage.test.tsx
```

Suggested message:

```
fix: hide incomplete conversation_history in the reasoning fold

Streaming or truncated history echoes were still visible. Strip an
unclosed opening tag through the end of the display string.
```

## Lane Q intake (2026-09-20 05:42)

[Lane Q](98aa2957-6d4b-4dbb-8b1f-d27b464732d9) finished prep only. No app
slot. No product patch.

Independent identity: `/Applications/Rhizome Agent.app`, version `0.1.0`,
mtime 2026-09-19 11:27, bundle id `ai.rhizome.agent`. Last documented SHA
remains `6860762`. Rhizome Agent and `prime-agent` are not running.
Spotlight last-use is 2026-09-20 04:20. Ask before quit or launch.

Every product matrix row is **BLOCKED** until Atticus authorizes one
candidate and one app slot. Installed `6860762` is not `4f9b4c4`.
cua-driver 0.28.2 reports Accessibility granted. Do not use `osascript`.

Hide in current `lib.rs` leaves Prime warm and stops only `ws_bridge` and
`mindwalk`. Older hide-docs that say hide stops a spawned Prime daemon
are stale. Two leftover packaged MCP Node children belong to Cursor.
Leave them.

Synthetic vaults later: `/tmp/rhizome-lane-q/` only. Not Laputa, not the
Rhizome Vault, not tracked demo vaults.

## Tree stamp after Q

Local `main` is now **`bcd4b87`** `docs: plan the public-readiness push`
on `4f9b4c4`. `origin/main` is still **`dc44d84`**. `bcd4b87` still says
the product and planning commits were pushed together. That remains false.

C76 source remains uncommitted on those three reasoning files.

## Lane D intake (2026-09-20 05:42)

[Lane D](b88cda5c-56e0-44c8-9523-2eea1b46e06c) was read-only. No product
patch. Organic About art and Signal stay. Source evidence only. No Vite
and no Playwright.

| Id | Defect | Owner | Files |
|---|---|---|---|
| D1 | Compact rail has no keyboard path to Sessions | A, after C76 commit | `CommandRail.tsx`, `AiPanel.tsx` |
| D2 | Hover overlay steals Chat clicks (~194px) | A, with D1 | same |
| D3 | “On top” opens the Notes column | C later; not rail | `chatNoteSplit.ts`, `App.tsx` |
| D4 | Legacy `view_mode` can reopen Notes | Layout owner | `panePresetStorage.ts`, `useViewMode.ts` |
| D5 | Long names truncate with no pointer tooltip | Session/Notes UI | `PrimeSessionList.tsx`, `NoteItem.tsx`, `ChatNotePane.tsx` |
| D6 | Session rows have no visible focus ring | same as D5 | `PrimeSessionList.tsx` |
| D7 | Light `--text-muted` Browse fails 4.5:1 | Theme owner | `index.css`, `.vault-panel__browse-toggle` |
| D8 | ARCHITECTURE still says “below every destination” | I, applied in shared tree | `docs/ARCHITECTURE.md` |

D1 and D2 wait until the C76 named-path commit is authorized. They share
rail files with the sessions-only slice. Do not start them in parallel
with another rail writer.

## Lane I intake (2026-09-20 05:43)

[Lane I](ddc63230-f57c-4458-ada4-d726da5b3826) worked in
`.worktrees/lane-i` on `cursor/lane-i-install-docs`. No commit.

Brought into the shared tree, still uncommitted:

- `docs/PUBLIC-PREVIEW.md`, GETTING-STARTED / README / SECURITY updates
- living-doc stamps that drop “pushed together”
- `src/lib/leftover-public-preview-claims.test.ts`
- `docs/plans/handoffs/2026-09-20-0548-cursor-grok-4-6-lane-i-install-docs.md`

Coordinator overlay after copy: planning is local **`bcd4b87`**, still
unpushed. C76 source remains uncommitted. D8 Architecture residue is
corrected in `docs/ARCHITECTURE.md`.

Do not fold C76 files into a docs commit.

## Lane S intake (2026-09-20 05:45)

[Lane S](359c8cdb-4ddf-4a78-902e-1cbf00f96e26) finished in
`.worktrees/lane-s` on `4f9b4c4`. Applied to the shared tree, uncommitted.

JS MCP now expands `~` / `~/` before the HOME refusal. Nested
`~/Documents` still works. Rust tests lock nested-under-HOME vaults and
unrelated local settings keys. `normalize_cwd("")` still returns HOME for
Chat-without-vault.

Focused recheck here: vault-path 3/3, vault.security 18/18,
`prime_vault_skill` 25 passed + 1 ignored.

#46 stays OPEN until Q records a live no-vault turn. No key rotation.
No history rewrite. Gitleaks hits named as synthetic Slack fixtures.

Third later named-path commit, keep separate from C76 and docs:

```
mcp-server/vault-path.js
mcp-server/vault-path.test.js
mcp-server/test.js
src-tauri/src/prime_vault_skill.rs
src-tauri/src/vault_list.rs
docs/plans/handoffs/2026-09-20-0545-cursor-grok-4-6-lane-s-vault-safety.md
```

## Lane B intake (2026-09-20 05:46)

[Lane B](468253f2-7adf-495c-8c02-335359f78715) finished in
`.worktrees/lane-b` on `4f9b4c4`. Applied to the shared tree, uncommitted.
Thinking defaults were not changed.

Session-list titles unwrap history blobs. First-exchange naming uses the
latest user turn. Thinking-only Done stays **empty completion**. The
classifier in `chatTurnOutcome.ts` is not wired into the live stream.

Focused recheck here: four frontend files, 124 passed. Rust
`conversation_history` unwrap tests passed.

Fourth later named-path commit, keep separate from C76, docs, and S:

```
src/lib/primeSessionMeta.ts
src/lib/primeSessionMeta.test.ts
src/components/PrimeSessionList.test.tsx
src/lib/aiAgentStreamCallbacks.test.ts
src/lib/chatTurnOutcome.ts
src/lib/chatTurnOutcome.test.ts
src-tauri/src/cli_agent_runtime.rs
src-tauri/src/prime_session_host.rs
src-tauri/src/prime_sessions.rs
docs/plans/2026-09-20-lane-b-chat-reliability-recipe.md
```

## Wave 1 exit

Reviewed candidate delta is in the shared tree, uncommitted, in four
slices: C76, I docs, S HOME, B titles. Prioritized defects: D1–D7,
live thinking/no-answer, live #41, live #46. Native matrix remains
BLOCKED. Clean-install draft is `docs/PUBLIC-PREVIEW.md`.

## Next coordinator action

Wait for Atticus to authorize named-path commits, a push, or one app
slot. Do not start D1–D7 or native cases from this chat.
