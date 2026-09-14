# import_jsonl — three routes + one recommendation

**Status:** decision page. Atticus picks. **Do not code Prime session-list import until then.**  
Silence is not a pick. Overnight default remains **paper only**.  
**Origin:** Cursor Grok 4.6 · 2026-09-13 night · packet W6 / ASTRA §11.3  
**Completed:** Cursor Grok 4.6 · 2026-09-14 morning · W6 obligations named. Route 1 is still a recommendation, not a choice.  
**Short copy:** [`../design/import-jsonl-routes.md`](../design/import-jsonl-routes.md)  
**Sources:** [`2026-09-01-session-import-plan.md`](2026-09-01-session-import-plan.md), brief [`handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md`](handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md).  
**Doctrine:** [ADR-0163](../adr/0163-connect-to-the-prime-daemon.md) (client, not owner of `~/.prime`). [ADR-0168](../adr/0168-selective-harness-doctrine.md) (artifacts, not organs). [ADR-0169](../adr/0169-import-ledger-as-dedup-authority.md) (ledger is the skip authority).

---

## Plain answer

Settings can already copy Claude Code threads into vault notes under `Imports/`. They do **not** yet appear in the left Sessions list.

Prime’s `import_jsonl` command **moves the chat you have open** onto the imported file. It does not create a new left-list handle per thread. That is why the list half is blocked.

**Recommendation: route 1** — make a new saved session, then import, once per selected thread. Put the chat you had open back when the batch ends.

Atticus has not said `1`. This page does not treat that as decided.
**Stamped 16:08:** still vault-only. Silence is not `1`.

---

## What already shipped

Vault half (2026-09-06): Settings → Import chat history. Claude Code scan, fingerprints, ledger, `Imports/claude-code/` notes. Re-runs skip via `<vault>/.rhizome/import-ledger.json`. Selection already caps expensive rows (3 per project, 150 total). Settings today **requires a vault** and writes notes only (`sessionListNotYetWired: true`).

Missing: left-Sessions rows. Later: Cursor / ChatGPT / Hermes adapters, fuzzy review sheet, first-run Welcome (C9).

---

## Why list-import is blocked

Checked against Prime’s own docs and installed source (**0.9.3**), not the adapter name list:

- `docs/daemon.md`: new / switch / fork / import **replace the worker’s root runtime**. The public session handle stays.
- `docs/sdk.md`: `importFromJsonl()` is a replacement, same family as `newSession()` / `switchSession()`. After it, `runtime.session` is a different object.
- Installed `agent-session-runtime.js`: `importFromJsonl` **copies** the input file into the sessions folder using the input’s **basename**, then **resumes** that copy. It does not write into the file that was open. Return value is `{ cancelled }`. It does not return a new handle.
- The Sessions list is files in `~/.prime/agent/sessions/<uuid>.jsonl`. Rhizome **reads** that directory (`prime_sessions.rs`). It must not own it (ADR-0163).

What that does **not** settle (no live probe tonight; God plan forbids displacing a real Chat):

- Whether a unique-basename copy is enough for Rhizome’s list scanner to show a durable row.
- Whether `new_session` first leaves a leftover empty file (source defers writing until an assistant message; live daemon unverified).
- What happens if two imports share a basename (copy would overwrite).

The 2026-09-05 note that said “N calls keep only the last thread in the same session” is true **only if every input shares one filename**. Do not treat that sentence as the command’s meaning.

The 2026-09-01 call (“always a list row; also a vault note when a vault is open”) was made **before** the handle-vs-file split was known. Treat that product call as open again against this fact.

No fourth route. Do not invent a private mint-session RPC.

---

## The three routes

1. **`new_session` + `import_jsonl`, per selected thread.**  
   Public API only. Each thread is meant to become a real Sessions row. Cost: two daemon round trips per thread, and the open chat **moves** until we restore it. A few hundred threads means a few hundred switches. Caps + restore are the mitigation.

2. **Write converted JSONL straight into `~/.prime/agent/sessions/`.**  
   Fast. Rows appear at once. No displacement. **Fights ADR-0163** and `prime_sessions.rs`. Breaks if Prime changes on-disk shape.

3. **Vault notes only (what shipped).**  
   Respects the daemon boundary. **No Sessions row.** Contradicts “always a list row.” Users with no vault get nothing. Settings today already behaves like this.

| # | List row? | Respects ADR-0163? | Main cost |
|---|---|---|---|
| 1 | Yes (intended) | Yes | Displaces the open chat until restore |
| 2 | Yes | **No** | We become Prime’s disk store |
| 3 | No | Yes | Plan’s “always list row” is dropped |

---

## Recommendation

**Route 1**, if Atticus accepts the displacement and the obligations below.

It is the only route that keeps Rhizome a daemon **client** and still aims at list rows. Do not pick route 2 to save time. Do not stay on route 3 and call the 2026-09-01 plan done.

Overnight default if he has not spoken: **paper only**. This file is the decision. Coding list-import stays blocked.

If he says “wait” or “3”: leave Settings as import-to-vault. Keep `sessionListNotYetWired: true`. Do not half-wire route 1.

---

## Active handle vs saved-session identity

These are two different things. Ledger, restore, and list rows must use the saved identity, not the handle.

**Active handle (`activeSessionId`).** The daemon’s address for the worker this window is attached to. Prime’s `daemon.md` says new / switch / fork / import keep this public id. Rhizome’s host already treats it as stable across `new_session` (`prime_session_host.rs`). Session-scoped commands carry this handle.

**Saved-session identity (`sessionId` + `sessionFile` / `sessionPath`).** The JSONL on disk. `get_state` reports `sessionFile` and `sessionId`. Those **change** after `new_session` or `import_jsonl`. The left Sessions list is a scan of those files, not a list of handles. Rename speaks `rename_saved_session` with `sessionPath`. Switch speaks `switch_session` with `sessionPath`.

**What a list row is.** A file under `~/.prime/agent/sessions/` that Rhizome’s scanner accepts (it already drops empty drafts — #28). It is not a new handle. Route 1 reuses **one** handle and walks it across **N** saved files.

**What the ledger must store.** `destination.sessionId` (and path, when known) of the **saved** file after a successful import. Never the handle. A later restore or backfill looks up that file, not “the worker we used that day.”

**What restore is.** `switch_session` with the **pre-batch** `sessionPath`. Same handle, previous file. It is not `create`, and it is not “make a new chat that looks like the old one.”

---

## Obligations (route 1, if chosen)

These are acceptance rules for a later build. They are not a license to build now.

### 1. Displacement of a live Chat

The open Chat will show each imported thread in turn. That is the cost of route 1.

- Snapshot **before** the first `new_session`: handle, `sessionId`, `sessionPath`, and whether a turn is running.
- **Refuse to start** the batch while a turn is running. Rhizome already refuses `switch_session` / `fork` mid-turn because Prime’s docs do not say what replacement does to a live turn. Import is the same replacement family (`daemon.md`, `sdk.md`). Do not probe that on a user’s Chat.
- Show durable batch chrome: importing N of M, which thread, Stop. “Waiting in this session” alone is not enough (same lesson as C43/C44).
- Keep the existing caps (3 per project, 150 total in `selection.rs`). Do not import the whole Claude folder in one go.
- Do not send `import_jsonl` at the user’s current `sessionPath`. Convert to a **unique** staging file first, so two threads cannot share a basename.
- One import at a time on the attached handle. A second worker via `create` is **unverified** as a no-displacement trick (see Unverified). It is not a fourth route.

### 2. Restore failure

When the batch ends — success, cancel, or last-item failure — put the pre-batch chat back with `switch_session` + that `sessionPath`.

If restore fails:

- Say so in Chat. Do not pretend the user is back.
- Stay on whatever file the handle now has (usually the last import). That is honest. Do not mint a blank chat and call it restore.
- Offer one retry of the same `switch_session`. If that fails, stop. Do not loop. Do not write into `~/.prime` to recover (that is route 2).
- Keep every list row and ledger entry that already succeeded. Restore failure is not an import rollback.

If the pre-batch path is missing or rejected: same banner. **Unverified** on a live daemon: `session_already_active`, extension `cancelled: true`, and a deleted file. Client still follows the banner + one retry rule.

### 3. Interrupted / cancelled batches

Stop means: do not start the next thread. Already-finished imports stay.

- Cancel is user-visible and sticky until restore finishes. Do not flash then vanish.
- After cancel: restore (obligation 2), then report imported / skipped / failed / not-started.
- A crash mid-batch is the same as cancel plus a cold start. The next Settings run consults the ledger. It does not auto-resume displacement.
- `abort` is a running-turn command (`rpc.md`). Import is a session replacement. **Unverified** whether `abort` cancels an in-flight `import_jsonl`. Until probed after “1”, treat cancel as “don’t start the next one,” and restore even if the last call is still uncertain.

### 4. Repeat-import dedup

Dedup is **fingerprint + provenance**, for any reimport chain. Not “Cursor vs Claude” only. ADR-0169 and `session_import/dedup.rs` already encode this. List-import reuses it; it does not invent a second matcher.

Apply in order. Only `status: imported` counts as present. A skip or a failure must never block a retry.

1. Same `(sourceApp, sourceSessionId)` already imported → skip.
2. Same content fingerprint from **any** source → skip.
3. Candidate says it was reimported from an original already in the ledger → skip.
4. Fuzzy (first 3 + last 1, counts within ±2) → ask; default skip. Review sheet still later (≤10 / auto-skip >10).
5. Otherwise import.

Vault-only rows from 2026-09-06 may say `imported` with **no** `destination.sessionId`. Second pass: mint the list row, backfill that id onto the existing note, **do not** write a second note.

If the ledger already has a Prime id: skip both the list row and the note.

Claude Code today emits native provenance; a copy that came through another app is caught by fingerprint (rule 2), not by a Claude-only special case. Future adapters add provenance when the file actually names an origin.

### 5. Partial failure

One bad thread does not stop the batch.

- Record `status: failed` with a reason. Retry is allowed (ADR-0169).
- Keep successes. Do not delete a good list row because a later one failed.
- Convert / `new_session` / `import_jsonl` can each fail independently. If `new_session` succeeded and import failed, do not leave the user in that empty new chat: continue the batch or restore. Whether a header-only file appears in the list is **unverified**; if it does, it is a failed leftover, not a success.
- Report four counts: imported, skipped, failed, not-started. PostHog (when built) uses those counts only — no titles, no message text.

### 6. Vault-less acceptance

The 2026-09-01 product call still stands as the **target** if route 1 is chosen:

- Always a Prime list row (when the thread is selected for a row).
- Vault note under `Imports/<source>/` **only if** a vault is attached.
- No vault → list rows still; skip notes silently. Settings may say “Attach a vault to also save imports as notes.”

That is **not** what Settings does today. Preview and run both require a vault directory. The shipped ledger lives at `<vault>/.rhizome/import-ledger.json`. ADR-0169 put the authority in **app config** so a user with no vault can still skip duplicates. Those two locations must not become two truths.

If route 1 is chosen, list-import uses one ledger a vault-less run can read. Existing vault-ledger entries are migrated or consulted, not ignored. Notes remain an optional destination **on** that ledger.

Route 3 cannot meet vault-less acceptance. That is a reason it stays an alternative, not the recommendation.

---

## What unlocks implementation

Atticus says **`1`**, **`2`**, **`3`**, or **wait**.

| He says | Then |
|---|---|
| `1` | Build the smallest slice below. Live-probe the Unverified list on a **disposable** session, not daily-drive Chat. |
| `2` | Reject unless he also lifts ADR-0163. This page does not recommend it. |
| `3` or wait | Leave vault-only Settings. Keep `sessionListNotYetWired: true`. |
| nothing | Paper only. Do not half-wire. |

A finished paper is not a finished import.

---

## Unverified (no live daemon probe tonight)

- Unique-basename `import_jsonl` alone vs `new_session` + import: which pairing actually yields a stable list row.
- Whether `new_session` materializes a header-only file that Rhizome’s scanner shows or drops.
- Basename collision when two staging files share a name.
- `import_jsonl` / `switch_session` / `new_session` while a turn is running (client already refuses; daemon result unknown).
- Restore when the pre-batch file is gone, leased (`session_already_active`), or cancelled by `session_before_switch`.
- Whether `abort` stops an in-flight import.
- Whether a second `create` (`client_owned`) can absorb imports without moving the user’s handle — and whether `complete_owned_session` deletes that JSONL (`daemon.md` says client-owned completion removes the worker without archiving; file fate unread).
- `list_saved_sessions` vs Rhizome’s disk scan: names exist on the adapter snapshot; this page does not assign list-import to that command.

---

## Smallest slice after “1”

Claude Code only. Reuse scan / dedup / selection.

For each selected thread: unique convert → `new_session` → `import_jsonl` → `get_state` → record saved `sessionId` / path on the ledger (backfill notes). Restore the prior `sessionPath`.

Second pass: ledger may already say `imported` with no Prime id — backfill rows, do not duplicate notes. Cross-source fingerprints still skip the same content.

Vault-less: list rows yes; notes no. One ledger both paths can read.

No Cursor / GPT / Hermes adapters in that slice. No first-run Welcome (C9). No live import into the user’s current daily-drive file.

---

## Risks (do not paper over)

- **Displacement.** Large batches thrash the open chat unless caps + restore are solid.
- **Dedup.** Vault-only ledger can say “imported” with no Prime id.
- **Two ledgers.** Vault `.rhizome/` vs ADR-0169 app config.
- **Route 2 shape drift.** Prime’s on-disk session files are not a Rhizome contract.
- **Secrets.** Strip tokens before fingerprint or write (existing redaction). Ledger holds no secrets.

---

## Out of scope tonight

List-import product code. An `import_jsonl` client. New adapters. First-run Welcome. Writing into `~/.prime` (route 2). A fourth daemon command. A probe that displaces a real Chat.
