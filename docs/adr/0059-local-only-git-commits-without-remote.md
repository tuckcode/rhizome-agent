---
type: ADR
id: "0059"
title: "Local-only git commits for vaults without a remote"
status: active
date: 2026-04-12
---

## Context

ADR-0034 mandates a git repo for every vault, but never required a remote. In practice, the commit flow always attempted a `git push` after staging and committing. Users with purely local vaults (no remote configured) would hit a push error on every commit.

The fix required distinguishing between two commit modes at the point of user action:
- **Push mode**: repo has a remote → commit then push (existing behavior).
- **Local mode**: repo has no remote → commit only, no push attempted.

## Decision

**`useCommitFlow` detects the vault's remote status before opening the commit dialog and at commit time. When `hasRemote === false`, it commits locally and skips the push step entirely, showing "Committed locally (no remote configured)" as the confirmation toast.**

## Options considered

- **Option A** (chosen): Runtime detection via a new `useGitRemoteStatus` hook + `CommitMode` type (`push` | `local`). Pros: transparent to the user, no configuration needed, adapts if a remote is added later. Cons: adds an async remote-status check to the commit open flow.
- **Option B**: Require all vaults to have a remote (keep blocking behavior). Pros: simpler model. Cons: breaks the valid use case of a local-only knowledge base; contradicts ADR-0056 which removed provider-specific OAuth.
- **Option C**: Let the push fail silently and always show success. Pros: no new logic. Cons: misleading feedback; users wouldn't know the push was skipped vs. succeeded.

## Consequences

- `useGitRemoteStatus` is a new hook that exposes `remoteStatus` and `refreshRemoteStatus`; it is called both when opening the commit dialog and after each commit.
- `CommitDialog` now receives a `commitMode` prop and adjusts its CTA label accordingly (`Commit & Push` vs `Commit`).
- The `commitAndPush` callback in `CommitFlowConfig` is replaced by `resolveRemoteStatus` + `vaultPath`; the actual git operations (`git_commit`, `git_push`) are invoked directly inside `useCommitFlow`.
- Local-only commits fire `trackEvent('commit_made')` the same as push commits for analytics continuity.
- Re-evaluation warranted if a remote is later added to a previously-local vault and the UX should prompt the user to push accumulated commits.
