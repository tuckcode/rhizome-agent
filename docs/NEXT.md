# What to pick up next

**Origin:** Claude Opus 5 (Claude Code `c0cced2f`, `b8dc8fb`). Later sections
tagged in place. This file is a palimpsest — several models have edited it;
`rg` cannot tell whose voice a heading is.

**Coming in cold after 2026-08-24:** read
[`docs/YOU-SHOULD-KNOW.md`](YOU-SHOULD-KNOW.md) before claiming a row. It is
the multi-day briefing (what shipped, what GitHub still calls open, what
not to re-litigate). This file stays the unclaimed-work index.

**For an agent that just finished the task its handoff gave it and needs to
choose the next one.** `HANDOFF.md` says what is true right now; this file says
what is *unclaimed*, and in what order it is worth claiming.

It indexes, it does not restate. Every row points at the issue, ADR, or C-number
that owns the detail. If you find yourself copying a paragraph out of one of
those into here, link it instead — the same rule `HANDOFF.md` runs on.

Snapshot: **2026-09-06**, open C-numbers ~13 (re-derive). Re-derive both
before trusting the counts:

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
2. **Chat reliability leftovers** — mid-turn live-proven; suspend-retry; DOM
   composer send; selection Copy allowlist. ~~#54 dual sync~~ on origin
   `f76b46c`. Still open: C64 native glance; #47 confirm-close.
3. **Atticus Chat wishlist (parked 2026-09-06, do not drop):**
   - ~~**C70** per-message timestamps on Chat bubbles.~~ shipped in tree 2026-09-06 18:12.
   - ~~**C71** composer up-arrow previous-prompt history.~~ shipped in tree 2026-09-06 18:12 (#51 Tab remainder still separate).
   - ~~DeepSeek + Nous in Settings~~ — in working tree (`PrimeProviderStatusSection`);
     Nous env detection + expired-OAuth Chat preflight fixed 2026-09-06 18:02.
   - Anthropic / xAI reconnect: Settings **Reconnect** copies Terminal command;
     Chat now treats Expired as not connected (banner).
   - ~~First-run default vault = cleaned Rhizome Vault scaffold (structure kept).~~
     **Shipped 2026-09-06 18:16:** local scaffold (no Tolaria clone). C11 remote
     URL still deferred for env override / published starter.
4. ~~**C57** — Atticus answers on Limited tools / CLI defaults.~~ **Closed 2026-09-06:** CLI default Limited tools; Prime toggle hidden; keep Limited tools / Power User names.
5. ~~**Session import UI**~~ — **Settings + vault writer shipped 2026-09-06 18:16**
   (Claude Code → `Imports/`). Still open: Prime session-list rows; other
   source adapters; first-run Welcome import step (C9).
6. **C72 side-panel layout session** — right Notes/Graph column discoverability + defaults + whether a right icon rail exists; do not drive-by.
7. **Tonight (Atticus):** review **Grokbot full audits** — rhizome-agent **and** CodexGPT lob. See [1819 handoff](plans/handoffs/2026-09-06-1819-composer-park-grokbot-audits-tonight.md).

**Already shipped (do not re-claim):** #25 provenance · C23 rehydration ·
C67 sessions context menu · C68 note lock · ADR-0170 right-panel stack ·
status chrome (Contribute/Docs → About; idle on composer).

**Daily-drive status (2026-09-06 22:41 — push landed):**
- **North star code on origin:** `f76b46c` (Chat↔Prime hardening + gate fixes +
  #54 sync + Chat-first smoke). See [2241](plans/handoffs/2026-09-06-2241-composer-push-landed.md).
- **Not goal-complete yet:** one native Chat glance on that build; then confetti.
- **Parked (not blocking north star):** C72 side panels; Prime list-import route;
  #51 Tab; C64 native glance; #47; Grokbot audits; C9; packaging/Windows.

**Defer:** full release packaging, first Windows launch verification (#32 /
C42 — still unrun on a real box), TokenJuice/Switchyard build, ratifying
harness grafts, #50 live-app view until Atticus picks a surface. **Do keep
Windows paths in mind for every packaging/tooling fix** (named pipe, 
`rhizome-tool.exe`, `resources/mcp-server`) even while launch is unverified.

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

Still open: ratify option 2; ratify the first slice; name remaining
incompatibilities (especially one write authority for memory). #5 cannot
finish until this is yes enough to build against. Closing #40 against the
filter is not “composition done.” **#56** documents that the tree already has
a second provider path (`ai_models.rs`) — do not cite ADR-0168 as settled
fact when arguing grafts until that contradiction is resolved.

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
| **Harness composition: option 2 + first slice** | #5, #40, #56, and any graft of a foreign harness idea | Filter ratified (ADR-0168). Working notes in `harness-composition.md`. Still discuss/decide: ratify option 2, first slice, remaining incompatibilities. Code already disagrees with doctrine on providers (#56). |
| **Session import destinations** | first-run + Settings import build | **Vault half shipped 2026-09-06** (Settings → Import chat history; Claude Code → `Imports/`). Prime session-list half still blocked on `import_jsonl` semantics (Atticus decision). Plan: [`plans/2026-09-01-session-import-plan.md`](plans/2026-09-01-session-import-plan.md). Relates to #23, C9. |
| **C57 permission naming / defaults** | honest Limited-tools UX | **Settled 2026-09-06 (Atticus).** CLI default Limited tools; Prime toggle stays hidden (always Power User); keep Limited tools / Power User — no Vault Safe. Code already matched. |
| **#50 live app view: which surface** | agent QA of the drawn UI | Answers proposed 2026-08-29, awaiting Atticus. Browser `pnpm dev`, read + test-bridge steer, `pnpm live-ui` not an in-app pane. [plan](plans/2026-08-29-live-app-view-plan.md). |
| **What ⌘1/⌘2/⌘3 and "Full Layout" mean once Chat is the centre** | — | **Settled 2026-08-25.** ⌘1 Chat only, ⌘2 opens the Notes panel with Browse collapsed, ⌘3 opens it with Browse expanded. Stored `viewMode` values unchanged. |
| **Does Wiki Graph replace the canvas or feed a side panel** | #39 | **Settled 2026-09-06 (ADR-0170).** Graph and Mycelium sit under Notes in the right column. They no longer replace Chat. #39 (graph as an agent tool vs a place) is still open for the *agent* interface. |
| **Right panel composition** | — | **ADR-0170 settled the stack** (Notes heavy + Graph/Mycelium below). **C72 (2026-09-06):** Atticus still can’t find/keep the column — needs a layout session on defaults, Inbox label, and right icon rail (still undecided). |
| **C66 agent profile / instructions in Settings** | chat personality UX | **Agreed, not built 2026-09-06.** How the agent should respond, rules, for whichever agent. Not vault `AGENTS.md`, not the model picker, not tool-allowlist profiles. Awaiting: one vs per-agent; app vs vault. |
| **C67 sessions-list context menu** | session row actions | **Shipped 2026-09-06** (`a309a17`). Open / Rename / Archive·Restore / View in Mycelium / Copy path. |
| **C68 restore note lock** | accidental edits while reading | **Shipped 2026-09-06** (`a309a17`). Default editable; breadcrumb + Cmd+K; not vault `editor_mode`. |
| **TokenJuice + Switchyard** | later stacked system; not a Rhizome organ | **Wanted 2026-08-26, not started.** Discuss/plan only. TokenJuice-shaped tool-output shrink first (Prime owns what the model sees). Switchyard-shaped model hop second (sidecar behind Prime; halfway house is `set_scoped_models`). Write-up: [`token-routing-and-compression.md`](design/token-routing-and-compression.md). Do not vendor either in this tree. |

**#40** can close against ADR-0168 (Rhizome is a client of Prime, not a second
harness). Do not treat that close as "the harness question is done."
Ratify `harness-composition.md` before grafting. Resolve **#56** before treating
the doctrine as constitutional for build choices.

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
| #43 | No window-level navigation guard — slip past the link handler strands the app |
| C68 | Restore note lock/view — **shipped 2026-09-06.** Default editable; breadcrumb + Cmd+K |

**Composer and controls** — strip shipped 2026-08-25; closed on GitHub 2026-08-29
| | |
|---|---|
| #38 | Composer pills look like controls but are inert — **closed 2026-08-29** (`1a1bfa9`; context pill `7ed54cb`) |
| #9 | Model and thinking level as one control on the strip — **closed 2026-08-29** (`163403f`; composer `1a1bfa9`) |
| #35 | Verbose modifier reachable from the composer — **closed 2026-08-29** (`1a1bfa9`, one-click thinking toggle) |
| #21 | Argument hints for commands that take arguments — **closed 2026-08-29** (`6037490`) |
| #41 | Typing while Prime is working: steer/queue — **native dogfood confirmed 2026-09-06** (“Waiting in this session” / `MIDTURN_QUEUE_PROBE` on DeepSeek · Rhizome Vault). Code path C43/C44. |
| #51 | Tab to fill in the reply you were going to type — **partial.** Options pills shipped (`replySuggestions` / `ComposerReplySuggestions`); `completion` kind + Tab ghost text **not** wired. Research: vault `projects/rhizome-agent/sub-agents/2026-09-01-tab-completion-ux-research.md` (rules-first v1; model-backed opt-in later). **Related:** ~~C71~~ up-arrow history shipped 2026-09-06. |
| C70 | Per-message timestamps on Chat bubbles — **RESOLVED 2026-09-06** (`3:35p` under ask). |
| C71 | Composer up-arrow previous-prompt history — **RESOLVED 2026-09-06** (in-memory; caret at start / empty). |

**Transcript and sessions**
| | |
|---|---|
| #17 | Branch navigation within a conversation |
| #18 | Transcript markers for actions that change what Prime remembers |
| #31 | Name Prime sessions at creation — **closed 2026-08-26** (create-time name + rename from the list) |
| #49 | Sessions should be named by the model, not by whatever text came first — step 2 shipped in handoff; issue may still be open for remainder |
| #23 | Sessions are searchable knowledge, not opaque logs — also fed by **session import** plan (§1) |
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
| #26 | Update Prime from inside Rhizome |
| #14 | Schedules and heartbeats: see, pause, cancel |
| #13 | Menu bar dropdown shows what is running — see also C34-RESOLVED, #52 |
| #52 | Menu bar should tell you when the agent is done — **partial** (running-session list shipped with #13; “done” signal may remain) |
| #53 | Failure creating the quick-note window silently costs the menu bar icon |
| #54 | ws-bridge restarts in a loop (12× / session observed) |
| #36 | Timezone setting |
| #29 | Redact credentials before chat content is written to the vault — **closed 2026-08-26** (`a8f83de`) |

**Models and providers**
| | |
|---|---|
| #45 | Model settings: connect providers and curate the model dropdown — allow-list step shipped; remainder open |
| #48 | OmniRoute as a managed local gateway |
| #46 | Vault at `$HOME` clobbers Prime global settings / scopes MCP too wide |

**First-run and cleanup**
| | |
|---|---|
| #55 | Build the starter vault instead of cloning someone else's — see also C11 |
| #47 | Pre-public gate: make failure states distinguishable — largely done 2026-08-27; confirm before closing |
| #57 | Delete compatibility code that protects users who do not exist |

**Specs**
| | |
|---|---|
| #5 | Spec: the Prime harness surface — parent of #40; **B** on §1 / `harness-composition.md` |
| #40 | Harness or client — filter answered (ADR-0168); composition still discuss/decide |
| #56 | Rhizome already has the second provider path the doctrine forbids — **B** / doctrine honesty |

#29 was the only open issue with a security consequence. Closed 2026-08-26
(`a8f83de`): tokens-only `redactCredentialTokens`, distill redact-and-continue,
Save-to-vault refuse. Prime session jsonl stays out of scope.

**Origin:** Grok 4.6 · 2026-08-25 — #29 implementation.

---

## 3. Open threads (C-numbers)

14 open. Full text in `HANDOFF.md` § Open threads — this is the shape of the
backlog, not a replacement for it.

- **Blocks other work:** C42 (Windows never launched — #32 sits on top of it)
- ~~**C57** (Limited tools / Vault Safe naming and CLI defaults — Atticus)~~ **RESOLVED 2026-09-06**
- **Resolved but previously misindexed here:** C23. Session replay reads the
  full on-disk Prime log; `get_messages` remains a live, post-compaction view.
  See `HANDOFF.md` C23-RESOLVED and
  [`2026-08-13-prime-session-list-spec.md`](plans/2026-08-13-prime-session-list-spec.md).
- **Test and gate reliability:** C28 (three `@smoke` specs fail under CPU load),
  C31 (unreproducible `pnpm test` unhandled error), C39 (live-daemon tests not
  isolated). C25 is resolved: the create-note flow follows the current Notes
  panel and duplicate type-visibility browser coverage was removed.
- ~~**Correctness / warnings:** C55~~ **RESOLVED 2026-08-29** (`c423445`)
- ~~**Correctness:** C34~~ **RESOLVED 2026-08-29** (`1509f9f`, `be85f80`)
- ~~**Correctness:** C52~~ **RESOLVED 2026-08-30** — see HANDOFF C52-RESOLVED
- ~~**Correctness:** C56~~ **RESOLVED 2026-08-30** — see HANDOFF C56-RESOLVED
- **Correctness:** C40 (`rhizome_graph_summary` answers about a different graph)
- ~~**Health and cleanup:** C46~~ **RESOLVED 2026-08-30** — see HANDOFF
  C46-RESOLVED
- **Health and cleanup:** C21 / C30 (branding residues), C11 (Getting
  Started clones an unrelated upstream repo — blocked on GitHub access; #55)
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

1. **Cross-reference what exists.** Add issue numbers to ADR-0166's open
   questions, and an ADR/design link to each blocked issue. Cheapest fix, kills
   the whole class.
2. **Close the ADR-0166 open questions** into a decision (§1). Three unresolved
   questions in the newest structural ADR are blocking five issues.
3. **Write the memory-loop design doc.** #24 and #25 are the product thesis
   — chat → work → promote → recall — and have the thinnest coverage of any
   theme. `automatic-memory-consolidation.md` covers consolidation, not
   promotion or retrieval-provenance. This is the one genuinely missing
   document, not a cross-reference. **Session import**
   ([plan](plans/2026-09-01-session-import-plan.md)) is the onboarding half of
   the same thesis — keep it linked from that doc when written.
4. **Spec the composer control strip.** #38, #9, #35 and #21 reshaped the
   same strip. Built as one surface 2026-08-25 rather than four redesigns.
   The contract lives on `ChatComposerDeck`. Closed on GitHub 2026-08-29.
   **#51 Tab completion** research is done (rules-first); implement when
   claimed — do not invent a second suggestion system that fights pills.
5. `shell-final-direction.md` §2.1 and §2.3 are marked superseded by ADR-0166.
   The rest still stands. Do not treat the whole document as dead.

Not needed: a new theme doc (`rhizome-default-themes.md` is thorough and
current). The harness *filter* is settled (ADR-0168). Composition working
notes now live in [`harness-composition.md`](design/harness-composition.md);
they are not ratified. Do not treat the doctrine or that file as a license
to start grafting — and read **#56** before treating the filter as law.

---

## 5. If you want a suggested order

Claude's original (`b8dc8fb`) started at **close #40**, then #29, then the
composer cluster. Item 1 below was Grok's later insertion (`2b5daba`).
**Origin:** Cursor · 2026-09-02 — order below matches §0 pre-public focus;
composition stays discuss-only until Atticus wants a graft.

1. **Agent tooling path** — re-seed `rhizome-vault` (vault skill still dated
   2026-08-21 without `RHIZOME_TOOL_PATH` / graph verbs); live Chat ask that
   needs the graph. Then **session import** UI once Atticus green-lights.
2. **Chat reliability** — #41 steer/queue (mostly proven), failure
   leftovers (#47 / #54). ~~C57~~ settled 2026-09-06.
3. **Composer remainder** — #51 Tab ghost text (research done; rules-first).
   ~~Up-arrow Ask-box history~~ shipped as C71 2026-09-06.
4. **First-run** — #55 / C11 starter vault; C9 Welcome + import offer; **C66**
   agent profile once one-vs-per-agent and app-vs-vault are picked.
5. **Harness composition (§1)** — discuss/decide when you want grafts; closing
   **#40** / confronting **#56** is paperwork, not a substitute for product UX.
   TokenJuice/Switchyard and Windows stay later.

Do not treat this order as authoritative over a handoff that names your task.
This is for the moment you have finished that and are choosing for yourself.
