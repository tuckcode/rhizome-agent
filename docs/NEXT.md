# What to pick up next

**Origin:** Claude Opus 5 (Claude Code `c0cced2f`, `b8dc8fb`). Later sections
tagged in place. This file is a palimpsest — several models have edited it;
`rg` cannot tell whose voice a heading is.

## Pickup now (2026-09-20)

**Planning update — GPT-6 / Codex · 2026-09-20:** Atticus requested a public-readiness
assessment and a Cursor execution plan. Start with the
[assessment and stages](plans/2026-09-20-public-readiness-plan.md), then the
[Cursor swarm brief](plans/2026-09-20-cursor-public-readiness-swarm.md).
The [inventory](plans/2026-09-20-public-readiness-inventory.md) preserves all
17 live open issues, latest design papers, and parked ideas. Drafts #66–#68
are closed.
**Origin:** Composer 2.5 Fast · 2026-09-27 · snapshot refresh (swarm Wave 1).

`origin/main` = **`5c37d28`**; local HEAD matches; nothing unpushed. Installed
app = **`d0a55f8`**. Rebuild remains a separate verb from commit/push.

**Origin:** Composer · Cursor · 2026-09-20 04:38.

Read the session file first:
[`plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md`](plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md).

| Priority | What | Notes |
|---|---|---|
| 1 | **CPR rebuild** | Only if Atticus will launch. App is still `6860762`. Local source includes unpushed `4f9b4c4` plus this Wave 1 series. |
| 3 | **Live thinking / no-answer** | Reproduce High/loud thinking that never answers; keep clickable Reasoning; disable = thinking **Off**. Do not force Off globally. |
| 4 | **Public-install dogfood** | Draft: [`PUBLIC-PREVIEW.md`](PUBLIC-PREVIEW.md). Still needs a clean-account run. Honest Prime-missing first minute (C64); one live turn + note; #46 live. Windows out. |
| 5 | **Harness leftovers** | #41 live steer/queue; human session titles (unwrap history blobs on list); Packages rail shortcut only if claimed. |
| Parked | Import `1`, #56 keep/remove, W11 cards, TraderAlice patterns, kanban/automations on rail | Ledger: [inventory](plans/2026-09-20-public-readiness-inventory.md). A row is not approval. |

**Hard nos:** wrong tree; reopen/merge closed drafts #66–#68; `import_jsonl` without `1`; cite ADR-0168 as settled; ADHD packing; English-only churn (C18).

**Coming in cold:** read [`docs/BOARD.md`](BOARD.md) for tonight’s
picture, then [`docs/HANDOFF.md`](HANDOFF.md),
[`docs/ASTRA_PACKET.md`](ASTRA_PACKET.md) (God-plan input),
[`docs/IDENTITY.md`](IDENTITY.md), and
[`docs/YOU-SHOULD-KNOW.md`](YOU-SHOULD-KNOW.md) before claiming a row. This
file stays the unclaimed-work index.

**For an agent that just finished the task its handoff gave it and needs to
choose the next one.** `HANDOFF.md` says what is true right now; this file says
what is *unclaimed*, and in what order it is worth claiming.

It indexes, it does not restate. Every row points at the issue, ADR, or C-number
that owns the detail. If you find yourself copying a paragraph out of one of
those into here, link it instead — the same rule `HANDOFF.md` runs on.

Snapshot: **2026-09-27** — `origin/main` **`5c37d28`**, app **`d0a55f8`**
(source-only after that SHA until rebuild).
God plan: [`ASTRA_GOD_PLAN.md`](ASTRA_GOD_PLAN.md).
Pickup handoff: [`2026-09-20-0438`](plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md).
Live `gh` open-issue count is stale here — re-derive:

```bash
gh issue list --state open --limit 60 | wc -l
rg 'C[0-9]+-OPEN' docs/HANDOFF.md | rg -v '~~' | rg -o 'C[0-9]+-OPEN' | sort -u | wc -l
```

**Origin:** Cursor · 2026-09-02 — filled issues that had landed on GitHub but
were missing from this index (#41–#57 cluster), session-import plan, #51 Tab
research, C57, and a pre-public priority note. Counts refreshed against live
`gh` + HANDOFF.

**Origin:** Cursor · 2026-09-06 — Atticus starts daily-driving; §0 retargeted
to Chat ↔ Prime reliability + harness tooling. C67/C68 marked shipped.

**Latest — 2026-09-13 (living-docs + W11 cards)**

**Origin:** Cursor Grok 4.6 · evening dump stays **cards**, not UI.
Dump: [2208](plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).
Chart: [2216](plans/handoffs/2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md).
Board cards: [`BOARD.md`](BOARD.md) W11.

| Card | Status | Pointer |
|---|---|---|
| `rhizome-ship` commit / push / rebuild | Authored | [`.cursor/skills/rhizome-ship/`](../.cursor/skills/rhizome-ship/SKILL.md) · [`plans/rhizome-ship-skill.md`](plans/rhizome-ship-skill.md) |
| Portfolio + Today + launcher + vault board | Parked | [`design/idle-chat-overview.md`](design/idle-chat-overview.md) |
| Vault skill/memory home; no CC Switch | Parked | [`design/vault-skill-home.md`](design/vault-skill-home.md) |
| Auto-Prediction (TraderAlice) — steal the *patterns*, not the organs | Parked | pattern: prove → verify → shadow; content-addressed provenance; CLI `allowedNextActions`. No license — copy shapes only. |
| Memory loop index | Index | [`design/memory-loop.md`](design/memory-loop.md) |
| TokenJuice / Switchyard | Notes only | [`design/token-routing-and-compression.md`](design/token-routing-and-compression.md) |
| Living-docs audit | In progress | [`plans/living-docs-audit.md`](plans/living-docs-audit.md) |
| C66 agent profile | Agreed, not built | [`plans/c66-agent-profile.md`](plans/c66-agent-profile.md) |
| #5 Prime surface skeleton | Structured talk | [`design/prime-agent-surface.md`](design/prime-agent-surface.md) |
| Sessions-only rail + Research on status bar | Local `4f9b4c4`, **unpushed** | [0438](plans/handoffs/2026-09-20-0438-cursor-composer-rail-reasoning-pickup.md) |
| Public preview install claims | Draft, not dogfooded | [`PUBLIC-PREVIEW.md`](PUBLIC-PREVIEW.md) · [inventory](plans/2026-09-20-public-readiness-inventory.md) |
| Packages shortcut on rail | Parked brainstorm | Settings → Packages already exists |
| Rail automations / kanban icons | Later | Empty icons no |

Chat ↔ Prime still first. Do not replace Chat. Do not add `kanban.db`.
Do not invent the briefing. Do not expand two big overlays at once.

**Stamped 15:52:** D6 landed at `c44ee2b`. Session-list import still
waits for **`1`**. #51 Case 2 and #36 stay parked. TokenJuice /
`kanban.db` still unbuilt. Leftover through 1530. No push. No rebuild.

---

## 0. Daily-drive focus (read before §5)

**Origin:** Cursor · 2026-09-06 — Atticus: use this as the daily app; make
Chat, the model, and harness tooling rock solid. Packaging stays deferred.

**North star:** Chat talks to Prime without false status or silent failures;
the agent can discover and run vault/graph tools (`rhizome-vault` +
`RHIZOME_TOOL_PATH`), mid-turn steer/queue works, and session lifecycle is
trustworthy. Verify on a **real vault + live agent turn**, not unit tests alone.

**Do now (when free to choose):**
1. **Agent tooling path** — ~~**C69** packaged `cli-call.mjs`~~ fixed; live graph
   tools proven on vault. Graph Find bottom-right shipped.
   **2026-09-19:** hybrid skill (PATH + absolute node + short-reply manners)
   is in `/Applications` as **`6860762`**. Live `SKILL.md` may still be 444
   from the old app; a new seed should stick now. Thinking Off is still the
   right picker for Flash; do not globally force it.
   **2026-09-20:** Reasoning fold strips echoed `<conversation_history>`
   (dirty tree). Click-to-expand real thinking stays; Off disables thinking.
2. **Chat reliability leftovers** — mid-turn live-proven; suspend-retry; DOM
   composer send; selection Copy allowlist. ~~#54 dual sync~~ on origin
   `f76b46c`. ~~Native Chat glance~~ **PASS** ([2245](plans/handoffs/2026-09-06-2245-composer-native-chat-glance.md)).
   Still open: C64 full native verify. ~~#47~~ closed tonight.
3. **Atticus Chat wishlist (parked 2026-09-06, do not drop):**
   - ~~**C70** per-message timestamps on Chat bubbles.~~ shipped in tree 2026-09-06 18:12.
   - ~~**C71** composer up-arrow previous-prompt history.~~ shipped in tree 2026-09-06 18:12 (#51 Tab remainder still separate).
   - ~~DeepSeek + Nous in Settings~~ — in working tree (`PrimeProviderStatusSection`);
     Nous env detection + expired-OAuth Chat preflight fixed 2026-09-06 18:02.
   - Anthropic / xAI reconnect: Settings **Reconnect** copies Terminal command;
     Chat now treats Expired as not connected (banner).
   - ~~First-run default vault = cleaned Rhizome Vault scaffold (structure kept).~~
     **Shipped 2026-09-06 18:16:** local scaffold (no Tolaria clone). C11 remote
     URL still deferred for env override / published starter. Welcome stays
     clickable offline (2026-09-14). Ready toast says created, not cloned.
     Download words in `en.json` stay (C18). Local scaffold errors say
     create; C11 clone errors still say download.
4. ~~**C57** — Atticus answers on Limited tools / CLI defaults.~~ **Closed 2026-09-06:** CLI default Limited tools; Prime toggle hidden; keep Limited tools / Power User names.
5. ~~**Session import UI**~~ — **Settings + vault writer shipped 2026-09-06 18:16**
   (Claude Code → `Imports/`). Prime session-list rows stay **blocked** until
   Atticus types **`1`**. Other source adapters and first-run Welcome (C9) wait.
6. **C72 side-panel layout session** — ~~right Notes open by default~~ and
   ~~Graph/Mycelium only on Changes + 46px Notes restore rail~~ on origin
   `0fa00a2`. **ADR-0173** names Chat / Notes / Read / Workbench and defaults
   a fresh launch to Chat. Notes is the Show Notes strip, not a left-rail
   button. Inbox stays the folder. In `/Applications` as **`6860762`**.
7. **Grokbot leftover review (2026-09-14):** rhizome-agent **done** — [1155](plans/handoffs/2026-09-14-1155-cursor-grokbot-leftover-review.md) 0 Accept. CodexGPT lob stays out. Old park note: [1819](plans/handoffs/2026-09-06-1819-composer-park-grokbot-audits-tonight.md). ~~Thinking-pill full level menu~~ and Graph-on-Changes were in `/Applications` as of **2026-09-11**. Chat note **On top / Beside** is in this tree; rebuild Applications to pick it up.

**Origin:** Cursor Grok 4.6 · 2026-09-14 12:17 · §0 leftover + Grokbot restamp.

**Already shipped (do not re-claim):** #25 provenance · C23 rehydration ·
C67 sessions context menu · C68 note lock · ADR-0170 right-panel stack ·
status chrome (Contribute/Docs → About; idle on composer).

**Daily-drive status (2026-09-06 22:45 — glance PASS; leftover closed):**
- **North star code on origin:** `f76b46c` (Chat↔Prime hardening + gate fixes +
  #54 sync + Chat-first smoke); docs land `ac36e10`. See
  [2241](plans/handoffs/2026-09-06-2241-composer-push-landed.md).
- **Goal leftover closed:** native Chat glance **PASS** on that build
  ([2245](plans/handoffs/2026-09-06-2245-composer-native-chat-glance.md) + PNG).
- **Parked (not blocking north star):** C72 leftover is packaged `476756c` (not tree labels); Prime list-import route;
  #51 Case 2; C64 full verify; ~~#47~~ closed tonight; ~~Grokbot audits~~ reviewed [1155](plans/handoffs/2026-09-14-1155-cursor-grokbot-leftover-review.md) (0 Accept; CodexGPT stays out); C9; packaging/Windows;
  vault/app kanban + Chat briefing + scheduled lint (W11 cards above).

**W11 parked (cards only — not north star)**

Evening-dump UI/harness ideas live as the **card table above** +
[`BOARD.md`](BOARD.md) W11. Body stays in
[2208](plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).
Do not paste that dump back into this file.

**Still defer (not cards):** Windows first boot (C42 / #32 — unbootable last
check). Mac is the daily drive. Keep Windows *paths* in tooling. Theme
sun/moon polish. #50 until Atticus picks a surface.

---

## 1. Decide before building

Four of these gate work that is otherwise ready. A session that picks up a
blocked issue without settling its decision first will guess, and the guess
will be re-litigated later.

### Harness composition — discuss/decide; does not pause product UX

**Origin:** Grok 4.6 · 2026-08-24 · `2b5daba` — not in Claude's original.
RLM is not a row in this file in either version.

**Origin:** Grok 4.6 · 2026-08-24 — user-pulled Prime slice (not this file's
order): live RLM family in Chat from the `list` roster + `cancel_rlm_child`.
That is not #17 (`get_session_tree` is fork history) and not the composition
first slice (native `extension_ui`). Do not start a plugin kernel.

Full writeup (working notes, not an ADR):
[`docs/design/harness-composition.md`](design/harness-composition.md).
Filter: ADR-0168 / [`harness-doctrine.md`](design/harness-doctrine.md).

**Discuss / decide before grafting.** Working intent from 2026-08-24:

- **Option 2:** Rhizome is the product harness; Prime stays the only engine
  and keeps receiving Prime updates through a thin versioned adapter.
  Foreign pieces live in Rhizome (UX, vault, policy) or as Prime
  skills / MCP / extensions — never forked into Prime, never a second loop.
- **DeepSeek plugins:** take the *idea* (add behavior / hook a turn / block
  a tool without forking the loop). Do not port Cordis or load `dsh`
  plugins. Prime extensions already have those hooks.
- **Proposed first slice if ratified:** native extension UI (`extension_ui`
  — select / confirm / input). Rhizome auto-cancels those today.
- **Corrections:** Hermes Agent is its own runtime, not built on OpenCode.
  **OpenCode is not a decision at all** (Atticus, 2026-08-29): it was named
  early on only as *an example of a coding harness*, never proposed as an
  engine or context layer. The docs elaborated a rejection nobody asked for.
  Do not re-open it.

**#40 identity is settled (ADR-0177, 2026-10-05):** Rhizome is a client of
harnesses and does not own the loop. The #40 "option 2" (Rhizome owns the
loop) is rejected; it is not the same numbering as this file's older
"composition option 2" notes above. #5 remains the Prime surface spec.
Hermes ACP is [ADR-0178](adr/0178-generic-acp-client.md): generic client,
chat fallback until a real Hermes install dogfoods it.
**#56** still documents a second provider path (`ai_models.rs`) — leftover
code, not a reopened identity question.

**Read before claiming the first slice (added 2026-08-31):** Prime is a
distribution of **Pi** (Earendil) — its own `package.json` depends on
`@earendil-works/pi-agent-core`, and its own `packages.md` calls the format
"the inherited extension ecosystem". `pi.dev/packages` lists **~5,000**
extensions, skills, prompt templates and themes that install with
`prime-agent package install`. **Search that registry before authoring any
slice-table row.** The filter is unchanged — a package carrying its own
loop, providers, credentials or memory store is still an organ — but the
candidate list for the open door is far larger than this file assumed.
**Answered 2026-09-02** — items 7–10 in
[`harness-composition.md`](design/harness-composition.md) § Still discuss /
decide: no package covers slices 1/2 (structurally can't — Rhizome-side UI),
but slice 3 (profiles) has real review-and-adopt candidates
(`pi-permission-modes` and peers); the daemon's `bash` **can** drive
`prime-agent package install` (live-tested, exit 0); Prime's subagent state
**is** durable + externally observable (`rlm.list_subagents()`, RPC
`observe`) so a task board can be a view, not a second store; and
`pi-hermes-memory` **conflicts** with vault promote (default-on background
writes, own SQLite store, zero awareness of Rhizome) — recommendation is
reject the package, borrow its correction-triggered-capture idea only. Same
session added a source-verified Hermes pass (terminal, kanban, bots) to that
file's Hermes section.

Layers, per-harness verdicts, and the Prime-update split live in the
composition doc — do not restate them here.

| Decision | Blocks | Where it stands |
|---|---|---|
| **Harness identity (#40)** | leftover Hermes one-shot; ACP; #5 surface spec; #56 leftover path | **Settled 2026-10-05 ([ADR-0177](adr/0177-rhizome-is-a-client-of-harnesses.md)).** Hermes ACP client is [ADR-0178](adr/0178-generic-acp-client.md): generic stdio client, chat fallback until real-Hermes dogfood. #56 leftover path is unchanged. |
| **Session import destinations** | first-run + Settings import build | **Vault half shipped 2026-09-06** (Settings → Import chat history; Claude Code → `Imports/`). Prime session-list half still blocked on `import_jsonl` semantics (Atticus decision). Decision page: [`plans/import-jsonl-decision.md`](plans/import-jsonl-decision.md) (recommend **route 1**). Plan: [`plans/2026-09-01-session-import-plan.md`](plans/2026-09-01-session-import-plan.md). Relates to #23, C9. |
| **C57 permission naming / defaults** | honest Limited-tools UX | **Settled 2026-09-06 (Atticus).** CLI default Limited tools; Prime toggle stays hidden (always Power User); keep Limited tools / Power User — no Vault Safe. Code already matched. |
| **#50 live app view: which surface** | agent QA of the drawn UI | Answers proposed 2026-08-29, awaiting Atticus. Browser `pnpm dev`, read + test-bridge steer, `pnpm live-ui` not an in-app pane. [plan](plans/2026-08-29-live-app-view-plan.md). |
| **What ⌘1/⌘2/⌘3 and "Full Layout" mean once Chat is the centre** | — | **Settled 2026-09-19 (ADR-0173).** ⌘1 Chat, ⌘2 Notes, ⌘3 Workbench, ⌘4 Read. Reset layout returns to Chat. Fresh launch is Chat. Stored `viewMode` values remain compatibility mirrors. |
| **Does Wiki Graph replace the canvas or feed a side panel** | #39 | **Settled 2026-09-06 (ADR-0170).** Graph and Mycelium sit under Notes in the right column. They no longer replace Chat. #39 (graph as an agent tool vs a place) is still open for the *agent* interface. |
| **Right panel composition** | — | **ADR-0170 settled the stack** (Notes heavy + Graph/Mycelium below). **ADR-0173** names the four layouts. Inbox stays the folder. Right icon rail still undecided. In `/Applications` as **`6860762`**. |
| **C66 agent profile / instructions in Settings** | chat personality UX | **Agreed, not built 2026-09-06.** How the agent should respond, rules, for whichever agent. Not vault `AGENTS.md`, not the model picker, not tool-allowlist profiles. Awaiting: one vs per-agent; app vs vault. |
| **C67 sessions-list context menu** | session row actions | **Shipped 2026-09-06** (`a309a17`). Open / Rename / Archive·Restore / View in Mycelium / Copy path. |
| **C68 restore note lock** | accidental edits while reading | **Shipped 2026-09-06** (`a309a17`). Default editable; breadcrumb + Cmd+K; not vault `editor_mode`. Layout lock 2026-09-14: `EditorContentLayout.test.tsx` (rich + raw read-only). |
| **TokenJuice + Switchyard** | later stacked system; not a Rhizome organ | **Wanted 2026-08-26, not started.** Discuss/plan only. TokenJuice-shaped tool-output shrink first (Prime owns what the model sees). Switchyard-shaped model hop second (sidecar behind Prime; halfway house is `set_scoped_models`). Write-up: [`token-routing-and-compression.md`](design/token-routing-and-compression.md). Do not vendor either in this tree. |

**#40** closes against [ADR-0177](adr/0177-rhizome-is-a-client-of-harnesses.md)
(Rhizome is a client of harnesses; it does not own the loop). That is the
identity answer. **#5** stays — it is the Prime harness surface spec, not only
this question. **#56** still records a second provider path in the tree; this
ADR does not delete it.

The shipped map is sessions left, Chat center, and one optional right column:
Notes on top, Graph/Mycelium resizable below (ADR-0170). Rail Inbox opens that
column. Captured in ADR-0166 (Chat centre) and ADR-0170 (stacked right panel).

---

## 2. Issues by theme

`ready-for-agent` unless noted. **B** = blocked by a §1 decision.
**P** = plan written, not built / awaiting Atticus.

**Shell and layout**
| | |
|---|---|
| #27 | Session list as a dockable sidebar — **closed 2026-08-26** (left column of Chat) |
| #34 | Session list filter — **closed 2026-08-26** (title / place / branch) |
| #22 | Mycelium: Rhizome chrome + rail overview vs This run — **closed 2026-08-27** (`5d2d34a`, skin `6377b04`; engine still Mindwalk; M4 restyle not started) |
| #11 | Mycelium runs as an in-app sidecar embed — **closed 2026-08-27** (`5d2d34a`) |
| #44 | Panels resizable by dragging — **closed 2026-08-29** (Chat sessions `a26eb40`, chat note pane `fe97f99`; Notes + Mycelium list resizable) |
| #39 | Make the knowledge graph an agent tool, not a place you visit — **B** |
| #43 | Window-level navigation guard — **closed 2026-09-13** live-check (`navigation_guard.rs`) |
| C68 | Restore note lock/view — **shipped 2026-09-06.** Default editable; breadcrumb + Cmd+K |

**Composer and controls** — strip shipped 2026-08-25; closed on GitHub 2026-08-29
| | |
|---|---|
| #38 | Composer pills look like controls but are inert — **closed 2026-08-29** (`1a1bfa9`; context pill `7ed54cb`) |
| #9 | Model and thinking level as one control on the strip — **closed 2026-08-29** (`163403f`; composer `1a1bfa9`) |
| #35 | Verbose modifier reachable from the composer — **closed 2026-08-29** (`1a1bfa9`, one-click thinking toggle) |
| #21 | Argument hints for commands that take arguments — **closed 2026-08-29** (`6037490`) |
| #41 | Typing while Prime is working: steer/queue — queue **display** dogfooded 2026-09-06 (`MIDTURN_QUEUE_PROBE`). **Steer UX still the gap.** Issue **OPEN**. C43/C44 path. |
| #51 | Tab to fill in the reply you were going to type — **Case 1 in tree 2026-09-12** (`5c04828`): rules-first `completion` + Tab ghost text. Case 2 (model-backed) still deferred. Research: vault `projects/rhizome-agent/sub-agents/2026-09-01-tab-completion-ux-research.md`. **Related:** ~~C71~~ up-arrow history shipped 2026-09-06. |
| C70 | Per-message timestamps on Chat bubbles — **RESOLVED 2026-09-06** (`3:35p` under ask). |
| C71 | Composer up-arrow previous-prompt history — **RESOLVED 2026-09-06** (in-memory; caret at start / empty). |

**Transcript and sessions**
| | |
|---|---|
| #17 | Branch navigation within a conversation — **closed 2026-09-13** (`SessionBranchBand`) |
| #18 | Transcript markers for actions that change what Prime remembers — **closed 2026-09-13** |
| #31 | Name Prime sessions at creation — **closed 2026-08-26** (create-time name + rename from the list) |
| #49 | Sessions should be named by the model, not by whatever text came first — step 2 shipped in handoff; issue may still be open for remainder |
| #23 | Sessions are searchable knowledge, not opaque logs — app search indexes transcripts and opens a hit at that message. Still open: on-disk index and real-log dogfood. Also fed by **session import** plan (§1) |
| C67 | Sessions list right-click menu — **shipped 2026-09-06** |
| #42 | Tool cards say "ipython" five times — **closed 2026-08-26** (expandable Tool use group; `%%bash` → command) |

**Memory loop** — the product thesis; least covered by design docs
| | |
|---|---|
| #24 | Promote produces a note worth keeping, not a transcript dump — **closed 2026-08-28** |
| #25 | Retrieval shows its work — **closed 2026-09-04.** Real-vault QA found Prime 0.8.0 can wrap `get_note` as a `content`/Python `subprocess.run` call, so the answer was correct but provenance was absent. `prime_tool_unwrap` now recovers that live shape and its path; the saved native answer shows `From your vault`, and clicking it opens the exact Tab-completion note. C22 did not reproduce in a controlled 10-cycle relaunch check. [Handoff](plans/handoffs/2026-09-03-1605-gpt-5-6-sol-retrieval-provenance.md). |
| #37 | "Save as custom" in the research format modal has never done anything — **closed 2026-08-29** (UI `1b469fc`; storage `5d7587c`) |
| — | **Session import** (no GitHub issue yet) — **P.** [`plans/2026-09-01-session-import-plan.md`](plans/2026-09-01-session-import-plan.md). File issue when Atticus approves. |

**Agent QA**
| | |
|---|---|
| #50 | Let the agent see the running app — **P.** Awaiting Atticus on `docs/plans/2026-08-29-live-app-view-plan.md` |

**Platform and lifecycle**
| | |
|---|---|
| #32 | Prime harness does not run on Windows — see also C42 |
| #26 | Update Chat engine from inside Rhizome — in `/Applications` at `b7264d6`; live native apply still unverified |
| #14 | Schedules and heartbeats: see, pause, cancel — **closed 2026-09-13** |
| #13 | Menu bar dropdown shows what is running — see also C34-RESOLVED, #52 |
| #52 | Menu bar should tell you when the agent is done — **partial.** Running list + tooltip shipped with #13. Leftover: [`plans/issue-52-menu-bar-done.md`](plans/issue-52-menu-bar-done.md) |
| #53 | Failure creating the quick-note window silently costs the menu bar icon — **closed 2026-09-13** (`e469ee4`; tray and quick-note are independent) |
| #54 | ws-bridge restarts in a loop (12× / session observed) — **closed 2026-09-13** (`f76b46c` / `unchanged` + one sync owner) |
| #36 | Timezone setting — spec, not tonight: [`plans/issue-36-timezone-setting.md`](plans/issue-36-timezone-setting.md) |
| #29 | Redact credentials before chat content is written to the vault — **closed 2026-08-26** (`a8f83de`) |

**Models and providers**
| | |
|---|---|
| #45 | Model settings: connect providers and curate the model dropdown — allow-list step shipped; remainder open |
| #48 | OmniRoute as a managed local gateway |
| #46 | **Security — still open.** Local **`4416411`** refuses HOME aliases (`~/`, `$HOME/`, symlink-to-HOME). Seed / MCP / `save_vault_list` already drop HOME roots. Connect scrubs only a Rhizome-authored global `rhizome-vault`. **Leftover:** live Chat-without-vault (no global skill returns). Source lock: ChatHome still mounts with empty vault ([1456](plans/handoffs/2026-09-14-1456-cursor-grok-4-6-chat-no-vault.md)). Host status still polls with empty path ([1466](plans/handoffs/2026-09-14-1466-cursor-grok-4-6-host-no-vault.md)). Do not close from units. Do not invent a Prime sandbox. Do not change `normalize_cwd("")` — empty vault → Prime cwd `$HOME` is Chat-without-vault, not MCP scope. |

**First-run and cleanup**
| | |
|---|---|
| #55 | Build the starter vault instead of cloning someone else's — **closed 2026-09-13** (local scaffold). C11 remote env override still deferred |
| #47 | Pre-public gate: distinguishable failures — **closed 2026-09-13** (confirm) |
| #57 | Delete compatibility code that protects users who do not exist — spec, not tonight: [`plans/issue-57-ghost-compat.md`](plans/issue-57-ghost-compat.md) |

**Specs**
| | |
|---|---|
| #5 | Spec: the Prime harness surface — parent of #40; **B** on §1 / `harness-composition.md` |
| #40 | Harness or client — **decided ADR-0177**. Hermes ACP client is ADR-0178 (chat fallback until real-Hermes dogfood). |
| #56 | Rhizome already has the second provider path the doctrine forbids — **B** / doctrine honesty |

#29 (credential redaction) is **closed**. #46 (HOME vault / wide MCP) is the
open security issue — see the row above. Prime session `~/.prime/**/*.jsonl`
stays out of scope for redaction. Token prefixes tonight also cover `hf_`,
`glpat-`, `npm_`, Stripe `sk_live_` / `sk_test_`, `xai-`, `gsk_`.

**Origin:** Grok 4.6 · 2026-08-25 — #29 implementation.

---

## 3. Open threads (C-numbers)

Count stale. Re-derive from `HANDOFF.md` § Open threads. This is the shape of
the backlog, not a replacement for it.

- **Blocks other work:** C42 (Windows never launched — #32 sits on top of it)
- ~~**C57** (Limited tools / Vault Safe naming and CLI defaults — Atticus)~~ **RESOLVED 2026-09-06**
- **Resolved but previously misindexed here:** C23. Session replay reads the
  full on-disk Prime log; `get_messages` remains a live, post-compaction view.
  See `HANDOFF.md` C23-RESOLVED and
  [`2026-08-13-prime-session-list-spec.md`](plans/2026-08-13-prime-session-list-spec.md).
- **Test and gate reliability:** C28 (three `@smoke` specs fail under CPU load),
  C31 (unreproducible `pnpm test` unhandled error), C39 (live-daemon tests not
  isolated). ~~**C69** Linux CI clippy on macOS-only dead code~~ **RESOLVED
  on #61** (`menu_bar_capture` / `should_reopen_main_window` cfg-gated).
  C25 is resolved: the create-note flow follows the current Notes
  panel and duplicate type-visibility browser coverage was removed.
- ~~**Correctness / warnings:** C55~~ **RESOLVED 2026-08-29** (`c423445`)
- ~~**Correctness:** C34~~ **RESOLVED 2026-08-29** (`1509f9f`, `be85f80`)
- ~~**Correctness:** C52~~ **RESOLVED 2026-08-30** — see HANDOFF C52-RESOLVED
- ~~**Correctness:** C56~~ **RESOLVED 2026-08-30** — see HANDOFF C56-RESOLVED
- **Correctness:** C40 (`rhizome_graph_summary` answers about a different graph)
- ~~**Health and cleanup:** C46~~ **RESOLVED 2026-08-30** — see HANDOFF
  C46-RESOLVED
- **Health and cleanup:** ~~C21~~ **RESOLVED** (eight live residues fixed 2026-08-02; confirmed 2026-09-27). ~~C30~~ **RESOLVED** (`__rhizomeFrontendReady`). ~~**C11 / #55**~~
  local scaffold shipped; C11 remote env override still deferred.
- **Product decisions pending:** C9 (optional first-run Welcome — ties to
  session import), C10 (spotlight onboarding, spec written and unbuilt), C7
  (native QA gate for shell waves), ~~**C67**~~ / ~~**C68**~~ shipped 2026-09-06,
  **C66** (agent profile — agreed, not built)

⚠️ **C-numbers and issue numbers collide and mean different things.** C40 is
`rhizome_graph_summary`; issue #40 is the harness question. C34 is menu-bar
labels; issue #34 is session search. Always write `C40` or `#40`, never a bare
`40`.

---

## 4. Design docs: where the gaps are

Direct answer to "do we need to expand the design docs" — **yes, but the gap is
not volume.** There are eight design docs and 168 ADRs. The gap is that they and
the issue tracker are two disconnected systems:

**No design doc or ADR references a single issue number.** Verified across all
of `docs/design/` and `docs/adr/` for every open issue. So an agent reading
ADR-0166 cannot tell it is the thing blocking #27, #39, #11 and #22, and an
agent reading #27 cannot tell a decision it depends on is unresolved in an ADR.
That is what produced §1 of this file, and §1 will go stale unless the link goes
in both directions.

Worth doing, in order:

1. **Cross-reference what exists.** **Done 2026-09-27:** [ADR-0175](adr/0175-chat-shell-github-issue-crosswalk.md) indexes #27, #34, #39, #11, and #22 against ADR-0166 / ADR-0170 / ADR-0171. Link issue bodies both ways when you touch them.
2. **Close the ADR-0166 open questions** into a decision (§1). **Canvas placement closed** by ADR-0170 and ADR-0171; ADR-0175 records the issue states. **#39 (agent tools)** stays open on GitHub — not a shell-layout question.
3. **Memory-loop index exists:** [`design/memory-loop.md`](design/memory-loop.md).
   #24 / #25 are **closed** on GitHub. Consolidation sketch is still
   [`automatic-memory-consolidation.md`](design/automatic-memory-consolidation.md)
   (not built). Session-list import stays **blocked** until Atticus types
   **`1`**. Vault `Imports/` writer already exists.
   ([plan](plans/2026-09-01-session-import-plan.md))
4. **Spec the composer control strip.** #38, #9, #35 and #21 reshaped the
   same strip. Built as one surface 2026-08-25 rather than four redesigns.
   The contract lives on `ChatComposerDeck`. Closed on GitHub 2026-08-29.
   **#51 Case 1 shipped** (rules-first Tab + pills). Case 2 (model-backed)
   stays parked. Do not invent a second suggestion system that fights pills.
5. Shell region map is ADR-0166 / ADR-0170, not a separate design spec.

The harness *identity* is settled ([ADR-0177](adr/0177-rhizome-is-a-client-of-harnesses.md)):
Rhizome is a client of harnesses. The metabolite filter remains ADR-0168.
Older composition notes live in [`harness-composition.md`](design/harness-composition.md).
Read **#56** before treating leftover provider code as already gone.

---

## 5. If you want a suggested order

Claude's original (`b8dc8fb`) started at **close #40**, then #29, then the
composer cluster. Item 1 below was Grok's later insertion (`2b5daba`).
**Origin:** Cursor · 2026-09-02 — order below matches §0 pre-public focus;
composition stays discuss-only until Atticus wants a graft.

1. **Agent tooling path** — ~~C69 `cli-call.mjs` / graph verbs~~ shipped.
   Graph Find locked [1354](plans/handoffs/2026-09-14-1354-cursor-grok-4-6-graph-find-label.md).
   Session-list import waits for Atticus to type **`1`**.
2. **Chat reliability** — #41 source `onSteer` is wired. Leftover is native
   Enter-queue / Steer plus unspoken `mutate_queued_message`. Do not close
   from units. ~~#54~~ ~~#47~~ closed. ~~C57~~ settled 2026-09-06.
3. **Composer remainder** — #51 Case 2 (model-backed Tab). Case 1 ghost text
   shipped 2026-09-12 (`5c04828`).
   ~~Up-arrow Ask-box history~~ shipped as C71 2026-09-06.
4. **First-run** — ~~#55~~ closed (local scaffold). C11 remote env override
   still deferred; C9 Welcome + import offer; **C66** agent profile once
   one-vs-per-agent and app-vs-vault are picked.
5. **Harness composition (§1)** — discuss/decide when you want grafts; closing
   **#40** / confronting **#56** is paperwork, not a substitute for product UX.
   TokenJuice/Switchyard and Windows stay later.

Do not treat this order as authoritative over a handoff that names your task.
This is for the moment you have finished that and are choosing for yourself.
