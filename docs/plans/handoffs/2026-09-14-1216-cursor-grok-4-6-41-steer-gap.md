---
session: 2026-09-14T12:16-05:00
model: Grok 4.6 (Cursor)
description: >-
  #41 mid-turn steer quality pass. Added one AiPanelView Codex
  Stop-only neighbor. Native live-check still NOT RUN. Did not close.
commits: none
---

# #41 steer gap — 2026-09-14 12:16

**Origin:** Cursor Grok 4.6 · quality pass · no commit · no issue close

GitHub [#41](https://github.com/tuckcode/rhizome-agent/issues/41) stays **OPEN**. Native steer/queue glance is **NOT RUN**.

`AiPanel.tsx:544` still passes `onSteer={isPrimeTarget ? handleSteer : undefined}`. Product code unchanged.

## Covered already (did not re-test as new work)

Composer (`AiPanelComposer.steer.test.tsx`, 8 tests, **8/8 pass** this session):

- Typed text + `onSteer` → **Steer response**
- Empty / whitespace + `onSteer` → **Stop response**
- No `onSteer` → Stop-only (chrome lock)
- Idle → Send, not Steer
- Stale React draft still steers live DOM text

Panel Prime path (`AiPanel.test.tsx` `talking to a turn that is already running`):

- Prime + typed mid-turn → Steer button
- Prime + empty composer → Stop button
- Enter mid-turn is follow-up (`sendToRunningTurn('followUp')`), not steer
- Draft kept on transport `failed` / declined while still looking active

W4 source already called this a unit pass. W4 native steer/queue remains **NOT RUN** ([2235](2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md), [1120](2026-09-14-1120-cursor-grok-4-6-w4-source-remainder.md)).

## Added

One neighbor in `src/components/AiPanel.test.tsx`:

`keeps Stop-only for a non-Prime agent even with typed text`

Why: composer tests omit `onSteer` by hand. They cannot see the panel gate. Prime tests never render Codex. A always-on `onSteer={handleSteer}` still passed every existing test.

TDD: first run failed (Codex showed **Steer response**). Restored the Prime-only prop. Second run passed.

## Still native-only

Do not close #41 from this file.

| Check | Status |
|---|---|
| Live Enter-queue on packaged app | **NOT RUN** |
| Visible queue chrome on a running turn | **NOT RUN** |
| Live Steer on `/Applications` `476756c` | **NOT RUN** |
| `pnpm test:live-prime` | **NOT RUN** |

Unspoken remainder unchanged: `mutate_queued_message`.

## Not done

- Commit / push / rebuild
- Issue close or comment
- Native live-check
