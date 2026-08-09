---
type: ADR
id: "0149"
title: "Drop the CodeScene quality gate (no free tier)"
status: active
date: 2026-07-09
---

## Context

ADR-0018 and ADR-0064 established and then ratcheted a mandatory CodeScene
Hotspot/Average code-health gate, enforced in both CI (`.github/workflows/ci.yml`)
and the local `.husky/pre-push` hook, with thresholds tracked in
`.codescene-thresholds`.

Verified current pricing (2026-07-09) across every CodeScene surface: cloud
plans (Standard €18/mo, Pro €27/mo per active author), the `cs` CLI (requires
a licensed project token), and the standalone local-only CodeHealth MCP
(still needs a paid CodeScene account after a 14/30-day trial). There is no
free path at any layer. The user has confirmed they will not pay for this on
this repo, period.

Codacy's local CLI (`codacy-cli-v2`) is unaffected — it's MIT-licensed, runs
fully locally, and covers the security/lint gate without touching Codacy's
paid cloud dashboard. That leg of the pre-push mandate stays as-is.

## Decision

**Drop the CodeScene gate from the mandatory quality process.** Concretely:

- Removed the "Code Health gates" step from `.github/workflows/ci.yml`.
- Removed the CodeScene mandate (pre-task health check, before/after
  per-file scoring, `.codescene-thresholds` ratchet rules) from `AGENTS.md`.
- Left `.husky/pre-push`'s CodeScene block in place as dormant code: it
  already soft-skips with a warning when `CODESCENE_PAT`/`CODESCENE_PROJECT_ID`
  are unset, which is always true now that no CI secret or local env
  provides them. It is inert, not enforcing anything. Left as a follow-up
  cleanup rather than bundled into this decision, since removing it touches
  the actual push gate script and deserves review on its own.
- `.codescene-thresholds` stays on disk (the dormant hook block still reads
  it) but is no longer a meaningful policy file.

Supersedes ADR-0018 and ADR-0064.

## Options considered

- **Drop entirely** (chosen): matches the constraint (no free tier, no
  budget) without new plumbing. Boy Scout Rule (never add `eslint-disable`,
  `as any`, etc.; leave touched files cleaner) still applies by judgment,
  just without a numeric gate enforcing it.
- **Replace with SonarQube Community + `code-maat`**: free and self-hosted,
  covers both jobs CodeScene did (per-file quality rating via SonarQube,
  git-history hotspot/change-frequency weighting via `code-maat`, the tool
  CodeScene's own creator open-sourced before commercializing it). Real
  integration work — new CI wiring, no drop-in score compatible with
  `.codescene-thresholds`, needs its own baseline. Not pursued now; revisit
  if hotspot/bus-factor analysis becomes an actual felt need, not just a
  gate to satisfy.
- **Keep CodeScene mandate as aspirational/unenforced text**: rejected —
  documenting a gate the team will never pay to enable just rots into a
  process nobody follows and agents keep tripping over.

## Consequences

- Pre-push and CI no longer block on any code-health score. Quality still
  enforced via: Codacy (security/lint), test coverage floors (frontend
  ≥70%, Rust ≥85%), clippy, ESLint, and human review of the Boy Scout Rule.
- No git-history-aware hotspot or bus-factor signal today. If that's needed
  later, it's new work (SonarQube + code-maat, or similar), not a
  config flip.
- `.husky/pre-push`'s CodeScene block remains as unused dead code pending a
  separate cleanup pass.
