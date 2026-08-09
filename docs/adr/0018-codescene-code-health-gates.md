---
type: ADR
id: "0018"
title: "CodeScene code health gates in CI and git hooks"
status: superseded
date: 2026-03-13
superseded_by: "0064"
---

## Context

Code complexity tends to increase over time, especially in fast-moving projects. Without automated enforcement, hotspot files (most-edited files) degrade in quality, making future changes harder and buggier. A quantitative code health metric was needed to prevent regression.

## Decision

**Enforce CodeScene code health scores as mandatory gates in pre-commit and pre-push hooks. Hotspot Code Health must be >= 9.5 and Average Code Health must be >= 9.31 (project-wide). Both gates block commit/push on failure.** The Boy Scout Rule ("leave every file better than you found it") is enforced as part of every task.

## Options considered

- **Option A** (chosen): CodeScene with hard gates — quantitative, automated, catches complexity before it merges. Downside: can slow development if scores are borderline, requires CodeScene API access.
- **Option B**: Manual code review for complexity — human judgment. Downside: subjective, inconsistent, doesn't scale.
- **Option C**: Linter-only rules (ESLint complexity, Clippy) — built-in, no external service. Downside: coarser metrics, no hotspot awareness, no project-wide average tracking.

## Consequences

- Pre-commit hook runs vitest + CodeScene health check before every commit.
- Pre-push hook runs the same checks plus Playwright smoke tests.
- Developers must fix complexity regressions before committing — even in files they didn't directly modify if changes indirectly affected complexity.
- Never use `// eslint-disable`, `#[allow(...)]`, or `as any` to pass the gate.
- Common fixes: extract hooks, split large components, reduce function complexity, extract modules.
- `.codesceneignore` excludes `tools/`, `e2e/`, `tests/`, `scripts/` from analysis.
- Re-evaluation trigger: if CodeScene becomes unavailable or a better code health tool emerges.
