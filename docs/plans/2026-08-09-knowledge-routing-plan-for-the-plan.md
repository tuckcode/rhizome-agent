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

## Sequencing bet

Do 6 first. If a "Reference" bucket absorbs most of the 126, the router
shrinks to a much smaller problem and the design changes shape.

## Related, deliberately out of scope here

- `ArtifactKind` extension is also what `raw/` routing needs — same change,
  do not solve twice.
- The `KeyboardActions` / manifest `Pick<>` drift (two commands have hit it)
  is unrelated but should be fixed before a third.

## Next action

Read this, answer question 6, then write the real design doc.
