---
session: 2026-08-29T05:30-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Three sub-agents built reply pills and the tray session list; the collision
  they caused is now an AGENTS.md rule. Vault Safe verified gone for Prime.
  A skill file from before #46's guard was still telling every session the
  vault was $HOME.
commits: 9ced117, 94cb88e, b701ef9, 96387e0, 3a467b8
---

# Sub-agents, and the Vault Safe receipt — 2026-08-29

**Origin:** Claude Opus 5 (Claude Code) · 2026-08-29 · `753f75c`..`3a467b8`

## What shipped

Three sub-agents, no Opus: two Haiku and one Sonnet, on files chosen so they
could not collide. The interface between the two frontend tasks
(`src/lib/replySuggestions.ts`) was written and committed first — `753f75c` —
so neither agent was building against the other's guesses.

- **`94cb88e` (Haiku)** — `suggestReply` reads a closed question the agent
  asked and returns the options it named. #51.
- **`b701ef9` (Haiku)** — those options render as pills above the composer;
  clicking one fills the box without sending. #51.
- **`96387e0`** — the pills hide once anything is typed, and return when the
  box is emptied. Atticus's call, and better than the alternative on the
  table: refusing to overwrite a non-empty box leaves the pills sitting there
  looking live while doing nothing.
- **`9ced117` (Sonnet)** — the tray lists running Prime sessions, shows a
  disabled "No sessions running" row when idle, and counts them in the
  tooltip. #52 job 1, and #13.

~18 minutes of building, ~35 end to end including cleanup. 1,400 lines. **No
issue was closed** — three partial features, and #13 is the one plausibly
finished but is unverified in the running app.

## The cheap tier needs verifying, not trusting

Haiku's first parser passed **20 of its own tests** and was wrong on every
real message. It split sentences on commas, so "Which one — A, B, or both?"
returned `["Which one", "B", "both"]` — it dropped the A. The tests had been
written to match the implementation rather than the behaviour.

Caught by running it against actual questions from the session transcript,
which took two minutes. Sent back with the failing cases and a narrower rule
(split on " or " first, never on commas to find options, return null when
unsure, never drop a detected option). Second round is correct on all of them.

**The lesson is not "Haiku is bad."** It is that a green suite proves nothing
about a parser whose tests were derived from its own output. Feed real inputs.

## The collision, and the rule it produced

One agent ran a broad `git add`, and its commit swallowed 591 lines of another
agent's in-progress Rust plus three frontend files from a third task — all
under a message about none of them. The follow-on was worse: that commit was
no longer `HEAD`, so the "amend your commit" instruction its author was
holding would have rewritten a *different* agent's commit.

Untangled by resetting to the seam and rebuilding five correctly-attributed
commits; the resulting tree was verified byte-identical to a backup tag before
the tag was deleted.

Now a rule in `AGENTS.md` (`3a467b8`): **stage your own files by name.** Third
distinct way the shared tree has bitten in two days. Put it in every sub-agent
brief — a fresh agent does not infer it, and `git status` looks completely
normal until the commit lands.

## Vault Safe is gone for Prime — verified, not assumed

A model answering "hi" burned its whole thinking budget last night. Its own
words: *"I think there might be a conflict here."* It was right. Two causes,
both now fixed:

**1. The running app predated the fix.** Binary built 01:05; "Prime always
runs as Power User" (`39f7603`) landed 02:19. The app was still sending the
old paragraph telling the agent it may not use shell, terminal, or scripts —
while the vault skill's own documentation instructed it to run a shell
command.

Verified after the 05:58 rebuild by calling `buildAgentSystemPrompt` directly
rather than by chatting:

| agent | mode | permission paragraph |
|---|---|---|
| prime | safe | none |
| prime | power_user | none |
| claude-code | safe | "Do not use shell…" |
| claude-code | power_user | "Power User…" |

Prime gets **nothing** about tool permissions in either mode, which is the
right outcome — no false lock, no contradiction. Claude Code keeps it, because
there the mode is genuinely enforced.

**2. A skill file from before #46's guard.** `looks_like_vault` now refuses
`$HOME` outright, but a file written on Aug 22 was still sitting at
`~/.prime/agent/skills/rhizome-vault/SKILL.md` saying the active vault root
was `/Users/dtc`. That is Prime's **global** skills directory, so every
session in every vault read it — the agent was told two different vault roots
at once. The correct copy inside the real vault says the right thing.

Moved out (to the session scratchpad, not deleted). That directory held
nothing else, and the guard prevents it returning. Recorded on #46 with two
loose ends: nothing detects an already-poisoned file from before the fix, and
the skill never says it is a CLI rather than an importable Python module —
which is what sent the agent into `ModuleNotFoundError: rhizome_vault` and a
long detour.

## Filed

- **#53** — `menu_bar_companion::setup` creates the hidden quick-note window
  before the tray, with `?`. A failure there costs the menu bar icon entirely,
  for an unrelated reason, and `lib.rs` swallows it into a `log::warn!`. Not
  the cause of the missing-icon sighting on 2026-08-29 (the log shows no
  failure, so macOS hid it), but real and cheap to remove.
- **#54** — the ws-bridge started and stopped **12 times** in one session,
  several pairs inside the same second. The log records no exit code, no
  signal, no stderr — the one fact that would identify the cause. Step one is
  a few lines: log the exit.

## Also settled

`en.json` is dead as a rule (`6052913`). Not translation — the requirement
that every user-facing string live in that file. It read to Atticus as the
English-only decision being reopened for the fourth time, and it has a real
cost: the parallel session spent 8 of 13 code commits on `en.json` moves, and
that sweep broke all 37 tests in `SingleEditorView.test.tsx` and failed the
push gate. A hardcoded English string in a component is now correct.

## Not done

- **#13** — plausibly finished by `9ced117`, unverified in the running app.
  Verify and close, or say why not.
- **#51** — pills work; Tab-completion and state-derived suggestions do not
  exist.
- **C55 / C56 / #44 Notes-panel drag** — unchanged from the previous handoff.
- Screenshots of the app remain impossible from an agent session: macOS drops
  accessibility and screen-recording grants on every rebuild, which is #50.
