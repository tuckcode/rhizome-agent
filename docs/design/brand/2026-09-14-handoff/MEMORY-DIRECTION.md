# Memory direction: keep the work and the reason

**Status:** design concept. No new architecture or shipped capability is declared here.
**Input:** Atticus's shared “Rhizome Memory Model” conversation, ID `6aa76c2a-a238-83ea-b90e-0824cfcefade`.
The conversation is reference material. Its illustrative ADR dates and commit examples are not repository evidence.

The product opportunity is inspectable continuity. A person should see what Rhizome retained, where it came from, and how to correct it.
Prime executes work. Chat supports conversation. Durable knowledge belongs in vault Markdown.
The product should distinguish a recorded decision from an agent inference.

## Smallest useful presentation

Start from the existing `From your vault` source presentation described in `docs/design/memory-loop.md`.
Verify the current implementation before changing it. Preserve source navigation and existing note authority.
A useful future detail view could show a claim, its source, the reason it was retained, and a correction history.
Only display fields that exist. A timestamp is not proof. An agent's confidence is not verification.

## Proposed vocabulary, for later design

| Term | Intended meaning |
|---|---|
| Observed | A source or event was encountered. |
| Inferred | An agent drew a conclusion that may be wrong. |
| Proposed | Someone suggested an idea for consideration. |
| Verified | Specific evidence supports the claim. |
| Hardened | An authorized decision accepted the claim for reliance. |
| Superseded | A newer accepted decision replaced the claim. |
| Disputed | A challenge remains unresolved. |

This table is a vocabulary study, not a database enum or linear state machine.
Observation, evidence strength, and acceptance may need separate dimensions. Do not force them into one badge before design review.
The source of authority and the correction path need explicit decisions before implementation.

## Within this Cursor window

Improve the readability or accessibility of existing provenance if an actual defect exists.
Retain the archive artwork in the design gallery as an illustration of this direction.
Keep feature claims limited to the present product. Do not add memory-state badges, automatic consolidation, or a second store.

## Later acceptance questions

Can a person open the source behind a retained claim?
Can a person correct it without silently deleting the earlier record?
Can the next Chat distinguish current decisions from superseded proposals?
Does the record identify whether a person or an agent supplied the claim?
Can the system admit that no supporting evidence exists?

These are future design criteria. Cursor should record unresolved decisions instead of asking Atticus during this work window.
