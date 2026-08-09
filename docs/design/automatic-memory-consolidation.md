# Automatic memory consolidation (L0→L3) — design sketch

**Status:** specced, not built. Not an ADR yet — this is a proposal to react
to, not a decision. If it moves forward, promote the accepted shape into a
numbered ADR per `AGENTS.md`'s rule (new core abstraction, in the same
commit as the code).

**Origin:** 2026-08-02 session, comparing Rhizome against
`TencentCloud/TencentDB-Agent-Memory`. Their four-layer episodic→semantic
consolidation model (L0 raw → L1 atoms → L2 scenes → L3 persona, run
automatically every N turns, no agent decision required) directly answers
Rhizome's own standing question better than anything shipped so far: not
"is the save path reliable when triggered" (audited and fixed 2026-08-02,
`docs/plans/2026-07-31-save-path-audit-session-status.md`) but "what if the
agent never decides to trigger it at all." The 2026-07-19 top-priority
question in `docs/HANDOFF.md` is still open on exactly that axis.

## What Rhizome already has

Every layer below already exists as agent-triggered infrastructure — this
proposal is about making the *first two hops* automatic, not building new
storage:

| Tencent layer | Rhizome equivalent today | Trigger today |
|---|---|---|
| L0 (raw) | `.rhizome/events.jsonl` (`vault_events.rs`) | six independent writers, all agent/UI-action-triggered |
| L1 (atoms) | Distill cards (`rhizome_distill.rs`, `ArtifactKind::Concept`, written to `wiki/concepts/`) | agent runs `rhizome_distill` explicitly |
| L2 (scenes) | *loosely* the wiki's link graph — related concepts connected by wikilinks | manual, whoever writes the note decides the links |
| L3 (persona) | **nothing** | — |

`ArtifactKind` (`rhizome_write_location.rs`) is the single source of truth
for where artifact kinds live in a vault (`RepoWiki`, `Document`, `Entity`,
`Concept` today) — every future writer already routes through it so paths
can't drift. This is the natural extension point.

`VaultEvent` (`vault_events.rs`) already guarantees every event carries
`type`, `trigger`, `timestamp` — a real, structured L0 that a consolidation
pass could read without inventing a new format.

There's already async job infrastructure (`rhizome_jobs.rs`,
`start_rhizome_job`/`cancel_rhizome_job`) and a filesystem watcher
(`vault_watcher.rs`, `notify`-based) — both real candidates for what drives
consolidation without adding a new scheduling primitive.

## Proposed shape

**Trigger: event-count threshold, not wall-clock.** Tencent's "every five
turns" doesn't map cleanly onto Rhizome, which has no turn concept — it has
vault events. Proposal: consolidation runs after N new `.rhizome/events.jsonl`
records since the last consolidation checkpoint (a marker file, e.g.
`.rhizome/consolidation-state.json` recording the last-processed event
offset/timestamp). This reuses the existing event log instead of adding a
timer, and naturally scales to how active a vault actually is — an idle
vault never wastes a consolidation pass.

**L0→L1 (atoms): mostly automate what Distill already does, on the
threshold.** Instead of the agent choosing to run `rhizome_distill`,
a background job periodically scans events since the last checkpoint,
extracts facts/preferences/constraints (same shape as Distill's existing
`TITLE:`/`CONTEXT:`/`---`/body agent-response parsing in
`parse_agent_response`), and writes them the same way Distill already does
— no new write path, just an automatic caller instead of a manual one.
**Open question:** who invokes the agent call itself? Distill today shells
out to an agent (Claude CLI, or an injected API model per
`distill_via_injected_api_model`) — automatic consolidation needs a
background-safe way to make that call without a live chat session driving
it. This is the actual hard part, not the storage format.

**L2 (scenes): new, smaller than it sounds.** Group atoms from the same
consolidation window by shared entity/project frontmatter (already-present
fields, not new ones) into a lightweight "scene" note — a `Concept`-kind
artifact whose body is mostly wikilinks to the atoms it groups, not new
prose. Low risk: worst case it's a slightly-redundant index note.

**L3 (persona): the genuinely new artifact type.** A per-vault (not
per-project) note — `Entity`-kind, one canonical path, e.g.
`wiki/entities/persona.md` — rebuilt (not appended) every M new atoms,
summarizing recurring patterns: conventions, defaults, standing
preferences. This is the one piece with no existing analog in Rhizome.
**Open question:** rebuilt-from-scratch each time (simple, matches
Tencent's "rebuilt every 50 new memories") vs. incrementally revised —
rebuilt is safer to implement first and matches the existing Distill
pattern of full-card writes, not partial edits.

## What this deliberately does NOT do

- Does not touch the *manual* save/trigger/Distill paths — those stay
  exactly as audited and fixed 2026-08-02. This is additive, not a
  replacement.
- Does not add a wall-clock scheduler, cron-like infra, or a new daemon —
  reuses `rhizome_jobs.rs` + the event-count threshold.
- Does not solve the "background agent call without a live session" problem
  — flagged above as the real blocker, not solved here.
- Does not decide review/approval semantics for L3 persona notes (should a
  user confirm before a persona note overwrites itself?) — a real product
  question, not an engineering one.

## Recommended next step

Scope L0→L1 automation alone first (reuses Distill's existing write path
entirely, smallest surface, directly answers the standing 2026-07-19
question) as a spike behind a feature flag, before committing to L2/L3.
Needs a real answer to the background-agent-call question before any code
lands — that's the part worth spending design time on, not the storage
shape, which mostly already exists.
