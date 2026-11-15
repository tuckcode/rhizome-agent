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
4. `danger` covers deletion (including PowerShell `Remove-Item`, `del`,
   `rd`, and inline interpreter code that calls `rmtree`, `rmSync` or
   `unlink`), administrator rights, discarded git changes, a forced push,
   a deleted remote branch, `git branch -D`, `git filter-branch`, code that
   the command downloads or builds (including `curl … | python3`), encoded
   PowerShell, disk and recursive permission changes, `docker … prune`,
   `kubectl delete`, `terraform destroy`, shutdown and reboot,
   `crontab -r`, and hidden characters. The card gets a danger border
   and the reasons. "Allow once" has no fill, a red edge and red text.
   "Deny" has a neutral fill and an edge of the text color mixed 85%
   into the card, which clears 3:1 against the card in every theme
   (lowest: Solarized Light, 3.25:1). `src/lib/denyEdgeContrast.test.ts`
   checks every theme in CI; `scripts/deny-edge-contrast.mjs` measures
   the same in Chromium.
   Every card keeps the engine order, Allow once then Deny, so the
   buttons do not move between tiers.
   The collapsed row shows a danger glyph and offers Review only, so the
   user opens the card before the command can run.
4a. The parser skips shell keywords (`for`, `while`, `if`, `{`, `!`, …),
   looks through wrappers (`timeout`, `nice -n N`, `nohup`, `stdbuf`,
   `parallel`, `busybox`, `sudo -u user`), reads command names in any
   case, and treats `command -v` as a lookup. Shell commands that inline
   code passes to `os.system` or `subprocess` are read too. `mv x
   /dev/null` deletes. `npm publish` and similar are `caution`. Interpreter code given with `-c` or `-e`
   and a script run with `bash x.sh`, `source` or `.` are at least
   `caution`.
4b. The collapsed row's tag is the first sentence of the first reason,
   with no period. The row buttons' accessible names include the risk
   tag and the overflow tag ("Long command", "Multiple lines"), and both
   tags show together.
5. No tier moves keyboard focus to an allow button. That rule existed
   and stays.
6. The session grant for a file tool reads "Allow this file for the
   session".

## Consequences

- The classifier reads shell text with a small parser. It does not open
  script files, so `bash x.sh` says only "Runs a script file". It reads
  interpreter code only for a few delete calls. It does not rate other
  destructive verbs of cluster and container tools (`kubectl drain`,
  `docker rm`). A miss shows the `routine` look: a filled Allow once with
  no reason line, the same as an unrated prompt.
- It can rate a harmless command as `caution`. The cost is one line of
  text.
- A later change can move the classifier into the engine and send the
  tier with `ApprovalRequested`. Then other clients get the same rating.
- `bash` still has no session grant.
- The Deny edge uses `color-mix()`, which WebKit supports from Safari
  16.2. Older WebKit drops the declaration and the button keeps the
  default border color, so the edge can fall under 3:1 there.
- Inside `pwsh -c` and `powershell -Command`, `rm`, `del`, `rd`, `ri`,
  `rmdir` and `erase` always count as Remove-Item. Outside PowerShell,
  `ri` counts only with a Remove-Item parameter (`-r`, `-fo`, `-pa`,
  `-li` and their longer forms), so Ruby's `ri Array` stays routine.
