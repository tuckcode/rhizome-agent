---
session: 2026-09-06-2152
model: Composer
description: >-
  Planning brief for the remaining session-import half: Prime session-list
  rows (Claude Code first). Vault Imports/ already shipped; Atticus must pick
  import_jsonl route before build.
---

# Prime session-list import — remaining half

**Origin:** Composer · 2026-09-06 · planning only (no product code)

Plan: [`plans/2026-09-01-session-import-plan.md`](../../2026-09-01-session-import-plan.md).
Vault UI: [1816](2026-09-06-1816-composer-session-import-first-run.md).

## What exists

Claude Code history can land as vault notes under `Imports/claude-code/`
(Settings → Import chat history). Re-runs skip via the **ledger** (checklist
at `<vault>/.rhizome/import-ledger.json`).

Engine in `src-tauri/src/session_import/`: Claude Code scan/adapter,
content + fuzzy **fingerprints** (hashes so the same thread from two apps
matches), dedup, preview, vault writer, Settings UI. A **selection policy**
already caps which threads deserve an expensive session-list row.

## What is missing

1. **Prime session-list rows** — no left-Sessions entries yet. Intent was
   “always a list row; also a vault note when a vault is open.” Vault half only.
2. Later: Cursor / ChatGPT / Hermes adapters; fuzzy review sheet; first-run
   Welcome import (C9).

## Blocker (Atticus)

Prime’s `import_jsonl` **replaces the active session** — it does not mint
one new list row per call.

| Route | Idea | Cost |
|---|---|---|
| **1** | `new_session` + `import_jsonl` per thread | Public API; displaces open chat |
| **2** | Write into `~/.prime/agent/sessions/` | Fast; fights ADR-0163 |
| **3** | Vault-only | Contradicts “always list row” |

Plan default: **route 1** after Atticus accepts displacement (mitigate with
selection caps).

## Smallest shippable slice

After route 1 OK: Claude Code only → reuse scan/dedup/selection →
`new_session` + convert + `import_jsonl` for selected threads → record
`prime_session_id` on ledger (backfill notes) → restore prior active
session. No new adapters in the same slice.

## Risks

- **Dedup:** vault-only ledger may say “imported” with no Prime id — second
  pass must backfill rows without duplicate notes.
- **Fingerprints:** cross-source same content must still skip.
- **Displacement:** large batches thrash the open chat unless caps + restore
  are solid. Route 2 breaks if Prime’s on-disk shape changes.

## Out of scope

Gate-fix files owned by another agent; product code; commit/push.
