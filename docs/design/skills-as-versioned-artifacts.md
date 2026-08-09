# Skills as versioned artifacts — design sketch

**Status:** speculative, earlier-stage than
`automatic-memory-consolidation.md`. Not an ADR, not close to one — this is
a proposal to react to and probably narrow before it's buildable, not a
plan to implement. Flagging the open questions honestly rather than
pretending the shape is settled.

**Origin:** same 2026-08-02 comparison against
`TencentCloud/TencentDB-Agent-Memory`. Their "skill" is not a prompt
snippet — it carries a version, resource files, trigger boundaries,
execution steps, and validation rules, extracted from a successful agent
interaction, private by default and shared with a team only after review.
Rhizome has no equivalent today: the closest things are static `AGENTS.md`
instructions (seeded once, not versioned, not extracted from experience)
and Distill's `Concept` cards (knowledge, not procedure).

## Why this is a bigger lift than consolidation

Consolidation (see the sibling doc) reuses infrastructure that already
exists almost end to end — the hard part is one missing hop
(background-agent-invocation). Skills have no existing analog to extend:

- **No extraction trigger.** Consolidation has an obvious signal (N new
  events). "This sequence of actions was a successful, reusable procedure"
  has no equivalent signal in Rhizome today — `.rhizome/events.jsonl`
  records *that* something happened, not whether it worked or would
  generalize.
- **No execution engine.** Distill produces markdown for a human/agent to
  *read*. A Tencent-style skill has "execution steps" and "validation
  rules" — implying something runs it, not just displays it. Rhizome has
  no workflow/automation runner. Building one is a materially different
  project than adding an artifact type.
- **No review/approval model.** "Private by default, shared with the team
  after review" implies multi-user permissions and a review UI. Rhizome is
  currently single-vault, single-user-editing (git provides history, not
  live review) — this would be new product surface, not just new storage.

## What could be scoped down to something real

If the goal is "capture reusable procedures," not "build a skills
marketplace," a much smaller version is plausible:

- **New `ArtifactKind::Skill`**, written to `wiki/skills/` (mirrors
  `Concept`'s existing `dir()`/`flat_dir()` pattern in
  `rhizome_write_location.rs` — no new placement logic, just a new enum
  variant and directory constant).
- **"Executable" redefined as agent-followable, not app-runnable.** A skill
  is a markdown procedure with numbered steps and explicit
  preconditions/postconditions — an agent reads it and follows it, the same
  way it already reads `AGENTS.md`. No new execution engine, no new risk
  surface. This drops the hardest part of the Tencent design (a real
  workflow runner) in exchange for something buildable with what Rhizome
  already has.
- **Extraction stays manual, like Distill today.** Instead of automatic
  extraction (which needs a "did this succeed" signal Rhizome doesn't have),
  an agent or user explicitly says "save this as a skill" — same trigger
  shape as Distill's `rhizome_distill` today, just a different `ArtifactKind`
  as the output. No new trigger-reliability problem to audit later.
- **Versioning via git, not a bespoke version field.** Rhizome's whole
  design principle is git as the source of truth for history — a skill's
  "version" is just its git log. Cheaper than inventing a version scheme,
  consistent with everything else in the vault.
- **Skip sharing/review/permissions entirely for v1.** Single-vault,
  single-user, no team model. This is the piece most worth cutting if the
  goal is "ship something," since it's also the piece with no existing
  Rhizome infrastructure to build on at all.

## What this does NOT resolve

- Doesn't answer whether "agent-followable markdown" is actually as useful
  as Tencent's "executable with validation rules" — it's a real
  downgrade in capability, not just a simpler implementation. Worth being
  honest that this might not be worth building if the followable-procedure
  version doesn't actually save meaningful time over just writing a good
  `Concept` note today.
- Doesn't address multi-agent/multi-user sharing at all — deferred
  entirely, not designed around.

## Recommended next step

Don't start here. This is real product surface (a new artifact type, a new
user-facing concept to explain, uncertain payoff) with more open questions
than the consolidation proposal and a much thinner existing foundation to
build on. If pursued, validate the cut-down version's actual usefulness
manually first — have an agent write a few skills as plain `Concept` notes
with a consistent "steps" convention, see if that alone is useful, before
building a dedicated artifact type and directory around it.
