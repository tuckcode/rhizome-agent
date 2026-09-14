# W10 — bridge restart loop

**Owner:** existing Cursor issues/PR sibling, Grok. Composer records decided facts.
**Start:** brief closure check. Follow the [parent contract](README.md).

#54 is closed in the live God-plan snapshot.

1. Read its closure evidence and current sync-owner path.
2. Check that repeated unchanged configuration cannot request repeated restarts.
3. Use bounded process/log observation only when W4 releases the native app slot.
4. Distinguish necessary vault-change restart from an unchanged-state loop.
5. Release capacity if no contradictory evidence appears.

**Done:** W1 receives current issue status and the limits of available runtime evidence.
**Stop:** no rewrite from the old issue title. No repeated restart probes on a shared daemon.
Respect the security owner's MCP paths. If runtime evidence is absent, record NOT RUN rather than stable.

---

## Fill record

```text
Owner: Composer 2.5 (Cursor) — W10 closure check
State: complete
Starting revision: 4416411 (HEAD at check time)
Owned paths: docs/plans/handoffs/2026-09-14-1125-composer-w10-bridge-evidence.md, this stub
Sibling overlap and release condition: lib.rs / MCP paths read-only; W7 owns security edits; W4 holds native app slot
One bounded change or evidence task: Source trace of #54 fix (unchanged guard + one sync owner); PASS/FAIL/NOT RUN for native
Acceptance cases:
  - #54 closed on GitHub — YES (gh issue view 54, state CLOSED; owner comment confirms shipped)
  - Host returns unchanged when vault + active set match — YES (source PASS, 047da87 on HEAD, lib.rs sync_ws_bridge_for_vault)
  - Repeated unchanged config cannot restart healthy child — YES (source PASS, RunningBridge compare + early return)
  - One frontend sync owner — YES (source PASS, 423cd2f on HEAD; only useWorkspaceGraphState invokes sync_mcp_bridge_vault)
  - Effect keyed on path contents not array identity — YES (source PASS, useBridgeVaultSync vaultPathsKey memo)
  - Dual-caller empty vs non-empty active_vaults loop removed — YES (source PASS, useVaultSwitcher no longer syncs)
  - Native log observation (spawn/stop cadence) — NOT RUN (W4 app slot; no bridge restart experiment)
Evidence: gh issue view 54; git show 047da87 423cd2f; read src-tauri/src/lib.rs, src/hooks/useWorkspaceGraphState.ts,
  src/hooks/useVaultSwitcher.ts; rg sync_mcp_bridge_vault src/;
  result: SOURCE PASS, NATIVE NOT RUN;
  evidence path: docs/plans/handoffs/2026-09-14-1125-composer-w10-bridge-evidence.md
Commit: none (docs only, user requested no commit)
Pushed: n/a
Installed build tested: no
Unverified behavior: Log cadence of ws-bridge spawn/stop under daily-drive session (needs W4 slot)
Blocker and next action: none for closure. Optional log grep when app slot free — informational only.
```

## Integration payload (for W1)

- **Behavior verified (source):** Unchanged vault + active-vault set → host `"unchanged"`, no kill/spawn. Workspace graph is sole `sync_mcp_bridge_vault` caller.
- **Revisions:** `047da876` (host guard + effect key), `423cd2fa` (remove dual sync owner).
- **Evidence:** Source PASS; native NOT RUN.
- **Doc drift:** `docs/NEXT.md` cites `f76b46c` for #54 — wrong SHA; `docs/ABSTRACTIONS.md` still names vault switcher as bridge sync caller.
- **Remaining:** Native log check optional when W4 releases app slot.
