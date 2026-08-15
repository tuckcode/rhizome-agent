# Session status — 2026-08-15 (Hermes / Grok 4.6 → Claude Code)

**You are Claude Code.** This file is the pickup. Do not ask Atticus to
re-explain the session. Verify git, then work.

Written 2026-08-15 ~00:40 CDT by Grok 4.6 (Hermes desktop). Self-contained.
Covers the whole Hermes stretch that started 2026-08-14 after your usage-limit
cutoff, through native dogfood on 2026-08-15 and a failed push.

**If you are Claude:** you already know this repo. Still read
`docs/CROSS-MODEL-HANDOFF.md` traps if you have not this week, then this
file, then `docs/HANDOFF.md` only for Open threads (C-numbers).

The 2026-08-14 leftover plan and the 2026-08-14-evening pickup are
**historical**. This file supersedes both as “what is true now.”

Repo: `/Users/dtc/code/projects/rhizome-agent`
Remote: `origin` = `https://github.com/tuckcode/rhizome-agent.git` (private)
**Not** Rhizome Desktop (`/Users/dtc/code/projects/rhizome`, `knispo/rhizome`).

Design: `/Users/dtc/Desktop/rhizome-agent-design-system/`
Named frame → open that artboard first. Artboard vs running app → flag,
don’t invent. Frame C is **Promote / Save to vault · toast + `create_note`**,
not “make the split pane editable.”

---

## How this stretch started

You (Opus) died mid-turn writing C24. Last Claude artifact:
`docs/plans/2026-08-13-frame-a-handoff-for-next-agent.md` (A3 leftover =
composer foot; A4 = check titlebar chips). Atticus handed that to Hermes.
Grok worked the rest of 08-14 and the 08-15 native loop.

---

## Git (untrusted — re-run these)

```bash
cd /Users/dtc/code/projects/rhizome-agent
git status -sb
git log --oneline origin/main..HEAD
git rev-list --count origin/main..HEAD
```

When written: working tree **clean after this commit**. **Not pushed.**
`origin/main` was still `606c3c3` (`docs: hand off the remaining Frame A work`).
Count them. Do **not** hardcode the ahead-number in a later handoff.

Atticus **did** say `push` on 2026-08-15. It **did not land.** See
“Push attempt” below. Do not claim origin is current.

---

## Commits since `origin/main` (oldest → newest)

All Grok 4.6 / Hermes unless noted. Your prior Frame A / session-list work
is already on `origin/main` through `606c3c3`.

| SHA | What |
|---|---|
| `aeee08c` | `lastToolName` pure function |
| `7f7f19a` | Prime-only `ChatComposerFoot` via `foot` on composer |
| `1b6cbb2` | A4 skipped in docs; C24 logged (your finding) |
| `15a8448` | Launch opens ChatHome, not the side AI panel |
| `f2eb0c3` / `1fb1728` / `85630cb` | 08-14 Claude pickup + stop rotting ahead-count |
| `1773649` | New chat `+` on Frame A subhead |
| `8d6e9be` | Frame B note split — stay on ChatHome |
| `ec713c8` | Frame B pane loads markdown body |
| `80802f9` | Composer deck sits **above** the input |
| `701122f` | Composer spans under the Frame B note pane |
| `36752e3` | `ctx · filename` chip when a note is split |
| `4161fcf` | Frame C **Save to vault** is a labeled always-visible button |
| `0b39262` | After-Frame-C pickup — native loop next, not Frame D |
| `709abac` | `set_model` refreshes host status so the chip follows |
| `21b308b` | ChatHome + picker `ensure_prime_session_host` |
| `0b44e5f` | Wikilink **title** → vault file via `resolveEntry` |
| `0b94652` | Playwright fixture vaults stay on notes shell |

Plus this docs commit after those.

---

## REAL (committed, in the product)

### Frame A leftovers (closed)

- **Composer foot** — `ChatComposerFoot`. Idle: `Idle · ready` + ⌘↵ send.
  Working: `Working · last tool {name}` + Esc stop. Lives in `AiPanel`
  (controller has `agent.messages`). `ChatComposerDeck` never sees last tool.
  Prime-only.
- **`lastToolName`** — last `action.tool` on the last message that has
  actions, including `pending`. Empty / no-actions → `null`.
- **A4 skipped.** No custom Frame A titlebar. Status bar = bottom. Subhead
  = top. Vault + last-tool already live. Building A4 would be a **third
  chrome band**. Documented fight. Do not invent chips.
- **Launch = ChatHome.** `useAgentDefaultOpenChat` → `openChatHome`
  (`filter: 'chat'`) after `vaultSwitcher.loaded`. Persist `onSwitch`
  resets selection to inbox — fire before `loaded` and ChatHome loses.
  Note windows: `suppressDefaultOpen`. Session key:
  `rhizome:agent-chat-opened-session` (`AGENT_CHAT_OPENED_SESSION_KEY`).
  Status bar / `OPEN_AI_CHAT_EVENT` still open the **side** panel on purpose.
- **New chat** on `PrimeSessionSubhead` via `newChatRef` + `useEffect` bind.
- **C24 logged, not deleted.** Dead exports in
  `src/utils/primeSessionToMindwalk.ts`. Delete only on next Mycelium
  touch, with a tracked C-number.

### Frame B (mostly)

- Stay on ChatHome. `resolveChatOpenNote` → `ChatNotePane` inside `AiPanel`
  beside transcript. Chat ≥55%. Composer full width under both.
- Body via `loadChatNoteContent` → `get_note_content` + `joinVaultPath`.
- Wikilinks in the pane swap the open note, stay on ChatHome.
- **Title resolve (`0b44e5f`):** `[[Promote loop check]]` used to load
  `vault/Promote loop check` and print **Could not open this note.** Now
  `resolveChatOpenNote(target, vaultPath, entries)` uses `resolveEntry`.
  **Not re-dogfooded after the commit** — Atticus stopped the server and
  slept. First native check: click the pink wikilink; pane should show
  the body at `inbox/20260814-promote-loop.md`.

### Frame C look (engine already existed)

- Labeled always-visible **Regenerate · Copy · Save to vault · Fork**
  (`4161fcf`). Dropped hover-only floppy.
- Promote engine already at `handlePromoteChatToVault` / toast
  `Saved “{title}” to the vault`. Subhead `promote complete` still missing
  (look leftover, not a rebuild).

### Native loop fixes (08-15)

- **`709abac`** — `set_model` talked to Prime then `get_status` kept the
  old cache. Chip stuck on DeepSeek V4 Pro. Now refreshes after set.
- **`21b308b`** — host only spawned on Send. Opening the picker with no
  host printed **Prime session host is not running**; chip said **Model**.
  `usePrimeHostStatus(enabled, vaultPath)` now `ensure_prime_session_host`
  when a vault is attached. Picker ensures again before list/set.
- **Grok 4.6 not in the list** is Prime’s `get_available_models` catalog,
  not a menu we edit. Do not invent models.

### Push-gate hygiene

- **`0b94652`** — `tests/helpers/fixtureVault.ts` sets
  `AGENT_CHAT_OPENED_SESSION_KEY` so notes-shell smokes still see
  `note-list-container`. Launch→ChatHome timed those out (~30s each).
  Focused proof: `create-note-backing-file.spec.ts` 2 passed, 8.8s.

---

## Native dogfood — what Atticus actually saw (2026-08-15)

Surface: **Rhizome Agent** native (`pnpm tauri dev`), Mycelium, Chat rail.

| Step | Result |
|---|---|
| ChatHome chrome A–C | REAL. Subhead, deck, foot, labeled Save. |
| First turn (DeepSeek V4 Pro) | **Prime Agent finished without returning a reply.** No `text_delta`. |
| Model chip | Menu opened. Selection did not stick until `709abac`. |
| Host dead on ChatHome | Red **Prime session host is not running** until `21b308b`. Was already dead before the rebuild — Send was the only spawn. |
| After host start | Chip **Grok 4.5**. Prime live. |
| Prompt: write `inbox/20260814-promote-loop.md` | **File exists.** Body: “Promote stays explicit; we just proved ChatHome starts the Prime host.” Regen wiped the chat copy; disk is the record. |
| Tool cards | **Tool use · 2**, both **ipython** wrapping `cli-call.mjs get_note` / `open_note`. No first-class `create_note` / **Open** button. Frame B never fired from tools. |
| Clock (top-right) | Opens Frame F sessions column. Intended. Easy to hit when hunting Open. |
| Pink `[[Promote loop check]]` | Split worked. Stayed on ChatHome. Pane: **NOTE · Promote loop check** + **Could not open this note.** Fixed in `0b44e5f`, **not re-checked**. |

Vite cannot prove Prime tools or promote writes. `demo-vault-v2` has no
seeded `.prime/agent/skills`. Real skill:
`/Users/dtc/Documents/Rhizome Vault/.prime/agent/skills/rhizome-vault/SKILL.md`.

---

## SKIPPED / PROTOTYPE / NOT THIS

| Item | Status |
|---|---|
| A4 titlebar chips | **SKIP.** Fight. Do not build. |
| Frame D (no vault / locked memory) | **NOT STARTED.** Next HTML tab ≠ next product. |
| Frame E first-run / Prime missing | **NOT STARTED.** |
| Frame F sessions list | **REAL**, hidden behind the clock. |
| Remaining ~29 Prime RPCs | **NOT THIS.** Wire only when a frame needs it. |
| `QueueUpdate` chrome | Arrives; nothing renders. Only if native is blocked. |
| C23 `get_messages` vs `agent_end` | Open thread. Probe live RPC if rehydration is wrong. |
| C24 delete | Logged. Next Mycelium touch only. |
| ipython → named `get_note` / Open card | **OPEN.** Skill used bash CLI; UI only sees `ipython`. |
| Push | **ASKED. FAILED.** Origin unchanged. |

---

## Scoreboards (three, do not mix)

| Board | State |
|---|---|
| Circle v0 (9 items) | Eng shipped 2026-08-09. Native promote→Open sign-off still open (note exists; Open-from-title unproven after `0b44e5f`). |
| Prime RPC | **~16 of ~45.** Core loop + compaction + steer + model pick + switch. Session list is a **disk scan**, not four RPCs. |
| Design frames | **A–C mostly** (A4 skipped). D/E unbuilt. F real, hidden. |

RPC we send: `get_state` `prompt` `abort` `new_session` `get_session_stats`
`compact` `set_auto_compaction` `steer` `follow_up` `get_messages` (C23
incomplete) `get_available_models` `set_model` `switch_session`.

Do not send / unverified: `fork` (needs entry id) · `set_session_name` ·
`set_thinking_level` · `cycle_model` · `observe` + schedules · `clone`.

---

## Push attempt (2026-08-15)

Atticus said `push`. Two tries. **Neither updated origin.**

1. Full pre-push (lint, `tsc -b` + vite, vitest coverage, Rust llvm-cov)
   reached Playwright smoke (step 5/6). Notes-shell specs timed out on
   `note-list-container` because launch now opens ChatHome. Hermes timeout
   600s killed the command mid-suite. Origin untouched.
2. Fixture pin `0b94652`. Retried push. Lint + build green. Interrupted
   mid frontend coverage (step 2/6). Origin untouched.

Do **not** `--no-verify`. Do **not** resume the 08-09 “19 tests fail /
push blocked” story — that is historical and already cleared.

If Atticus says push again: cheap proof first (Playwright create-note +
any touched vitest), then full pre-push. Laptop heat is cost.

```bash
export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov"
export LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
git push origin main
```

---

## Next — in this order

1. **Re-check Frame B body.** `pnpm tauri dev`. ChatHome → pink
   **Promote loop check** (or any title wikilink). Pane should show the
   markdown, not the red error. File is already at
   `inbox/20260814-promote-loop.md`. Do not write it again.
2. **Only if that works and Atticus wants more product:** surface
   `get_note` / `open_note` when Prime wraps them in ipython, so **Open**
   is a real card. Or stop — the disk write already proved promote.
3. **Push if asked again.** Origin is stale.
4. **Frame D / remaining RPC / A4 / C24 delete** — not unless named.

---

## Do not

- Rebuild A4 / invent a Frame A titlebar
- Start Frame D because it is next in the HTML
- Resume 08-09 push-unblock
- Hardcode a model
- Treat the Notes-rail wiki as ChatHome
- Mix uncommitted tracker edits with product commits
- `pnpm dev` / `pnpm tauri dev` in a blocking Hermes shell (runner
  omits/refuses background). User starts servers.
- `computer_use` unless Atticus asks (08-15: “can you not computer-use”)
- Claim the push succeeded
- Ask Atticus to QA each slice — you look

---

## How to see surfaces

```bash
cd /Users/dtc/code/projects/rhizome-agent && pnpm tauri dev   # native — dogfood
cd /Users/dtc/code/projects/rhizome-agent && pnpm dev         # Vite :5202 chrome only
```

Chat rail = top bubble. Notes rail = list icon under Chat. If wiki: that
is Notes, not a Frame B leak (Atticus clicked Notes on purpose once).

If Vite already auto-opened ChatHome and you need the notes shell:

```js
sessionStorage.removeItem('rhizome:agent-chat-opened-session'); location.reload()
```

---

## Tests that actually ran (not “full suite”)

Focused greens this stretch (file names, not the pre-push 5k+ vitest):

- `lastToolName` + `ChatComposerFoot` + `AiPanelComposer.steer`
- `useAgentDefaultOpenChat` / `App.test` launch ChatHome
- `PrimeSessionSubhead` New chat
- `resolveChatOpenNote` + `ChatNotePane` + `ChatHome` intercept
- `loadChatNoteContent`
- `AiPanel` composer under note pane
- `ChatComposerDeck` ctx chip
- `AiMessage` labeled Save to vault
- `set_model_updates_status_to_the_model_just_chosen` (cargo `--lib`)
- `usePrimeHostStatus` + `PrimeModelPicker` (host before list)
- `resolveChatOpenNote` title → path (4) + `ChatHome` (2)
- Playwright `create-note-backing-file.spec.ts` 2 passed after fixture pin

Pre-push first attempt: lint OK, build OK, frontend coverage OK, Rust
coverage OK, Playwright smoke **failed/timed out**. Second attempt:
lint OK, build OK, coverage **interrupted**. Never claim those as a
green full gate.

`tsc -b` and eslint `--max-warnings=0` on touched files were green for
each product commit.

---

## Traps this stretch hit

- **Wrong tree.** Desktop `HANDOFF.md` / July worktree are not this work.
- **Frame C guessed from Frame B Save.** Open the named artboard.
- **Host does not start on ChatHome** unless someone calls
  `ensure_prime_session_host`. Send used to be the only caller.
- **`set_model` success ≠ chip update** without `refresh_session`.
- **Wikilink target is a title**, not a path. Need `entries` + `resolveEntry`.
- **Prime skill uses ipython + `cli-call.mjs`.** UI will not show
  `get_note` / Open unless you unwrap that.
- **Clock is Frame F**, not Open.
- **Light theme in Firefox** was Atticus, not a Ledger-vs-Mycelium miss.
- **Hermes `display.tool_progress: off`** — no inter-task diffs unless asked.
- **Don’t embed `ahead N`.** Next docs commit makes it a lie.
- **`npx tsc --noEmit` ≠ gate.** Gate is `tsc -b`.

---

## Dual-agent / workflow

One tree. TDD (`/tdd` then `/code-review`). Skip `/to-spec` + `/to-tickets`.
You look at UI vs the named artboard. Atticus is somewhat green and often
side-tasking — do not ask him to check each change.

Proceed without extra confirmation once a slice is named. Stop only for
an open decision (skip-vs-build, invent chrome).

User launches native. Vite they want opened when they cannot reopen.

~~Do not push until asked.~~ **Superseded 2026-08-15** — push when the
pre-push gates pass; see the standing rule correction at the top of
`docs/HANDOFF.md`. Still true: full pre-push, no `--no-verify`.
Cheap focused tests before cooking the laptop.

Uncommitted tracker edits must not mix with product commits.

---

## Suggested first 15 minutes

```bash
cd /Users/dtc/code/projects/rhizome-agent
pwd && git rev-parse --show-toplevel && git remote get-url origin
git status -sb && git log --oneline origin/main..HEAD | head
```

Then either (a) `pnpm tauri dev` and click **Promote loop check**, or
(b) if Atticus says push, run the gate. Not both at once. Not Frame D.
