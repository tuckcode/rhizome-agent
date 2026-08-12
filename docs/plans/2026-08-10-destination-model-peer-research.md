# Destination-model peer research — 2026-08-10

Completes the peer-research item left open by
`2026-08-09-knowledge-routing-plan-for-the-plan.md`. That doc settled the
decisions; this one does not re-litigate them.

**Question answered here:** given that buckets are top-level folders and views
are queries, *how do peer tools keep a physical, user-owned file layout legible
to agents while still offering cross-cutting views?*

**Not answered here:** when to save. That was
`2026-08-02-competitor-trigger-research.md` and is not repeated.

Everything below was fetched 2026-08-12. Primary sources (repo source,
official docs) preferred; anything inferred rather than read is marked.

---

## The table

| Tool | Destination model | Who decides | User-extensible without code? | Agent-legible on disk? | Copy or reject for Rhizome |
|---|---|---|---|---|---|
| **Basic Memory** | `directory` is a required parameter on every write: an arbitrary relative path under the project root. `file_path = directory + "/" + filename`; `permalink = generate_permalink(file_path)` stored in frontmatter. | The calling model, per write. No default, no fallback — the tool will not write without one. | **Yes, totally.** The only validation is path-traversal containment (`validate_project_path`). No enum, no registry, no allowlist. Any string is a folder. | **Yes.** Real markdown in real directories; SQLite is a derived index rebuilt by sync, not the source of truth. | **Copy** the shape: folder is a validated string, not an enumerated kind. Copy the placement/type split. |
| **Prime Agent** (`~/.prime/agent/`) | Three separate features — `skills/`, `prompts/`, `agents/` — all use one pattern: a folder is a namespace, a file (or a dir with `SKILL.md`) is a member, filename is the identifier, frontmatter is the metadata. Precedence-ordered search path: global → project → package → settings → CLI → built-in. | Whoever drops a file in the folder. Resolution on name collision is by precedence, not config. | **Yes.** Adding a skill/prompt/subagent = `mkdir` + write a markdown file. Nothing registers it. | **Yes**, and deliberately: only `name` + `description` enter the system prompt; the body loads on demand. | **Copy** the whole pattern for bucket declaration. It is the closest working precedent to what Rhizome needs. |
| **Agent Skills spec / AGENTS.md** | Same pattern, standardised. `name` "must match the parent directory name." AGENTS.md: "Agents automatically read the nearest file in the directory tree, so the closest one takes precedence." | Directory position. Location *is* the scope. | Yes — it is just files. | Yes. | **Copy** the naming rule (folder name is the identity, declaration file only carries description/metadata) and the progressive-disclosure budget. |
| **Obsidian Bases** (core plugin) | Query is a **first-class file on disk**: `.base`, plain YAML, top-level `filters` / `formulas` / `properties` / `views`. Data stays in markdown: "All the data in Obsidian Bases is stored in your local Markdown files and their properties." Folder-aware filters: `file.inFolder("Required Reading")`, `file.folder`, `file.path`. | The user writes the `.base`; the app evaluates it. | Yes — "a simple YAML text file editable in any text editor." | **Yes.** The view definition is a readable file; a non-Obsidian tool can parse it. | **Already converged** — Rhizome's `views/*.yml` is the same design. Copy the one missing piece: **folder-aware filter fields**. |
| **Dataview** (Obsidian plugin) | No destination model at all — it abolishes the question. Folders become irrelevant; `FROM` queries frontmatter, tags, and inline `key:: value` fields. Results render live inside a ```dataview fence. | Nobody. There is no write path. | Yes at the query level. | **No.** Results are rendered at read time and never exist on disk — an agent reading the `.md` sees the query text, not the answer *(inference from "results are rendered directly within your notes as live views", not a quoted claim)*. `key:: value` is also a non-standard dialect a reader must learn. | **Reject as primary.** Obsidian itself moved this to Bases, i.e. to a file. That migration is the finding. |
| **Auto Note Mover** (Obsidian plugin) | Ordered rule list. Each rule = destination folder + one matcher (tag with `#`, or a JS regex on the title). "The notes will be moved to the folder with the first matching rule." Fires on create, edit of the active note, rename, or manual command. Opt-out via `AutoNoteMover: disable` in frontmatter. Aborts if the folder is missing or the name collides. | A deterministic rule table the user maintains. | Yes — rules are settings, not code. | Yes (it moves real files), but the *rules* live in plugin settings, invisible to any agent. | **Reject the engine, keep two details:** per-note frontmatter opt-out, and abort-on-collision. |
| **Dendron** | Flat vault, hierarchy encoded in dot-delimited filenames (`proj.rhizome.design.md`). "Folders are meant to be an implementation detail for Dendron… You can think of Dendron as a flat-file based database and lookup and the tree view as the UI to said database." | The user, via the note name. | Yes. | Partially — real files, but the tree is a decoded filename convention, not something `ls` or a glob reveals. | **Reject**, but see the challenge section: this is real, shipped disagreement with folders-as-buckets. |
| **Logseq** | Flat `pages/`; namespaces (`root/branch/leaf`) encoded into the filename because `/` is filesystem-reserved. | The user, via the page name. | Yes. | Partially, same caveat as Dendron — and its own users have an open feature request for real subdirectories, motivated by CLI-tool friendliness. | **Reject**, and note the request: the flat camp's users are asking for folders for exactly Rhizome's reason. |
| **Mem0 / OpenMemory** | Categories, not paths. Custom categories are set per project via `client.project.update(custom_categories=…)`; the extraction pass assigns them. | An LLM extraction pass, against a category list. | **Yes, at runtime, via API** — the one thing here that is genuinely `ArtifactKind`-shaped and solved as data. | No — no user-owned file layout at all. | **Reject the storage model.** Note only that custom categories *replace* the defaults, and label overload is a live complaint — the same trap as extending `ArtifactKind`. |
| **Letta / MemGPT** | Memory tiers in a database. But **Letta Filesystem** "represents documents as folders and files (containing parsed contents) to the agent," with `open`, `grep`, and `semantic_search`. Files are uploaded and parsed into Letta, not user-owned on disk. | The agent, via tool calls. | Folders can be created at runtime; the layout is not the user's filesystem. | No — it is a virtual filesystem over a database. | **Reject the storage, take the corroboration**: a tool that owned its storage and could have chosen any abstraction chose to *show the agent folders and files*. That is evidence for the decision, from the opposite direction. |
| **Zep / Graphiti** | Temporal knowledge graph; destination is entity resolution, not a location. | The extraction pipeline. | n/a | No file layout. | **Reject.** Nothing to transfer — the whole constraint here is a user-owned layout it does not have. |

---

## What to copy

### 1. Split placement from type — Basic Memory already did this cleanly

`write_note` takes `directory` (where the file goes) and `note_type` (what
goes in the `type:` frontmatter field) as **two independent parameters**.
Metadata is a third (`metadata`, merged into the YAML header).

`src-tauri/src/rhizome_write_location.rs` fuses five facets onto one closed
enum — `dir()`, `item_type()`, `tag()`, `frontmatter_type()`, `flat_dir()`
(lines 24–71). That fusion is why adding a destination is a Rust change: you
cannot add a folder without also inventing a Library-panel type, a tag, and a
frontmatter type.

**Copy:** folder becomes a string resolved at the call site. `type:` stays in
frontmatter, where Rhizome already keeps it as vault-defined data (`type: Type`
notes). `ArtifactKind` survives only as a *default table* for the four existing
Rust writers — "a repo wiki defaults to `wiki/sources/repos`" — not as the
universe of destinations.

### 2. Validate the folder, do not enumerate it

Basic Memory's `write_note` does exactly one check on `directory`:
path-traversal containment via `validate_project_path`, returning
`"Directory path '…' is not allowed - paths must stay within project
boundaries"`. There is no allowlist and no registry. `"/"` is normalised to
the project root.

**Copy verbatim in spirit:** a `resolve_write_folder(vault, folder) ->
Result<PathBuf>` that enforces containment and nothing else. Every new bucket
is then free by construction.

### 3. Add a folder field to view filters — this is the verified gap

`src-tauri/src/vault/views.rs:344`, `resolve_condition_field`, handles
`type`/`isA`, `status`, `title`, `body` (plus `archived`/`favorite` in
`evaluate_condition_bool_field`), then falls through to frontmatter properties
and relationships. **There is no `folder` or `path` field.** A Rhizome view
cannot currently express "everything in `resources/`".

Both shipping query layers have this: Bases has `file.inFolder()`,
`file.folder`, `file.path`; Dataview has `FROM "folder"`.

The folders-as-buckets decision rests on "many views, one home." Views cannot
reference the home. `VaultEntry.path: String` already exists
(`src-tauri/src/vault/entry.rs:17`), and `contains` / `equals` / regex ops are
already implemented — this is a two-arm addition to a match, and it is the
single highest-leverage item in this document.

### 4. Rhizome already has Bases' architecture — do not build a second one

`views/*.yml` at vault root, scanned by `scan_views`
(`src-tauri/src/vault/views.rs:193`), written by `save_view`, migrated out of
`.laputa/views` by `view_migration.rs`. YAML on disk, `all`/`any` filter groups,
per-view icon/color/order. That is structurally the same answer Obsidian
arrived at with `.base` after years of Dataview.

Two corrections to the plan-for-the-plan while this is in view:

- It calls the folder `queries/`. It is **`views/`**.
- It says Prime's harness "stores memories, skills, and subagent specs without
  folders at all." Both halves are wrong. Prime has **no memory store** —
  persistence is session JSONL transcripts, per-session artifact directories,
  goals, and schedules — and skills, prompts, and subagent specs are **all**
  folder-based with a documented precedence chain. `~/.prime/agent/` on this
  machine contains `sessions/`, `session-artifacts/`, `extensions/`,
  `settings.json`, `auth.json`, `logs/`; no `memories/`, no `skills/` (none
  installed here).

### 5. A bucket is a folder plus a declaration note — Prime's pattern, Rhizome's existing mechanism

Prime, the Agent Skills spec, and AGENTS.md all converge on: **discover by
scanning, identify by directory name, describe in frontmatter, load the body
on demand.** The spec is explicit that `name` "must match the parent directory
name," and that only `name` + `description` (~100 tokens) sit in context at
startup.

Rhizome has this mechanism already. `VaultEntry` carries `icon`, `color`,
`order`, `sidebar_label`, `template`, `sort`, `view` — all documented as "for
Type entries" (`entry.rs:39–56`). A `type: Bucket` declaration note inside each
top-level folder reuses every one of those fields and invents nothing. The
plan-for-the-plan already guessed this ("buckets should probably follow that
precedent"); three independent peers confirm it is the right guess.

**Do not build a registry file listing the buckets.** Prime, Skills, and Bases
all scan. A manifest is a second source of truth that will drift from the
filesystem, which is the exact failure mode already logged in this repo as two
disagreeing "unfiled" rules.

### 6. Normalise on scan, not only on write

Basic Memory's `ensure_frontmatter_on_sync` defaults to `true`: "Add
frontmatter to files during sync if they don't already have it." A file a human
drops into a folder by hand becomes a first-class note without going through
the blessed write path.

This is the direct answer to the plan-for-the-plan's finding 3 — two unfiled
counters, neither populated because "no writer sets that flag." If placement is
a folder and normalisation happens on scan, no writer *needs* to set a flag.
The 2026-08-02 research's Templater caveat ("the trigger only fires if the file
was created through the blessed path") is the same bug; scan-time
normalisation is the fix that removes the blessed path from the equation.

### 7. Move-then-update, and do not move for every state change

Basic Memory's `memory-lifecycle` skill — folder-based status workflows,
`active/` → `archive/` — gives two rules worth stealing whole:

- "**Move first, then update frontmatter.** This order ensures the file is in
  the right place even if the edit step fails."
- "Some status changes don't require a folder move — 'paused' or 'blocked'
  items often stay in `active/` with just a frontmatter update. **Reserve folder
  moves for terminal or major state transitions.**"

And a scale limit from `memory-defrag`: "**Don't over-organize.** One level of
directories is usually enough… `memory/work/projects/active/basic-memory/notes/`
is not." Also "Target 15-25 focused files" per memory area.

`move_note_to_folder` (`src-tauri/src/vault/rename.rs:439`) was already verified
wikilink-safe. The remaining work is the affordance and the policy, not the
plumbing.

### 8. Notice what identity costs

Basic Memory decouples identity from path: the permalink is generated from the
path *once*, written into frontmatter, and `update_permalinks_on_move` defaults
to **`false`** — so a move rewrites zero other files, and `[[wiki-links]]` and
`memory://` URLs keep resolving.

Rhizome does the opposite: path is identity, and a move rewrites every linking
file via `update_wikilinks_in_vault`, reporting `failed_updates` for partial
failures. That is correct and verified safe, but it is O(links) per move where
Basic Memory is O(1). If buckets make reorganisation routine, this is the cost
centre. Not a recommendation to change it — a flag that the choice has a price
that only shows up once moving becomes normal.

---

## What to reject and why

**Auto Note Mover's ordered rule engine.** "First matching rule wins" over a
list of tag/regex → folder rules is a *second* destination model living beside
the folder tree, in plugin settings, invisible to every agent. This repo already
has the bug that shape produces: two "unfiled" counters with different rules,
neither reconciled. Adding an ordered rule table before the folder model even
ships would guarantee a third. Its trigger set (create, edit, rename) also means
notes relocate under the user mid-edit. Keep only two details: the frontmatter
opt-out (`AutoNoteMover: disable`) and abort-on-name-collision.

**Dataview as the primary assignment layer.** The results of a query never
exist on disk. Every agent path into this vault reads files —
`rhizome-tool <verb> <vault_path>`, MCP `create_note(notePath)`, `search_notes`
returning paths, Prime's `rhizome-vault` skill — and all of them would see a
code fence where the answer should be. Obsidian's own response to a decade of
Dataview was to make the query a file (`.base`). That is the finding: the
industry's most-used frontmatter-query system was superseded by one whose
distinguishing feature is *being on disk*.

**Mem0-style LLM auto-categorisation as the primary assignment.** Setting
custom categories at project level *overrides* the defaults, and users report
label overload — which is the `ArtifactKind` problem wearing a runtime-config
costume. A closed set the model must map onto is still a closed set. Reasonable
as a *suggestion* layer later; wrong as the destination model.

**A bucket manifest / registry.** See §5. Scan.

**Deep hierarchies.** Basic Memory's own guidance is one level. Rhizome's
existing tree already violates this in one place (`wiki/sources/repos`), which
is fine as a default but should not become the pattern for user buckets.

---

## Evidence against folders-as-buckets

Two real, shipped, deliberate disagreements — presented straight, not softened:

**Dendron** rejects folders outright and says so: *"Folders are meant to be an
implementation detail for Dendron. The underlying primitive of a note is an
object that has metadata, content, and links. You can think of Dendron as a
flat-file based database and lookup and the tree view as the UI to said
database."* Hierarchy lives in dot-delimited filenames. A file can also be a
"folder" — `proj.md` and `proj.design.md` coexist, which a real directory
cannot do without a `proj/index.md` convention.

**Logseq** does the same with a flat `pages/` directory, encoding `a/b/c` into
the filename because `/` is filesystem-reserved.

**Basic Memory — the closest analogue — explicitly demotes folders**:
*"Organize your files however you want — the knowledge graph is built from the
content of your notes, not from where they sit on disk."* Its AGENTS.md treats
folders as convenience groupings, and its structure comes from observations
(`- [category] …`) and typed relations (`- implements [[X]]`).

**Why the decision still stands.** Three things cut the other way, and they are
stronger:

1. Dendron and Logseq do not abolish structure — they move it from the
   directory into the filename. For a *human* in a tree view that is neutral.
   For an agent it is strictly worse: `ls`, glob, and `find` understand
   directories natively and understand `root.branch.leaf.md` not at all. Logseq
   users have an open feature request for real subdirectories, and the stated
   motivation is CLI-tool friendliness — the flat camp asking for folders for
   precisely Rhizome's reason.
2. Letta owned its storage completely and could have exposed any abstraction to
   its agents. It chose to present documents *as folders and files*, with
   `open` and `grep`. When a database-backed system invents a filesystem for the
   agent's benefit, "keep the real filesystem" is not a compromise.
3. Basic Memory demotes folders for the *graph* while still making `directory`
   a **required** parameter on every single write, and ships a folder-based
   lifecycle skill. What it actually demonstrates is not "folders don't matter"
   but **"folders carry placement, the graph carries meaning"** — which is the
   folders-plus-views decision, stated from the other end.

**The one caveat that survives.** The pressure is not on folders-vs-names; it
is on **one note, one folder**. Basic Memory reaches the same conclusion by a
different route — it accepts one physical home and puts *all* cross-cutting
capability in content (observations, tags, typed relations, `memory://`
wildcards, `build_context` traversal). Rhizome currently has less of that
cross-cutting layer than Basic Memory does, and the folder filter gap (§3) means
it presently has less than it thinks. The trade-off is only acceptable if the
view layer actually lands.

---

## Open questions the design doc still has to answer

1. **Folder filter semantics.** Field name (`folder`? `path`?), exact vs.
   recursive match, and whether `contains` on a path string is good enough or a
   dedicated `in_folder` op is needed. Bases ships both `file.inFolder()` and a
   raw `file.folder` property.
2. **What makes a folder a bucket.** Is every top-level directory a bucket, or
   only one containing a declaration note? What excludes `views/`, `meta/`,
   `.rhizome/`, `agents/`? Prime answers this with "a directory containing
   `SKILL.md`"; Bases with "a `.base` file exists." Rhizome has `ignored.rs`
   but no positive rule.
3. **Identity.** Keep path-as-identity plus link rewriting, or add a stable
   frontmatter id the way Basic Memory does (`permalink`,
   `update_permalinks_on_move: false`)? This decides whether reorganisation is
   O(1) or O(links).
4. **Where `ArtifactKind`'s other four facets go.** `item_type()` feeds the
   Library panel, `tag()` its badge, `frontmatter_type()` the `type:` field,
   `flat_dir()` legacy vaults. Replacing the enum with a folder string strands
   all four. Basic Memory's answer: `note_type` is an independent parameter and
   the Library equivalent derives from it, not from placement.
5. **Default folder on write.** Basic Memory makes `directory` required with no
   default, forcing the caller to decide. MCP `create_note(notePath)` already
   requires a path; the four Rust writers do not. Does an agent that omits a
   folder get an error, an inbox, or a guess?
6. **How agents learn the bucket list.** Progressive disclosure says: names and
   one-line descriptions only, loaded up front; contents on demand. Does that
   live in `get_vault_context`, in the `rhizome-vault` skill, or both — and who
   keeps it in sync with the folder tree?
7. **Is `views/` reachable and authorable from the UI**, and can the Create-view
   UI express a folder filter once one exists? The same question the
   plan-for-the-plan left open for `move_note_to_folder` — the Rust function
   existing does not mean a button does.
8. **Nesting policy.** One level, per Basic Memory's own guidance? Rhizome
   already ships `wiki/sources/repos` at three.

---

## Sources

Basic Memory
- <https://github.com/basicmachines-co/basic-memory>
- <https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/src/basic_memory/mcp/tools/write_note.py> (signature, directory validation, docstring)
- <https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/src/basic_memory/schemas/base.py> (`file_path` / `permalink` derivation)
- <https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/AGENTS.md>
- <https://docs.basicmemory.com/reference/mcp-tools-reference>
- <https://docs.basicmemory.com/concepts/knowledge-format>
- <https://docs.basicmemory.com/reference/configuration>
- <https://github.com/basicmachines-co/basic-memory-skills> — `memory-lifecycle/SKILL.md`, `memory-notes/SKILL.md`, `memory-defrag/SKILL.md`

Prime Agent
- <https://github.com/PrimeIntellect-ai/prime-agent>
- <https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent/main/packages/coding-agent/docs/skills.md>
- <https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent/main/packages/coding-agent/docs/prompt-templates.md>
- <https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent/main/packages/coding-agent/docs/long-running-agents.md>
- <https://raw.githubusercontent.com/PrimeIntellect-ai/prime-agent/main/packages/coding-agent/examples/extensions/subagent/README.md>
- Local `~/.prime/agent/` tree, inspected 2026-08-12

Specs
- <https://agentskills.io/specification>
- <https://agents.md/>

Obsidian
- <https://obsidian.md/help/bases> · <https://obsidian.md/help/bases/syntax>
- <https://blacksmithgu.github.io/obsidian-dataview/> · <https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/>
- <https://github.com/farux/obsidian-auto-note-mover>

Flat-layout counter-examples
- <https://wiki.dendron.so/notes/683740e3-70ce-4a47-a1f4-1f140e80b558/> (FAQ: "Will Dendron ever support folders?")
- <https://discuss.logseq.com/t/support-subdirs-for-namespace-hierarchy/9763>

Memory-tier tools (low priority)
- <https://docs.mem0.ai/platform/features/custom-categories> · <https://github.com/mem0ai/mem0/discussions/2080>
- <https://www.letta.com/blog/letta-filesystem/> · <https://docs.letta.com/guides/agents/filesystem>

Rhizome files referenced
- `src-tauri/src/rhizome_write_location.rs`
- `src-tauri/src/vault/views.rs`, `view_migration.rs`, `entry.rs`, `rename.rs`
