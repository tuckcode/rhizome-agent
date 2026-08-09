# Pickup plan — next session (written 2026-07-26)

Written cold-readable. Covers what's done, what's queued, and the two
things that need a decision rather than execution.

## Read first

1. `docs/HANDOFF.md` — 66-line router (Phase 2 cut it down from 914)
2. `docs/CROSS-MODEL-HANDOFF.md` — live traps, §14 is newest
3. This file

## State of the retooling pass

| Phase | Status |
|---|---|
| 0 — baseline + ledger | done (`claude doctor` hangs; health captured manually) |
| 1 — contradictions | done, C1–C5 all closed |
| 2 — HANDOFF cut | done, 914 → 66 lines |
| 3 — AGENTS.md triage | done, 202 → 199 |
| 6a — frontmatter repair | done, 3 cards |
| 6b — wiki content audit | done |
| 4 — skills | **not started** |
| 5 — Hermes system prompt | **not started, unblocked** |

## Queued work, in priority order

### 1. ~~Finish F1 — the DuckDB/tantivy cards~~ **DONE 2026-07-26**

Resolved in vault commit `5bce1a9`. The three cards
(`concepts/search-backend-duckdb.md`, `governance/search/DUCKDB.md`,
`governance/search/SEARCH_AND_DUCKDB.md`) plus `TURBOVEC.md` are gone,
replaced by one `concepts/search-architecture.md` stating which engine
serves which caller, and carrying the packaged-build caveat.

Merging surfaced two concrete errors the scoping problem had hidden:
the documented `--hybrid` / `--bm25-only` flags do not exist (only `-k`
and `--format`, and the vault path is a required positional arg), and
fusion was described as RRF when it is weighted 0.7/0.3. Both corrected.

**Still open from this thread — the governance reframe.** The three
`governance/agents/*.md` files were fixed to say "Claude writes directly"
where they used to say "delegate to Hermes". That is correct but still
agent-centric, and will go stale the same way the moment the agent lineup
changes. The better framing, per the user: **the writer identity is
irrelevant; the write path is.** Six entry points (app UI, menu-bar
capture, inbox watcher, MCP clients, CLI, editing markdown by hand) all
converge on `rhizome_api` and the `docs/VAULT_CONTRACT.md` contract.
Rewrite those files to describe the path and the contract, not who is
allowed to use it.

### 2. Codacy — incorporate now that the repo is public *(user asked)*

Never wired up because Codacy charged for private repos. Repo is now
public (`knispo/rhizome`, AGPL), so free-tier eligibility likely applies.

Do: check free-tier terms, add the repo, create `.codacy/` locally
(gitignored), run a first scan, and replace the "not actually set up yet"
clause in `AGENTS.md` § Security scan with real usage. If free tier
doesn't cover it, say so in `AGENTS.md` and stop — do not leave the
section implying a gate that doesn't run.

### 3b. Remaining 6b items *(F4/F5 resolved in vault `ae378a9`)*

~~**F4** — two personal files misfiled into the shared wiki...~~ **Done** (vault commit `ae378a9`).
~~**F5** — `Untitled.canvas`...~~ **Done** (vault commit `ae378a9`).

### 3c. `ValidatedPathMode::Existing` on mutating commands *(smell, not a live bug)*

`commands/vault/frontmatter_cmds.rs` — `update_frontmatter`,
`delete_frontmatter_property`, and the archive helpers — validate with
`ValidatedPathMode::Existing` even though they **write** to the file.
`Existing` is correct about "must already exist" and wrong about intent.

Not currently exploitable: the read-only tier check was added directly in
`frontmatter::with_frontmatter` (`fc09be21`) precisely because the
boundary-level check could not see this lane, so RO is enforced today.

The risk is future: anyone adding a write-time guard at
`validate_writable_path` will reasonably assume it covers every mutating
command, and it will silently miss these. Either switch them to
`Writable`, or rename the modes so the distinction is about existence
rather than implying write intent. Check the tests in that file first —
some may depend on `Existing`'s missing-file error text.

### 4. Phase 4 — skills

Not started. Split long skills into a thin entry + detail files; move tool
guidance into tool descriptions; delete skills duplicating a tool
description. Lower value than the above — do after.

### 5. Phase 5 — Hermes system prompt *(UNBLOCKED — location found)*

**It is `~/.hermes/SOUL.md`**, loaded by `load_soul_md()` in
`~/.hermes/hermes-agent/agent/prompt_builder.py` and injected as
**stable-tier slot #1** in `~/.hermes/hermes-agent/agent/system_prompt.py`
(~lines 189–198). Related: config at `~/.hermes/config.yaml`, skills at
`~/.hermes/skills/`, memories at `~/.hermes/memories/`.

Scoping is still a judgment call — being stable-tier slot #1 means edits
there affect every Hermes turn, so treat it as the highest-blast-radius
file in the whole retooling effort.

Per the Claude 5 guidance, this is the one surface to *invest* in rather
than trim — system prompt should carry product identity and mission, with
tool usage pushed into tool descriptions.

## Two things to carry forward

**The 8 browser-extension commits are still unpushed.** Gates green,
native QA passed. Push needs:
```bash
export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" \
       LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
```

**The lesson worth keeping** (recorded as F6): the C5 fix was correct but
touched one of four files holding the same rule. Updating one and missing
three is the *default* outcome when a rule is replicated — not a lapse.
Every consolidation below should end with a grep for other copies before
being called done.

## Canary check before trusting any of this

Per the retooling plan §7, in a **fresh** session ask:
- Should a browser extension write captures into `raw/inbox/`?
  (No — CROSS-MODEL-HANDOFF §12, watcher is explicitly disabled on
  existing vaults)
- `--no-clean` coverage says 82.75% against an 85% gate. Believe it?
  (No — §13, re-run clean)
- knip flags a file unused. What first? (§1 — check for `declare global`)

If a fresh session misses these, a cut went too deep.
