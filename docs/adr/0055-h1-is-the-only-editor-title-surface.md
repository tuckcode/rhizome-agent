---
type: ADR
id: "0055"
title: "H1 is the only editor title surface"
status: superseded
date: 2026-04-11
supersedes: "0044"
superseded_by: "0068"
---

## Context

ADR-0044 moved Laputa to H1-as-title, but the frontend still carried a legacy fallback: when a note had no H1, `TitleField` and the old title section could reappear above the editor. That left two competing title surfaces in the product and made it possible for deleting an H1 to resurrect UI that was supposed to be gone.

The result was both behavioral drift and stale tests: some code paths still treated the dedicated title row as a valid editing surface even though the product direction is now keyboard-first writing directly in the document body.

## Decision

**The editor body is now the only title surface. Laputa never renders a separate title section above the editor, regardless of whether a note currently has an H1.**

Display-title behavior stays:
1. First H1 in the body
2. Legacy frontmatter `title:`
3. Filename-derived fallback

But the UI no longer exposes a dedicated title field for cases 2 or 3. When a note has no H1, the editor simply shows normal body content or the empty-editor placeholder.

Filename operations remain explicit:
- untitled notes still auto-rename from H1 on save
- manual filename rename/sync remains in the breadcrumb

## Options considered

- **Option A** (chosen): remove the fallback title section entirely. This makes the editor honest, removes a stale code path, and keeps title editing aligned with the keyboard-first document model.
- **Option B**: keep the fallback title field for non-H1 notes. This preserves an alternate rename path, but it reintroduces the exact dual-surface ambiguity that ADR-0044 tried to escape.
- **Option C**: hide the title section with CSS only. Low churn, but it leaves dead render/state paths in place and makes regressions like “delete H1 and old title row returns” easy to reintroduce.

## Consequences

- Deleting an H1 no longer reveals any legacy title UI; the user stays in the editor body.
- `TitleField` and the title-section render path are removed from the frontend.
- Breadcrumb filename controls are now the only explicit file-identifier editing surface outside the editor body.
- Older tests that asserted title editing through `TitleField` are obsolete and should be replaced by H1-title or breadcrumb-filename coverage.
