---
type: ADR
id: "0181"
title: "PR branches with full pre-push gates"
status: active
date: 2026-10-10
supersedes: "0021"
---

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · PR #95, approved by Atticus

## Context

[ADR-0021](0021-push-to-main-workflow.md) chose push-to-main with no PRs
and no feature branches. The pre-push hook enforced it: it refused every
branch except `main` and `prototype/*`.

The harness plan (`docs/plans/2026-10-09-rhizome-harness-plan.md` §6)
changed the workflow. Agents open one PR per phase, and knispo merges. Two
agents (Claude and Cursor) work in parallel on separate files. The hook
and the workflow could not both hold.

On 2026-10-09 the Phase 1 and Phase 2 PR branches reached GitHub only
because `.husky/_/pre-push` was missing on that clone. That skipped every
local gate, which is worse than either rule.

## Decision

A branch may push to the remote branch with the same name. That push runs
the full pre-push gate suite, the same as a push to `main`.

- `main` to `main` and tags: unchanged.
- A push to `main` from any other branch name: refused.
- A push to a different remote name: refused.
- `prototype/*`: gates skip only when every pushed ref is a prototype ref.

The ref check lives in `.husky/push-refs.sh`. `src/lib/prePushRefs.test.ts`
runs it against made-up push input.

Pushing straight to `main` stays allowed. This ADR does not require PRs. It
makes them possible without skipping gates.

## Options considered

* **Keep ADR-0021 and push agents' work to `main`.** Rejected. The harness
  plan wants owner review before merge.
* **Push PR branches with `--no-verify`.** Rejected. AGENTS.md forbids it,
  and it skips every gate.
* **Use `prototype/*` for PR branches.** Rejected. Prototype branches never
  merge, and the hook skips gates on them.
* **Allow same-name branch pushes with full gates (chosen).**

## Consequences

- ADR-0021 is superseded.
- AGENTS.md §"Commits & pushes" and the `rhizome-ship` skill describe both
  paths.
- CI (`.github/workflows/ci.yml`) runs only on PRs whose base is `main`. A
  stacked PR gets CI after its base merges.

[[0021-push-to-main-workflow]]
