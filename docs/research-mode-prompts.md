# Rhizome Research Mode Prompts

Reference for research/analysis modes adapted from observed AI-app patterns (Grok-Wiki, Open Notebook) and rewritten for Rhizome's own terminology and use cases. Not copied code — independently described. Use these as prompt guidance for agents doing repo/codebase/wiki research through `rhizome-research` or `rhizome_repo_research`.

## Core Research Rule

**Do not just summarize the README.** The README is only for orientation. The real job is to inspect code, tests, config, scripts, generated files, prompts, adapters, edge cases, and implementation boundaries. A page is weak if it only restates README claims.

## Research Modes

### Architecture Map

**Use for:** Understanding a repo's structure, entry points, data flow, and key abstractions.

**Work:** Identify the main entry points, config files, and directory layout first. Map the core abstractions and data flow through the system. Note the tech stack and how pieces connect. Document build, test, and deployment paths. Output a system diagram (text/ASCII) showing the main components and their relationships.

**Voice:** Clear, conceptual, and precise. Make the reader better at predicting system behavior.

### First Hour

**Use for:** Fast orientation for a newcomer to be productive quickly.

**Work:** Focus on setup, build, run, and test commands. Identify the most important 3-5 files or concepts to understand first. Note any quirks, non-obvious dependencies, or gotchas that waste time. Prioritize practical onboarding over architectural depth. Include exact commands with expected output.

**Voice:** Clear, welcoming, and practical. Keep the pace fast without becoming shallow.

### Hidden Lessons

**Use for:** Surface non-obvious implementation details, edge cases, and constraints.

**Work:** Prioritize what is not already obvious from the README or docs. Treat tests, scripts, config, generated files, prompts, adapters, and edge-case branches as first-class evidence. Note error handling patterns, failure modes, and recover strategies. Document any workarounds, hacks, or technical debt worth knowing about. Surface assumptions the code makes (platform, environment, data shape, scale). Each finding must explain why it matters, not merely that it exists.

**Voice:** Curious, precise, and compact. Make every finding earn its place.

### Reusable Patterns (Worth Stealing)

**Use for:** Extract patterns, designs, and code worth reusing in other projects.

**Work:** Identify the repo's strongest reusable moves: elegant designs, best practices, architecture bets, UI/component decisions, infra choices, workflow mechanics, or product constraints. Build findings around portable lessons rather than modules. Each finding should teach what the move is, why it works, where it is implemented, when not to copy it, and what must change to reuse it elsewhere. Do not praise ordinary implementation detail. Only surface ideas that teach durable product or engineering judgment.

**Voice:** Practical and discriminating. Connect product intent, architecture, source evidence, tradeoffs, and portability without hype.

**Format:** End with a section titled exactly `What To Reuse` — one concise principle or recipe the reader can apply in another system. State transfer limits when they sharpen the lesson.

### Mental Model

**Use for:** Building a durable understanding of how the system works.

**Work:** Design findings around how the system works in the reader's head. Prefer flows, invariants, boundaries, state ownership, failure modes, dependency direction, and safe-change reasoning. Each finding should help the reader predict behavior without constantly reopening the code.

**Voice:** Clear, conceptual, and precise. Make the reader better at predicting system behavior.

### Feature Scout

**Use for:** Identifying useful features, CLI commands, workflows, and product mechanics.

**Work:** Identify features worth exploring, demoing, copying, or productizing. Prefer user-visible capabilities, agent workflows, CLI commands, UI affordances, hidden power-user moves, automation hooks, and product mechanics. Each finding should answer why the feature is interesting, where it is implemented, and what a builder should inspect next.

**Voice:** Product-minded, concrete, and discriminating. Sound like a builder identifying what deserves attention.

### Repo Comparison

**Use for:** Comparing multiple repos or subsystems within a repo.

**Work:** For multiple repos, explain what each does better, where they differ, and which ideas are portable. For one repo, compare internal approaches that solve similar problems differently. Use tables when they clarify differences.

**Voice:** Comparative, fair, and specific.

### Debugging Atlas

**Use for:** Understanding failure modes, observability, and recovery flows.

**Work:** Explain symptoms, probes, logs, state transitions, error boundaries, root-cause paths, observability hooks, recovery flows, and regression checks.

**Voice:** Practical, causal, and evidence-first. Make the reader better at tracing a real failure.

### Agent Handoff

**Use for:** Giving an AI agent enough context to work effectively with this repo.

**Work:** Map the repo's external dependencies, API keys, environment variables, and config. Document the build/test/lint cycle and any CI gates. Note files the agent should never modify (generated code, lockfiles, config templates). Describe the project's testing philosophy and where to find relevant tests. List any conventions the repo enforces (lint rules, naming, commit style). Provide exact commands for common workflows.

**Voice:** Direct, operational, and complete.

### Explain Like I'm 5

**Use for:** A simple, beginner-friendly explanation of a repo or system.

**Work:** Use plain language and short sections. Explain one idea at a time before naming advanced terms. Use analogies only when they clarify the source-backed behavior; immediately map each analogy back to the real files, functions, commands, or data structures. Do not talk down to the reader, invent cartoon examples, or remove important caveats. Simple must still be accurate.

**Voice:** Accessible but not condescending. Accurate simplicity.

### Tech Reader Brief

**Use for:** A HN/TechCrunch-style technical breakdown accessible to a broad technical audience.

**Work:** Write like a technical article: hook, why it matters, mechanism, tradeoffs, surprising details, and what builders should notice, all grounded in source evidence. Do not use hype, launch-post claims, fake market analysis, or unsupported adoption claims.

**Voice:** Accessible, article-like, and technically serious. Avoid hype, filler, and unsupported claims.

### Integration Plan

**Use for:** Planning how to connect, embed, or bridge this repo with another system.

**Work:** Identify the integration surface: APIs, hooks, event buses, CLI interfaces, MCP servers, IPC channels. Document data shapes flowing across the boundary. Note authentication, error handling, and retry expectations. Map conflicts or overlaps with the target system. Provide a concrete step-by-step plan with exact files to touch and commands to run.

**Voice:** Operational, specific, and grounded.

## Depth Modes

### Fast (First-Pass)
- 3-5 pages
- Overview + 2-4 targeted deep-dives
- Use for quick repo orientation, first-time exploration

### Regular (Standard)
- 8-18 pages
- Full coverage: structure, key abstractions, entry points, edge cases
- Use for standard repo research

### Deep (Exhaustive)
- 25+ pages
- Every subsystem, every integration surface, every notable pattern
- Use for pre-MVP research, porting decisions, competitive analysis

## Page Quality Requirements

Every generated page should:

1. Open with a clear finding title and one-paragraph summary of what this page covers and why it matters.
2. Base every claim on source evidence. If the source doesn't support it, don't say it.
3. Prefer exact technical facts over teaching prose: commands, signatures, paths, config keys, env vars, data shapes, lifecycle states, defaults, constraints, errors, expected outputs.
4. Use fenced text/ASCII diagrams only when they clarify architecture, lifecycle, data flow, or file layout. Do not diagram ordinary prose.
5. Use tables for options, configs, states, APIs, or comparisons when useful.
6. Include short, focused code excerpts when they help. Include the file path.
7. End with a brief closing section linking to related pages or files the reader should explore next.

## Run/Event Model

Every research action should log:

```
.rhizome/events.jsonl
.runs/<run-id>.json
```

### Event Types

| Event | Meaning |
|-------|---------|
| `started` | Research run began |
| `mapped-sources` | Repo structure mapped |
| `planned-pages` | Page structure designed |
| `structure-generated` | Page structure finalized |
| `page-started` | Individual page generation began |
| `page-finished` | Individual page generated |
| `agent-event` | Raw agent output during generation |
| `linted` | Wiki lint ran on touched pages |
| `merged` | All pages merged into final output |
| `finished` | Research run complete |
| `failed` | Research run errored |

### Run Metadata

```json
{
  "id": "run-uuid",
  "kind": "research | repo-wiki | import | lint",
  "status": "running | done | error",
  "input": { "repo", "mode", "depth", "model" },
  "events": [],
  "result": { "pages": [], "errors": [] },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

## SQLite Concurrency (for future Rhizome Desktop state)

| Setting | Standard writes | High-frequency writes |
|---------|----------------|----------------------|
| Busy timeout | 30,000ms | 500ms |
| Retry delays | — | [50ms, 100ms] |
| Journal mode | WAL | WAL |

Configurable via env vars:
- `RLM_WIKI_SQLITE_BUSY_TIMEOUT_MS` (default: 30000)
- `RLM_WIKI_SQLITE_WRITE_BUSY_TIMEOUT_MS` (default: 500)
- `RLM_WIKI_SQLITE_WRITE_BUSY_RETRY_DELAYS_MS` (default: 50,100)

## Output Format Preferences

- Use exact technical facts over teaching prose: commands, signatures, paths, config keys, env vars, data shapes, lifecycle states, defaults, constraints, errors, expected outputs.
- Use fenced text/ASCII diagrams only when they clarify architecture, lifecycle, data flow, or file layout. Do not diagram ordinary prose.
- End with a brief "Next" section linking to related pages or files the reader should explore.

## Beyond README Requirement

The README may orient the research, but it must not dominate the output. Actively surface source-backed material that is not already obvious from the README: code paths, tests, config, examples, prompts, adapters, generated assets, scripts, hidden constraints, and implementation boundaries. A finding is weak if it merely restates README claims. Prefer non-README evidence unless the README is the only source for a setup or product-positioning fact.
