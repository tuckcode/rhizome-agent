# Session status — 2026-08-14 Frame A close + launch ChatHome

Written by Grok 4.6 for whichever model picks this up next.
Self-contained. You should not need the conversation that produced it.

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first.**
Then `docs/HANDOFF.md` (living). This file is the dated detail behind the
2026-08-14 header.

Repo: `/Users/dtc/code/projects/rhizome-agent` (`tuckcode/rhizome-agent`).
**Not** Rhizome Desktop (`/Users/dtc/code/projects/rhizome`).

---

## Git (verify, do not trust this line)

```
git status -sb
git log --oneline origin/main..HEAD
```

When this was written: `main` **ahead 4** of `origin/main`, working tree
**clean**. Not pushed.

| SHA | What |
|---|---|
| `aeee08c` | `lastToolName` — last `action.tool` on last message with actions |
| `7f7f19a` | `ChatComposerFoot` under the composer (Prime-only) |
| `1b6cbb2` | A4 skipped in docs; C24 logged |
| `15a8448` | Launch opens ChatHome, not the side AI panel |

---

## REAL (in the product, committed)

- Prime session list slices 1–4 (disk enumerate, replay, `switch_session`, rehydrate).
- Frame A / A1 — `ChatHome` rail destination owns the window (no sidebar, no note list, no editor).
- Frame A / A2 — `PrimeSessionSubhead`.
- Frame A / A3 — `ChatComposerDeck` + working BYO model picker.
- Composer foot — `Working · last tool {name}` / `Idle · ready` + key hints.
  Pure function `src/utils/lastToolName.ts`. Rendered in `AiPanel`, not the deck.
- **Launch = ChatHome** — `useAgentDefaultOpenChat` calls `openChatHome`
  (`filter: 'chat'`) after `vaultSwitcher.loaded`. Waiting on loaded is
  required: persist `onSwitch` resets selection to inbox and will clobber
  ChatHome if you fire earlier. Note windows pass `suppressDefaultOpen`.
  Status-bar / `OPEN_AI_CHAT_EVENT` still open the **side** panel.

## SKIPPED on purpose

- **A4 titlebar chips.** No Frame A titlebar exists. Vault and last-tool
  already live on subhead / deck / foot. Do not invent a third chrome band.
  See `docs/HANDOFF.md` § A4-SKIPPED.

## PROTOTYPE / not built (design system frames)

Design system (authoritative for UI):
`/Users/dtc/Desktop/rhizome-agent-design-system/`
Artboards: `rhizome-agent-desktop-ui.html` (Frame A ~1642, Frame F ~2139).
`DESIGN.md` tokens. Model names in artboards are **examples** — BYO-model,
never hardcode a provider/model.

| Frame | Artboard | Status |
|---|---|---|
| A | Chat-first home | Partial REAL (above). Default window was Desktop wiki until `15a8448`. |
| B | Open-note secondary split | Not built. `open-note` tool exists. |
| C | Promote / save chrome | Engine exists. Not the artboarded surface. |
| D | No vault / degraded foot | Not designed-in. |
| E | First-run / Prime missing | Spec only. |
| F | Session list column | REAL, behind the clock on the panel. |

Visual default in the mock is **Mycelium dark**. The inherited shell still
renders **Ledger light** + Desktop taxonomy unless you are on ChatHome.

## Optional leftovers (not started)

1. **New chat on the subhead.** `AiPanelHeader` has it; ChatHome mounts
   `showHeader={false}`, so Frame A only has New chat inside the sessions
   drawer. Put it on the subhead if the gap hurts. Do not build a titlebar.
2. **C24** — dead exports in `src/utils/primeSessionToMindwalk.ts`:
   `listPrimeSessionCandidates`, `PRIME_SESSIONS_DIR_DEFAULT`,
   `BridgedSessionResult`. Duplicate of Rust `prime_sessions`. Delete on
   the next Mycelium touch. `npx tsc -b` after. Logged in HANDOFF Open threads.
3. **Frame B** note-split — next design slice that would change how it looks,
   after someone has actually *seen* ChatHome.

## How to see ChatHome

```bash
cd /Users/dtc/code/projects/rhizome-agent && pnpm dev
```

http://localhost:5202

If this browser session already ran the app once, launch will **not** re-open
ChatHome. Clear the session key:

```js
sessionStorage.removeItem('rhizome:agent-chat-opened-session'); location.reload()
```

Expect: no sidebar, no note list, rail still visible, Chat icon pressed.
**Notes** on the rail leaves. If `ff_shell_command_rail` is `'false'`, the
rail is gone and Frame A has no header close — they can get stuck. Default
is rail ON.

Working foot (`Working · last tool …`) only appears mid-turn. Idle foot was
seen on the side panel (`Idle · ready`) before launch changed.

## Traps this session hit

- **Wrong tree.** Desktop is `~/code/projects/rhizome`. This work is
  `~/code/projects/rhizome-agent`.
- **`npx tsc --noEmit` is not the build gate.** `tsc -b` is.
- **Vault `onSwitch` clobbers selection on persist load.** Any launch
  navigation must wait for `vaultSwitcher.loaded`.
- **Same sessionStorage key** as the old side-panel auto-open
  (`rhizome:agent-chat-opened-session`). A tab that already fired the old
  path will not show ChatHome until the key is cleared.
- **Hermes `terminal` in this session could not `background=true` a
  `pnpm dev`.** Do not burn turns retrying. User starts the server, or
  Terminal.app.
- **App tests pin the session key** so they keep asserting the notes
  shell. One App test removes it and asserts `data-testid="chat-home"`.
- **Localization:** `pnpm l10n:translate` not run (C18, no LARA key).
  English keys for the foot are in `en.json`.
- **Codacy:** not set up here.

## Next (recommended)

Look at live ChatHome (clear session key, reload). Then Frame B
(open-note split) if the design is the goal. Do not rebuild A4. Do not
delete C24 in an unrelated commit.

Push only if asked. Pre-push needs:

```bash
export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
git push origin main
```

Sign commits: `Co-Authored-By: <model> <noreply@…>`.
