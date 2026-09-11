---
session: 2026-09-06-2150
model: Composer
description: >-
  Read-only triage of Chat reliability leftovers — C64 still weakly verified;
  #54 code-fixed but dual sync callers may still fight; #47 confirm-and-close
---

# Chat reliability leftovers — C64 / #54 / #47

**Origin:** Composer · 2026-09-06 21:50 · read-only (push owned by another agent)

## Scope / constraints

- Triage only. **No commit, no push, no git index fight.**
- Did **not** touch `getting_started.rs`, `aiAgentSession.test.ts`, `SettingsPanel.test.tsx`.
- Did **not** edit `HANDOFF.md` / `NEXT.md` (push agent owns those).
- No CUA / native loops this session.
- `gh` auth on this machine is broken (`keyring` token invalid) — GitHub open/closed state taken from repo docs + commit messages, not live API.

## C64 — Prime “not installed” flash

### Verdict

**Still weakly verified. No remaining code gap that must ship before daily-drive.** Fix is in tree; proof is still “looked ~6s after launch,” not “watched the first second.”

### Evidence

| Claim | Source |
|---|---|
| Symptom | First status poll can answer `not_installed` while Prime is only still starting; subhead told user to `npm i -g prime-agent` then corrected to live |
| Fix | `dc9df84` (2026-09-05) — `withCorroboratedProblem` in `src/hooks/usePrimeHostStatus.ts` withholds a problem until a **second** poll agrees |
| Unit coverage | `usePrimeHostStatus.test.ts` — withhold first; surface on second (via `visibilitychange`) |
| Subhead safety | `PrimeSessionSubhead` prefers **live** over problem copy (`PrimeSessionSubhead.test.tsx` “stale problem must not shout”) |
| Wiring | `ChatHome` passes `live={Boolean(primeHost?.running)}` and `problem={primeHost?.problem}` |
| Native | Three launches, no false install instruction — but first look ~6s in ([0920 audit handoff](2026-09-05-0920-claude-opus-5-audit-findings.md)); HANDOFF still `C64-FIXED-WEAKLY-VERIFIED` |
| `NEXT.md` §0 | Still lists “C64 flash” under Chat reliability leftovers |

### Remaining gap (optional, not blocking)

Corroboration is **one matching poll** (~4s interval). A slow Prime start could still show the install line briefly after the second agreeing poll, then clear when the host comes up. That is narrower than the original first-paint flash.

Empty initial state uses `problem: null` → subhead shows idle, not “not installed.” Good.

### Recommended 1–2h slice (prefer verify over code)

1. **15–20 min native:** cold-launch 3×; eyes on subhead for the **first 1–2 seconds** only. Screenshot or note if install copy appears while anything else says live/working.
2. **Only if it still flashes:** harden withhold — e.g. keep suppressing `not_installed` / `service_unreachable` until `ensure_prime_session_host` has succeeded once **or** until the problem survives ~8–12s. Keep unit tests in `usePrimeHostStatus.test.ts`.
3. If clean 3×: mark C64 fully verified in HANDOFF/NEXT (docs-only; not this session).

**Files (only if code):** `src/hooks/usePrimeHostStatus.ts`, `src/hooks/usePrimeHostStatus.test.ts`.

---

## GitHub #54 — ws-bridge restart loop

### Verdict

**Code fix shipped (`047da87`); docs still treat it as open. Possible residual: two frontend sync callers can disagree on `active_vaults` and still force a restart.**

### Evidence

| Claim | Source |
|---|---|
| Original | 12 start/stop pairs in one session; pairs inside the same second ([0530 handoff](2026-08-29-0530-claude-opus-5-subagents-and-vault-safe.md)) |
| Cause (corrected) | Not a crash loop — React effect re-called `sync_mcp_bridge_vault` on array identity churn; host killed+respawned every time |
| Fix | `047da87` — host returns `"unchanged"` when vault + active set match; `useWorkspaceGraphState` keys effect on joined paths; stop log includes exit status |
| Still on HEAD | `047da87` is ancestor of current `HEAD` |
| `NEXT.md` | Still lists `#54` under Platform and lifecycle + §0 leftovers |
| Live GitHub | **Unconfirmed this session** (`gh auth` invalid) |

### Residual code risk (ready-to-apply note)

Both mount from `App.tsx`:

1. `useVaultSwitcher` → `useMcpBridgeVaultSync` passes **only** `vaultPath` → Rust gets `vault_paths = []`.
2. `useWorkspaceGraphState` → `useBridgeVaultSync` passes `vaultPath` **and** `vaultPaths`.

Host unchanged check requires **both** `vault` and `active_vaults` equal. Alternating empty vs non-empty `active_vaults` for the same primary vault still kills and respawns.

### Recommended 1–2h slice

1. **10 min:** after `gh auth refresh`, `gh issue view 54` — if closed with `047da87`, drop from NEXT; if open, comment + continue.
2. **30–45 min code (smallest fix):** make the two callers agree — prefer one owner.
   - **Preferred:** drop or no-op `useMcpBridgeVaultSync` when workspace graph sync is active, **or** pass the same `vaultPaths` list from vault switcher.
   - **Host-side alternative:** if `vault_paths` is empty and `vault_path` is `Some`, treat active set as `[vault_path]` (or “leave active set alone”) so empty ≠ restart.
3. **15 min verify:** one live session; grep app log for `ws-bridge spawned` / `ws-bridge stopped` — expect start once per real vault change, not per render.

**Files:** `src/hooks/useVaultSwitcher.ts`, `src/hooks/useWorkspaceGraphState.ts` (and/or `src-tauri/src/lib.rs` `sync_ws_bridge_for_vault`); tests in the matching `*.test.ts` / Rust module tests if present.

**Tiny patch sketch (frontend, preferred):**

```ts
// useVaultSwitcher.ts — either delete useMcpBridgeVaultSync call site,
// or pass vaultPaths: selected ? [selected] : [] so it matches workspace.
tauriCall('sync_mcp_bridge_vault', {
  vaultPath: selectedBridgeVaultPath(selectedVaultPath),
  vaultPaths: selectedVaultPath?.trim() ? [selectedVaultPath.trim()] : [],
})
```

Better still: **one** sync path only (workspace effect already owns multi-vault scope).

---

## GitHub #47 — distinguishable failure states

### Verdict

**Implementation complete since 2026-08-27. Open item is confirm-and-close, not new product work.** Daily-drive preflight/OAuth work in `0a71d84` strengthens the same gate.

### Evidence

| Piece | Commit / location |
|---|---|
| Provider error pass-through | `ea21050` |
| Preflight + remedy | `10cf3d9` — `src-tauri/src/preflight.rs` |
| Banner above composer | `b21211b` — `ChatPreflightBanner` |
| Session claim “gate complete” | [2223 failure-legibility handoff](2026-08-27-2223-claude-opus-5-failure-legibility.md) |
| Docs: still open on GitHub | 2026-08-28 handoffs; `NEXT.md` “confirm before closing” |
| Later strengthening | Expired OAuth no longer counts as connected (`preflight.rs` / Chat preflight in `0a71d84` tree) |

### Recommended 1–2h slice

1. **45–60 min native confirm** (no code unless a hole shows):
   - Unconnected / Expired provider → banner names remedy (Terminal reconnect), Chat does not look “green.”
   - Blocked vault path (or missing folder) → vault blocker with remedy.
   - Optional: force a provider error turn → message is provider text, not “finished without a reply.”
2. **15 min:** `gh issue view 47` → close with checklist + commit refs if confirm passes; else file the one hole as a new issue and keep #47 open only for that hole.

**Files (only if gap):** `src-tauri/src/preflight.rs`, `src/components/ChatPreflightBanner.tsx`, Chat send / error surfacing path — do not broaden into Settings redesign.

---

## Priority for the next free hour

1. **#54 residual dual-sync** — only leftover with a plausible **code** defect still in tree.
2. **C64** — eyes-on-first-second verify (docs close if clean).
3. **#47** — confirm checklist + GitHub close (docs/process).

## What NOT to do

- Do not re-implement C64 corroboration “just in case” without a reproduced flash.
- Do not rewrite ws-bridge.js or MCP tool semantics for #54 — the loop was host kill/respawn.
- Do not expand #47 into new failure taxonomy / Settings IA.
- Do not fight the push agent’s files or the git index.
- Do not start C72, session-import half, packaging, or Grokbot audits from this triage.
- Do not claim GitHub issue state without a working `gh auth`.

## Laptop / process note

`origin/main..HEAD` had `0a71d84` at triage time; working tree also had push-agent dirt on HANDOFF/NEXT/tests/getting_started. This file is the only write from this session.
