---
session: 2026-09-14T11:20-05:00
model: Grok 4.6 (Cursor)
description: >-
  W4 Chat reliability source remainder. Reconfirmed #41 onSteer wiring.
  mutate_queued_message still unspoken, no TS/Rust send. Focused unit
  tests 98/98. Five God-plan native cases still NOT RUN. App stays 476756c.
  Not daily-driver ready. No code, no commit, did not close #41.
commits: none
---

# W4 — Chat reliability source remainder (2026-09-14 morning)

**Origin:** Cursor Grok 4.6 · 2026-09-14 · God-plan W4 (source only)

**Contract:** [God plan](../../ASTRA_GOD_PLAN.md) · [W4 stub](../s-plans/2026-09-13-astra/W4-chat-reliability.md)  
**Night pointer:** [2026-09-13-2235 evidence](2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md)

Did not edit `src-tauri/src/lib.rs`, `prime_session_host.rs`, `mcp.rs`, `prime_vault_skill.rs`, `vault_list.rs`, `commands/mod.rs`, or MCP JS.

Did not launch `/Applications/Rhizome Agent.app`. Did not quit Rhizome. Did not mass-kill helpers. Did not close #41. Did not claim daily-driver ready. Did not commit.

## Environment

| Item | Value |
|---|---|
| Observed | 2026-09-14 ~11:20 CT |
| Local HEAD | `4416411` (W7 HOME-alias / skill-scrub). Two commits ahead of `origin/main` (`5c629a0`). |
| Installed app | `/Applications/Rhizome Agent.app` last stamped **`476756c`**. Info.plist and `RhizomeAgent` binary mtime still 2026-09-12 22:43. Bundle id `ai.rhizome.agent`. Version `0.1.0`. |
| Native slot | Not claimed. Atticus-only this morning. Did not launch. Did not inspect a live helper set. |
| Isolated live Prime | **NOT RUN** (`pnpm test:live-prime`). |
| Product code | This session changed none. |

## God-plan W4 cases

All five stay **NOT RUN**. Atticus has not recorded them. A later screenshot cannot pass C64.

| Case | Result | Environment | Why |
|---|---|---|---|
| **C64 startup** | **NOT RUN** | Native `/Applications` `476756c` | Needs three cold launches with eyes on the first 1–2 seconds. `src/hooks/C64.md` still has launch 1 “not watched” and launches 2–3 empty. |
| **Send and recover** | **NOT RUN** | Native / live Prime | Needs a real Chat turn, reconnect that restores Chat, and a useful error on failure. Source draft-keep is not that check. |
| **Steer / queue** | **NOT RUN** | Native / live Prime | Original #41 path is wired in source (below). No live Enter-queue, visible queue, or Steer on this build. |
| **Hide / reopen** | **NOT RUN** | Native `/Applications` `476756c` | Needs helper identity before hide, then idle hide, Stop+close, Cancel, Keep working, reopen, Cmd+Q. Did not launch. |
| **Memory path** (W4 + W7) | **NOT RUN** | Isolated test vault + live tools | HANDOFF blank-vault loop **(a)** stays open. Did not attach a vault. |

**Daily-driver gate:** not assessed. Installed candidate remains `476756c`. Do not call source “daily-driver ready.”

## #41 — `onSteer` is wired (do not close)

GitHub [#41](https://github.com/tuckcode/rhizome-agent/issues/41) is **OPEN**. Title still says the path is wired to nothing. That body is stale. This session did not comment and did not close.

| Original build item | Source this morning | Native |
|---|---|---|
| Composer live/typable mid-turn | `AiPanel.tsx:544` passes `onSteer={isPrimeTarget ? handleSteer : undefined}`. `AiPanelChrome.tsx:803` `canSteer = isActive && typeof onSteer === 'function'`. | NOT RUN |
| Enter queues `follow_up_prime_session` | `useAiPanelSendPolicy.ts:85-106` → `sendToRunningTurn('followUp')` → `primeTurnMessaging.ts:22` | NOT RUN |
| Steer is a separate control | `useAiPanelSendPolicy.ts:108-119` `handleSteer` → `sendToRunningTurn('steer')` → `primeTurnMessaging.ts:21` `steer_prime_session` | NOT RUN |
| Queued follow-ups stay visible | `AiPanel.tsx:262` `usePrimeQueue` (`get_prime_session_queue`); `AiPanel.tsx:265-270` mirrors `followUp` into the transcript; Clear → `clear_prime_session_queue` (`AiPanel.tsx:546`) | NOT RUN |
| Stop with empty composer | Unit: `AiPanelComposer.steer.test.tsx` | NOT RUN |
| PostHog counts only | `trackPrimeTurnMessage({ kind })` / `trackPrimeQueueCleared` | NOT RUN |

Policy hook is created at `AiPanel.tsx:315-325` (`handleComposerSend`, `handleSteer`, `onFollowUpQueued: agent.appendQueuedFollowUp`).

Do not close #41 until a live glance on the build under test covers Enter-queue, visible queue, and Steer on a running turn.

## Leftover table (source)

Not this issue: `useAiPanelPromptQueue` / `useQueuedAiPrompt` (cross-surface one-slot handoff). Clear-all is not mutate-one.

| Leftover | Kind | File:line | Notes |
|---|---|---|---|
| `mutate_queued_message` | Unspoken Prime verb. **#41 remainder.** | `docs/prime-adapter-surface.json:74` (catalog name). Named leftover at `docs/design/prime-spoken-surface.md:33` and `:61`. | **No `src/` call site.** **No Rust host wrapper** (`src-tauri/src/commands/` has none; `commands/ai.rs` exposes steer / follow_up / get / clear only, lines 460–488). |
| `abort_and_clear_queue` | Unspoken extra, not original #41 | `docs/prime-adapter-surface.json:9`; `docs/design/prime-spoken-surface.md:61` | No TS/Rust send. |
| `set_follow_up_mode` | Unspoken extra | `docs/prime-adapter-surface.json:98`; comment only at `src-tauri/src/prime_session_host.rs:37` | Comment says defaults to one-at-a-time. No send. |
| `set_steering_mode` | Unspoken extra | `docs/prime-adapter-surface.json:105`; `docs/design/prime-spoken-surface.md:61` | No TS/Rust send. |
| Mid-turn failure chrome | Source observation, not a native FAIL | `src/lib/primeTurnMessaging.ts:39-41` returns `'failed'`. `src/components/useAiPanelSendPolicy.ts:89-102` and `:108-118` keep the draft and do not start a new turn. They do not set a Chat error banner. | God-plan “useful error” stays **unproven**. Do not patch from this. |
| Five native God-plan cases | **NOT RUN** | `src/hooks/C64.md`; `docs/plans/hide-on-close-helpers.md` | Atticus-only this morning. |

Spoken and already wired (not leftovers): `steer`, `follow_up`, `get_queue`, `clear_queue`. `resume_queue` is spoken in the Rust host (Stop / suspend retry), not a Chat mutate-one verb.

## Supporting source checks (not native)

Ran 2026-09-14 ~11:18 CT against working-tree frontend (HEAD `4416411`; this session did not change product code):

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

Same eight files as 2026-09-13 night. Same count.

| Check | Result | What it actually proved |
|---|---|---|
| C64 first-problem withhold | PASS (unit) | `withCorroboratedProblem` hides the first `not_installed` poll. Does not watch a cold launch. |
| Live wins over stale install copy | PASS (unit) | `PrimeSessionSubhead` with `live` + `not_installed` shows “Prime session live”. |
| Steer wired on Prime | PASS (unit) | `AiPanelView` passes `onSteer={handleSteer}` when the target is Prime. Typed composer during a turn offers **Steer response**. Empty composer offers **Stop**. |
| Enter is follow-up, not steer | PASS (source + unit) | `handleComposerSend` calls `sendToRunningTurn('followUp', …)` while active. |
| Queue list + Clear | PASS (unit) | Composer lists Steer then After. Clear calls `onClearQueue`. |
| Draft on transport `failed` | PASS (unit) | Follow-up `failed` does not call `handleSend` or `setInput`. |
| Fallback only from latest idle | PASS (unit) | `not-running` after idle rerender sends once via the latest idle callback. |
| Host-down retry | PASS (unit) | `usePrimeHostStatus` retries `ensure_prime_session_host` when status says down. Not “reconnect restores usable Chat.” |

## Hide helpers (read-only)

[`docs/plans/hide-on-close-helpers.md`](../hide-on-close-helpers.md): unambiguous slice remains `43059e3e` (`release_helpers_for_hidden_window`). Remainder is a native live-check. Did not recode. Did not run `cargo test` on W7-owned `lib.rs`. A name-list test cannot pass a process-lifecycle check.

## What this session did not do

- Native C64 ×3
- Hide / reopen / Cmd+Q
- Live Chat send, reconnect, or steer
- `pnpm test:live-prime`
- Code fix
- Commit, push, `/Applications` rebuild
- Close or comment on #41
- Kill or quit any process

**Installed app remains `476756c`.**
