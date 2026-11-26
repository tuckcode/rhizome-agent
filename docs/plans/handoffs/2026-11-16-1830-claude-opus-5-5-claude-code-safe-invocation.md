---
session: 2026-11-16T18:30-06:00
model: Claude Opus 5.5
description: ADR-0191 step 3, the Claude Code engine profile (safe invocation flags, no token env, too-old message).
---

# Claude Code engine, step 3: safe invocation

**Origin:** Claude Opus 5.5 · 2026-11-16 · cloud session, part of the ADR-0191 build (plan: `docs/plans/2026-11-01-claude-code-engine-plan.md` on PR #288).

The engine is still hidden (`productVisible: false` for `claude_code`). This changes only the args Rhizome passes to the user's own `claude` on the agent path.

## What changed

- `claude_invocation::agent()` builds one engine profile for both modes:
  `--setting-sources user`, `--settings {"autoMemoryEnabled":false}`, `--strict-mcp-config`, `--permission-prompts none`, `--tools <list>`, `--add-dir` for each vault (deduped).
- Limited is `--permission-mode manual`. Power User is `acceptEdits`. Bash is only in Power User's `--tools`, and nothing is preapproved with `--allowedTools`.
- Auto memory is off twice: the `--settings` value and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in the child env (new `env` on `ClaudeInvocation`).
- No `--bare`, `--dangerously-skip-permissions`, `bypassPermissions`, `--disallowedTools` or fallback args on the engine path.
- `ANTHROPIC_AUTH_TOKEN` is gone from `CLAUDE_PROVIDER_ENV_KEYS` (ADR-0191 2.8). A test pins that no `AUTH_TOKEN` or `OAUTH_TOKEN` name is in that list.
- An old `claude` that rejects an engine flag gets: "This Claude Code is too old for Rhizome. Run `claude update` in your terminal, then try again."

## Open

- `--permission-prompts none` denies every prompt until the step 4 approval bridge lands. Rhizome MCP vault tools may also be denied until then; probe Q9 and Q10 will say.
- The version floor waits on the probe run (Q7).

## Tested

`cargo test --lib -- claude_` (101 pass), clippy `-D warnings`, rustfmt. In the cloud session `ort-sys` could not download ONNX Runtime, so the build used `ORT_LIB_LOCATION` pointing at the `onnxruntime` 1.24.4 wheel's library. That is local only and not in the repo.
