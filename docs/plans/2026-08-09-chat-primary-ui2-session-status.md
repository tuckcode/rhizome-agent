# Session status — 2026-08-09 harness chrome → chat-primary (UI-2)

Span: `204822a` → `056cb75` (6 commits, all local; origin ahead by 24).

## Shipped (commit-by-commit)

| Commit | What | Tests |
|--------|------|-------|
| `204822a` | Prime harness chrome (hide Safe/Power, `Skills · rhizome-vault` chip) + **Mycelium M1** (rail → Mindwalk bridge: `mycelium.rs` list/which/run/bridge, `primeSessionToMindwalk` bash-rewrite, `MyceliumView`) | cargo mycelium 3, vault skill 4 |
| `fa230a6` | Prime-first launch: auto-open chat once per app session (`useAgentDefaultOpenChat`), Prime-only onboarding copy, AiPanel chrome tests | 31/31 |
| `056cb75` | **UI-2 chat-primary**: flag `chat_primary_shell` (default ON) — side workspace opens **expanded** (fills editor column, `role="main"`), restore/expand persisted; default side width 420; fixed stored-width reader `Number(null)→0→MIN` bug | AiWorkspace 22, telemetry 22 |

## Design context

- UI-2 brief: `docs/design/2026-08-09-opendesign-harness-desktop-prompt.md` (§5 layout, frames A–F).
- Mycelium is a parallel run-map track (`docs/plans/2026-08-09-mycelium-run-map.md`), not a substitute for promote/save.
- Open Design is a design-tool track, not a model — visuals come later, no quota spent there.

## Decisions locked this session

- **No Safe/Power for Prime** — default toolkit + more skills; hide permission mode (`AiPanel`, `AiWorkspace` via `target.agent === 'prime'`).
- **MCP via skill + CLI, not host HTTP** — `rhizome-vault` shells to `mcp-server/cli-call.mjs` with `VAULT_PATH` (GH #1 documents).
- **Mycelium = Mindwalk bridge** — Prime `ipython`/`%%bash` tool calls rewritten to bash-shaped events; `which_binary` allowlist only `mindwalk`/`prime-agent`.
- **Product UI is Prime-only** — legacy CLI agents never appear in the target picker even when installed.

## Status vs roadmap (`2026-08-09-rhizome-agent-v0-brief-and-roadmap.md`)

- **All 9 v0 exit criteria eng-shipped** (checklist now `[x]` with refs).
- Phase 1 + Phase 3: **eng complete** for circle v0. Phase 2: skills/status/model-display done; picker + host hardening remain.

## Remaining / blocked

- ⏳ Native dogfood by user (`pnpm tauri dev`): chat opens expanded on launch, promote→open loop, rail→Mycelium→Open in Mindwalk (needs `mindwalk` on PATH).
- Blocked: GitHub push (`knispo` suspended) — commits local only; `opencode/*` provider (billing wall) — use `xai/grok-4.5`.
- Next eng candidates: in-app model picker (`set_model`/cycle), collapse vault chrome by default when chat-primary, Mycelium bind to live session id.
