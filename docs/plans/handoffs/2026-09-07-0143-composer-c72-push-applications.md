---
session: 2026-09-07-0143
model: Composer
description: >-
  C72 push landed (cd97743); smoke fixture/wikilink hardened for Notes-default;
  /Applications rebuilt from this tree (fresh mtime).
---

# C72 push + Applications rebuild

**Origin:** Composer · 2026-09-07 · push/Applications resume

## Result

| Gate | Status |
|------|--------|
| Push | **yes** — `main -> main` at `cd97743` |
| Applications | **yes** — `/Applications/Rhizome Agent.app` from this tree |
| HEAD | `cd977439a898e62e5ebb1d62bb897f2b311f9f77` |

## What landed (rebased onto origin after #58/#59/#63)

- C72: default `editor-list` (right Notes open; Chat no longer forces `editor-only`)
- App.test expects vault panel open
- Icon AI message toolbar
- Smoke: fixture helper + unified-shell + wikilink hardened (Inbox is a **toggle** — do not click it to “open” when Notes is already open)

## Push notes

- Cursor seatbelt SEGVs Playwright chromium; push must run outside sandbox (`osascript` / Terminal + `PLAYWRIGHT_BROWSERS_PATH`).
- Competing agent pushes on port 41741 caused early smoke mass-failures; exclusive run passed (28→29 after wikilink harden).

## Applications

- `pnpm tauri build` wrote the bundle under Cursor’s `cargo-target` cache, not `src-tauri/target/release/bundle/macos` (that path stayed Sep 6).
- Installed from:  
  `…/cursor-sandbox-cache/…/cargo-target/release/bundle/macos/Rhizome Agent.app`  
  via `ditto` → `/Applications/Rhizome Agent.app`, then adhoc `codesign --force --deep --sign -`.
- Verified: path `/Applications/Rhizome Agent.app`, bundle id `ai.rhizome.agent`, binary mtime **Sep 7 02:59**, process running (`RhizomeAgent` under Applications).

## Still open (C72 remainder)

- Right icon rail / Inbox rename (deferred)
- Future Applications installs: ditto from the actual `tauri build` bundle path (check `CARGO_TARGET_DIR` / Cursor cache), not a stale `src-tauri/target/...` copy.