# W11 card status — evening-dump index

**Origin:** Cursor Grok 4.6 · 2026-09-14 · W11 lane (no product code).  
**Source dump:** [`handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md`](handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).  
**Chart (secondary):** [`handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md`](handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md).  
**BOARD table:** [`../BOARD.md`](../BOARD.md) § W11 — do not rewrite BOARD here; W1 lifts a pointer later.

North star unchanged: **Chat ↔ Prime first.** Hard no: portfolio Chat UI, `kanban.db`, TokenJuice implementation, new memory store, copied voice skills.
**Stamped 15:26:** still parked. Source lock: `src/lib/parked-organs.test.ts`.

---

## Summary

| Card | Kind | Pointer | Blocker |
|---|---|---|---|
| `rhizome-ship` | **authored** | [`rhizome-ship-skill.md`](rhizome-ship-skill.md) · [`.cursor/skills/rhizome-ship/`](../../.cursor/skills/rhizome-ship/SKILL.md) | Use it. No fourth verb. |
| Portfolio + Today + launcher + vault board | **parked** | [`../design/idle-chat-overview.md`](../design/idle-chat-overview.md) | C64 / Chat reliability; God plan claim |
| Vault skill/memory home; no CC Switch | **parked** | [`../design/vault-skill-home.md`](../design/vault-skill-home.md) | Chat ↔ Prime first; vault paths unnamed |
| Memory loop index | **index** | [`../design/memory-loop.md`](../design/memory-loop.md) | Blank-vault save-loop test (a); list-row import waits for **`1`** |
| TokenJuice / Switchyard | **design notes** | [`../design/token-routing-and-compression.md`](../design/token-routing-and-compression.md) | ADR-0168 defer; no Rhizome organ |
| Living-docs audit | **this lane** | [`living-docs-audit.md`](living-docs-audit.md) | One doc per session; no mass rewrite |
| C66 agent profile | **agreed, not built** | [`c66-agent-profile.md`](c66-agent-profile.md) | Atticus: one-vs-per-agent; app-vs-vault |
| Prime surface (#5 skeleton) | **structured talk** | [`../design/prime-agent-surface.md`](../design/prime-agent-surface.md) | User-job slices gated; #56 unsettled |

**Missing dedicated pointer (reconciled):** none of the eight BOARD rows lacked a link — all pointer files exist. Dump-only topics without their own card file are listed under [Orphans from 2208](#orphans-from-2208-no-board-row).

---

## Cards (detail)

### 1. `rhizome-ship` (commit / push / rebuild)

| Field | Value |
|---|---|
| **Kind** | **authored** |
| **Status** | Skill on disk at `.cursor/skills/rhizome-ship/SKILL.md`. `.gitignore` now allow-lists that folder so D6 can commit it. Three verbs only. |
| **Source** | BOARD “Ideas in the ring” 2026-09-12; not in 2208 dump. |
| **Pointer** | [`plans/rhizome-ship-skill.md`](rhizome-ship-skill.md) · [`.cursor/skills/rhizome-ship/SKILL.md`](../../.cursor/skills/rhizome-ship/SKILL.md) |
| **Blocker** | None for authoring. Invoke only when Atticus says commit, push, or rebuild. |
| **Next action** | Use it. Do not invent a fourth verb. |
| **Stop** | No auto-commit. STE/voice stays out of this tree. |

---

### 2. Portfolio + Today strip + launcher + vault board

| Field | Value |
|---|---|
| **Kind** | **parked** (product UI) |
| **Status** | Executable card written; zero UI shipped. |
| **Source** | 2208 § Product UI; 2216 dock § portfolio / board / launcher. |
| **Pointer** | [`design/idle-chat-overview.md`](../design/idle-chat-overview.md) |
| **Blocker** | Daily-drive north star is Chat ↔ Prime (C64, #46, reliability). Claim only after God plan. |
| **Next action** | When claimed: (1) portfolio + Today strip from real git/vault/session facts, (2) one bottom launcher control, (3) vault `status` columns — one surface at a time. |
| **Stop** | No `kanban.db`. No hover overlays. No Graph as Chat canvas (ADR-0170). Do not invent the briefing. |

---

### 3. Vault as skill / memory home; no CC Switch

| Field | Value |
|---|---|
| **Kind** | **parked** (harness / instruction architecture) |
| **Status** | Structured from dump; Prime still seeds `.prime/agent/skills/rhizome-vault/`. |
| **Source** | 2208 § Rhizome as harness; § Instruction architecture; § Live drift. |
| **Pointer** | [`design/vault-skill-home.md`](../design/vault-skill-home.md) |
| **Blocker** | Vault paths for shared skills/prefs not named; Chat ↔ Prime first. |
| **Next action** | Name vault paths under `agents/shared/`; sync copies into must-load files; drift check on `BEGIN:voice`. |
| **Stop** | No CC Switch port. No SQLite wiki. No memory-updater owning voice. Doctor-door stays subsection here — see [orphans](#orphans-from-2208-no-board-row). |

---

### 4. Memory loop index

| Field | Value |
|---|---|
| **Kind** | **index** (thesis map — not a new engine) |
| **Status** | Index exists; hops partially wired; loop not one executable picture. |
| **Source** | `CONTEXT.md`, NEXT §4, HANDOFF 2026-07-19; cross-links import + vault-skill cards. |
| **Pointer** | [`design/memory-loop.md`](../design/memory-loop.md) |
| **Blocker** | (a) blank-vault save-loop human test open; Prime session-list import rows blocked on `import_jsonl` route. |
| **Next action** | Keep promote/search honest. List-row import waits for **`1`**. Do **not** write a second index. |
| **Stop** | No auto-wiki. No second store. C66 profile is a different card. |

Related pile card (not W11): session-list import brief [`handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md`](handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md).

---

### 5. TokenJuice / Switchyard

| Field | Value |
|---|---|
| **Kind** | **design notes only** (discuss/plan — not build) |
| **Status** | Evaluation complete 2026-08-26; product intent “both, stacked, later.” |
| **Source** | NEXT §1; vault `switchyard-model-routing`; handoff 2026-08-23. |
| **Pointer** | [`design/token-routing-and-compression.md`](../design/token-routing-and-compression.md) |
| **Blocker** | ADR-0168 / harness doctrine: Rhizome must not own compaction or model routing. |
| **Next action** | None in this repo. If trialed: Prime-side skill/sidecar; Rhizome renders only. |
| **Stop** | No vendor in tree. No Rhizome router. No TokenJuice pass over Prime tool output. |

---

### 6. Living-docs audit

| Field | Value |
|---|---|
| **Kind** | **this lane** (W11 + W1 sibling) |
| **Status** | Checklist exists; partial passes done (WINDOWS-DEV, YOU-SHOULD-KNOW §2, area D). |
| **Source** | 2208 § Instruction architecture (“audit living docs”); NEXT §0. |
| **Pointer** | [`plans/living-docs-audit.md`](living-docs-audit.md) |
| **Blocker** | ~560-line `AGENTS.md` + session sediment in HANDOFF; one doc per session discipline. |
| **Next action** | Claim one living doc; `rg` stale claims; strike in place with Origin lines. |
| **Stop** | No mass rewrite. No HANDOFF restack. Voice docs untouched. |

---

### 7. C66 agent profile

| Field | Value |
|---|---|
| **Kind** | **agreed, not built** |
| **Status** | Named in HANDOFF C66; Settings need acknowledged; no store encoded. |
| **Source** | Atticus 2026-09-06; distinct from memory loop and composition slice 3. |
| **Pointer** | [`plans/c66-agent-profile.md`](c66-agent-profile.md) |
| **Blocker** | Three open product calls: one vs per-agent; app-wide vs per-vault; Settings section placement. |
| **Next action** | Atticus picks the three calls → smallest Settings form + vault/app file + Chat prepend probe. |
| **Stop** | Not Prime `USER.md`. Not vault `AGENTS.md`. Not tool allow-lists. |

---

### 8. Prime surface (#5 skeleton)

| Field | Value |
|---|---|
| **Kind** | **structured talk** (executable spec index) |
| **Status** | #5 index file; daily-drive jobs wired; named-unspoken commands listed. |
| **Source** | GitHub #5; ADR-0168; harness-composition (unratified option 2). |
| **Pointer** | [`design/prime-agent-surface.md`](../design/prime-agent-surface.md) |
| **Blocker** | User-job slices gated on God plan; #56 second provider path unsettled; `import_jsonl` route unset. |
| **Next action** | W5/W6 paper gaps; probe live daemon before any new wire. |
| **Stop** | Do not fork Prime. Do not wire a command name without a user job. |

**Stale in pointer (note only):** `prime-agent-surface.md` still says #47 confirm open; BOARD pile marks #47 **CLOSED** 2026-09-13 — living-docs lane should reconcile when that file is claimed.

---

## Orphans from 2208 (no BOARD row)

Topics in the dump without a dedicated W11 card file. Linked here so nothing is lost.

| Dump topic | Where it lives | Kind | Blocker |
|---|---|---|---|
| **Doctor-door handoff** | 2208 § Doctor-door; [`vault-skill-home.md`](../design/vault-skill-home.md) § Doctor-door; 2216 dock intro | **parked** | No Cursor “waiting Session” hanger; Grok suggestions undecided |
| **Stuck-agent path** (Mycelium → useful Graph → fullscreen) | 2208 § Stuck-agent; [`idle-chat-overview.md`](../design/idle-chat-overview.md) build order | **parked** | Graph not useful enough; ADR-0170 |
| **Theme** (corner sun/moon; skins in Settings) | 2208 § Theme | **parked polish** | Later only |
| **Scheduled lint** (every other night, report only) | 2208 § Lint; idle-chat-overview §4 | **parked** | Part of portfolio card build order |
| **Grok suggestions 1–7** | 2208 § Suggestions | **idea** (not decided) | Atticus has not picked a door mechanism |

---

## Cross-lane pointers (do not duplicate)

| Lane | Overlap |
|---|---|
| **W5** | Prime surface paper — same pointer as card 8 |
| **W6** | Session import / `import_jsonl` — memory-loop card + pile #5 |
| **W1** | Living-docs audit + BOARD pointer lift |
| **W8** | C72 Notes clarity — rail polish is a **new ADR**, not W11 UI |

---

## Evidence (this session)

- Read: `BOARD.md` W11, 2208 dump, all eight pointer files, 2216 dock header, NEXT §0 W11 table, W11 stub contract.
- Verified: all eight BOARD pointer paths resolve under `docs/`.
- Written: this file; filled [`s-plans/2026-09-13-astra/W11-parked-cards.md`](s-plans/2026-09-13-astra/W11-parked-cards.md).
- Not committed (per task).
