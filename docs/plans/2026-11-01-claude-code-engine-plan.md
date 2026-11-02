# Claude Code engine: build plan

**Origin:** Claude Opus 5.5 · 2026-11-01 · Claude Code desktop session
**Status:** Paper only. No step starts until Atticus accepts [ADR-0191](../adr/0191-optional-claude-code-engine.md).
**Blocked rule:** `import_jsonl` stays blocked until Atticus says `1`. No step here uses it.

## Gate before any code

1. Atticus accepts ADR-0191.
2. Atticus records who accepts the Commercial Terms for Rhizome.
3. Atticus says how to handle the competing-product question (ADR-0191 decision 3).
4. Add `Amended` lines to ADR-0186, 0187, and 0189. Update `CONTEXT.md` and `docs/IDENTITY.md`.

## Steps

Each step is one PR with its tests. Each PR keeps the engine hidden until step 6.

| # | Step | Main files | Done when |
| --- | --- | --- | --- |
| 1 | **Probe.** Run a throwaway test on the current `claude` with a subscription login. | `prototype/*` branch | Answers below are written in this file. |
| 2 | **Marker.** Add a harness marker to session rows and the open chat. Swap the Claude Code icon for neutral Phosphor `Terminal`. | `PrimeSessionList.tsx`, `AiWorkspace.tsx`, `AiAgentIcon.tsx`, `LocalAgentCards.tsx`, `public/ai-agent-icons/SOURCES.md` | Native rows show Rhizome. A test row with `agent:claude_code` shows the neutral icon and the text `Claude Code`. No Claude mark renders. |
| 3 | **Safe invocation.** Add a Claude Code engine profile. | `claude_invocation.rs`, `claude_cli.rs` | Tests pin `--setting-sources user`, `--strict-mcp-config`, auto memory off, the tool list per mode, `--add-dir` for each vault, no `acceptEdits` in Limited, no `Bash` preapproval, and no `--bare`. A test asserts that the shell environment list has no `AUTH_TOKEN` or `OAUTH_TOKEN` name. |
| 4 | **Approval bridge.** Add the approval tool to the `rhizome` MCP server and connect it to the native approval UI. | `mcp-server/`, `cli_agent_runtime/mcp_config.rs`, `commands/ai.rs`, approval UI | Edit and Bash calls ask in the app. Bridge failure, timeout, and restart all deny. Out-of-scope reads deny. |
| 5 | **Sessions.** Write turns to the Rhizome log. Save the Claude Code session id. Resume with `--resume`. Lock the engine per chat. | `claude_invocation.rs`, `commands/native_chat.rs`, `engines/native_log.rs`, `nativeSessionTarget.ts`, `chatTargetRouting.ts` | Restart, reopen, and continue all work. A failed resume opens read-only. ADR-0183 redaction runs on these turns. No Rhizome code path reads `~/.claude/projects/` for a chat. Cancel sends SIGINT first. |
| 6 | **Settings and picker.** Add an off-by-default switch, status line, and new-chat choice. | `aiAgents.ts`, `aiTargets.ts`, `SettingsPanel.tsx`, `NativeChatModelPicker.tsx`, `aiConversationTitle.ts` | Status comes from `claude --version` and `claude auth status --json`. Only yes or no and the method name are kept. Logged-out users see terminal text only. The Settings copy from ADR-0191 is present. Titles and background work never start a Claude Code turn. PostHog events have no prompt or path. |
| 7 | **Native QA and release check.** | `docs/agents/qa.md` notes, handoff | Mouse path first, then keyboard, in the native app with a real login. Check the legal page again. |

## Probe questions (step 1)

1. Does a subscription login work with `--setting-sources user`?
2. Which `--permission-mode` value gives Manual mode, and does it override a `defaultMode` in the user's settings?
3. Does the `--permission-prompt-tool` contract fit the Rhizome MCP server for Edit and Bash calls? What does a denied call look like in stream JSON?
4. Does an allow rule in user settings skip the prompt tool? Record the exact behaviour for the Settings copy.
5. What does `--resume` do when the session id is missing?
6. Is there an opt-out for the planned `--bare` default? If there is none, read the Agent SDK and ACP options (ADR-0191 option E) before step 2.
7. What is the lowest `claude` version that passes these checks? That becomes the version floor.
8. Does `abort_stream` in `ai_agent_processes` send SIGINT? `ai_agent_processes` was not read for this plan.

## Out of scope

- Any Claude login inside Rhizome.
- Bundled or preinstalled Claude Code.
- A Rhizome model picker for Claude Code. V1 uses the user's Claude Code default.
- Moving a chat between engines.
- `import_jsonl`, and any session list import.
- Engines for Codex, OpenCode, or other CLIs.
- Marker changes to other brand icons in `public/ai-agent-icons/`.
