---
type: ADR
id: "0049"
title: "Per-note icon property (_icon on individual notes)"
status: active
date: 2026-04-08
---

## Context

Laputa already supports type-level icons via the `_icon` system property on type documents (ADR 0008). Every note of a given type inherits the type's icon. Users needed a way to give individual notes a distinct visual identity without changing the type — e.g., marking a specific project with a rocket emoji, or a key person with a star icon — without creating a new type just for one note.

## Decision

**The `_icon` system property (already used by type documents) is now also supported on regular notes. When a note has an `_icon` value, it overrides the inherited type icon in all UI surfaces. The value may be an emoji, a Phosphor icon name, or an HTTP(S) image URL.**

### Resolution logic

`resolveNoteIcon(icon)` in `utils/noteIcon.ts` returns a discriminated union:

| Kind | Condition |
|---|---|
| `none` | Value is empty/null |
| `emoji` | Value passes `isEmoji()` |
| `image` | Value is an HTTP(S) URL |
| `phosphor` | Value matches a registered Phosphor icon name |

The `NoteTitleIcon` component renders the correct element for each kind (span, `<img>`, or Phosphor SVG component).

### UI surfaces updated

- Editor breadcrumb bar (clicking the icon opens the `_icon` property editor)
- Note list items (`NoteItem`)
- Search panel results
- Relationship chips (shows icons on wikilink chips)
- Sidebar type sections
- Backlinks / ReferencedBy panels
- Inspector pinned area

### Editing

A custom event (`laputa:focus-note-icon-property`) is dispatched from the breadcrumb bar click to focus the `_icon` field in the Properties panel without scrolling. The field uses the existing property editor UI.

## Options considered

- **Option A — Separate `_note_icon` property**: Avoids ambiguity with the type-level `_icon`. Downside: two names for the same concept depending on context; complicates the resolver.
- **Option B — Reuse `_icon` on notes (chosen)**: Consistent with existing convention (ADR 0008); type docs and note docs follow the same schema. The distinction between type-level and note-level is determined by `is_a: Type` in the frontmatter, not by a different property name.
- **Option C — Inline emoji in note title**: Zero-friction. Downside: title is also the filename (ADR 0044); emojis in filenames cause filesystem/git pain.

## Consequences

- `_icon` on a note overrides the type icon everywhere. A note with no `_icon` continues to inherit the type icon (no behavior change for existing vaults).
- The icon resolver (`resolveNoteIcon`) is shared between note icons and type icons; future changes to icon resolution affect both.
- `iconRegistry.ts` grows with any new Phosphor icon additions — currently loaded eagerly. If the icon set grows large, lazy loading or a build-time icon map should be considered.
- Re-evaluation trigger: if users request per-note color (the `_color` system property currently only applies to types), the same resolution pattern can be extended.
