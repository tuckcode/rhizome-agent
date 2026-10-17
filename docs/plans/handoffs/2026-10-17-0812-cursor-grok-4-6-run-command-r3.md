---
session: 2026-10-17T08:12Z
model: Cursor Grok 4.6
description: >-
  Round 3 HOLD: literal approval.args when call_id is present, Allow once
  ring-offset, hidden-char renderer on the result row, timeout clamp 300.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · round 3 HOLD on #200

When `call_id` is present, approval.args is the literal command for
display, Copy, and the result row. Tool-call input is the only JSON
`.command` parse. Unmatched call_id settles the old pending row.
Denied comes from the deny event. Timeout copy matches the runner
(default 60, clamp 300, numeric string "7"). Hidden-character
escaping covers Cf/Cc/Zl/Zp plus variation selectors and Hangul
fillers; CR is badged; the collapsed result row uses the same
renderer. Allow once and the result toggle use ring-offset-2 against
the card background. No Rust.

Localization: none — English only (C18).
PostHog: no event needed because this is the same approval surface.
