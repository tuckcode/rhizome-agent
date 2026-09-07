---
session: 2026-09-07-0110
model: Composer
description: Switch daily-drive from debug pnpm tauri to packaged /Applications Rhizome Agent.app (lag mitigation)
---

# Switch daily-drive → `/Applications/Rhizome Agent.app`

**Origin:** Composer · 2026-09-07 · switch-to-applications

## Goal

Stop fighting lag on debug `pnpm tauri` / `target/debug/RhizomeAgent`. One copy only under Applications (same bundle id).

## Before

| Role | PID | Path / command |
|---|---|---|
| Debug app | **14296** | `/Users/dtc/code/projects/rhizome-agent/src-tauri/target/debug/RhizomeAgent` |
| tauri.js dev | 14090 | `node …/@tauri-apps/cli/tauri.js dev` |
| vite | 14219 | `node …/vite/bin/vite.js` |
| pnpm tauri | 14073 | `node /opt/homebrew/bin/pnpm run tauri dev` |
| debug ws-bridge | 25412 | `…/src-tauri/resources/mcp-server/ws-bridge.js` (child of 14296) |
| Apps MCP leftovers | 1880, 2025 | `/Applications/Rhizome Agent.app/Contents/Resources/mcp-server/index.js` (no Apps main binary) |

No `/Applications/.../MacOS/RhizomeAgent` was running before the switch.

## Actions

1. Confirmed debug stack + Apps MCP leftovers; packaged `.app` present at `/Applications/Rhizome Agent.app`.
2. Attempted `osascript` quit of `RhizomeAgent` (did not stop PID 14296).
3. `SIGTERM`/`SIGKILL` on debug RhizomeAgent + tauri/vite/pnpm tree. Did **not** wipe vault data. Did **not** start `tauri:dev`.
4. `open "/Applications/Rhizome Agent.app"`.

## After

| Role | PID | Path / command |
|---|---|---|
| Packaged app | **84559** | `/Applications/Rhizome Agent.app/Contents/MacOS/RhizomeAgent` |
| Apps ws-bridge | 84601 | `/Applications/Rhizome Agent.app/Contents/Resources/mcp-server/ws-bridge.js` |
| Apps MCP (prior) | 1880, 2025 | still present; Cursor/extension-side MCP, not a second app binary |

- Debug `target/debug/RhizomeAgent`: **gone**
- `tauri.js` / vite / `pnpm run tauri`: **gone**
- Exactly **one** RhizomeAgent binary, path under `/Applications/...`

## Result

- **success:** yes
- **running binary path:** `/Applications/Rhizome Agent.app/Contents/MacOS/RhizomeAgent`
- **PID:** 84559
