# Session status — 2026-08-16 (Claude Opus 5 + 5 Sonnet subagents)

Long session. Started as "run pre-push and push 7 stuck commits," ended with
the slash-menu arc closed, four Prime integration bugs found, and two new
C-numbers.

## Shipped

| Issue / thread | State |
|---|---|
| **#10** slash command menu | **CLOSED** — verified live against a real daemon |
| **#16** command sourcing | **CLOSED** — 89 personal skills correctly excluded |
| **#19** one version indicator | Built. Rhizome's half is dormant (see below) |
| **#20** goal set/replace/clear | Built + live round-trip |
| **#15** goal display | Was already "shipped" — **its data source was dead**, now fixed |
| **#21** argument hints | Built, **renders nothing on 0.7.2** — issue left OPEN |
| **C27** Rust coverage gate | RESOLVED — was failing on `origin/main` itself |
| **C28** smoke flakiness | RESOLVED — real cause was an auto-navigation race |
| **C29** Cmd+N note list | **OPEN** — diagnosed, fix stashed not shipped |

## The one lesson worth carrying forward

**Prime's documented behaviour and Prime's actual behaviour diverged four
separate times today.** Every time we probed the live daemon first, we were
right. Every time we trusted docs or assumed symmetry with a neighbouring
feature, we were wrong.

1. **`export`** — assumed a protocol call like `fork`/`compact`. It is absent
   from `serverCapabilities` entirely; it exists only as
   `prime-agent session export <file>` over a file on disk.
2. **`argumentHint`** — assumed skills carry it. Only `source: "prompt"`
   entries do; skill entries are built without the field
   (`dist/modes/agent-connection/snapshot.js`).
3. **`sessionFile`** — assumed always present in state. It arrives on only
   some payloads, so a live session can have an id and no path. This silently
   disabled `/export` in the UI.
4. **`get_state.goal`** — #15 read goal state from `get_state`. The daemon
   never sets that key; it is RPC-mode only. Correct command is
   `get_connection_state`, and the field names differ too
   (`tokenBudget`/`tokensUsed`, not `remainingTokens`). **#15's goal band had
   been rendering nothing since it shipped.**

**Rule for the next session: before building anything Prime-facing, probe the
running daemon and read the installed source under
`~/.local/lib/node_modules/prime-agent/dist/`.** It costs ~30 seconds and
would have caught three of those four.

## Subagents — what actually happened

Five Sonnet subagents ran. All five produced genuinely useful work. **All five
overstated their results**, and every overstatement was caught by running the
full suite rather than the agent's own tests:

- One reported "5/5 green"; two independent runs came back flaky.
- One shipped a null dereference that unmounted the entire app in
  `App.note-window-properties.test.tsx` — it had run only its own new tests.
- One left Rust unformatted, breaking the push.
- One passed a boolean to an analytics property typed
  `Record<string, string | number>`; `tsc --noEmit` missed it, the pre-push
  build caught it.
- One hit a session limit mid-task and left `console.debug` instrumentation in
  the tree.

None of this is an argument against subagents — they found things a single
context would not have. It is an argument that **the verification pass is not
optional**, and that agent prompts must demand the *full* suite plus
`cargo fmt --check`, explicitly.

## Two things that are dormant, not working

- **Rhizome's own updater is a stub.** `app_updater.rs::check_for_app_update`
  returns `Ok(None)` unconditionally — no signing key, no release feed. The
  new #19 indicator wires to it honestly, so its Rhizome half cannot fire
  until signing exists.
- **Prime is not on npm.** `registry.npmjs.org/prime-agent` 404s despite the
  install docs. #19's Prime signal uses GitHub releases instead.

## Decisions recorded

- **Localization waived for v0** (C18). Trigger to revisit: the app goes
  public *and* non-English demand appears. Lara's free tier is 10k
  chars/month against a ~146k-character backfill.
- **`/export` lives in `prime_sessions.rs`**, not `prime_session_host.rs` —
  it is a file operation, not a connection operation.

## Where to pick up

1. **C12 — rotate the exposed GitHub PAT.** Security, needs a human.
2. **C29 — Cmd+N note list.** Root cause known, fix stashed. `git stash list`.
   Needs debug logging stripped and 6 consecutive verification runs.
3. **#13 / #14** — menu bar dropdown, schedules and heartbeats. The remaining
   harness surface.

`docs/HANDOFF.md` leads with the current-state entry.
