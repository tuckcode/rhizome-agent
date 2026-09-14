---
session: 2026-09-14T11:25-05:00
model: Composer 2.5 (Cursor)
description: >-
  W10 bridge-restart closure check. Source trace of #54 fix (unchanged guard +
  one sync owner). Native observation NOT RUN — shares W4 app slot.
---

# W10 — ws-bridge restart loop closure evidence

**Origin:** Composer 2.5 · 2026-09-14 · HEAD `4416411`

## Issue state

| Field | Value |
|---|---|
| Issue | [#54 — ws-bridge restarts in a loop](https://github.com/tuckcode/rhizome-agent/issues/54) |
| GitHub state | **CLOSED** (do not reopen) |
| Owner comment | Live-check on `main` `5c629a0`: already shipped. Cause was React identity churn, not a crash loop. Host returns `"unchanged"` when vault + active set match (`047da87`); `useVaultSwitcher` no longer syncs — workspace graph is the one owner. |

## Source verdict: **PASS**

Both fix commits are ancestors of current HEAD (`4416411`):

| Commit | Message | Role |
|---|---|---|
| `047da876` | fix: stop restarting a healthy MCP bridge (#54) | Host `"unchanged"` guard + frontend effect key fix |
| `423cd2fa` | fix: stop dual MCP bridge vault sync (#54 leftover) | Single sync owner — vault switcher removed |

### Host — unchanged-config cannot restart a healthy child

`src-tauri/src/lib.rs`:

- `RunningBridge` stores `{ child, vault, active_vaults }` (lines 116–119).
- `sync_ws_bridge_for_vault` compares resolved primary vault **and** active-vault set against the running child (lines 244–248). Match → `Ok("unchanged")` with no kill/spawn.
- Mismatch or no child → deliberate `stop_ws_bridge_child`, then spawn (lines 252–262).
- Stop log now reports exit status (`ws-bridge stopped (killed by us, {status})`) — lines 199–204.
- App startup still calls `sync_ws_bridge_for_selected_vault` once via background thread (lines 298–310); that path uses the same function and therefore also short-circuits on unchanged config.

Tauri command surface: `src-tauri/src/commands/system.rs` `sync_mcp_bridge_vault` forwards to `sync_ws_bridge_for_vault` (lines 154–173).

### Frontend — one sync owner, stable effect key

| Caller | File | Status |
|---|---|---|
| **Owner** | `src/hooks/useWorkspaceGraphState.ts` → `useBridgeVaultSync` | Passes `vaultPath` **and** `vaultPaths` together (lines 187–197) |
| **Removed** | `src/hooks/useVaultSwitcher.ts` | Comment at lines 1222–1225; no `sync_mcp_bridge_vault` invoke remains |

`useBridgeVaultSync` keys the effect on `writableVaultPaths.join('\u0000')` memoized to `stableVaultPaths`, not array identity (lines 175–185). Comment cites #54.

`rg sync_mcp_bridge_vault src/` — only production caller is `useWorkspaceGraphState.ts`. Vault switcher test asserts no sync: `useVaultSwitcher.test.ts` “does not sync the MCP bridge (workspace graph owns that path)” (lines 270–290).

### Original failure mode (corrected)

Issue premise assumed crash loop. Commit `047da87` message and code show **deliberate kill+respawn on every sync call** while config was unchanged:

1. React effect in workspace graph re-fired because `writableVaultPaths` array identity changed every render.
2. Host had no unchanged guard — every call killed and respawned.
3. Residual after `047da87`: `useVaultSwitcher` also synced with `vaultPath` only → Rust saw `vault_paths = []`, alternating with workspace graph's non-empty set → still forced restarts. Fixed in `423cd2f`.

### Tests (source only)

| Test | File | What it proves |
|---|---|---|
| Sync passes both path args | `useWorkspaceGraphState.test.ts` | `vaultPath` + `vaultPaths` sent together |
| Companion window skips sync | same | `windowMode: true` → no invoke |
| Vault switcher does not sync | `useVaultSwitcher.test.ts` | No `sync_mcp_bridge_vault` on switch |

No Rust unit test for `"unchanged"` return — commit `047da87` notes loop needs live Tauri + child process.

## Native observation: **NOT RUN**

Shares Atticus's app slot with W4 native Chat/reliability work. Per W10 contract: record NOT RUN; do not infer process stability from source trace alone.

Would require: one live session, grep `~/Library/Logs/ai.rhizome.agent/Rhizome Agent.log` for `ws-bridge spawned` / `ws-bridge stopped` — expect one start per real vault change, not per render.

## Doc drift (informational, not blocking closure)

- `docs/NEXT.md` § Platform cites `f76b46c` for #54 — that commit is Chat smoke helpers, not the bridge fix. Actual fix SHAs: `047da87`, `423cd2f`.
- `docs/ABSTRACTIONS.md` ~line 477 still says `useVaultSwitcher` calls `sync_mcp_bridge_vault` — stale; W1 living-truth may want a one-line correction.

## Stop conditions respected

- #54 not reopened
- No bridge rewrite
- No Prime daemon restart
- No mass MCP kill
- No commit (per task)

## Integration payload (for W1)

- **Behavior verified (source):** Repeated unchanged vault config cannot request bridge restart; single frontend sync owner.
- **Revisions:** `047da876`, `423cd2fa` (both on HEAD `4416411`).
- **Evidence:** Source PASS; native NOT RUN.
- **Remaining:** Optional log grep when W4 releases app slot — confirms runtime, does not change closure decision.
