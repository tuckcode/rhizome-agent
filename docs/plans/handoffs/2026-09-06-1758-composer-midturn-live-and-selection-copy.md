---
session: 2026-09-06T22:58Z
model: Composer
description: >-
  Atticus live mid-turn MIDTURN_QUEUE_PROBE got its own reply. Chat had no
  right-click Copy on selected text — WKWebView native menu blocked app-wide;
  allowlist messages + composer.
commits: uncommitted
---

# Mid-turn live proof + Chat selection Copy

**Origin:** Composer · 2026-09-06

## Evidence

Atticus pasted a live Chat turn: ask about latest rhizome-agent note → reply →
`MIDTURN_QUEUE_PROBE` while Working → second reply acknowledging the probe.
Daily-drive mid-turn path is no longer “unit tests only.”

## Selection context menu

`main.tsx` prevented every native `contextmenu` in Tauri so WKWebView would
not steal clicks from custom menus. Chat had no custom menu, so highlight →
right-click did nothing (keyboard Copy only).

Fix: `shouldAllowNativeContextMenu` allowlists Chat message / response /
composer / tldraw (+ `data-allow-native-context-menu` escape hatch).

## Still open for daily-drive goal

C57 Limited tools; session-import UI; Anthropic/xAI reconnect; packaging /
Windows deferred. Do not mark the goal complete.
