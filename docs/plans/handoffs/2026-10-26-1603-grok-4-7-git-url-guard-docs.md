---
session: 2026-10-26T16:03Z
model: Grok 4.7 (Cursor)
description: >-
  Document the git remote URL guard. Clone, add-remote, and research
  clone reject option-like URLs and transport helpers before git runs.
commits: docs: describe the git remote URL guard
---

# Git remote URL guard docs

**Origin:** Cursor Grok 4.7 · 2026-10-26 · docs automation

## What changed

Living docs still said a clone accepts any git URL. `validate_remote_url`
in `src-tauri/src/git/remote_url.rs` does not. Updated `docs/ARCHITECTURE.md`,
`docs/GETTING-STARTED.md`, and the site Git pages to match the three
rejection strings and the three call sites.

## Left alone

ADR-0056 still says "paste any git URL". ADRs are not edited in place.
The architecture section is the current description.
