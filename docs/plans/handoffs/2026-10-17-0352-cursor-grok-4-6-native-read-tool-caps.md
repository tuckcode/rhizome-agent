---
session: 2026-10-17T03:52Z
model: Cursor Grok 4.6
description: >-
  HOLD fix on #195: streaming byte caps, early-stop walks, list_dir
  gitignore, grep time/file budget, lossy UTF-8, and knispo-approved
  secrets denylist.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · native read-tool cap HOLD

Review HOLD at `e31c463` (sandbox solid; caps leak). One push, including
the secrets denylist after knispo 10:47 PM CT: "Yes, block the secret
files."

MUST: `grep` clips each match to 500 characters and 100KB of output.
`read_file` and `grep` scan in 8KiB chunks; a giant line is never held
whole; `offset` counts newlines without storing skipped lines.

SHOULD: `list_dir` and `glob` stop the walk at the result cap / 10k
entries. `grep` also stops at 2000 files or 2s. `list_dir` honours
`.gitignore`. Regex compile uses a 1MiB `size_limit`. Non-UTF-8 text
is lossy; NUL still means binary. Tests cover `/vault` vs `/vault-evil`,
a missing `..` path, a symlink dir in a walk, and `list_dir` of a
symlink.

Secrets: one list in `sandbox` — `.env*`, anything under `.git/`,
`*.pem`, `id_*` — case-insensitive basename (and `.git` path
components), after canonicalization, including walks and symlinks.
`read_file` returns `blocked: secret file`. Walks omit them.

Localization: none — English only (C18).
PostHog: no event needed because this is loop I/O policy, not a new UI
action.
