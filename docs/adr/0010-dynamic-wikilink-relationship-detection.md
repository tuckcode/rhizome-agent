---
type: ADR
id: "0010"
title: "Dynamic wikilink relationship detection"
status: active
date: 2026-03-08
---

## Context

Laputa needs to support arbitrary relationship types between notes (e.g., `Topics:`, `Key People:`, `Depends on:`). Initially, a hardcoded list `RELATIONSHIP_KEYS` identified which frontmatter fields were relationships. This was fragile — adding a new relationship type required a code change, and users couldn't define their own.

## Decision

**The Rust parser dynamically detects relationship fields by scanning all frontmatter keys for values containing `[[wikilinks]]`. Any field with wikilink values is captured in the `relationships` HashMap — no hardcoded field name list needed.**

## Options considered

- **Option A** (chosen): Dynamic detection via `[[wikilink]]` presence — zero configuration, extensible, any field name works. Downside: fields with bracket-like content could false-positive (mitigated by the `[[...]]` double-bracket syntax).
- **Option B**: Hardcoded `RELATIONSHIP_KEYS` list — simple, predictable. Downside: inflexible, requires code changes for new relationship types.
- **Option C**: User-configurable relationship field list in vault config — flexible. Downside: configuration burden, doesn't work out of the box.

## Consequences

- Users can define arbitrary relationship types by adding wikilink values to any frontmatter field.
- No code change needed when adding new relationship types — convention over configuration.
- All relationship fields appear in the Inspector's RelationshipsPanel automatically.
- The `relationships` HashMap in `VaultEntry` captures all dynamic relationships.
- Standard fields (`belongs_to`, `related_to`) are still recognized for backward compatibility but not privileged.
- Re-evaluation trigger: if false-positive detection becomes a problem (e.g., fields with literal `[[` content that aren't relationships).
