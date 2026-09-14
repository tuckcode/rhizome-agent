---
session: 2026-09-14T16:26-05:00
model: Grok 4.6 (Cursor)
description: >-
  import_jsonl findings: still vault-only. Silence is not 1.
  Do not wire Prime session-list import until Atticus types 1.
commits: none
---

# import_jsonl findings — still vault-only until `1`

**Origin:** Cursor Grok 4.6 · 2026-09-14 16:26 · findings only.  
**Source of record:** [`docs/plans/import-jsonl-decision.md`](../import-jsonl-decision.md).  
Short copy: [`docs/design/import-jsonl-routes.md`](../../design/import-jsonl-routes.md).

Did not edit product code. Did not speak `import_jsonl` in the client. Did not add a list-row path.

## Verdict

**Still vault-only.** Settings copies selected Claude Code threads into vault notes under `Imports/`. They do **not** appear in the left Sessions list.

Atticus has not typed **`1`**. Silence is not a pick. Overnight and leftover default remains **paper only**.

Do **not** wire `import_jsonl` (Prime’s “load this chat file into the open worker”) until he types `1`.

## What already shipped

Settings → Import chat history. Claude Code scan, fingerprints, ledger, notes under `Imports/claude-code/`. Re-runs skip via `<vault>/.rhizome/import-ledger.json`. Caps stay (3 per project, 150 total). Settings still **requires a vault** and writes notes only (`sessionListNotYetWired: true`).

Missing: left-Sessions rows. Later: Cursor / ChatGPT / Hermes adapters, fuzzy review sheet, first-run Welcome (C9).

## Why list-import stays blocked

`import_jsonl` **replaces** the chat the window is attached to. It does not mint one new left-list handle per thread. The Sessions list is files in `~/.prime/agent/sessions/`. Rhizome reads that folder; it must not own it (ADR-0163).

Recommendation on the decision page is still **route 1** (`new_session` + `import_jsonl` per selected thread, then restore). That is a recommendation, not a choice.

## Unlock

| He types | Then |
|---|---|
| `1` | Smallest Claude-only list-import slice. Live-probe unverified items on a disposable session. |
| `2` | Reject unless he also lifts ADR-0163. |
| `3` or wait | Leave vault-only Settings. Keep `sessionListNotYetWired: true`. |
| nothing | Paper only. Do not half-wire. |

A finished paper is not a finished import.

## Not this window

- Do not speak `import_jsonl` in product code
- Do not write into `~/.prime/agent/sessions/` (route 2)
- Do not drop `sessionListNotYetWired: true`
- Do not treat the 2026-09-01 “always a list row” call as decided
- No git add, commit, or push
