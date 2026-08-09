---
type: ADR
id: "0002"
title: "Filesystem as the single source of truth"
status: active
date: 2026-02-14
---

## Context

Laputa needs a persistence model. The core question: does the app own the data, or does the filesystem? This affects sync, conflict resolution, offline support, portability, and long-term trust with users.

## Decision

**The vault is the source of truth.** The app never owns the data — it only reads and writes `.md` files. All cache, React state, and in-memory representations are derived from the filesystem and must be reconstructible by deleting them. When in doubt, the file on disk wins.

## Alternatives considered

- **Database-first (SQLite)**: faster queries, easier relationships. Rejected — creates lock-in, makes files unreadable outside the app, complicates sync.
- **Cloud-first (proprietary sync)**: easier multi-device. Rejected — zero lock-in is a core principle; git handles sync.
- **Hybrid (DB + files)**: DB as primary, files as export. Rejected — two sources of truth always diverge.

## Consequences

- Notes are plain markdown files, readable and editable by any text editor
- Git provides history, sync, and collaboration for free
- Vault can be opened/edited externally without app corruption
- App rebuilds cache on startup — acceptable cost for integrity guarantees
- No "save" button needed — autosave writes to disk immediately
- Triggers re-evaluation if: vault size grows to millions of files and filesystem scanning becomes a bottleneck
