---
session: 2026-09-14T13:10-05:00
model: Grok 4.6 (Cursor)
description: >-
  Tiptap GHSA-j95f-988m-3j2f reachability. Helpers exist on disk.
  Note ingest uses BlockNote remark, not those parsers. Park bump.
commits: none
---

# Tiptap reachability — 2026-09-14 13:10

**Origin:** Cursor Grok 4.6 · Astra dep leftover · paper only · no commit

Advisory [GHSA-j95f-988m-3j2f](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-j95f-988m-3j2f):
quadratic ReDoS (regular-expression hang) in default Markdown
attribute parsers. Named helpers: `parseAttributes`,
`createAtomBlockMarkdownSpec`, `createBlockMarkdownSpec`,
`createInlineMarkdownSpec`. Scanner High; maintainer Moderate.
Patched in `@tiptap/core` **3.30.5**.

This tree still has **3.19.0** and **3.22.5**. Those files exist on
disk under `node_modules/.pnpm/@tiptap+core@3.19.0_*` and
`@tiptap+core@3.22.5_*`.

## Call path

Rhizome `src/` never imports `@tiptap/core`. Editor plugins import
`@tiptap/pm` only (`richEditorBlockSelectionExtension.ts`,
`richEditorTextDirection.ts`).

BlockNote note ingest is `remark-parse` + `remark-gfm` +
`remark-rehype` in
`node_modules/@blocknote/core/src/api/parsers/markdown/parseMarkdown.ts`.
That file does not call the Tiptap helpers. A search of published
`@blocknote` sources found **zero** uses of the three `create*MarkdownSpec`
names.

Chat thinking uses `MarkdownContent` + `normalizeReasoningDisplay`,
not Tiptap.

## Verdict

**Not a first-party Rhizome call.** Residual risk is a future
BlockNote / Tiptap markdown-spec extension using the default
parsers. Do not force one `@tiptap/core` across two cores plus the
existing BlockNote patches.

Did not write a hang fixture. Did not bump Tiptap.

**Stop:** editor migration, blanket override, patch removal.

**Stamped 15:19:** still parked. Do not bump Tiptap this window.
Do not bump Hono / qs / fflate / otel / glib.
