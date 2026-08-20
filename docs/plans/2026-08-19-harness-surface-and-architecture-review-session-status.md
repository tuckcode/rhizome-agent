# Session status — 2026-08-19 (Claude Opus 5: #13, #9, #14, C12, and the architecture review)

Long session. Started as "execute a stale handoff plan", ended with three
harness features shipped, the repo's oldest open thread closed, and the first
candidate of an architecture review applied.

## Shipped — 13 commits, `e75a161..53e8131`, every push green

| Commit | What |
|---|---|
| `ee973a3` | **C29** verified independently and shipped (was staged, uncommitted, unverified) |
| `3f6b0e3` `8efb520` `8d31eb6` | **#13** menu-bar running-session roster, + the duplicate-title fix |
| `4a64371` `1444be6` `163403f` `7c5f7c9` | **#9** model + thinking level as one strip control, + the refresh fix |
| `934f1cc` | **#14** see, pause and cancel scheduled work |
| `5ff067f` `5936ec7` `38cd6b4` | **C12** corrected, closed, and its real leak vector recorded |
| `53e8131` | **`callHost`** — architecture review candidate 1 |

Issues **#19, #20** closed with evidence (shipped earlier, never closed).

## The single most useful thing to carry forward

**Every real bug this session was found by a human using the app. None by the
test suite.** Three for three:

1. #13 shipped with two roster rows both reading `dtc` — indistinguishable.
2. #9 shipped where setting a thinking level left the strip showing the old
   value indefinitely.
3. #14's read path had been broken since it was written — every heartbeat
   parsed to all-`None`.

The common shape: **the tests asserted that the right request went out on the
wire, and never that the resulting screen was one a person could act on.** In
#9's case there was a test proving `set_thinking_level` was sent with the right
level — and the bug was that nothing re-read the cache the UI polls. The wire
was always correct.

Write at least one assertion per feature about what the user ends up seeing.

## Probe-first paid for itself four times (CROSS-MODEL-HANDOFF §18)

Every one of these would have shipped broken on documentation alone:

| Assumed | Actually |
|---|---|
| `SessionSummary.sessionName` names a session | Declared in the `.d.ts`, **never sent**. Titles fall back to `firstMessage` |
| `heartbeats_list` returns job objects | Wraps each in a `{"job": …}` envelope — every field parsed to `None` |
| `schedule` is a string | An **object** `{kind, expression, intervalMs}` — cadence never displayed |
| `model_catalog` is callable (it is in `serverCapabilities`) | `Unknown daemon command`. Advertised ≠ routable |

**Check `daemon-mode.js` for a real `case` handler, not just the `.d.ts`.**
`cron_list` returns *both* heartbeats and cron jobs tagged by `source`, so it
replaces two calls; that is how #14's two kinds are distinguished.

## Architecture review (Atticus ran it; report is worth re-reading)

Scoped to the Prime harness surface across the last 60 commits. Five
candidates; **candidate 1 is done** (`53e8131`). Recommended order for the
rest: **3, then 4**.

1. ~~One adapter selection, not forty~~ — **done**. `src/lib/callHost.ts`
2. **The Prime command table** (worth exploring) — a command name is a bare
   string in four unlinked places; 35 uncoverable `#[cfg(desktop)]`
   pass-throughs are what eat the Rust coverage margin. ADR-0106 is precedent
3. **Absorb the daemon envelope** (strong, self-contained, Rust-only, no
   cross-cutting risk) — the `success` check + `response_error` + `data`
   unwrap triple repeats verbatim in 18 functions of `prime_session_host.rs`
4. **One harness snapshot, one poll** (strong) — three pollers, three
   commands, three hand-mirrored TS types, one global mutex, and
   `thinkingLevel` served by **two** of them. That duplication is the
   structural cause of the bug `7c5f7c9` patched symptomatically
5. **Harness actions out of the panel** (worth exploring) — `AiPanel.test.tsx`
   is 529 lines and never touches fork/compact/export/switch. Note its design
   detail: `callHost` **injected, not imported**, so tests substitute a fake
   adapter rather than mocking a module

## Environment facts that cost time

- **`prime-agent update` does not restart the daemon.** After updating, the
  CLI reports the new version while `prime-agent status` shows the old one
  flagged `stale`. Restart with `prime-agent shutdown --force` (plain
  `shutdown` refuses without a TTY), then `prime-agent --mode daemon`.
- Currently on **0.7.4**, daemon restarted onto it.
- **The model catalog is baked into the installed bundle**
  (`dist/core/model-resolver.js`), so the picker's model list is capped by the
  installed Prime version. 183 models; no Grok 4.6 in 0.7.4.
- **Model and thinking level are per-session.** New sessions start from
  `~/.prime/agent/settings.json` → `defaultProvider` / `defaultModel` /
  `defaultThinkingLevel`. Picking a model does not persist to the next session.
- Agent-driven native QA needs the **screen unlocked** — `desktop_unlocked:
  false` from cua-driver means capture returns black while `list_windows`
  still works, which reads as a code failure and is not one.

## How to verify a model actually switched

Never ask the model. It claimed to be Claude while served by `big-pickle`, and
separately "corrected" a right answer into a wrong one. Every assistant message
in `~/.prime/agent/sessions/*.jsonl` records the `provider`/`model`/`usage` that
actually produced it:

```bash
grep -o '"provider":"[^"]*","model":"[^"]*"' ~/.prime/agent/sessions/*.jsonl | tail -5
```

## Open

- **#26** update Prime from inside Rhizome — `prime-agent update` exists,
  only the button is missing
- **#27** session list as a dockable sidebar — design decided, mechanism
  verified (`set_session_name` on create makes origin exact)
- **#28** history list is half empty sessions, all "Untitled"
- **#29** redact credentials before chat content is written to the vault **and
  pushed to a remote** — the detector already exists, wired only to telemetry
- **C31** an unreproducible `pnpm test` unhandled error (1 run in 4)
- **C32** `ARCHITECTURE.md` / `ABSTRACTIONS.md` say nothing about Prime
- **C33** `npx tsc --noEmit` typechecks **no test file at all**
- Architecture candidates 2–5

Rust coverage sits at **85.08%** against an 85% gate. It is not a landmine so
long as new Rust ships with tests — that discipline held all session and the
number ended higher than it started.
