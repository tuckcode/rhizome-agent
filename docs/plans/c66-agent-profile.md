# C66 — agent profile (instructions)

**Status:** built 2026-09-27. One profile, app-wide, on the AI agents page.  
**Origin:** Atticus · HANDOFF C66.  
**Pickup:** [`BOARD.md`](../BOARD.md). Not harness-composition slice 3.

---

## Done / now / next

- **Done:** named as a Settings need. Distinguished from three lookalikes.
- **Now:** one textarea on the AI agents page. App settings keep the text.
- **Next:** none for this slice. No Prime `USER.md`.

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

## Decided (Atticus, 2026-09-27)

1. One profile.
2. App-wide.
3. On the existing AI agents page.

## Smallest slice after the calls

One Settings form, one vault (or app) file, Chat prepends it to Prime turns the same way other products prepend custom instructions. Completion: a saved sentence appears in the next Chat turn’s effective instructions (probe Prime / log), and survives relaunch.
