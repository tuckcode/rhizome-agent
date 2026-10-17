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

`sandbox::is_secret` is the denylist. `sandbox::resolve` and walks use
`is_blocked_secret`, so in-flight #196 (edit tools) picks it up on
rebase. Default on. Settings → AI Agents toggle disables the denylist
only; root sandboxing still applies. Safety net, not a wall: Power User
`bash` can still read those files.

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
