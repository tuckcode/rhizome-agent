---
session: 2026-10-17T06:50Z
model: Cursor Grok 4.6
description: >-
  Drop libc::access unsafe in atomic writes; probe writability with
  OpenOptions so Codacy's high on #196 is gone and 0464 still fails.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Codacy high on #196 atomic.rs

`is_not_writable` opens the existing file for write without truncating
instead of `unsafe { libc::access(..., W_OK) }`. Owner-0464 still
refuses. No new dependency.

Localization: none — English only (C18).
PostHog: no event needed because this is a writability probe, not a
user action.
