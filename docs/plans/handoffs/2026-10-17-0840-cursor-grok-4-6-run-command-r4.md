---
session: 2026-10-17T08:40Z
model: Cursor Grok 4.6
description: >-
  Round 4 HOLD: timeout_secs is a JSON u64 whole number only; strings fall
  back to 60. Collapse only space and newline in truncateCommand. Superseded
  label. Badge NBSP. break-words.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · #200 round 4 HOLD

Timeout copy matches #202 at f413535 (`shell.rs` `timeout_from_args`):
only a JSON whole number that fits u64. Strings (`"7"`, `" 7 "`), floats,
`7.0` (detected from the raw token), `1e20`, 0, negatives, booleans, and
missing values fall back to 60. 301 clamps to 300. After JSON.parse a
`7.0` literal cannot be told apart from `7`. No Rust.

Collapsed rows keep `\r`, tab, U+2028/2029, and U+FEFF so VisibleCommand
can badge them. NBSP is badged. Settled unmatched call_id rows say
Superseded. Command wrap uses `break-words`.

Localization: none — English only (C18).
PostHog: no event needed because this is timeout copy and row labels.
