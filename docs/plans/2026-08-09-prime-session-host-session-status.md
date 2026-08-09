# 2026-08-09 — Prime RPC session-host spike

## Goal

Land slice 1 of the Prime harness chat spike: a long-lived `prime-agent --mode rpc` host inside Rhizome Agent that can prompt / abort / new_session and map events onto existing `AiAgentStreamEvent`s.

## Done

- `pnpm install` in `~/code/projects/rhizome-agent`
- Rust modules:
  - `prime_discovery.rs`
  - `prime_events.rs`
  - `prime_session_host.rs`
- Tauri IPC (desktop): status / ensure / shutdown / new_session / abort / stream
- Tests: 9 unit tests under `prime_*` (mock RPC child covers multi-turn + event mapping)
- Live smoke: real `prime-agent --mode rpc --offline` → `get_state` success, session id, abort success
- Docs: spike plan, IDENTITY pointer, HANDOFF agent banner

## Verification

```bash
pnpm install   # Done in 7.1s
cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
cargo test --lib prime_
# live: python JSONL client against prime-agent --mode rpc --offline
```

## Next session

Frontend “Prime” AI target + wire AI panel to `stream_prime_session` without spawning a new process per message.
