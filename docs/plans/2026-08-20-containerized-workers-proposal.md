# Proposal: containerize Prime workers, keep the daemon on the host

**Status: recorded, not adopted.** Relayed by Atticus on 2026-08-20 from a
separate conversation about integrating Prime Agent. Captured here so it is not
lost, with the parts that need checking against *this* repo marked. Nothing in
it has been built, and two of its five points conflict with how Rhizome
actually works today — see "Frictions".

## The proposal, as given

1. **Containerize the kernel and worker processes only** — not the daemon, not
   the desktop shell. The daemon stays on the host and talks to containers,
   because containerizing the daemon loses the tray controls.
2. **One container per session, not one shared kernel.** Sessions branch and
   retain Python state, so a shared kernel leaks variables between separate
   pieces of work.
3. **Mount policy:** project directory read-write, the Rhizome wiki store
   read-only from the agent's side, everything else denied. This closes the
   prompt-injection-to-code-execution path.
4. **Resource limits per container** — memory cap, CPU quota, network policy.
   Named as the natural enforcement point for a token budget too.
5. **Lifecycle:** containers outlive the desktop window closing; the daemon
   reaps them on a configured timeout.

## Why the shape is right

Points 1, 2 and 5 describe Prime's existing architecture accurately, which is a
good sign the proposal was made with the real system in view rather than a
generic sandboxing template. From `daemon.md`:

- the supervisor already owns sockets, routing and worker health and
  "does not execute providers, tools, compaction, bash, kernels, schedules";
- workers are already **one process group per active root session tree**, each
  owning its own IPython kernel and RLM descendants;
- workers already outlive the client — "closing the TUI detaches the client; it
  does not stop the worker" — and `prime-agent shutdown --force` already reaps
  them.

So point 5 is not new behaviour to build, and points 1–2 are a **process
boundary that already exists**, proposed to be hardened into a container
boundary. That is a much smaller change than it sounds, and it is the right
seam: `daemon.md` says outright that daemon workers are "process-isolated for
lifecycle and failure containment, **not security-sandboxed**" and "normally run
with the same operating-system permissions as the client". The proposal is
aimed exactly at the gap the docs admit to.

## Frictions — resolve these before any of it is built

**1. There is no Electron shell.** Rhizome Agent is **Tauri** (Rust +
WKWebView), not Electron. Nothing changes about the proposal's substance — the
shell stays on the host either way — but any generated Dockerfile or
integration doc written against Electron assumptions will be wrong about the
process model, the IPC, and the packaging.

**2. "Wiki store read-only from the agent's side" contradicts the product.**
The agent *writes* to the vault by design, and that is a headline feature, not
an edge case. From the vault skill Rhizome installs into `.prime/agent/skills/`:

> `create_note` — Create a new markdown note (no overwrite)
> "When the user wants to **keep** something from chat, write a vault note with
> `create_note`… Good default path: `inbox/YYYYMMDD-short-slug.md`"

A read-only vault mount disables Save-to-vault, distill, capture, and the whole
"chat becomes durable knowledge" loop. If the intent is to stop an injected
prompt from rewriting existing notes, the right shape is **append-only or
write-restricted-to-`inbox/`**, not read-only — writes go to a quarantine
directory the user reviews, existing notes stay immutable to the agent. That is
a different mechanism and needs its own design.

Worth noting the vault is also a **git repo that gets pushed**, so a compromised
write is not only local — which is C29's territory (redact credentials before
chat content is written to the vault and pushed).

**3. The vault path is not inside the project directory.** The attached vault is
`~/Documents/Rhizome Vault`, the repo is `~/code/projects/rhizome-agent`, and
sessions run with `cwd` set to the vault. "Project directory read-write" and
"wiki store read-only" are therefore describing overlapping things that need to
be named precisely before a mount policy can be written.

**4. Rhizome talks to the daemon over a unix socket**, `attach`-scoped to a
session (ADR-0163). If workers move into containers, confirm the supervisor↔
worker channel survives it — Rhizome's client contract is with the supervisor
and should be unaffected, but that is an assumption, not a verified fact.

## What it would cost us

Nothing in Rhizome's own tree, if the boundary lands where the proposal puts
it: we are a client of the daemon, the daemon stays on the host, and our
commands do not change. That is the strongest argument for this shape over
containerizing anything closer to us.

The real cost is upstream: this is a change to **Prime**, not to Rhizome. Prime
is `PrimeIntellect-ai/prime-agent` (public). Unless someone is prepared to fork
or upstream worker containerization, this is a proposal to file with them
rather than a task for this repo.

## If it goes forward

Order that keeps each step verifiable:

1. Pin the mount policy in words first, with the `inbox/`-write question
   resolved — it is the one decision that changes the product's behaviour.
2. Confirm the supervisor↔worker channel across a container boundary.
3. Then, and only then, the Dockerfile and resource limits, which are the easy
   part and the part everyone starts with.
