---
type: ADR
id: "0021"
title: "Push directly to main (no PRs or branches)"
status: active
date: 2026-03-02
---

## Context

Initially, the project used feature branches and PRs. With a single developer (assisted by Claude Code), the PR overhead — branch creation, rebase churn, merge conflicts from long-lived branches — slowed development without adding review value. The pre-commit and pre-push hooks already enforce tests, linting, type checking, and code health gates.

## Decision

**Push directly to main — no PRs, no feature branches. The pre-push hook runs all quality gates (tests, lint, type check, coverage, CodeScene health). Never use `--no-verify`.**

## Options considered

- **Option A** (chosen): Push to main with hook-enforced quality gates — fastest iteration, no rebase churn, hooks provide automated review. Downside: no PR-based review, harder to roll back a batch of changes.
- **Option B**: Feature branches with PRs — standard team workflow, code review. Downside: rebase churn for a solo developer, PR overhead with no reviewer.
- **Option C**: Feature branches without PRs (merge to main locally) — branch isolation without review overhead. Downside: still has merge conflicts, branches diverge.

## Consequences

- Commit every 20-30 minutes with conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Pre-commit hook: vitest + CodeScene health check.
- Pre-push hook: same + Playwright smoke tests.
- No `--no-verify` ever — the hooks are the quality gate.
- Reverting changes requires `git revert` (not force push).
- Re-evaluation trigger: if a second developer joins and needs code review.
