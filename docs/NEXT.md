# What to pick up next

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

Three of these gate work that is otherwise ready. A session that picks up a
blocked issue without settling its decision first will guess, and the guess
will be re-litigated later.

| Decision | Blocks | Where it stands |
|---|---|---|
| **What ⌘1/⌘2/⌘3 and "Full Layout" mean once Chat is the centre** | #27, and any further shell work | ADR-0166 lists it as open. `viewMode`'s three states are wired through `viewCommands.ts`, the command palette, `PulseView`, and `useMainWindowSizeConstraints` — the ladder has no meaning when a fourth surface (Chat) is permanent |
| **Does Wiki Graph replace the canvas or feed a side panel** | #39, #11, #22 | ADR-0166 open question. It is a full-canvas destination today, same as Chat was |
| **Right panel exclusivity (Inbox / Notes / Changes, never two)** | #27, #34 | Attempted 2026-08-22, reverted in `64b2e89`: making `all` resolve to tree-only broke Cmd+N, inbox auto-advance and note selection, because real flows assume the note list is visible on load. Needs a control the user opts into, not a changed default |

**#40 ("is Rhizome a harness, or a client of harnesses?") looks answered.**
ADR-0168 ratified *"Rhizome absorbs metabolites, not organs"* — take contracts
and artifacts, reject second runtimes. That is the answer #40 asked for. The
issue is still `needs-info` and still open. Someone should either close it
citing ADR-0168, or say what it still asks that the ADR does not settle.

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
| #5 | Spec: the Prime harness surface — parent of #40 |
| #40 | Harness or client — see §1 |

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
current), and nothing for the harness question (ADR-0168 just settled it).

---

## 5. If you want a suggested order

1. **Close #40 against ADR-0168** — minutes, removes an open question that is
   already answered.
2. **#29, credential redaction** — only open issue with a security consequence.
3. **The composer cluster (#38, #9, #35, #21)** — unblocked, one surface, and
   §4.4's spec pays for itself immediately.
4. **Settle §1's shell decisions**, then #27 / #34 / #39 / #11 / #22 unblock
   together.
5. **C28 and C31** whenever the push gate flakes on you — the natural reaction
   (re-run and move on) is exactly how they stay unfixed.

Do not treat this order as authoritative over a handoff that names your task.
This is for the moment you have finished that and are choosing for yourself.
