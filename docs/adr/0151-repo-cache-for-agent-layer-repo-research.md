---
type: ADR
id: "0151"
title: "Repo cache for agent-layer repo research (.rhizome/repo-cache)"
status: active
date: 2026-07-10
---

## Context

One Brain step 4c rebuilds the Generate tab (`rhizome_repo_research`) on the
agent layer, replacing the Python `rhizome-research`/`rhizome-repo-wiki`
shell-outs. The agent layer's Safe tool allowlist
(`claude_invocation.rs`) contains Read/Glob/Grep/LS but **no Bash and no
WebSearch/WebFetch** — an agent invocation cannot clone a repository or
research it over the web. The Python `rhizome-repo-wiki` it replaces solved
the same problem by cloning remote repos into `<vault>/.rhizome/repo-cache/`
itself before analysis.

The Generate tab's `repo` input is free text: a GitHub URL, a bare
`owner/repo`, or an absolute local path (folder picker).

## Decision

1. **Remote references are cloned Rust-side, before any agent call.**
   `rhizome_repo_research::ensure_local_repo` runs
   `git clone --depth 1 <url> <vault>/.rhizome/repo-cache/<slug>`; when the
   cache dir already holds a checkout it runs `git fetch --depth 1 origin`
   + `git reset --hard FETCH_HEAD` instead. All git subprocesses run with
   `GIT_TERMINAL_PROMPT=0` so private or nonexistent repos fail fast with
   git's stderr surfaced verbatim, never hanging on a credential prompt.
   The shared `run_cli_streaming` helper (120s timeout, streamed progress
   lines) runs them, so a stalled transfer cannot wedge the tab forever.

2. **`git` becomes a PATH dependency of remote repo research only.** Local
   paths never touch git (or the cache). Same optionality pattern as
   ADR-0150's markitdown/yt-dlp: missing tool → clear error naming what to
   install, only the affected input type degrades.

3. **The cache persists across runs with no eviction policy.** Shallow
   clones keyed by slug make re-research a cheap fetch instead of a fresh
   clone. Disk growth is accepted; cleanup (size cap, LRU, a settings
   toggle) is deliberately deferred until it's a real problem.

4. **The agent subprocess's cwd is pointed at the repo checkout — a
   directory outside the vault — in Safe permission mode.** Safe mode still
   includes Edit/Write, so a misbehaving agent could in principle modify
   files in the researched repo (including a user's own local repo passed
   by path). The research prompts forbid writes explicitly, but that is
   advisory. This is the same exposure every Safe-mode chat already has
   toward the vault itself; a per-request read-only tool allowlist would be
   a real agent-layer addition and is out of scope until the risk
   materializes.

## Consequences

- Generate works for local repos with zero new dependencies, and for remote
  repos wherever `git` is installed — no Python toolkit needed (the last
  Generate dependency on it dies with step 4c).
- `<vault>/.rhizome/repo-cache/` grows by one shallow clone per researched
  remote repo until a cleanup mechanism exists.
- Research quality is grounded in reading the actual checkout (file-path
  citations), not web search — a deliberate narrowing versus the Python
  `rhizome-research`'s web-round design, which the agent layer cannot
  express today.
