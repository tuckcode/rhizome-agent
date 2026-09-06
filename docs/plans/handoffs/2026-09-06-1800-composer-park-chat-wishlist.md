---
session: 2026-09-06T23:00Z
model: Composer
description: >-
  Atticus asked not to lose Chat ideas from this session: per-message
  timestamps, composer up-arrow history, plus providers/OAuth and first-run
  vault already named in prefs. Parked as C70/C71 in HANDOFF + NEXT §0.
commits: uncommitted
---

# Park Chat wishlist (C70 / C71)

**Origin:** Composer · 2026-09-06

## Why

Atticus: do not forget message timestamps and the other ideas from this
session / prior asks. They are not daily-drive *blockers* for Chat↔Prime
tooling, but they must stay on the tracked list or they get rediscovered and
never shipped.

## Parked

| Id | Ask | Notes |
|---|---|---|
| **C70** | Per-message timestamps on Chat bubbles | `AiAgentMessage` has no time field; logs have `timestamp`. |
| **C71** | Composer ↑ previous-prompt history | With #51 Tab remainder; CLI-style. |
| — | DeepSeek API + Nous Portal in Settings | Already in `AGENTS.md` prefs; Settings gap. |
| — | Anthropic / xAI OAuth reconnect | Terminal `prime-agent --provider …` until daemon grows auth. |
| — | First-run = cleaned Rhizome Vault scaffold | Prefs; not started. |
| — | Selection right-click Copy | **Shipped in tree** (native allowlist). |

## Daily-drive goal

Not complete. Core mid-turn/tooling path is in better shape; wishlist + C57 +
import UI + providers remain.
