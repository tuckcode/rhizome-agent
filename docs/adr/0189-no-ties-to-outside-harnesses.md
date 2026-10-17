---
type: ADR
id: "0189"
title: "No ties to outside harnesses; Prime and Hermes come out of Rhizome"
status: active
date: 2026-10-17
---

**Origin:** MyNAEga · 2026-10-17 · knispo
**Amends:** [ADR-0187](0187-native-is-the-only-chat-engine.md) decisions 3, 4 and 5, and the "optional engine" row of [ADR-0180](0180-rhizome-is-its-own-harness.md). The 0187 core tool policy and the 0180 borrowing rule are unchanged.

## Context

[ADR-0180](0180-rhizome-is-its-own-harness.md) made Rhizome its own harness
and left Prime and Hermes as optional engines. [ADR-0187](0187-native-is-the-only-chat-engine.md)
made native the only chat engine, removed the picker, and kept Prime and
Hermes as optional outside engines through ACP. It put dropping Prime from
the product on hold (0187 option C, decision 5).

On 2026-10-17 a count of `prime` on main found it in 376 files. Most of
those are not leftover names. They are the Prime engine itself: its
settings, event handling, model picker, sessions, bundled resources, and
`install.sh` steps. Hermes appears in 69 files.

## Decision

**Rhizome is tied to no existing harness. Prime and Hermes come out of the
product completely. Rhizome's own engine is the only engine.**

knispo, Builders room, 2026-10-17 about 3:59 AM CT, answering whether to
remove Prime entirely or just the picker:

> "Yeah, I'm kind of thinking no tie to any existing harness and let rhizome
> speak for itself. We make our own harness off of what we like from the
> others plus our own implementations."

1. **Prime goes.** Its engine code, settings (including the Advanced Prime
   card), model picker, event handling, session code, tests, bundled
   resources, and `install.sh` steps are removed. This lifts the 0187 hold
   on option C.
2. **Hermes goes.** The Hermes engine option and its settings are removed.
3. **No optional engine slot.** There is no setting that points chat at an
   outside harness. 0187 decision 4 and the 0180 "optional engine" row no
   longer hold.
4. **Saved configs migrate once.** A user with Prime or Hermes saved is
   moved to the native engine on first launch, with a test. Old keys are
   still read so configs load; nothing writes them.
5. **Open Prime chats.** 0187 decision 3 (Prime-locked chats keep their
   lock) ends with the removal. Their history stays readable.
6. **Borrowing stays.** Ideas and code from other harnesses still come in,
   only through the 0180 borrowing rule: a library or a tracked copy,
   under a licence compatible with AGPL-3.0, checked before it lands.
   Credit and licence notices stay. A borrowed idea is not a tie.
7. **Not decided here.** The generic ACP client ([ADR-0178](0178-generic-acp-client.md))
   that lets a chat drive another agent CLI is a separate question. It stays
   as is until knispo makes that call.

## Build order

1. Dank.bot's Chat switch makes native the default for new chats.
2. G-baby's picker PR removes Prime and Hermes from Settings and adds the
   one-time migration.
3. Engine code removal in small PRs (Rust engine, frontend event handling,
   resources, `install.sh`), each recounting `prime` and `hermes` mentions.
4. What is left on purpose: ADR and docs history, changelog entries, credit
   and licence lines.

## Options considered

- **A (chosen):** remove Prime and Hermes completely. Matches the 17 Oct call
  and leaves no code that nothing runs.
- **B:** keep Prime and Hermes as optional engines with no picker (0187 as
  written). Rejected by knispo on 17 Oct.

## Consequences

- Rhizome no longer depends on Prime being installed or running. ADR-0163
  (connect to the Prime daemon) and ADR-0176 (sign-in through Prime
  AuthStorage) become retired once the engine code is gone.
- Users who relied on Prime or Hermes lose them; the migration moves them
  to native.
- Later work is held to this ADR: a PR that adds a new dependency on an
  outside harness as an engine needs a new ADR first.

[[0180-rhizome-is-its-own-harness]]
[[0187-native-is-the-only-chat-engine]]
[[0178-generic-acp-client]]
[[0163-connect-to-the-prime-daemon]]
[[0176-settings-sign-in-through-prime-auth-storage]]
