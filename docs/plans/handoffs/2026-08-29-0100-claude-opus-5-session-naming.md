---
session: 2026-08-29T01:00-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Sessions now name themselves from their first exchange and store that name
  in Prime, so every client reads the same one. A user rename still wins.
  The list also stops printing Rhizome's own placeholder as if it were a name.
commits: 8087091, f57d85e
---

# Sessions name themselves — 2026-08-29

**Origin:** Claude Opus 5 (Claude Code) · 2026-08-29 · `8087091`, `f57d85e`

## What changed

Issue #49 step 2. A session used to keep the placeholder Rhizome wrote at
creation — `Rhizome · <vault> · <id tail>` — for its whole life, and the list
papered over that by re-deriving a label from the first message on every
render. That is why rows read `/prime-intellect` or `hi'`: faithful to the
first line, useless as a name, and different in every client.

Now, after the first turn completes, the placeholder is replaced **once**,
through `set_session_name`, so the name lands in Prime's own log. The name is
what the user asked; for the sessions nobody typed in (7 of 31 on this
machine) it is the agent's opening line instead.

Rules, each from a real row in the list:

- A slash command names the command, not the session: `/prime-intellect` →
  `prime-intellect`.
- One sentence, not a paragraph — a pasted brief should not title everything
  that follows it.
- The user's words beat the agent's.
- Under 8 characters is worse than no name: `hi` tells you less than the
  timestamp already beside it. That turn leaves the placeholder, and the next
  turn can still earn a name.
- Cut at a word boundary at 60 characters, with an ellipsis.

**A name a person chose is never overwritten.** Only a name starting
`Rhizome · ` is replaceable (`is_rhizome_placeholder_name`), and rejoining a
running session reads its stored name off the `list` row before deciding it is
still ours to rename. Rename from the sessions list still wins permanently.

## Two bugs found on the way

**Version numbers were sentence breaks.** `split_terminator(['.', …])` cut
"Draft the release notes for 0.8" to "Draft the release notes for 0", and
would have done the same to any filename. `first_sentence_of` now treats a
full stop as terminal only when a space or the end of the text follows it.

**The list showed the placeholder as a deliberate name.** `summarize_lines`
treats any `session_info.name` as a choice that beats a derived title — true
for `prime-agent rename` and for the sessions list's own rename, false for our
placeholder, which exists so the daemon has a unique handle. It now loses to
anything the session is about, and stands only when there is nothing to derive
from (still better than "Untitled session" — it at least names the vault).
This also means **old sessions read better immediately**, without any backfill.

## Where the code is

- `src-tauri/src/prime_session_host.rs` — `session_title_from_exchange`,
  `title_candidate`, `first_sentence_of`, `is_rhizome_placeholder_name`,
  `PrimeHost::name_session_from_exchange`, the `name_is_placeholder` field,
  and the `ResumableSession { id, name }` returned by
  `find_resumable_session`. The rename fires after `Done` in
  `run_prompt_stream`, so it never delays a reply.
- `src-tauri/src/prime_sessions.rs` — the placeholder demotion in
  `summarize_lines`.

## Tests

1691 Rust tests green. Seven are new: the naming rules (user beats agent, a
greeting is not a name, a long request is cut at a word, a full stop inside a
number does not end the name, only our own placeholder is replaceable) and two
against the fake daemon (the first exchange sends a second `set_session_name`
with the right payload; a second turn sends no third one).

## Step 3, still open

Nothing rewrites the **stored** name of sessions that predate this. Their
titles now derive correctly, so the list already reads right — the open
question is whether a one-time backfill through `rename_saved_session` is
worth it so other clients see the same names, or whether derived titles are
enough. Left undecided deliberately: a backfill writes to every log in
`~/.prime/agent/sessions` and is not obviously wanted.

## Not done

- **C55** — the text-only-model warning still does not fire in the app.
- **C56** — two live-daemon tests still fail (`pnpm test:live-prime`).
- **#44** — the Notes panel and the Mycelium list are still not resizable; the
  Notes panel needs a decision about how a drag interacts with
  `useShellCompactLayout`.
