---
session: 2026-11-16T12:10-06:00
model: Claude Opus 5.5
description: Build ADR-0191 (Claude Code engine) as draft PRs, one per plan step; step 1 probe and step 2 harness marker.
---

# Claude Code engine build (ADR-0191)

**Origin:** Claude Opus 5.5 · 2026-11-16 · cloud session, on Atticus's go-ahead to build ADR-0191 the T3 Code way.

ADR-0191 and its plan are on PR #288 (`claude/hopeful-archimedes-f6a131`), still marked proposed. Atticus asked for the build. Each step is its own draft PR. Nothing merges until he accepts the ADR and settles the Commercial Terms questions in its decision 3.

## Step 1: probe (PR #306, `prototype/claude-code-probe`, never merges)

`scripts/claude-code-probe.mjs` runs the user's own `claude` with a real subscription login and prints answers to the eight probe questions. It reads no credential and never uses `--bare`. Waiting on Atticus to run it.

Answered without a login, from `claude --help` on 2.1.325 and from the code:

- `--permission-mode` choices are `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan`. `manual` replaces `default`.
- `--permission-prompts host|none` exists (default `host`).
- `--bare` reads no OAuth or keychain. Help shows no `--no-bare` opt-out.
- `ai_agent_processes::abort_stream` calls `Child::kill()`, which is SIGKILL on Unix. Step 5 must send SIGINT first.

## Step 2: harness marker

- `src/lib/sessionHarness.ts`: harness from the stored target. Only `agent:claude_code` is Claude Code.
- `src/components/HarnessMarker.tsx`: Rhizome mark, or Phosphor `Terminal` with the plain text "Claude Code".
- Native session rows and the open chat's target chip show the marker. A Claude Code row's accessible name ends with ", Claude Code".
- `AiAgentIcon` renders `Terminal` for `claude_code`. `public/ai-agent-icons/claude-code.svg` is deleted. `claude_code.shortLabel` is now "Claude Code".
- Engine stays hidden (`productVisible: false`).

## Split with the first-run work

The first-run model step is a separate task. This build does not touch first-run or onboarding screens. A Claude Code entry there is a follow-up after both land.
