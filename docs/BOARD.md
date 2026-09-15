# Session board — 2026-09-13 night

**Origin:** Cursor Grok 4.6 · 2026-09-12 picture, **stamped 2026-09-14**
against local `4416411` + `origin/main` `5c629a0` + live `gh`.

Tonight is the work window. Morning is the last hours to land, not kickoff.

God-plan input: [`ASTRA_PACKET.md`](ASTRA_PACKET.md). Inventory:
[`PLAN_FOR_A_PLAN.md`](PLAN_FOR_A_PLAN.md). Daily index: `HANDOFF.md`.
Unclaimed work: `NEXT.md`.

---

## Status

- **Done:** Applications rebuild **2026-09-15 12:58** (deleted old app
  first). Tip **`66c3cb0`** + uncommitted **Signal** Dock icons (ADR-0172).
- **Now:** Native W4 (C64 ×3, Chat send, hide/reopen) + #46 live
  Chat-without-vault on this build. Confirm Dock shows Signal.
- **Next:** One Astra/board visible slice. Docked: import `1`, session
  mouse-back (Dock Signal chosen).

**Origin:** Cursor Grok 4.6 · 2026-09-15 12:58 · rebuild + Signal icon.

---

## True right now

- **Git tip (local):** **`66c3cb0`**. **Origin `main`:** **`66c3cb0`**.
- **Last stamped app:** **`66c3cb0` + Signal icons (dirty)**, **2026-09-15 12:58**,
  `/Applications/Rhizome Agent.app`. Vite / mock-tauri is not that vault.
- **Prime on this machine:** **0.9.3**.
- **Open GitHub issues:** Prefer live `gh` (17 open as of 2026-09-14
  stamp; recheck). Open PR [#66](https://github.com/tuckcode/rhizome-agent/pull/66)
  draft — do not merge.

---

## Finished (in the packaged app, `476756c`)

Daily-drive shell:

- Notes open **240px**, shut **46px**. Same sidebar color as Sessions.
- Show Notes strip: **32px** hit target. Label stays Show Notes.
- Thinking pill offers **only levels the current model can run**
  (`deepseek-v4-flash` has no Medium).
- Note beside Chat no longer hover-collapses.
- Latest assistant reply has a **green** start marker.
- Copy on selected Chat text **and** selected text in an open note.
- **#51 Case 1:** Tab ghost-text (rules-first).
- Session transcript **clears as soon as you click** a session row.

Packages:

- Settings → **Packages** is the Prime / Pi catalog hub.
- **Install** runs `prime-agent package install`, then reloads Prime.
- Confirm once: those packages have full system access.
- Fallback if the CLI is missing: Ask Chat, or copy the command.

Also on origin (tree `5c629a0`, not necessarily `/Applications`):

- PR **#65**: closed Notes rail matches the 46px left rail.
- Session-switch lag cut: clear transcript first; Settings provider
  status waits until Agents is open.
- Notes inner divider is back (`--sidebar-border`).
- Nous Portal **Add to Chat list** from Settings.
- Expanded left rail: Settings stays a **gear**. Pin left, gear right.
- AGENTS preferences synced with Nous list + Notes seam (`5c629a0`).

---

## Finished here, not in `/Applications` yet

Docs/tree after `476756c`: origin `5c629a0`, local `4416411` unpushed.
Rebuild only if Atticus will launch the new app.

---

## Found

- Matching Notes color to Sessions **dropped the visible inner line**.
  Keep the seam on Notes. Do not cover the left pulse.
- Close (red) **hides**. **Cmd+Q** quits. C22. Helpers **stop** after
  hide on main (`43059e3e`); native leftover:
  [`plans/hide-on-close-helpers.md`](plans/hide-on-close-helpers.md).
- Agent `git push` can fail on a sandbox Playwright cache. Retry outside
  the sandbox. Never `--no-verify`.
- Thinking-pill filter is in the packaged app.

---

## Pile (cards — claim from God plan / §11)

| # | Card | Status | Later doc | Done when |
|---|---|---|---|---|
| 1 | **C64** first 2s Chat subhead ×3 | Weak verify | [2156](plans/handoffs/2026-09-06-2156-composer-c64-native-verify-checklist.md) | 3× no install copy in first 2s |
| 2 | **#47** confirm-close | **CLOSED** tonight | [2157](plans/handoffs/2026-09-06-2157-composer-issue-47-close-checklist.md) | Do not reopen |
| 3 | **#51 Case 2** model-backed Tab | Case 1 enough | [2153](plans/handoffs/2026-09-06-2153-composer-issue-51-tab-remainder.md) | Optional; not daily-drive |
| 4 | **C72** find Notes | tree labeled; leftover `476756c` | [`plans/c72-notes-delta.md`](plans/c72-notes-delta.md) | Inbox = folder; packaged View names old until rebuild |
| 5 | Prime **session-list import** | Vault yes; rows **blocked** until **`1`** | [2152](plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md) | Atticus types **`1`**. Silence is not yes. Do not speak `import_jsonl`. |
| 6 | Hide-on-close stop helpers | On main `43059e3e`; native leftover | [`plans/hide-on-close-helpers.md`](plans/hide-on-close-helpers.md) | Native hide leaves no extra app-owned helper |
| 7 | Grokbot leftover review | Reviewed 2026-09-14; 0 Accept | [1155](plans/handoffs/2026-09-14-1155-cursor-grokbot-leftover-review.md) | rhizome-agent leftovers deferred; CodexGPT lob stays out |
| 8 | Windows first boot **C42** / **#32** | Never launched | `WINDOWS-DEV.md` | **Blocked** — no Windows box |
| 9 | Dirty file | Leave alone | `docs/plans/handoffs/2026-09-12-1714-rhizome-deepseek-v4-flash-thinking-pill.md` | Do not touch |

Live open issues that are **not** on this pile (still real): **#5** spec,
**#46** source refuse HOME (`4416411`); leftover is live Chat-without-vault,
**#41** source `onSteer` wired; leftover is native + unspoken mutate-one,
**#56** second provider path. See NEXT. Prefer live `gh` over ASTRA §5.

---

## W11 — evening-dump cards (not UI)

Source dump:
[2208](plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).
Index: [`plans/w11-card-status.md`](plans/w11-card-status.md).
Chat ↔ Prime still first. **Hard no:** do not replace Chat; do not invent
the briefing; do not expand two big overlays at once.

| Card | Status | Pointer |
|---|---|---|
| `rhizome-ship` (commit / push / rebuild) | Authored | [`.cursor/skills/rhizome-ship/`](../.cursor/skills/rhizome-ship/SKILL.md) · spec [`plans/rhizome-ship-skill.md`](plans/rhizome-ship-skill.md) |
| Portfolio + Today strip + launcher + vault board | Parked | [`design/idle-chat-overview.md`](design/idle-chat-overview.md) |
| Vault as skill/memory home; no CC Switch | Parked | [`design/vault-skill-home.md`](design/vault-skill-home.md) |
| Memory loop index (promote / recall / import) | Index | [`design/memory-loop.md`](design/memory-loop.md) |
| TokenJuice / Switchyard | Design notes only | [`design/token-routing-and-compression.md`](design/token-routing-and-compression.md) |
| Living-docs audit | This lane | [`plans/living-docs-audit.md`](plans/living-docs-audit.md) |
| C66 agent profile | Agreed, not built | [`plans/c66-agent-profile.md`](plans/c66-agent-profile.md) |
| Prime surface (#5 skeleton) | Structured talk only | [`design/prime-agent-surface.md`](design/prime-agent-surface.md) |

STE stays in the vault. Do not copy voice skills into this tree.

---

## Prime Agent (do not invent an architecture)

Rhizome is the desk. Prime is the engine. Daemon **client**. Coverage by
**user job**, not command count. Detail:
[`design/prime-agent-surface.md`](design/prime-agent-surface.md).
Doctrine: ADR-0168. Transport: ADR-0163. Lifecycle: ADR-0167.

---

## Ship rules (Atticus, 2026-09-12)

**Origin:** Atticus · private repo, solo, not paying for cloud gates.

| Situation | What to do |
|---|---|
| Stays private, solo | Local pre-push is CI. Do not add GitHub Actions, Chunk, or other paid CI. |
| Repo goes public | GitHub Actions can be free. Then pull requests make sense. |
| A human joins | Then branches, split-to-PRs, and review. Not before. |

Do not buy cloud minutes, Chunk, Codacy cloud, or CodeScene. Apple
Developer Program (~$99/year) later, not now. Commit, push, and rebuild
are **three jobs**. Rebuild only when he will use the packaged app.

Detail: `AGENTS.md` Continual-learning guard + rhizome-ship skill (Learned
sections are clean-slate; ship verbs are not stored there).
