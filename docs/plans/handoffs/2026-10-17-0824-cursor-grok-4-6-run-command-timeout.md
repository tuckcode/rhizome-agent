---
session: 2026-10-17T08:24Z
model: Cursor Grok 4.6
description: >-
  Item 5 timeout_secs: JSON integer or integer string only; floats fall back
  to 60; clamp 300. Matches #202.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #200 timeout integer rule

`bashTimeoutSecs` now matches the runner: accept a JSON integer or an
integer string (`"7"` → 7). Missing, 0, negative, any float (`7.5` and
`"7.5"`), and non-numeric values fall back to 60. Valid values over
300 clamp to 300. Tests cover a float number, a float string, and an
integer string. No Rust.

Localization: none — English only (C18).
PostHog: no event needed because this is timeout copy on the same card.
