---
session: 2026-10-17T13:10:00Z
model: Grok 4.7 (Cursor)
description: >-
  Research library scan JSON is built with serde_json. A backslash,
  quote, tab, or newline in a note description or filename no longer
  breaks the frontend JSON.parse.
commits: pending
---

# Research library scan JSON — 2026-10-17

**Origin:** Cursor Grok 4.7 · 2026-10-17 · review follow-up on PR #215.

## What changed

`scan_vault_library` used to interpolate each row into a JSON string and
only replaced `"` with `'` in the description. `LibraryScanItem`
serializes the row. The Research panel parses that payload in
`parseLibraryScan`.

The Rust test round-trips a backslash, quotes, a tab, and a newline in
the description and the filename through `serde_json::from_str`. On
Unix it also scans a real note whose filename contains those characters.
The description reader still keeps one trimmed line, so a raw newline
in the on-disk blurb is not part of that line. The serializer is what
keeps a newline when the string contains one.

## Not in this change

No copy change. The error string stays `research.event.libraryScanError`.
