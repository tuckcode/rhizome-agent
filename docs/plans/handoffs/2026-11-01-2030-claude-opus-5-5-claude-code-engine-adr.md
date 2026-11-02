---
session: 2026-11-01T20:30:00Z
model: Claude Opus 5.5
description: Proposed ADR-0191 and a build plan for an optional Claude Code engine with a harness marker. Paper only. Waits on Atticus.
---

**Origin:** Claude Opus 5.5 · 2026-11-01 · Claude Code desktop session

## What changed

- Added [ADR-0191](../../adr/0191-optional-claude-code-engine.md) with status `proposed`.
- Added the build plan [`2026-11-01-claude-code-engine-plan.md`](../2026-11-01-claude-code-engine-plan.md).
- No engine code changed. ADR-0186, 0187, and 0189 are unedited until Atticus accepts.

## You should know

- ADR-0186 decision 4 also says that there is no Claude Code engine. The ADR handles that conflict too.
- The hidden `claude_code` path auto-accepts edits in Limited mode and preapproves `Bash` in Power User. Both differ from the ADR-0187 tool policy. The path is hidden today, so no user reaches it through `agentTargets()`.
- `public/ai-agent-icons/claude-code.svg` is the Claude mark, so the plan replaces it before the target becomes visible.
- `--bare` ignores subscription login, and Anthropic's doc says that it will become the `-p` default. This is the largest design risk.
- The Commercial Terms bar building a competing product. Rhizome is a harness, so Atticus needs a real answer on this. The ADR does not give one.
- `ai_agent_processes` and the Agent SDK and ACP alternatives were not studied.
