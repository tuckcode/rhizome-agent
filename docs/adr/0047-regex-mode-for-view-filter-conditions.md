---
type: ADR
id: "0047"
title: "Regex mode for view filter conditions"
status: active
date: 2026-04-08
---

## Context

The view filter engine (ADR 0040) supports operators like `contains`, `equals`, `not_contains`, `not_equals` with literal string matching. Power users who want pattern-based filtering (e.g., "all notes whose title matches a date pattern", "any property matching a URL regex") cannot express this with literals alone.

## Decision

**A `regex: true` flag is added to `FilterCondition`. When set, the `value` field is interpreted as a case-insensitive regular expression (via `regex::RegexBuilder` in Rust, and the native JS `RegExp` in TypeScript) for the operators that support it: `contains`, `equals`, `not_contains`, `not_equals`.**

- Regex is opt-in: the `regex` field defaults to `false` and is skipped during serialization when false (no noise in existing `.yml` files).
- If the regex fails to compile, the condition evaluates to `false` rather than throwing.
- For relationship fields, the regex is tested against all candidate forms: the raw wikilink string, the inner stem, and the alias (if present).
- The `FilterBuilder` UI gains a regex toggle icon button next to value inputs for supported operators.
- TypeScript `viewFilters.ts` mirrors the same regex logic for client-side evaluation.

## Options considered

- **Option A — Add regex operator variants** (`regex_equals`, `regex_contains`): More explicit in YAML. Downside: doubles the operator set; no clear path to combine regex with `not_contains`.
- **Option B — Per-condition `regex: bool` flag (chosen)**: Composable with existing operators; minimal schema change; serialization skips the field when false so existing views are unaffected.
- **Option C — Full query language** (e.g., JMESPath or SQL `WHERE`): Maximum power. Out of scope; would replace rather than extend the filter engine.

## Consequences

- New dependency: `regex` crate in Rust (already present for other vault modules; no net new dep).
- Filter YAML files that use `regex: true` require Laputa ≥ this version to evaluate correctly; older versions silently ignore the flag (falling back to `regex: false` default via `#[serde(default)]`).
- Regex evaluation has a small performance cost vs. literal matching. No memoization of compiled regexes per evaluation call — acceptable given vault sizes (< 10k notes).
- Re-evaluation trigger: if regex performance becomes measurable, cache compiled `Regex` objects keyed by pattern string.
