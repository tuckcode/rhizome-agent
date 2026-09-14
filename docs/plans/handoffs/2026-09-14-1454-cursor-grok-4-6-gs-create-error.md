---
session: 2026-09-14T14:20-05:00
model: Grok 4.6 (Cursor)
description: >-
  Local Getting Started failures say create, not download. Git-clone
  (C11) failures still say download. Permission denied on a folder is
  disk, not GitHub.
commits: uncommitted
---

# Local Getting Started errors say create

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:20 · leftover implement.

Default first-run is a **local folder scaffold**, not a clone. Disk
failures (create folder, write welcome.md) used to read as
“Could not download.” A local `Permission denied` also hit the GitHub
auth matcher.

## Change

`formatGettingStartedCloneError` in `src/utils/gettingStartedVault.ts`:

1. Named local scaffold fragments → **Could not create Getting Started vault:**
2. Then git-not-found / auth / network → **download** (C11)
3. Message contains `git clone` / `git reported` → **download**
4. Else → **create**

Welcome Download words in `en.json` stay (C18). Do not rewrite them.

## Tests

`src/utils/gettingStartedVault.test.ts` **23/23** (added 2).

Git `Permission denied (publickey)` still maps to GitHub access.

## Not this window

- C11 env-override clone still uses download wording
- Packaged app `476756c` still old
- No `en.json` rewrite
- D6 commits wait ~15:45
