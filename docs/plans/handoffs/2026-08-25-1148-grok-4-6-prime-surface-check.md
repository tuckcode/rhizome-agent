---
session: 2026-08-25T11:48-05:00
model: Grok 4.6 (Cursor)
description: >-
  Mechanical Prime adapter surface check so we notice when Prime-agent
  ships. Snapshot is 0.8.0 / 102 daemon / 30 spoken. Do not clone upstream.
---

# Track Prime-agent updates without ingesting the repo

User-facing "a newer Prime is out" already exists (`check_prime_update`).
That does not keep the *adapter* honest: coverage prose was still quoting
0.7.4 / 105 commands after this machine had 0.8.0 / 102.

## What landed

- `docs/prime-adapter-surface.json` — last mechanical read of
  `DAEMON_COMMAND_TYPES` vs the `"type"` strings we send
- `pnpm prime:surface` — installed package vs snapshot
- `pnpm prime:surface:github` — GitHub `releases/latest` tag vs snapshot
- `pnpm prime:surface --update` — rewrite the snapshot
- AGENTS.md: Prime adapter work runs this; do not dump the package into
  context

Not in the push gate (needs a local install; GitHub is network).

## Still open

- Queue visibility (`get_queue`) was next Prime product slice; this
  interrupted it
- Snapshot is not a parity target — `neverCall` + product surfaces still
  apply
