---
session: 2026-10-17T11:45Z
model: Grok 4.7 (Cursor)
description: >-
  Chat's default engine is Rhizome's native loop. An empty setting
  no longer means Prime. A saved prime value still selects Prime.
commits: this slice
---

# Native is the default Chat engine

**Origin:** Grok 4.7 (Cursor) · 2026-10-17

A fresh or empty `chat_engine` runs Chat on the native loop. Send is
allowed when Prime is not installed. Settings still stores `prime` when
the switch is off, and that value still selects Prime.

The bash approval card receives `command_from_args` output. The driver
already replaces the raw JSON before the native engine emits
`ApprovalRequested`. The new engine test pins that.

Chat does not lock that choice until Settings have loaded. A saved
`prime` value still selects Prime for the chat that opens after load.
A late Prime session-stats rejection does not call setState after
jsdom is gone.

Seed fixtures in `config_seed.rs` say Rhizome. The live `Is A` alias in
`frontmatter/keys.rs` is unchanged. Prime and Hermes engine code stay.
---
