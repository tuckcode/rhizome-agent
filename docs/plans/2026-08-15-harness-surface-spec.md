# Spec — The Prime harness surface

Source: `/grill-with-docs` session, 2026-08-15. Supersedes the "next build" section
of `docs/plans/2026-08-15-harness-surface-pickup.md`. Transport decision:
`docs/adr/0163-connect-to-the-prime-daemon.md`. Vocabulary: `CONTEXT.md`.

## Problem Statement

Rhizome Agent presents Prime as a model in a chat box. Prime is not that. It
carries persistent goals with token budgets, schedules its own re-entry,
spawns subagents, and runs as a background service that outlives any client.
None of this is visible or controllable in Rhizome.

Concretely, from a user's seat:

- There is no way to give Prime an objective and let it work toward it.
- Anything Prime schedules for itself only fires while the app happens to be
  open, because Rhizome kills Prime on exit.
- Closing the window destroys work in progress, in a runtime designed so that
  closing a client does not.
- Prime's own commands — switching model, forking a conversation, compacting,
  moving between branches, running a skill — are either buried in unrelated
  chrome or absent entirely.
- The lens that shows where a session went on disk (Mycelium) launches a
  different application with different branding, so it reads as a foreign tool
  bolted on.

The underlying cause is a transport choice: Rhizome speaks Prime's smaller RPC
protocol, which cannot reach roughly two-thirds of the harness, and cannot be
worked around by sending command text — Prime's built-in commands are excluded
from `get_commands` and do not execute when sent as a prompt.

## Solution

Rhizome becomes **a window onto Prime**, not the thing that runs it.

It connects to Prime's background service as one client among several. Closing
the window detaches; sessions keep running; reopening reattaches. The menu bar
shows what is running while the main window is closed.

On top of that connection, the harness becomes visible and operable:

- The telemetry strip above the conversation becomes **harness controls** —
  goal, model and thinking level, and what is scheduled. State you read at a
  glance and set in place.
- The composer gains a **command menu** on `/` — Prime's own commands and
  Rhizome's vault skill, and nothing else.
- Actions that change what Prime remembers leave a **visible marker in the
  conversation**, so the transcript never lies about its own history.
- **Mycelium** moves inside Rhizome, wearing Rhizome's visual language.
- One **version indicator** covers both Rhizome and Prime, going green when
  either can be updated, with the real changelog behind it.

## User Stories

**Connection and continuity**

1. As someone running a long task, I want to close the Rhizome window without killing the work, so that I can get my screen back without losing progress.
2. As someone who closed the window, I want to reopen Rhizome and land back in the session I left, so that continuing does not mean starting over.
3. As someone with work running, I want Rhizome to minimise to the menu bar rather than quit, so that the session stays reachable without a window in my way.
4. As someone who quit Rhizome entirely, I want anything I scheduled to still fire, so that a timer I set means what it says.
5. As someone with nothing running, I want quitting to actually stop everything, so that Rhizome does not leave processes behind for no reason.
6. As someone whose `prime-agent` is too old, I want to be told plainly and offered the update, so that I am never silently downgraded to a version of the app where the promises above are false.
7. As someone whose Prime service is missing or unreachable, I want an actionable message instead of a spinner, so that I know whether to wait, restart, or install something.
8. As a returning user, I want to see how long a session has been running, so that I can tell the difference between working and stuck.

**Seeing what is running**

9. As someone with the window closed, I want the menu bar icon to tell me whether anything is working, so that I do not have to reopen the app to check.
10. As someone opening the menu bar dropdown, I want to keep the quick-capture box I already use, so that gaining agent status does not cost me the feature I open it for.
11. As someone glancing at the dropdown, I want a compact list of running sessions with what each is doing, so that the answer to "is it working?" takes no clicks.
12. As someone whose session spawned subagents, I want to see a count of children rather than a nested tree, so that a menu bar dropdown stays glanceable.
13. As someone reading the dropdown, I want to click a session and have Rhizome open onto it, so that the dropdown is a way in and not a dead end.
14. As someone with several sessions running, I want the most recent one to be where Rhizome opens, so that the common case costs me no decision.

**Harness controls**

15. As someone starting real work, I want to give Prime an objective with a budget, so that it keeps working toward something instead of answering one message at a time.
16. As someone with a goal set, I want to see how much of its budget is spent, so that I can tell whether it is progressing or burning.
17. As someone with a goal set, I want to clear or replace it, so that I am not stuck with an objective that has gone stale.
18. As someone choosing how hard to think, I want model and thinking level in one control, so that I set the two things I always set together in one place.
19. As someone who changed model, I want the strip to show the new one immediately, so that I never wonder which model answered.
20. As someone reading the strip, I want to see what Prime has scheduled for itself, so that self-directed work is never a surprise.
21. As someone reviewing schedules, I want to pause or cancel one, so that I can stop recurring work without killing the session.
22. As someone who has set nothing, I want the controls to stay quiet, so that the strip does not advertise features I am not using.

**Command menu**

23. As someone typing in the composer, I want `/` to offer the commands available, so that I do not have to remember them.
24. As someone typing a file path or a date, I want the menu to get out of the way when it does not match, so that `/` never traps me mid-sentence.
25. As someone browsing the menu, I want each command to say what it does, so that I can find the right one without trying them.
26. As someone running a command that takes an argument, I want to be shown what it expects, so that I am not guessing at syntax.
27. As a Rhizome user, I want the menu to contain Prime's commands and Rhizome's vault skill only, so that my personal coding skills from other tools do not leak into this product.
28. As someone running a skill, I want it visually distinct from an instant command, so that I understand one is a request to the model and the other happens immediately.
29. As a keyboard user, I want to drive the menu without the mouse, so that the composer stays keyboard-first.

**Truthful transcript**

30. As someone who compacted a conversation, I want a marker in the transcript at that point, so that later reading does not suggest Prime remembers things it no longer does.
31. As someone who forked, I want the transcript to record it, so that the branch I am on is never ambiguous.
32. As someone who changed model mid-conversation, I want that visible in place, so that I can attribute answers to the model that gave them.
33. As someone reading a marker, I want it to look like a system event and not a message, so that it does not read as something Prime said.

**Branches and sessions**

34. As someone who took a wrong turn, I want to move back to an earlier branch and continue from there, so that a bad path is recoverable.
35. As someone browsing branches, I want it clearly separate from switching between conversations, so that I do not confuse "within this one" and "between them".
36. As someone with many sessions, I want to switch between them and have the transcript rehydrate intact, so that history is real and not just a title.

**Mycelium**

37. As someone reviewing a session, I want to see where it went on disk from inside Rhizome, so that I do not have to launch a different application.
38. As someone using Mycelium, I want it to look like the rest of Rhizome, so that it reads as part of the product.
39. As someone in a session, I want a button showing that session's footprint, so that the lens is reachable where the work is.
40. As someone outside a session, I want the rail destination to show footprints across all sessions, so that the two entry points answer different questions.
41. As a user of open source, I want the underlying project credited, so that the rebrand is honest.

**Updates**

42. As someone with an update available, I want one indicator rather than two version numbers, so that the signal is "something can be updated" and not a puzzle.
43. As someone clicking that indicator, I want to see what actually changed, so that I can judge whether to update now.
44. As someone reading the changelog, I want to know whether it is Rhizome or Prime updating, so that I understand what is about to change underneath me.
45. As someone mid-task, I want to defer the update, so that it never interrupts work.
46. As someone who never updates, I want Prime not to update itself silently, so that model behaviour does not change without my consent.

## Implementation Decisions

**Transport.** Rhizome connects to Prime's daemon socket instead of spawning
`prime-agent --mode rpc`. Rationale, options and consequences: ADR-0163.
`prime_session_host` keeps its public function shape so the frontend is
insulated from the swap; its internals (process-global spawn, stdio framing,
the spawn-once `TEST_LOCK`) do not survive.

**Lifetime.** Rhizome does not own Prime. Window close detaches. Quit stops
nothing that is still scheduled to run; the menu bar icon persists as the
visible reason. Quit with nothing pending shuts down cleanly rather than
leaving a service behind.

**Version floor.** A minimum supported `prime-agent` version is a hard
requirement, surfaced and actionable. No silent fallback to RPC mode. Never
hardcode a model, here or anywhere — the catalog is Prime's.

**Vocabulary.** `session` in all UI and product copy; `worker` confined to the
transport layer; `subagent` for children; `agent` reserved for the product.
Enforced in `CONTEXT.md`.

**Command taxonomy.** Three kinds, and the surface must not blur them:
- *Protocol commands* — Rhizome implements the UI itself and calls the daemon.
  These are instant and have a real success/failure answer.
- *Skills* — routed to Prime as prompt text prefixed with `/`. These are
  requests to the model; success is the model's response, not an ack.
- *Built-in Prime commands* — belong to Prime's own terminal. Rhizome
  reimplements the ones it wants and never forwards their text, which would
  silently no-op.

**Command menu contents.** Sourced from `get_commands`, filtered on the origin
marker each entry carries: Prime's own (`builtin`) and skills Rhizome itself
installed. Auto-discovered user skills are excluded — they are a personal
coding toolkit, not part of this product.

**Trigger.** `/` opens the menu anywhere in the composer, not only at position
zero. It must dismiss cleanly on no-match and on Escape without consuming the
slash. This shares the composer's existing trigger mechanism with `[[`.

**Goal.** Readable from Prime's state; set by invoking Prime's `goal` skill.
Because that is a prompt rather than a call, the UI confirms by re-reading
state, not by trusting a response. This is the only control built this way and
must not become the pattern for others.

**Controls placement.** The existing telemetry strip becomes interactive. No
new chrome band above it — that was deliberately rejected (A4-SKIPPED,
`docs/HANDOFF.md`); reversing it is a separate decision, not a side effect of
this work. Model and thinking level combine into one control. The composer
deck's model picker is removed so there is exactly one place to change it; the
deck keeps vault and skills.

**Mycelium.** Mindwalk runs as a local sidecar server rather than being
launched as an application, and its view is embedded and restyled. Forking it
is explicitly deferred. Attribution required per its licence, which must be
confirmed before shipping the rebrand.

**Updates.** One indicator covering both Rhizome and Prime, green when either
has an update, opening a changelog that names which. Prime never updates
itself unattended.

**Product rules that apply throughout.** All user-facing copy in
`src/lib/locales/en.json` with `pnpm l10n:translate`. shadcn/ui components only.
PostHog events for meaningful new actions — goal set, command run, session
reattached — with no note content or PII.

## Testing Decisions

**What makes a good test here.** Only external behaviour. For the transport
that means "given this daemon traffic, this is what the app does" — never the
shape of a private struct. This repo has a documented history of the opposite
failure: `AiAgentsBadge` sat unreachable for months with its own tests passing
because they imported it directly, and a toggle was shipped into a header the
app mounts hidden. Passing tests are not evidence that anything routes through
the code.

**Preferred seams — all three already exist; only one new one is added.**

1. **`prime_session_host`'s public functions** (highest, and where most tests
   belong). Everything above the transport goes through it. Existing tests
   already drive a scripted fake `prime-agent`; the daemon equivalent is a fake
   socket server. This is the one new seam and must be the only one.
2. **Pure parsers over Prime output** — `prime_events`, `prime_sessions`,
   `prime_agent_activity`. Fixtures pinned verbatim from real logs, never
   hand-authored, because both defects found on 2026-08-15 (a `model_change`
   shape no real log contains, and `tool_use` vs `toolCall`) were invisible to
   fixtures written from a reading of the format.
3. **The Tauri command boundary** for frontend tests, via the existing
   `mockCommandResults` pattern.

**Live verification is a completion condition, not a bonus.** Every ticket must
be demonstrated against a real running Prime. `PRIME_SESSION_LOG=<path> cargo
test --lib prime_sessions -- --ignored` exists for exactly this. The transport
ticket must specifically demonstrate the property it exists for: close
Rhizome, reopen, work still running.

**Coverage gates unchanged** — frontend ≥70%, Rust ≥85%. Playwright `@smoke`
only for core flows; the harness controls are not core-flow until they carry
real work.

## Out of Scope

- Forking Mindwalk. Restyle now; fork is a later decision.
- Bundling Node or `prime-agent` in the installer. BYO Prime stands.
- Reversing A4-SKIPPED to add a chrome band above the telemetry strip.
- Multi-window or multi-session-at-once viewing. One conversation in the
  window; the menu bar is how the others stay visible.
- Editing or authoring skills in-app. `skill-creator` is Prime's.
- Prime capabilities with no RPC *or* daemon path — nothing currently known.
- Adding models to Prime's catalog. It arrives with a `prime-agent` update.
- Pruning the legacy Desktop "agent backend" code. Rename on contact only.

## Further Notes

**Verified against the installed build (0.7.1), not the docs.** RPC mode
declares 48 commands; the daemon protocol roughly three times that. A Prime
daemon was already running on the dev machine, reported by `prime-agent status`
as *default background service*, with Rhizome unable to see it. `get_commands`
returns 100 entries of which 11 are Prime's own — 13 ship, but `linear` and
`notion` do not load — and each carries an origin marker that distinguishes
them from user-installed skills. The `refine` command exists in RPC mode but is
absent from `rpc.md`.

**A correction this spec inherits.** The pickup doc recorded 11 bundled skills.
An earlier pass in this session "corrected" that to 13 by listing a directory.
The doc was right and the correction was wrong — a live probe settles it. This
is the repo's standing lesson applied to itself: verify against the artefact.

**Hermes Agent is the naming precedent.** It has the identical product-name
collision and resolves it by never introducing a third sense of "agent" — no
`hermes agents` command exists, and the unit a user lists, names and resumes is
a session. Rhizome follows it.

**No research file existed** when this spec was written, though one was
expected. Nothing here depends on it; if it lands and contradicts anything
above, this spec loses.
