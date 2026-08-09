---
type: ADR
id: "0044"
title: "H1 as primary title source — filename as stable identifier"
status: active
date: 2026-04-07
supersedes: "0007"
---

## Context

ADR-0007 established that the `title:` frontmatter field is the source of truth for display titles, with filenames derived from it via slugification and kept in sync bidirectionally. This model had a key assumption: the user explicitly types a title before writing content.

In practice this created friction: new notes required a title upfront, the TitleField was always visible cluttering the editor, and the "title = filename slug" contract was fragile when users renamed files externally. The team wanted a more natural writing flow where you just start writing — like most text editors — and the title emerges from the document.

A pair of commits on 2026-04-06 (`377a3f8d`, `7daf6898`) implemented a fundamentally different model.

## Decision

**The first `# H1` heading in the note body is the canonical display title. The `title:` frontmatter field is legacy/backward-compat only. New notes are created with filename `untitled-{type}-{timestamp}.md` and no `title:` in frontmatter. On save, if the note has an H1, the file is auto-renamed to a slug derived from it (collision-safe with `-2`, `-3` suffixes).**

Title resolution priority (Rust `extract_title`):
1. H1 on the first non-empty line of the body
2. Frontmatter `title:` field (legacy, backward-compat)
3. Slug-to-title derivation from filename stem

The `has_h1: bool` field on `VaultEntry` signals the frontend to hide `TitleField` and the icon picker when an H1 is present, since the H1 serves as the title surface.

The breadcrumb bar shows the **filename stem** (not display title) so users always know the actual file identifier.

Auto-rename (`auto_rename_untitled` Tauri command) fires on save for `untitled-*` files that gain an H1, converting them to a human-readable slug.

## Options considered

- **Option A — H1 as primary title + auto-rename on save** (chosen): natural writing flow, filename eventually reflects content, TitleField hidden when H1 present. Downside: auto-rename can surprise users; breadcrumb must show filename to stay honest.
- **Option B — Keep `title:` frontmatter as source of truth** (ADR-0007, now superseded): explicit, deterministic. Downside: forces upfront titling, TitleField always visible, friction for quick capture.
- **Option C — UUID-based filenames, title only in H1**: filenames never change, no rename logic needed. Downside: vault unreadable in Finder/terminal, breaks the plain-files principle (ADR-0002).

## Consequences

- New notes start as `untitled-note-{timestamp}.md` — the vault may accumulate untitled files if users abandon drafts without writing an H1
- `TitleField` component is hidden when `has_h1 = true`; icon picker is also hidden (icons only make sense on titled notes)
- Frontmatter `title:` still parsed for backward-compat; existing vaults with explicit titles continue to work
- Auto-rename on save introduces a file rename side-effect during editing — wikilinks pointing to the old filename may break until the rename propagates
- The breadcrumb filename display makes the system more honest but slightly more technical for non-power users
- Re-evaluate if users find auto-rename disorienting or if wikilink breakage during rename becomes a reliability concern
