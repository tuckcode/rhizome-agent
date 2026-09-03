---
session: 2026-09-02T22:00-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Answered all four open questions from the prior session's Pi-registry
  finding (harness-composition.md items 7-10): the daemon's bash can drive
  a live package install (tested), Prime subagent/session state is durable
  and externally observable (task board = a view, not a second store), the
  pi.dev registry has a real review-and-adopt candidate for the profiles
  slice but not the other two, and pi-hermes-memory conflicts with vault
  promote and should not be installed.
commits: (pending)
---

# Closing items 7-10 in harness-composition.md — 2026-09-02

**Origin:** Claude Opus 5 (Claude Code) · 2026-09-02

## What this session answered

Picked up where the 2026-09-02-2028 handoff left off: four cheap open
questions in `docs/design/harness-composition.md` § Still discuss / decide,
each blocking a guess. All four resolved this session, written up inline in
that file (items 7-10) and summarized in `NEXT.md` §1.

**Item 8 — can the daemon's `bash` drive a package install? Yes, live-tested.**
Spawned `prime-agent --mode rpc` directly (same protocol the daemon speaks;
no need to stand up the daemon socket to prove the mechanism), against an
isolated temp project dir, with a throwaway probe package I authored myself
(package.json + one inert SKILL.md — not a random third-party package,
per the item-10 rule about reading source before installing anything).
Sent `{"type":"bash","command":"prime-agent package install <path> --local"}`
over stdin. Response: `exitCode: 0`, `"Installed <path>"`, and the isolated
project's `.prime/agent/settings.json` picked up the entry — confirmed by
reading the file, not just trusting the exit code. **Package management can
become an in-app action.** One loose end: `stderr` printed `"Shell cwd was
reset to <original launch dir>"` after the sequence — did not misroute this
test, but worth understanding before wiring a UI button to it.

**Item 9 — is subagent/session state durable and readable mid-flight? Yes,
from Prime's own docs.** `rlm.md`: *"The parent-scoped child registry
survives compaction, kernel restart, and parent restoration."* `daemon.md`:
sessions are JSONL under a process-safe lease; child registries and session
artifacts "make subagents recoverable." Readable mid-flight from **outside**
the kernel too — the RPC `observe` command subscribes to another active
root or subagent session and streams its live events. Answers item 4 at the
same time, as the prior handoff asked: a task-board surface can be a *view*
over Prime's existing registry, not a second store — Prime already owns this
state as one authority.

**Item 7 — does the registry already cover slice 1/2/3? Partial yes.**
Searched `registry.npmjs.org/-/v1/search` (the index `pi.dev/packages`
reads) by the `pi-package` keyword. Slices 1 (native extension UI) and 2
(catalog chip) have no covering package and structurally can't — both are
Rhizome's own GUI rendering Prime's protocol, not something a Pi-side
package can reach into. Slice 3 (profiles) is different: `pi-permission-modes`,
`@bacnh85/pi-permission`, and `@georgedong32/permission-modes` already
implement named tool-allowlist presets as installable extensions. Flagged
as the one live review-and-adopt candidate; not evaluated further (would
need its own source read, same as item 10).

**Item 10 — does `pi-hermes-memory` conflict with vault promote? Yes —
reject the package, do without.** Read the README and npm metadata at
source. It is default-on: writes on a background timer (every 10 turns /
15 tool calls), immediately on correction detection ("don't do that"), and
flushes on shutdown by default — none of it opt-in. Storage is its own
authority (`~/.pi/agent/pi-hermes-memory/{MEMORY,USER}.md` + SQLite,
project-scoped mirror under `~/.pi/agent/projects-memory/`), with zero
mention of vault, Rhizome, or any other memory system in its own docs. Atticus
asked mid-session whether to improve on it or do without and left the call
to me: recommendation is **do without** — Rhizome's vault promote already
targets the same job (durable cross-session facts) with a different, more
visible shape (owner-approved, not a silent timer). The one idea worth
lifting on its own merits, not the package: **correction-triggered capture**
— save immediately when the user corrects the agent, instead of waiting for
a scheduled review. That's a prompt/hook pattern for whoever next touches
vault promote, not an install.

## Traps avoided, worth naming

- Almost trusted `?q=` on `pi.dev/packages` as a real search parameter —
  two different queries returned byte-identical results (same 50 packages,
  same order), which meant the query string was being ignored and the
  fetch summarizer was pattern-matching within the same unfiltered page.
  Switched to the npm registry's actual search API
  (`registry.npmjs.org/-/v1/search?text=keywords:pi-package+<term>`), which
  DOES filter server-side — same index, real results.
- Kept the item-8 live test's own package self-authored rather than
  installing a random real npm package to "prove the mechanism" — the
  session's own rule (read source before installing, packages run with
  full system access) doesn't get an exception just because the install is
  a test.
- Verified item 8's isolated-install actually landed in the isolated
  project dir and not the repo (`git status --short -- .prime` was empty,
  `.prime/agent/settings.json` inside the temp project had the right
  relative path) despite a confusing `stderr` line claiming the shell cwd
  had reset to the repo — didn't take the exit-code success at face value.

## State

Edits are in the worktree `.claude/worktrees/rhizome-agent-pi-registry-items`
(branch `worktree-rhizome-agent-pi-registry-items`): `harness-composition.md`
items 7-10 resolved, `NEXT.md` §1 summary updated, this handoff. Test
artifacts (probe package, isolated project dir) lived entirely under the
job's own tmp dir, never touched the repo or `~/.prime` global settings —
nothing to clean up in-repo.

## Not done — needs Atticus, not an agent

**Item 7's slice-3 candidate** (`pi-permission-modes` et al.) is flagged,
not adopted — picking one means reading its source first, same bar as
item 10.

**Six Chat defects from the prior session's evidence pass** are still open
and still not mine to resolve without a product call — the largest is that
an image pasted mid-turn silently rides along with the next unrelated
message, which the code's own comment says must never happen. Fix is either
block the send or discard the image; that's Atticus's call. Not re-surfaced
in detail this session since it wasn't asked about — see the prior handoff
(`2026-09-02-2028-claude-opus-5-impeccable-and-pi-registry.md`) for the full
list if picked up next.
