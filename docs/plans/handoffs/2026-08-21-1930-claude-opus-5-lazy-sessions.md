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

### #30's third item: archiving, because the measurement said not to virtualize

The instinct was to window the list. Measured first, over synthetic logs at
the real size distribution:

| logs | on disk | summarise |
|---|---|---|
| 93 | 60.8 MB | 2.25ms |
| 500 | 337.8 MB | 12.41ms |
| 2000 | 1351.1 MB | 50.02ms |

Flat at ~0.025ms per log even as the logs get enormous, because
`SUMMARY_SCAN_LINE_LIMIT` stops each read at 400 lines. The real store: 92
logs, 669µs to enumerate, 10.3ms to summarise. **The data layer never needed
anything.** Third time today the measurement said the work was fine — after
the push-gate lanes and the C33 backlog.

So the list gets shorter by curation. Every row has an archive action; filed
sessions collapse under `Archived (N)`, closed by default.

**Archiving never touches Prime's files** — ADR-0165. `~/.prime/agent/sessions`
is Prime's and is shared with its CLI and every other client, so moving or
deleting a log to tidy *Rhizome's* list would silently change what those tools
show. State is a list of ids in Rhizome's own `settings.json`; restore is
removing a string, so there is no confirmation dialog because there is nothing
to confirm.

Built as `LiveSessionRow` / `ArchivedSessionRow` over a shared
frame/button/action rather than an `archived` prop — the row already carried
`active` and `working`, and the row *is* a `<button>`, so the action could not
nest inside it.

The bench is on `prototype/session-list-scale`, out of main and pushed. The
pre-push hook enforced `main -> main only`, which blocked exactly what a
prototype branch is for; it takes `prototype/*` now and skips the gates on it.

**The browser caught what the tests could not, again.** jsdom mocks the host
module wholesale and passed; `pnpm dev` failed on the click because
`set_prime_session_archived` had no mock handler and the row snapped back.

### Localization is decided, and the docs now say so

Atticus: *"I thought I've said this multiple times, I'm not worried about
other languages right now."* He had — **2026-08-16, recorded in C18 with his
own quote** — and this session raised it anyway, as at least three before it
did.

The trigger was `AGENTS.md`: its release checklist required every completion
comment to confirm `pnpm l10n:translate` ran and `l10n:validate` passes, so an
agent following the checklist re-raises a settled question on autopilot. Both
the Localization section and the checklist line now say the opposite, and C18
is retitled **DECIDED**. Copy still goes in `en.json` — that is structure, not
translation.

### #27, half of which was already done

The issue was researched 2026-08-19 and describes an overlay that no longer
exists — the sessions column stopped being one earlier the same day. Four
criteria were already met before this session touched it, including the one
in the title, and that answered its second open question by itself: there is
one view now, not two.

**Built:** a row says whether its session is still running. The list lit a dot
for the *attached* session and nothing else, so a goal continuing in a
background session looked identical to a finished one. Three states — filled
with a ring is turning, filled is held by the daemon but idle, outlined is a
log on disk.

Two calls worth keeping:

- **Not `isRosterSessionRunning`.** That predicate means "is doing work" —
  heartbeat, turning, live children — and an idle resident session fails it
  while still being reattachable and still able to fire a goal. The third
  state exists for that gap. `runningSessionFilesByPath` also counts subagents
  and caps nothing, unlike `toRunningSessionRows`, which is shaped for a
  five-row popover: a sidebar marking only the first five sessions alive would
  be wrong invisibly.
- **The status is in the accessible name**, not only the dot. The dot is
  `aria-hidden` because it is decoration, so "distinguishable" was otherwise
  only true for people who can see colour.

**Decided by Atticus, 2026-08-22: the two sidebars dock independently.** Two
preferences, neither of which exists yet. That choice creates the edge case a
single preference would not have had — both docked to the same side — and it
has to mean something deliberate. Recorded on #27.

**The browser caught its third bug of the session.** No mock handler for
`list_prime_running_sessions`, so every row would have read as saved. Invisible
to the tests, which mock that module wholesale. All three of tonight's
browser-only findings had that same shape.

### C32 closed: Prime exists in the architecture docs now

Both `ARCHITECTURE.md` and `ABSTRACTIONS.md` contained **zero** mentions of
Prime — grepped, not assumed — while `prime_session_host.rs` alone is ~5,600
lines. Written at the end of the session that had just re-derived all of it,
deliberately: a future session would have had to derive it again *before* it
could write it down, which is what the 2026-08-19 session also did.

The lead is the thing that matters most: Prime is a **daemon client, not a
subprocess**, which makes the `cli_agent_runtime.rs` model documented directly
above it on the same page actively misleading.

### #29 investigated, not fixed

Verified the whole chain and left the findings on the issue rather than in a
chat log. Two of them change the plan:

- **"A wiring decision, not new detection code" is wrong.** `redactToken`
  unconditionally redacts absolute paths, and the only public entry point also
  collapses whitespace. Wired in as-is it would turn a note into one line with
  every path replaced. Needs a tokens-only, formatting-preserving entry point.
- **`sk-` is a weak prefix.** SpinKit CSS classes (`sk-circle`) collide.
  Acceptable for telemetry where over-redaction is free; not over user content.

**Nothing has leaked.** Scanned with the detector's exact token-start
semantics: 0 in 156 notes, 0 elsewhere in the vault, 0 across 11 commits. A
naive regex reports 1086 — all noise from a plugin bundle, a cached third-party
repo, and hyphenated English like "a**sk**-to-Tasks". Do not let that number
drive urgency. Real, worth doing, deadline is an *event* (the vault going
public or gaining a collaborator), not a date.

### A correction, from reading the roadmap doc instead of writing a new one

Asked whether any plan or design docs were needed. The answer was no —
`docs/plans/2026-08-20-prime-surface-gap.md` already covers the Prime gaps and
is two days old. Reading it instead of writing something new turned up that its
§6 item invalidates part of what shipped tonight.

**`set_session_name` is real and routable.** Probed against installed 0.7.4:
in the daemon's command list with a live `case` handler taking
`activeSessionId` + `name`. `rename_saved_session` and `delete_saved_session`
are there too. Rhizome calls none of them.

That means **#30 was closed on a claim that is half wrong.** "Which client
wrote a session is not derivable" is true of *reading* an existing log and
false of *writing* a new one — Rhizome can create the fact it could not derive.
Naming a session at creation would have made #28's disambiguation and #30's
place label unnecessary for every future session. Both still stand for the ~50
already on disk, and for sessions other clients write. Now **#31**.

It also corrects **ADR-0165**'s closing line, which says deleting a session log
is "Prime's to offer, not Rhizome's". `delete_saved_session` is routable, so
the honest statement is that we *choose* not to. The decision is unchanged, so
no superseding ADR — recorded in the gap doc, where the capability list lives.

The lesson is the one this session kept relearning: **check the record before
adding to it.** Three times tonight the answer was already written down —
C18's localization decision, #27's shipped half, and this.

### #31, and the Windows gap it surfaced

**#31 shipped** (`44ba9d6`): Rhizome names the sessions it creates, and the
summarizer reads `session_info` entries so a name set anywhere — including
`prime-agent rename` from the CLI — shows in the list. Naming failure is
deliberately non-fatal: probing showed names must be unique among *live*
sessions at the same depth, so two windows on one vault legitimately collide.

Scoped down honestly in the process. Only sessions with messages are listed,
and those already had content-derived titles, so auto-naming rescues few
"Untitled" rows. The real wins are origin — which #30 said was underivable —
and renameability. The user-facing rename is still unbuilt and is the piece
with the clearest value left.

**Then: can we work on this from Windows?** No — and it is worth knowing why.
`connect_stream` returns an error stub off Unix, so the whole Prime harness is
dead there. But **Prime's daemon already listens on Windows**
(`\\.\pipe\prime-agent-daemon`), the seam in our code already exists as a
single `DaemonStream` type alias with a comment anticipating exactly this, and
a Windows named-pipe client is an ordinary file handle — `std::fs::File`
supplies the `try_clone`/`Read`/`Write` every consumer uses. The only
socket-specific call in the file is the roster timeout pair.

Small change; the cost is that it cannot be verified from macOS. **#32**, with
line references pinned to `44ba9d6`. prime-agent is MIT, so no licensing
obstacle.

Everything else in the repo — notes, editor, search, git, wiki, MCP — works on
Windows today, and `pnpm dev` against `mock-tauri` drives the session list
including all three dot states and archiving without a daemon at all.

### Open

- **#28 is closed.** Its checklist held three items this session did not
  touch — the identical-label fallback still at `PrimeSessionList.tsx:185`,
  no origin on a row, and no answer for 500 sessions — so they moved to
  **#30** rather than disappearing with the close. **#30 is closed too** — all
  three landed this session. The 43 existing husks are
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
