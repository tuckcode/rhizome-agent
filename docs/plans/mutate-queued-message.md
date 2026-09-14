# `mutate_queued_message` — paper only

**Status:** paper. **Do not speak this window.** No TS/Rust send in this file.
**Stamped 16:26:** still unspoken. Do not add a send path.  
**Origin:** Cursor Grok 4.6 · 2026-09-14 · #41 leftover  
**Prime:** installed **0.9.3** at `~/.local/lib/node_modules/prime-agent/`  
**Catalog name:** [`../prime-adapter-surface.json`](../prime-adapter-surface.json) (name only).  
**Spoken siblings:** `steer` · `follow_up` · `get_queue` · `clear_queue` · `resume_queue`  
**Live daemon:** **not probed.** Unverified against a running host.

---

## Plain answer

This command edits **one** waiting Chat line — rewrite it, delete it, or move it up/down — **before** Prime delivers it. It is not add-to-queue and not clear-all.

Rhizome should **not** send it this morning. Chat already adds (`steer` / `follow_up`), lists (`get_queue`), and clears the whole list (`clear_queue`). Edit-one waits for Atticus to ask.

---

## What the command actually does

**The three installed docs do not define the RPC verb.**

| File | What it says |
|---|---|
| [`usage.md`](~/.local/lib/node_modules/prime-agent/docs/usage.md) § Message Queue | TUI job only. Alt+Up/Down browse one queued item. Enter applies the edit as steering; Alt+Enter as follow-up; empty edit deletes; Ctrl+Option+Up/Down reorder inside that queue. |
| [`rpc.md`](~/.local/lib/node_modules/prime-agent/docs/rpc.md) | Documents `steer`, `follow_up`, `set_steering_mode`, `set_follow_up_mode`, and the `session_action_update` event. **No** `mutate_queued_message` section. **No** `get_queue` / `clear_queue` either. |
| [`daemon.md`](~/.local/lib/node_modules/prime-agent/docs/daemon.md) | Process topology. **Silent** on queue mutation. |

So: **usage.md** is the user-facing meaning (edit/delete/reorder one waiting line). **rpc.md is not the spec for this name.**

The installed daemon types are the command shape (Prime **0.9.3**, protocol 7, schema revision **15**, capability `queue_message_mutation`):

From `dist/modes/daemon/daemon-protocol.d.ts`:

```ts
{
  type: "mutate_queued_message";
  activeSessionId: string;
  lane: QueuedMessageLane;      // "steering" | "followUp"
  index: number;
  expectedText: string;
  mutation: QueuedMessageMutation;
}
```

From `dist/core/session-action-store.d.ts`:

```ts
type QueuedMessageMutation =
  | { type: "delete" }
  | { type: "move"; direction: -1 | 1 }
  | { type: "replace"; text: string; images?: ImageContent[]; lane: QueuedMessageLane };

type QueuedMessageMutationStatus = "applied" | "rejected" | "invalid";
```

Installed `agent-session.js` `mutateQueuedMessage` (not a live send) says:

- Address the item by **lane + index in the same preview list** `get_queue` / `session_action_update` publish.
- `expectedText` must equal that item’s **current preview**. Wrong text or a shifted index → `"rejected"` (so a client cannot edit the wrong line after the queue moved).
- `delete` cancels that one action and resumes remaining queued work.
- `move` swaps with the neighbor in that lane, or `"rejected"` at the end.
- `replace` rewrites text (optional images) and may **change lane** (steer ↔ follow-up). A slash-command item that no longer parses → `"invalid"`. An item already accepted / no longer a plain user line → `"rejected"`.

Daemon handler (`daemon-mode.js`) forwards to that method and returns `{ status }`. The TUI client (`daemon-agent-connection.js`) refuses locally with `"unsupported"` if the host lacks `queue_message_mutation`. That status is **client-side**, not a daemon reply.

`get_queue` itself returns **previews** (`getSteeringMessagePreviews` / `getFollowUpMessagePreviews`). Preview in the installed code is `payload.preview ?? payload.text`. Whether a live queue ever stores a shorter `preview` than the full body is **unverified**.

---

## Speak it this morning?

**No.** Paper only.

- Not a daily-drive hole. Clear-all and add-while-running already exist.
- GitHub #41 leftover is this **name**, not a ship ticket. A name in the catalog is not a user job.
- Native steer / visible-queue glance is still **NOT RUN**. Do not pile a third queue verb on unproven add/list/clear.
- No wrapper in this pass. Do not add a Tauri command. Do not edit `src-tauri`.

---

## If Atticus later wants edit-one-queued-item

Chat already draws the list (`usePrimeQueue` → composer rows). Missing is **per-row** action.

1. **User job first.** Tap one row: rewrite, delete that one, maybe reorder, maybe flip steer ↔ follow-up. Do not invent a second local queue.
2. **Probe the live daemon** before writing a send. Confirm `queue_message_mutation`, `{ status }`, and that `expectedText` is the preview string from the last `get_queue`.
3. **Host + TS send** (later, not now): `lane` + `index` + `expectedText` + `mutation`. Map Rhizome’s list lane `steer` → Prime `"steering"`. Prime’s other lane is `"followUp"` (same word we already use).
4. **Optimistic lock.** Send the preview text currently on that row. On `"rejected"`, refetch `get_queue` and do not guess a new index. On `"invalid"`, keep the draft and say the edit was not a valid queued command. If the capability is missing, hide the controls (TUI’s `"unsupported"`).
5. **Preview vs full text.** If live previews are truncated, loading the row into the composer is lossy. Confirm before shipping replace. Images on `replace` are optional; Chat attachments would need the same payload the TUI already collects.
6. **Clear-all stays `clear_queue`.** Empty-edit-deletes-one is `mutate_queued_message` `{ type: "delete" }`, not a second clear.

---

## Unverified

This session read installed docs + installed types/JS. It did **not** send `mutate_queued_message` to a running daemon.

| Claim | Status |
|---|---|
| `rpc.md` documents this verb | **Disagree** — rpc is silent; daemon types include it (schema rev 15). |
| `usage.md` TUI keys map to delete / replace / move | Matches installed TUI (`interactive-mode.js`). Live key behavior **unverified**. |
| `expectedText` is the `get_queue` preview | Installed JS says so. Live **unverified**. |
| Preview equals full queued body | Installed: `preview ?? text`. Live **unverified**. |
| Daemon reply is `{ status }` only | Installed handler. Live **unverified**. |

Trust order if this ever ships: **live daemon > these installed files > this paper.**
