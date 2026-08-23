---
type: ADR
id: "0167"
title: "Client-owned Prime sessions by default; background work by explicit grant"
status: active
date: 2026-08-23
supersedes: "ADR-0163 lifecycle policy; retains its daemon-client transport decision"
---
## Context

ADR-0163 correctly moved Rhizome from an owned RPC child to Prime's daemon
protocol. It combined that transport decision with a separate product policy:
closing Rhizome would detach while every session remained resident and kept
working.

Those are not the same decision. A daemon can remain available without any
agent work remaining active. Treating daemon residency, session residency, and
permission for background execution as one lifetime makes closing the UI an
implicit grant of autonomy.

The product moved away from ADR-0163's lifecycle policy without documenting the
new model:

- the main window's close button hides the window while leaving Rhizome attached;
- full app quit kills Rhizome's attached session by default;
- a global `keep_sessions_running_on_quit` setting changes quit to detach;
- comments and architecture docs still claim window close always detaches and
  sessions always survive.

That implementation is safer than unconditional residency during an orderly
quit, but it is only best effort. Rhizome currently creates every Prime session
with `lifecycle: "resident"`. If Rhizome crashes or is force-killed, no quit
handler runs and the resident worker can continue without visible UI.

Prime 0.7.4 already exposes the missing lifecycle primitive. Verified against
the installed daemon implementation:

- `DaemonSessionLifecycle` is `"resident" | "client_owned"`;
- a client-owned worker records its owning protocol client;
- when its owner disconnects, the daemon schedules worker cleanup after a
  30-second reconnect grace period;
- `promote_owned_session` converts client-owned work to resident work;
- `complete_owned_session` stops client-owned work explicitly.

Rhizome does not currently advertise the `client_owned_sessions` capability and
always sends `"resident"` in its `create` command.

## Decision

**Prime remains shared background infrastructure, but Rhizome-created sessions
are foreground-owned by default. Background execution requires an explicit,
visible, revocable grant.**

The lifecycle policy is:

1. **Available is not active.** Prime's daemon may remain running when Rhizome
   is closed. That means the service is reachable, not that an agent is working.
2. **New sessions are client-owned.** Rhizome creates them with Prime's
   `client_owned` lifecycle. Unexpected client loss therefore stops their worker
   after Prime's reconnect grace period while preserving the transcript.
3. **Idle window close is quiet.** Rhizome detaches its session host and hides
   the window. The client-owned worker expires; reopening resumes the durable
   conversation through a new foreground-owned worker.
4. **Active window close asks.** The default action is **Stop and close**.
   **Keep working** is secondary and explicitly promotes that session to
   `resident` before Rhizome detaches. Cancelling leaves the window open.
5. **Full Quit follows the same ownership rule.** Foreground-owned work stops;
   explicitly promoted work remains resident. There is no global preference
   that silently promotes every session.
6. **Schedules and heartbeats are explicit background grants.** Creating one
   must make the background consequence clear and keep the work visible and
   cancellable. These advanced controls need not be prominent for users who do
   not use them.
7. **Background grants are bounded where the operation permits it.** A single
   turn ends its grant when the turn settles. Goals and recurring work expose
   their scope, budget/expiry when available, and a stop action.
8. **Rhizome never stops the daemon.** `prime-agent shutdown` affects shared
   machine infrastructure and other clients' work; it is outside this policy.

Prime promotion is one-way. Returning a resident session to foreground-only
mode therefore means stopping its worker and later resuming its durable
transcript as a new client-owned worker. Scheduled work may ultimately warrant
a dedicated resident session so it does not permanently promote ordinary chat.

This ADR supersedes ADR-0163 only where that ADR says closing Rhizome
unconditionally leaves sessions running. ADR-0163's transport decision—Rhizome
is a client of Prime's daemon and does not own the daemon lifetime—remains
active.

## Options considered

* **Option A (chosen): client-owned by default, promote explicitly.** Enforces
  the product policy after crashes as well as orderly closes and uses Prime's
  designed ownership mechanism. Downside: close becomes an asynchronous
  lifecycle transition, promotion is one-way, and old resident sessions need a
  migration path.
* **Option B: resident by default, kill in close/quit handlers.** Closest to the
  current code. Rejected because crash and force-quit bypass cleanup, so the
  claimed foreground default is not true.
* **Option C: keep the global "sessions survive quit" preference.** Simple, but
  too broad: one preference silently grants every current and future session
  indefinite background residency.
* **Option D: return to an owned RPC child.** Process exit naturally stops work,
  but gives up the daemon-only harness surface, shared model/session state,
  schedules, and supervisor behavior that motivated ADR-0163.

## Consequences

* `prime_session_host` must advertise `client_owned_sessions`, create new
  sessions as `client_owned`, and expose complete/promote operations with
  capability-aware errors.
* Main-window close can no longer be an unconditional synchronous hide. It
  needs an active/idle check and a renderer-visible confirmation flow whose
  default is stop.
* The global `keep_sessions_running_on_quit` setting is removed or migrated; it
  cannot remain the source of truth for per-session permission.
* The running-session UI must distinguish foreground-attached work from
  explicitly resident background work and provide a reliable stop action.
* Tests must cover orderly close, promotion, reconnect within the 30-second
  grace period, daemon/client loss, and preservation of durable session logs.
* ADR-0163, `CONTEXT.md`, `ARCHITECTURE.md`, `ABSTRACTIONS.md`, and stale RPC
  comments must be corrected together so "daemon exists," "client connected,"
  and "session working" no longer collapse into one state.
