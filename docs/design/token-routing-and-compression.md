# Token routing and compression

**Status:** wanted, not started. Pickup: [`docs/NEXT.md`](../NEXT.md) §1
(discuss/plan). Evaluation 2026-08-26; product intent the same day: **both**,
stacked, later. Not an ADR. Not a build ticket.  
**Filter:** [ADR-0168](../adr/0168-selective-harness-doctrine.md) /
[`harness-doctrine.md`](./harness-doctrine.md).  
**Earlier Switchyard note:** vault
`projects/rhizome-agent/switchyard-model-routing`
(2026-08-23) and the handoff
[`2026-08-23-1518-gpt-5-6-sol-mid-turn-and-folder-hardening.md`](../plans/handoffs/2026-08-23-1518-gpt-5-6-sol-mid-turn-and-folder-hardening.md).

Two things that both call themselves a “router” showed up in the same week.
They are complementary. They are not substitutes. Neither is a Rhizome organ.

| | TinyHumans TokenJuice | NVIDIA NeMo Switchyard |
|---|---|---|
| Routes | a **tool result** to a **compressor** | a **model request** to a **backend** |
| Sits | on the tool-return path, before context | in front of inference |
| Saves | tokens that never enter the window | frontier-model calls that did not need one |
| Failure | over-compacted context | wrong model / broken tool protocol |
| Rhizome stance | **DEFER behind Prime.** Do not compact independently. | **DEFER behind Prime.** Do not grow a router. |

```
tool result ──► TokenJuice ──► compact text ──► Prime context
Prime request ──► Switchyard ──► chosen model
```

If both trials are ever pulled, they stack. They do not replace each other.

---

## TokenJuice (TinyHumans / tinyjuice)

Upstream is [vincentkoc/tokenjuice](https://github.com/vincentkoc/tokenjuice):
a deterministic JSON rule overlay that head/tails noisy command output
(`git`, `cargo test`, `docker`, `rg`). Inspectable rules, not an LLM
summarizer. Safe-inventory policy: exact file reads stay raw.

TinyHumans forked that into OpenHuman as a **content-kind router**
([docs](https://tinyhumans.gitbook.io/openhuman/features/token-compression),
[PR 4123](https://github.com/tinyhumansai/openhuman/pull/4123)). The old
rule overlay is still the log/command compressor. Around it:

1. Size gate (default 2 KB).
2. Detect kind: JSON, Diff, HTML, Search, Code, Log, PlainText.
   Hint → MIME → per-tool prior → cheap structure. No regex on the hot path.
3. Pick a specialized compressor (SmartCrusher tables, tree-sitter code
   signatures, ranked search hits, diff hunk collapse, HTML→text, rule-engine
   logs, optional local ModernBERT salience).
4. Never grow the payload. Decline or fall through if it would.
5. For lossy output above ~500 tokens, **CCR** (Compress-Cache-Retrieve)
   stows the original and leaves `⟦tj:<hash>⟧`. The agent calls
   `tokenjuice_retrieve` to zoom in.

This is **not** model routing. It does not pick who thinks. It shrinks what
the current model is about to eat.

Doctrine already forbids the tempting Rhizome transplant: “Visualize Prime's
model-visible projection; **never compact independently**”
([`harness-doctrine.md`](./harness-doctrine.md) ADAPT row). A second
compaction authority is an organ. If we deleted Prime tomorrow and TokenJuice
kept rewriting tool results, we would have grown a harness.

### Implementation verdict

**Do not vendor `tinyjuice` in Rhizome. Do not shrink Prime tool results in
the desktop.**

Allowed metabolites, if a user job appears:

- **Display collapse** of huge tool cards in Chat (what the human sees).
  That does not change what Prime sent the model.
- **Render a CCR breadcrumb** if Prime (or a Prime skill) ever emits one:
  “partial view — retrieve available.” Rhizome does not own the cache.
- **Ask Prime** for content-aware tool-output reducers, or a skill that
  wraps them. The loop that decides what the model sees stays in Prime.

A TinyHumans-shaped compressor on menu-bar capture or Inbox distill is a
different job (notes, not agent context). Do not start it from this note.

This is a **partial OpenHuman read** of one feature. It is not the deferred
full OpenHuman source review.

---

## Switchyard (NVIDIA NeMo)

Evaluated 2026-08-23 as a Prime-side experiment. The public pairing with
Nemotron 3.5 Lightning (late August 2026) does not change the boundary.

Switchyard is a Rust proxy / library that routes each request to a model:
passthrough, random A/B, LLM classifier, escalation, and a **stage router**
driven by agent-native signals (tool results, errors, exploration, churn).
It also translates OpenAI Chat ↔ Anthropic Messages ↔ OpenAI Responses.
Cost drop comes from not paying a frontier model for every grep-and-summarize
step.

The right path is still:

`Rhizome Agent → Prime → Switchyard sidecar → providers`

Prime already owns model discovery, session model state, credentials, tools,
goals, compaction, subagents, and execution. Embedding `switchyard-libsy` in
`ai_models.rs` would only route Rhizome's leftover direct-model path and
bypass the harness. That is rejected for Prime chat (ADR-0168).

Still pre-alpha. Protocol issues that hit an agent loop remain open as of
2026-08-26:

- [#515](https://github.com/NVIDIA-NeMo/Switchyard/issues/515) — Codex tools
  dropped in translation.
- [#502](https://github.com/NVIDIA-NeMo/Switchyard/issues/502) — reused
  tool-call IDs break multi-turn Anthropic workflows.
- [#521](https://github.com/NVIDIA-NeMo/Switchyard/issues/521) —
  system/developer roles demoted to user.
- [#493](https://github.com/NVIDIA-NeMo/Switchyard/issues/493) — no
  subagent-aware routing.

Dynamic routing also conflicts with today's UI: `PrimeModelPicker` implies
the selected model is the one that answered. A trial must distinguish the
logical route from the physical model, through Prime, not by guessing in
Rhizome.

### Implementation verdict

**Do not implement in this repo.** Same trial path as 2026-08-23, if pulled:

1. Pin a Switchyard release. Loopback-only sidecar.
2. Passthrough first: prove Prime's tool workflow, streaming, roles,
   reasoning, and multi-turn tool IDs.
3. Random A/B for a baseline.
4. Stage routing only after protocol fidelity holds.
5. Measure task success, tool-loop correctness, latency, and cost — not
   “the request completed.”
6. Expire the sidecar unless a named user-value test renews it.

Do not embed `switchyard-libsy` before that evidence exists.

---

## What we will not build from this note

- A Rhizome model router for Prime chat.
- A Rhizome TokenJuice pass over Prime tool output.
- OpenHuman or Switchyard as a second runtime or brand.
- Closing the deferred OpenHuman source review on the strength of one
  compression page.

## Product intent (2026-08-26)

Want both. That is a later system, not a Rhizome organ:

1. **TokenJuice-shaped first.** Prime (skill / daemon) shrinks tool results
   before they enter context; Rhizome renders “partial — retrieve.” We already
   collapse tool *cards* and compact old *turns*. The missing piece is
   content-kind shrink of each blob as it arrives.
2. **Switchyard-shaped second.** Cheap model for grep-and-summarize, frontier
   for the write-up. Path is still a Prime sidecar. Halfway house if pulled
   sooner: speak Prime’s existing `set_scoped_models` (daemon has it; Rhizome
   does not) so a human can pin scopes without a proxy.
3. **Rhizome never owns the loop.** Show what was compacted. Show which model
   answered. Distinguish the picker (logical route) from the physical model.

## If a trial is pulled

Name the user job first. Coverage is not “Prime has a command” and not
“TinyHumans/NVIDIA shipped a router.”

| Trial | Owner | Half-life test |
|---|---|---|
| TokenJuice-shaped tool compaction | Prime (skill / daemon), Rhizome renders only | A long Chat session stays useful *and* the model can still retrieve a compacted original when it needs it |
| Switchyard stage routing | Prime's provider URL points at a sidecar | Tool-loop correctness matches passthrough; cost drops on a named workload |

Rhizome's job in both cases is the desk: show what was compacted, show which
model answered, keep the vault out of operational state.

## Sources

- [TinyHumans token compression](https://tinyhumans.gitbook.io/openhuman/features/token-compression)
- [OpenHuman PR 4123](https://github.com/tinyhumansai/openhuman/pull/4123)
- [vincentkoc/tokenjuice](https://github.com/vincentkoc/tokenjuice)
- [tinyjuice router docs](https://docs.rs/crate/tinyjuice/latest/source/wiki/Router-and-Compressors.md)
- [NVIDIA-NeMo/Switchyard](https://github.com/NVIDIA-NeMo/Switchyard)
- [NVIDIA Switchyard announcement](https://developer.nvidia.com/blog/route-ai-agent-workloads-across-models-with-nvidia-nemo-switchyard/)
- Vault: `projects/rhizome-agent/switchyard-model-routing`
