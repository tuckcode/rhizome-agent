# Vault write contract

The single source of truth for where a Rhizome research artifact lives inside
a vault, and what frontmatter it carries. Both the Library scanner
(`rhizome_scan_library`) and every future writer (research/distill/import,
step 4 of `docs/plans/2026-07-05-one-brain-architecture-decision.md`) read
this table through one Rust resolver
(`src-tauri/src/rhizome_write_location.rs`) so drift between "where the
scanner looks" and "where a writer puts things" is impossible by
construction.

## Canonical layout

```text
<vault>/
└── wiki/                         # searchable compiled knowledge only
    ├── sources/
    │   ├── repos/<slug>.md       # repo research / repo wiki output
    │   └── documents/<slug>.md   # imported document digests
    ├── entities/<slug>.md        # shared people, orgs, tools, repos, products
    └── concepts/<slug>.md        # shared ideas, techniques, patterns
```

Everything else in the vault (raw drops, governance docs, `.rhizome/`) is
outside `wiki/` and out of scope for the Library scanner and search index.

## Artifact kinds

| Kind | Path | Library `type` | Library `tag` |
|---|---|---|---|
| `RepoWiki` | `wiki/sources/repos/<slug>.md` | `wiki` | `Repo Wiki` |
| `Document` | `wiki/sources/documents/<slug>.md` | `source` | `Document` |
| `Entity` | `wiki/entities/<slug>.md` | `card` | `Entity` |
| `Concept` | `wiki/concepts/<slug>.md` | `card` | `Concept` |

This table is the only place these paths and labels are defined
(`rhizome_write_location::ArtifactKind`). Add a kind there, not in the
scanner or a writer directly.

## Frontmatter schema

Every artifact under `wiki/` should carry:

```yaml
---
title: Human Title
type: entity|concept|source|wiki
state: fleeting|developing|stable|archived
last_updated: YYYY-MM-DD
context: One sentence situating this page for retrieval.
---
```

`rhizome_write_location::default_frontmatter` builds this skeleton for a
given kind; a writer fills in `title`/`context`/body and may add optional
keys (`sources`, `agent`) on top.

## Inbox drops: `inbox_action`

`raw/inbox/` is outside `wiki/` and outside this contract — it holds
*inputs*, not artifacts. One key there is contractual, because it decides
what an input becomes: a markdown drop may declare its own routing.

```yaml
---
title: Idempotency Explained
inbox_action: save          # save | distill | import
source_url: https://example.com/idempotency
---
```

| Value | Result |
|---|---|
| `save` | Filed as-is under `wiki/sources/documents/`. No agent, no tokens. |
| `distill` | Agent-distilled into `wiki/concepts/`. |
| `import` | Source fetched/converted into `wiki/sources/documents/`. |

A declared action beats `inbox_watcher::classify_inbox_file`'s
extension heuristic; an absent or unrecognised value falls back to it. Only
`.md`/`.markdown` is read for a declaration.

`inbox_action` is an instruction to the inbox, not content: the page filed
into `wiki/` is rebuilt with the frontmatter above and never carries the key
through. Defined in `src-tauri/src/inbox_action.rs`; see ADR-0158.
