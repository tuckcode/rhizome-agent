---
type: ADR
id: "0168"
title: "Selective harness doctrine: contracts and artifacts, never second runtimes"
status: active
date: 2026-08-24
supersedes: "the unratified 'full harness desktop' / command-count parity premise; does not supersede ADR-0163 transport or ADR-0167 lifecycle"
---
## Context

Rhizome Agent sits next to several serious agent harnesses: Prime Agent (the
chosen runtime), Hermes Agent (the craft bar), DeepSeek Harness (`dsh`),
NVIDIA NeMo Switchyard, and other CLIs inherited from Desktop. The temptation
is to assemble a Frankenstein: keep Prime, then graft Hermes memory, a DeepSeek
loop, a Switchyard router, and always-on residency into the desktop until
Rhizome owns three execution stories and two memory authorities.

That contradicts decisions already on the books:

- Prime is the only runtime in the product UI (`CONTEXT.md`, v0 brief).
- The vault is the durable source of truth; Prime session and continual-harness
  state are operational.
- ADR-0163: Rhizome is a client of Prime's daemon and does not own it.
- ADR-0167: Rhizome-created work is foreground-owned; background execution
  needs an explicit grant.

The missing decision was how to *borrow* without transplanting. A 2026-08-24
source review of Prime 0.8.0, Hermes, and DeepSeek Harness, plus a five-frame
divergence pass, produced a single rule that fits those constraints.

## Decision

**Rhizome absorbs metabolites, not organs.**

- **TAKE** Prime's execution substrate and any foreign *contract* that makes
  that substrate observable, interruptible, attributable, or fail-closed.
- **ADAPT** foreign UX and memory-approval patterns onto Prime's protocol and
  Rhizome's vault.
- **REJECT** every second runtime, credential store, scheduler, memory
  authority, or command-count parity program.
- **DEFER** experiments (Switchyard, teams, bundling, extra surfaces) until a
  user job exists and the borrow has a half-life plus a deletion proof.

Coverage is by user capability — chat, supervision, consent, promote-to-vault —
not by the fraction of Prime daemon commands implemented.

The full ledger and source verdicts live in
[`docs/design/harness-doctrine.md`](../design/harness-doctrine.md).

## Options considered

* **Option A (chosen): selective doctrine.** Prime executes; Rhizome presents
  and remembers; other harnesses donate contracts only. Matches the product
  split and ADR-0167. Downside: some attractive foreign features stay out, or
  wait until Prime exposes them.
* **Option B: full harness desktop / one-button-per-command.** The 2026-08-20
  gap-audit premise. Rejected because it turns Prime's internals into Rhizome's
  product backlog and guarantees a clone rather than a memory-native shell.
* **Option C: replace Prime with Hermes or DeepSeek Harness.** Rejected. Both
  are complete runtimes. Transplanting either discards the engine we already
  chose and the daemon protocol we already speak.
* **Option D: Frankenstein assembly.** Pick the “best” organ from each stack.
  Rejected: competing loops, credentials, and memory stores are the failure
  mode this ADR exists to prevent.

## Consequences

* New harness work cites this ADR and the doctrine ledger. “Prime has this
  command” is not sufficient justification.
* ADR-0167 remains the next implementation slice; this ADR does not implement
  lifecycle, it forbids reopening the always-on default as a borrowing question.
* `ARCHITECTURE.md` and `ABSTRACTIONS.md` must stop treating “daemon exists”
  as “session keeps working.” That is current code, not decided policy.
* Switchyard, OpenHuman, and similar experiments enter only behind Prime, with
  an expiration test.
* The inherited `ai_models.rs` provider path may remain for non-Prime Desktop
  leftovers, but it is rejected as an architectural path for Prime chat.
* Source reviews stay in `docs/plans/`; this ADR and the design doc are what a
  later session should read first.
