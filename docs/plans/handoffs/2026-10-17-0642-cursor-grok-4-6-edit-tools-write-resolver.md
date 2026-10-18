---
session: 2026-10-17T06:42Z
model: Cursor Grok 4.6
description: >-
  Rebase #196 onto main after #197; edit_file and write_file use
  resolve_for_write so secret and .git writes stay refused with the
  setting off. Dangling-symlink refusal kept.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #196 onto main after #197

`edit_file` uses `sandbox::resolve_file_for_write`; `write_file` uses
`sandbox::resolve_for_write`. Those always apply the denylist and always
refuse `.git` paths, whatever `block_secret_files` says. Reads go through
`resolve_for_read` / `resolve_file` / `resolve_dir`. Dangling mid-path
symlinks still return the clear error.

Regression: with the setting off, both tools refuse `.git/hooks/pre-commit`,
`.git/config`, `.env`, `id_rsa`, a symlink to `.git`, and a `.git` worktree
file.

Localization: none — English only (C18).
PostHog: no event needed because this is a safety lock, not a new action.
