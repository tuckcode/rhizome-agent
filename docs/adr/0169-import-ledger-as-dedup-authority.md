---
type: ADR
id: "0169"
title: "A standalone import ledger is the authority on what has already been imported"
status: active
date: 2026-09-05
supersedes: "nothing; implements the dedup design in docs/plans/2026-09-01-session-import-plan.md"
---
## Context

Session import (`docs/plans/2026-09-01-session-import-plan.md`) lets people
bring chat history in from Claude Code, Cursor, ChatGPT, Hermes and others. The
hard part is not parsing exports — it is not showing the same conversation
twice.

People arrive with **nested** history. Any harness may already hold threads
that came from another: Cursor holding Claude logs, an aggregator holding a
ChatGPT export, an IDE reimport of both. Import two sources and the naive
result is the same conversation listed twice under two names.

An import can land in up to two places, and sometimes neither:

- **Prime session list** — always, per the plan's decided destination.
- **Vault note** under `Imports/<source>/` — only when a vault is attached.
- **Nowhere** — when the user skips a duplicate, which is still a decision we
  must not forget and re-ask on every subsequent run.

So neither destination can answer "have we seen this already?". The Prime
session list does not exist when no vault is attached *and* is Prime's own
store, not ours to schema. The vault is absent for vault-less imports, and its
notes are user-editable — a renamed or deleted note must not cause a silent
re-import.

## Decision

**A standalone `import-ledger.json` in the app config directory is the single
source of truth for "already in Rhizome."** Adapters and UI consult it before
writing anywhere. Destinations are recorded *in* the ledger, not consulted as
evidence.

Consequences of that framing:

- **Only `status: imported` counts as present.** A skip or a failure must never
  block a retry.
- **Entries are append-only records of decisions**, including skips, so a later
  run can explain itself rather than re-litigating.
- **Dedup is source-agnostic.** The rules (exact source id → content
  fingerprint → declared reimport origin → fuzzy match → import) name no
  adapter. Any pair of apps dedups identically, which is what makes the nested
  chain work without per-app special cases.
- **A corrupt or missing ledger reads as empty**, not as an error. The failure
  mode of starting empty is asking about duplicates again, which the user can
  resolve; refusing to import, or importing everything twice, cannot be undone
  as easily.

`sha2` becomes a declared dependency for the content fingerprint. It is already
in the tree transitively, so this adds no new compiled code — the decision is
about declaring it, not introducing it.

## Alternatives considered

- **Derive dedup from the vault.** Fails with no vault attached, and makes a
  user's note edits silently change import behaviour.
- **Derive dedup from Prime's session list.** Prime's store is not ours to add
  fingerprints to (ADR-0163: we are a client of the daemon, not its owner), and
  it holds no record of a skip.
- **Fingerprint only, no source ids.** Loses cheap idempotency for the common
  case of re-running one source, and cannot express "this copy declares it came
  from that original."
- **Exact-match dedup only.** A truncated export would import as a second copy
  of a thread the user already has. The fuzzy step exists to ask instead.

## Status of the implementation

Slice 0 only: fingerprint, ledger, and the five dedup rules, as pure logic with
unit tests. No adapter reads a third-party app's files yet, nothing writes to
Prime or the vault, and there is no UI.

**Known gap:** the plan specifies Unicode NFC normalization before hashing so
that composed and decomposed forms of the same character match. That needs the
`unicode-normalization` crate, which is not a current dependency, so it is
deliberately not implemented rather than added silently. Two exports differing
only in Unicode composition will currently import twice. Whether to take that
dependency is an open question for the adapter slices, when real export
fixtures show whether it happens in practice.
