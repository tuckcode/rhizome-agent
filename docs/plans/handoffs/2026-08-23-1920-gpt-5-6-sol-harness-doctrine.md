---
session: 2026-08-23T19:20Z
model: GPT-5.6 Sol
description: >-
  Ratified the selective harness doctrine (ADR-0168): Rhizome borrows
  contracts and artifacts from Hermes, DeepSeek Harness, and similar stacks,
  never their runtimes or memory stores. Source reviews for Prime 0.8.0,
  Hermes, and DeepSeek plus five-frame scoring are on disk. Cross-linked from
  CONTEXT, the v0 brief, architecture docs, and AGENTS.md. Mycelium overlay
  and two-model picker remain open findings.
---

# Selective harness doctrine — 2026-08-23

## Decision

Rhizome is not assembling a Frankenstein harness. The rule is:

**Absorb metabolites, not organs.** Prime executes. Rhizome presents and
remembers. Other harnesses may donate contracts, UX patterns, and evaluation
methods. They may not donate a second agent loop, credential store, scheduler,
or memory authority.

That is ADR-0168. The readable ledger is `docs/design/harness-doctrine.md`.

## What landed on disk

Source reviews (read these if the question is “what does that stack actually
do?”):

- `docs/plans/2026-08-24-prime-harness-take-leave-audit.md`
- `docs/plans/2026-08-24-hermes-harness-source-review.md`
- `docs/plans/2026-08-24-deepseek-harness-source-review.md`

Divergence scoring (the five frames, pruned):

- `docs/plans/2026-08-24-harness-doctrine-divergence.md`

Cross-links: `CONTEXT.md`, v0 brief/roadmap, `rhizome-prime-harness-vision.md`,
`ARCHITECTURE.md`, `ABSTRACTIONS.md`, `AGENTS.md`.

The architecture/abstractions Prime sections now say the resident-on-close
prose is **current code**, not policy. ADR-0167 remains the lifecycle
implementation slice.

## Source verdicts in one line each

- **Prime:** take the engine; wrap policy; do not chase command-count parity.
- **Hermes:** take observability, least-privilege children, fail-closed
  unattended work, and `unknown`; adapt memory approval into vault promotion;
  reject the runtime and default-on memory writes.
- **DeepSeek Harness (`dsh`):** take durable-vs-live events, tool render
  intent, replay/e2e; reject running `dsh` behind Rhizome. Do not collapse
  this name into the DeepSeek API or the V3.2 training paper.
- **Switchyard:** experimental router behind Prime only; already in the wiki.
- **OpenHuman:** named, not source-reviewed; defer.

## Not done by this write-up

- ADR-0167 is still unimplemented in `prime_session_host`.
- C48: model picker showed two models against a Prime catalog of 501.
- C49: Mycelium click → white overlay, process still alive.
- `@tauri-apps/api` 2.10.1 vs Rust `tauri` 2.11.1 after the C45 bump.

## Completion

- QA: docs only; no runtime change.
- Tests/coverage: not run; no code.
- Codacy: not run; no code.
- Localization: no UI copy changes.
- PostHog: no event needed because this is a decision record, not a feature.
- Refactoring: none needed.
- ADRs: ADR-0168 added.
- Docs: doctrine, source reviews, divergence scoring, CONTEXT, v0 brief,
  vision, ARCHITECTURE, ABSTRACTIONS, AGENTS.md, this handoff.
- Demo vault dirt: none.
