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
| **Basic Memory** | Markdown-native, MCP-served. Closest file-layout analogue to Rhizome. How does it decide the path? |
| **Cursor / Claude Code memory** | Flat file plus prompt convention, no routing at all. The null hypothesis — evidence that routing may not be worth building. |
| **Dataview / Auto Note Mover** (Obsidian plugins) | Read for the *pattern*, not the platform — Rhizome has no Obsidian dependency and the user does not use it. Auto Note Mover routes by regex/tag rules; Dataview makes folders irrelevant by querying frontmatter. Two opposite answers to the same question, both shipping at scale. |

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

## DECIDED 2026-08-10 — buckets are folders, views are queries

Agreed after Q6. **Top-level folders are the destination model. Frontmatter
queries are a view layer on top, not the primary assignment.**

### Why folders, not frontmatter-only

**Not** "so it opens nicely in Obsidian." Rhizome incorporated Tolaria
precisely so there is no third-party editor dependency, and the user does
not use Obsidian. An earlier draft of this section argued from editor
portability; that reasoning was wrong and is corrected here.

The real reason is **agents read the filesystem.**

Every agent path into this vault is path-based: Prime's `rhizome-vault`
skill, `rhizome-tool <verb> <vault_path>`, MCP `create_note(notePath)`,
`search_notes` returning paths, and the wikilinks agents write. Folders are
already the API surface agents navigate. A bucket that exists only in
frontmatter is invisible to every one of them unless each separately learns
to query it — whereas a folder is legible to all of them for free, today,
with no new contract.

Secondary, still real: git history and diffs are structural, and the user
browses files in Finder.

Folders are also already vault-defined data. That satisfies the "not a Rust
enum" requirement with the cheapest mechanism available — the filesystem.
No schema, no registry, no new concept to maintain.

### The finding that shrinks the work

The vault already has the structure: `agents/`, `projects/`, `resources/`,
`concepts/`, `entities/`, `sources/`, `meta/`, `skills/`, `queries/`.

**The 126 "unassigned" notes are mostly already in folders.** The project
tree groups by `project:` frontmatter and ignores the folder tree entirely
— even though FOLDERS is a separate sidebar section rendering the same
vault. This is not 126 homeless notes; it is a sidebar that does not look
where the notes live.

| Assumed | Actually |
|---|---|
| Design a destination model | Top-level folders are the model |
| Build a router | Mostly unnecessary — writes already land in folders |
| Backfill 126 notes | Mostly unnecessary — render what is on disk |

### Accepted trade-off

**One note, one folder.** No multi-bucket membership. Cross-cutting needs
(everything touching `rhizome`, everything from last week, everything
untyped) are saved views over frontmatter — that is what `queries/` and the
sidebar's Create view already exist for. Many views, one home.

### Reframe for the design doc

Not "build a routing system". Instead:

1. **Make the sidebar render the folders that already exist** as buckets,
   rather than grouping solely by `project:` frontmatter.
2. **Make `rhizome_write_location` resolve a folder** instead of a closed
   `ArtifactKind` enum.
3. Routing, if still needed after 1 and 2, is a much smaller problem — and
   may reduce to a good "move to folder" affordance.

### Must confirm before committing

Moving a note between folders must not break wikilinks.
`.rhizome/move-manifests/` exists, so the machinery is at least partly
there — verify coverage before designing on top of it.

## Related, deliberately out of scope here

- `ArtifactKind` extension is also what `raw/` routing needs — same change,
  do not solve twice.
- The `KeyboardActions` / manifest `Pick<>` drift (two commands have hit it)
  is unrelated but should be fixed before a third.

## Next action

Q6 and the destination model are both answered. Two things left before the
design doc:

1. **Verify the wikilink-safety claim** — does `.rhizome/move-manifests/`
   actually cover folder moves? Cheap, and the reframe depends on it.
2. **Peer research**, now narrowed: given the folders-as-buckets decision,
   the useful question is **how peers keep a physical layout legible to
   agents while still offering cross-cutting views**. Basic Memory is the
   closest analogue (markdown + MCP, no editor dependency). Dataview and
   Auto Note Mover are worth reading for the folders-vs-queries pattern
   only — not as a platform to integrate with. The memory-tier tools
   (Letta, Mem0, Zep) are least relevant: they have no user-owned file
   layout to preserve, which is the whole constraint here.

Delegable to a subagent. Skip anything that only answers the routing
question — that is no longer the bottleneck.
