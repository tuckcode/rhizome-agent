---
type: ADR
id: "0161"
title: "Single writer for .rhizome/events.jsonl"
status: active
date: 2026-07-31
---
## Context

`.rhizome/events.jsonl` is the activity log behind the menu-bar feed and
History. The 2026-07-31 save-path audit
(`docs/plans/2026-07-31-save-path-audit-session-status.md`) found **four
independent writers**, each hand-rolling the same
`OpenOptions::new().append(true)` block with a different field set:

| Writer | Emitted |
|---|---|
| `rhizome_distill::append_vault_event` | `type, from, project, trigger, artifact_path, timestamp` |
| `rhizome_import::append_import_event` | `type, source, project, trigger, artifact_path, timestamp` |
| `rhizome_repo_research::append_event` | arbitrary JSON per call site |
| `mcp-server/index.js::appendRhizomeEvent` | arbitrary object; **no `trigger` at any of its 10 call sites** |

The consequences were measurable, not theoretical. A real 15-event log
contained **five distinct field shapes**, and **33% of records carried no
`trigger` at all** — the field the log exists to record. One shape matched no
current writer, i.e. schema residue with no version marker to identify it.

This is exactly the drift `docs/VAULT_CONTRACT.md` already eliminated for
artifact *paths* by routing every writer through one resolver
(`rhizome_write_location`). The event log had the opposite property: nothing
stopped a new call site from inventing a shape, and one did.

`rhizome_distill::append_vault_event`'s own doc comment claimed it was the
shared writer "so History / menu-bar activity stay in sync." Two Rust paths
ignored it.

## Decision

**Add `src-tauri/src/vault_events.rs` as the single Rust writer, with a
builder that makes an untriggered event unconstructible.**

`VaultEvent::new(event_type, trigger)` takes both required fields
positionally; `project`, `artifact_path` and kind-specific `field(k, v)`
extras chain on. `append()` always emits `type`, `trigger` and `timestamp`.

The three Rust writers become thin wrappers that keep their existing public
signatures, so no call site changed.

## Options considered

* **Option A** (chosen): one writer + builder, kind-specific fields as
  extras. Keeps existing on-disk shapes byte-compatible (verified — every
  pre-existing shape assertion still passes), so no migration and no reader
  change. Downside: `extra` is stringly-typed, so a typo'd key is still
  possible.
* **Option B**: one writer with a closed `enum VaultEventKind`. Fully
  type-safe, no stringly-typed extras. Downside: changes on-disk shapes, so
  it needs a schema version and a reader that tolerates both; a bigger step
  than the audit's evidence justified taking in one commit.
* **Option C**: leave the writers and add a shape test per writer. Cheapest,
  but locks in the divergence it documents and does nothing for the JS path.

## Consequences

* `type`, `trigger` and `timestamp` are guaranteed on every record written
  from Rust. The 33%-missing-trigger class of bug cannot recur there.
* The hardcoded `"from": "inline"` is dropped. It was a constant on every
  record and read by nobody — `targetFor`
  (`src/utils/menuBarActivity.ts:43-50`) consults
  `title`/`artifact_path`/`path`/`project`/`source`. A regression test
  asserts it does not come back.
* Existing shapes are preserved, so `read_vault_events` and the feed needed
  no change.
* **`mcp-server/index.js` — resolved later the same day (consequence
  updated, decision unchanged).** The original note deferred this as out of
  scope. It landed instead, once it was clear that "one writer" across two
  runtimes means *one writer per runtime sharing one invariant*, not
  cross-process routing: `mcp-server/vault-events.js` is now the single JS
  writer and stamps `trigger` (default `"mcp"`) and `timestamp` on every
  record. Its five Rust-less event types (`search`, `lint`, `graph-summary`,
  `wiki-generate-started`, `wiki-generate-finished`) stay in JS and are no
  longer trigger-less. Extracting it from `index.js` was required, not
  cosmetic — importing `index.js` starts the MCP server, so nothing defined
  in it can be tested.
* Historical records already on disk keep their old shapes. Any reader must
  still tolerate every shape ever written — this ADR stops new divergence,
  it does not retro-fix the log.
* A closed enum for `trigger` (and Option B generally) stays available as a
  follow-on once the audit's finding 1 decides whether `trigger` gets a
  reader at all.
