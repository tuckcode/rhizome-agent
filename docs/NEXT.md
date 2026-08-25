# What to pick up next

**Origin:** Claude Opus 5 (Claude Code `c0cced2f`, `b8dc8fb`). Later sections
tagged in place. This file is a palimpsest — several models have edited it;
`rg` cannot tell whose voice a heading is.

**For an agent that just finished the task its handoff gave it and needs to
choose the next one.** `HANDOFF.md` says what is true right now; this file says
what is *unclaimed*, and in what order it is worth claiming.

It indexes, it does not restate. Every row points at the issue, ADR, or C-number
that owns the detail. If you find yourself copying a paragraph out of one of
those into here, link it instead — the same rule `HANDOFF.md` runs on.

Snapshot: **2026-08-24**, 27 open issues, 16 open C-numbers. Re-derive both
before trusting the counts:

```bash
gh issue list --state open --limit 60 && grep -c "C[0-9]*-OPEN" docs/HANDOFF.md
```

---

## 1. Decide before building

Four of these gate work that is otherwise ready. A session that picks up a
blocked issue without settling its decision first will guess, and the guess
will be re-litigated later.

### Harness composition — decide this first; it dictates how we build

**Origin:** Grok 4.6 · 2026-08-24 · `2b5daba` — not in Claude's original.
RLM is not a row in this file in either version.

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
  OpenCode stays reject-as-backend (weekend NotebookLM still assigned it
  context/routing — that disagreement is part of the decide list).

Still open: ratify option 2; ratify the first slice; name remaining
incompatibilities (especially one write authority for memory). #5 cannot
finish until this is yes enough to build against. Closing #40 against the
filter is not “composition done.”

Layers, per-harness verdicts, and the Prime-update split live in the
composition doc — do not restate them here.

| Decision | Blocks | Where it stands |
|---|---|---|
| **Harness composition: option 2 + first slice** | #5, #40, and any graft of a foreign harness idea | Filter ratified (ADR-0168). Working notes in `harness-composition.md`. Still discuss/decide: ratify option 2, ratify native extension UI as first slice, name remaining incompatibilities. |
| **What ⌘1/⌘2/⌘3 and "Full Layout" mean once Chat is the centre** | #27, and any further shell work | ADR-0166 lists it as open. `viewMode`'s three states are wired through `viewCommands.ts`, the command palette, `PulseView`, and `useMainWindowSizeConstraints` — the ladder has no meaning when a fourth surface (Chat) is permanent |
| **Does Wiki Graph replace the canvas or feed a side panel** | #39, #11, #22 | ADR-0166 open question. It is a full-canvas destination today, same as Chat was |
| **Right panel exclusivity (Inbox / Notes / Changes, never two)** | #27, #34 | Attempted 2026-08-22, reverted in `64b2e89`: making `all` resolve to tree-only broke Cmd+N, inbox auto-advance and note selection, because real flows assume the note list is visible on load. Needs a control the user opts into, not a changed default |

**#40** can close against ADR-0168 (Rhizome is a client of Prime, not a second
harness). Do not treat that close as "the harness question is done."
Ratify `harness-composition.md` before grafting.

Two ideas are in play for the Chat-centre question and neither is decided —
split the centre horizontally (editor on top, Chat as a collapsible bottom
strip), or one shared side panel where clicking a note turns the list into the
editor. Captured with the rest of the shell review in the design artifact linked
from the 2026-08-22 handoff.

---

## 2. Issues by theme

`ready-for-agent` unless noted. **B** = blocked by a §1 decision.

**Shell and layout**
| | |
|---|---|
| #27 | Session list as a dockable sidebar, not a toggled overlay — **B** |
| #34 | No way to search or filter the session list — **B** (shares the panel) |
| #22 | Mycelium: Rhizome's visual language, and two entry points — **B** |
| #11 | Mycelium runs inside Rhizome instead of launching another app — **B** |
| #39 | Make the knowledge graph an agent tool, not a place you visit — **B** |

**Composer and controls** — the densest ready-to-build cluster, no blockers
| | |
|---|---|
| #38 | Composer pills look like controls but are inert |
| #9 | Model and thinking level as one control on the strip |
| #35 | Verbose modifier reachable from the composer |
| #21 | Argument hints for commands that take arguments |

**Transcript and sessions**
| | |
|---|---|
| #17 | Branch navigation within a conversation |
| #18 | Transcript markers for actions that change what Prime remembers |
| #31 | Name Prime sessions at creation |
| #23 | Sessions are searchable knowledge, not opaque logs |
| #42 | Tool cards say "ipython" five times |

**Memory loop** — the product thesis; least covered by design docs
| | |
|---|---|
| #24 | Promote produces a note worth keeping, not a transcript dump |
| #25 | Retrieval shows its work — `needs-triage`, oldest untriaged |
| #37 | "Save as custom" in the research format modal has never done anything |

**Platform and lifecycle**
| | |
|---|---|
| #32 | Prime harness does not run on Windows — see also C42 |
| #26 | Update Prime from inside Rhizome |
| #14 | Schedules and heartbeats: see, pause, cancel |
| #13 | Menu bar dropdown shows what is running — see also C34 |
| #36 | Timezone setting |
| #29 | Redact credentials before chat content is written to the vault |

**Specs**
| | |
|---|---|
| #5 | Spec: the Prime harness surface — parent of #40; **B** on §1 / `harness-composition.md` |
| #40 | Harness or client — filter answered (ADR-0168); composition still discuss/decide |

#29 is the only open issue with a security consequence: chat content is written
to the vault and pushed to a remote. Worth pulling forward past its position
here.

---

## 3. Open threads (C-numbers)

16 open. Full text in `HANDOFF.md` § Open threads — this is the shape of the
backlog, not a replacement for it.

- **Blocks other work:** C23 (`get_messages` returns no assistant messages —
  rehydration shape undecided, and #23/#17 need it), C42 (Windows never
  launched — #32 sits on top of it)
- **Test and gate reliability:** C28 (three `@smoke` specs fail under CPU load),
  C31 (unreproducible `pnpm test` unhandled error), C39 (live-daemon tests not
  isolated), C25 (two stale regression specs)
- **Correctness:** C40 (`rhizome_graph_summary` answers about a different
  graph), C34 (menu-bar roster activity labels, half done)
- **Health and cleanup:** C46 (`AiPanel.tsx` CCN 50 / 447 lines — grew during
  the C43 fix), C24 (three dead exports in `primeSessionToMindwalk.ts`), C21 /
  C30 (branding residues), C11 (Getting Started clones an unrelated upstream
  repo — blocked on GitHub access)
- **Product decisions pending:** C9 (optional first-run Welcome), C10 (spotlight
  onboarding, spec written and unbuilt), C7 (native QA gate for shell waves)

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
3. **Write the memory-loop design doc.** #24, #25 and #37 are the product thesis
   — chat → work → promote → recall — and have the thinnest coverage of any
   theme. `automatic-memory-consolidation.md` covers consolidation, not
   promotion or retrieval-provenance. This is the one genuinely missing
   document, not a cross-reference.
4. **Spec the composer control strip.** #38, #9, #35 and #21 all reshape the
   same strip and will be built by different sessions. Four independent
   redesigns of one component is the predictable outcome. One short spec, not a
   full design doc.
5. `shell-final-direction.md` §2.1 and §2.3 are marked superseded by ADR-0166.
   The rest still stands. Do not treat the whole document as dead.

Not needed: a new theme doc (`rhizome-default-themes.md` is thorough and
current). The harness *filter* is settled (ADR-0168). Composition working
notes now live in [`harness-composition.md`](design/harness-composition.md);
they are not ratified. Do not treat the doctrine or that file as a license
to start grafting.

---

## 5. If you want a suggested order

Claude's original (`b8dc8fb`) started at **close #40**, then #29, then the
composer cluster. Item 1 below is Grok's later insertion (`2b5daba`).

1. **Harness composition (§1)** — discuss/decide
   [`harness-composition.md`](design/harness-composition.md) (option 2,
   DeepSeek *idea* on Prime extensions, first slice = native extension UI).
   Until ratified, do not graft. Closing **#40** against the filter is a
   side-errand, not a substitute.
2. **#29, credential redaction** — only open issue with a security consequence.
3. **The composer cluster (#38, #9, #35, #21)** — unblocked, one surface, and
   §4.4's spec pays for itself immediately.
4. **Settle §1's shell decisions**, then #27 / #34 / #39 / #11 / #22 unblock
   together.
5. **C28 and C31** whenever the push gate flakes on you — the natural reaction
   (re-run and move on) is exactly how they stay unfixed.

Do not treat this order as authoritative over a handoff that names your task.
This is for the moment you have finished that and are choosing for yourself.
