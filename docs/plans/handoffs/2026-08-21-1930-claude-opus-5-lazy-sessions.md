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

### #30's first item: no two rows render the same label

`PrimeSessionList.tsx` still had the exact fallback #28 named. Fixed by
sharing `disambiguateTitles` out of `primeRunningSessions.ts` — but **not**
its suffix. That was `id.slice(0, 6)`, which is right for a daemon handle and
wrong for a saved session id, because those are uuidv7 and the leading
characters are a clock:

| suffix over the 93 real logs | distinct values |
|---|---|
| first 6 characters | **23** (one prefix covered 23 sessions) |
| last 6 characters | 93 |

Copying it verbatim would have shipped "Untitled session · 01a004" twice —
the bug, restated. The suffix is a parameter now, each list picks the part of
its own ids that varies, and a test pins that a non-distinguishing suffix is
not silently papered over.

Worth generalising: **a helper that fixes a duplicate-label bug can carry the
bug into its next caller**, because the thing that made it work was the shape
of the ids at the first call site, not the function.

### #30's second item: a row says where it ran

The issue asked for sessions from other clients to be "labelled as such or
filtered". **That is not possible.** Across all 93 logs the `session` header
line carries exactly `type`, `version`, `id`, `timestamp`, `cwd`, `rlmDepth`,
sometimes `git` (57/93) and sometimes `parentSession` (2/93). No client field.
The issue's wording assumed a field that does not exist.

What the data does support is *where*, and it turns out to be most of the
answer:

| cwd | sessions |
|---|---|
| `~/Documents/Rhizome Vault` | 31 |
| `/private/tmp` | 19 |
| `~/code/projects/rhizome-agent` | 11 |
| a grok worktree | 10 |
| `~` | 6 |
| `demo-vault-v2` | 5 |
| nine `/var/folders/…/T/…` temp dirs | 9 |

**28 of 93 ran in a temp directory** — test runs, including this repo's own
live-daemon tests. That is the clutter, and it is now labelled.

A row from elsewhere reads `Today · 20:43 · rhizome-agent`; a row from the
vault you have open says nothing extra, because repeating its name on every
row spends the common case on the rare one. Time stays leftmost — it is the
sort key, and the place is what should truncate first in a 228px column.

**`pnpm dev` could not show this list at all.** `list_prime_session_summaries`
returned `[]` in `mock-tauri`, so the sessions column was invisible in the one
loop where its rendering is cheap to look at. Four fixtures now, chosen to
exercise both defects this column has had. Confirmed on screen rather than
only in assertions.

### Open

- **#28 is closed.** Its checklist held three items this session did not
  touch — the identical-label fallback still at `PrimeSessionList.tsx:185`,
  no origin on a row, and no answer for 500 sessions — so they moved to
  **#30** rather than disappearing with the close. Two are done (above);
  what happens at 500 sessions is not, and is the only one left. The 43 existing husks are
  still on disk; nothing reads them (`list_sessions` drops them), and
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
