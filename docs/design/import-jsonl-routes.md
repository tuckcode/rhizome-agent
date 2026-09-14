# `import_jsonl` — three routes (do not code list-import)

**Status:** decision paper. Atticus picks. **Do not ship Prime session-list rows until then.**  
**Canonical packet path:** [`../plans/import-jsonl-decision.md`](../plans/import-jsonl-decision.md) — obligations (restore, cancel, dedup, vault-less, handle vs file) live there.  
**Origin:** Cursor Grok 4.6 · 2026-09-13; obligations pointer 2026-09-14.  
**Vault half:** already shipped (Settings → Import chat history → `Imports/claude-code/`).  
**Plans:** [`../plans/2026-09-01-session-import-plan.md`](../plans/2026-09-01-session-import-plan.md), brief [`../plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md`](../plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md).  
**Doctrine:** ADR-0163 (client, not owner of `~/.prime`). ADR-0168 (artifacts, not organs).

---

## Why this page exists

The 2026-09-01 plan said: always mint a **Prime session-list row**; also write a vault note when a vault is open.

Prime 0.8.0+ (still true on **0.9.3**): `import_jsonl` **replaces the active session**. It does not mint one list row per call.

Checked against Prime’s own docs/source, not our adapter snapshot:

- `docs/daemon.md`: new / switch / fork / import replace the worker’s root runtime; the public active-session **handle** stays.
- `importFromJsonl(inputPath, cwdOverride)` sends `{ type: "import_jsonl", activeSessionId, inputPath, cwdOverride }`.
- The list is files in `~/.prime/agent/sessions/<uuid>.jsonl`. Rhizome must not own that directory.

So “always a list row” was decided **before** this constraint was known.

---

## The three routes

| # | Route | Respects ADR-0163? | List row? | Cost |
|---|---|---|---|---|
| **1** | `new_session` + `import_jsonl` per selected thread | Yes — public daemon API only | Yes | Two round trips per thread. **Displaces** the open chat until restore. Caps already exist (`selection.rs`: 3/project, 150 total). |
| **2** | Write converted JSONL into `~/.prime/agent/sessions/` | **No** — we become the store | Yes, immediately | Fast. Breaks if Prime changes on-disk shape. Fights `prime_sessions.rs` + ADR-0163. |
| **3** | Vault notes only (what shipped) | Yes | **No** | Contradicts “always a list row.” Fine for users with a vault; nothing for vault-less import. |

No fourth route. Do not invent a private mint-session RPC.

---

## Recommendation (written down most often)

**Route 1**, if Atticus accepts displacement.

Why: it is the only route that keeps Rhizome a daemon client **and** still produces list rows. Selection caps + restore-previous-session are the mitigation already specified in the 2152 brief.

Do **not** pick route 2 to save time. Do **not** silently stay on route 3 and call the plan done.

---

## Smallest slice after Atticus says “1”

Claude Code only. Reuse scan / dedup / selection. For each selected thread: `new_session` → convert → `import_jsonl` → record `prime_session_id` on the ledger (backfill notes). Restore the prior active session. Second pass: ledger may say `imported` with no Prime id — backfill rows, do not duplicate notes.

No Cursor / GPT / Hermes adapters in that slice. No first-run Welcome (C9).

---

## If Atticus says “wait” or “3”

Leave the Settings button as **Import to vault**. Keep `sessionListNotYetWired: true`. Do not half-wire route 1.

---

## Assumption

Overnight default if he has not spoken: **paper only**. This file is the decision. Coding list-import is blocked.

---

## Obligations live on the decision page

Do not implement from this short copy. Displacement, restore failure, cancel, partial failure, cross-source dedup, vault-less acceptance, and handle-vs-file identity are specified on [`../plans/import-jsonl-decision.md`](../plans/import-jsonl-decision.md). Route 1 remains a recommendation. Silence is not `1`.
