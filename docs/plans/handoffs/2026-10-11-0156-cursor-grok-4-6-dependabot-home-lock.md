---
session: 2026-10-11T01:56Z
model: Grok 4.6
description: >-
  Health PR: bump rustls, dompurify, and smol-toml to patched versions,
  and hold the git-identity test on the shared HOME lock. Did not touch
  ProviderKeys, native_chat, or native_log.
commits: cursor/dependabot-home-lock-81d3
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 01:56 UTC

## What landed

Did not edit `HANDOFF.md`. Did not touch keychain, ProviderKeys,
native_chat, or native_log.

- rustls 0.23.36 → 0.23.45 (and rustls-webpki 0.103.15). Nothing capped
  it below 0.23.45; a precise lock update was enough.
- `pnpm-workspace.yaml` overrides held dompurify at 3.4.13 and smol-toml
  at 1.7.1. Those are now 3.4.16 and 1.9.0 (first published release that
  satisfies smol-toml >= 1.8.1).
- The nested-worktree git test takes `TEST_CONFIG_ENV` so a parallel
  test cannot move HOME during `git commit`.
