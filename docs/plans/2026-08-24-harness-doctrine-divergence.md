# Harness-doctrine divergence — score and cluster

**Date:** 2026-08-24  
**Status:** working notes behind ADR-0168  
**Frames:** regulator, 3am on-call, remove-assumption, game design, biology  
**Agents:** [Regulate harness doctrine](e8f831c4-494b-43ce-bcfb-e75fa32aeac2), [On-call harness doctrine](948d179d-68b2-4852-8431-8d086a4526a5), [Remove harness assumptions](fe24581f-9dd0-4d2d-896b-6f27fc05bfad), [Game-design harness doctrine](2627660e-1ca5-4080-a0b1-8ffe0ba02c93), [Biology harness doctrine](a4268485-c02c-48f5-94c9-21b93def2bcd)

Thirty ideas, scored for distinctiveness, checkability, alignment with the
already-decided Prime/Rhizome split, and whether they prevent a Frankenstein
product. This file keeps the raw set; the ratified language is
[`docs/design/harness-doctrine.md`](../design/harness-doctrine.md).

## Survivors (keep and deepen)

| Cluster | Surviving rule | Why it survived |
|---|---|---|
| **Metabolites, not organs** | External harnesses may donate artifacts and contracts, never control loops. A borrowed piece that can survive after Prime is removed is an organ and does not belong in Rhizome. | Biology trophic-dependence + metabolites; on-call “compile into Prime-native requests”; game “Prime remains the character.” This is the Frankenstein test. |
| **Dormancy is homeostasis** | Every execution begins as a disposable foreground lease. Always-on is an induced state that needs a visible, revocable grant. | Biology apoptosis/hormone; remove-assumption lease; regulator typed promotion; already decided as ADR-0167. |
| **Markdown is the only durable boundary** | Prime may propose; Rhizome alone commits versioned markdown with provenance. Anything that cannot be represented faithfully in markdown stays operational. | On-call two-key write; regulator markdown fidelity; game “only player-promoted markdown survives”; matches the vault SoT. |
| **Lineage locks** | Desktop UX, durable memory, and execution may evolve but may not exchange ownership. Core chat depends only on Prime; enhancements depend inward. | Biology lineage locks; on-call inward dependency. Prevents “just this once” ownership swaps during refactors. |
| **Transplant half-life** | Every imported pattern expires unless a named renewal test shows observed user value, and it enters through a replaceable adapter with a deletion proof. | Regulator expiration + deletion proof; biology half-life; game consumable cards. Stops borrowed mechanisms becoming permanent by inertia. |
| **Failure grammar** | Each adapter maps error classes to one degraded product state and one operator action. Uncertainty is not success and not generic failure. | On-call failure grammar; Hermes `unknown`; DeepSeek live-versus-durable. Directly useful for diagnosis. |

## Useful, but narrowed

| Idea | Keep as | Do not keep as |
|---|---|---|
| Portable execution receipt | Prefer Prime protocol events and capability negotiation over inferred UI state | A new Rhizome-invented receipt format |
| 3am packet | One reconstructable incident trail across intent, events, grants, and memory writes | A new file type or sidecar log |
| Outcomes, not primitives | Product copy and v0 surfaces talk in user jobs | Hiding stop/status/tools; observability is a TAKE from Hermes |
| Capability bundles on goals | Background grants and tool scope attach to a job | A new global “agent mode” profile |
| Vault trust ledger | Vault access tiers and per-vault consent already exist | A second gamified permission RPG |
| Autonomy heat | Bounded grants that expire and return control | A literal heat-meter HUD |
| Ghost runs | Dry-run / inspect-before-grant if Prime can do it | A second execution path that simulates tools as user messages |

## Pruned traps

- **“Rhizome becomes a task compiler rather than a harness console.”** Outcome-first is right; erasing the harness surface fights the Hermes craft bar and makes failures undiagnosable.
- **Consumable cards as permanent product anatomy.** The half-life idea is the keepable part. Card UX is decoration.
- **Mutually suspicious subsystems taken as hostility.** Memory must not silently start execution, and execution must not silently canonize notes. That is a write-gate, not an air gap that blocks promote/search.
- **OpenHuman / Switchyard as peer characters.** They may contribute a temporary stance or experiment. They are not runtimes and not brand identities.

## Scoring notes

Highest-signal overlap across all five frames: **Prime-only execution**, **explicit leases**, **markdown-only durability**, and **reversible borrowing**. Those four appear in every frame under different metaphors. That is why they became doctrine rather than flavor.