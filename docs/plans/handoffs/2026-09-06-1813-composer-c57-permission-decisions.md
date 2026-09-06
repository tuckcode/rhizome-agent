---
session: 2026-09-06-1813
model: Composer
description: Atticus closed C57 — CLI Limited tools default, Prime toggle hidden, keep Limited tools name
---

# C57 — permission mode product choices

**Origin:** Composer · 2026-09-06 · Atticus “ship that”

## Decision (Atticus)

1. **CLI agents** — new sessions / vaults default to **Limited tools** (`safe`).
2. **Prime (Chat)** — permission toggle stays **hidden**; Prime always Power User.
3. **Naming** — keep **Limited tools** / **Power User** (do not restore “Vault Safe”).

## Code check

Already matched before this doc close — no code delta required:

- `DEFAULT_AI_AGENT_PERMISSION_MODE = 'safe'`
- `DEFAULT_PRIME_PERMISSION_MODE = 'power_user'` + `hidePermissionMode={isPrimeTarget}`
- Labels: `Limited tools` / `Power User` in `aiAgentPermissionMode.ts`

## Docs

- `HANDOFF.md` C57 → RESOLVED
- `NEXT.md` §0 / decide table — C57 closed

## Not this thread

Commit still needs Atticus ask. Session-import UI / first-run scaffold / tauri reload remain other tracks.
