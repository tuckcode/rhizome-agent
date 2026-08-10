# Knowledge routing — plan for the plan

Status: **scoping only.** Not a design, not ratified. Written 2026-08-09 at
the end of a long session so the findings survive; the actual design doc
comes next.

## The one-line problem

Notes land. Nothing files them.

## Evidence (measured, not asserted)

Real vault, 2026-08-09:

```
All Notes    147
Inbox        133      (~82 after this session's _organized fix)
UNASSIGNED   126
PROJECTS      12      across 4 projects
```

Three of those four projects (`asyncfuncai-deepwiki-open`,
`notasithlord-peerd`, `rhizome`) are named after clones in
`.rhizome/repo-cache/`. **Projects only get created as a side effect of repo
research.** Nothing else ever creates one.

## What is actually missing

**1. Only four destinations exist.** `rhizome_write_location.rs`:

```
RepoWiki  -> wiki/sources/repos
Document  -> wiki/sources/documents
Entity    -> wiki/entities
Concept   -> wiki/concepts
```

`ArtifactKind` is a closed enum. No memories, no rules, no per-project
destination. Adding one is a Rust enum change plus four match arms, not
config. So "categorisation is broken" is wrong — categorisation was never
built, and notes land correctly in the only places that exist.

**2. `raw/inbox/` has no router.** The inbox watcher handles *captures*.
Nothing reads the drop-zone and decides where a note belongs.

**3. Two different "unfiled" rules, and they disagree.**

| Counter | Rule | Source |
|---|---|---|
| Inbox | `!entry.organized` — frontmatter only | `noteListHelpers.ts:604` |
| UNASSIGNED | no `project:` frontmatter | `projectTreeData.ts` |

`projectTreeData.ts:16` states it outright: **"no writer sets that flag."**
So Inbox counts everything ever written, and UNASSIGNED counts everything
without a project. Neither is populated by any writer.

**4. Portent's eight types are not folders.** Project, Task, Person, Event,
Note, Topic, Operation, Responsibility are `type: Type` definition notes at
vault root that drive sidebar filters. There is no folder per type and never
was. Worth stating because it keeps getting rediscovered as "the folders are
missing."

## Questions the design doc has to answer

1. **What are the destinations?** Extend `ArtifactKind`, or replace the
   closed enum with something vault-defined? A user who creates a folder
   today gets a folder the router cannot target.
2. **Who decides?** Deterministic rules, an LLM pass, or explicit-only? The
   2026-08-02 competitor research found four philosophies; Rhizome already
   spans three of them.
3. **When does it run?** On save, on inbox arrival, on a schedule, or on
   demand.
4. **What happens to the 126?** Backfill or leave as legacy.
5. **Reconcile the two unfiled rules** — or delete one.
6. **Is "no project" a failure state at all?** Reference material genuinely
   has no project. UNASSIGNED may be a missing *bucket*, not a missing
   *assignment* — this is the cheapest possible fix and should be considered
   before building a router.

## Peer research (required before the design doc)

Do not design routing from first principles. Four philosophies of "who
decides a save happens" were already catalogued in
`docs/plans/2026-08-02-competitor-trigger-research.md` (Mem0/OpenMemory,
Letta/MemGPT, ChatGPT memory, Claude Code memory, Obsidian Templater).
**That research covered triggers — when to save. It did not cover routing —
where it goes.** This is the open half.

Specific question for each peer: *given a saved memory, what decides its
destination, and can a user add a new destination without a code change?*

| Tool | Why it is worth reading |
|---|---|
| **Mem0 / OpenMemory** | Explicit memory *categories* with an extraction pass that assigns them. Closest to the ArtifactKind problem. Are categories user-extensible at runtime? |
| **Letta / MemGPT** | Core vs archival memory tiers, agent-managed. Answers "who decides" with: the agent, via tools. Does routing survive compaction? |
| **Zep / Graphiti** | Temporal knowledge graph — routing by *entity resolution* rather than folders. Would sidestep the folder question entirely. |
| **Basic Memory** | Markdown-native, Obsidian-compatible, MCP. Closest file-layout analogue to Rhizome. How does it decide the path? |
| **Cursor / Claude Code memory** | Flat file plus prompt convention, no routing at all. The null hypothesis — evidence that routing may not be worth building. |
| **Obsidian: Dataview, Templater, Auto Note Mover** | Auto Note Mover routes by regex/tag rules; Dataview makes folders irrelevant by querying frontmatter. Two opposite answers, both shipping. |

Also worth a look because they are adjacent and already in the repo's
orbit: **Mindwalk**'s citymap treats a repo as the structure rather than
imposing one, and **Prime's continual harness** stores memories, skills, and
subagent specs without folders at all.

The Dataview angle is the one most likely to change the design: if
frontmatter queries are good enough, **the answer may be fewer folders and
better views**, not a router. Rhizome already has typed frontmatter and a
search index — check whether a saved view over `type:` beats physically
moving files, before committing to move files.

Deliverable: one table — tool, destination model, who decides, user-
extensible without code, and what Rhizome should copy or reject.

## DECIDED 2026-08-10 — Q6 answered by the user

> "I want more folders than just projects. This could be for research,
> files, anything. So yeah, unassigned, whatever we name it — but yes."

**"No project" is not a failure state.** UNASSIGNED is a missing *bucket*,
not a missing assignment. Top-level buckets are wanted for research, files,
and whatever else the user decides — Projects is one bucket among several,
not the only one.

### This settles Q1 as well

If buckets are user-definable, a closed `ArtifactKind` enum in Rust is
**definitively the wrong model** — every new bucket would be a code change
and a release. Destinations must be vault-defined data, not code.

That is a bigger change than the cheap "add a Reference bucket" fix this
doc originally bet on, and it inverts the sequencing: the destination model
comes first, and routing is meaningless until it exists.

### What is now settled vs still open

| | |
|---|---|
| Settled | Multiple top-level buckets, user-definable, Projects is one of them |
| Settled | Destinations are vault data, not a Rust enum |
| Open | Q2 who decides · Q3 when it runs · Q4 the 126 backfill · Q5 the two unfiled rules |

### Revised sequence

1. **Destination model** — how a bucket is declared, where that lives, how
   the sidebar and `rhizome_write_location` both read it. Note the type
   system is already vault-defined data (`type: Type` notes at vault root);
   buckets should probably follow that precedent rather than invent a second
   mechanism.
2. **Backfill** — the 126 get a home once homes exist.
3. **Routing** — only then, and it may turn out to be mostly manual plus a
   good "move to bucket" affordance.

The Dataview question below still stands and now matters more: if a bucket
is really a saved query over frontmatter, buckets cost almost nothing and
nothing has to move on disk.

## Related, deliberately out of scope here

- `ArtifactKind` extension is also what `raw/` routing needs — same change,
  do not solve twice.
- The `KeyboardActions` / manifest `Pick<>` drift (two commands have hit it)
  is unrelated but should be fixed before a third.

## Next action

Q6 is answered. Run the peer research above — focused on the destination
model now, not routing — then write the real design doc. The research is
delegable to a subagent.

First question for that research, given the decision: **do peers store
destinations as data or as code?** Anything with a hardcoded category list
is the anti-pattern to avoid, not a model to copy.
