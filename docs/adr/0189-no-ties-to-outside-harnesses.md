---
type: ADR
id: "0189"
title: "No ties to outside harnesses; Prime and Hermes come out of Rhizome"
status: active
date: 2026-10-17
---

**Origin:** MyNAEga · 2026-10-17 · knispo
**Amends:** [ADR-0187](0187-native-is-the-only-chat-engine.md) decisions 3, 4 and 5, and the "optional engine" row of [ADR-0180](0180-rhizome-is-its-own-harness.md). The 0187 core tool policy and the 0180 borrowing rule are unchanged.
**Does not supersede:** [ADR-0177](0177-rhizome-is-a-client-of-harnesses.md). 0177 was already superseded by ADR-0180 on 2026-10-09 and stays that way.

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
4. **Saved choices move to native.** A saved Prime or Hermes engine
   choice becomes native on load, with tests. Old keys are still read so
   configs load. [#218](https://github.com/tuckcode/rhizome-agent/pull/218)
   did the `chat_engine` part; the rest comes with the engine removal
   (see Build order).
5. **Open Prime chats.** 0187 decision 3 (Prime-locked chats keep their
   lock) ends with the removal. Their history stays readable. Since #218,
   leftover Prime and Hermes chats show as Rhizome.
6. **Borrowing stays.** Ideas and code from other harnesses still come in,
   only through the 0180 borrowing rule: as a library or as a tracked copy,
   under a licence compatible with AGPL-3.0, checked before it lands.
   Credit and licence notices stay. A borrowed idea or a borrowed piece of
   code is not a tie: Rhizome never needs another harness installed or
   running.
7. **Not decided here.** The generic ACP client ([ADR-0178](0178-generic-acp-client.md))
   that lets a chat drive another agent CLI is a separate question. It stays
   as is until knispo makes that call.

## Build order

1. **Done: picker and settings removed.**
   [#218](https://github.com/tuckcode/rhizome-agent/pull/218) (G-baby,
   merged 2026-10-17) removed the Chat engine switch
   (`ChatEngineSettings.tsx`) and the Prime engine settings from Settings
   (the Advanced Prime card, Prime default model, model allow-list and
   provider status sections). Old links to the Prime settings section now
   open the AI section. Native is the only Chat engine.
   - **One-time migration.** Any leftover `chat_engine` value (`prime`,
     `hermes`, any case, or garbage) reads as `native`. `settings.rs`
     writes that back to disk once per process, best-effort: a failed
     write is logged and the settings still load. Settings saves now
     write `native`.
   - **Kept on purpose for now.** `default_ai_agent` set to Prime or
     Hermes is not migrated yet, because distill, inbox and jobs still
     read it. Saved `agent:prime` / `agent:hermes` chat targets stay, and
     the workspace shows them as Rhizome. Codex, Claude Code and the other
     CLI targets, and `model:` targets, are unchanged.
   - Cmd+K offers **Use Rhizome instead** when the chosen agent is
     missing.
2. **Next: engine code removal in small PRs, owned by G-baby.** Move
   distill, inbox and jobs off `default_ai_agent` / Prime onto native,
   then migrate that key and the leftover targets. Then remove the Prime
   Rust engine, frontend event handling and session code, the parked
   Prime settings components, bundled resources, and `install.sh` steps,
   and the Hermes option. Each PR recounts `prime` and `hermes` mentions.
3. **What is left on purpose:** ADR and docs history, changelog entries,
   credit and licence lines.

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
