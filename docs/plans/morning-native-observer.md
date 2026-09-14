# Morning native observer — ~2 min

**App:** `/Applications/Rhizome Agent.app` only. Not Vite / `mock-tauri`.  
**Prep once:** Prime installed. Vault attached so Chat shows the session subhead.  
**Do not:** mass-kill by process name, `prime-agent stop`, or quit other apps’ MCP children.

---

## 1. C64 — three cold launches (eyes on first 2s)

For each launch:

1. **Cmd+Q** Rhizome fully (not just hide).
2. Cold-launch from `/Applications`.
3. **Immediately** watch the Chat session subhead — **first 1–2 seconds only**. Do not wait ~6s and glance.

| Launch | Install copy in first 1–2s? | Notes |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |

**Fail** = subhead (or any chrome) shows install copy (`npm i -g prime-agent` / “not installed”) while Prime is installed and coming up.  
**Pass** = idle / live / working only. No install instruction.

**Tick boxes in:** [`src/hooks/C64.md`](../../src/hooks/C64.md) (same table). Full checklist: [`docs/plans/handoffs/2026-09-06-2156-composer-c64-native-verify-checklist.md`](handoffs/2026-09-06-2156-composer-c64-native-verify-checklist.md).

**After:** 3× clean → C64 verified; any flash → note which launch and stop (agents reopen hardening).

---

## 2. Send and recover (one turn)

1. Send one short message in Chat. Wait for a reply (or a clear error).
2. If connection drops or send fails: note whether your draft stayed and whether the UI showed a **useful** error (not silent, not “working” when it isn’t).
3. Reopen or retry until Chat is usable again.

| Check | Pass / Fail / Skip | Notes |
|---|---|---|
| Reply rendered or clear error | | |
| Draft preserved on failure | | |
| Reconnect → usable Chat | | |

---

## 3. Steer + queued follow-up (mid-turn)

Start a turn that takes a few seconds (long enough to type again).

1. **While working:** type a second line → **Enter** (queues follow-up). Confirm “Waiting in this session” / queue chrome stays visible — not a flash then gone.
2. **While working:** type different text → click **Steer response** (not Enter). Confirm steer was accepted (queue or turn reacts).
3. Optional: **Clear** queue once; note behavior.

| Check | Pass / Fail / Skip | Notes |
|---|---|---|
| Enter queues; queue stays visible | | |
| Steer button reaches current turn | | |
| Message not lost on reject/fail | | |

Do not close GitHub #41 from this alone; `mutate_queued_message` is out of scope.

---

## 4. Hide vs Cmd+Q (helpers)

**Before hide:** in Terminal, note Rhizome-owned helpers (optional one-liner):

```bash
pgrep -lf 'Rhizome Agent|RhizomeAgent|mcp-server/index.js' | grep -v Cursor | grep -v ChatGPT || true
```

Only count children of **this** Rhizome session. Packaged `mcp-server/index.js` used by Cursor or ChatGPT is **not** yours — leave it.

| Action | Window | Rhizome in Dock? | Helpers after |
|---|---|---|---|
| **Red close** (hide) | hidden | yes | note `ps` — Mindwalk / ws-bridge / Rhizome-spawned MCP should stop; Dock icon stays |
| **Dock click** (reopen) | back | yes | Chat usable |
| **Cmd+Q** | gone | no | full quit |

**Pass hide:** Rhizome stays in Dock; reopen works; no extra Rhizome-owned helper story left behind.  
**Pass quit:** app exits cleanly.

Detail: [`docs/plans/hide-on-close-helpers.md`](hide-on-close-helpers.md). Gray zone (Rhizome-spawned `prime-agent` daemon) — note what you see; do not invent cleanup.

---

## Where results go

| What | Where to tick |
|---|---|
| C64 ×3 launches | [`src/hooks/C64.md`](../../src/hooks/C64.md) table |
| Send / steer / hide | This file’s tables, or tell the next agent |

## 5. Last-conversation relaunch (native only)

Packaged app only. Vite / `mock-tauri` is not this path.

1. Open a real chat. Note the title.
2. **Cmd+Q**. Cold-launch `/Applications/Rhizome Agent.app`.
3. The same conversation should be selected.

| Check | Pass / Fail / Skip | Notes |
|---|---|---|
| Last chat restored | | |

Source already restores without a vault path
(`usePrimeSessionRestore.test.ts`). That is **not** this check.

**Stamped 16:08:** still **NOT RUN**. App still `476756c`. Do not launch
from an agent. Source last-idle needs no vault path. That is not this
check.

No code changes unless something **fails** live.
