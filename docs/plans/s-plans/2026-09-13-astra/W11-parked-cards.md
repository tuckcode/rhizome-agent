# W11 — parked idea cards

**Owner:** Cursor Grok 4.6 · W11 lane.  
**State:** complete (index only — no product code).  
**Starting revision:** local tree with uncommitted `docs/BOARD.md`, `docs/MORNING.md`; origin **`5c629a0`**.  
**Owned paths:** `docs/plans/w11-card-status.md`, this file.  
**Sibling overlap:** W1 owns BOARD/HANDOFF/NEXT lift; W5 shares Prime surface pointer; W6 shares import blocker.  
**Parent contract:** [README.md](README.md) · [God plan](../../../ASTRA_GOD_PLAN.md).

---

## Task

Read BOARD W11 and the linked September 7 evening dump. Retain existing memory, vault-skill, overview, and routing documents. Give each card source, state, blocker, and one next action. Replace duplicate prose with links. Keep C66 separate from memory architecture.

**Stop:** cards only. No portfolio Chat, launcher, kanban UI, `kanban.db`, router, automatic consolidation, or copied voice skills. Memory-loop index exists — do not write another.

---

## Result

**Index:** [`../../w11-card-status.md`](../../w11-card-status.md)

| # | Card | Kind | Pointer | Blocker (one line) |
|---|---|---|---|---|
| 1 | `rhizome-ship` | authored | [`rhizome-ship-skill.md`](../../rhizome-ship-skill.md) | Skill exists. No fourth verb. |
| 2 | Portfolio + Today + launcher + board | parked | [`idle-chat-overview.md`](../../../design/idle-chat-overview.md) | Chat ↔ Prime first; God plan claim |
| 3 | Vault skill/memory; no CC Switch | parked | [`vault-skill-home.md`](../../../design/vault-skill-home.md) | Vault paths unnamed |
| 4 | Memory loop index | index | [`memory-loop.md`](../../../design/memory-loop.md) | Blank-vault test (a); list import rows |
| 5 | TokenJuice / Switchyard | design notes | [`token-routing-and-compression.md`](../../../design/token-routing-and-compression.md) | ADR-0168 defer — no Rhizome organ |
| 6 | Living-docs audit | this lane | [`living-docs-audit.md`](../../living-docs-audit.md) | One doc per session |
| 7 | C66 agent profile | agreed, not built | [`c66-agent-profile.md`](../../c66-agent-profile.md) | Three Atticus product calls open |
| 8 | Prime surface (#5) | structured talk | [`prime-agent-surface.md`](../../../design/prime-agent-surface.md) | User-job slices; #56; import route |

**Missing link reconciliation:** all eight BOARD rows had resolvable pointer files. No new pointer files created.

**Dump orphans indexed** (no BOARD row): doctor-door handoff, stuck-agent path, theme polish, scheduled lint, Grok suggestions — see [`w11-card-status.md` § Orphans](../../w11-card-status.md#orphans-from-2208-no-board-row).

**Stale note flagged:** `prime-agent-surface.md` says #47 open; BOARD marks #47 closed — for W1/living-docs when that file is claimed.

---

## Acceptance

| Case | Result |
|---|---|
| Every existing idea findable without looking like an approved ticket | ✅ eight cards + five orphans in index |
| Source + blocker + parked/index/idea kind on each card | ✅ `w11-card-status.md` |
| C66 separate from memory loop | ✅ card 7 vs card 4 |
| No portfolio UI, kanban, TokenJuice code, new store | ✅ docs only |
| No second memory-loop index | ✅ linked existing `memory-loop.md` |

---

## Evidence

```text
Owner: Cursor Grok 4.6 (W11 subagent)
State: complete
Starting revision: origin/main 5c629a0; local uncommitted BOARD/MORNING
Owned paths: docs/plans/w11-card-status.md, docs/plans/s-plans/2026-09-13-astra/W11-parked-cards.md
Evidence: read BOARD W11, 2208, 2216 header, eight pointer files; glob verified all paths exist
Commit: none (per task)
Pushed: no
Installed build tested: no — docs lane
Unverified behavior: n/a
Blocker and next action: W1 lifts BOARD pointer to w11-card-status.md when integrating
```

**Sources read**

- [`docs/BOARD.md`](../../../BOARD.md) § W11
- [`docs/plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md`](../../handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md)
- [`docs/plans/handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md`](../../handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md) (chart)
- All eight pointer files listed in the result table
