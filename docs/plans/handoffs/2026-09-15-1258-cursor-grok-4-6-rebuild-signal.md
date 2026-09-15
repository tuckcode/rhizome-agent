---
session: 2026-09-15T12:58-05:00
model: Grok 4.6 (Cursor)
description: >-
  Deleted old Applications app, rebuilt with Signal Dock icons (ADR-0172)
  from tip 66c3cb0 plus uncommitted icon set; launched 12:58.
commits: uncommitted-icons-and-docs
---

# Rebuild + Signal Dock — 2026-09-15 12:58

**Origin:** Cursor Grok 4.6 · 2026-09-15 12:58 · rhizome-ship rebuild.

## Rebuild

| Item | Value |
|---|---|
| HEAD / origin | `66c3cb0` |
| Tree extras | Signal OS icons (uncommitted) + ADR-0172 |
| Prior app | Removed `/Applications/Rhizome Agent.app` before install |
| Bundle | `src-tauri/target/release/bundle/macos/Rhizome Agent.app` |
| Installed | `/Applications/Rhizome Agent.app` |
| Binary mtime | 2026-09-15 12:58 |
| `icon.icns` | matches repo Signal master (`cd3c39e4…`) |
| Codesign | adhoc `-` |
| Launch | pid from `/Applications/.../RhizomeAgent` |

## Notes

- Dock may need a moment / Dock restart for Finder to refresh the icon
  cache; if stale, `killall Dock` once.
- Icon + ADR still need a **commit** (separate verb) before origin matches
  the packaged look.
