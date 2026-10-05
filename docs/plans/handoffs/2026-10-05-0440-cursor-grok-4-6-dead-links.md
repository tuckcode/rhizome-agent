---
session: 2026-10-05T04:40Z
model: Grok 4.6 (Cursor)
description: >-
  Docs-only cleanup: retarget or drop dead file references in ARCHITECTURE.md
  and HANDOFF.md after a Repowise drift scan. No product code.
commits: 71ce785
---

# Dead links in ARCHITECTURE.md and HANDOFF.md

**Origin:** Grok 4.6 (Cursor) · 2026-10-05 · docs cleanup

## Why

Repowise flagged five paths that no longer exist on `main`. A scan of the
same two files found three more missing targets.

## What changed

- `src/mock-tauri.ts` → `src/mock-tauri/` (directory since bootstrap).
- `docs/IPAD-PROTOTYPE.md` never existed here → `docs/adr/0005-tauri-ios-for-ipad.md`.
- `src-tauri/capabilities/mobile.json` was deleted with iOS leftovers; drop it.
- `docs/LARGE-VAULT-LOADING-QA.md` never existed; drop the sentence.
- Local Claude settings and the Fable-5s filename are not in this tree.
- C18 now cites only the live research-panel handoff.
- C24 no longer names the deleted Mindwalk helper path.
