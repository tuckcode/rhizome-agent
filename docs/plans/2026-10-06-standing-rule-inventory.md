---
type: Note
status: evidence
date: 2026-10-06
---

# Standing-rule inventory — inherited / one-night / Atticus / still in code

**Origin:** Cursor Grok 4.6 · 2026-10-06 · requested after the ASTRA_PACKET
§10 / C22 hide question. Evidence, not a decision.

**Does not change** `AGENTS.md`, `ASTRA_PACKET.md`, or product code.

Prior provenance pass (AGENTS.md only, 2026-08-29):
[`2026-08-29-agents-md-rule-audit.md`](2026-08-29-agents-md-rule-audit.md).
This file is the shorter living-docs version: which *stops* agents still
cite, where they came from, and whether the tree still matches.

## How to read the buckets

| Bucket | Means |
|---|---|
| **Inherited** | Copied from Rhizome Desktop in `11e1315` (2026-08-09) and never re-judged here. `AGENTS.md` §2–3 already say this. |
| **One-night** | Written for the 2026-09-13 Astra / God-plan window. Traffic control. The packet header already says the snapshot is superseded. |
| **You said** | Dated Atticus / knispo quote or room call. Still a human call even if an agent wrote the file. |
| **This-repo incident** | A bug or collision in *this* tree produced the rule (C-number, hook, CROSS-MODEL). |
| **Agent-ratified** | Agents wrote it as law. You did not. |

**Still in code** is a separate column. A rule can be yours *and* leftover,
or inherited *and* still accurate.

**Cite as evidence, not a stop.** That is already a Learned preference.
Safety that still stands unless you change it: wrong tree, English-only,
`import_jsonl` waits for `1`.

---

## 1. You said (dated)

| Rule | Where agents read it | Still in code? | Notes |
|---|---|---|---|
| English only. Do not migrate `en.json`. Do not run `l10n:translate` / report `l10n:validate`. | `AGENTS.md` Localization; C18 | **Yes as policy.** Strings stay mixed: hardcoded English + leftover `en.json`. `l10n:validate` still fails by design. | Said 2026-08-16, 08-21, 08-29 (“20 times”). Agents still churn it. |
| `import_jsonl` into the Prime session list waits for **`1`**. Silence is not approval. | `AGENTS.md` Standing holds; `BOARD.md`; `NEXT.md` | **Yes.** Vault import exists. Session-list writer is not wired (`session_import.rs`). | Still the live hold. |
| Local pre-push is CI. No GitHub Actions / paid CI / Chunk / Codacy cloud / CodeScene. Apple $99 later. | `ASTRA_PACKET.md` §4 ship rules (2026-09-12); `NEXT.md` hard nos used to echo this | **Contradicted by reality.** `.github/workflows/ci.yml` runs on PRs. PR #84 ran frontend, Rust, Linux build, CodeQL, **Codacy**. Repo is **public** (2026-10-04). | Dated solo/private instruction. Agents still quote the packet. |
| Commit, push, rebuild are three verbs. Rebuild only if you will launch. | `rhizome-ship` skill; `ASTRA_PACKET.md` | Process, not product code. | Still how ship is supposed to work. |
| Do not add a compatibility path unless an instance exists on disk. | `AGENTS.md` Standing holds | Process. #57 later dropped dead Laputa/Tolaria env names. | Recurring. |
| Current ask wins. Docs are context, not a stop. | `AGENTS.md` Learned | Process. | 2026-09-14 clean slate. The reason this inventory exists. |
| Do not reject a tool by citing ADR-0168 as settled until #56 is resolved. | `AGENTS.md` Standing holds (after the 08-29 audit) | **`ai_models.rs` still exists** (~816 lines). #56 still open. | You asked agents to stop using doctrine as a veto. They still do. |
| ADR-0177 option 1: Rhizome is a client of harnesses. | `docs/adr/0177-…` (merged #84, 2026-10-05) | **Partial.** Prime is a daemon client. Hermes is still `hermes chat --quiet --source tool` (`hermes_cli.rs`). Hermes `productVisible: false`. | Room consensus. Follow-ups recorded, not built. |
| Hide leftover helpers after close (Mindwalk / ws-bridge). Do not leave a second Dock story. | `docs/plans/hide-on-close-helpers.md` (2026-09-12) | **Yes.** `hidden_window_helper_stops` = `ws_bridge`, `mindwalk`. Spawned Prime stays warm (C75). | You accepted hide as the window behavior that day and asked to stop helpers. 2026-10-06 you questioned hide itself. |

---

## 2. One-night (Astra packet / God plan, 2026-09-13)

Source: `docs/ASTRA_PACKET.md` §10. Sister copy: `PLAN_FOR_A_PLAN.md` §6.
These were “do not start this *tonight*.” Later agents cite them as standing.

| Rule | Why it was there that night | Still in code / still true? | What it is now |
|---|---|---|---|
| Do not invent a competing Prime architecture | A Prime-spec sibling was already writing. ADR-0163 existed. | Prime client path is still the product. | Still good *sense*. Not a ban on later architecture if you ask. |
| Do not start a large Prime blob (import rows, RLM kernel, TokenJuice, CC Switch, `kanban.db`, portfolio Chat) | Evening-dump ideas + blocked import. | Import rows still unwired. No TokenJuice / CC Switch / `kanban.db` / portfolio Chat in the app. RLM children + cancel exist; deeper RLM does not. | Parked ideas. Not “never.” |
| Do not replace Chat or invent the briefing | ADR-0166 + dump: do not invent a dashboard that replaces the conversation. | Chat is still the center. No briefing UI. | Product sense unless you reopen shell. |
| Do not expand two big overlays at once | Dump: top/bottom overlays, hover-open, “TV above the monitor.” | Graph/Mycelium still Changes-only under Notes. | Layout caution, not law. |
| Do not port CC Switch | Dump: take copy/symlink as an idea; do not bring its SQLite store. | Not in the tree. | Parked. |
| Do not add GitHub Actions / paid CI | Same as your 09-12 ship rule. | **CI and Codacy already run.** | **Stale.** |
| Do not make the red close button quit | Do not undo C22 *tonight*. | **Yes.** `window_hides_instead_of_closing("main")`. `Cmd+Q` quits. Never Prime `shutdown`. | Engineering fix + later “settled UX.” You are allowed to reopen it. |
| Do not apply the Cursor model split to Codex/Claude | Composer = grunt, Grok = judgment, Cursor-only that night. | Process. | Dead. That night is over. |
| Do not redirect Cursor siblings to Codex | Four Cursor lanes were in flight / uncommitted. | Process. | Dead. |
| Do not clobber `BOARD.md` | A docs sibling was filling it. | `BOARD.md` is still a palimpsest. | One-night merge rule. |
| Do not redo ADHD+status | W13 already wrote User Rule `17932869` + Claude block. | Not in this repo (Cursor User Rules / `~/CLAUDE.md`). | Dead for this tree. |
| Do not treat open GitHub issues as unbuilt | Many issues were on `main` waiting for live-check close. | Still happens. | Still useful caution. |
| Do not wait for siblings — snapshot and sequence | Astra had to write a plan that night. | Process. | Dead. |

---

## 3. Inherited from Desktop (`11e1315`) and never re-judged

`AGENTS.md` §2–3. Byte-identical to Desktop on 2026-08-29 for demo vault,
`~/Laputa/`, and shadcn/ui. Full table:
[`2026-08-29-agents-md-rule-audit.md`](2026-08-29-agents-md-rule-audit.md).

| Rule | Still in code? | Notes |
|---|---|---|
| Demo vault hygiene; default `demo-vault-v2/` | Fixtures exist. Agents still treat them as disposable. | Harmless if you keep demo fixtures. Not a product identity rule. |
| User vault is `~/Laputa/` | **Name is leftover Desktop.** This product’s vault is not Laputa. #57 dropped dead Laputa/Tolaria *env* names. ADRs/README still say “Laputa app.” Smoke fixtures still use `/Users/luca/Laputa`. | The *hygiene* (do not pollute a real vault) is fine. The *path* is not yours. |
| Always use shadcn/ui. Never raw `<button>` / `<input>` / `<select>`. | **Partial.** Many surfaces import `@/components/ui/button`. Raw `<button>` still exists in product files (`PropertyValueCells.tsx`, `SearchPanel.tsx`, `ResearchPanel.tsx`, `ConflictNoteBanner.tsx`, …). | Agents still treat this as a wall. The tree does not. |
| `Option+N`, `app.set_menu()` replaces the whole menu, `mock-tauri` swallows calls | Still relevant on macOS / in this tree (`mock-tauri/` is a directory now). | Technical gotchas. Cheap to keep. |
| osascript / computer-use QA | CROSS-MODEL later said osascript TCC dies and CuaDriver does not. | Inherited, then corrected in this repo. |
| Pre-existing finding → open a C-number | Mechanism is used here. The *story* it cites (2026-08-02 sweep) is **Desktop’s**, before this repo’s first commit. | Keep the mechanism; the evidence is borrowed. |
| PostHog for meaningful features | Inherited mandate. Still in the release checklist. | You have not re-said this for Agent. |
| Codacy before releasable | Inherited, then this repo learned the *CLI* is free (2026-08-23). Cloud/MCP still paid. | CI now runs Codacy on PRs. |

Section 1 process rules (stranded work, stage-by-name, no `--no-verify`,
`tsc -b`, knip false positives) are **this-repo incidents**, not Desktop.
They are noisy but they cite collisions that happened here. Different pile.

---

## 4. Agent-ratified (you did not settle; agents still cite)

| Rule | Where | Still in code? | Notes |
|---|---|---|---|
| ADR-0168 “metabolites, not organs”; Prime the only execution core | `harness-doctrine.md`, C50, `YOU-SHOULD-KNOW.md` | **Code disagrees.** `#56` / `ai_models.rs`. Hermes one-shot. | Design intent. Standing hold already says do not cite as settled. ADR-0177 now owns *identity*. |
| Red button **hides**; that is settled UX | `YOU-SHOULD-KNOW.md`, `BOARD.md`, `ARCHITECTURE.md`, C22 | **Yes.** | Started as a 2026-08-15 bug fix (destroyed window, menu-bar app, reopen dead). Agents promoted it to product law. |
| Prime-only product UI for v0 | `src/lib/aiAgents.ts` `productVisible` | **Yes.** Only Prime is visible. Other CLIs remain wired and hidden. | Product choice in code. ADR-0177 says identity is client-of-harnesses, not “only one harness forever.” |
| Never Prime `shutdown` | `lib.rs`, `YOU-SHOULD-KNOW.md` | **Yes.** Hide/quit never send it. | Follows ADR-0163. Sound unless you want Rhizome to own the daemon. |
| Do not clone `PrimeIntellect-ai/prime-agent` | `AGENTS.md` §1 | Process. | This-repo correction after agents dumped the package. |
| Voice skills stay out of this repo; STE-100 lives in the vault | `AGENTS.md` header | Process. | This-repo, not Desktop. |
| Kern is Linux/WSL2 only | Standing holds | Not in the app. | Factual. |

---

## 5. This-repo incidents that are still load-bearing

Not the thing you were pointing at. Listed so they are not swept up with
the packet.

| Rule | Why it exists |
|---|---|
| Wrong-tree STOP: this is `tuckcode/rhizome-agent`, not `knispo/rhizome` | Fork identity. An agent could have pushed to Desktop. |
| Stage named paths; `git commit -- path` | 2026-08-29 shared-tree collisions. |
| `pnpm typecheck` is `tsc -b`; `tsc --noEmit` is a no-op | Measured 2026-08-20. |
| knip cannot see `declare global` or shell-reached files | `rhizomeTestBridge.ts`, `mcp-server/cli-call.mjs`. |
| Hide-on-close *bug*: do not destroy `main` while the process lives | C22. Separate from “hide is the product.” |

---

## 6. What sticks out (re-judge first)

These are the ones that behave like the close-button line: agents treat
them as walls, and the warrant is thin or stale.

1. **Red close hides.** Code yes. Product call now yours again.
2. **No GitHub Actions / paid CI.** You said it when the repo was private
   and solo. CI and Codacy already run. The packet is wrong.
3. **Always shadcn, never raw HTML.** Inherited Desktop. Code already
   mixes. Agents still block raw controls.
4. **`~/Laputa/` as the user vault.** Inherited name. Not this product.
5. **ADR-0168 as a veto.** You already demoted it. Agents still reach for
   it. ADR-0177 + #56 are the live pair.
6. **ASTRA_PACKET §10 as standing law.** Header says superseded. Agents
   still paste the list.
7. **Evening-dump hard nos** (briefing, two overlays, CC Switch,
   `kanban.db`, portfolio Chat). Parked talk from 2026-09-07. Fine as
   “not started.” Bad as “Atticus forbade this forever.”

---

## 7. Sources opened

- `AGENTS.md` §1–3, Standing holds, Learned
- `docs/ASTRA_PACKET.md` §4, §10
- `docs/PLAN_FOR_A_PLAN.md` §6
- `docs/YOU-SHOULD-KNOW.md` §2
- `docs/BOARD.md` Found / True right now
- `docs/NEXT.md` hard nos
- `docs/plans/2026-08-29-agents-md-rule-audit.md`
- `docs/plans/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md`
- `docs/plans/hide-on-close-helpers.md`
- `docs/adr/0163`, `0168`, `0177`
- Code: `src-tauri/src/lib.rs` (C22), `hermes_cli.rs`, `ai_models.rs`,
  `commands/session_import.rs`, `src/lib/aiAgents.ts`,
  `.github/workflows/ci.yml`
