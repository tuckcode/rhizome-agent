# W5 — Prime surface context

**Owner:** Cursor Grok 4.6 (W5 Prime surface paper).
**Start:** 2026-09-14 ~11:17 CT. Follow the [parent contract](README.md).

Read [the #5 index](../../../design/prime-agent-surface.md), [spoken buckets](../../../design/prime-spoken-surface.md), and composition/#56 notes.

1. Preserve the existing documents and their source pointers.
2. Separate current implementation, product intent, and blocked decisions.
3. Map each selected user job to code, observed evidence, and its remaining gate.
4. Correct claims that call #5 complete or treat doctrine as fully ratified.
5. Link W4's actual reliability remainder and W6's blocked import decision.

**Done:** the index identifies the next bounded client job without inventing an engine or treating command counts as coverage.
**Stop:** #56 removal, composition ratification, new RPC semantics, native extension UI, or a foreign harness graft.
Read installed Prime documentation for external semantics. Record unprobed claims as unverified.

```text
Owner: Cursor Grok 4.6 / W5 Prime surface paper
State: ready to integrate
Starting revision: 4416411
Owned paths:
  docs/design/prime-agent-surface.md
  docs/design/prime-spoken-surface.md
  docs/plans/s-plans/2026-09-13-astra/W5-prime-surface.md
Sibling overlap and release condition:
  W1 owns BOARD/HANDOFF/NEXT/YOU-SHOULD-KNOW/MORNING — this lane does not edit them.
  W4 owns native Chat evidence — linked, not re-run.
  W6 owns import-jsonl-decision.md — linked; no list-import code.
  W7 owns shared Rust — not touched.
One bounded change or evidence task:
  Paper gaps only: intended vs implemented vs unresolved; #56 contradiction without removal;
  job/evidence/blocker table; W4 remainder + W6 blocked-on-1 links. #5 stays outline.
Acceptance cases:
  An agent can name Prime-intended ownership, Rhizome-implemented jobs, and the next gated slice
  without inventing an engine or closing #5.
Evidence: command / native observation, revision, result, evidence path
  Read installed Prime 0.9.3 docs (daemon.md, rpc.md, usage.md, sdk.md) plus
  importFromJsonl source comment. No live daemon probe. No /Applications launch.
  Re-counted ai_models.rs = 788 lines; stream_ai_model + api_model route still present.
  Snapshot still 106 / spoken 39 / never-call 7 / unspoken 60 (2026-09-12).
Commit: none (parent: do not commit)
Pushed: no
Installed build tested: no — still 476756c
Unverified behavior:
  Live import_jsonl replacement/cancel/list-row mint
  Live mutate_queued_message / set_steering_mode / set_follow_up_mode
  roster_subscribe / get_direct_worker_transport
  W4 five native cases
Blocker and next action:
  #5 stays OPEN. Composition option 2 unratified. #56 keep-vs-remove is Atticus.
  List-import blocked until Atticus says 1.
  W1 may stamp BOARD/HANDOFF to this paper. No product code.
```

## What this pass added

- Three-layer split: intended ownership / implemented behavior / unresolved decisions.
- #56: `ai_models.rs` (788) + `stream_ai_model` + `api_model` still contradicts ADR-0168’s “no second provider path.” ADR-0168 is agent-ratified design intent, not Atticus-settled. Providers not removed.
- Job / evidence / blocker table on the #5 index.
- W4 pointer: five native cases NOT RUN (`2026-09-13-2235-…-w4-reliability-evidence.md`).
- W6 pointer: list-import blocked until **`1`**. Route 1 remains a paper recommendation.
- Hide helpers moved from “not built” to “on main; native proof is W4.”
- `set_scoped_models` meaning taken from Prime `usage.md` (picker filter, not routing).
- `import_jsonl` meaning taken from `daemon.md` + installed `importFromJsonl` comment. Labeled unprobed.
- Explicit: #5 is an outline. Spoken 39/106 is not complete.

## Leftover (not this lane)

- Native W4 cases and C64 ×3.
- Atticus **`1`** before list-import.
- #56 keep / remove / amend.
- Composition option 2 + native `extension_ui`.
- Live Prime probes for unspoken commands.
- W1 living-docs stamp of these links.
