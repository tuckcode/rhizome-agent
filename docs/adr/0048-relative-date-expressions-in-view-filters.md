---
type: ADR
id: "0048"
title: "Relative date expressions in view filter conditions"
status: active
date: 2026-04-08
---

## Context

The view filter engine (ADR 0040) supports `before` and `after` operators but previously compared values as raw strings, meaning users had to write absolute ISO dates (e.g., `2026-04-01`) that became stale immediately. Views like "notes modified in the last 7 days" required updating the date manually every week.

## Decision

**The `before` and `after` filter operators now accept relative date expressions in addition to absolute ISO dates. Both the Rust backend and the TypeScript client independently parse the expression before comparing.**

### Supported syntax

| Expression | Meaning |
|---|---|
| `today` | Start of the current day (00:00 UTC) |
| `yesterday` | Start of yesterday |
| `tomorrow` | Start of tomorrow |
| `N days ago` / `N weeks ago` / `N months ago` / `N years ago` | Past relative |
| `in N days` / `in N weeks` / `in N months` / `in N years` | Future relative |

Word-form amounts are also accepted: `one`, `two`, `three`, … `twelve`.

### Architecture

- **Rust** (`views.rs`): `parse_date_filter_timestamp()` resolves both field values and condition values to `i64` timestamps before comparing. Falls back gracefully when a value cannot be parsed.
- **TypeScript** (`utils/filterDates.ts`): `parseDateFilterInput()` and `toDateFilterTimestamp()` mirror the same logic for client-side filter evaluation. `date-fns` is used for date arithmetic.
- Both implementations use "start of day UTC" (00:00:00) as the anchor for relative expressions, consistent with how note creation/modification dates are stored.

## Options considered

- **Option A — Store and evaluate absolute dates only**: No parsing cost. Downside: views become stale; users must update dates manually.
- **Option B — Relative expressions resolved at evaluation time (chosen)**: Views stay perpetually current ("last 7 days" always means last 7 days). Downside: parallel implementation in Rust and TypeScript must stay in sync.
- **Option C — Pre-resolve relative expressions to absolute dates on save**: Expressions are human-readable when authoring but stored as ISO strings. Downside: view files drift; loses the relative intent.

## Consequences

- Relative expressions are evaluated at query time using the server/client clock. A view evaluated at 23:59 and 00:01 may return different results for "today".
- Both parsers share the same resolution anchor (start-of-day UTC). Timezone-sensitive relative expressions (e.g., "yesterday in Tokyo") are not supported.
- Existing `.yml` files with absolute ISO dates continue to work unchanged — the parser first tries ISO format before attempting relative parsing.
- Re-evaluation trigger: if timezone-aware relative dates become a user need, the expression syntax and anchor logic need revisiting.
