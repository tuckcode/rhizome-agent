---
session: 2026-08-22T11:00Z
model: Claude Opus 5
also: [Cursor Composer]
description: >-
  Windows named pipe landed (Cursor) and its roster hang fixed; the six ignored
  live-daemon tests run for the first time and two were stale from the night
  before; C32 closed so the architecture docs finally mention Prime; a UX sweep
  driven as a user found a silent screen-reader bug, a dead button, and a
  session-select regression. #31–#39 opened.
commits: 4b08a6d..4cddbc1
---

# 2026-08-22 — Windows, a UX sweep, and what Rhizome actually is

**State:** `main` at `4cddbc1`, tree clean, all gates green. Two daemons were
running during this session; both stopped.

### Windows — landed by another agent, then fixed

`1922a27` came from **Cursor Composer** on the Windows machine and implemented
#32: `File` + `WaitNamedPipeW` on `\\.\pipe\prime-agent-daemon`. The approach
was right and the Unix path was untouched.

Review found one real bug, fixed in `326930b`. `read_roster_over` checks its
deadline *between* reads, and a blocking read is never interrupted by that
check — on Unix `set_read_timeout` bounded the read itself, and a named pipe
opened as a `File` has no equivalent. A daemon that accepts and goes silent
parked `list_running_sessions` forever, which is a Tauri command, so the
worker thread never returned. The timeout now lives on the **wait**
(`recv_timeout` on a channel, matching every other call in the file), and
`ROSTER_IN_FLIGHT` caps the unkillable parked reader at one.

**Provenance gotcha worth knowing:** AGENTS.md's
`git log --pretty=…%(trailers:key=Co-Authored-By…)` under-reported this
commit. Cursor wrote `Co-authored-by:` lowercase on the second trailer, and
git's key match is case-sensitive, so the command showed only `tuckcode`. The
documented provenance command is not reliable as written.

### The live-daemon tests ran for the first time

Six `#[ignore]`d tests existed and nothing had ever run them. Three failed —
**two because of this author's own lazy-session change the night before**
(`ensure_host` no longer returns a session id, and `settle_session_on_quit`
correctly reports `NotConnected` for a host holding nothing). Fixed in
`648051a`; 5 of 6 now pass against a real 0.7.4 daemon, including one that
prompts a model and reads the reply back. The sixth needs pre-existing
scheduled work, its own documented precondition.

**Not scripted into a lane on purpose — C39.** The run leaked six husk
sessions into the real `~/.prime/agent/sessions`: the env override isolates
the socket, but tests that reconnect fall back to the default daemon.
Shipping a lane that creates the litter #28 removed is a bad trade. C39 also
records how to start an isolated daemon, which is non-obvious: the supervisor
`lstat`s the socket *before* binding, so it cannot cold-start on a path that
never existed, and `AF_UNIX` caps near 104 chars.

### C32 closed

`ARCHITECTURE.md` and `ABSTRACTIONS.md` had **zero** mentions of Prime while
`prime_session_host.rs` is ~5,600 lines. Written from the session that had
just re-derived it all, which was the point. The lead is the thing that
matters: Prime is a **daemon client, not a subprocess**, which makes the
`cli_agent_runtime.rs` model documented directly above it actively
misleading.

### The UX sweep, driven as a user

Four defects, all invisible to a green suite:

- **`9d8a245` — arrowing the note list was silent for a screen reader.** The
  listbox is correct in every respect except that rows had no `id`, so
  `aria-activedescendant` could not be set. Focus stays on the container by
  design, so nothing else announces the move. Fixed with encoded stable ids.
- **`4cddbc1` — picking a session closed the sessions column** and looked
  like it did not open the session. The close was overlay-era code left
  behind when the list became a sidebar. The "did not open" half was the
  *mock* returning `[]` for the transcript.
- **`708e3a7` — id suffixes on rows the meta line already told apart.** #30
  shipped the suffix and the place label an hour apart and the second made
  the first redundant.
- **#37 — "Save as custom" in the research modal has no `onClick` at all.**
  Never wired, no storage behind it. A sweep for other dead buttons found
  **exactly one**, so the codebase is otherwise disciplined.

Requested and shipped: `ec3312a` marks the user's turn with an accent rule at
a fixed x, because the old `--state-hover` tint was a 4% luminance difference
from the page; `5b11be0` shows the clock time when saved and created fall on
the same day, instead of printing one date twice.

**The mock keeps hiding bugs.** Three times in two days a defect was
invisible in `pnpm dev` because a handler returned nothing —
`set_prime_session_archived`, `list_prime_running_sessions`,
`read_prime_session_transcript`. All three now return real data. A mock
handler that returns nothing does not fail; it makes a feature look unbuilt.

### The open question this session ended on

Prime and Hermes are **both full agent harnesses**, and both MIT. Rhizome
integrates Prime deeply — daemon socket, sessions, ADR-0163 — and runs
**Hermes as a one-shot subprocess** (`hermes chat --quiet`, line-streamed),
despite Hermes shipping an `acp_adapter/` with `server.py`, `session.py`,
`permissions.py`, `edit_approval.py` and `provenance.py`. That is a full
harness used at a fraction of its capability, through the same shallow path
as a model wrapper.

So: **is Rhizome a harness, or a client of harnesses?** ADR-0163 already
answered it for Prime — Rhizome does not own the agent loop. If that is the
identity, then ACP is worth investigating as the standard way to integrate
the others, rather than a bespoke path per agent.

Left unanswered deliberately. It is a product decision, not an implementation
one.

### Open

- **#39** is the differentiator idea with the most behind it: make the graph an
  agent tool. Measured motivation — the real vault is **155 notes, 85 orphans
  (54%), 29 dead links**. `rhizome_graph_summary` already exists but returns
  prose, globally, one question. The gap is a *queryable* graph.
- **#38** composer pills look like controls and are inert; the model picker
  sits in the top bar (consumer-chat convention) rather than by the composer
  (harness convention). One change fixes both.
- **#35** verbose modifier — three possible meanings, filed `needs-info`.
- **#32** still needs a real Windows check; **#29** redaction; **#34** session
  search; **#36** timezone setting; **#37** dead button.
- C39, C37, C33's 150-file exclusion list.

---
