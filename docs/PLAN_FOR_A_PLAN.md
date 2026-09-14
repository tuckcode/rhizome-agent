# Plan for a plan — Rhizome Agent (2026-09-13 night)

**Status:** God-plan *input*. Not the God plan.  
**For:** Astra, then Cursor s-plans.  
**Paste-ready twin:** [`ASTRA_PACKET.md`](ASTRA_PACKET.md)  
**Morning pointer:** [`MORNING.md`](MORNING.md)  
**Do not clobber:** [`BOARD.md`](BOARD.md)

Atticus’s pipeline:

1. This file + ASTRA_PACKET (inventory, workstreams, harness map)
2. Astra God plan
3. s-plans per harness (Cursor thick; Codex/Claude thin)

This document does **not** invent a competing architecture.

**Timeline:** work **starts tonight**. Morning is the last few hours,
not the start. Astra writes the God plan **in parallel**. Cursor already
executes W1–W11 from [`ASTRA_PACKET.md`](ASTRA_PACKET.md).

---

## 1. What exists today

### Project

| | |
|---|---|
| Path | `/Users/dtc/code/projects/rhizome-agent` |
| GitHub | `tuckcode/rhizome-agent` (private) |
| Identity | Rhizome Agent (`ai.rhizome.agent`), **not** Rhizome Desktop (`knispo/rhizome`) — [`IDENTITY.md`](IDENTITY.md) |
| Product | Desktop Chat shell. Vault = durable memory. **Prime Agent = only engine.** |
| Branch | `main` tracking `origin/main` |
| Tip at packet write | `5c629a0` — docs sync (Nous Chat list + Notes seam) |
| Board’s stamped app | `476756c` @ 2026-09-12 22:43 → `/Applications/Rhizome Agent.app` |
| Prime on machine | **0.9.3** (`~/.prime/`) |

Related trees **not** the board owner: `rhizome-agent-pr-60`,
`rhizome-agent-pr-62` (old PR worktrees), `code/repos/TradingAgents`,
`Documents/Codex`, `HarnessAgents/`. Ignore unless a workstream names them.

### Later docs (read order for a new session)

0. [`ASTRA_PACKET.md`](ASTRA_PACKET.md) / this file (this push only)
1. [`BOARD.md`](BOARD.md) — 2026-09-12 picture
2. [`HANDOFF.md`](HANDOFF.md) — what is true
3. Latest `docs/plans/handoffs/`
4. [`NEXT.md`](NEXT.md) — unclaimed work
5. [`YOU-SHOULD-KNOW.md`](YOU-SHOULD-KNOW.md) — multi-day briefing (**§4 stale vs GitHub**)
6. [`ARCHITECTURE.md`](ARCHITECTURE.md), [`CROSS-MODEL-HANDOFF.md`](CROSS-MODEL-HANDOFF.md)
7. `AGENTS.md`

Parked design source of truth for “ideas we talked about”:
[`plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md`](plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).

### Harnesses on this machine (coding tools)

| Harness | Role tonight |
|---|---|
| **Cursor** | Burn target. Almost all sub-agents. Grok 4.6 + Composer 2.5. |
| Codex | Thin s-plan later only. Do not park overnight work. |
| Claude Code | Thin s-plan later. ADHD+status already in `~/.claude/CLAUDE.md`. |
| Prime (in Rhizome Chat) | Product engine, not a coding-harness for this push. |
| Hermes / Grokbot / Pi | Context / audits parked. Not executors tonight. |
| Rhizome MCP | Vault not open at packet write. |

### Overnight lanes already on Cursor (do not redirect)

| Lane | State |
|---|---|
| ADHD+status → Cursor User Rules **id 17932869** + `~/.claude/CLAUDE.md` | Done / do not redo |
| Docs/board context filler | Sibling running |
| Issues/PRs | Sibling running |
| Security | Sibling running |
| Prime Agent implementer | Sibling running — document/sequence, don’t fork |

---

## 2. Prime Agent

### What it is

From [`design/rhizome-prime-harness-vision.md`](design/rhizome-prime-harness-vision.md)
and [`IDENTITY.md`](IDENTITY.md):

> Rhizome is the desk and durable memory. Prime is the engine.

Prime ([PrimeIntellect-ai/prime-agent](https://github.com/PrimeIntellect-ai/prime-agent))
is a **Pi** distribution: daemon, workers, RLM/subagents, tools,
long-running sessions. Rhizome hosts and drives it over the daemon
socket (ADR-0163). Rhizome must not reimplement the loop, fork Prime,
or store “memory” only under `~/.prime/agent`.

Doctrine (ADR-0168 / [`design/harness-doctrine.md`](design/harness-doctrine.md)):
absorb **contracts and artifacts**, never foreign control loops or
memory stores. Composition **option 2** (Rhizome = product harness,
Prime = only engine) is the intended shape and is **not ratified**.
[`design/harness-composition.md`](design/harness-composition.md) is
working notes. **#56** (`ai_models.rs` second provider path) means
do not treat the doctrine as constitutional until that contradiction
is named in the God plan.

### What’s done

A working conversation client: connect, lazy session, prompt, stream,
model + thinking (filtered to what the model can run), fork, compact,
rename, archive, client-owned lifecycle (ADR-0167), mid-turn follow-up
+ queue **display**, RLM children from `list` + `cancel_rlm_child`,
Packages install (`prime-agent package install`) + reload, session
list as Chat furniture, Nous in Chat list, thinking-pill filter.

Spoken commands (39) live in
[`prime-adapter-surface.json`](prime-adapter-surface.json) (audited
2026-09-12, installed 0.9.3). Historical prose in
[`plans/2026-08-22-prime-harness-coverage.md`](plans/2026-08-22-prime-harness-coverage.md)
is older (~25–29%); prefer the JSON.

### What’s missing

Coherent **surfaces**, not 60 scattered RPCs:

1. **Session-list import** — vault `Imports/` + ledger shipped;
   Prime list rows not. Blocked on `import_jsonl` replacing the
   *active* session. Routes in
   [`plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md`](plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md).
2. **#5 spec** of the harness surface Rhizome will speak.
3. RLM remainder (`get_context_tree`, `set_rlm_max_depth`).
4. Queue **mutate** / steer UX honesty (#41 still open).
5. Side questions, refine, agent-to-agent messages, bash/tool
   introspection — unspoken.
6. #26 in-app Prime update (Packages ≠ this).
7. Windows proof (C42). Named pipe code exists.
8. Vault-as-skills / portfolio / kanban — evening dump, not spec.

**Do not implement (1)–(8) as a night-push product.** Sequence and
spec. Exception: a sibling “Prime implementer” may already be writing
notes; absorb, don’t compete.

---

## 3. Board inventory + later-doc cards

See [`BOARD.md`](BOARD.md) for the STE original. Status below is the
God-plan view.

### Finished (packaged `476756c`) — do not reclaim

Daily-drive shell: Notes 240/46, Show Notes 32px, thinking-pill
filter, no hover-collapse, green latest-reply marker, Copy on Chat +
note, #51 Case 1, clear transcript on session click, Packages install,
#65 rail match, session-switch lag cut, Notes divider, Nous Chat list,
Settings gear.

### Pile

| Item | Status | Spec-ready vs blocked |
|---|---|---|
| C64 first-2s ×3 | Weak verify | Ready to **watch**, not recode |
| #47 confirm-close | Leftover | Ready if “finish + close issue” |
| #51 Case 2 | Deferred | Research yes; not required |
| C72 Inbox rename | Partial | Needs new ADR, then ready |
| Prime list-import | Half-built | **Blocked** (import_jsonl) |
| Hide-on-close stop helpers | Found | Ready, narrow |
| Grokbot review | Parked | Audit |
| Windows C42 | Unbootable last check | **Blocked** |
| Dirty 1714 thinking-pill handoff | Leave alone | Do not touch |

### Ideas in the ring

`rhizome-ship` skill (commit/push/rebuild). No paid CI. Portfolio
overview, vault kanban, launcher, vault skill home, STE sync, no CC
Switch, lint report-only, TokenJuice notes, living-docs audit.

Hard no: don’t replace Chat; don’t invent briefing; don’t two overlays.

### NEXT.md extras (not on BOARD pile)

Open C-numbers that still matter: C42, C66 (agent profile — agreed,
not built; one vs per-agent / app vs vault **undecided**), C40
(`rhizome_graph_summary` ≠ in-app graph), C28/C31/C39 test flakes,
C9/C10 onboarding, C7 native QA, C11 remote starter, C58 local
symlink, C53 leftover error surfacing, C60 blank-paint mitigation
unproven. Collisions: **C40 ≠ #40**, **C34 ≠ #34**.

Memory-loop design doc still missing (#24/#25 thesis; #24/#25 GitHub
closed). Session import is the onboarding half of that thesis.

Blank-wiki memory trigger test (HANDOFF top priority leftover **(a)**)
still needs a human at `pnpm tauri:dev`.

---

## 4. Issues, PRs, polish, audits, security

Live `gh` 2026-09-13. Full table in [`ASTRA_PACKET.md`](ASTRA_PACKET.md) §5.

**PR:** #66 DRAFT living-docs catch-up.

**Highest-leverage GitHub work (not new features):**

1. Close-on-live-check: **#14/#17/#18/#43 closed 2026-09-13.** Leftover: #47 native confirm, #55 sample-notes AC
2. Confront #56 (doctrine vs `ai_models.rs`) as paperwork
3. #46 HOME vault / wide MCP — real security
4. #53 menu-bar icon; #54 ws-bridge loop
5. Do not rebuild #9/#21/#35/#38/#24/#25/#29

**Security actuals:** #29 closed; #46 open; C12 closed; Trivy waits
for public flip; no paid Codacy/CI; Grokbot audits parked.

---

## 5. Workstreams × harness × Cursor model

**Cursor is the burn target.** Almost all rows = Cursor.  
**Model split applies only inside Cursor.** Astra must not copy it
onto Codex/Claude s-plans. Grok 4.6 may take every Cursor row.
When in doubt: Grok 4.6. Do not under-assign Cursor.

| ID | Workstream | Harness | Cursor model | Notes |
|---|---|---|---|---|
| W0 | God plan | Astra | — | Then Cursor Grok writes s-plans |
| W1 | Living-docs / board completeness | Cursor | `cursor-grok-4.6-high` | 50% context if Astra delayed |
| W2 | Close-on-live-check issue walk | Cursor | `composer-2.5-fast` | Mechanical |
| W3 | PR #66 | Cursor | `cursor-grok-4.6-high` | |
| W4 | C64 / hide-on-close / #41 honesty | Cursor | `cursor-grok-4.6-high` | |
| W5 | Prime context (#5 outline, spoken table) | Cursor | `cursor-grok-4.6-high` | Spec only |
| W6 | import_jsonl decision page | Cursor | `cursor-grok-4.6-high` | No list-import code |
| W7 | #46 security | Cursor | `cursor-grok-4.6-high` | |
| W8 | C72 small spec | Cursor | `cursor-grok-4.6-high` | |
| W9 | #53 | Cursor | `cursor-grok-4.6-high` | |
| W10 | #54 triage | Cursor | `cursor-grok-4.6-high` | |
| W11 | Evening dump → cards only | Cursor | `cursor-grok-4.6-high` | No UI |
| W12 | Windows | — | — | Not tonight |
| W13 | ADHD+status | done | — | Rules id 17932869 |
| W14 | Codex s-plan | Codex | n/a | **Thin.** No model split. |
| W15 | Claude s-plan | Claude | n/a | **Thin.** No model split. |

### Composer 2.5 mundane bucket

Issue-close paperwork, ADR↔issue cross-links, checklist stamps,
HANDOFF one-liners, `en.json` keys, conflict-free typo batches,
YOU-SHOULD-KNOW → HANDOFF moves of already-true facts.

---

## 6. What we will NOT do before the God plan

- Competing Prime architecture or a large Prime product build
- Portfolio Chat, vault kanban UI, CC Switch, TokenJuice, `kanban.db`
- Replace Chat / invent briefing / two overlays
- Paid CI / GitHub Actions
- Red-button-quit (C22 hide is correct)
- Redo ADHD+status
- Apply Grok/Composer split to Codex/Claude
- Redirect overnight Cursor agents to Codex
- Clobber BOARD.md
- Treat open issues as unbuilt

Overnight siblings **may** keep filling docs, issues, security, and
Prime notes. That is already happening. Sequence around them.

---

## 7. If Astra is delayed — 50% of context

Not “50% of a $200 Cursor sub.” Fill the board/docs/specs so agents
can execute.

1. Honest BOARD / HANDOFF / NEXT vs `5c629a0` + live `gh`
2. Prime spoken vs unspoken vs never-call one-pager
3. import_jsonl decision one-pager (no code)
4. Close-on-live-check vs actually-unbuilt issue list
5. #46 tightened in NEXT
6. Evening-dump ideas as cards only

Grok 4.6 for 1–3, 5–6. Composer 2.5 for 4.

---

## 8. Next 10 actions after God plan

1. Paste God plan into Cursor on this repo.
2. Write `docs/plans/s-plans/*.md` (one per claimed W).
3. Composer closes the live-check issue set.
4. Grok lands or reconciles PR #66.
5. Grok drafts #5 outline (spec only).
6. Grok writes import_jsonl decision; wait for Atticus on route.
7. Grok #46.
8. Human C64 first-2s ×3 on Applications (~2 min).
9. Hide-on-close helper stop if still open.
10. Only then product UI.

---

## 9. Assumptions

Listed in [`ASTRA_PACKET.md`](ASTRA_PACKET.md) §13. Same list. No
questions to Atticus.

---

## 10. What this writer fixed vs only inventoried

**Wrote:** this file, `ASTRA_PACKET.md`, `MORNING.md` (did not exist).

**Did not fix:** no product bugs, no Prime code, no issue closes, no
PR, no ADHD rules (sibling). `move_agent_to_root` failed (subagent
constraint); files still landed in the correct project.

**Inventory sources:** BOARD, HANDOFF, NEXT, YOU-SHOULD-KNOW, IDENTITY,
Prime docs listed above, live `gh issue/pr`, `prime-adapter-surface.json`,
git tip, evening dump, session-import brief, parent transcript
`542e03eb-7ace-4de1-9846-b4fe9509b41b`. Rhizome MCP unavailable.
Personal store empty. No second board.
