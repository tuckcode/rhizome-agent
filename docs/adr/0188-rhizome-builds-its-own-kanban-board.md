---
type: ADR
id: "0188"
title: "Rhizome builds its own Kanban board; the Kanban park is lifted"
status: active
date: 2026-10-17
---

**Origin:** MyNAEga · 2026-10-17 · Builders room
**Builds on:** [ADR-0144](0144-collections-and-presentations.md) (collections carry presentation configuration), [ADR-0187](0187-native-is-the-only-chat-engine.md) (native is the only chat engine; core tool policy)

## Context

A Kanban board was parked in September with the evening design dump. The
park was never an ADR. It lives in docs and in leftover tests:

- [`docs/NEXT.md`](../NEXT.md) line 34: "kanban/automations on rail" in
  the Parked row. Line 96: "Rail automations / kanban icons" marked Later.
  Line 98: "Do not add `kanban.db`." Line 103: "`kanban.db` still
  unbuilt."
- [`docs/PUBLIC-PREVIEW.md`](../PUBLIC-PREVIEW.md) line 15: kanban is in
  the "not in this preview" column of the Layout row.
- [`docs/plans/w11-card-status.md`](../plans/w11-card-status.md) line 8:
  hard no on `kanban.db`, source lock `src/lib/parked-organs.test.ts`.
  Line 56: the board card stop line, "No `kanban.db`."
- [`docs/design/idle-chat-overview.md`](../design/idle-chat-overview.md)
  line 28: "Do not add Hermes `kanban.db`." Section 2 (lines 51 to 60)
  splits a human board over vault notes from an agent board over Prime
  sessions. Line 90 is the board build step.
- [`docs/design/prime-agent-surface.md`](../design/prime-agent-surface.md)
  line 224: "Do not add Hermes `kanban.db`."
- [`docs/design/harness-composition.md`](../design/harness-composition.md)
  lines 262 to 280: the Hermes Kanban read, with an open question about
  building it over Prime session state.
- Older plans repeat the same lines: `docs/PLAN_FOR_A_PLAN.md` line 249,
  `docs/plans/2026-09-21-next-phase-plan.md` lines 198, 210 and 281,
  `docs/plans/2026-09-20-public-readiness-inventory.md` lines 68 and 80,
  `docs/plans/2026-10-06-standing-rule-inventory.md` line 132, and
  `docs/plans/s-plans/2026-09-13-astra/W11-parked-cards.md` line 16.

Three vitest files fail if the word kanban appears in
`src-tauri/Cargo.toml`:

- `src/lib/parked-organs.test.ts`, test "does not vendor TokenJuice or
  add kanban.db" (line 9).
- `src/lib/leftover-kanban-parked.test.ts`, test "does not vendor
  TokenJuice or add kanban.db" (line 9).
- `src/lib/leftover-tokenjuice-parked.test.ts`, test "does not add a
  kanban crate" (line 12).

[ADR-0144](0144-collections-and-presentations.md) does not park Kanban.
It already names boards as a future collection presentation that groups
notes by a property without a separate data store.

Hermes Agent (NousResearch/hermes-agent, MIT) has a board. Its UI is in
`apps/desktop/src/plugins/kanban/` and its backend is the `kanban_*`
modules behind `~/.hermes/kanban.db`. The UI is TypeScript and React,
the same stack as Rhizome.

## Decision

**The Kanban park is lifted. Rhizome builds its own board, using Hermes
and other harness boards as inspiration only. Phase 1 is a board over
vault notes. Phase 2 lets agents work the cards.**

1. **knispo, Builders room, 2026-10-17 1:31 AM CT:** "Yeah, I want it,
   since we have to remake it in rust, we can make we use theirs and
   other harnesses kanban boards, as inspiration and a blueprint. But we
   can make it our own Kanban board , so don't have to credit anybody."
2. **The park is lifted.** The doc lines listed in Context no longer
   block board work. The three Cargo.toml kanban assertions are removed
   in the first board PR, not in this one. Only the kanban assertions go.
   The TokenJuice and tinyhumans checks in the same tests stay.
3. **Our own board, no copied code.** Hermes and other harnesses are a
   blueprint for behavior. Builders work from a short description of how
   the board behaves, not with upstream files open. No code is copied,
   so there is no `THIRD_PARTY` entry and no credit. If any code is ever
   copied, MyNAEga checks the license first, and the copy carries Nous
   Research's MIT notice in `THIRD_PARTY`.
4. **Phase 1: the board.** Comes after the core tools series and the PR
   that routes new chats to native (ADR-0187 build order).
   - Cards are vault notes with a `status` field. Columns are `status`
     values.
   - A board view, as a collection presentation
     (`presentation.type: board`) per ADR-0144, plus card tools for the
     native loop to list, create and move cards.
   - The board persists to disk. Cards are note files and board settings
     live in the saved view YAML. There is still no `kanban.db` in this
     phase.
5. **Phase 2: agent-run cards.** Comes after background runs and
   subagents exist in the native loop.
   - One native loop worker per card, with tracking of which worker owns
     which card.
   - Agent tools so a worker can move and update its own card.
   - Each worker's approval prompts show on the board, so they can be
     answered there.
   - A higher per-turn step limit for card jobs. Today it is
     `DEFAULT_STEP_CAP = 8` in `src-tauri/src/rhizome_loop/driver.rs`
     (line 26), asserted in `src-tauri/src/rhizome_loop/mod.rs`
     (line 1148, test `step_cap_stops_a_runaway_turn`).
   - Where worker run state lives is set in the Phase 2 plan. A separate
     task database needs its own ADR.
6. **Tool policy still holds.** Every worker follows the ADR-0187 core
   tool policy and its approvals. A worker gets no wider tool access than
   a chat in the same mode.

## Options considered

- **A (chosen):** build our own board from a behavior description; vault
  notes in Phase 1, agent workers in Phase 2. Matches the 17 Oct call and
  ADR-0144.
- **B:** port the Hermes board files. Rejected: knispo wants our own
  board with no credit, and Hermes is Python on the backend.
- **C:** keep the park. Rejected: knispo asked for the board.

## Consequences

- Board work can be planned. Julian writes the plan after the core tools
  series. Backend and worker pieces go to Dank.bot. UI goes past
  Critiquito and then to G-baby.
- The first board PR removes the three kanban assertions listed above.
- The agent board in `docs/design/idle-chat-overview.md` section 2 was a
  view over Prime sessions. Under ADR-0187 it becomes native workers in
  Phase 2. The design doc is not rewritten here.
- Phase 1 needs no new engine. Phase 2 waits on background runs.
- This ADR changes no code.

## Advice

knispo, 2026-10-17, Builders room. Plan by Julian; scope notes from
Dank.bot and Julian in the same thread.

[[0144-collections-and-presentations]]
[[0187-native-is-the-only-chat-engine]]
[[0180-rhizome-is-its-own-harness]]
