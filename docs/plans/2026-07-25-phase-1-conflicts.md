# Phase 1 — contradictions found and resolved (2026-07-25)

Deliverable for Phase 1 of `2026-07-25-context-retooling-plan.md`. Method is
that plan's **Test B**: does this instruction pull against another one
anywhere in the stack?

Files read together (the whole always-on chain for a session with
`cwd = ~/code/projects/rhizome`):

- `~/.claude/CLAUDE.md` (global)
- `~/CLAUDE.md` (home-level)
- `~/Documents/Obsidian Vault/CLAUDE.md` (90 lines)
- `~/code/projects/rhizome/CLAUDE.md` → `AGENTS.md` (repo)
- `~/.claude.json` + `~/.claude/mcp.json` (tool layer)

**Baseline note:** the `claude doctor` block in `context-rules-ledger.md`
was verified, not taken on trust. `~/.orca/agent-hooks/claude-hook.sh`
exists (the ledger wrote the path without the `~`), and `~/.claude/mcp.json`
really does declare firecrawl/rhizome/tolaria. The baseline is sound.

---

## C1 — Four instructions each claim to be first *(resolved)*

| Source | Claim |
|---|---|
| `~/.claude/CLAUDE.md` | rename the session "before doing anything else" |
| `~/CLAUDE.md` | "Read that file first" (the Obsidian vault CLAUDE.md) |
| Obsidian vault `CLAUDE.md` | "read this file first, then Core Context.md" |
| `AGENTS.md` | "read `docs/CROSS-MODEL-HANDOFF.md` first" / "Read `docs/HANDOFF.md` first" |

All four are in scope simultaneously in this repo. Three of them use the
word *first*; one says *before doing anything else*.

**Evidence this is real and not theoretical:** across a long working session
on 2026-07-25, **none of the four was followed.** No session rename, no read
of the Obsidian vault `CLAUDE.md` or `Core Context.md`, no check of
`last-intake-audit.md`, no project note. `HANDOFF.md` and
`CROSS-MODEL-HANDOFF.md` were read only because the user's opening message
pointed at a plan that pointed at them.

That is the signature of this failure mode: four always-on "do this first"
rules produced **zero** compliance, and nothing surfaced the gap. An
instruction that is routinely skipped is worse than no instruction, because
it reads as coverage.

**Resolution — one ordered chain, one owner.** `~/CLAUDE.md` becomes the
single entry point that states the order and the scope condition for each
step. Downstream files stop claiming "first" and describe only their own
content.

## C2 — Three destinations for "what happened this session" *(resolved)*

- Obsidian vault: session log → `30 - Areas/.../Session Logs/YYYY-MM-DD - [topic].md`
- Obsidian vault: project note → `20 - Projects/Active/[project-name].md`, current at session end
- `AGENTS.md`: `docs/HANDOFF.md` updated in place; dated detail → `docs/plans/*-session-status.md`

None references the others. On 2026-07-25 the repo destinations were written
and both vault destinations were silently skipped.

**Resolution — one destination per artifact type, stated once**, and the
repo rule marked as *additional to* rather than *instead of* the vault ones.

## C3 — "Never load wholesale" vs. a 914-line file read at session start *(scoped)*

Obsidian vault `CLAUDE.md` prescribes the Karpathy LLM-wiki method for the
Rhizome wiki: *search first, never load wholesale*. `AGENTS.md` opens by
requiring `docs/HANDOFF.md` — 914 lines — to be read at session start.

Weaker than C1/C2 because these are two different corpora (the Rhizome
**vault** vs. the repo's **docs/**), so it is a scoping gap rather than a
direct contradiction. Worth recording because `HANDOFF.md` is precisely the
kind of monolith the retrieval rule exists to prevent, and Phase 2 shrinks
it anyway.

**Resolution — say which corpus the rule governs.**

## C4 — Two MCP config files, different server sets *(OPEN — needs your decision)*

```
~/.claude.json     → codebase-memory-mcp, cua-driver, firefox-devtools,
                     github, memory, qmd, tolaria
~/.claude/mcp.json → firecrawl, rhizome, tolaria
```

`tolaria` is declared in **both**. Two sources of truth for which servers
exist; this is why the ledger's doctor output listed servers that did not
appear in the working session.

**Not resolved here — it is a tooling change that can break a live setup,
and the right answer depends on which file your other clients read.**
Decide which is canonical, move the unique entries into it, and delete the
other. Check `tolaria`'s two definitions match before collapsing them.

## C5 — "Delegate to Hermes" with no stated mechanism *(resolved 2026-07-26)*

The Obsidian vault `CLAUDE.md` said to delegate wiki writes to Hermes with
no stated mechanism for how a Claude Code session hands work to Hermes —
the same class of problem as the ponytail line resolved in C1: pointing at
something that does not execute. It also disagreed with the repo's actual
architecture, where Claude writes to the wiki directly
(`rhizome_distill`, `save_capture`).

**User's call: drop the delegation, state the real mechanism.** The line
in `~/Documents/Obsidian Vault/CLAUDE.md` now says to write directly via
the `tolaria` MCP tools (`rhizome_distill`, `create_note`) — the same
tools this session's own MCP server exposes, registered machine-wide as of
the C4 fix (`2fa620a5`). No Hermes handoff, no undefined mechanism.

The user's framing, verbatim, for why: "thats a good example of the
garbage built up in the wiki." Worth remembering as a category — an
instruction that sounds like a real workflow but names no executable path
is not a minor phrasing issue, it is exactly the kind of accumulated cruft
this whole retooling pass exists to find.

---

## What changed

Edits applied for C1–C3 are additive scoping statements, not deletions —
per the plan's rule that a contradiction is resolved by deciding which
context each rule governs.

Left open deliberately: **C4** (tooling change, can break a live setup) and
**C5** (product decision about who writes to the wiki).

## Canary note

C1's evidence — four ignored session-start rules — is itself a canary
candidate for §7 of the plan. After the resolution, a fresh session in this
repo should be able to state what it is supposed to read at start, in order.
If it still cannot, the fix did not take.
