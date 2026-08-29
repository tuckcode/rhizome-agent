---
session: 2026-08-29T01:00-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Sessions now name themselves from their first exchange and store that name
  in Prime, so every client reads the same one. A user rename still wins.
  The list also stops printing Rhizome's own placeholder as if it were a name.
commits: 8087091, f57d85e, 1980221, f43f7a6
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

## Also fixed: Mycelium listed uuids

`list_prime_sessions` named each row by its filename — Prime's uuid — so the
Sessions column beside the citymap was a wall of
`01a04c21-91d5-76aa-8b75-….jsonl`. It now uses the same title the sessions
list shows (`f43f7a6`). A log too damaged to summarise keeps its filename.

The middle column in that view is Mindwalk's own list, reading the logs
itself; it is unaffected by our naming and shows what Prime stored.

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

## Mycelium's Evaluation panel — not our bug

Reported mid-session with a screenshot: Mycelium's **Evaluation** panel fails
with `claude failed: exit status 1` over a raw JSON dump.

Reproduced outside the app in three commands. `claude -p "hi"
--output-format json` returns the identical payload, and its `result` field —
which the panel truncates before showing — says:

> Failed to authenticate: OAuth session expired and could not be refreshed

So the `claude` CLI's own login has expired on this machine. Nothing in
Rhizome or Mindwalk is broken. **Fix: run `claude login`.**
`~/.mindwalk/judge/` is empty, so no evaluation has ever completed here.

Two things worth doing anyway, neither started:

- The panel prints the whole JSON blob and cuts it mid-field. The one useful
  sentence is in `result`; everything shown is noise. This is Mindwalk's
  surface, not ours — worth an upstream issue rather than a patch.
- An expired CLI login is a fixable state with a one-line action. Rhizome
  already does this for Prime (`PrimeConnectionProblem`); Mycelium does not.

## Review of the output rules in `~/.claude/CLAUDE.md`

Asked for at the end of the session. That file is personal and lives outside
this repo, so it is recorded here rather than changed — nothing has been
applied yet.

Five findings, most important first:

1. **Rules 1 and 11 contradict each other.** Rule 1 requires the first line to
   be a command or path; rule 11 requires it to be a plain sentence a
   non-engineer understands. Those are different sentences, and each turn
   picks one arbitrarily. Rule 11 should win; rule 1 becomes "the first line
   answers or acts — never context or preamble."
2. **Nothing requires checking before claiming.** The costliest failures are
   confident wrong statements — four wrong causes asserted in one session, and
   two more this session before looking. `AGENTS.md` carries this rule for
   this repo only, so it protects one project out of all of them. Add to the
   global file: *never state a cause you have not checked.*
3. **Rule 5 (restate state every turn) only fits multi-turn work.** On a
   single question it produces filler, and it is quietly skipped. Scope it.
4. **Rule 3 (always end with a next action) forces a fake one.** When work is
   genuinely finished the honest ending is no ending. Allow it to be omitted.
5. **Rule 7 (make wins visible) is already covered** by rules 1 and 3.
   Removing it shortens the list without losing anything.

Smaller: rule 14 permits a closing question that rule 10's "no closers" bans,
and the file mixes three unrelated topics (`/graphify`, session naming, output
shape) under mismatched heading levels.

## Next thing asked for: let the agent see the running app (#50)

Filed as issue #50 at the end of the session. Chosen over an in-app code
editor, which was raised and set aside.

The agent cannot reliably see Rhizome while it runs. Native screenshots need
macOS Accessibility and Screen Recording, and **every rebuild changes the
app's signature, so those permissions are dropped** — it happened again this
session, which is why the naming work was proven with a daemon test instead
of a picture. The cost is not the screenshots: the chat transcript had no
scroll box for three days while 5,829 automated tests passed, because none of
them looked at the rendered layout.

Three of the four pieces already exist: `src/utils/uiAudit.ts` (four layout
rules), `tests/smoke/ui-audit.spec.ts` with its baseline, and
`src/types/rhizomeTestBridge.ts` (`window.__rhizomeTest`). `MyceliumView.tsx`
proves an embedded live page inside Rhizome works. What is missing is a
surface that puts a live app in front of the agent on demand rather than only
inside a test run.

Three questions to settle before building, in #50: whether it shows `pnpm dev`
(cheap, no permissions, but cannot exercise Rust) or the native app (real, but
exactly what the permissions block); whether it only reads or can also click
and type; and whether it ships in the app or sits beside `pnpm deadcode` as
developer tooling.

## Open question: is Vault Safe / Power User still earning its place?

Raised at the end of the session — inherited from Tolaria, and nobody has
checked what it does since Prime became the engine. Read before deciding;
the answer is not the same for every agent.

**Where it is enforced.** `claude_invocation.rs` turns the mode into an
`AgentToolPolicy` (`strict` / `compat`) and `antigravity_config.rs` reads it
for `sandbox_enabled` and `tool_permission`. For those two agents the toggle
is real: it changes what the CLI is allowed to run.

**Where it is only words.** `permissionModeInstructions` in
`src/utils/ai-agent.ts` writes a paragraph into the system prompt — *"Do not
use shell, terminal, Bash …"*. That is a request to the model, not a
restriction on it.

**Where it reaches Prime — corrected.** The `permission_mode` *field* never
reaches `prime_session_host.rs`, and reading only that suggests the toggle is
inert for Prime. It is not. `buildAgentSystemPrompt` folds
`permissionModeInstructions` into the system prompt, which travels
`aiAgentSession.ts` → `streamWithSelectedTarget` → `PrimePromptRequest`'s
`system_prompt` → `build_prompt`. So Prime's model does read *"Do not use
shell, terminal, Bash, Python/Node script execution, git, or command-line
tools"* — and obeys it.

Reported by Atticus, 2026-08-29, unprompted: asking a model to audit
rhizome-agent from inside Rhizome, it repeatedly answered that Vault Safe has
to be disabled before it can do anything. That is the mechanism above,
working as written.

**Which makes this the actual problem.** Vault Safe stops real work without
preventing anything. Nothing is blocked — `AGENTS.md` records that Prime has
no security sandbox and that the desktop must not invent one — so the model is
merely *asked* not to, and complies. A user gets the cost of a lock with none
of its protection, and the honest workflow for auditing this repo from inside
the app is to switch to Power User.

The prompt text is also self-contradicting for Pi: Power User mode tells the
model it is selected *and* that it changes nothing.

**The decision, not yet made.** Options, in the order they now look:

1. **Keep it, stop calling it safety.** It is enforced for Claude Code and
   Antigravity, so it earns its place there. Relabel it as what it is for
   Prime — an instruction the model follows — so nobody reads a lock into it.
2. **Default Prime sessions to Power User.** Safe is the current default and
   is what makes the model refuse ordinary work in this repo.
3. **Cut it for Prime.** Honest, and loses the CLI agents nothing, but throws
   away a control that does change model behaviour.
4. **Wire real enforcement.** `AGENTS.md` explicitly forbids building a
   sandbox in the desktop, so this is off the table unless that decision is
   revisited.

Not decided here: 1 and 2 together look right, but the default is Atticus's
call, and it changes what every new session can do.

## Not done

- **C55** — the text-only-model warning still does not fire in the app.
- **C56** — two live-daemon tests still fail (`pnpm test:live-prime`).
- **#44** — the Notes panel and the Mycelium list are still not resizable; the
  Notes panel needs a decision about how a drag interacts with
  `useShellCompactLayout`.
- **Mycelium still opens as a modal over the app**, with its own window
  chrome and a second "Mycelium" heading under the first. Doctrine says it
  should replace Chat as the centre canvas (ADR-0166). Visible in the same
  screenshot: the title collides with the macOS traffic lights.
