---
session: 2026-08-21T19:30Z
model: Claude Opus 5
also: []
description: >-
  #28's root cause fixed — attaching a vault no longer creates a Prime session,
  verified against a live daemon by session-log count. And C33: test files are
  typechecked now behind a named 150-file exclusion list, after the backlog
  turned out to be half the size a first measurement suggested.
commits: c0cef59..HEAD
---

# 2026-08-21 (evening) — sessions that are not created, tests that are checked

**State:** `main` through the commits below, tree clean, all gates green.
Prime **0.7.4**, daemon started detached for QA and left running.

### #28: a vault attach creates nothing now

Yesterday's session filtered empty sessions out of the list and called the
root cause the other half. It was still producing them: **43 of 93 logs in
`~/.prime/agent/sessions` held no message at all**, two of them written after
that fix landed.

The shape, once the timestamps were laid side by side, was two husks per
launch, ~0.8s apart:

```
2026-08-21T16:36:53.561Z  .../demo-vault-v2
2026-08-21T16:36:54.357Z  /Users/dtc/Documents/Rhizome Vault
```

The app opens with a default vault and then switches to the real one.
`ensure_host_for_cwd` sees a different cwd, shuts down, reconnects — and
`connect` created a session every time, because the daemon writes the log file
the moment it is asked to `create`. One of those two is garbage by
construction.

`connect` now rejoins work already running (#7, unchanged) and otherwise stops
at connected-with-no-session. `send_command` — the session-scoped sender —
creates one on first use, so the choke point is "something needed a session",
not "a window opened".

**Three reads opt out of that**, because they run on timers whether or not
anyone is talking to the agent, and would otherwise be exactly what creates
the session: `agent_activity` (mounted at app level since yesterday),
`get_session_stats` (15s), `get_commands` (on mount). Each answers nothing,
which is true of a host with no session. Getting this list wrong is the way
this change quietly buys nothing — an opt-out that is missed costs a husk,
which is the status quo; an *opt-in* that is missed would have broken a
feature, which is why creation is the default and the exemptions are named.

**"New chat" on a session-less host materializes** rather than creating one
and immediately asking for another. That path would have made two logs and
abandoned the first.

**Verified end to end, not just against the fake daemon.** Started Prime 0.7.4
detached, counted `~/.prime/agent/sessions`, ran `pnpm tauri dev`, let it
attach both vaults, counted again: **93 before, 93 after**. The app log shows
the first vault reattaching to a session already running and the second
connecting without creating one.

**One deliberate consequence.** The model chip on Chat home draws before a word
is typed, and the model is a property of a session. New `prime_settings` reads
Prime's own `~/.prime/agent/settings.json` (`defaultProvider` / `defaultModel`
/ `defaultThinkingLevel`) for the session-less case, so the chip says what the
next session will start as rather than "Model unknown". A session always wins
— the user may have switched model inside it — and the file is read fresh
per call, never cached. Note the label is the model **id** until the first
message, not the display name; Prime only reports the pretty name through
`get_state`.

**Not done: native UI QA.** `computer-use` resolves both `ai.rhizome.agent`
and `RhizomeAgent` to the *installed* `ai.rhizome.desktop`, so the dev window
could not be isolated from Rhizome Desktop and screenshotting risked driving
the wrong product. The session-count check is the stronger evidence anyway,
but the chip has not been looked at with human eyes.

### C33: test files are typechecked now

The entry said including tests "will surface a backlog, so it wants its own
change". True, and the backlog is half what the first measurement said:

| | errors |
|---|---|
| First run, everything included | 1458 |
| From `node_modules` | 698 |
| **Repo-side, real** | **668 across 143 files** |

The 698 come from two regression tests that import BlockNote's raw `.ts`
source by relative path — `skipLibCheck` skips `.d.ts`, not `.ts`. **386 of
533 test files were already clean.**

So `tsconfig.test.json` is a ratchet: those 386 are gated by `pnpm typecheck`
today, the 150 that are not are listed by name in its `exclude`, and a new
test file is checked from the moment it is written.
`pnpm typecheck:tests:backlog` prints what is left, worst file first.
Advisory, not a gate, for the reason `pnpm deadcode` is not one.

Proven the way C35 was: appended `const x: number = "not a number"` to a test
file, watched `tsc -b` report TS2322, restored it.

`src/types/mockTauriBridge.ts` fell out of it. `__mockContent` and
`__mockHandlers` were declared inside `App.tsx`, which worked only while every
project happened to include `App.tsx`. Tests getting their own project broke
that and `mock-tauri/index.ts` stopped seeing globals it sets. Third ambient
file in `knip.json`'s `ignore` now.

### Open

- **#28's display half and its root cause are both done**, but the 43 existing
  husks are still on disk. Nothing reads them (`list_sessions` drops them);
  deleting them is a user decision, not a migration to write unasked.
- **C33's 150 excluded files.** A third of the errors are in five:
  `useAppKeyboard.test.ts` (72), `useCommandRegistry.test.ts` (64),
  `useNoteListKeyboard.test.ts` (32), `Editor.test.tsx` (31),
  `useNavigationHistory.test.ts` (30).
- Unchanged from this morning: **C37** (chunk CLI absent, `.chunk/config.json`
  points at a repo from before this one existed), **C34/C18** (no
  `LARA_ACCESS_KEY_ID`, 19 locales stale), **C32** (no mention of Prime in
  `ARCHITECTURE.md` / `ABSTRACTIONS.md`), **C31** (the unhandled error that
  would not reproduce), #26, architecture candidates 2 and 5.
- `.cursor/` is untracked in the working tree and was left alone.

---
