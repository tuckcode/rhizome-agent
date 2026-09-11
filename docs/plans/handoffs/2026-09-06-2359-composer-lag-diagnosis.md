---
session: 2026-09-06-2359
model: Composer
description: Laptop lag diagnosis — Cursor CPU/RAM dominates; one tauri:dev stack idle; 54G Rust target; no stuck push/playwright
---

# Laptop lag diagnosis (Rhizome Agent work)

**Origin:** Composer · 2026-09-06 ~23:59 · read-only process/disk check  
**Machine:** ~24 GB RAM, 15 CPUs · snapshot ~00:00 local · load avg ~2.4 · **PhysMem ~22G used / ~1.5G free** (compressor ~1.4G; no swap thrash yet)

No kills performed. No builds started. No push.

---

## Ranked causes (likely impact → quit advice)

### 1. Cursor itself (highest — live CPU + RAM)

| Piece | Snapshot | Notes |
|---|---|---|
| Cursor GPU helper | ~40% CPU | Persistent; WindowServer also ~40% |
| Cursor main renderer | ~20–25% CPU, **~1.5 GB RSS** | One heavy window |
| Extension hosts | Agents Window + rhizome-agent | ~0.9 GB combined |
| **All Cursor procs** | **~4.3 GB RSS**, often **>100% CPU** combined | 19–23 helpers |

**What to quit / ease:** Close unused Cursor Agent chats/windows; reload window if GPU stays hot; pause extra agent workers. This is the main “feels laggy” driver right now — not Rhizome compiling.

### 2. RAM almost full (high — makes everything stutter)

~22 GB of 24 GB in use, only ~1.5 GB free. Even idle apps feel slow when free RAM is this low. Cursor alone holds ~4 GB; everything else piles on.

**What to quit:** Extra browsers, unused Electron apps, FluidVoice if not recording (it spiked ~40% CPU earlier, then went idle), second IDE windows. Restart Cursor once if free RAM stays under ~2 GB.

### 3. One native `tauri:dev` stack (medium — RAM, not CPU right now)

Alive ~1h15m, **idle CPU (~0%)**, still holding memory:

- `pnpm run tauri dev` → `tauri.js dev` → **1× vite** → **1× `target/debug/RhizomeAgent`**
- MCP `ws-bridge.js`
- **2× `prime-agent`** (+ daemon catalog node) — ~300+ MB together

Not duplicated (only one RhizomeAgent binary). Fine if you’re QA’ing the app; **quit the tauri:dev terminal** when you’re not.

### 4. Rust `target/` disk bulk (medium-low for *lag*, high for disk/heat on rebuilds)

`src-tauri/target` ≈ **54 GB**:

| Path | Size |
|---|---|
| `target/debug` | ~37 GB |
| `target/llvm-cov-target` | ~14 GB |
| `target/release` | ~2.8 GB |

Disk free space is fine (~481 GB). This does **not** burn CPU while idle, but coverage/debug artifacts make the next `cargo llvm-cov` / clean rebuild painful. Optional later cleanup: `cargo clean` or trim `llvm-cov-target` when no push is planned (do **not** clean while `tauri:dev` is running).

### 5. Not the problem right now

- **No** husky / `git push` / pre-push still running  
- **No** Playwright / smoke browsers  
- **No** active `cargo` / `rustc` compile  
- **Not** multiple RhizomeAgent debug apps (only one)  
- Stale terminal metadata mentioned an old `pnpm dev --port 5201`; that PID is **gone** — only the tauri-linked vite remains  

---

## Process counts (snapshot)

| Kind | Count | Idle? |
|---|---|---|
| `pnpm`/`tauri` dev chain | 1 stack | yes (~0% CPU) |
| `vite.js` | 1 | yes |
| `target/debug/RhizomeAgent` | 1 | yes |
| `prime-agent` | 2 | yes |
| Playwright / husky push | 0 | — |
| Cursor-related processes | ~20+ | **no** (GPU + renderer hot) |
| node (repo-related) | ~9–13 | mostly idle |

---

## Plain-language summary

The laptop is not stuck in a Rhizome build or a leftover push test. **Cursor’s GPU and chat window are chewing CPU**, and **RAM is nearly full**, so the Mac has little headroom. One Rhizome native debug session and two Prime daemons sit quietly in the background. The 54 GB Rust build folder is bulky but not spinning the fans by itself tonight.

**Best first moves:** close extra Cursor agent panes → quit FluidVoice if unused → quit `tauri:dev` when not testing the app → optionally clean `llvm-cov-target` later (not now if you need the next push).
