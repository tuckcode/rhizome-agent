---
type: ADR
id: "0025"
title: "type: as canonical field (replacing Is A:)"
status: active
date: 2026-03-08
---

## Context

The entity type field was originally stored as `Is A:` in frontmatter (e.g., `Is A: Project`), following a natural-language naming convention. This caused problems: the space and colon made it awkward to parse, `is_a` was used internally as the snake_case variant, and `type:` is the standard YAML convention for metadata classification. The field name also confused AI agents that expected standard YAML conventions.

## Decision

**Use `type:` as the primary frontmatter field for entity types (e.g., `type: Project`). The legacy `Is A:` field is accepted as an alias for backward compatibility but new notes always use `type:`.** The internal TypeScript/Rust property remains `isA` for backward compatibility.

## Options considered

- **Option A** (chosen): `type:` as canonical with `Is A:` as legacy alias — clean, standard YAML convention, AI-readable. Downside: must maintain backward compatibility with existing vaults.
- **Option B**: Keep `Is A:` as canonical — no migration needed. Downside: non-standard, awkward parsing, confusing for AI agents.
- **Option C**: `kind:` or `category:` — avoids potential YAML type conflicts. Downside: less intuitive, still requires migration from `Is A:`.

## Consequences

- New notes use `type: Project` (not `Is A: Project`).
- The Rust parser checks `type:` first, falls back to `Is A:` for legacy notes.
- `VaultEntry.isA` property name kept for internal backward compatibility.
- Type documents in `type/` folder use `type: Type` in their own frontmatter.
- Repair Vault migrates legacy `Is A:` fields to `type:` when run.
- Re-evaluation trigger: if YAML reserved word `type` causes parsing issues (not observed so far).
