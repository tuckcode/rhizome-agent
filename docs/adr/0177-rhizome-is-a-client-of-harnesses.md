---
type: ADR
id: "0177"
title: "Rhizome is a client of harnesses"
status: superseded
date: 2026-10-05
superseded_by: "0180"
---

**Origin:** Cursor Grok 4.6 · 2026-10-05 · Atticus / knispo room consensus (#40)

**Superseded 2026-10-09** by [ADR-0180](0180-rhizome-is-its-own-harness.md).
The vault-layer ownership table still holds. The client identity does not.

## Context

[ADR-0163](0163-connect-to-the-prime-daemon.md) already answered the identity
question for Prime: Rhizome connects to the daemon as one client among several
and does not own Prime's lifetime or loop.

[ADR-0168](0168-selective-harness-doctrine.md) and
[`docs/design/harness-doctrine.md`](../design/harness-doctrine.md) then set the
borrow filter: **absorb metabolites, not organs.** Prime stayed the only
execution core in that ledger. The filter did not ratify how Rhizome should
treat a *second* full harness, or whether Rhizome should grow its own loop
from borrowed parts.

[#40](https://github.com/tuckcode/rhizome-agent/issues/40) asked the general
question: is Rhizome a harness, or a client of harnesses? The measured tree
already answers both ways. Prime is a deep daemon client. Hermes is a
one-shot `hermes chat --quiet --source tool` spawn that hides the turn from
Hermes' session list, so Rhizome acts as the harness for that turn. Findings:
[`2026-09-14-1618-issue-40-findings.md`](../plans/handoffs/2026-09-14-1618-issue-40-findings.md).

[#5](https://github.com/tuckcode/rhizome-agent/issues/5) is the parent Prime
harness-surface spec. It is not only this identity question. [#56](https://github.com/tuckcode/rhizome-agent/issues/56)
still records a second provider path (`ai_models.rs`) that disagrees with the
doctrine ledger. This ADR does not delete that path.

Older `NEXT.md` / `harness-composition.md` notes used a different "option 2"
(Rhizome as product shell, Prime as the only engine). That is **not** option 2
in the #40 table below.

## Decision

**Rhizome is a client of harnesses. It does not own the agent loop.**

This generalizes ADR-0163 from Prime to every harness. It closes the
composition gap ADR-0168 left open. Option 2 and option 3 are rejected.

Confirmed 2026-10-05 by Atticus / knispo in group chat with Dank.bot,
Nightly Audit Engineer, dr eggbot, and G-baby.

## Ownership

| Layer | Owner | Includes |
|---|---|---|
| Vault layer | **Rhizome** | Persona and instructions handed to every harness. Skills and prompt packs that live in the vault. Permissions and edit-approval UI / policy — one Rhizome screen, regardless of which harness requested the edit. Memory and session history kept as Markdown / an on-disk index so they survive a harness swap ([#81](https://github.com/tuckcode/rhizome-agent/issues/81)). Provenance: which agent did what, rebuilt in Rhizome's layer (do not fork Hermes `provenance.py`). |
| Agent loop | **Harness** | Turn-taking, tool calls, and completion for that runtime. |
| Tool runner | **Harness** | How tools are invoked inside that runtime. |
| Model routing / provider selection | **Harness** | Catalog, credentials, and routing inside that runtime (Prime `AuthStorage`, Hermes providers, and so on). |
| Session runtime | **Harness** | Prime daemon, Hermes ACP sessions, and any later ACP host. Rhizome attaches and detaches; it does not own that process. |

## Borrowing rule

Copy ideas freely. Never fork harness code into a Rhizome-owned loop.

If a harness ships something useful (Hermes provenance is the worked example),
rebuild it in Rhizome's vault layer so Rhizome does not inherit that project's
release cycle or licence surface. ADR-0168's metabolite / organ test still
applies: a contract, artifact, or signal may be adapted; an agent loop,
provider registry, scheduler, or memory authority may not be transplanted.

## Options considered

* **Option 1 (chosen): client of harnesses.** Rhizome owns the vault layer
  in the table above. Each harness owns its loop, tools, routing, and session
  runtime. A later harness is another client target (ACP or equivalent), not
  a reason to grow a Rhizome loop. Downside: Rhizome cannot paper over a
  missing harness capability by implementing the loop itself; it waits for a
  protocol or rebuilds the *idea* on the vault side.
* **Option 2: Rhizome owns the loop.** Prime, Hermes, and others become
  model-and-tool backends under a Rhizome agent. Rejected. It reverses
  ADR-0163, makes Rhizome a second harness, and splits permissions, approval,
  and session state across two owners.
* **Option 3: borrow code into a Rhizome-owned loop.** Pull organs from
  several harnesses (DeepSeek Harness was the named candidate) and assemble a
  Rhizome runtime. Rejected. Licence would become load-bearing, and Rhizome
  would inherit each donor's release cycle. MIT on a donor is not permission
  to do this.

## Evidence

Homework already verified 2026-10-05 against the public repos. Re-checked
the same paths before writing this file.

**Hermes ACP is real** in [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent).
`acp_adapter/` includes `entry.py`, `server.py`, `session.py`, `permissions.py`,
`events.py`, `tools.py`, `auth.py`, plus `commands.py`, `content.py`,
`edit_approval.py`, `model_catalog.py`, `provenance.py`, `__main__.py`. Start
via `hermes acp` / `hermes-acp` / `python -m acp_adapter`. Sessions persist in
`~/.hermes/state.db` with resume / list / fork. Docs:
`website/docs/user-guide/features/acp.md` and
`website/docs/developer-guide/acp-internals.md`.

**deepseek-ai/deepseek-harness is MIT** (`LICENSE`, Copyright 2026 DeepSeek).
It uses a Cordis plugin architecture. MIT is not a blocker for later *client*
use if ACP or a similar protocol appears. It is not a reason to fork the
runtime into Rhizome.

## Consequences

Recorded here. Not implemented by this ADR.

1. Hermes one-shot `hermes chat --quiet --source tool` is wrong under this
   identity — Rhizome is quietly acting as the harness for that turn. Replace
   it with ACP behind the same interface Prime uses (separate PR by Dank.bot
   after this ADR merges). Keep the old path as fallback until the ACP path
   is proven.
2. ACP goes on the roadmap.
3. [#81](https://github.com/tuckcode/rhizome-agent/issues/81) (saved search
   index, real-log dogfood, keyboard nav) is Rhizome-owned memory work
   (G-baby). It is not a harness organ.
4. deepseek-harness may be evaluated later as another ACP / client target,
   not as source to fork into a Rhizome loop.
5. Close [#40](https://github.com/tuckcode/rhizome-agent/issues/40) as
   decided when this ADR is on `main`. Do **not** close #5: that issue is the
   Prime harness-surface spec. #5 should cite this ADR as the identity
   premise. #56 stays open; leftover `ai_models.rs` is not re-decided here.
6. Product UI may still show Prime first in v0. That is a surface choice.
   The identity is client-of-harnesses, not "only one harness may ever exist."

## Advice

Atticus / knispo, 2026-10-05, room consensus. Dank.bot, Nightly Audit
Engineer, dr eggbot, and G-baby confirmed option 1.

[[0163-connect-to-the-prime-daemon]]
[[0168-selective-harness-doctrine]]
