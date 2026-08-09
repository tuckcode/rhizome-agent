# Prime harness chat — spike plan

Status: **slice 1 landed** — long-lived RPC session host in Rust
(`prime_session_host`). Repo remains Option C hybrid bootstrap; chat UX
target wiring is next.

## Goal

Chat-like UX in this app, session engine = Prime Agent harness (long-lived RPC), vault via Rhizome MCP.

## Non-goals (for spike)

- Bundling Node/Prime inside the DMG
- Replacing every desktop surface
- Sharing git history/remote with `knispo/rhizome`

## Engineering slices

1. ~~`prime_session_host` — spawn `prime-agent --mode rpc`, prompt/abort/new_session, map events → existing AI stream types.~~ **DONE 2026-08-09**
   - Modules: `src-tauri/src/prime_discovery.rs`, `prime_events.rs`, `prime_session_host.rs`
   - Tauri commands: `get_prime_session_host_status`, `ensure_prime_session_host`, `shutdown_prime_session_host`, `prime_session_new_session`, `abort_prime_session_turn`, `stream_prime_session`
   - Events map into existing `AiAgentStreamEvent` (`Init` / `TextDelta` / `ThinkingDelta` / `ToolStart` / `ToolDone` / `Error` / `Done`)
   - Framing: strict LF JSONL (no Unicode line-separator splits)
   - Multi-turn: one child process kept alive across prompts; `new_session` resets
   - Live smoke: real `prime-agent --mode rpc --offline` answered `get_state` + `abort` (session id + grok-4.5/xai model from local `~/.prime`)
2. AI target “Prime” using that host (multi-turn, same process) — frontend `aiTargets` + panel path.
3. Seed/use `~/.prime/agent` (OAuth including xAI) without storing keys in app settings.
4. Inject Rhizome MCP; define Safe vs Power tool policy for Prime.
5. Prune clearly unused desktop-only panels only after chat path works.

## Notes for slice 2

- Default event channel: `prime-session-stream` (scoped ids `prime-session-stream-<suffix>` for abort via existing process registry is **not** wired yet — abort goes through `abort_prime_session_turn` RPC, not child kill).
- Host is process-global (one Prime RPC child per app). Cwd follows the vault path passed to `ensure` / `stream`.
- Extension UI requests are auto-rejected in the spike so the agent cannot hang on `ctx.ui.confirm()`.
