# Semantic Duplication Detection (2026-07-26 re-run)

## Method
Previous run used literal string matching — useless for this task.
Duplication here means two places asserting the same requirement,
even with different wording. `--no-verify` vs `NEVER use --no-verify`
is the same rule stated two ways.

This run uses ground-truth confirmed findings and semantic clustering.

## Confirmed Duplicates

| # | Rule | Location A | Location B | Safe Cut |
|---|------|-----------|-----------|---|
| 1 | Never `--no-verify` | HANDOFF.md:813 | AGENTS.md (Commits & pushes) | Cut HANDOFF.md, keep AGENTS.md — already folded into Phase 2 |
| 2 | TDD Red→Green→Refactor→Commit | HANDOFF.md:814 | AGENTS.md §TDD | Cut HANDOFF.md, keep AGENTS.md — already folded into Phase 2 |
| 3 | Localization mandatory, en.json | HANDOFF.md:815 | AGENTS.md §Localization | Cut HANDOFF.md, keep AGENTS.md — already folded into Phase 2 |
| 4 | LLVM_COV/LLVM_PROFDATA env vars | HANDOFF.md (682–690, 827) | CROSS-MODEL-HANDOFF.md §13 | **AGENTS.md now has the canonical version** (added 2026-07-26). Both HANDOFF.md copies cut. CROSS-MODEL-HANDOFF.md cross-ref remains as the trap-notification, not a duplicate. |
| 5 | tolaria MCP server (live configs) | `~/.claude.json`: `/Users/dtc/code/projects/rhizome/mcp-server/index.js` | `~/.claude/mcp.json`: `/Users/dtc/code/projects/rhizome-desktop/mcp-server/index.js` | Different paths — one is wrong (`rhizome-desktop` doesn't exist). Fix the misconfigured one before resolving the duplication. See C4-OPEN. |

## Row 4 Correction (from user review)

Previous report incorrectly said "keep CROSS-MODEL-HANDOFF.md as canonical."
Actual situation: AGENTS.md has the `cargo llvm-cov` command but NOT the
`LLVM_COV`/`LLVM_PROFDATA` env var requirement. AGENTS.md is the authoritative
source for push rules. Fix applied: added env var block to AGENTS.md § Commits & pushes,
then cut both HANDOFF.md copies with a cross-reference back to that section.

## Row 5 Correction (from user review)

Previous report identified `~/.claude/mcp.json.bak` as a duplicate target.
The `.bak` is a dead backup (App Translocation temp path, no one reads it).
The actual live duplicate is across two live configs with different paths:

- `~/.claude.json`: `.../rhizome/mcp-server/index.js` ← correct path
- `~/.claude/mcp.json`: `.../rhizome-desktop/mcp-server/index.js` ← wrong path (dir was renamed)

This is a real tool-path inconsistency, not a trivial third copy.
It needs a decision about which canonical config to use before resolving.
Marked C4-OPEN in the plan.

## Borderline: Coverage Thresholds

AGENTS.md asserts coverage thresholds as release gates (≥70% frontend, ≥85% Rust).
HANDOFF.md references them narratively as past-tense records, not as assertions of the requirement. Not a semantic duplicate — HANDOFF.md is reporting, not prescribing.

## Safe Cuts Summary

- Rows 1–3: HANDOFF.md duplicates of AGENTS.md rules. Already handled as part of Phase 2 (HANDOFF.md cut to router).
- Row 4: HANDOFF.md now has zero copies of the env var requirement (moved to AGENTS.md). CROSS-MODEL-HANDOFF.md cross-ref stays as a trap warning, not a duplicate assertion.
- Row 5: Not safe to cut yet — the `.bak` is dead weight but the live configs need a decision first (C4-OPEN).

## C4-OPEN (from user review)

tolaria MCP server path mismatch across two live configs:
- `~/.claude.json` → correct path (`.../rhizome/mcp-server/index.js`)
- `~/.claude/mcp.json` → wrong path (`.../rhizome-desktop/mcp-server/index.js`)

Decision needed: which file is canonical? After that, fix the misconfigured entry.