---
type: ADR
id: "0165"
title: "Archiving a session is Rhizome's view, not a change to Prime's files"
status: active
date: 2026-08-21
---
## Context

The session list needed a way to get shorter. Measured on a real store, it
holds 93 logs — 16 different working directories, and 28 of them from temp
directories left by test runs. #28 called it unexplained clutter and #30 asked
what happens at 500.

The obvious reading of "archive" is that it does something to the file. That
reading is wrong here, and the reason is the same one behind ADR-0163.

`~/.prime/agent/sessions/` is **Prime's** directory. It is shared: the
`prime-agent` CLI writes there, and so does every other client on the machine
— `list_sessions` reads all of them and has no way to tell which came from
where, because the `session` header line carries no client field. Moving,
renaming or deleting a log to get it out of Rhizome's list would silently
change what *those other tools* show. Rhizome would be reaching into a shared
store to fix its own view.

A separate consideration: a session log is the only record of a conversation.
An "archive" that a user could confuse with deletion, over files Rhizome does
not own, is the kind of thing that has to be impossible rather than merely
discouraged.

## Decision

**Archiving records a session id in Rhizome's own `settings.json`, and touches
nothing on disk under `~/.prime`.**

- `Settings.archived_prime_sessions` holds the ids. Ids rather than paths: the
  id is Prime's own and survives a file moving.
- `list_prime_session_summaries` returns every session and *flags* the archived
  ones. It does not withhold them — the list renders them under a disclosure,
  so it needs them present, and restoring must not need a second round trip.
- An archived id whose log no longer exists is ignored, which is the normal end
  state of filing something and later deleting it in Prime.
- A settings read that fails leaves everything unarchived. Not knowing what was
  filed is a reason to show more, never to show nothing.

## Consequences

**Reversible by construction.** Nothing is destroyed, so "restore" is removing
a string from a list. There is no confirmation dialog because there is nothing
to confirm.

**Per-install, not per-vault and not synced.** Archiving on one machine does
not archive on another. This follows the file it lives in; if it later needs to
travel, that is a decision about settings sync, not about archiving.

**Other clients are unaffected**, which is the whole point. What the CLI lists
is what it listed before.

**The list gets shorter by curation rather than by virtualization.** #30's open
question was whether 500 rows needs windowing. Measured first, because the
instinct to optimise before measuring is what this repo got wrong about the
push gate: the backend summarises 500 logs in **12.4ms** and 2000 in **50ms**,
linear, with the 400-line scan cap doing the work — those 2000 synthetic logs
were 1.35 GB on disk. So the data layer never needed anything. Archiving
addresses the part that was actually a problem, which was clutter, not speed.
Virtualization stays unbuilt until a measurement asks for it.

**This does not delete anything, and deliberately offers no way to.** Deleting
a Prime session log is Prime's to offer, not Rhizome's — same boundary as
ADR-0163, where the daemon is not ours to stop.
