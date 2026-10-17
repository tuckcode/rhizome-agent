---
session: 2026-10-17T06:21Z
model: Cursor Grok 4.6
description: >-
  Ricky HOLD on #196: similar+deadline preview once, leftover notes,
  header-by-position, no Allow autofocus, stamp by call id, xattrs,
  via-link, 0464, mixed EOLs.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Ricky HOLD at 238c534

Judgment calls: copy xattrs with the `xattr` crate before rename;
creation date may still reset and is not noted on the card. `similar`
Myers with a 250ms deadline; timeout falls back to a coarse whole-file
-/+ preview plus a note. Preview is computed in the driver and passed
to the card (native does not recompute).

Localization: none — English only (C18).
PostHog: no event needed because approval answers are frequent.
