---
title: Relationships
description: Link notes with wikilinks in the body or in frontmatter fields, and navigate the links both ways.
---

Relationships make a vault feel like a graph instead of a pile of documents.

## Relationship fields

Any frontmatter field containing wikilinks can become a relationship. Relationship fields can point to one note or to an array of notes.

```yaml
belongs_to:
  - "[[product-work]]"
related_to:
  - "[[documentation]]"
  - "[[editor-research]]"
blocked_by:
  - "[[release-process]]"
  - "[[sync-conflicts]]"
```

Rhizome supports default relationship fields out of the box: `belongs_to`, `has`, and `related_to`. It also detects custom relationship fields dynamically when they contain wikilinks.

Default relationships have automatically computed inverses. If a note says it `belongs_to` a project, the project can show that note under its inverse `has` relationship without you writing the reverse link by hand. `related_to` works as a lateral relationship in both directions.

These outgoing and inverse relationships appear in the Properties panel and in Neighborhood mode, where the note list becomes a graph view around the selected note.

## Wikilinks

Wikilinks connect notes by name:

```md
This project belongs to [[content-systems]] and is related to [[git-workflows]].
```

Rhizome suggests targets while you type. Links can resolve by filename or title, so prefer clear titles and filenames.

## Body links versus relationship fields

Use body links when the relationship appears naturally in writing. Use frontmatter relationships when the connection is important enough to show in navigation, filters, Neighborhood mode, or the Properties panel.

## Backlinks

Rhizome can show incoming links and inverse relationships, making it easier to navigate from a note to the rest of its context.

To see all the links in the vault at once, use the [Wiki Graph](wiki-graph.md).
