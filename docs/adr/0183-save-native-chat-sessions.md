---
type: ADR
id: "0183"
title: "Save native chat sessions"
status: active
date: 2026-10-10
---

**Origin:** ChatGPT draft · 2026-10-10 · plan step 2c
**Decisions confirmed:** knispo · 2026-10-10 · size limits and secrets policy below

## Context

[ADR-0180](0180-rhizome-is-its-own-harness.md) makes Rhizome its own
harness. Plan step 2c
([`docs/plans/2026-10-10-harness-remaining-threads.md`](../plans/2026-10-10-harness-remaining-threads.md))
requires a native chat to reopen and continue after the app restarts.
Reading old turns is not enough. The saved history includes tool
results, such as shell output and note contents, which may contain
secrets.

Nothing is written under `~/.prime`. The vault stays the one memory
authority. This ADR decides the on-disk session log. It writes no
product code.

## Decision

**Each native session uses one append-only file in the app config
folder.** Append-only means existing records do not change. Each line
contains one complete record, with a sequence number and a checksum to
detect damage. The implementation home is
`<app config dir>/native-sessions/<session_id>.jsonl`, through
`app_config::preferred_app_config_path`.

**Recovery and permissions.** A turn without a completion record
reopens as cancelled. The app does not repeat its tools automatically.
Pending approvals and permission grants are never restored. Show:
"Earlier permissions no longer apply. Approve new actions before
continuing."

**Secrets.** Store account keys in the operating system's protected
keychain, never in session files. Remove known credentials and
sensitive fields before saving any content. Apply this filter to
messages and tool results. Restrict file access to the current user.
Unknown secrets in shell output or notes may escape filtering, so do
not promise secret-free logs.

**Two windows.** The native engine owns all writes. Both windows may
display the session, but only one turn may run at a time. Reject a
second turn with a clear message. A process lock prevents another app
instance from writing the same file.

**Damage.** Stop at the first invalid line, whether damage occurs at
the end or in the middle. Display only the verified prefix and warn
about missing history. Preserve the original file. Continue in a new
session containing the verified history. Never skip damaged lines and
assume later records are safe.

**Size.** 100 MiB per session log. 1 MiB per tool result. Mark
shortened results clearly. Reserve space for cancellation and
completion records. Before the session reaches its limit, require a
new session. Do not silently remove history.

**Key migration (step 3).** Move each existing key separately. Write it
to the keychain and verify retrieval before removing its old copy.
After a crash, repeat safely: verify the keychain value, then finish
removal. If verification fails, retain the old copy and report the
failure. Never log key values.

## Options considered

- **Option A** (chosen): one append-only file per session. Rewriting
  the whole session simplifies reading but increases crash exposure. A
  database supports richer queries but adds machinery. Append-only
  files fit this scope.
- **Option B — skip damaged lines:** could recover more text, but could
  also restore an inconsistent conversation. Rejected.
- **Option C — encrypt the log, or let the user pick exclusions, before
  release:** rejected. Ship the known-credential filter. Stay honest
  that it cannot catch every secret.

## Decisions

knispo, 2026-10-10. Coding agents treat these as settled. The repo ADR
status values are `proposed | active | superseded | retired` (no
Accepted). Status is `active`.

1. **Size limits.** 100 MiB per session log. 1 MiB per tool result.
   Truncated results are marked. A session that would exceed the cap
   must start a successor. History is not silently dropped.
2. **Secrets before release.** No encryption. No user-picked
   exclusions. Ship the known-credential filter on messages and tool
   results. The filter cannot identify every private value, and this
   ADR does not claim otherwise.

The recovery, two-window, damage, and key-migration rules in
[Decision](#decision) are also settled.

## Consequences

- Chats survive restarts with explicit cancellation and renewed
  permissions.
- Recovery may lose recent records or everything after middle damage.
- Large sessions require a successor.
- Filtering reduces credential exposure but cannot identify every
  private value.
- Step 2c implementation follows this ADR. Step 3 follows the
  key-migration crash rule.

## Advice

ChatGPT drafted this ADR on 2026-10-10. knispo approved it the same
day and answered the two open questions with the rows in
[Decisions](#decisions).

[[0180-rhizome-is-its-own-harness]]
[[0182-free-tier-provider-routing]]
