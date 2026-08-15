# Pickup — after Frame C look (2026-08-14 evening)

**You are the next agent.** The Frame A leftover plan is closed. Do not
resume it. Do not start Frame D because it is the next HTML tab.

Repo: `/Users/dtc/code/projects/rhizome-agent`  
Origin: `tuckcode/rhizome-agent` (private). **Not** Desktop.  
Design: `/Users/dtc/Desktop/rhizome-agent-design-system/`  
Named frame → that artboard first. Artboard vs app → flag, don’t invent.

Unpushed: `git rev-list --count origin/main..HEAD`. Do not push until asked.

---

## Scoreboards (three, do not mix)

| Board | State |
|---|---|
| Circle v0 (9 items) | Eng shipped 2026-08-09. Native promote→Open sign-off still open. |
| Prime RPC | **~16 of ~45.** Core loop + compaction + steer + model pick + switch. Session list is a **disk scan**, not four RPCs. |
| Design frames | **A–C mostly.** D/E unbuilt. F real, hidden behind the clock. |

v0 9/9 is not “full Prime.” Filling the remaining RPCs is not the next product.

### RPC we send

`get_state` `prompt` `abort` `new_session` `get_session_stats` `compact`
`set_auto_compaction` `steer` `follow_up` `get_messages` (C23: incomplete)
`get_available_models` `set_model` `switch_session`

### RPC we do not send

`fork` (exists; needs entry id) · `set_session_name` · `set_thinking_level`
· `cycle_model` · `observe` + schedules/heartbeats · `clone` (never verified)

`QueueUpdate` arrives; nothing renders queue depth.

---

## What this Hermes day already shipped (local, not pushed)

Frame A leftovers: foot, A4 skip, C24 logged, launch→ChatHome, New chat
on subhead.

Then past that plan: Frame B stay-on-chat + markdown pane + composer
under both + chips above box + `ctx · file`. Frame C look: labeled
**Save to vault** (`4161fcf`). Toast engine already existed.

A4 titlebar is a **documented fight** (would be a third chrome band).
Do not rebuild it.

---

## Next — in this order

1. **Native dogfood of the memory loop.** `pnpm tauri dev` (not Vite).
   Ask Prime to save a note, or click **Save to vault** on a reply.
   Confirm toast, `create_note` / inbox file, **Open** stays on ChatHome
   and loads the body. Vite mock cannot prove this.
2. **Only if native is blocked tonight:** render `QueueUpdate` (steer /
   follow-up depth). One visible harness fact. Not a new RPC.
3. **C23** only if native rehydration is wrong. Probe live
   `prime-agent --mode rpc` — do not trust fixtures.
4. **Frame D** (no vault / locked memory) after the attached-vault loop
   is seen once. Empty-state artboard; not today’s default.
5. **Frame E** first-run / Prime missing — later.
6. **RPC** only when a frame needs it (`fork` when F needs lineage).
   Never “close the 45.”
7. **C24 delete** on the next Mycelium touch only, with a C-number.

---

## Do not

- Rebuild A4 / invent a Frame A titlebar
- Start Frame D because it is next in the HTML
- Resume the 08-09 “19 tests fail / push blocked” story
- Hardcode a model
- Treat the Notes-rail wiki as ChatHome
- Mix uncommitted tracker edits with product commits

---

## How to see surfaces

```bash
cd /Users/dtc/code/projects/rhizome-agent && pnpm tauri dev
```

Vite (`pnpm dev` → http://localhost:5202) is chrome-only. Chat rail =
top bubble. If wiki: that is Notes. Session key if launch already fired:

```js
sessionStorage.removeItem('rhizome:agent-chat-opened-session'); location.reload()
```

---

## Dual-agent

One tree. TDD. You look at UI; Atticus does not QA each slice.
`/tdd` + `/code-review`. Skip `/to-spec` + `/to-tickets`.
