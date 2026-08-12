# Where notes go — design

Status: **draft for review.** Supersedes the scoping in
`2026-08-09-knowledge-routing-plan-for-the-plan.md`. Evidence in
`2026-08-10-destination-model-peer-research.md`.

Written in plain terms on purpose. Earlier drafts said "buckets" and
"destination model"; those were invented words that made the design harder to
read than the design actually is.

## The problem in one paragraph

Notes get saved. Nothing decides where. Today Rhizome can save a note to
exactly four places, and that list is compiled into the app — adding a fifth
means editing Rust and shipping a release. Meanwhile the sidebar only groups
notes by a `project:` field, so a note sitting in a perfectly good folder still
shows as unfiled. On the author's own vault that is 126 notes out of 147.

## What we are building

**Top-level folders are how notes are organised.** Make a folder, it shows in
the sidebar, notes can live in it. That is the whole idea.

Two things follow:

1. The app stops carrying a fixed list of four places.
2. The sidebar shows the folders that exist, instead of only `project:`.

## Decisions already made

| Decision | Why |
|---|---|
| Folders, not a hidden field | Agents reach the vault by path — Prime's skill, `rhizome-tool`, MCP `create_note`, wikilinks. A folder is legible to all of them for free. A field is invisible until each one learns to query it. |
| One note lives in one folder | Simple, and matches every file system a user already knows. Cross-cutting needs become saved views. |
| Saved views handle everything else | "Everything about rhizome regardless of folder", "everything from last week". `views/*.yml` already exists. |

## Default shape, and what happens to everyone else

**Default: a Rhizome-shaped vault.** New vaults get the folders Rhizome
creates. That is confirmed and stays.

The open case is someone opening a vault Rhizome did not create — an import, or
just a folder of markdown. Their folders will not match anything we expect.

Proposal: **show what is there, let them hide the rest.**

- The app hides only what it owns: `.rhizome/`, `.git/`, `views/`, `raw/`
- Every other top-level folder shows in the sidebar
- The user can hide any of them; hiding is saved per vault, not compiled in

Rejected alternative: a built-in ignore list (`attachments/`, `templates/`,
`_archive/`, …). It cannot be complete. Somebody's vault always has a folder we
did not think of, and they would have no way to remove it.

Open question for review: on a 40-folder import, is "show all 40 and let them
hide" the right first impression, or should first-open ask? Leaning show-all —
a first-run prompt about folders is a bad first minute, and hiding is one
click.

## Optional: a folder can describe itself

If a folder contains `index.md`, that note can supply the display name, icon,
colour, and sort order.

Nothing is required. Make a folder and it works. The index note is for when you
want it to look like something.

This is not a new mechanism — `projects/rhizome/index.md`,
`projects/g2g/index.md`, and `projects/sight/index.md` already exist in the
author's vault, and the type system already stores icon and colour this way.

## Must ship together, not after

**Saved views cannot filter by folder today.** `resolve_condition_field`
(`src-tauri/src/vault/views.rs:345`) understands `type`, `status`, `title`,
`body`, then falls through to frontmatter — there is no `folder` or `path`.

That matters because "one note, one folder" is only a fair trade if views can
cut across folders. Ship folders first and the user loses something and gains
nothing until the filter lands.

`VaultEntry.path` already exists (`src-tauri/src/vault/entry.rs:10`), so this
is a small addition, not a project. Both comparable tools have it (Obsidian
Bases `file.inFolder()`, Dataview `FROM "folder"`).

## Must measure before committing

**Moving a note rewrites every link that points at it, and that scan reads the
whole vault.** So moving N notes costs roughly N × vault size.

On 147 notes that is invisible. On an imported 10,000-note vault it may be
unusable — and this design makes moving notes a normal, frequent action rather
than a rare one.

Nobody has measured it. Do that at 1,000 and 10,000 notes before building the
move UI. If it is bad, the options are batching the rewrite or reconsidering
how a note is identified — but do not reconsider identity on a guess.

Keeping identity as the file path is otherwise right: it is visible in the file
itself, which is the same reason folders beat a hidden field.

## Not yet decided

1. **An agent saves to a folder that does not exist.** Prime, `rhizome-tool`,
   and MCP all take a path. If Prime writes `research/foo.md` and `research/`
   is not there — create it silently, error, or drop it in the inbox? This will
   happen on day one and is not answered.
2. **Nested folders.** Is `projects/rhizome/` its own place in the sidebar, or
   part of `projects/`? Author's vault already nests.
3. **The two "unfiled" counts.** Inbox counts notes without a flag no writer
   sets; Unassigned counts notes without `project:`. Both need to become "not
   in a folder yet", or one needs deleting.
4. **`raw/inbox/`.** Still the drop zone. Does anything move notes out of it
   automatically, or is it manual with a good "move to folder" action? Cheaper
   to start manual and see whether automation is missed.

## Build order

1. **Folder filter for saved views** — small, and makes the trade honest
2. **Measure move cost** at 1k and 10k notes — gates the identity question
3. **Sidebar shows top-level folders**, with hide-per-vault
4. **First-open behaviour** for a vault Rhizome did not create
5. **Saving resolves a folder** instead of the built-in list of four
6. **Move to folder** where people expect it — right-click a note, and a real
   menu entry. It exists today only in the command palette.

1 and 2 are independent and can go in either order. Nothing after 3 is
blocked by anything except 3.

## Review notes

- Terminology deliberately plain. If a word here needs a glossary it is the
  wrong word.
- "Folder" always means a top-level folder in the vault unless stated.
- This doc does not cover automatic filing. That was the original framing and
  the evidence says it is the smaller problem — most notes already land
  somewhere sensible; the sidebar just was not looking.
