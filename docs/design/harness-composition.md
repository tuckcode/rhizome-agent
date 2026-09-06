# Harness composition — option 2

**Origin:** Grok 4.6 · 2026-08-24 · `2b5daba`. Working notes from a Cursor
session, not the Claude Code `NEXT.md` draft.

**Status:** working notes, 2026-08-24. **Not an ADR.** Discuss and decide
before grafting. The ratified *filter* is still
[ADR-0168](../adr/0168-selective-harness-doctrine.md) /
[`harness-doctrine.md`](./harness-doctrine.md). This file is the composition
plan those docs said they were not: what we intend to take, where it lives,
and which pairs must not ship together.

**Audience:** anyone about to add a Prime, Hermes, DeepSeek, or OpenCode idea
to Rhizome Agent.

Pickup index: [`docs/NEXT.md`](../NEXT.md) §1.

---

## Working conclusion (discuss / decide)

Intended product shape is **option 2**:

> Rhizome is the product harness. Prime Agent stays the only execution core.
> Other harnesses donate contracts, UX patterns, and evaluation methods.
> Those pieces live in Rhizome (desktop, vault, policy) or as Prime
> skills / MCP / extensions. They are never forked into Prime and never
> run as a second loop.

Prime keeps receiving upstream updates through a **thin, versioned adapter**
(protocol + capabilities). Add-ons on our side of that adapter survive a
Prime release. Add-ons *inside* Prime (fork, patch, Cordis kernel, a second
daemon) will not.

This is joint-call intent, not a shipped bill of materials. Ratify it, or
say what is still wrong, before building grafts. Native extension UI is the
proposed first slice if this stands — see [Plugin extensibility](#plugin-extensibility-the-idea-not-the-kernel).

---

## Three versions of “make it the Rhizome harness”

| # | Meaning | Cost | Verdict |
|---|---|---|---|
| **1** | Name and skin. Users see Rhizome; Prime is still the engine. | Cheap. Already the fidelity standard. | Necessary, not sufficient. |
| **2** | Product ownership, engine still Prime. Rhizome decides composition, lifecycle, vault memory, native UX. Prime executes. | Product work. Adapter discipline. | **Intended.** |
| **3** | Own the runtime: fork/vendor Prime, stop speaking a foreign protocol, graft other organs into that tree. | Maintain an agent engine. Merge tax or freeze. | Company bet. Would supersede ADR-0163 and ADR-0168. Not this plan. |

“What makes Prime Prime” is the daemon, workers, agent loop (Pi-shaped
sessions), IPython/tools, RLM/subagents, provider/auth catalog, session
trees and logs, compaction, schedules/heartbeats, and refine — under
`~/.prime`. Option 2 keeps that. Option 3 takes it.

---

## Filter vs composition

| | Filter (settled) | Composition (this file, unratified) |
|---|---|---|
| Doc | ADR-0168, `harness-doctrine.md` | This file |
| Rule | Metabolites, not organs. One loop. One vault. One credential path. | Which metabolites, in what form, in what slice, and which pairs collide |
| #40 | Answered: Rhizome is a client of Prime, not a second harness | Closing #40 does not finish this |

The Frankenstein test stays: if we deleted Prime tomorrow and the piece
still tried to run, it is an organ. Do not transplant it.

Pair test: **does piece A from harness X break piece B from harness Y?**
If both claim the loop, the memory file, the credential store, or the
session lifetime, ADR-0168 already forbids the pair.

---

## How a Prime update must keep working

Safe split:

| Lives in Prime (they update it) | Lives in Rhizome (we own it) |
|---|---|
| Loop, tools, providers, sessions, schedules, RLM | Chat/desktop UX, vault memory, promote/approve |
| Auth, compaction, refine ledger | Foreground/background policy, native confirm |
| Protocol + capabilities | How we surface foreign *ideas* on that protocol |

Rule for a new take: if deleting Prime would make that feature keep
running, it is in the wrong layer.

The remaining risk is product, not git: Prime ships something that overlaps
a Hermes or DeepSeek contract we already built. Then we choose — use Prime’s
version or keep ours — we do not get a silent merge conflict. Name that
choice in the matrix before the slice ships.

**Keep the adapter honest.** `docs/prime-adapter-surface.json` is the last
mechanical read of Prime's daemon command set vs what we send. Refresh with
`pnpm prime:surface` / `pnpm prime:surface:github`. Do not clone upstream
into this tree.

**Origin:** Grok 4.6 · 2026-08-25 — the snapshot / `pnpm prime:surface` check.

---

## Layers (a harness is more than tools)

| Layer | Take the good part | Collision to refuse |
|---|---|---|
| **Agent loop / runtime** | Prime stays the only loop | A second loop, subprocess harness, or “just this one other engine” |
| **Tools and skills** | Prime tools + Rhizome vault tools; foreign *ideas* for surfacing them | Tool A from X owning the sandbox, cwd, or approval path that tool B from Y also claims |
| **Session lifecycle** | Foreground-owned by default (ADR-0167); residency is an explicit grant | Close/hide/crash inferring always-on work; two ownership stories |
| **Memory** | Vault is durable SoT; promote/recall are Rhizome’s | A second `MEMORY.md`, silent dual-write, or Hermes/DSH store next to the vault |
| **UX / desktop** | Rhizome visual language over Prime state | Cloning Prime’s TUI, Hermes desktop, or a DSH console as a second shell |
| **Permissions / credentials** | One confirmation and one secret path | Two credential stores or two approval authorities |
| **Context, routing, providers** | Ideas (progressive disclosure, model routing) adapted onto Prime’s catalog | OpenCode / Claude Code / Switchyard as a second backend or provider registry |
| **Scheduling / background** | Prime schedules/heartbeats, visible and cancellable | A second scheduler, or residency implied by “the daemon is up” |
| **Extensibility** | Prime extensions, skills, MCP — see below | Cordis / `dsh` plugin kernel, or a Rhizome plugin that replaces Prime’s loop |

---

## Per source

Full take/leave tables live in the reviews. This section is the composition
read: what we believe, what we will not do, and where the evidence is.

### Prime Agent — TAKE the engine, WRAP the policy

Prime owns daemon supervision, workers, the agent loop, providers,
credentials, model catalog and session model state, tools/IPython,
RLM/subagents, queues, session trees and logs, compaction, goals,
schedules, heartbeats, refine, and coordinated updates.

Rhizome is a daemon client and policy shell (ADR-0163, ADR-0167). “Desktop
version of Prime” is a **fidelity standard**, not an ownership rule.
Coverage is by user job, not command-count parity.

C47 is implemented locally: new sessions are `client_owned`; idle close
detaches; active close asks Stop vs Keep working; quit follows ownership.

**Review:** [`2026-08-24-prime-harness-take-leave-audit.md`](../plans/2026-08-24-prime-harness-take-leave-audit.md)

### Prime is a distribution of Pi, and Pi has a package registry

**Origin:** Claude Opus 5 · 2026-08-31 · raised by Atticus, verified against
primary sources the same session.

**This section supersedes any reading of this file that treats Prime's
extension surface as something we would have to populate ourselves.**

Prime Agent is not a from-scratch runtime. It is a distribution of an
existing agent called **Pi**, built by **Earendil Inc.** Verified three ways,
none of them a repo note:

1. Prime's own `package.json` lists the engine as a dependency:
   `"@earendil-works/pi-agent-core": "…/prime-agent-core-0.8.0.tgz"`.
2. Prime's own `docs/packages.md` calls the format "the **inherited**
   extension ecosystem", declares resources under a `pi` key in
   `package.json`, and asks authors to use the `pi-package` npm keyword.
   Its peer-dependency list is `@earendil-works/pi-ai`,
   `pi-agent-core`, `pi-coding-agent`, `pi-tui`.
3. `pi.dev/packages` is a live registry — **~5,000 packages**, maintained by
   Earendil, in exactly four kinds: **extensions, skills, prompt templates,
   themes**.

Those four kinds are the same three seams this file already calls the open
door (extensions / skills / MCP). The difference is that the catalog already
exists and was never checked before writing "Rhizome's gap is the product
layer, not a missing kernel."

**What this changes:** before hand-building anything that is an extension, a
skill, a prompt template, or a theme, search `pi.dev/packages` first. Prime
installs them directly:

```bash
prime-agent package install npm:<name>       # or git:… , or a local path
prime-agent -e npm:<name>                    # try one without installing
```

**What this does not change.** The filter is untouched. A package that
brings its own loop, provider registry, credential store, or durable memory
store is still an organ and still fails the Frankenstein test. `dsh`-style
plugin kernels are still closed. The catalog widens the *candidate list* for
the open door; it does not open a new door.

**Concrete example already found:** `pi-hermes-memory` (npm, author
`chandra447`) is Hermes's memory tool ported to Pi. Its own credits say
"Ported from the Hermes agent by Nous Research. Specifically:
`tools/memory_tool.py` — MemoryStore class, content scanner, tool schema."
That is the Hermes memory *contract* this file already says to adapt,
already built against Prime's own seam by a third party. Worth a real
review — including whether its default-on memory writes conflict with the
vault-promote write authority in item 4 of Still discuss / decide. Not an
endorsement; nobody here has read its source.

**Two cautions, both from Prime's own docs:**

- `packages.md` warns in bold: packages "run with full system access.
  Extensions execute arbitrary code, and skills can instruct the model to
  perform any action including running executables. Review source code
  before installing third-party packages." Prime has no sandbox (see
  Sandbox below), so an installed package is trusted code on the host.
- Package install is **CLI-only**. It is absent from
  `docs/prime-adapter-surface.json` and from Prime's `rpc.md`, so the
  daemon exposes no install command and Rhizome cannot drive it as a
  first-class action. Same shape as provider sign-in today. The daemon
  *does* expose `bash`, and Rhizome already recognises bash tool calls
  (`prime_events.rs`, `prime_tool_unwrap.rs`), so an agent-run install is
  plausible — **untested, do not treat as working until someone runs it.**

### Hermes Agent — TAKE contracts, REJECT the stack

Hermes is its **own** Python runtime (`AIAgent` in `run_agent.py`). It is
**not** built on OpenCode. OpenCode appears only as a bundled skill that
spawns `opencode run` — delegation to a peer harness, the pattern ADR-0168
rejects as a Rhizome default.

Hermes Desktop is option 2 over *their* engine (`hermes serve`). Company-
level option 3 because they own both sides.

Take: observable interruptible work; named lifecycle + `unknown`; children
narrow never widen; fail-closed unattended approval; progressive skill
disclosure with provenance; schedule preflight before spend.

Adapt onto Prime + vault: desktop observability, memory *approval* as
promote-to-vault (not `MEMORY.md` / `USER.md`), skill catalog UX, schedule
creation as an explicit background grant.

Reject: Hermes as a second runtime; default-on memory/skill writes; YOLO as
a product affordance; parallel durable-memory stack; bot-roster / messaging
gateway scope.

**Review:** [`2026-08-24-hermes-harness-source-review.md`](../plans/2026-08-24-hermes-harness-source-review.md)

Easy mix-up: Hermes vs **OpenClaw**. Still not a fork. Separate TypeScript
gateway (Pi). Hermes only has `hermes claw migrate`.

#### Source-verified pass, 2026-08-31

**Origin:** Claude Opus 5 · 2026-08-31 · three parallel sub-agents reading
`github.com/NousResearch/hermes-agent` (public, MIT) at `main`, plus
`hermes-agent.nousresearch.com/docs`. File paths below are real and were
read; this supersedes doc-level guesses about the desktop app.

**Structure.** No CLI-was-ported-to-desktop story. One Python `AIAgent`
core, and separate purpose-built surfaces per platform: `cli.py`,
`ui-tui/`, `apps/desktop/` (Electron 40), each with its own `node_modules`.
Their own line: *"Platform differences live in the entry point, not the
agent."* Desktop launches as `python -m hermes_cli.main desktop`. **They
claim parity, never improvement** — searched for it specifically and found
none: *"same config, same API keys, same sessions, same skills, same
memory."* The premise that they ported and then improved is not supported.

**Terminal — two mechanisms behind one look.** `apps/desktop/electron/
terminal-ipc.ts` spawns real shells with `node-pty`, rendered by
`@xterm/xterm`, keyed by session id, with SSH targets through the same
path. The agent's terminal is a *different thing entirely*:
`use-agent-terminal.ts` is documented in-file as *"a write-only xterm (no
PTY, no input) fed live by the backend output stream"*, built with
`disableStdin: true`, no IPC channel, mirroring a `terminal(background=true)`
tool call with a capped 256KB replay backlog. `terminals.ts` types it
explicitly: `kind: 'user' | 'agent'`.
**Idea worth taking:** an agent's shell output rendered in the same widget
as a human's, but read-only and on a separate data path — visual
consistency with zero input-contention or ownership question. Directly
relevant if Rhizome ever surfaces Prime's bash tool calls as a pane.

**Kanban.** A feature absent from their docs nav; found by code search.
`~/.hermes/kanban.db` (SQLite) holds durable task rows with a status
lifecycle (`triage|todo|ready|running|blocked|review|done|archived`),
parent→child dependency links with auto-promotion when parents finish,
comments, events, and per-card model overrides. It exists because their
`delegate_task` was a blocking in-process call whose work vanished on
crash. "Swarm" (`hermes_cli/kanban_swarm.py`) is topology only — fan-out to
N worker cards, gate on a verifier, fan-in to a synthesiser — and its own
docs say it "does not introduce a second scheduler."
**Idea worth taking:** *one write path.* CLI, model-facing tools, and the
React board all bottom out in a single `kanban_db` module, so the three
surfaces cannot disagree about a task's state. That discipline is the
transferable part, not the schema.
**Open question before anyone builds this here:** Prime already has
child/subagent sessions, which is the primitive Hermes lacked. Whether
Prime's own session state is already durable across restart and readable
mid-flight is **unverified**. If it is, the Rhizome shape is a view over
existing Prime state, not a second task store — which the one-vault,
one-write-authority rule would push for anyway. Check before designing.

**Bots.** `apps/desktop/src/plugins/hermes-bots/` (~95 files, a plugin on
`@hermes/plugin-sdk`). A Bot is a profile directory under
`~/.hermes/profiles/<name>/`. Isolation is **cheap**: `docs/profile-routing.md`
shows one gateway process serving N profiles via a per-profile `HERMES_HOME`
and namespaced session keys, and `tools/bot_mode_dm.py` delivers a DM by
shelling out `hermes -p <name> chat … -Q --query-file <tmp>` as a
background subprocess that runs one turn and exits. No standing per-bot
process.
**Correction to the doc-level read:** the "Active now" strip is not
presence. `data.ts` polls `profiles.list` on a flat `refetchInterval: 5000`,
and `isActiveRosterBot()` means "the bot whose chat is open" — not online,
not working. Do not cite Hermes as prior art for agent presence.
**Idea worth taking:** the ephemeral one-turn subprocess as the whole
mechanism behind a named, persistent-feeling identity. Prime's subagent
sessions already cover this; Hermes had to shell out to get it.

**The pattern across all three:** one cheap primitive — a disposable
one-turn agent — wearing three different UIs. Bots is that primitive plus a
name and a face; kanban is that primitive plus a durable row; the agent
terminal is that primitive's stdout in a read-only pane. Rhizome already has
the primitive. What is missing here is not runtime capability.

**Still rejected, unchanged:** Hermes as a second runtime, its
messaging-gateway/bot-roster scope, and any parallel durable-memory stack.
None of the above needs Hermes code; every item is an idea or a contract.

### DeepSeek Harness (`dsh`) — TAKE event/replay contracts, REJECT the runtime

Official repo: [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
(developer preview; breaking changes expected). Keep three names separate:
the `dsh` runtime, the DeepSeek API, and V3.2 training machinery.

The whole `dsh` product is plugins on **Cordis**: loop, tool pipeline,
persistence, permissions, UI. That *is* their engine. Porting it into
Rhizome is a second kernel. See [Plugin extensibility](#plugin-extensibility-the-idea-not-the-kernel).

Take: durable events ≠ live coordination; model-visible means logged; typed
tool identity and tool-owned render intent; fail-closed monotonic denials;
subagent lineage; replay + external-state assertions; operational session
memory ≠ durable human knowledge.

Adapt: Cordis *seams* as guidance for small Prime-facing modules; inbox /
steer / follow-up mapped to Prime admission (C43/C44 already aligned);
compaction as visualize-Prime, never compact independently.

Reject: running `dsh` behind Rhizome; a second provider/tool/approval stack;
transcripts or hidden reasoning as vault notes; requiring a vault before
chat.

**Review:** [`2026-08-24-deepseek-harness-source-review.md`](../plans/2026-08-24-deepseek-harness-source-review.md)

### OpenCode and other CLIs — never a candidate

**Corrected 2026-08-29 by Atticus.** OpenCode was named at the start of this
project purely as *an example of what a coding harness is* — a reference
point in conversation, nothing more. It was never proposed as an engine,
a backend, or a context layer for Rhizome.

Everything below this line is the docs elaborating a rejection nobody had
asked for. Read it as history, not as a live verdict:

- This section previously read “REJECT as product backends,” with reasoning
  about “hidden Desktop DNA” and OpenCode being weak at lasting knowledge.
- Weekend NotebookLM (2026-08-22) assigned OpenCode “context / provider
  routing / LSP,” which was then treated as a standing disagreement
  requiring resolution — item 3 in Still discuss / decide.

There is no disagreement, because there was no proposal. Prime is the only
runtime in the Agent product UI (ADR-0163, ADR-0168), and that was settled
without reference to OpenCode. If a user job ever needs routing or LSP
ideas, adapt them onto Prime’s catalog on their own merits.

**Do not re-open this as a decision.** If a later doc or session presents
OpenCode as a rejected alternative, it is repeating an artifact of the
original example, not a call that was made.

Vision draft: [`rhizome-prime-harness-vision.md`](./rhizome-prime-harness-vision.md)

### Switchyard — DEFER behind Prime

NVIDIA NeMo Switchyard is an experimental model router, not a harness.
Trial path only: `Rhizome → Prime → Switchyard → providers`. Rhizome does
not grow a router. Combined write-up with TokenJuice:
[`token-routing-and-compression.md`](./token-routing-and-compression.md).

### OpenHuman — DEFER a source review

Named in divergence frames. One feature has been read: TinyHumans TokenJuice
(tool-output compression router). That is **not** Switchyard and **not** a
full OpenHuman review. Metabolite-only; do not compact independently.
See [`token-routing-and-compression.md`](./token-routing-and-compression.md).

### Claude Code

Not a source review target. Progressive disclosure / MCP *ideas* may adapt
onto Prime skills. Reject as a backend. Same “hidden Desktop DNA” bucket as
OpenCode.

---

## Plugin extensibility (the idea, not the kernel)

> **Read [Prime is a distribution of Pi](#prime-is-a-distribution-of-pi-and-pi-has-a-package-registry)
> first (added 2026-08-31).** This section was written believing the open
> door was empty and that we would author whatever went through it. It is
> not empty: Prime inherits Pi's package format and `pi.dev/packages` lists
> ~5,000 extensions, skills, prompt templates and themes that install with
> `prime-agent package install`. The slice table below is still the right
> *product* order; search the registry before hand-building any row of it.

DeepSeek’s plugin system is popular because a plugin can add a tool, hook a
turn, and block a call **without forking the loop**. That idea is not unique
to `dsh` (Prime, Hermes, OpenCode, and Claude Code all have
plugins / extensions / skills). What `dsh` did further is make the *entire*
harness a plugin tree on Cordis, including loop intercepts.

**Closed door:** ship Cordis, load `dsh` plugins as-is, or let a Rhizome
plugin replace Prime’s loop, prompt assembler, or session store.

**Open door — and this is the explore-implement path:** offer the same kind
of extensibility on seams Prime already has.

Prime extensions already hook:

- `turn_start` / `turn_end`
- `before_provider_request` / `after_provider_response`
- `tool_call` (can `{ block: true, reason }`)
- `tool_execution_*`
- session start / compact / refine / shutdown
- `registerTool`, `registerCommand`, `ctx.ui` (select, confirm, input)

Skills and generic MCP are the other two seams.

Rhizome’s gap is the **product layer**, not a missing kernel:

| Slice | What | Why first / later |
|---|---|---|
| **1. Native extension UI** | Claim `extension_ui`; render Prime’s `select` / `confirm` / `input` / `editor`. Today Rhizome auto-cancels those requests so the turn can finish. | Doctrine already: required before any “supports Prime extensions” claim. First slice if option 2 stands. |
| **2. Catalog** | Show loaded skills/extensions from Prime, not a static “rhizome-vault” chip. | Discovery/consent. Hermes provenance idea, Prime as loader. |
| **3. Profiles** | Prime tool allow-lists as Rhizome presets. | Compose capability without a second plugin tree. **Not** Atticus's Settings profile page for "how the agent should respond" (C66) — that is user instructions, not tool policy. |

If a hook does not exist on Prime (`pre-step` as `dsh` names it), that is a
Prime feature request, not a reason to embed `dsh`.

---

## Weekend NotebookLM — not a source

**Downgraded 2026-08-29 by Atticus:** *“NotebookLM is probably misinformed,
so don’t listen to that.”*

Saturday 2026-08-22 exports (Downloads, not in repo) — a mind map, a
strategy image, and a generated audio overview — were machine-generated
summaries of material fed into NotebookLM, not decisions and not research.
They assigned: Prime = engine, DeepSeek = plugins, Hermes = UX,
OpenCode = context / routing / LSP, Claude Code = MCP.

That assignment carries no authority here. It was previously written up as
a rival plan this file had to reconcile against, which is how OpenCode
acquired a “rejected backend” verdict it never needed.

**Do not cite these exports as a position, a disagreement, or a source.**
Where they happen to agree with this file (Prime as engine), the reason is
ADR-0163 and ADR-0168 — not the mind map.

---

## Sandbox

Prime has **no security sandbox**. Workers and the IPython kernel are
process-isolated for crashes; they still run as the user. Prime’s docs say
to use an **external** sandbox when the workspace or generated code is
untrusted. Confirm dialogs and vault path policy are not a sandbox.

Do not build a second tool-approval/sandbox pipeline in Rhizome. If bash
and the kernel still run on the host, that is theater. Two shapes that
fit option 2:

1. **Sandbox the Prime worker** — loop and tools run inside a box. Prime
   owns this, or we start the worker in a container. Already sketched
   (unadopted) in
   [`2026-08-20-containerized-workers-proposal.md`](../plans/2026-08-20-containerized-workers-proposal.md).
2. **Sandboxed code-runner tool** — a skill/MCP for “run this snippet in
   a box.” Additive. Does not make Prime’s bash safe.

**[Kern](https://github.com/getkern/kern)** (getkern/kern, v0.7.0): honest
Linux sandbox — daemonless, rootless, ~3 ms OCI boxes, agent-shaped
`fault` results, MCP. Same class as bubblewrap, not Firecracker. **Linux
/ WSL2 only; macOS is a non-goal** except a possible Linux VM later.
Watch as a Linux Prime-side candidate. Not a Rhizome v0 sandbox (this
desktop is macOS-first).

For the trusted circle, do not build a sandbox this week. Later: wrap the
Prime worker, platform by platform.

---

## Still discuss / decide

Before treating this as build law:

1. Ratify **option 2** as the composition rule (or name the alternative).
2. Ratify **native extension UI** as the first extensibility slice — or
   pick another first slice.
3. ~~Confirm OpenCode stays reject-as-backend~~ **Not a decision — closed
   2026-08-29.** Atticus confirmed OpenCode was only ever an example of what
   a coding harness is, raised at the start of the project. There was no
   proposal to reject. See [OpenCode and other CLIs](#opencode-and-other-clis--never-a-candidate).
4. Name remaining incompatibilities the reviews left implicit (e.g. Hermes
   memory approval vs vault promote vs Prime refine ledger — one write
   authority).
5. Close **#40** against the filter once (1) is yes; do not call that
   “composition done.”
6. Finish **#5** (Prime harness surface spec) only after this matrix is
   yes enough to build against.

**Added 2026-08-31**, from the Pi-registry and Hermes source findings above.
**Answered 2026-09-02** (Claude Opus 5, Claude Code) — all four turned out
cheap, as predicted; findings below.

7. ~~**Does `pi.dev/packages` already contain the first slice?**~~
   **Answered.** Searched the npm registry (`registry.npmjs.org/-/v1/search`,
   the same index `pi.dev/packages` reads from — filtered on the
   `pi-package` keyword) for each slice-table row:
   - **Slice 1, native extension UI:** no covering package, and structurally
     none is possible. Rendering Prime's `extension_ui` RPC events
     (`select`/`confirm`/`input`/`editor`) is Rhizome's own GUI — a Pi
     package runs *inside* Prime/Pi and cannot reach into Rhizome's Tauri
     window. Stays build, not adopt.
   - **Slice 2, catalog:** no package renders a host-side "loaded skills"
     chip for the same reason. Closest hits — `@pi-stef/catalog` ("managing
     skill/package catalogs") and `@hk-vk/pi-package-search` ("Browse,
     inspect, and install packages from the official Pi catalog") — are
     Pi-side CLI/TUI tools an *agent* could shell out to (same `bash`
     pathway as item 8), not something Rhizome's UI can embed. Stays build.
   - **Slice 3, profiles:** real candidates exist and do the actual job —
     `pi-permission-modes` ("Declarative, user-definable permission modes...
     an allow/ask/deny policy engine... tool hiding, and skill/custom-tool
     gating"), `@bacnh85/pi-permission` ("Granular permission system for
     Pi — allow/ask/deny rules per tool with wildcard patterns"), and
     `@georgedong32/permission-modes` ("Claude-Code-style permission modes...
     with per-mode model profiles... per-mode skill filtering") already
     implement named tool-allowlist presets as installable Pi extensions.
     **This is the one row where review-and-adopt is live** — Rhizome could
     ship a thin preset UI over one of these instead of building the
     enforcement layer. Not evaluated further this session (needs its own
     source read per the item-10 rule below); flagging as the concrete
     candidate for whoever picks up slice 3.
8. ~~**Can an agent install a package through the daemon's `bash`?**~~
   **Answered: yes, live-tested.** `prime-agent --mode rpc`, no daemon
   multiplexing needed to prove the mechanism (RPC session speaks the same
   `bash` command whether reached via daemon socket or direct RPC stdio).
   Sent `{"type":"bash","command":"prime-agent package install <local-path>
   --local"}` against an isolated project dir with a throwaway probe
   package (a package I authored, not a random third party — kept the test
   inside the item-10 rule instead of exempting itself from it). Response:
   `exitCode: 0`, `"Installed <path>"`, and `.prime/agent/settings.json` in
   the isolated project picked up the package entry. **Package management
   can be an in-app action** — an extension/skill install no longer has to
   stay a Terminal step like provider sign-in does. One nuance caught in
   `stderr`: `"Shell cwd was reset to <original launch dir>"` after the
   sequence — the bash tool's cwd tracking reset itself at some point
   mid-session; worth a closer look before wiring a UI button to this, but
   it did not misroute the actual install (settings.json landed in the
   right place, confirmed by content, not just exit code).
9. ~~**Is Prime's subagent/session state durable across restart and
   readable mid-flight?**~~ **Answered from Prime's own docs** (`rlm.md`,
   `daemon.md` — not live-tested, but these are primary-source architecture
   docs, not a repo note). Yes to both:
   - Durable: `rlm.md` states outright — *"The parent-scoped child registry
     survives compaction, kernel restart, and parent restoration"* via
     `rlm.list_subagents()`. `daemon.md`: sessions are JSONL files under a
     process-safe lease, and *"child registries and session artifacts make
     subagents recoverable."*
   - Readable mid-flight, **and from outside the kernel**: the RPC `observe`
     command subscribes an external client to "another active root or
     subagent session" and streams its live events
     (`observed_session_event`), separate from `rlm.list_subagents()` which
     is model/kernel-side only.
   - **Answers item 4 together, as instructed:** a task-board surface can
     be a *view* over Prime's existing registry + `observe`, not a second
     store. That also narrows item 4's one-write-authority question — Prime
     already owns subagent/session state as a single authority; Rhizome's
     job is read-and-render, matching option 2's "adapt onto Prime's
     catalog" framing rather than parallel storage.
10. ~~**Does `pi-hermes-memory` conflict with vault promote?**~~
    **Answered: yes, it conflicts. Recommendation: do not install, do
    without.** (Atticus, 2026-09-02, mid-session: "I'm not sure how it would
    tie in with Rhizome's own memory — if we can improve upon it or do
    without you can make that decision.") Read its README
    (github.com/chandra447/pi-hermes-memory) and npm metadata directly, not
    a repo note. It is **default-on and automatic**, not opt-in:
    - Writes on a background timer — *"Every 10 turns (or 15 tool calls) the
      agent reviews and saves"* via `session_lifecycle.ts` — and immediately
      on correction detection ("don't do that", "use yarn instead").
      `flushOnShutdown: true` is the default.
    - Storage is its own authority, split global/project:
      `~/.pi/agent/pi-hermes-memory/{MEMORY,USER}.md` +
      `sessions.db` (SQLite/FTS5) globally, `~/.pi/agent/projects-memory/
      <project>/MEMORY.md` per project — entirely separate from Rhizome's
      vault and from Prime's own refine ledger.
    - Its docs make **no mention** of vault promote, Rhizome, or any other
      memory system — it was built for bare Pi, with no awareness a host
      might already own memory authority.
    - No install-time script risk (`npm rebuild better-sqlite3` is a native
      addon caveat, not a supply-chain one) — the objection is entirely the
      **pair test**: default-on, durable, silent writes from a second
      authority is exactly what Filter vs composition forbids, regardless
      of how clean the code is.
    - **"Improve upon it" doesn't apply either — Rhizome already targets
      the same job with a different shape.** `pi-hermes-memory` is
      Hermes's answer to "the agent should remember things between
      sessions" for a host (bare Pi) that has no vault. Rhizome already has
      that answer: `MEMORY.md`/`USER.md`-equivalent facts live in the vault
      under owner-visible promote, not a background timer nobody sees fire.
      Its one idea worth stealing on its own merits (not the package) is
      **correction-triggered capture** — save immediately on "don't do
      that" rather than waiting for the next scheduled review — which is a
      prompt/hook pattern Rhizome's own memory surface could adopt without
      taking the package, its SQLite store, or its silent authority. That
      is a design question for whoever owns vault promote next, not an
      install decision.
    - This is the concrete case item 4 (name remaining incompatibilities)
      should cite: Hermes memory approval vs vault promote vs Prime refine
      ledger, resolved here as "reject the package, borrow the idea."

---

## Source index

| Doc | Role |
|---|---|
| [ADR-0168](../adr/0168-selective-harness-doctrine.md) | Ratified filter |
| [`harness-doctrine.md`](./harness-doctrine.md) | Readable Take / Adapt / Reject / Defer ledger |
| [`rhizome-prime-harness-vision.md`](./rhizome-prime-harness-vision.md) | Product shape: desk + memory, Prime engine |
| [`2026-08-24-prime-harness-take-leave-audit.md`](../plans/2026-08-24-prime-harness-take-leave-audit.md) | Prime 0.8.0 boundary |
| [`2026-08-24-hermes-harness-source-review.md`](../plans/2026-08-24-hermes-harness-source-review.md) | Hermes contracts vs stack |
| [`2026-08-24-deepseek-harness-source-review.md`](../plans/2026-08-24-deepseek-harness-source-review.md) | `dsh` / Cordis vs events |
| [`2026-08-24-harness-doctrine-divergence.md`](../plans/2026-08-24-harness-doctrine-divergence.md) | Five-frame scoring |
| [ADR-0163](../adr/0163-prime-daemon-client-not-owned-process.md) | Transport: client, never own/stop the daemon |
| [ADR-0167](../adr/0167-client-owned-prime-sessions-by-default.md) | Lifecycle: foreground-owned; residency is a grant |
| [`docs/NEXT.md`](../NEXT.md) | Unclaimed work; §1 points here |
| Prime `extensions.md` (installed package) | Event list the first slice sits on |
| Prime `packages.md` (installed package) | Package format, install commands, the "inherited" Pi lineage, the full-system-access warning |
| `pi.dev/packages` | Earendil's registry, ~5,000 packages, the catalog Prime inherits |
| [`github.com/NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) | Hermes source (public, MIT). Read at `main` 2026-08-31: `apps/desktop/electron/terminal-ipc.ts`, `apps/desktop/src/app/right-sidebar/terminal/*`, `apps/desktop/src/plugins/kanban/*`, `apps/desktop/src/plugins/hermes-bots/*`, `hermes_cli/kanban_swarm.py`, `tools/bot_mode_dm.py`, `docs/profile-routing.md` |
