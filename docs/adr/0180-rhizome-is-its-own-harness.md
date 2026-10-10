---
type: ADR
id: "0180"
title: "Rhizome is its own harness"
status: active
date: 2026-10-09
supersedes: "0177"
---

**Origin:** Cursor Grok 4.6 · 2026-10-09 · Atticus / knispo room consensus (reverses #40 option 1)
**Amended 2026-10-10:** Provider curation for the native loop is [ADR-0182](0182-free-tier-provider-routing.md).

## Context

[ADR-0177](0177-rhizome-is-a-client-of-harnesses.md) chose option 1 on
2026-10-05: Rhizome is a client of harnesses and does not own the agent loop.
That ADR's Options section rejected option 2 (Rhizome owns the loop) and
option 3 (borrow code into a Rhizome-owned loop).

Four days later the same room reversed that.

[ADR-0168](0168-selective-harness-doctrine.md) and
[`docs/design/harness-doctrine.md`](../design/harness-doctrine.md) still said
Prime is the only execution core. They forbade a Rhizome-owned loop (the
Frankenstein test; "absorb metabolites, not organs").

[ADR-0163](0163-connect-to-the-prime-daemon.md) says Rhizome connects to
Prime's daemon as one client and does not own Prime's lifetime. That
transport fact is still true when Prime is in use.

[#56](https://github.com/tuckcode/rhizome-agent/issues/56) records a
direct-to-provider path in `src-tauri/src/ai_models.rs`. 0168 rejected it
as an architectural path for Prime chat. 0177 left it open.

## Decision

**Rhizome is its own harness.** It owns its agent loop (turn-taking, tool
calls, planning), tool runner, plugin system, and model routing / provider
selection. It borrows the best ideas and, where licensing allows, code from
other harnesses. DeepSeek Harness's plugin system is the named example.

Prime and Hermes become optional engines at most, not the execution core.

This is #40 option 3 / option 2 territory. It supersedes ADR-0177.

Confirmed 2026-10-09 by Atticus / knispo in group chat with Dank.bot,
Nightly Audit Engineer, dr eggbot, and G-baby.

## Ownership

| Layer | Owner | Includes |
|---|---|---|
| Agent loop | **Rhizome** | Turn-taking, tool calls, planning, completion. |
| Tool runner | **Rhizome** | How tools are invoked. |
| Plugin system | **Rhizome** | Add behavior, hook a turn, block a tool. May borrow DeepSeek Harness's plugin idea and, if the licence allows, its code. |
| Model routing / provider selection | **Rhizome** | Catalog, credentials, and routing for the Rhizome loop. The leftover path in `ai_models.rs` (#56) is a starting point. |
| Vault layer | **Rhizome** | Unchanged from ADR-0177: persona, skills, permissions / edit-approval, Markdown memory and session index ([#81](https://github.com/tuckcode/rhizome-agent/issues/81) / [#86](https://github.com/tuckcode/rhizome-agent/issues/86)), provenance rebuilt in Rhizome. |
| Optional engine | **Prime, Hermes, later hosts** | A connected runtime Rhizome may attach to. Not required for the loop to exist. Prime stays a daemon client when used (ADR-0163). Hermes ACP ([#85](https://github.com/tuckcode/rhizome-agent/issues/85) / ADR-0178) stays one optional engine. |

## What ADR-0177 rejected, and how this handles it

0177 option 2 was rejected because it "reverses ADR-0163, makes Rhizome a
second harness, and splits permissions, approval, and session state across
two owners."

0177 option 3 was rejected because "Licence would become load-bearing, and
Rhizome would inherit each donor's release cycle. MIT on a donor is not
permission to do this."

Those reasons were real. This ADR does not wave them off.

### Maintenance burden

Owning the loop is more work than being a client. That cost is accepted.
Phase 1 is a bare agent loop plus behavior tests that run in CI, before
features. A later harness plan (another teammate writes it) will sequence
the rest. Rhizome will not paper over missing tests by calling the loop
"thin."

### Licence

Rhizome is AGPL-3.0. A permissive donor licence (MIT, BSD, Apache-2.0)
may be copied. A licence that cannot sit under AGPL stays an idea to
rebuild. It is never copied code. Check the licence before any borrow.
MIT on a donor is permission to copy *that* code under its terms, with
attribution. It is not a blank cheque to ignore other donors' licences.

### Donor release cycles

Each borrowed piece uses one of two paths, chosen per piece. Rhizome does
not silently track a donor's release train.

- **Library.** Depend on the published package. Updates arrive as normal
  version bumps (Dependabot).
- **Copied (vendored).** Copy the code. Record source repo, exact
  commit or version, and licence, so a later session can diff against
  upstream and pull updates on request.

### ADR-0163 is not reversed

0163 answered a transport question: when Rhizome talks to Prime, it
connects to the daemon and does not own Prime's process. That still holds.
What changes is product identity. Prime is an optional engine, not the
loop Rhizome is. Closing Rhizome still detaches from a Prime session. It
does not stop a Rhizome-owned turn that is not using Prime.

0177's fear of two owners for permissions is handled by keeping the vault
layer Rhizome-owned (persona, approval UI, Markdown memory). Optional
engines do not become a second policy store.

## What changes in ADR-0168

**Superseded (execution lock).** Prime is no longer the only execution
core. A Rhizome-owned loop, tool runner, plugin system, and model router
are now in scope. The Frankenstein test as written ("if we deleted Prime
tomorrow, would this piece still try to run?") no longer forbids the
Rhizome loop: that loop *should* run without Prime. The lineage lock that
said execution "may not become a Rhizome-owned runtime or second provider
path" is withdrawn. The REJECT row for a Rhizome-owned loop is withdrawn.
#56's leftover `ai_models.rs` path is no longer an architectural leftover
to hide. It is a starting point.

**Still holds (borrow care).** Do not transplant blindly. Do not grow a
second memory authority beside the vault. Do not silent dual-write. Do
not treat `~/.prime` as the second brain. Coverage is still by user job,
not command count. Observable, interruptible work, fail-closed unattended
approval, and "children may narrow, never widen" remain product
invariants. ADR-0167 (foreground-owned sessions; background needs a
grant) still applies to optional engines. A donor organ that would
compete with the Rhizome loop (a second planner, a second credential
store, a second memory file) is still rejected.

The short form is now: **borrow with care; own the loop.** "Absorb
metabolites, not organs" remains the filter for *foreign* runtimes. It
is no longer a ban on Rhizome growing its own organs.

## Borrowing rule (standing policy)

Copy ideas freely. Copy code only after the licence check.

For each borrowed piece, pick **Library** or **Copied** and record the
choice.

**Provenance for copied code.**

1. A header comment on the copied file, or on the directory README if
   many files share one source: repo URL, exact commit or version, and
   licence name.
2. One line in [`docs/vendored-sources.md`](../vendored-sources.md):
   path, source, pin, licence, and the date it was copied.

That file is the index a later session diffs against upstream. Do not
scatter pins only in commit messages.

Incompatible licences stay ideas. Rebuild, do not copy.

## Options considered

* **Option 1: client of harnesses (ADR-0177).** Rejected 2026-10-09.
  It left Rhizome unable to ship a loop the product now wants, and it
  treated #56 as leftover rather than a start.
* **Option 2: Rhizome owns the loop; others are backends.** Inside the
  territory of this decision. Prime, Hermes, and later hosts are
  optional engines, not required.
* **Option 3: borrow code into a Rhizome-owned loop (chosen).** Same
  ownership as option 2, plus an explicit borrow path. DeepSeek
  Harness plugins are the named first donor. Licence and pin rules
  above are how the 0177 rejection is met, not ignored.

## Consequences

Recorded here. Not implemented by this ADR.

1. [#56](https://github.com/tuckcode/rhizome-agent/issues/56) is closed
   as won't-remove. The direct-to-provider path in
   `src-tauri/src/ai_models.rs` is a starting point for Rhizome's own
   loop.
2. [#45](https://github.com/tuckcode/rhizome-agent/issues/45) (model
   provider settings) and [#48](https://github.com/tuckcode/rhizome-agent/issues/48)
   (OmniRoute) must be re-read under this ADR. This file does not
   decide their designs.
3. Hermes ACP from [#85](https://github.com/tuckcode/rhizome-agent/issues/85)
   / ADR-0178 stays as one optional engine. The Prime daemon connection
   (ADR-0163) stays optional.
4. [#81](https://github.com/tuckcode/rhizome-agent/issues/81) /
   [#86](https://github.com/tuckcode/rhizome-agent/issues/86) session
   search index, and the vault-layer pieces from ADR-0177 (persona,
   skills, permissions / edit approval, Markdown memory, provenance),
   remain Rhizome-owned. That part of 0177 still holds.
5. Phase 1 of implementation is a bare agent loop plus behavior tests
   that run in CI, before features. A separate harness plan doc
   (another teammate writes it) will follow this ADR.
6. ADR-0177 is superseded. ADR-0168 and `harness-doctrine.md` keep the
   borrow-care rule and drop the Prime-only execution lock.

## Advice

Atticus / knispo, 2026-10-09, room consensus. Dank.bot, Nightly Audit
Engineer, dr eggbot, and G-baby. Reverses the 2026-10-05 option 1 call.

[[0177-rhizome-is-a-client-of-harnesses]]
[[0168-selective-harness-doctrine]]
[[0163-connect-to-the-prime-daemon]]
[[0178-generic-acp-client]]
