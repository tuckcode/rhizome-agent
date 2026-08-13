# Spec — Prime session list

Status: agreed 2026-08-13. Supersedes the "session list" line item in
`docs/HANDOFF.md`'s roadmap, which assumed an RPC that does not exist.

## Problem

Prime sessions are invisible in the app. You can talk to the live one and
nothing else — no list of past conversations, no way back into one. The
roadmap called this "session list — `switch_session`, `fork`, `clone`,
`set_session_name`", which framed it as four RPC calls. It is not.

## What the probe actually found

Verified against the live `prime-agent --mode rpc` binary, 2026-08-13:

- **`list_sessions` does not exist.** Enumeration is a directory scan of
  `~/.prime/agent/sessions/*.jsonl`. `mycelium.rs:34` already does exactly
  this, and `MyceliumView.tsx:47` already consumes it.
- **`get_messages` is not sufficient** — see C23. On one host process,
  `agent_end` carried both roles while `get_messages` returned only the user
  message. It also only ever describes the *live* session, which is the wrong
  scope for a list.
- **The on-disk `.jsonl` is a full event log.** A real 2.4 MB session held
  `session` ×1, `message` ×375, `model_change` ×5, `compaction` ×1,
  `session_state` ×3, `agent_status` ×2125. Message lines carry
  `{type, id, parentId, timestamp, message}`.
- **`switch_session` exists and takes a path** — it failed with
  `paths[0] argument must be of type string`, which is a filesystem path
  error, not a session-id error.
- **`fork` exists and wants an entry id** — `Invalid entry ID for forking`.
  The `id` on each message line is the obvious candidate.
- Also present: `set_session_name`, `observe`, `set_thinking_level`,
  `set_model`, `get_available_models`, `cycle_model`. `clone` unverified.

## Decisions

**1. The transcript comes from the on-disk `.jsonl`, not the RPC.**

It is the only source that describes a session the app is not currently
running — which is the entire point of a list you can switch into. It is also
strictly richer: `parentId` gives the fork lineage, and `model_change` /
`compaction` lines explain discontinuities a naive transcript would render as
the model contradicting itself.

The cost is real and accepted: we parse a format we do not own. Contain it —
one module, one parse, fixtures captured from a real session so a format drift
fails loudly in tests rather than quietly in the UI.

**2. One session-reading module, two views.**

Mycelium and the session list read the same sessions for different reasons —
"visualize this run" vs "resume this conversation". Extract the read path;
keep the views separate. Neither a second scanner (they drift) nor one merged
view (it conflates two jobs).

Shape: a `prime_sessions` module owning *enumerate* and *read one transcript*.
`mycelium.rs` keeps bridging and Mindwalk detection and calls into it.

**3. v1 is list + switch. Nothing else.**

This is a tracer bullet: it exercises the whole path — scan → parse → rehydrate
→ render → switch the live host — and every later feature hangs off machinery
it proves. The others are deliberately out:

- **Rename** is genuinely small, but it tests nothing new architecturally. It
  is the obvious next slice, not part of the bullet.
- **Fork** is the most valuable and the least understood. It needs the
  entry-id story settled (are message `id`s the entry ids `fork` wants?) and a
  UI answer for "branch from *where*". Its own slice, after the tree is being
  parsed and rendered anyway.
- **Delete/archive** has no RPC, so it means mutating files under `~/.prime` —
  someone's real conversation history, from a directory we do not own. Not in
  a first slice, and probably not without an explicit confirm.

## v1 behaviour

Enumerate sessions newest-first, grouped by time (Today / Yesterday / This
week / older). Each row: name, when, and enough of the opening message to
recognise it. Selecting one rehydrates its transcript into the chat panel and
calls `switch_session` so the live host follows.

Session **name**: prefer the `session` line's name if it carries one; fall
back to the first user message, truncated. Never show a raw UUID as the
primary label — the filename is a UUID and it identifies nothing to a human.

**Large sessions are the normal case, not the edge.** 2.4 MB and 2125
`agent_status` lines in one real session. Enumeration must not parse whole
files — read only what the row needs. The transcript parse must skip
`agent_status` early.

## Slices

1. **`prime_sessions` module + enumeration.** Move the scan out of
   `mycelium.rs`, add name/preview derivation without reading whole files.
   `mycelium.rs` calls into it; `MyceliumView` unchanged in behaviour.
2. **Transcript parse.** `.jsonl` → the same `PrimeMessage` shape
   `get_messages` already returns (landed `cbd2c46`), so the frontend has one
   transcript type. Fixture from a real session. Handle `compaction` and
   `model_change` as first-class, not noise.
3. **Session list UI.** Grouped list, rehydrate on select.
4. **Switch.** Wire `switch_session` with the file path; reconcile host state
   after.

Ordering note: 1 and 2 are independently testable and land before any UI.

## Answered since (probes, 2026-08-13)

**`switch_session` takes `sessionPath` — the full log file path.** Not `path`,
not `sessionId`; those and nine other names all fail identically with a
`paths[0] … undefined` error that names no parameter. Verified working: after
switching, `get_state.sessionId` becomes the target session's id.

**C23 was half wrong, and the correction matters.** `get_messages` *does*
return a full conversation — 125 messages after switching into a real session.
The original finding (only the user message) was a **fresh session mid-turn**:
it reflects *persisted* history, and a just-finished turn is not persisted at
the moment you ask. It is not broken.

What is true, and is the better reason for the disk decision: **`get_messages`
returns post-compaction working history, the disk log holds everything.** The
same session gives 125 via RPC and 375 message lines on disk, because a
compaction dropped the rest. Those are two different things and both are
legitimate — "what the model still remembers" vs "what was actually said". A
transcript the user scrolls back through wants the second. The disk decision
stands, on firmer ground than the one it was made on.

**A session has five roles, not two:** `user`, `assistant`, `toolResult`,
`custom`, `compactionSummary`. Tool results are their own messages, not blocks
inside assistant messages. `compactionSummary` carries no `content` at all —
it has `summary`, `tokensBefore`, `retainedMessageCount`.

**`model_change` is flat** — `{provider, modelId}`, no nested `model` object
and no display name. The first parse of it guessed wrong and every fixture
test passed; there is now an `#[ignore]`d real-log test (`PRIME_SESSION_LOG`)
because hand-written fixtures only ever prove the parse matches its author's
reading of the format.

## Still open

- What does `switch_session` do to a *streaming* host? Still unprobed. Do not
  find out in production — the steering work established this instinct.
- Are message `id`s the entry ids `fork` wants? Answer before the fork slice.
- Is the sessions directory stable across Prime versions? It is not our
  directory.
- `thinking_level_change` is a fifth line type, currently ignored by the
  replay. Harmless, but it is a real state change a transcript could show.

## Closes

**C23** — this is the answer: the transcript comes from disk. `get_messages`
stays as landed, correct for the live session, no longer load-bearing for
rehydration.
