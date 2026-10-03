# Closed threads archive

Closed C-number threads moved out of `docs/HANDOFF.md` verbatim to keep it
under its 900-line limit. Newest move first.

## Moved 2026-10-03

- **C32-RESOLVED (2026-08-22): both docs cover Prime now.** `ARCHITECTURE.md`
  gained a *Prime Agent* section under AI System — that it is a **daemon
  client, not a subprocess** (so the `cli_agent_runtime.rs` mental model on the
  same page actively misleads), the `prime_session_host.rs` vs
  `prime_sessions.rs` split and why confusing them is the classic mistake, the
  lazy session lifecycle and its command order, a map of the eight `prime_*`
  modules and the frontend hooks, and what Rhizome does not own.
  `ABSTRACTIONS.md` gained a *Prime Session* section: the two data sources and
  the log-path join between them, `PrimeSessionStatus`, and the uuidv7 trap in
  session ids. Written from a session that had just re-derived all of it, which
  is the point — the original entry below is kept for the reasoning.

- **C32-WAS-OPEN: `ARCHITECTURE.md` and `ABSTRACTIONS.md` contain no mention of Prime at all.** Confirmed 2026-08-19 by grepping both files for `Prime` — zero hits in either, while `src-tauri/src/prime_session_host.rs` alone is ~4,600 lines and the daemon client, session host, goal, fork, compact, heartbeat and roster surfaces all live outside the docs. AGENTS.md requires updating these two after "any Tauri command, new component/hook, data model change, or new integration", so every harness session has been in technical violation of that rule and every one of them has let it pass. The practical cost: a new session has no structural map of the harness and re-derives it from source each time — this session spent a meaningful chunk of its budget rediscovering that `prime_session_host.rs` is a full daemon client and that `prime_sessions.rs` is a *disk* reader that cannot answer "what is running". Do not fix this as a side quest inside a feature commit; it is its own piece of work.

- **C35-RESOLVED (2026-08-20): `npx tsc --noEmit` typechecked nothing at all.**
  Not "weaker than `tsc -b`" as first written — a no-op. Measured: appending
  `export const X: number = "nope"` to `src/lib/uiPreference.ts` and running
  `npx tsc --noEmit` exits **0**; `tsc -b` reports TS2322 on the same file. The
  root `tsconfig.json` is `"files": []` plus two project references, and
  `--noEmit` does not follow references.

  Every "tsc clean" this repo's sessions have reported from that command was
  evidence of nothing. It had already been noticed **three times** in this file
  (a gate gotcha at the 2026-08-06 and 2026-08-08 entries, and again when a
  push failed on `tsc -b` after `--noEmit` passed) and written down as a trap
  each time, while `AGENTS.md` kept documenting the broken command — which is
  precisely the failure mode the C-number rule exists to stop.

  Fixed by making the right command the easy one: **`pnpm typecheck`** (`tsc
  -b`), now what `AGENTS.md`, `CONTRIBUTING.md` and `CROSS-MODEL-HANDOFF.md`
  all tell you to run.

- **C41-RESOLVED (2026-08-22): `pnpm test:mcp` never ran `mcp-server/test.js`.**
  The script globbed `mcp-server/*.test.js`, which matches
  `tool-service.test.js` and `vault-events.test.js` but not `test.js` — so the
  stdio-lifecycle, vault, `vault-path`, `agent-instructions` and `ws-bridge`
  suites, **49 tests**, ran on no gate. This is the mirror image of the July
  finding that `tool-service.test.js` was ungated because vitest's `include`
  did not reach `mcp-server/`: both times the fix was to the glob, and both
  times everything was green while it was unreachable. The script now names
  `test.js` explicitly (`node --test mcp-server/test.js mcp-server/*.test.js`);
  `pnpm test:mcp` went from 16 tests to 67. Do **not** widen it to
  `mcp-server/*.js` — that imports `index.js`, which starts the server and
  hangs forever.
