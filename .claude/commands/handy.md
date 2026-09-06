# Hand off the session

Use when the session is wrapping up, context is running out, or Atticus asks
for a handoff — and whenever you find yourself *mentioning* one. Mentioning a
handoff is a request for this command.

Produces two things: the handoff files this repo requires, and a
**copy-paste-ready block** Atticus pastes into the next session.

## Steps

1. **Gather what actually happened.** `git log --oneline origin/main..HEAD`,
   `git status --short`, and the commits made this session. Do not write from
   memory of intent — write from what landed.

2. **Write one new file** in `docs/plans/handoffs/`, named
   `YYYY-MM-DD-HHMM-<model-slug>-<topic>.md`, with frontmatter carrying
   `session`, `model`, and a `description` that says what *changed*, not what
   the topic was. That description is what a future session reads to decide
   whether to open the file at all.

3. **Update `docs/HANDOFF.md` in place** — the state line if it moved, any
   affected Open threads, and one line in Recent sessions. Never paste the
   session into that file; it is an index.

4. **Run `pnpm handoff:check`.** It enforces the shape and a 900-line cap on
   `docs/HANDOFF.md`. Over the cap, prune a *resolved* thread down to its
   outcome — git holds the detail.

5. **Emit the copy-paste block** (below). This is part of the deliverable, not
   an extra; a handoff without it is incomplete.

## What earns a place in the handoff

Write what a fresh session cannot infer from the code:

- **Findings** — what was discovered, with the evidence that settled it.
- **Decisions** — what was chosen and *why*, especially where the obvious
  alternative was rejected.
- **Agreed but unbuilt** — anything discussed and settled that has no code yet.
  This is the most commonly lost category and the most expensive to lose.
- **What is unverified.** Say plainly which claims are source-level only and
  which were checked against a running app. "Tests pass" is not "it works".

Skip what the code already says. A future session can read the diff.

## The copy-paste block

End with a single fenced block, so it is one copy gesture:

````
```
## Continue Rhizome Agent — <date>

Read first:
1. AGENTS.md and docs/CROSS-MODEL-HANDOFF.md
2. git status --short && git log --oneline origin/main..HEAD
3. docs/HANDOFF.md
4. docs/plans/handoffs/<this session's file>
<any other file this session specifically touched>

## What happened
<3-6 lines: what changed and what state it is in>

## YSK / ICYDK
<the things that would otherwise be rediscovered the hard way —
findings, gotchas, decisions, anything agreed but unbuilt>

## Next
<the concrete next action>
```
````

Put every path in the block itself. Do not scatter paths through prose above it
and leave them to be collected.

## Rules

1. Report state, not intent. If it is committed, say so; if it is unpushed or
   unverified, say that too.
2. Name what is unproven. A handoff that overstates confidence costs the next
   session more than one that admits a gap.
3. Preserve `**Origin:**` lines on living docs; do not attribute an earlier
   author's section to this session.
4. Never commit or push as part of this command unless Atticus asks.
