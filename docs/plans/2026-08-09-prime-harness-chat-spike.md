# Prime harness chat — spike plan

Status: **repo bootstrap only** (Option C hybrid). No RPC host yet.

## Goal

Chat-like UX in this app, session engine = Prime Agent harness (long-lived RPC), vault via Rhizome MCP.

## Non-goals (for spike)

- Bundling Node/Prime inside the DMG
- Replacing every desktop surface
- Sharing git history/remote with `knispo/rhizome`

## Next engineering slices

1. `prime_session_host` — spawn `prime-agent --mode rpc`, prompt/abort/new_session, map events → existing AI stream types.
2. AI target “Prime” using that host (multi-turn, same process).
3. Seed/use `~/.prime/agent` (OAuth including xAI) without storing keys in app settings.
4. Inject Rhizome MCP; define Safe vs Power tool policy for Prime.
5. Prune clearly unused desktop-only panels only after chat path works.
