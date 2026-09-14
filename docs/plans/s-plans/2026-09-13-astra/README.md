# Cursor s-plan — overnight execution

**Origin:** Astra · Codex · 2026-09-13.
**Parent:** [God plan](../../../ASTRA_GOD_PLAN.md).
**Executor:** Cursor. Continue the existing lanes now.

## Claim protocol

1. Read the God plan's timing, ownership, acceptance, and stop rules.
2. Open the stub for the lane you already own.
3. Recheck Git state, sibling edits, and the relevant issue state.
4. Record your session identifier, exact paths, and starting revision.
5. Expand only missing implementation detail. Reuse the existing spec and tests.
6. Return evidence and a small result fragment to the W1 documentation integrator.

Grok 4.6 (`cursor-grok-4.6-high`) handles judgment. Composer 2.5 (`composer-2.5-fast`) handles mechanical work.
When uncertain, use Grok. This split applies only inside Cursor.

## Dispatch order

| Lane | Start condition | Stub |
|---|---|---|
| W7 security | Continue existing owner immediately | [W7](W7-security.md) |
| W4 Chat reliability | Evidence now; shared Rust edits after W7 releases paths | [W4](W4-chat-reliability.md) |
| W1 living docs | Continue existing owner immediately | [W1](W1-living-truth.md) |
| W2 issue evidence | Recheck current state; named close-set already closed | [W2](W2-issue-evidence.md) |
| W3 PR #66 | Review now; reconcile overlapping edits with W1 | [W3](W3-pr66.md) |
| W5 Prime surface | Review existing papers now | [W5](W5-prime-surface.md) |
| W6 import decision | Paper review now; implementation blocked | [W6](W6-import-decision.md) |
| W9 tray failure | Closure evidence check only unless regression appears | [W9](W9-tray.md) |
| W10 bridge loop | Closure evidence check only unless regression appears | [W10](W10-bridge.md) |
| W11 idea cards | Reconcile through W1; no product code | [W11](W11-parked-cards.md) |
| W8 Notes clarity | Small spec first; optional implementation after core work | [W8](W8-notes-clarity.md) |

This table is not a request to spawn eleven agents. Keep current owners and give each independent work.
Use freed issue-lane capacity for security and reliability verification. Preserve a single native observer and integration owner.

## Fill this record in the claimed stub

```text
Owner: Cursor session identifier / actual model
State: claimed | in progress | ready to integrate | complete | blocked | parked
Starting revision:
Owned paths:
Sibling overlap and release condition:
One bounded change or evidence task:
Acceptance cases:
Evidence: command / native observation, revision, result, evidence path
Commit:
Pushed:
Installed build tested:
Unverified behavior:
Blocker and next action:
```

Completion means the stub's acceptance holds. Record documentation completion separately from product completion.
The integration owner verifies the final batch through local hooks. Each writer stages and commits only named, owned paths.

## Documentation integration payload

W1 owns edits to BOARD, HANDOFF, NEXT, YOU-SHOULD-KNOW, and MORNING.
Other lanes provide the facts below with their source links:

- The behavior changed or verified.
- The exact code and pushed revision.
- The evidence and environment.
- The remaining blocker or native check.

W1 adds the God-plan pointer and one Astra session link without replacing another author's content.
Use the new [Astra handoff](../../handoffs/2026-09-13-2220-astra-god-plan.md) for the planning provenance.

Read the [Codex reserve](codex.md) or [Claude reserve](claude.md) only for an explicitly assigned later leftover.
Neither reserve absorbs this night's workload.
