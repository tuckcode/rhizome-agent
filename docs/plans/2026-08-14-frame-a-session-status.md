# Session status — 2026-08-14 (Hermes / Grok 4.6 → Claude Code)

**You are Claude Code.** This file is the pickup. Do not ask Atticus to
re-explain the session. Verify git, then work.

Written 2026-08-14 by Grok 4.6 (Hermes desktop) after picking up Claude
Opus 5's usage-limit cutoff. Self-contained.

**If you are Claude:** you already know this repo. Still read
`docs/CROSS-MODEL-HANDOFF.md` traps if you have not this week, then this
file, then `docs/HANDOFF.md` only for Open threads (C-numbers).

Repo: `/Users/dtc/code/projects/rhizome-agent`  
Remote: `origin` = `https://github.com/tuckcode/rhizome-agent.git` (private)  
**Not** Rhizome Desktop (`/Users/dtc/code/projects/rhizome`, `knispo/rhizome`).

---

## How this session started

Claude Opus 5 died mid-turn on a usage limit while writing C24 after a
dead-code sweep. The last Claude artifact was
`docs/plans/2026-08-13-frame-a-handoff-for-next-agent.md` (A3 leftover =
composer foot; A4 = check titlebar chips before building). Atticus handed
that to Hermes. Grok worked the rest of 2026-08-14.

---

## Git (untrusted — re-run these)

```bash
cd /Users/dtc/code/projects/rhizome-agent
git status -sb
git log --oneline origin/main..HEAD
```

When written: working tree **clean after this commit**. **Not pushed.**
Count them: `git rev-list --count origin/main..HEAD`. Atticus has not
asked to push.

| SHA | Trailer | What |
|---|---|---|
| `aeee08c` | Grok 4.6 | `lastToolName` pure function + 4 tests |
| `7f7f19a` | Grok 4.6 | `ChatComposerFoot` + en.json keys + AiPanel wire |
| `1b6cbb2` | Grok 4.6 | A4 skipped in docs; C24 logged (Claude's finding) |
| `15a8448` | Grok 4.6 | Launch opens ChatHome, not the side AI panel |
| `f2eb0c3` | Grok 4.6 | First handoff cut |
| `1fb1728` | Grok 4.6 | This expanded Claude Code pickup |

Prior Frame A / session-list work is already on `origin/main` (Claude,
through `606c3c3` / `c25b505`).

---

## REAL (committed, in the product)

**From Claude (already on origin, do not redo):**
Prime session list slices 1–4. Frame A / A1 ChatHome destination. A2
subhead. A3 composer deck + BYO model picker. Design-system-authoritative
rule. Three preview-only bugs documented (unreachable header toggle,
list sizing in 228px column, Radix `pointerdown`).

**From this Hermes session:**

- **Composer foot** — `src/components/ChatComposerFoot.tsx`. Idle:
  `Idle · ready` + ⌘↵ send. Working: `Working · last tool {name}` +
  Esc stop · ⌘. Built inside `AiPanel` (controller has `agent.messages`);
  `ChatComposerDeck` never sees the last tool. Prime-only.
- **`lastToolName`** — `src/utils/lastToolName.ts`. Last `action.tool`
  on the last message that has actions, including `pending`. Empty /
  no-actions / trailing empty-action messages → `null`.
- **A4 skipped.** No custom Frame A titlebar exists. Status bar = bottom.
  Subhead = top. Vault and last-tool already live. Do not invent chips.
- **Launch = ChatHome.** `useAgentDefaultOpenChat` now calls
  `openChatHome` (`filter: 'chat'`) after `vaultSwitcher.loaded`.
  Persist `onSwitch` resets selection to inbox — fire before `loaded`
  and ChatHome loses. Note windows: `suppressDefaultOpen`. Status bar
  and `OPEN_AI_CHAT_EVENT` still open the **side** panel on purpose.
- **C24 logged, not deleted.** Dead exports in
  `src/utils/primeSessionToMindwalk.ts`: `listPrimeSessionCandidates`,
  `PRIME_SESSIONS_DIR_DEFAULT`, `BridgedSessionResult`. Duplicate of
  Rust `prime_sessions`. Next Mycelium touch deletes them + `tsc -b`.

Idle foot was **seen** on the side AI Chat panel in Atticus's screenshot
(`Idle · ready`). Working foot not live-verified. Launch→ChatHome has
tests; **not live-looked-at** (Hermes could not background `pnpm dev`).

---

## PROTOTYPE / not built

Design system (UI source of truth):
`/Users/dtc/Desktop/rhizome-agent-design-system/`  
Artboards: `rhizome-agent-desktop-ui.html` (Frame A ~1642, F ~2139).  
`DESIGN.md`. Artboard model names (`xai / grok-4.5`) are **examples**.
BYO-model. Never hardcode.

| Frame | Meaning | Status |
|---|---|---|
| A | Chat owns the window | Partial REAL (A1–A3 + foot + launch). A4 skipped. |
| B | Open-note secondary split | **Not built.** `open-note` tool exists. |
| C | Promote / save chrome | Engine exists. Not the artboard. |
| D | No vault / degraded | Not designed-in. |
| E | First-run / Prime missing | Spec only. |
| F | Session list column | REAL, behind the clock. |

Mock default is **Mycelium dark**. Inherited shell is still **Ledger light**
+ Desktop taxonomy until you are on ChatHome. Atticus's first look was the
wiki CMS + side AI Chat — that is the old default, not a failed Frame A.

---

## Optional leftovers

1. **Look at live ChatHome** before more UI. Clear session key if the tab
   already ran (see below).
2. **C24 delete** on next Mycelium touch only.
3. **Frame B** (note split) — next design slice that changes how it *looks*.
   Open-note today calls `notes.handleNavigateWikilink` and leaves ChatHome.

---

## How to see ChatHome

```bash
cd /Users/dtc/code/projects/rhizome-agent && pnpm dev
```

http://localhost:5202

```js
sessionStorage.removeItem('rhizome:agent-chat-opened-session'); location.reload()
```

Expect: no sidebar, no note list, 46px rail, Chat pressed. **Notes** leaves.
If `localStorage.ff_shell_command_rail === 'false'`, rail is gone and Frame A
has no close — stuck. Default is ON.

Working foot only mid-turn.

---

## Tests this session actually ran

Report what ran. Do not claim a subset is the full suite.

- `lastToolName.test.ts` — 4 passed
- `ChatComposerFoot.test.ts` — 3 passed
- `AiPanelComposer.steer.test.ts` — 6 passed (includes foot-forwards)
- `useAppAiWorkspaceBridge.test.ts` — 5 passed
- `App.test.tsx` + `App.note-window-properties.test.tsx` — 46 passed
  together with the hook file
- `tsc -b` clean on touched work
- `pnpm l10n:translate` **not** run (C18)
- Full `pnpm test` / Rust coverage / pre-push **not** run
- App tests **pin** `sessionStorage['rhizome:agent-chat-opened-session']='1'`
  so they stay on the notes shell. One test removes it and asserts
  `data-testid="chat-home"`.

---

## Dual-agent workflow (Hermes ↔ Claude Code)

Atticus is alternating you two on this repo. Suggestions from this
session — put these in practice tomorrow, do not just file them:

1. **One tree.** Always `cd /Users/dtc/code/projects/rhizome-agent`.
   Desktop is a different product. Hermes opened Desktop first this
   session; that cost a round.
2. **Handoff is the commission.** Dated `docs/plans/*-session-status.md`
   + living `docs/HANDOFF.md` header. Do not rely on chat paste. Update
   both before you stop, even on a usage-limit cliff (Claude's C24 almost
   died in an uncommitted `HANDOFF.md` diff).
3. **REAL / SKIPPED / PROTOTYPE in every handoff.** Mockup ≠ shipped.
   Frame A looking "done" in the artboard is not the running default.
4. **Verify git on intake.** `status` / `log origin/main..HEAD`. Claims
   in this file go stale the moment you commit.
5. **TDD vertical slices, one commit per cycle when you can.** This
   session: red test → hardcoded green → walk → UI. Atticus asked for
   Matt Pocock skills (`~/.agents/skills/tdd`, already on disk). Hermes
   does not auto-load that pack; Claude Code might. Use `/tdd` if you
   have it. Do not dump `/to-spec` + `/to-tickets` on a two-file leftover.
6. **Look at UI you ship.** Three bugs last Claude session only showed
   in preview. This session failed to start `pnpm dev` from Hermes
   (background flag). **You** start the server; Atticus launches native
   apps. Do not loop on a stuck tool.
7. **Do not push unless Atticus says push.** Pre-push needs LLVM vars
   (below). Parent of a dual session owns full pre-push if both of you
   committed.
8. **Path fence if you ever run parallel.** Typical: one agent on
   `src/components/Chat*` + `src/hooks/useAppAiWorkspaceBridge*`; the
   other on Frame B / Mycelium / C24. Nobody stages icon regen,
   `.claude/settings.local.json`, or design zips. `HANDOFF.md` conflicts
   are normal — keep the newer header, merge Open threads by C-number.
9. **Sign commits.** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
   (or whatever model actually wrote the diff). Author field is Atticus
   on every commit.
10. **Stale HANDOFF sections below 2026-08-14 are history.** The 08-09
    "A1 OPEN / 19 tests fail / push blocked" block is **superseded**.
    Do not resume that push-unblock story. Push works to `tuckcode`.

---

## Traps (do not relearn)

- Wrong tree (Desktop vs Agent).
- `tsc --noEmit` ≠ `tsc -b`.
- Vault `onSwitch` clobbers selection on persist load.
- Session key `rhizome:agent-chat-opened-session` shared with the old
  side-panel auto-open.
- Four-union rail trap if you add a destination (`SidebarFilter`,
  `CommandRailDestination`, `RailDestination`, label map).
- `react-hooks/set-state-in-effect` — do not copy `MyceliumView`.
- LARA unpaid (C18). English in `en.json`, say translate was not run.
- Codacy not set up.
- Mock Tauri table: new commands need `src/mock-tauri/mock-handlers.ts`
  **and** `App.test.tsx` `mockCommandResults` or `<App/>` blanks.

---

## Next (recommended)

1. `pnpm dev`, clear the session key, **look at ChatHome**. Confirm rail,
   subhead, deck, idle foot. Then a real turn for the working foot.
2. If design is the goal: Frame B (open-note split). Not more chips.
3. If a 20-minute polish: New chat on `PrimeSessionSubhead`.
4. Do not rebuild A4. Do not mass-delete knip backlog.

Push only if asked:

```bash
export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" \
       LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
git push origin main
```
