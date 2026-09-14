# import_jsonl — three routes + one recommendation

**Status:** decision page. Atticus picks. **Do not code Prime session-list import until then.**  
**Origin:** Cursor Grok 4.6 · 2026-09-13 night · packet W6 / ASTRA §11.3  
**Short copy:** [`../design/import-jsonl-routes.md`](../design/import-jsonl-routes.md)  
**Sources:** [`2026-09-01-session-import-plan.md`](2026-09-01-session-import-plan.md), brief [`handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md`](handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md).  
**Doctrine:** [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md) (client, not owner of `~/.prime`). [ADR-0168](../adr/0168-selective-harness-doctrine.md) (artifacts, not organs).

---

## Plain answer

Settings can already copy Claude Code threads into vault notes under `Imports/`. They do **not** yet appear in the left Sessions list.

Prime’s `import_jsonl` command **replaces the chat you have open**. It does not create one new list row per imported thread. That is why the list half is blocked.

**Recommendation: route 1** — make a new session, then import, once per selected thread. Restore the chat you had open when the batch ends.

---

## What already shipped

Vault half (2026-09-06): Settings → Import chat history. Claude Code scan, fingerprints, ledger, `Imports/claude-code/` notes. Re-runs skip via `<vault>/.rhizome/import-ledger.json`. Selection already caps expensive rows (3 per project, 150 total).

Missing: left-Sessions rows. Later: Cursor / ChatGPT / Hermes adapters, fuzzy review sheet, first-run Welcome (C9).

---

## Why list-import is blocked

Checked against Prime’s own docs and installed source (0.8.0; still true on **0.9.3**), not the adapter name list:

- Daemon docs: new / switch / fork / import **replace the worker’s root runtime**. The public session handle stays.
- The call is `{ type: "import_jsonl", activeSessionId, inputPath, cwdOverride }`.
- The Sessions list is files in `~/.prime/agent/sessions/<uuid>.jsonl`. Rhizome reads that directory. It must not own it (`prime_sessions.rs`, ADR-0163).

The 2026-09-01 call (“always a list row; also a vault note when a vault is open”) was made **before** this constraint was known. Treat that product call as open again against this fact.

No fourth route. Do not invent a private mint-session RPC.

---

## The three routes

1. **`new_session` + `import_jsonl`, per selected thread.**  
   Public API only. Each thread becomes a real Sessions row. Cost: two daemon round trips per thread, and the open chat **moves** until we restore it. A few hundred threads means a few hundred switches. Caps + restore are the mitigation.

2. **Write converted JSONL straight into `~/.prime/agent/sessions/`.**  
   Fast. Rows appear at once. No displacement. **Fights ADR-0163** and `prime_sessions.rs`. Breaks if Prime changes on-disk shape.

3. **Vault notes only (what shipped).**  
   Respects the daemon boundary. **No Sessions row.** Contradicts “always a list row.” Users with no vault get nothing.

| # | List row? | Respects ADR-0163? | Main cost |
|---|---|---|---|
| 1 | Yes | Yes | Displaces the open chat until restore |
| 2 | Yes | **No** | We become Prime’s disk store |
| 3 | No | Yes | Plan’s “always list row” is dropped |

---

## Recommendation

**Route 1**, if Atticus accepts the displacement.

It is the only route that keeps Rhizome a daemon **client** and still produces list rows. Do not pick route 2 to save time. Do not stay on route 3 and call the 2026-09-01 plan done.

Overnight default if he has not spoken: **paper only**. This file is the decision. Coding list-import stays blocked.

If he says “wait” or “3”: leave Settings as import-to-vault. Keep `sessionListNotYetWired: true`. Do not half-wire route 1.

---

## Smallest slice after “1”

Claude Code only. Reuse scan / dedup / selection.

For each selected thread: `new_session` → convert → `import_jsonl` → record `prime_session_id` on the ledger (backfill notes). Restore the prior active session.

Second pass: ledger may already say `imported` with no Prime id — backfill rows, do not duplicate notes. Cross-source fingerprints still skip the same content.

No Cursor / GPT / Hermes adapters in that slice. No first-run Welcome (C9).

---

## Risks (do not paper over)

- **Displacement.** Large batches thrash the open chat unless caps + restore are solid.
- **Dedup.** Vault-only ledger can say “imported” with no Prime id.
- **Route 2 shape drift.** Prime’s on-disk session files are not a Rhizome contract.
- **Secrets.** Strip tokens before fingerprint or write (existing redaction). Ledger holds no secrets.

---

## Out of scope tonight

List-import product code. New adapters. First-run Welcome. Writing into `~/.prime` (route 2). A fourth daemon command.
