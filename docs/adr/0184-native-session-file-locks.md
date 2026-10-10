---
type: ADR
id: "0184"
title: "Native session locks use fs2"
status: active
date: 2026-10-10
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 · draft PR #130 review

## Context

ADR-0183 requires a process lock so a second app instance cannot write
the same native session file, and so a crash does not leave the chat
read-only. A lock file created with `create_new` survives force-quit.
Calling `flock` directly needs `unsafe` in this crate.

## Decision

Take the lock through the `fs2` crate (`FileExt::try_lock_exclusive`).
The kernel releases it when the process dies. An in-process set still
refuses a second writer inside the same process, because `flock` is
per process. Do not treat a leftover lock file as a held lock.

## Consequences

- One small dependency, used only for advisory locks.
- Windows and Unix share one call. The unsafe syscall stays inside `fs2`.
