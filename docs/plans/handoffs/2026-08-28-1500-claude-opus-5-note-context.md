---
session: 2026-08-28T15:00-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Chat can now see the note you have open, and any note can be handed to the
  agent by right-clicking it. Both verified in the running app — the agent
  named the open note and its contents with tools explicitly forbidden.
commits: 4aa3aa0, 1e20804
---

# The agent can see your note — stop here 2026-08-28

Continues
[2026-08-28-0300-claude-opus-5-model-allow-list.md](2026-08-28-0300-claude-opus-5-model-allow-list.md).

## The gap

Chat rendered a note beside the conversation and passed **nothing** about it to
the agent. `AiPanel` had accepted `activeEntry` / `activeNoteContent` all
along; `ChatHome` simply never supplied them — zero references in the file. So
"summarise this note", with the note open on screen, had no "this", and the
side-by-side view was decorative.

Reported by the user, who was right about the symptom and close on the cause:
they guessed a missing MCP feature. The *tools* are MCP and nothing was missing
there — the agent could already read any note with `get_note`. It just was
never told which one you were looking at.

## What shipped

**`4aa3aa0` — Chat feeds the open note to the agent.** The fetch lived inside
`ChatNotePane`, so the open note existed only inside a presentational
component. It moved to `useChatNoteContent`, owned by ChatHome: one read, two
readers — the pane renders it, the agent gets it as context. The hook keys the
body on its path, so a body never outlives the note it came from; the previous
note's text under a new title would be wrong on screen and wrong in the
agent's context.

**`1e20804` — "Ask the agent about this note" in the note context menu.** The
other direction: start from the vault instead of the conversation. Switches to
Chat and opens the note beside it, which is what makes the agent able to see
it. The request carries a `requestId`, not just a path — keyed on the path
alone, asking about the same note twice is a no-op once the pane has been
closed, and asking again is exactly what someone does when they closed it by
mistake.

Set during render, not in an effect: it is state derived from a prop, and
`pnpm lint`'s `react-hooks/set-state-in-effect` rejects the effect version
outright.

## Verified in the app

Rebuilt, relaunched, and driven end to end on `opencode/hy3-free`:

1. Right-clicked *Token routing and compression* — the action is there, first
   in the menu.
2. It switched to Chat, opened the note beside the conversation, and a
   `ctx · Token routing and compression` pill appeared in the composer. The
   composer already had a context slot; it now fills in, so you can see at a
   glance what the agent can see.
3. Asked which note was open and what it compares, **with tools explicitly
   forbidden**. The agent answered correctly — TokenJuice routes a tool result
   to a compressor, Switchyard routes a model request to a backend — and added:

   > I got this from the context snapshot already provided in my session (the
   > active note's title and body), so no tools were used.

That last sentence is the proof: the model said where the knowledge came from.

## Pick up here

- **C55 is still open** — the text-only-model warning does not fire. Unrelated
  to this work; the dead ends are recorded there.
- **#44 covers the resizable sessions sidebar** the user asked about — already
  filed 2026-08-27, still `needs-triage`.
- Prime harness coverage is **37 of 102 daemon commands**. The *why* is
  answered in [2026-08-22-prime-harness-coverage.md](2026-08-22-prime-harness-coverage.md);
  its 4-step sequence is only half done, and step 2 (a live-daemon test lane)
  is closer than tracked — six `#[ignore]`d live tests already exist in
  `prime_session_host.rs` with nothing to run them.
