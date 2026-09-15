---
session: 2026-09-15T12:30-05:00
model: Grok 4.6 (Cursor)
description: >-
  Applications rebuild to 66c3cb0 plus native W4 / #46 evidence in progress.
commits: uncommitted-docs
---

# Rebuild + native day — 2026-09-15

**Origin:** Cursor Grok 4.6 · 2026-09-15 12:30 · rebuild landed.

## Rebuild

| Item | Value |
|---|---|
| HEAD / origin | `66c3cb0` |
| Bundle | `src-tauri/target/release/bundle/macos/Rhizome Agent.app` |
| Installed | `/Applications/Rhizome Agent.app` |
| Binary mtime | 2026-09-15 12:30 |
| Codesign | adhoc `-` |
| Launch | pid running from `/Applications/.../RhizomeAgent` |

Prior app `476756c` (2026-09-12) replaced.

## Native evidence (in progress)

### C64 — first 2s subhead

| Launch | Install copy in first 1–2s? | Notes |
|---|---|---|
| 1 (post-install open) | No (observed ~3s in) | UI: Checking AI agent availability → Idle • ready; Prime green. No `npm i -g prime-agent` |
| 2 | | |
| 3 | | |

### Send / hide / #46

Pending after C64 ×3.
