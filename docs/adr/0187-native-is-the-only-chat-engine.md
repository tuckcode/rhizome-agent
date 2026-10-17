---
type: ADR
id: "0187"
title: "Native is the only chat engine; Prime and Hermes are optional ACP engines; core tool policy"
status: active
date: 2026-10-16
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · knispo
**Builds on:** [ADR-0180](0180-rhizome-is-its-own-harness.md) (9 Oct: Rhizome is its own harness with its own agent loop)

## Context

[ADR-0180](0180-rhizome-is-its-own-harness.md) made Rhizome its own harness
and left Prime and Hermes as optional engines. The UI still has a chat
engine picker (`ChatEngineSettings.tsx`, `chat_engine`) and
`PrimeModelPicker`, so Prime is still a first-class chat engine.

[ADR-0168](0168-selective-harness-doctrine.md) still names Prime as the
only execution core. ADR-0180 already dropped the ban on a Rhizome-owned
loop. This ADR finishes that lock: native is the chat engine.

[ADR-0177](0177-rhizome-is-a-client-of-harnesses.md) (client of harnesses)
is already superseded by 0180.

[ADR-0176](0176-settings-sign-in-through-prime-auth-storage.md) routed
Settings sign-in through Prime AuthStorage. ADR-0186 (open on
`docs/adr-0186-sign-in-storage`) keeps Rhizome's own sign-in storage and
leaves Prime login as a fallback for the Prime engine. This ADR does not
change sign-in. Native chat uses Rhizome's keys. Prime login stays for
the optional Prime ACP engine.

## Decision

**Rhizome's native loop is the only chat engine. Prime and Hermes are
optional outside engines through ACP. There is no engine picker.**

1. **Native is the only chat engine.** knispo, 2026-10-16: make Rhizome's
   engine the default once it can do what a coding harness is expected to
   do; build the core tools first, then switch. He also okayed native as
   the only chat engine with no engine picker, built after the core tools
   series.
2. **Retire the picker.** `ChatEngineSettings.tsx`, the `chat_engine`
   setting, and `PrimeModelPicker` go. `settings.rs` still reads an old
   `chat_engine` value so existing configs load. Nothing writes it.
3. **Open chats stay.** Chats already open and locked to Prime keep that
   lock until closed. ACP agent chats that drive another CLI are
   unchanged.
4. **Prime and Hermes via ACP only.** They are reachable only as optional
   outside engines through ACP ([ADR-0178](0178-generic-acp-client.md)).
   Prime packages stay under Advanced (per ADR-0180).
5. **Out of scope / on hold:** making Prime optional in `install.sh`.
6. **Core tool policy** for the native engine:
   - Tools come from a registry. An unknown tool returns an error and
     never matches a session grant (always asks).
   - Read/search (`read_file`, `list_dir`, `grep`, `glob`) run without
     asking in both modes, locked to open vault paths and the workspace
     root. Paths are resolved before the check (no `..` or symlink escape).
   - Edit (`edit_file`, `write_file`) ask every call in Limited mode with
     Allow once / Deny, and run without asking in Power User. Vault writes
     go through the `create_note` path.
   - `bash` is never offered in Limited mode. In Power User it asks every
     call; a session grant covers only that exact command. It runs in the
     workspace folder with a timeout, output cap, cleaned environment, and
     is killed on cancel.

**Build order:** core tools series (registry, read/search, edit, shell),
then a PR that routes new chats to native, then picker removal.

## Options considered

- **A (chosen):** native-only chat, no picker; Prime and Hermes optional
  ACP engines. Matches the 9 Oct identity and the 16 Oct call.
- **B:** keep the picker; native as default. Rejected: knispo okayed no
  picker after the core tools series.
- **C:** drop Prime from the product, including `install.sh`. On hold
  (decision 5).

## Consequences

- New chats go through the native loop after the core tools series. This
  ADR does not implement that.
- Sign-in stays ADR-0186. This file does not reopen Prime AuthStorage vs
  Rhizome keychain.
- ADR-0168's "Prime is the only execution core" lock is superseded here.
  Borrow-care still holds.
- ADR-0178 remains the ACP client path for optional engines.

## Advice

knispo, 2026-10-16. Builds on the 9 Oct call (ADR-0180).

[[0180-rhizome-is-its-own-harness]]
[[0168-selective-harness-doctrine]]
[[0178-generic-acp-client]]
[[0176-settings-sign-in-through-prime-auth-storage]]
[[0177-rhizome-is-a-client-of-harnesses]]
