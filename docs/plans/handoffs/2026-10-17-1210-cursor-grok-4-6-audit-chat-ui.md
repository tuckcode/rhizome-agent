---
session: 2026-10-17T12:10Z
model: Cursor Grok 4.6
description: >-
  Chat UI audit 1, 3, 19, 18: pending approvals stay visible, native top bar,
  session title header, centered empty state with starters.
commits: cursor/audit-chat-ui-2269
---

# Chat UI audit items 1, 3, 19, 18

**Origin:** Cursor Grok 4.6 · 2026-10-17 · browser mock audit, UI-only.

## Cause

3. `ChatHome` mounted `PrimeSessionSubhead` only when `showPrimeChrome` was
   true, and that flag required `effectiveEngine === 'prime'`. Native hid the
   header and Command Palette. The strip is now `showChatTopBar` (Prime chat,
   not an API-model takeover). Activity bands and Prime composer banners stay
   on `showPrimeChrome`.

1. Tool use started collapsed (`useState(false)`). Approval cards lived only
   in the expanded list, so Allow/Deny were hidden. The group now opens when
   a pending approval is present, and the collapsed row keeps the same
   Allow/Deny controls. VisibleCommand / `ApprovalRequested.args` / `call_id`
   matching were not changed.

19. The header read only `primeHost.sessionPath`. Mock host has no path, and
   native never polls Prime, so the title stayed "New chat". Chat now also
   reads the open session path (native list included) and the first user turn
   until a list title exists.

18. The empty copy sat at the top of a column with no height, in small muted
   text, and named Prime. It is now a centered "Ask Rhizome" heading, one
   Rhizome line, and three starter buttons that prefill the composer.

## Review shots

`docs/review-shots/audit-chat/`, captured like `docs/review-shots/run-command/`.

## Gates

`pnpm test`, `pnpm typecheck`, `pnpm lint`. Localization: none — English only (C18).
PostHog: no event; starters only prefill. No Rust. No engine default change.
