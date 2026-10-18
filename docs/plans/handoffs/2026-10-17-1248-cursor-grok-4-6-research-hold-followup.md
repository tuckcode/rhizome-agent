---
session: 2026-10-17T12:48Z
model: Cursor Grok 4.6
description: >-
  HOLD follow-up on #208: reset scan attempt, Generate hint as tooltip,
  consume retry focus, Architecture map name, Details hidden, collapse
  on new attempt, generate-enabled shots.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · Ricky/Critiquito re-check of #208

1. `libraryScanAttempt` resets on a successful scan and when the vault
   key changes. Fail /vault, succeed /other, fail /third is Attempt 1.
2. The visible Generate hint is gone. The disabled button has `title`
   and `aria-describedby` to an `sr-only` description.
3. `retryFocusRef` is consumed at scan start and cleared on failure, so
   a later vault-switch scan does not focus the heading.
4. Architecture map has no overriding `aria-label`. The visible label
   is the accessible name.
5. Details `<pre>` stays mounted with `hidden` when closed.
6. Details collapse when a new attempt starts (`useEffect` on attempt,
   plus the banner remount).
7. Review shots add `{graphite,earth}-generate-enabled.png` and
   re-shoot the disabled-Generate pair.

Localization: none — English only (C18).
PostHog: no event needed because this is scan-attempt reset, focus,
and a tooltip move.
