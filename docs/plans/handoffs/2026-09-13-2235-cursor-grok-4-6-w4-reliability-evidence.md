---
session: 2026-09-13T22:35-05:00
model: Grok 4.6 (Cursor)
description: >-
  W4 Chat reliability evidence. God-plan cases are NOT RUN natively.
  Source/unit send-policy and queue tests passed. Installed app stays 476756c.
  Not daily-driver ready. No code, no commit, no #66 merge, no list-import.
commits: none
---

# W4 — Chat reliability evidence

**Origin:** Cursor Grok 4.6 · 2026-09-13 · God-plan W4 (evidence only)

**Contract:** [God plan](~/Documents/Codex/2026-09-13/you-are-astra-write-the-god/outputs/ASTRA_GOD_PLAN.md) · [W4 stub](~/Documents/Codex/2026-09-13/you-are-astra-write-the-god/outputs/s-plans/W4-chat-reliability.md)

Did not edit `src-tauri/src/lib.rs`, `prime_session_host.rs`, `mcp.rs`, `prime_vault_skill.rs`, `vault_list.rs`, `commands/mod.rs`, or MCP JS. W7 owns those paths.

Did not quit Rhizome. Did not mass-kill helpers. Did not claim daily-driver ready. Did not merge #66. Did not code list-import. Did not commit.

## Environment

| Item | Value |
|---|---|
| Observed | 2026-09-13 ~22:35 CT |
| Git tip | `5c629a0` = `origin/main` |
| Installed app | `/Applications/Rhizome Agent.app` last stamped **`476756c`**. Info.plist mtime 2026-09-12 22:43:31. Binary mtime 2026-09-12 22:43:56. Bundle id `ai.rhizome.agent`. Version `0.1.0`. |
| Running regular apps | Finder, Cursor, ChatGPT. **Rhizome Agent is not running.** `pgrep RhizomeAgent` empty. `pgrep prime-agent` empty. |
| Native slot | Not claimed. ChatGPT Codex and a Cursor agent-worker are live in this repo. Default: not the single native observer. |
| Isolated live Prime | Not prepared. `pnpm test:live-prime` **NOT RUN** (C39: can pollute real sessions). |
| Working tree | Dirty. W7 owns the Rust/MCP security files. `AiPanel.tsx` has a one-line `#41` comment on `onSteer`. No behavior change in that hunk. |

## God-plan W4 cases

| Case | Result | Environment | Why |
|---|---|---|---|
| **C64 startup** | **NOT RUN** | Native `/Applications` `476756c` | Needs three cold launches with eyes on the first 1–2 seconds. Packaged app is idle, but this session is not the single native observer. Did not launch. Did not quit anything. `src/hooks/C64.md` still has launch 1 “not watched” and launches 2–3 empty. A later screenshot cannot pass this check. |
| **Send and recover** | **NOT RUN** | Native / live Prime | Needs a real Chat turn through Prime, a reconnect that restores Chat, and a failure that shows a useful error without calling the connection working. No isolated test session. Did not borrow the user’s Chat. Source tests below are not this case. |
| **Steer / queue** | **NOT RUN** | Native / live Prime | Original #41 scope is wired in source. Queue chrome exists. Tonight did not send a live steer or keep a follow-up visible on the packaged app. Historical 2026-09-06 `MIDTURN_QUEUE_PROBE` is not this build. Unspoken remainder: `mutate_queued_message`. Do not close #41 from this file. |
| **Hide / reopen** | **NOT RUN** | Native `/Applications` `476756c` | Needs helper identity before hide, then idle hide, Stop+close, Cancel, Keep working, reopen, and Cmd+Q. App is not running, so there is no live helper set to record. Did not launch for a hide experiment. The name-list test in `lib.rs` does not prove the OS stopped a process. |
| **Memory path** (W4 + W7) | **NOT RUN** | Isolated test vault + live tools | Needs an attached test vault, a live read/search on that vault, and a promoted note recalled with provenance. HANDOFF blank-vault loop **(a)** stays open. Did not attach a vault. Did not use the user’s Rhizome Vault as the fixture. |

**Daily-driver gate:** not assessed. Installed candidate remains `476756c`. Missing native checks stay explicit. Do not call source “daily-driver ready.”

## Supporting source checks (not native)

Ran 2026-09-13 22:35 CT against working-tree frontend (HEAD `5c629a0` plus existing dirt; W4 did not change product code):

```bash
npx vitest run \
  src/components/AiPanel.test.tsx \
  src/components/AiPanelComposer.queue.test.tsx \
  src/components/AiPanelComposer.steer.test.tsx \
  src/lib/primeTurnMessaging.test.ts \
  src/lib/primeQueue.test.ts \
  src/hooks/usePrimeHostStatus.test.ts \
  src/lib/aiAgentConversation.test.ts \
  src/components/PrimeSessionSubhead.test.tsx
```

**8 files, 98 tests, all passed.** jsdom / mocked host. Not Prime. Not `/Applications`.

| Check | Result | What it actually proved |
|---|---|---|
| C64 first-problem withhold | PASS (unit) | `withCorroboratedProblem` hides the first `not_installed` poll. A second agreeing poll can show install copy. Does not watch a cold launch. |
| Live wins over stale install copy | PASS (unit) | `PrimeSessionSubhead` with `live` + `not_installed` shows “Prime session live”, not `npm i -g prime-agent`. |
| Steer wired on Prime | PASS (unit) | `AiPanelView` passes `onSteer={handleSteer}` when the target is Prime. Typed composer during a turn offers **Steer response**. Empty composer offers **Stop**. |
| Enter is follow-up, not steer | PASS (source + unit) | `useAiPanelSendPolicy.handleComposerSend` calls `sendToRunningTurn('followUp', …)` while active. Steer is the separate button. |
| Queue list + Clear | PASS (unit) | Composer lists Steer then After. Clear calls `onClearQueue`. Empty queue renders nothing. |
| Draft on transport `failed` | PASS (unit) | Follow-up `failed` does not call `handleSend` or `setInput`. Composer still shows the text. |
| Fallback only from latest idle | PASS (unit) | `not-running` after the panel rerenders idle sends once via the latest idle callback. Stale-active send is not used. `not-running` while the panel still looks active keeps the draft. |
| Host-down retry | PASS (unit) | `usePrimeHostStatus` calls `ensure_prime_session_host` again when status says down. This is not “reconnect restores usable Chat.” |
| Hide helper names | **not used as a pass** | `hidden_window_helper_stops` compares labels. God plan: a name test cannot pass a process-lifecycle check. Did not run `cargo test` on W7-owned `lib.rs`. |

### Mid-turn failure chrome (source observation, not a native FAIL)

`sendToRunningTurn` returns `'failed'` on host throw. `handleComposerSend` / `handleSteer` keep the draft and do not start a new turn. They also do not set a Chat error banner. The user-visible “useful error” in the God-plan send/recover case is therefore **unproven**. Do not treat silent draft-keep as that check. Do not patch from this observation. Reproduce natively first.

## #41 original scope (do not rewrite from the title)

GitHub [#41](https://github.com/tuckcode/rhizome-agent/issues/41) is **OPEN**. Title still says the path is wired to nothing. That body is stale. A 2026-09-13 comment already said so. This session did not comment again and did not close the issue.

Atticus’s original ask (2026-08-22): type and send while Prime is working, not only Stop.

| Original build item | In tree tonight | Tonight native |
|---|---|---|
| Composer live/typable mid-turn | Yes: `onSteer` supplied for Prime; `canSteer` unlocks the composer | NOT RUN |
| Enter queues `follow_up_prime_session` | Yes: `handleComposerSend` | NOT RUN |
| Steer is a separate control | Yes: Steer button → `handleSteer` → `steer_prime_session` | NOT RUN |
| Queued follow-ups stay visible | Composer “Waiting in this session” + transcript `appendQueuedFollowUp`. `get_queue` poll. Clear-all wired. | NOT RUN |
| Stop with empty composer | Yes: unit | NOT RUN |
| PostHog counts only, no message text | `trackPrimeTurnMessage({ kind })` and `trackPrimeQueueCleared` | NOT RUN |
| Copy in `en.json` | Keys already exist (`ai.panel.steer`, `ai.panel.queuedLabel`). C18: do not migrate strings. | n/a |

**Not this issue:** `useAiPanelPromptQueue` / `useQueuedAiPrompt` (cross-surface one-slot handoff). Unspoken remainder: `mutate_queued_message` (no TS call site). Clear-all is not mutate-one.

Do not close #41 until a live glance on the build under test covers Enter-queue, visible queue, and Steer on a running turn.

## Hide helpers (read-only)

[`docs/plans/hide-on-close-helpers.md`](../hide-on-close-helpers.md): unambiguous slice is in `43059e3e` (`release_helpers_for_hidden_window`). Remainder is a native live-check.

Source still has the function. Hide stops spawned Prime (unless Keep working), ws-bridge child, and Mindwalk. Cmd+Q is still quit. Vite / `mock-tauri` is not this path.

**Packaged MCP `index.js` tonight — do not mass-kill.** Three node processes use `/Applications/Rhizome Agent.app/Contents/Resources/mcp-server/index.js`. Parents:

| pid | Parent | Owner |
|---|---|---|
| 4155 | 4026 | Cursor Helper `mcp-process` |
| 6284 | 6158 | Cursor agent-worker |
| 16200 | 9010 | ChatGPT Codex (`ChatGPT.app`) |

These are other clients using the packaged MCP file. They are not RhizomeAgent children. RhizomeAgent is not running. Ownership is identified. Leave them.

Astra’s “orphan MCP” lead is not reproduced as Rhizome hide leftovers.

Gray zone unchanged: Rhizome-spawned daemon vs user-started daemon still needs an Atticus call. Do not invent a new ownership model.

## Memory path

HANDOFF **(a)** (blank / fresh vault, full save loop, human at `pnpm tauri:dev`) remains open. Research (b) and write-path audit (c) do not substitute.

No promoted-note recall ran. No vault-tool live read against a test vault. W7 still owns HOME/MCP path guards.

## What this session did not do

- Native C64 ×3
- Hide / reopen / Cmd+Q
- Live Chat send, reconnect, or steer
- `pnpm test:live-prime`
- Code fix
- Commit, push, `/Applications` rebuild
- Merge or rebase #66
- List-import
- Kill or quit any process

## Next (W1 / later W4)

1. Keep this file as the W4 evidence pointer. Do not stamp C64 or hide as passed.
2. When one owner has the native slot and Atticus can spare the packaged app: three first-2s launches, then hide/reopen with helper `ps` before and after.
3. Same slot: one real Prime turn, one reconnect, one mid-turn Enter and Steer, eyes on queue chrome. Then W2 can compare #41.
4. After W7 releases shared Rust: only then consider a client fix if a native defect reproduces.
5. Memory path stays behind an isolated test vault. Do not use the daily Rhizome Vault.

**Installed app remains `476756c`.**

## 2026-09-14 morning (source remainder)

**Origin:** Cursor Grok 4.6 · 2026-09-14 ~11:20 CT

Source-only reconfirm. Full write-up: [2026-09-14-1120-cursor-grok-4-6-w4-source-remainder.md](2026-09-14-1120-cursor-grok-4-6-w4-source-remainder.md).

- `#41` still **OPEN**. `AiPanel.tsx:544` still passes `onSteer={isPrimeTarget ? handleSteer : undefined}`. Do not close.
- Leftover remains **`mutate_queued_message`**: catalog `docs/prime-adapter-surface.json:74`; named at `docs/design/prime-spoken-surface.md:33` and `:61`. No `src/` call site. No Rust host wrapper.
- Sister unspoken extras (not original #41): `abort_and_clear_queue` (`prime-adapter-surface.json:9`), `set_follow_up_mode` (`:98`; comment only `prime_session_host.rs:37`), `set_steering_mode` (`:105`).
- Same eight vitest files: **98/98 passed** (~11:18 CT, HEAD `4416411`). Not native.
- All five God-plan native cases still **NOT RUN**. Atticus has not recorded them. App still **`476756c`**. Not daily-driver ready.
- Did not launch `/Applications`. Did not quit Rhizome. Did not commit.

**D3 presentation (2026-09-14 ~12:00):** queue + preflight type is 12px.
A mid-turn send failure still has **no error banner**. That is a W4
behavior gap, not a design label. Do not invent “Stopped” or
“Connection unknown.” [1225](2026-09-14-1225-cursor-grok-4-6-d3-status.md).

**Stamped 16:05:** five native cases still **NOT RUN**. App still
`476756c`. Leftover wrap `1eb0398`. Do not launch `/Applications`.
