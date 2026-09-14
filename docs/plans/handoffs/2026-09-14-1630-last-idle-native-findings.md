---
session: 2026-09-14T16:30-05:00
model: Grok 4.6 (Cursor)
description: >-
  Last-idle restore: source needs no vaultPath. Native last-conversation
  relaunch still NOT RUN. Packaged app leftover 476756c. No launch. No code.
commits: none
---

# Last-idle native findings — 2026-09-14 16:30

**Origin:** Cursor Grok 4.6 · read `src/hooks/usePrimeSessionRestore.ts` + `docs/plans/morning-native-observer.md` §5 · no commit · no launch

Did not edit product code. Did not launch `/Applications/Rhizome Agent.app`. Did not Cmd+Q or cold-launch.

## Source: restore needs no vault path

Last conversation lives on Prime disk (the session log folder), not in a vault (the notes folder).

`usePrimeSessionRestore` options are `enabled`, `host`, `onTranscript`, `onOpen`, optional `native`. No `vaultPath`. Callers do not pass one.

Idle path (host up, nothing attached yet):

1. `list_prime_session_summaries` — no vault argument
2. `decidePrimeSessionRestore` picks last disk log (`idle-disk`)
3. `onOpen(session)`

Live path (already rejoined): `read_prime_session_transcript` with `{ path: sessionPath }` only.

Unit lock: `usePrimeSessionRestore.test.ts` — “does not require a vault path — last conversation lives on Prime disk” (`source` must not contain `vaultPath`). Same lock on `primeSessionRestore.ts` in `leftover-idle-restore.test.ts`.

That is **not** the native check.

## Native last-conversation relaunch — NOT RUN

Procedure: [`morning-native-observer.md`](../morning-native-observer.md) §5. Packaged app only. Vite / `mock-tauri` is not this path.

1. Open a real chat. Note the title.
2. **Cmd+Q**. Cold-launch `/Applications/Rhizome Agent.app`.
3. The same conversation should be selected.

| Check | Status |
|---|---|
| Last chat restored | **NOT RUN** |

**Session stamp 16:30:** still **NOT RUN**. Observer stamp at 16:26 said the same. App still `476756c`. Do not launch from an agent. Source last-idle needs no vault path. That is not this check.

## Packaged app

| Field | Value |
|---|---|
| Daily-drive build | **`476756c`** (leftover — not rebuilt this session) |
| Path | `/Applications/Rhizome Agent.app` only |
| Not valid | Vite / `mock-tauri` |

## Not done

- Launch / quit / rebuild `/Applications`
- Tick the §5 table in the observer file
- Code change or close from units alone
