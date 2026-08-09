# Consolidation spike — scope, 2026-08-02

Scopes `docs/design/automatic-memory-consolidation.md`'s "recommended next
step" (L0→L1 only, behind a flag) into something buildable. Not started —
this is the plan to react to before any code lands, per that doc's own
instruction not to commit to a shape prematurely.

## Two corrections found while scoping (worth stating up front)

1. **`useFeatureFlag.ts` is the wrong gate.** It's PostHog + localStorage,
   resolved in the frontend. The spike's trigger lives in Rust, fires from
   a background/event-driven context with no browser to read localStorage
   from. The flag needs to live in `Settings` (`settings.rs`, the existing
   `pub struct Settings` with its `Option<bool>` fields — e.g.
   `automatic_consolidation_enabled: Option<bool>`, defaulting to `None`/off,
   same shape as `autogit_enabled`/`ai_features_enabled` next to it) and be
   read directly by the trigger check, not through the frontend flag hook.
   The frontend can still surface a toggle in Settings UI that writes this
   field — that part *does* reuse existing plumbing (`save_settings`,
   `preferred_app_config_path`) — but the gate itself is backend-native.

2. **`rhizome_jobs.rs` is the wrong wrapper.** Its own doc comment says it
   exists for frontend-initiated cancellable operations — "the frontend
   gets a job ID back immediately." A trigger that must fire without any
   UI action doesn't fit that shape. What *does* fit: `rhizome_distill.rs`'s
   actual agent-invocation entry points (`run_distill_via_target`,
   `run_distill_via_agent`, line ~178/240) have **no `AppHandle` dependency**
   — confirmed by grep, zero matches for `AppHandle`/`app_handle` in that
   file. The frontend-progress-event emission is a separate wrapper
   (`rhizome_jobs.rs`) around the same underlying call. The spike calls
   Distill's core functions directly, skipping the frontend-job wrapper
   entirely — it's not blocked by Tauri's architecture, it just needs to
   avoid the one piece of existing infra that assumes a UI initiated it.

## What the spike actually does

L0→L1 only, matching the design doc's own recommendation to not commit to
L2/L3 until this works:

1. **Trigger**: a checkpoint file, `.rhizome/consolidation-state.json`
   (new — one field, `last_processed_line: usize` or similar, indexed
   against `.rhizome/events.jsonl`'s line count). After every
   `vault_events::append` call, if `Settings.automatic_consolidation_enabled`
   is true, compare current event count to the checkpoint; if the delta
   exceeds a threshold constant (start with something like 20, tune later
   — this number is a real open question, not a placeholder to accept
   blindly), run consolidation and update the checkpoint.
2. **Consolidation itself**: read the events since the checkpoint, build a
   prompt the same shape as Distill's existing
   `build_distill_prompt`/`parse_agent_response` pair (reuse the parsing
   contract, don't invent a new response format), call `run_distill_via_target` — confirmed via grep as the one real caller
   (`rhizome_api.rs:155`) actually uses for the equivalent manual case;
   `run_distill_via_agent` has no non-test callers today and isn't the
   established path, write the result via the existing
   `write_distilled_card`/`ArtifactKind::Concept` path — **no new artifact
   kind for the spike**, output lands exactly where a manual Distill call
   would.
3. **Where the hook lives**: `vault_events::append` is the single writer
   (per its own module doc, "the single writer for `.rhizome/events.jsonl`"
   as of the 2026-07-31 consolidation of four independent writers into one)
   — the threshold check belongs right after a successful append in that
   module, not scattered across the six call sites that invoke it. One
   check point, matching the module's own stated invariant.

## Explicit out of scope for the spike

- L2 (scenes) and L3 (persona) — sibling design doc's own recommendation,
  restated here so it isn't accidentally pulled in mid-implementation.
- New `ArtifactKind` — output uses `Concept`, same as manual Distill.
- Any frontend UI beyond a single Settings toggle wired to the existing
  save/load path — no new panel, no progress UI, no cancellation
  affordance (unlike `rhizome_jobs.rs`'s wrapped operations, this doesn't
  need one — it's not user-initiated, there's nothing to cancel from).
- Tuning the event-count threshold — pick a placeholder, flag it as
  needing real data before shipping past the spike.
- Solving what happens if consolidation fires while another agent
  operation is mid-flight on the same vault (a real concurrency question —
  `append` already has to be safe for concurrent writers per its existing
  design; consolidation reading+writing while that's happening needs its
  own look, not assumed safe by default).

## Acceptance criteria for the spike (not the final feature)

- Flag off by default; with it off, zero behavior change, zero new writes,
  verified by a test that asserts no `.rhizome/consolidation-state.json`
  gets created and no extra `Concept` cards appear when the flag is unset.
- With it on, in a fixture vault: append events past the threshold,
  confirm exactly one consolidation card is written, confirm the
  checkpoint advances so re-running the same event log doesn't
  double-consolidate.
- Full existing suite (`cargo test --lib`, `pnpm test`) unaffected — this
  is additive, the manual Distill path must be provably untouched.
- No new abstraction beyond the checkpoint file and the threshold
  constant — if the spike needs more than that to work, that's a signal
  to stop and re-scope, not push through.

## Recommended next step

This scope is buildable as a single well-bounded change — real files
named, real entry points identified, both wrong-assumption traps from the
original design doc already caught. If this gets a go-ahead, it's sized
right for one focused implementation pass (TDD, one commit per AGENTS.md's
convention), not a multi-session initiative like the design doc's L2/L3
would be.
