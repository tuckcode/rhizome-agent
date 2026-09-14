# W6 — import decision paper

**Owner:** existing Cursor Prime implementer, Grok.
**Start:** paper now. Implementation remains blocked.
Follow the [parent contract](README.md).

Read [import routes](../../../design/import-jsonl-routes.md) and its linked implementation brief.

1. Preserve the three routes and the conditional route-1 recommendation.
2. Identify displacement and restoration obligations.
3. Record acceptance for cancellation, partial failure, deduplication, re-import, and vault-less use.
4. Distinguish active handles from durable saved-session identity using verified sources.
5. Mark unknown behavior and the exact decision that unlocks implementation.

**Done:** Atticus can later choose a route from one existing page. The page does not imply a choice already occurred.
**Stop:** no list rows, store migration, new source adapter, or live import into an active user session.
Do not ask Atticus tonight. A completed paper does not complete session import.

```text
Owner: Cursor Grok 4.6 / morning W6 (2026-09-14)
State: complete (paper) | blocked (list-import product)
Starting revision: working tree already had the 2026-09-13 decision page
Owned paths:
  docs/plans/import-jsonl-decision.md
  docs/design/import-jsonl-routes.md
  docs/plans/s-plans/2026-09-13-astra/W6-import-decision.md
Sibling overlap and release condition:
  W1 stamps BOARD/HANDOFF/MORNING. This lane does not touch those.
  W5 links the blocked import decision; do not rewrite the #5 index here.
One bounded change or evidence task:
  Name the God-plan obligations on the existing decision page.
  Keep route 1 as recommendation only. No import_jsonl client.
Acceptance cases:
  Three routes remain. Route 1 is labeled recommendation, not a pick.
  Displacement, restore failure, cancel, partial failure, fingerprint+provenance
  dedup, vault-less acceptance, and handle vs saved-session identity are written.
  Unprobed daemon behavior is labeled unverified.
  Silence is not Atticus saying 1.
Evidence: docs-only. Prime 0.9.3 docs/source read; no live import probe.
Commit: none (this lane does not commit)
Pushed: no
Installed build tested: no — paper only
Unverified behavior:
  unique-basename import vs new_session+import list-row pairing;
  leftover empty new_session files;
  mid-turn import/switch;
  restore when the pre-batch file is gone or leased;
  whether abort cancels import_jsonl;
  whether a second create avoids displacement;
  list_saved_sessions vs disk scan for this job.
Blocker and next action:
  Atticus says 1, 2, 3, or wait. Until then, no list-import code.
```

## Paper result (2026-09-14)

Canonical page: [`../../../plans/import-jsonl-decision.md`](../../../plans/import-jsonl-decision.md).

**Specified now:** live-Chat displacement; restore failure; interrupted/cancelled batches; repeat-import dedup (fingerprint + provenance, any chain); partial failure; vault-less list rows with notes only if a vault is attached; handle (`activeSessionId`) vs saved file (`sessionId` / `sessionPath`).

**Still unverified:** listed on that page. No daemon probe that would move a real Chat.

Route 1 is still the recommendation. Routes 2 and 3 stay alternatives. Implementation stays blocked.
