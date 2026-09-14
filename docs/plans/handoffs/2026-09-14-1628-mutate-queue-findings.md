---
session: 2026-09-14T16:28-05:00
model: Grok 4.6 (Cursor)
description: >-
  mutate_queued_message findings: still unspoken. Paper only. No Chat
  send. No TS/Rust wrapper. Live daemon not probed.
commits: none
---

# `mutate_queued_message` findings — 2026-09-14 16:28

**Origin:** Cursor Grok 4.6 · read [`docs/plans/mutate-queued-message.md`](../mutate-queued-message.md) · no commit · no Chat send

## Finding

**Still unspoken.** Catalog name only. Chat does not send it.

Paper stamp 16:26 already said the same. This file restates that. It does not add a send path.

## What the paper already settled

The command edits **one** waiting Chat line — rewrite, delete, or move — **before** Prime delivers it. It is not add-to-queue and not clear-all.

Spoken siblings stay: `steer` · `follow_up` · `get_queue` · `clear_queue` · `resume_queue`.

Chat already adds, lists, and clears the whole list. Edit-one waits for Atticus to ask.

## Source / host

| Check | Status |
|---|---|
| Catalog name in `docs/prime-adapter-surface.json` | Present (name only) |
| TS call site from Chat | **None** — unspoken |
| Rust / Tauri wrapper | **None** — do not add |
| Live daemon probe | **NOT RUN** |
| Native steer / visible-queue glance | **NOT RUN** (see #41 leftover) |

Installed Prime **0.9.3** types include the verb (capability `queue_message_mutation`). `rpc.md` does not document it. That is installed-file evidence, not a live send.

## Speak it this morning?

**No.** Paper only. Not a daily-drive hole. #41 leftover is this **name**, not a ship ticket.

Do **not** add a Tauri command. Do **not** edit `src-tauri`. Do **not** speak this window from Chat.

## If Atticus later wants edit-one

Probe the live daemon first. Then host + TS send with `lane` + `index` + `expectedText` + `mutation`. Map Chat `steer` → Prime `"steering"`. On `"rejected"`, refetch `get_queue`. Clear-all stays `clear_queue`.

Trust order if this ever ships: **live daemon > installed Prime files > the paper > this findings note.**

## Not done

- Commit / push / rebuild
- Chat send or host wrapper
- Live daemon probe
- #41 close
