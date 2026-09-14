# C66 — agent profile (instructions)

**Status:** agreed 2026-09-06, not built. Awaiting two product calls.  
**Origin:** Atticus · HANDOFF C66.  
**Pickup:** [`BOARD.md`](../BOARD.md). Not harness-composition slice 3.

---

## Done / now / next

- **Done:** named as a Settings need. Distinguished from three lookalikes.
- **Now:** still docked (16:20). Do not encode a store this window (C66).
- **Next:** Settings page after those two calls. No Prime `USER.md`.

**Done when:** Chat uses the profile Atticus typed, for the agent he meant, and it is stored in the vault (or an explicit app store if he picks app-wide).

---

## What it is

How the agent should **respond**: rules, tone, standing instructions — for whichever agent.

## What it is not

| Lookalike | Why not |
|---|---|
| Vault `AGENTS.md` | project/repo conventions for this tree |
| Settings → AI agents | which model / provider |
| Composition slice 3 | Prime tool allow-lists (`pi-permission-modes` etc.) |
| Prime `USER.md` / Hermes `SOUL.md` | second memory authority (ADR-0168) |

## Open (Atticus)

1. One profile vs per-agent.
2. App-wide vs per-vault.
3. New Settings section vs under the existing AI agents page.

Until those are picked, do not encode a store.

## Smallest slice after the calls

One Settings form, one vault (or app) file, Chat prepends it to Prime turns the same way other products prepend custom instructions. Completion: a saved sentence appears in the next Chat turn’s effective instructions (probe Prime / log), and survives relaunch.
