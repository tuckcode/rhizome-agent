# Phase 3 — AGENTS.md triage (2026-07-26)

Deliverable for Phase 3 of `2026-07-25-context-retooling-plan.md`. Method
is that plan's **Test A** (inferable from the codebase → convert to
judgment; not inferable → keep literal) plus a duplication pass, applied
line-by-line against the actual repo, not against the rule text alone.

## Applied directly (clear, verified)

**D1 — `.codacy/` is per-machine, not dead.** Verified `.codacy/` is
gitignored (`.gitignore:87`) and was never committed. Unlike the
`tolaria-qa` path (fully removed, same on every machine), Codacy is
environment-dependent infra: real when a developer has it installed
locally, absent otherwise — this session had neither the directory nor an
MCP tool. §"Security scan with Codacy" gave no guidance for that case.
Added an explicit fallback clause, matching the practice this session
already used unprompted in its own commit messages ("Codacy: not run —
no `.codacy/` directory, no MCP tool in this session").

**D2 — `tolaria-qa` dead-path duplicated verbatim.** Lines 110 and 198
state the same fact in near-identical wording: `~/.openclaw/skills/tolaria-qa/scripts/`
no longer exists. §3 Reference is the file's own designated home for this
kind of gotcha; §1's native-QA section now points there instead of
restating it.

**D3 — commit-cadence rules gave two signals.** "Commit every 20–30 min"
(§Commits & pushes) sat three lines above "One [TDD] cycle per commit"
(§TDD) with nothing linking them. Not resolved by deleting either — a
cadence floor and a workflow-shape rule are both real — but merged into
one statement so a reader gets one answer instead of reconciling two.

## Q1/Q2 — resolved 2026-07-26

Both Todoist-shaped rules (task-start comment, "completion comment to the
Todoist task," "To Rework" QA-failed board state) turned out to be
template scaffolding, not a live workflow: `git log --diff-filter=A` and
`git log -S"Todoist"` both bottom out at the same commit —
`ea69b4f3`, "initial import of current local rhizome-desktop state" — the
very first commit in this repo's history. The user confirmed: not even
sure what it does, believes it (and Codacy) came in with the pre-rename
project. Nobody made a decision to use Todoist here; it rode in with the
initial import and nothing since has referenced it.

**Resolved by removing, not rewording.** All four Todoist/board-state
references cut from `AGENTS.md`. The substance underneath — a completion
comment covering what shipped, QA, coverage, and docs — was real and
stayed; it now targets the commit message / PR description, which is
what every session this week actually used.

**Same investigation surfaced a second finding worth keeping distinct:**
Codacy entered in the same initial-import commit, but unlike Todoist it
is not simply unused — the user says it was never wired up because the
repo was private and Codacy required payment for private repos. The repo
is now public (verified: `git remote -v` → `knispo/rhizome`, AGPL). That
changes the fallback clause from "describe an environment gap" to
"describe a now-stale blocker worth re-checking" — updated in `AGENTS.md`
accordingly. Setting Codacy up for real is a separate follow-up, not done
here.

## Converted to judgment

**L13 — "Read task description and all comments fully."** This is not a
project fact; it is baseline competence no agent needs told, and Test A
says so directly: skipping it produces wrong output immediately, visible
without any project-specific context. Cut — it added a line without
adding information.

**L20 vs §UI components table.** "For UI tasks: study app visual language
and components first" (L20) and the shadcn table two sections later say
the same thing at two altitudes. Kept the table (it is the non-inferable
part — *which* component to reach for) and folded L20's framing into its
intro line rather than stating it twice.

## Left alone, and why (do-not-touch confirmed)

- CROSS-MODEL-HANDOFF / HANDOFF pointers — non-inferable, already scoped
  in Phase 1.
- LLVM_COV block — non-inferable, verified load-bearing, already the
  canonical copy after the duplication pass (`b93f0509`).
- Coverage thresholds (≥70 / ≥85) — exact numbers, not inferable, checked
  against `vite.config.ts` and the Rust gate this session; correct.
- Demo-vault hygiene — exercised for real this session
  (`git status --short -- demo-vault demo-vault-v2` run repeatedly);
  accurate and load-bearing.
- `~/Laputa/` as the default user vault — checked against
  `src-tauri/src/lib.rs:246` (`dirs::home_dir().map(|h| h.join("Laputa"))`).
  It does not exist on this machine because the real vault in use is
  `~/Documents/Rhizome Vault`, but it **is** the actual coded default, not
  a stale reference. Correctly literal — not inferable from the file tree,
  and getting it wrong pollutes a vault that isn't obviously the "test"
  one from its name.
- macOS/Tauri gotchas (§3) — all non-inferable platform traps, no reason
  to doubt them, left as-is.
- Localization / PostHog / ADR sections — procedural, non-inferable, kept.
- Code health section — already judgment-shaped ("by judgment", "when you
  suspect something is orphaned") and carries its own worked example
  (`AiAgentsBadge.tsx`). This is the model other sections should match,
  not a target for further editing.

## Net result

202 lines → 191 lines. Small, because most of the file earned its length:
verified project facts, not defensive boilerplate. That is the expected
outcome per the plan's §1 — this repo's `AGENTS.md` was never the kind of
prompt Anthropic's 80% figure was cut from, and the triage confirms it
rather than assuming it going in.
