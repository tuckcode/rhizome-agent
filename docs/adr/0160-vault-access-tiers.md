---
type: ADR
id: "0160"
title: "Vault access tiers (RW / RO / hidden) as a path property, enforced where the code already gates"
status: proposed
date: 2026-07-26
---

## Context

The vault is written by many producers — the desktop app's Research panel,
menu-bar capture, the inbox watcher, any MCP client (Claude Code, Cursor,
Gemini, OpenCode), the `rhizome-tool` CLI, and the user editing markdown
directly. Nothing currently distinguishes *what may be written where*
beyond the artifact-placement table in `docs/VAULT_CONTRACT.md`, which
says where new artifacts **should** go but does not prevent anything from
being modified.

Two problems this session made concrete.

**1. Agents damaged files they should never have been editing freely.**
Within a single day: `docs/HANDOFF.md` was rewritten claiming the repo is
private at a `rhizome-desktop.git` URL (verifiably false — `git remote -v`
and `LICENSE` say public `knispo/rhizome`, AGPL); a `CROSS-MODEL-HANDOFF.md`
§14 cross-reference was written pointing at the wrong section; four live
operational constraints were archived into a history file because a
past-tense classifier could not tell "was true" from "is true"; and
`governance/agents/*.md` carried "Hermes is the wiki's sole writer" for two
months after the architecture stopped working that way. Each was an agent
editing something whose correctness it was not positioned to judge.

**2. The separation that does exist is expressed as two vault roots.**
Personal notes and session logs live in a second Obsidian vault purely so
agents do not touch them. That is a filesystem-level workaround for what is
really an access question, and it forces a two-root topology on a product
that otherwise wants one.

The current separation mechanisms are ad hoc and mismatched:

- `OPERATIONAL_DIRS` in `rhizome_search/mod.rs` (`.rhizome`, `raw`,
  `.obsidian`, `governance`) excludes directories from the search index.
  This is already, in effect, a "hidden" tier — an agent cannot retrieve
  what is not indexed — but it is named after operations, not access.
- `ValidatedPathMode::{Existing, Writable}` in
  `commands/vault/boundary.rs` already gates note writes through
  `with_writable_note_path`. A real chokepoint exists; it just has no
  notion of *which* paths are writable beyond being inside the vault.
- `docs/VAULT_CONTRACT.md` + `rhizome_write_location.rs` decide placement
  for *new* artifacts, but say nothing about modifying existing ones.

## Decision

**Access tier becomes a declared property of a path, with three tiers, and
each tier is enforced at whichever chokepoint already exists for it —
rather than being a rule stated in an agent-facing document.**

| Tier | Meaning | Enforcement |
|---|---|---|
| **RW** | Agents read and write freely | Default for vault content |
| **RO** | Agents read; writes refused | `ValidatedPathMode::Writable` + `frontmatter::validate_frontmatter_path` |
| **Hidden** | Agents cannot read, search, or write | Index exclusion (existing `OPERATIONAL_DIRS` mechanism), extended to reads |

Tiers attach to **paths**, not to agents. This is deliberate and is the
central point of the decision: every previous attempt to express this in
terms of *who* — "Hermes is the sole writer," "Claude searches and reads,
writes are delegated" — went stale the moment the agent lineup changed. A
path's sensitivity does not change when a new model is added.

### Enforceability is explicitly uneven, and that is stated rather than hidden

- **Hidden is the strongest.** It is a capability limit, not a request: an
  unindexed file cannot be returned by search, so an agent cannot act on
  what it cannot find. This already works today.
- **RW is strong.** Every artifact writer resolves through
  `rhizome_write_location::{resolve_write_path, unique_slug_path}` —
  verified: `rhizome_distill.rs:142`, `rhizome_import.rs:260`,
  `rhizome_repo_research.rs:292`, `rhizome_vault_seed.rs:68`. Note writes
  go through `with_writable_note_path` → `ValidatedPathMode::Writable`.
  Adding a tier check to those two points covers every in-product write
  lane at once.
- **RO is partially enforceable, and that is still worth having.** It
  holds against agents working through the product's own paths — the
  Tauri commands, the MCP tools, distill/import. It does **not** hold
  against an agent shelling out to a generic file-writing tool. That hole
  is real and should not be papered over. It is also narrow, and the
  alternative to imperfect protection on high-value files is no
  protection.

**Detection backstops prevention.** The vault is a git repository. Any RO
violation that escapes the gate appears in `git status` / `git diff`. For
files whose corruption is expensive and rare, "detectable" carries much of
the value of "preventable" — the failures listed in Context were all
detectable in principle and simply never checked.

### Initial tier assignment

**RO** — files that define a contract rather than participate in one, or
whose value comes precisely from not being casually rewritten:

- `docs/VAULT_CONTRACT.md` — agents conform to it; they do not amend it
- `docs/adr/*` — already governed by "never edit, supersede instead";
  this makes an existing convention real rather than advisory
- `docs/CROSS-MODEL-HANDOFF.md` — the single highest-value file in the
  repo by observed outcome, and the one most likely to be gutted by a
  brevity-optimizing pass
- `RHIZOME_VAULT.md` — vault identity marker used for auto-detection
- Portent type definitions (`person.md`, `project.md`, `task.md`, …) —
  schema, changed deliberately or not at all

**Hidden** — `.rhizome/`, `.obsidian/`, and personal/private trees.

**RW** — everything else: `concepts/`, `entities/`, `sources/`,
`research/`, `projects/`, `raw/`.

### Unlock is explicit, not absent

"Set in stone" must not mean "unchangeable," or the tier will be worked
around. Changing an RO file is a deliberate act: edit the tier manifest in
its own commit, or pass an explicit override the caller has to name. The
requirement is that it cannot happen *incidentally* — which is exactly how
every failure in Context occurred.

## Options considered

- **Tiers as a path property, enforced at existing chokepoints** (chosen).
  Reuses two gates that already exist; survives changes to the agent
  roster; one mechanism replaces the two-vault split.
- **Filesystem permissions (`chmod -w`)**: genuinely unbypassable, but
  breaks the user's own editing, is not representable in git, behaves
  differently across platforms, and would fight Obsidian/Rhizome as
  editors. Enforcement strength is not worth that.
- **Rules stated in agent-facing docs only** (what the vault did before):
  the null hypothesis, and this session is the experiment that rejects it.
  Four separate "read this first" instructions produced zero compliance in
  one long session; the intake gate went a month unrun. Advisory rules
  fail silently, which is worse than no rule because they read as
  coverage.
- **Keep two vault roots**: works, but expresses an access distinction as
  a topology one, forces cross-vault moves to keep personal content out of
  agent reach, and leaves no tier vocabulary for the many gradations
  inside a single vault.
- **Per-agent permissions** (Claude may write X, Hermes may write Y):
  rejected. Precisely the framing that produced "Hermes is the sole
  writer." Permissions attached to agents rot when agents change; the file
  does not care who is editing it.

## Consequences

**Easier.** The two vaults can collapse into one — personal trees are
simply Hidden rather than in a separate root. High-value documents get
real protection at the points agents actually write through. The tier
manifest becomes one legible answer to "may I change this?" replacing
scattered prose conventions.

**Harder.** A manifest is a new thing to maintain, and a wrong tier is
itself a failure mode (an over-broad Hidden makes knowledge unfindable —
note that `governance/` being both excluded from search *and* stale is
part of why "Hermes is sole writer" survived unnoticed). Legitimate edits
to RO files gain a deliberate step.

**Known gap, stated plainly.** RO does not bind an agent using a generic
file-writing tool outside the product's paths. This ADR does not claim
otherwise. Revisit if that turns out to be the common violation rather
than the rare one.

**Re-evaluate if** the manifest starts needing per-agent exceptions
(the path-not-agent premise would be failing), or if RO violations via
generic tools become frequent enough that detection-after-the-fact is
insufficient.
