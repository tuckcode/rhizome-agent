---
session: 2026-09-06-2359
model: Composer
description: >-
  Verdict: Rhizome Agent UI is pnpm tauri dev (debug), not the packaged
  Applications .app; path and plain-language what “tauri shit” means
---

# Dev vs packaged — what is running now

**Origin:** Composer · 2026-09-06 23:59 · stay-busy (no kill, docs only)

## Verdict (one sentence)

**Rhizome Agent’s main window is a `pnpm tauri` / `tauri dev` debug binary, not the installed packaged `.app`.**

Running binary path:

`~/code/projects/rhizome-agent/src-tauri/target/debug/RhizomeAgent`

(PID **14296**, ~1h15m uptime at check time.)

## Plain language

**“pnpm / npm tauri shit”** = developer mode.

- Command that works here: `pnpm tauri dev` (or `pnpm run tauri -- dev`).
- Builds a **debug** copy under `src-tauri/target/debug/`.
- Watches files and **live-reloads** when code changes.
- Slower and heavier than a real install.
- Good for daily coding; not the “double-click in Applications” product.

**Packaged `.app`** = the real installed app.

- Built with `pnpm tauri build` (there is no separate `tauri:dev` script name in `package.json`).
- Lands under `src-tauri/target/release/bundle/macos/` and/or `/Applications/Rhizome Agent.app`.
- No file-watching rebuild loop; normal “product” launch.

## Checks run

| Check | Result |
|---|---|
| Process | PID 14296 = `target/debug/RhizomeAgent`; parent = `pnpm run tauri dev` → `@tauri-apps/cli` `tauri.js dev` + Vite |
| Absolute path (`lsof`) | `~/code/projects/rhizome-agent/src-tauri/target/debug/RhizomeAgent` |
| `/Applications` MacOS binary | **Not running** (bundle exists; bundle id `ai.rhizome.agent`) |
| Release bundle on disk | Present: `src-tauri/target/release/bundle/macos/Rhizome Agent.app` |
| `package.json` scripts | `"tauri": "tauri"` only — **no** `tauri:dev` alias; use `pnpm tauri dev` / `pnpm tauri build` |
| Recent terminals | Failed attempts at `pnpm tauri:dev` (“not found”); live session is `pnpm run tauri dev` / `pnpm tauri dev` |

## Side note (not the UI)

A couple of **MCP helper** node processes still point at `/Applications/Rhizome Agent.app/Contents/Resources/mcp-server/…`. Those are leftover helpers from the installed bundle, not the Chat window you are looking at. The UI itself is debug.
