---
session: 2026-11-16T20:15-06:00
model: Claude Opus 5.5
description: ADR-0191 step 6, the off-by-default Settings switch, the status line, and the Claude Code row in the model picker.
---

# Claude Code engine, step 6: Settings and picker

**Origin:** Claude Opus 5.5 · 2026-11-16 · cloud session, part of the ADR-0191 build. Stacked on step 5 (`prototype/park/claude-code-step5`).

This is the step that makes the engine visible, and only behind a switch that is off by default.

## Settings

- `claude_code_engine_enabled` (Rust `Settings`, `src/types.ts`). Absent or false is off. Rust normalizes `false` to absent.
- A `native_chat_target` of `agent:claude_code` is dropped while the switch is off, in Rust normalization, in the Settings draft, and in the mock. New chats then fall back to the catalog default instead of starting a chat that refuses to run.
- `ClaudeCodeEngineSettingsSection.tsx` sits under Safety in the AI section. The row reads "Run chats with your installed Claude Code". The notes say that Claude Code is Anthropic's product and that Anthropic does not make or endorse Rhizome, that turns use the user's own plan, that `~/.claude` settings and `CLAUDE.md` still apply, that an allow rule or hook can skip Rhizome's prompt, and that titles, distill, inbox and jobs never run on Claude Code.

## Status

- `get_claude_code_engine_status` runs `claude --version` and `claude auth status --json` (10 s cap, a hang reads as not found).
- `parse_auth_status` keeps `loggedIn` and, when signed in, `authMethod` if it is a short plain name (no `@`, at most 32 characters). Every other field is dropped where it is parsed. Tests feed it an email, org and plan and check none reach the status.
- Signed out: "Claude Code is not signed in. Run claude auth login in your terminal, then check again." There is no sign-in button anywhere.
- An unreadable sign-in state counts as ready and says so; Claude Code's own error covers a real logout.

## Picker

- `useClaudeCodeEngineEnabled` is a tiny store that `useSettings` publishes to, so the composer chip and Settings both see the switch without new props.
- With the switch on, the native picker shows "Your installed Claude Code" with one row, `Claude Code`, and the Phosphor `Terminal` icon. The row is disabled with the status line when Claude Code is missing or signed out. Picking it writes `agent:claude_code` as the default for new chats.
- A chat keeps its engine. The footnote says "This chat stays on Claude Code" or on its model when they differ.
- A fork now keeps the source chat's own target instead of the picker's pick, so forking a Rhizome chat while the picker is on Claude Code no longer makes a read-only Claude Code chat.

## Gates

- `ClaudeCodeEngine` checks the switch at every turn. Off ends the turn with "Claude Code is off in Settings…" and never runs `claude`.
- `generateAiConversationTitleForTarget` returns the local fallback for a `claude_code` agent target. `claude_code` stays `productVisible: false`, so distill, inbox and jobs cannot pick it.

## Analytics

`claude_code_engine_toggled` with `{ enabled: 'on' | 'off' }` and `claude_code_engine_selected` with no properties. No prompt, path, version or account detail.

## Open

- Probe Q1, Q7: the real `claude auth status --json` field names and the version floor. If the fields differ, the status line says it could not read the sign-in state and chats still start.
- Step 7: native QA with a real login, mouse then keyboard.

## Tested

Rust: `cargo test --lib -- claude_ settings:: native_chat engines:: ai_agents` (421 pass), clippy `--all-targets -D warnings`, rustfmt. Frontend: `tsc -b`, eslint on the changed files, new tests for `claudeCodeEngine`, the Settings section, the picker row, and the title guard, plus a full `vitest run` (9,603 of 9,604 pass after the mock-settings expectation gained the new field; the 3 `SheetEditor` files fail to load only because this worktree borrows `node_modules`). The local Playwright smoke suite has not run from this cloud session.
