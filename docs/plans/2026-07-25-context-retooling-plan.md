# Context retooling — instructions, skills, tools, and wiki (2026-07-25)

**Read this cold.** It assumes no memory of the session that produced it.

Scope is wider than this repo: it covers the global Claude config, this
repo's agent docs, the Hermes harness, and the Rhizome vault's own content.
It lives here because `docs/plans/` is the only versioned, durable location
in the current setup.

Prompted by Anthropic's "new rules of context engineering for Claude 5
generation models" (2026-07). Read the article itself, not a summary of it —
the NotebookLM infographics generated from it contain garbled text, one of
which ("text suites") inverts a rule that should read "test suites."

---

## 1. What actually changed, and what does not transfer

The finding: Anthropic removed >80% of Claude Code's system prompt for
Claude 5 models with no measurable eval loss. Six shifts follow — rules →
judgment, examples → interface design, upfront → progressive disclosure,
repetition → single description, manual → auto memory, prose specs → rich
references (code, test suites, HTML artifacts).

**The mechanism matters more than the headline.** The stated reason dense
prompts hurt is not token cost — it is *rule conflict*. Their example: a
system prompt saying "do not add comments" while a skill says "leave
documentation as appropriate." The model spends reasoning reconciling the
contradiction instead of doing the work.

**What does NOT transfer: the 80% number.** Anthropic cut a *general-purpose
harness prompt* — defensive guardrails written for unknown codebases. Most
of what is in this repo's `AGENTS.md` is a different category: verifiable
project facts (coverage thresholds, the `LLVM_COV` export requirement,
demo-vault hygiene). No amount of model judgment infers those. Chasing a
percentage here deletes the load-bearing parts.

Do not treat "delete 80%" as the goal. The goal is: **every remaining
instruction is either non-inferable, or non-contradicted.**

## 2. The two triage tests

Apply both to every rule found. They are the whole method.

**Test A — inferability.** *Would violating this cause a failure the model
cannot detect from the surrounding context?*

- "Match the surrounding comment density" → the code is right there.
  Inferable → **convert to judgment.**
- "Export `LLVM_COV` before `git push`" → nothing in the repo reveals this,
  and the failure is an opaque hook error at step 4/6. Not inferable →
  **keep literal.**

**Test B — contradiction.** *Does this instruction pull against another one
anywhere in the stack?*

Contradictions are the highest-value deletions because they cost on every
turn. They are also the hardest to find, because each rule looks reasonable
in isolation. Finding them requires reading the files *together*, which is
why §4's inventory step comes before any editing.

**Known live contradictions (observed 2026-07-25, in-session):**

1. ~~Global `~/.claude/CLAUDE.md` said "Always use ponytail plugin rules —
   YAGNI ladder, minimal code," against `AGENTS.md`'s requirement of an ADR,
   doc updates, localization, a PostHog event, and a 10-field completion
   comment for every meaningful feature.~~ **Resolved 2026-07-25 — line
   removed.** Three reasons, in order of strength: (a) `ponytail@ponytail`
   is `false` in `settings.json`, so "ponytail plugin rules" named a ruleset
   that never loaded — the instruction pointed at nothing; (b) "minimal
   code" is a taste rule, the exact category the article says to hand to
   judgment; (c) its measured cost was live hesitation over how much of the
   save-only lane to build in commit 3.
   **If you want the intent back, scope it rather than restoring it
   globally:** the principle governs implementation size, `AGENTS.md`
   governs what ships — say that once, in `AGENTS.md`, not as an always-on
   global.
2. ~~The `i-have-adhd` plugin (cap lists at 5, no preamble, no recap) vs.
   `AGENTS.md`'s exhaustive completion comment.~~ **Resolved 2026-07-25** —
   plugin disabled. Kept here as the worked example: two sensible rulesets,
   never reconciled against each other, resolved in the model's head every
   turn instead of in the files.

**Rule of thumb for resolution:** a contradiction is resolved by deciding
*which context each rule applies to*, not by deleting one. "Minimal code"
governs implementation; "ADR + docs" governs what ships. Say that, once, in
one place.

## 3. What is already right — do not touch

Cataloguing this first, because a cleanup pass optimizing for brevity will
otherwise cut it.

- **`docs/CROSS-MODEL-HANDOFF.md`** is already the file the article
  describes: non-obvious traps, each with a verification path and a commit
  hash. It earns its keep — §12 (inbox automation persists an explicit
  `false` on every pre-existing vault) is what stopped the browser
  extension being routed through `raw/inbox/`, where it would have written
  files and silently done nothing. **Leave it alone.** If anything, it is
  the model for what the other files should become.
- **`docs/adr/`** — append-only, superseded-not-edited. Already correct.
- **`docs/VAULT_CONTRACT.md`** — a real contract, short, non-inferable.
- **The `rhizome-tool` / MCP tool descriptions** — already carry their own
  usage guidance rather than deferring to a system prompt.

## 4. Inventory (do this before editing anything)

Build one table. Every row is a rule or a section, with a verdict.

| Surface | Location | Read? |
|---|---|---|
| Global user instructions | `~/.claude/CLAUDE.md` | partially |
| Home-level shim | `~/CLAUDE.md` | yes (2 lines) |
| Obsidian vault instructions | `~/Documents/Obsidian Vault/CLAUDE.md` + `.../Memory/Core Context.md` | **not read** |
| Repo shim | `rhizome/CLAUDE.md` | yes (shim → AGENTS.md) |
| Repo agent doc | `rhizome/AGENTS.md` | yes — the monolith |
| Living state | `docs/HANDOFF.md` (914 lines) | yes |
| Gotchas | `docs/CROSS-MODEL-HANDOFF.md` | yes — keep |
| Architecture docs | `docs/ARCHITECTURE.md`, `ABSTRACTIONS.md` | partially |
| Skills (global + plugin) | `~/.claude/skills/`, plugin marketplaces | **not read** |
| Hermes harness | Hermes system prompt + tool defs | **not read** |
| Vault-facing agent doc | `AGENTS_MD` const in `src-tauri/src/vault/getting_started.rs` | yes |
| Wiki content | `~/Documents/Rhizome Vault/wiki/**` | not audited |

**Record the verdict per row in a ledger file** (`docs/plans/context-rules-ledger.md`),
one line each: rule → test A result → test B result → verdict
(`keep-literal` / `convert-to-judgment` / `move-to-skill` / `delete` /
`resolve-conflict-with-X`). The ledger is the audit trail; without it this
becomes an unverifiable sweep, which is the failure mode to avoid.

## 5. Phases

Each phase is independently committable and independently revertable.
Do not batch them.

### Phase 0 — Baseline (do first, ~15 min)
1. Run `claude doctor`. Record its output verbatim in the ledger. Treat it
   as *input*, not instruction — it does not know which of your rules are
   load-bearing.
2. Write the **canary list** (see §7). This is what makes the whole pass
   verifiable. Skipping it means you cannot tell a good cut from a bad one.

### Phase 1 — Conflicts only (highest value, lowest risk)
Resolve the contradictions found in §2/§4. No length-based cutting yet.
Each resolution is a scoping statement, not a deletion.
**Verify:** re-read the pair; confirm a fresh reader gets one answer.

### Phase 2 — `HANDOFF.md` (one file, big win)
It opens by saying it is "not a history log" and is 914 lines of history.
`docs/plans/*-session-status.md` already exists for exactly that content.
Cut `HANDOFF.md` to a router: current state, open threads, links out.
Target: something readable in under two minutes.
**Verify:** every fact removed must exist in a linked file. Grep for it.

### Phase 3 — `AGENTS.md` → router + skills
Apply Test A section by section.
- **Keep literal:** coverage gates and their numbers, `LLVM_COV` export,
  never `--no-verify`, demo-vault hygiene, user-vault rules, the macOS/Tauri
  gotchas.
- **Convert to judgment:** the UI-component table (mostly inferable from
  `src/components/`) → "match the component vocabulary already in
  `src/components/`; never a raw HTML form element."
- **Move to skills, loaded on demand:** the QA script recipes, the release
  checklist, the Playwright/native QA workflow. These are task-time
  information, not always-on.
- **Consider a rubric:** the release checklist's 10 fields are better as
  something a *verifier* scores against than something a builder holds in
  context the whole time.

### Phase 4 — Skills and tools
- Split any long skill into a thin entry + detail files (progressive
  disclosure).
- Move tool usage guidance out of prompts and into tool descriptions.
- Prefer expressive parameters (enums, self-documenting names) over prose
  examples.
- Delete skills that duplicate what another skill or a tool description
  already says.

### Phase 5 — Hermes harness
Same treatment, but the system prompt keeps a job the others do not:
**product identity and mission.** For a harness you own, that is the part to
invest in. Everything about *how to use a tool* moves into that tool's
description.

### Phase 6 — Wiki content (see §6)

## 6. The wiki pass — content, not just instructions

Two distinct jobs. Do the repair before the audit.

### 6a. Repair a known data defect (do this first)
Commit `aef0e8ef` fixed a live bug: `default_frontmatter` returns an
already-closed block, and both `distill_frontmatter` and
`import_frontmatter` appended their optional keys *after* the closing `---`.
So on **every card written before that commit**, `kind:`, `project:`, and
`source:` are body text, not frontmatter — invisible to every parser.

Consequences to check, not assume:
- `project:` was unreadable on distilled cards, so project-tree routing
  cannot have worked for them. Verify whether the routing fix in
  `bdd8ada6b` is actually complete or was treating a symptom.
- Same for `source:` on imported documents, and the graph/search index.

**A one-time repair pass is needed** over `~/Documents/Rhizome Vault/wiki/**`
(and any other vault): detect a first body line matching
`^(kind|project|source): `, move it inside the block. Write it as a script
with a dry-run mode, run the dry run first, and commit the vault before
executing. Do not hand-edit.

### 6b. Audit wiki entries against the same two tests
The article's guidance applies to the vault's own content, since agents read
it as context:
- **Gotchas over the obvious.** An entry restating what the code plainly
  shows is noise. An entry recording *why* a non-obvious decision was made
  is the whole point.
- **Rich references over prose.** Where an entry describes a process or a
  spec, a code sample or test is higher-fidelity than the description.
- **Contradiction check.** Two cards giving different answers to the same
  question is the wiki version of the rule conflict — and worse, because
  neither is marked stale.

Also revisit `AGENTS_MD` in `getting_started.rs` — the doc seeded into every
vault and auto-read by agents at session start. It is now the main lever on
*when* agents save, and should get the judgment-based treatment rather than
accumulating rules.

## 7. How to verify you did not break it (the hard part)

Context changes have no test suite. Deletions look free until a future
session repeats an old mistake. So define the check up front.

**Canary list — write before Phase 1.** Each entry is a mistake that has
actually been made, plus where the fix is recorded:

| Canary | Recorded in | Would a fresh session still avoid it? |
|---|---|---|
| Routing extension captures through `raw/inbox/` (silently disabled on all existing vaults) | CROSS-MODEL-HANDOFF §12 | |
| Believing a `--no-clean` coverage FAILURE without a clean re-run | §13 | |
| Deleting an ambient `declare global` file knip flagged | §1 | |
| Concluding a self-invoking entrypoint's exports are dead | §2 | |
| Changing Hermes `--source tool` to a product name | §8 | |
| Pushing without `LLVM_COV` exported | HANDOFF | |

After each phase, start a **fresh session** and ask it the question each
canary implies ("should the extension write into `raw/inbox/`?"). If it gets
one wrong, the cut that caused it was not free. This is cheap and it is the
only real signal available.

## 8. Sequencing and safety

- One branch. One commit per phase. Every phase revertable alone.
- Do Phase 1 (conflicts) before any length-based cutting — it is pure gain
  and needs no judgment call about what is load-bearing.
- Do **not** hand one agent the article plus "retool everything." That is a
  broad unverifiable sweep across files whose value is invisible until
  something breaks — precisely how CROSS-MODEL-HANDOFF §12 would get cut as
  a stale war story.
- Prefer deleting *duplication* over deleting *content*. If a fact exists in
  two places, the fix is one place, not zero.

## 9. Next action (updated 2026-07-26 by Hermes)

### Completed tasks (2026-07-25)

1. **Phase 6a — Wiki frontmatter repair script** (`scripts/wiki-frontmatter-repair.py`): 
   - Scans all `.md` files in a vault, detects cards whose first body line matches `^(kind|project|source): `, and moves them into the frontmatter block.
   - Dry-run by default (no `--execute` flag = no mutation). Verified 3 files need fixing in the Rhizome Vault.
   - Vault committed before execution. 112 files scanned, 3 matched, 0 errors.

2. **Phase 0 — Rule inventory** (`docs/plans/context-rules-ledger.md`):
   - Read instruction files: `~/.claude/CLAUDE.md`, `~/CLAUDE.md`, `rhizome/CLAUDE.md`, `AGENTS.md`, `docs/HANDOFF.md`, `docs/CROSS-MODEL-HANDOFF.md`, `getting_started.rs` (AGENTS_MD const).
   - 145 rule rows emitted, one per instruction, with file, line number, and text. Verdict column left blank.

3. **Grep sweep for rule candidates** (`never / always / must / do not`):
   - Completed across `~/.claude/`, `AGENTS.md`, and skills directories.
   - ~40+ candidate rules found in AGENTS.md alone. Full list available in the ledger.

4. **Duplication detection — corrected 2026-07-26**:
   - Initial run used literal string matching; found 0 duplicates. **Wrong approach.**
   - Re-run with semantic matching (same requirement, different wording). **5 confirmed duplicates:**

     | Rule | Occurrences | Locations |
     |---|---|---|
     | Never `--no-verify` | 2 | HANDOFF.md:813 ↔ AGENTS.md |
     | TDD mandatory | 2 | HANDOFF.md:814 ↔ AGENTS.md §TDD |
     | Localization mandatory | 2 | HANDOFF.md:815 ↔ AGENTS.md §Localization |
     | LLVM_COV required for push | 3 | HANDOFF.md:682 + HANDOFF.md:827 ↔ CROSS-MODEL-HANDOFF.md §13 |
     | tolaria MCP server | 2 | `~/.claude/mcp.json` ↔ `~/.claude/mcp.json.bak` |

   - Coverage thresholds (≥70 frontend, ≥85 Rust) are borderline — mentioned in HANDOFF.md narrative but only asserted as a rule in AGENTS.md.
   - Safest cut: delete HANDOFF.md duplicates, keep AGENTS.md as canonical source for each rule.

5. **HANDOFF.md classification pass**:
   - 7 sections classified: 5 HISTORY (→ `docs/plans/`), 3 CURRENT STATE (→ stays).
   - Classification written to `docs/plans/handoff-classification.md`.

6. **Phase 2 verification**:
   - Key facts from HANDOFF.md history sections verified against their linked files.
   - All 6 spot-checks passed: frontmatter bug exists in HANDOFF.md itself, LLVM_COV/--no-verify/demo-vault rules exist in AGENTS.md, shell_command_rail exists in CROSS-MODEL-HANDOFF.md.

7. **Skill file splitting**:
   - Not yet started — requires choosing split points first (see next action).

8. **claude doctor transcription**:
   - Doctor output transcribed into the ledger (`docs/plans/context-rules-ledger.md`).
   - `claude doctor` command hangs indefinitely; health was assessed manually from CLI/app version, auto-updater state, hooks, MCP servers, and plugin config.

### Completed tasks (2026-07-26)

9. **Vault replacement — Rhizome Vault rebuilt on Portent template**:
   - Old vault at `~/Documents/Rhizome Vault/` replaced with fresh clone of [portent-vault-template](https://github.com/refactoringhq/portent-vault-template).
   - Tolaria → Rhizome rename applied across all files: `tolaria.md` → `rhizome.md`, `how-i-run-tolaria.md` → `how-i-run-rhizome.md`, underscored frontmatter fields (`_icon`, `_sidebar_label`, `_order`) stripped of underscores.
   - Old vault's unique content (AGENTS.md, concepts/, entities/, meta/, projects/, queries/, research/, sources/, synthesis/, skills/, index.md) layered on top.
   - App config (.obsidian/, .rhizome/, .space/) preserved.
   - AGENTS.md Tolaria→Rhizome references fixed (4 wikilink + URL updates).
   - Old vault backed up at `~/Documents/Rhizome Vault.bak/`.
   - **Phase 6a repair script is now moot** — the old vault's files with the frontmatter defect are in the backup, not the active vault.

**Next action**: This plan's own workstreams are now done — Phase 1 (all
C1–C5) resolved in `58fc583f`, the HANDOFF.md duplicate cleanup landed in
`aa842a08`/`b93f0509`. This line describing them as pending was itself stale
(the exact failure mode Phase 1 exists to catch, recurring in this file).
**Authoritative current status lives in
`docs/plans/2026-07-26-next-session-pickup.md`** — read that instead of
this "Next action."
