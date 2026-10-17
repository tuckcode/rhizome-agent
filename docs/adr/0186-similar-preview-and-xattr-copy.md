---
type: ADR
id: "0186"
title: "Approval diffs use similar with a deadline; atomic writes copy xattrs"
status: active
date: 2026-10-17
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Ricky HOLD on #196

## Context

The first `edit_file` / `write_file` preview used a quadratic resync window
(~2000×2000 per changed block), built every hunk before the 40/40 cap, and
ran twice (driver then native waiter). Large files hung. Atomic rename also
dropped macOS xattrs (Finder tags, quarantine).

## Decision

**Approval previews use the `similar` crate (Apache-2.0 OR MIT) with a 250ms
Myers deadline.** If the deadline is hit, the card shows a coarse whole-file
-/+ preview plus a timeout note. Hunk emission stops once 40 removed and 40
added lines are spent; leftover hunks and lines become a structural note
(`… N more hunks / M more lines not shown`). The driver computes the preview
once and passes it to the card.

**Atomic writes copy xattrs from the existing file onto the temp file before
rename, using the `xattr` crate (MIT OR Apache-2.0).** Creation date
(birthtime) is not an xattr and may still reset on macOS. The card does not
warn about metadata loss because xattrs are copied.

Unix writability uses `access(W_OK)` so a 0464 file is read-only for the
owner even when `Permissions::readonly()` is false.

## Options considered

- **Option A** (chosen): `similar` with `timeout`, plus `xattr` copy.
- **Option B**: keep the hand-rolled resync and add a wall-clock abort. Still
  quadratic until the abort, and still not a real diff.
- **Option C**: show a card note that metadata may be lost instead of copying
  xattrs. Weaker on macOS tags.

## Consequences

- `Cargo.toml` gains `similar` for all targets and `libc` + `xattr` on Unix.
- A timed-out preview is still an approval card; it is just coarse.
- Tests must not assume every leftover is a per-hunk `more added lines` string
  inside the diff body.
