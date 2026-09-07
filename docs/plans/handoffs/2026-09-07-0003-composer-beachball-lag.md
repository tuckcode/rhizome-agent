---
session: 2026-09-07-0003
model: Composer
description: >-
  Beachball suspects for load / Settings / session switch: sequential sync
  Prime IPC + full transcript remount, Settings full remount, Graph under
  Inbox, debug binary vs Applications. Diagnosis only.
---

# Beachball lag — three moments (diagnosis)

**Origin:** Composer · 2026-09-07 ~00:03 · read-only code + disk evidence  
**Runtime assumption:** Atticus is on `pnpm tauri` / `tauri dev` →  
`src-tauri/target/debug/RhizomeAgent` (confirmed earlier same night:  
[2359-composer-dev-vs-packaged](2026-09-06-2359-composer-dev-vs-packaged.md)).

No product code changed. No Instruments run this session.

This machine’s Prime session store at check time: **~101** `*.jsonl` files,  
**~21 MB** under `~/.prime/agent/sessions/` — enough that “read whole log” and  
“summarize every file for the list” are not theoretical.

---

## Plain verdict

The spinning pinwheel (macOS beachball) at those three moments is most likely  
**the web page’s main thread** (React + WebGL) plus **slow debug native code**,  
not a mysterious OS bug. Session switch and cold start also wait on **Prime’s  
background service** (daemon) over blocking Rust commands. A packaged  
`/Applications` build should feel **noticeably smoother**, but the same  
session-switch and Settings remount shapes exist there too — release does not  
delete them.

---

## Ranked suspects

### 1. Session switch — three sync host calls, then full chat redraw (highest for “click session → freeze”)

**Path (evidence):**

1. List click → `AiPanel` → `handleSelectSession`  
   (`src/components/usePrimeSessionSwitcher.ts` ~108–128)
2. Sequential awaits (no optimistic UI):
   - `ensure_prime_session_host` → Rust `ensure_host`  
     (`src-tauri/src/commands/ai.rs` ~530–532,  
     `prime_session_host.rs` ~993–996, ~2424–2451)  
     Can **spawn** the daemon and **poll up to 30s**  
     (`DAEMON_STARTUP_TIMEOUT`, `wait_for_daemon` ~749–760).  
     Even when already up: mutex + `seed_vault_skill` disk writes  
     (`prime_vault_skill.rs` ~20–56).
   - `switch_prime_session` → daemon RPC while holding host lock  
     (`prime_session_host.rs` ~1712–1727)
   - `read_prime_session_transcript` → **entire** `.jsonl` into memory  
     (`prime_sessions.rs` ~608–612)
3. Then JS: `agent.replaceMessages(primeTranscriptToConversation(...))`  
   → message history does **`messages.map` with no virtualization**  
   (`AiPanelChrome.tsx` ~713–728) → every `AiMessage` remounts/re-renders.
4. Plus `refreshSessionTree()` → another `get_prime_session_tree` IPC  
   (`usePrimeSessionTree.ts`).

**Why beachball fits:** Tauri 2 (`Cargo.toml` tauri 2.10) runs sync commands  
off the AppKit main thread, but the **webview JS thread** still blocks while  
awaiting and then while painting a long transcript. Long sessions amplify this.

**Not a full Chat remount:** `ChatHome` / `AiPanel` stay mounted; the expensive  
part is **message list replacement**, not `key={session}` remount of the panel.

---

### 2. Settings open — full panel remount of a huge tree (highest for “open Settings → hitch”)

**Path:**

- `dialogs.showSettings` → `SettingsPanel` with `if (!open) return null`  
  (`SettingsPanel.tsx` ~365–413) → **destroy when closed, rebuild when opened**.
- Inner tree is **~1583 lines** in one file plus `AiProviderSettings` (~425)  
  and `PrimeProviderStatusSection`, which on mount invokes  
  `get_prime_provider_status` (`PrimeProviderStatusSection.tsx` ~135–139).
- No vault-index or graph call on Settings open found; cost is **React mount +  
  provider status IPC**, not sync vault scan.

**Why beachball fits:** One-shot layout of a large dialog on a debug/slow  
webview. Instant-apply theme/accent handlers also call `onSave` mid-edit  
(same file) — secondary, not open cost.

---

### 3. Cold start — Prime ensure + vault load + window restore (+ Graph if Inbox open)

| Piece | Where | Risk |
|---|---|---|
| `ensure_prime_session_host` on Chat chrome | `usePrimeHostStatus.ts` ~98–130 (connect + 4s poll; retry ensure if not running) | Daemon spawn/wait up to 30s on first connect |
| Vault entries | `useVaultLoader.ts` (many effects; `reload_vault` / list path) | Large vault → big first React tree |
| Window frame restore (C60) | `lib.rs` ~436 + `window_state.rs` Ready path; skip if unchanged (`frame_needs_applying` ~125–127) | Mitigated blank-window class; still two restore *attempts* at launch |
| Graph under Notes | `App.tsx` `ConnectionsPanel` when Inbox/vault panel open (~1991–2002); default view `graph` (`ConnectionsPanel.tsx` ~45, ~142–144) | `call_rhizome_tool` / `rhizome_wiki_graph` + **ForceGraph3D WebGL** (`GraphView.tsx` ~107–136) |
| Menu-bar companion | `lib.rs` setup ~437–439 | Extra webview at launch (usually quiet) |
| MCP `ws-bridge` | Separate node procs (often from `/Applications` resources even when UI is debug — see 2359 handoff) | Background; not the click path |

**A1 note:** Inactive Graph/Mycelium **renderers** are no longer both mounted  
([0535 A1 slice](2026-09-05-0535-gpt-5-a1-lifecycle-slice.md)). That does **not**  
stop Graph when Connections shows the Graph tab under an open Inbox panel.

**Debug vs Applications:** Debug binary + Vite HMR stack is heavier and slower  
to start. Packaged release should cut cold-start and Settings hitch a lot;  
session-switch transcript cost remains in both.

---

### 4. Ambient load that makes every hitch worse (machine context)

Same-night process snapshot ([2359 lag diagnosis](2026-09-06-2359-composer-lag-diagnosis.md)):  
Cursor GPU/renderer hot, RAM nearly full (~22/24 GB), one `tauri:dev` stack.  
Beachballs appear sooner when free RAM is ~1–2 GB.

**Single-instance / same bundle id:** `tauri_plugin_single_instance`  
(`lib.rs` ~404–406). Verified earlier  
([0620 A1 routing](2026-09-05-0620-claude-sonnet-5-a1-connections-routing.md)):  
debug and `/Applications` share a bundle id — launching debug while the  
installed app is open can **silently kill the debug process** and focus the  
installed one. Quit Applications before `tauri:dev`. That session also saw  
panel switches feel instant on debug after Applications was quit — so some  
“beachball on debug” reports may have been the **installed** app, or dual-run  
chaos, not the debug binary alone.

---

### 5. Lower-ranked for these three moments

- **Session list scan of all logs** (`list_sessions` → `summarize_file` per  
  jsonl, `prime_sessions.rs` ~369–377): costly when the list **loads**, not on  
  every row click (list effect is mount-once in `PrimeSessionList.tsx` ~440–466).
- **C60 blank window:** compositing / double restore — related to launch pain,  
  different symptom than pinwheel-while-interactive.
- **MCP bridge / wiki index:** lazy on tool use; not on Settings open.

---

## Debug vs `/Applications` — expectation

| | `target/debug` via `pnpm tauri` | `/Applications` release |
|---|---|---|
| Native code | Unoptimized, slower IPC/FS | Optimized — expect **clearly** better |
| Front-end | Vite + HMR overhead | Bundled assets |
| Session switch shape | Same 3 awaits + full `messages.map` | Same shape, less CPU per step |
| Settings remount | Same | Same, usually snappier |
| Graph under Inbox | Same WebGL if open | Same |

**Expectation:** Applications should feel much smoother on load and Settings.  
If session switch still beachballs on a **long** transcript in Applications,  
suspect #1 (transcript remount) is real product work, not “just debug.”

---

## What to measure next (~20–40 min)

1. **Confirm binary** while reproducing: Activity Monitor → RhizomeAgent →  
   Sample / Open Files, or `ps` / `lsof` path (`debug` vs  
   `/Applications/.../MacOS/...`).
2. **Safari/WebKit or Chrome Performance** (devtools on the webview):  
   record Open Settings; record one session click. Look for long  
   **Scripting / Rendering** tasks around `AiMessage` / Settings mount.
3. **Console timestamps** (temporary, one session):  
   `performance.now()` before/after each of the three `callHost`s in  
   `handleSelectSession`, and after `replaceMessages`.  
   Rank: ensure vs switch vs read vs React paint.
4. **Instruments** (Time Profiler on the `.app` process): share of  
   WebKit / JavaScriptCore vs RhizomeAgent Rust during the hitch.
5. **A/B tonight:** same vault, Inbox **closed** (no Connections Graph) vs  
   Inbox open with Graph — if hitch shrinks, Graph/#3 is contributing.

---

## Immediate mitigations (tonight, no code)

1. **Quit** `/Applications/Rhizome Agent` if it is also open — use **one**  
   instance (single-instance plugin).
2. For daily drive: prefer **Applications** release build over `tauri:dev`  
   when not actively coding.
3. **Close Inbox** (or Connections → Graph placement **Off**) so WebGL Graph  
   is not running under Notes while chatting.
4. Free RAM: close extra Cursor agent panes / heavy browsers (see 2359 lag  
   note) so beachballs have less room to appear.
5. If a session is huge, expect switch cost; try a short session as control.

---

## Suggested fix order (later session — not done here)

1. Optimistic UI / don’t await `ensure` when host already `running`.
2. Virtualize chat message list (or windowed remount).
3. Keep Settings mounted but hidden, or lazy-split provider sections.
4. Default Connections Graph off until the tab is selected once.
5. Finish A1 native timing packet against the exact debug PID.

No 5-line “sync-on-AppKit-main” smoking gun found worth shipping tonight;  
Tauri 2 + the paths above point to **await + JS paint + debug + Graph**,  
not an accidental `block_on` in `lib.rs` setup.
