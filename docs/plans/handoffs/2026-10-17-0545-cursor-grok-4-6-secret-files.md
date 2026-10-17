---
session: 2026-10-17T05:45Z
model: Cursor Grok 4.6
description: >-
  Julian denylist after #195: exact private-key basenames, extra
  extensions, .env.example exception, persisted override, and Ricky
  truncation/walk-cap notes.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · secret-files follow-up to #195

knispo 12:16 AM CT: "Yes, go with Julian's full suggestion."
Ricky+Critiquito HOLD on #197: write path never honours the setting;
key backups; move the toggle; copy without a shell caveat.

`sandbox::is_secret` is the denylist. Read tools use `resolve` /
`is_blocked_secret`. Write tools must call `resolve_for_write`, which
always applies the denylist (including `.git`) even when the setting is
off. #196 rebases onto this. Default on. Settings → AI Agents → Safety
toggle disables the denylist for **reads** only. Safety net, not a wall:
a future shell tool is not covered. When off, `.git/config` is readable.

Patterns: exact private-key basenames in any folder, case-insensitive
(`id_rsa`, `id_dsa`, `id_ecdsa`, `id_ecdsa_sk`, `id_ed25519`,
`id_ed25519_sk`, `id_mldsa44_ed25519`). `id_rsa.pub`, `id_ed25519.pub`,
and `id_card.md` stay allowed. Keep `*.pem`, `.git/`, `.env*`. Add
`*.key`, `*.p12`, `*.pfx`. Allow `.env.example` (exact basename).

Ricky #195 notes: grep line-scan 2000-byte note; 2s budget inside chunk
reads; `read_file` offset wording; list_dir symlink-dir labelled `dir`;
glob/list_dir walk-cap note vs result-cap 200; walk.rs gitignore comment.

Out of scope: sniffing file contents for `PRIVATE KEY-----`.

Screenshots: `docs/review-shots/secret-files/graphite-dark.png`,
`docs/review-shots/secret-files/earth-light.png`.

Localization: none — English only (C18).
PostHog: `secret_file_block_changed`.
