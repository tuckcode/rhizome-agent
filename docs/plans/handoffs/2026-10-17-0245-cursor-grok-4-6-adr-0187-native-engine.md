---
session: 2026-10-17T02:45Z
model: Cursor Grok 4.6
description: >-
  ADR-0187: native is the only chat engine; Prime and Hermes are
  optional ACP engines; core tool policy. Docs only.
---

# ADR-0187 — native is the only chat engine

**Origin:** Cursor Grok 4.6 · 2026-10-17 · docs / ADR only

Number is 0187 because open branch `docs/adr-0186-sign-in-storage`
already takes 0186. Do not reuse 0186. This ADR does not change
sign-in (ADR-0186).

## Decision

Rhizome's native loop is the only chat engine. No engine picker.
Prime and Hermes are optional ACP engines. Core tool policy is in
the ADR. Build order: registry, read/search, edit, shell, then route
new chats to native, then remove the picker. `install.sh` stays as-is.

## Files

- `docs/adr/0187-native-is-the-only-chat-engine.md`
- `docs/adr/README.md` (index row)
- `docs/adr/0168-selective-harness-doctrine.md` (one-line amendment)
