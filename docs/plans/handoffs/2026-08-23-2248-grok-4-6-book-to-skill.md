---
session: 2026-08-23T22:48-05:00
model: Grok 4.6 (Cursor)
description: >-
  Added Book → Skill as a built-in Research Generate format. The pipeline
  absorbs the book-to-skill job (SKILL.md-shaped wiki) without vendoring or
  running virgiliojr94/book-to-skill. Uncommitted.
commits: uncommitted
---

# Book → Skill research format — 2026-08-23

## Implemented

- Generate's format picker now lists **Book → Skill** (`book-to-skill`) under
  a Skills category.
- `mode_instruction("book-to-skill")` asks for a SKILL.md-shaped page:
  name, when to apply, chapters, glossary, patterns, cheatsheet — extract,
  do not transcribe.
- MCP `rhizome_repo_research` / `rhizome_generate_wiki` mode enums include
  the new id (and the previously missing `eli5` / `debugging-atlas`).

## Not done (deliberate)

- Did not vendor or run the Python extractor. ADR-0168: metabolites, not
  organs.
- Import still has no format picker. A PDF book is still Import (digest)
  first; Generate wants a local docs folder or GitHub repo.

## Tests

- `npx vitest run src/components/RhizomeFormatModal.test.tsx` — 7 pass
- `cargo test --lib rhizome_repo_research::tests` — 20 pass, 2 ignored live
