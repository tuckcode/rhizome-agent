---
type: ADR
id: "0192"
title: "Approval weight follows risk"
status: active
date: 2026-11-14
---

**Origin:** Claude Fable 5.2 · 2026-11-14 · front-end run, PR 1

## Context

The native loop asks before `edit_file`, `write_file`, `create_note` and
`bash` (`src-tauri/src/rhizome_loop/policy.rs`). Every prompt looked the
same. `rm -rf ~/EVIL` and `echo SAFE` each got a filled primary
"Allow once" button, in the card and in the collapsed row
(`docs/review-shots/audit-chat/earth-approval-two.png`). The session
grant for a file tool covers one path, and its label said only
"Allow for session".

The engine sends the tool, the arguments and the options. It sends no
risk data.

## Decision

**The approval UI rates each prompt as `routine`, `caution` or `danger`,
and the tier sets the weight of the prompt.**

1. `src/lib/approvalRisk.ts` reads the tool and, for `bash`, the command.
   It returns a tier and plain reasons. It is display only. The engine
   still decides which calls ask and which options exist.
2. `routine` makes no claim. It means that no rule matched. The UI never
   says that a command is safe.
3. `caution` adds one line that names the effect: the network, a package
   install, a file change, a git change, a path outside the vault, a
   whole-file overwrite.
4. `danger` covers deletion, administrator rights, discarded git changes,
   a forced push, code that the command downloads or builds, disk and
   recursive permission changes, and hidden characters. The card gets a
   danger border and the reasons. "Allow once" is an outline button. The
   collapsed row offers Review only, so the user opens the card before
   the command can run.
5. No tier moves keyboard focus to an allow button. That rule existed
   and stays.
6. The session grant for a file tool reads "Allow this file for the
   session".

## Consequences

- The classifier reads shell text with a small parser. It can miss a
  dangerous command, for example one inside a script file. A miss shows
  the `routine` look, which is the look every prompt had before.
- It can rate a harmless command as `caution`. The cost is one line of
  text.
- A later change can move the classifier into the engine and send the
  tier with `ApprovalRequested`. Then other clients get the same rating.
- `bash` still has no session grant.
