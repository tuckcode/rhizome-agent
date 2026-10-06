---
type: Note
status: evidence
date: 2026-10-06
---

# Standing-rule inventory — inherited / one-night / Atticus / still in code

**Origin:** Cursor Grok 4.6 · 2026-10-06 · requested after the ASTRA_PACKET
§10 / C22 hide question. Evidence, not a decision. Weight, push-back,
and a grill-with-docs reminder added the same night.

**Does not change** `AGENTS.md`, `ASTRA_PACKET.md`, or product code.

Prior provenance pass (AGENTS.md only, 2026-08-29):
[`2026-08-29-agents-md-rule-audit.md`](2026-08-29-agents-md-rule-audit.md).

## How agents misuse this kind of file

Agents do two opposite things, often in the same session:

1. **Bible.** Any heading that says “Do not” becomes constitutional law.
   ASTRA_PACKET §10, ADR-0168, “red close hides,” and “always shadcn”
   get quoted to reject work Atticus just asked for.
2. **Shrug.** The same agent then ignores a live hold (`import_jsonl`
   waits for `1`, English-only, stage-by-name, “open ≠ unbuilt”) because
   it is “just process” or because a newer shiny line arrived.

**Weight is the authority column.** Notes are not a second weight. Do
not promote a `context` or `stale` row to a stop. Do not demote a
`bind` or `live` row to optional. `context` means *read it and do not
veto with it*, not *skip the file*.

His current ask is the job. A doc is not a veto of that job. Changing
a rule, or building past one, still goes through him.

## Speak up. Do not decide.

A lot of these rows are pre-existing Desktop text, one-night traffic,
or two agents writing past each other on bad data. Some are solid.
The file is allowed to contain both.

**Do not unilaterally drop a rule and implement your own way.** That is
the last thing he wants. “I have a better idea, so I built it” is a
miss even when the idea is good.

**Do speak up** when:

- a rule is about to stop the request and you see no reason it should
  exist, or no reason it applies to this task, or
- you have a better shape than the rule or the request implies.

Name the row, why it fails or does not apply, and what you would do
instead. Then **wait**. He decides. Only then build.

Safety rows stay until he overrides them this turn (wrong tree,
English-only, `import_jsonl` waits for `1`). Quiet obedience (building
the stop) and quiet override (building past the stop) are the same
miss: it did not go through him.

## What is solid

Not everything here is residue. These are the ones worth keeping a
spine about, until he changes them on purpose:

- Wrong tree (`tuckcode/rhizome-agent`, not Desktop).
- English only. Stop reopening localization.
- `import_jsonl` list rows wait for `1`.
- His current ask is the job. Docs are evidence, not a veto. Deviations still go through him.
- ADR-0177: Rhizome is a client of harnesses.
- Do not send Prime `shutdown`.
- Voice files stay out of this repo.
- Stage by name. Never `--no-verify`. Three ship verbs.
- `tsc -b`, not `tsc --noEmit`. Open issue ≠ unbuilt.
- Demo-vault / real-vault hygiene (the habit, not the Laputa name).
- macOS gotchas (`Option+N`, `set_menu` replaces the whole menu).

Take those seriously. Do not use them to reject a neighboring idea he
just asked for.

## Weight

| Weight | Take it as | Do not take it as |
|---|---|---|
| **bind** | Safety / identity. Do not violate this turn unless he explicitly overrides that row. | A license to reject neighboring ideas. |
| **live** | He said it. Do it. Do not “improve” past it. | Scripture to sermonize. A reason to ignore a newer ask. |
| **practice** | Do the mechanical thing (git, tests, fixtures). | A product veto. |
| **context** | History. Cite as evidence. | A stop. Permission to skip reading. |
| **stale** | Do not cite. Reality moved. | “The old idea was stupid.” Just stop quoting it. |
| **dead** | One-night traffic. Drop it from your working set. | A forever ban that happens to be expired. |

## How to read the other buckets

| Bucket | Means |
|---|---|
| **Inherited** | Copied from Rhizome Desktop in `11e1315` (2026-08-09) and never re-judged here. `AGENTS.md` §2–3 already say this. |
| **One-night** | Written for the 2026-09-13 Astra / God-plan window. The packet header already says the snapshot is superseded. |
| **You said** | Dated Atticus / knispo quote or room call. |
| **This-repo incident** | A bug or collision in *this* tree produced the rule. |
| **Agent-ratified** | Agents wrote it as law. You did not. |

**Still in code** is a separate fact. Code can be a leftover. Leftover
code is not a decision.

---

## 1. You said (dated)

| Rule | Weight | Where agents read it | Still in code? | Notes |
|---|---|---|---|---|
| English only. Do not migrate `en.json`. Do not run `l10n:translate` / report `l10n:validate`. | **live** | `AGENTS.md` Localization; C18 | **Yes as policy.** Strings stay mixed: hardcoded English + leftover `en.json`. `l10n:validate` still fails by design. | Said 2026-08-16, 08-21, 08-29 (“20 times”). Agents *under-treat* this and reopen it. Take it seriously. Do not preach it as a reason to reject other UI work. |
| `import_jsonl` into the Prime session list waits for **`1`**. Silence is not approval. | **bind** | `AGENTS.md` Standing holds; `BOARD.md`; `NEXT.md` | **Yes.** Vault import exists. Session-list writer is not wired (`session_import.rs`). | Agents *under-treat* this and start the writer anyway. Do not. |
| Local pre-push is CI. No GitHub Actions / paid CI / Chunk / Codacy cloud / CodeScene. Apple $99 later. | **stale** | `ASTRA_PACKET.md` §4 ship rules (2026-09-12) | **Contradicted.** `.github/workflows/ci.yml` runs on PRs. PR #84 ran frontend, Rust, Linux build, CodeQL, **Codacy**. Repo is **public** (2026-10-04). | Do not cite. Do not rip CI out because this sentence exists. |
| Commit, push, rebuild are three verbs. Rebuild only if you will launch. | **live** | `rhizome-ship` skill | Process. | Do the verbs separately. Not a reason to refuse a commit he asked for. |
| Do not add a compatibility path unless an instance exists on disk. | **live** | `AGENTS.md` Standing holds | Process. #57 dropped dead Laputa/Tolaria env names. | Recurring. Check disk first. |
| Current ask wins. Docs are context, not a stop. | **bind** | `AGENTS.md` Learned | Process. | The meta-rule. Agents *under-treat* this and hide behind HANDOFF / ADRs. |
| Do not reject a tool by citing ADR-0168 as settled until #56 is resolved. | **live** | `AGENTS.md` Standing holds | **`ai_models.rs` still exists** (~816 lines). #56 still open. | You already demoted the doctrine. Agents still use it as a veto. Stop. |
| ADR-0177 option 1: Rhizome is a client of harnesses. | **live** | `docs/adr/0177-…` (merged #84, 2026-10-05) | **Partial.** Prime is a daemon client. Hermes is still `hermes chat --quiet --source tool`. Hermes `productVisible: false`. | Room consensus. Take the identity seriously. Do not treat leftover Hermes code as if the question were still open. Do not implement the ACP follow-up unless asked. |
| Hide leftover helpers after close (Mindwalk / ws-bridge). | **live** | `docs/plans/hide-on-close-helpers.md` (2026-09-12) | **Yes.** `hidden_window_helper_stops` = `ws_bridge`, `mindwalk`. Spawned Prime stays warm (C75). | He asked to stop helpers that day. Separate from “hide is the product” below. |

---

## 2. One-night (Astra packet / God plan, 2026-09-13)

Source: `docs/ASTRA_PACKET.md` §10. Sister copy: `PLAN_FOR_A_PLAN.md` §6.
These were “do not start this *tonight*.” Later agents cite them as standing.
Default weight for this section is **dead** unless a row says otherwise.

| Rule | Weight | Why it was there that night | Still in code / still true? | Notes |
|---|---|---|---|---|
| Do not invent a competing Prime architecture | **context** | A Prime-spec sibling was already writing. ADR-0163 existed. | Prime client path is still the product. | Good sense. Not a ban if he asks. ADR-0177 is the live identity. |
| Do not start a large Prime blob (import rows, RLM kernel, TokenJuice, CC Switch, `kanban.db`, portfolio Chat) | **context** | Evening-dump ideas + blocked import. | Import rows still unwired. Those products are not in the app. | Parked talk. Not “never.” Import rows stay **bind** via the `1` hold. |
| Do not replace Chat or invent the briefing | **context** | ADR-0166 + dump. | Chat is still the center. No briefing UI. | Do not invent a dashboard *instead* of the ask. If he asks to replace Chat, that is the ask. |
| Do not expand two big overlays at once | **context** | Dump: hover-open, “TV above the monitor.” | Graph/Mycelium still Changes-only under Notes. | Layout caution. Not a wall. |
| Do not port CC Switch | **context** | Take copy/symlink as an idea; do not bring its SQLite store. | Not in the tree. | Parked. |
| Do not add GitHub Actions / paid CI | **stale** | Same as the 09-12 ship rule. | **CI and Codacy already run.** | Do not cite. |
| Do not make the red close button quit | **context** | Do not undo C22 *tonight*. | **Yes.** `window_hides_instead_of_closing("main")`. `Cmd+Q` quits. | He reopened this on 2026-10-06. Not a forever UX law. See §4. |
| Do not apply the Cursor model split to Codex/Claude | **dead** | Composer = grunt, Grok = judgment, Cursor-only that night. | Process. | Drop it. |
| Do not redirect Cursor siblings to Codex | **dead** | Four Cursor lanes were in flight. | Process. | Drop it. |
| Do not clobber `BOARD.md` | **dead** | A docs sibling was filling it. | `BOARD.md` is still a palimpsest. | Ordinary “stage your own files” covers this now. |
| Do not redo ADHD+status | **dead** | W13 already wrote the rule. | Not in this repo. | Drop it. |
| Do not treat open GitHub issues as unbuilt | **practice** | Many issues were on `main` waiting for live-check close. | Still happens. | Agents *under-treat* this and re-implement. Check `main` first. |
| Do not wait for siblings — snapshot and sequence | **dead** | Astra had to write a plan that night. | Process. | Drop it. |

---

## 3. Inherited from Desktop (`11e1315`) and never re-judged

`AGENTS.md` §2–3. Byte-identical to Desktop on 2026-08-29 for demo vault,
`~/Laputa/`, and shadcn/ui. Full table:
[`2026-08-29-agents-md-rule-audit.md`](2026-08-29-agents-md-rule-audit.md).

Default weight: **context**. Cheap technical gotchas can be **practice**.

| Rule | Weight | Still in code? | Notes |
|---|---|---|---|
| Demo vault hygiene; default `demo-vault-v2/` | **practice** | Fixtures exist. | Clean up dirt. Not a product identity rule. |
| User vault is `~/Laputa/` | **stale** | **Name is leftover Desktop.** ADRs/README still say “Laputa app.” Smoke fixtures still use `/Users/luca/Laputa`. | Do not send testers to Laputa. The *hygiene* (do not pollute a real vault) is **practice**. |
| Always use shadcn/ui. Never raw `<button>` / `<input>` / `<select>`. | **context** | **Partial.** Many surfaces use `@/components/ui/button`. Raw `<button>` still exists in product files. | Agents *over-treat* this as a wall. Match neighbors. Do not block a slice over a native control. |
| `Option+N`, `app.set_menu()` replaces the whole menu, `mock-tauri` swallows calls | **practice** | Still true on macOS / in this tree. | Cheap gotchas. Keep. |
| osascript / computer-use QA | **practice** | CROSS-MODEL: osascript TCC dies; CuaDriver does not. | Follow the *corrected* this-repo version, not the Desktop sentence. |
| Pre-existing finding → open a C-number | **practice** | Mechanism is used here. The 2026-08-02 sweep story is Desktop’s. | Keep the mechanism. Do not retell Desktop’s incident as ours. |
| PostHog for meaningful features | **context** | Still in the release checklist. | He has not re-said this for Agent. Do not block a slice for a missing event unless he asked for analytics. |
| Codacy before releasable | **context** | CLI is free. CI already runs Codacy on PRs. | Do not buy cloud. Do not pretend the gate was never runnable. |

Section 1 process rules (stranded work, stage-by-name, no `--no-verify`,
`tsc -b`, knip false positives) are **this-repo incidents**. Weight:
**practice**. Agents *under-treat* stage-by-name and `--no-verify`.
Do the practice. Do not use it to reject product work.

---

## 4. Agent-ratified (you did not settle; agents still cite)

| Rule | Weight | Where | Still in code? | Notes |
|---|---|---|---|---|
| ADR-0168 “metabolites, not organs”; Prime the only execution core | **context** | `harness-doctrine.md`, C50, `YOU-SHOULD-KNOW.md` | **Code disagrees.** `#56` / `ai_models.rs`. Hermes one-shot. | Do not cite as settled. ADR-0177 owns identity. #56 owns the leftover path. |
| Red button **hides**; that is settled UX | **context** | `YOU-SHOULD-KNOW.md`, `BOARD.md`, `ARCHITECTURE.md`, C22 | **Yes.** | Agents *over-treat* this. It was a bug fix. He reopened the product call. |
| Prime-only product UI for v0 | **context** | `src/lib/aiAgents.ts` `productVisible` | **Yes.** Only Prime is visible. Other CLIs remain wired and hidden. | Describes today’s picker. Not “only one harness forever.” |
| Never Prime `shutdown` | **live** | `lib.rs`, `YOU-SHOULD-KNOW.md` | **Yes.** Hide/quit never send it. | Follows ADR-0163. Do not kill a daemon other clients share unless he asks. |
| Do not clone `PrimeIntellect-ai/prime-agent` | **practice** | `AGENTS.md` §1 | Process. | Read installed docs. Do not ingest the repo. |
| Voice skills stay out of this repo; STE-100 lives in the vault | **live** | `AGENTS.md` header | Process. | Do not copy voice files into this tree. |
| Kern is Linux/WSL2 only | **context** | Standing holds | Not in the app. | A fact. Not a product veto. |

---

## 5. This-repo incidents that are still load-bearing

Not the packet. Listed so they are not swept up with it.

| Rule | Weight | Why it exists |
|---|---|---|
| Wrong-tree STOP: this is `tuckcode/rhizome-agent`, not `knispo/rhizome` | **bind** | Fork identity. An agent could have pushed to Desktop. Take this seriously. |
| Stage named paths; `git commit -- path` | **practice** | 2026-08-29 shared-tree collisions. Agents *under-treat* this. |
| `pnpm typecheck` is `tsc -b`; `tsc --noEmit` is a no-op | **practice** | Measured 2026-08-20. |
| knip cannot see `declare global` or shell-reached files | **practice** | `rhizomeTestBridge.ts`, `mcp-server/cli-call.mjs`. |
| Hide-on-close *bug*: do not destroy `main` while the process lives | **practice** | C22 engineering constraint. If he wants the red button to quit, quit the process. Do not recreate an unreachable hidden window. Separate from “hide is the product.” |

---

## 6. What sticks out (re-judge first)

These are the ones that behave like the close-button line: agents treat
them as walls, and the warrant is thin or stale.

1. **Red close hides.** Weight: **context**. Code yes. Product call is open.
2. **No GitHub Actions / paid CI.** Weight: **stale**. CI already runs.
3. **Always shadcn, never raw HTML.** Weight: **context**. Tree already mixes.
4. **`~/Laputa/` as the user vault.** Weight: **stale**. Leftover name.
5. **ADR-0168 as a veto.** Weight: **context**. You already demoted it.
6. **ASTRA_PACKET §10 as standing law.** Weight: **dead** / **context**.
   Header says superseded.
7. **Evening-dump hard nos** treated as forever. Weight: **context**.

Opposite list — agents *under-treat* these:

1. Current ask wins (**bind**).
2. `import_jsonl` waits for `1` (**bind**).
3. English-only (**live**).
4. Open GitHub issue ≠ unbuilt (**practice**).
5. Stage by name / never `--no-verify` (**practice**).
6. Wrong tree (**bind**).

---

## 7. Wanted: sit-down grill

**Remind Atticus.** This inventory is a map, not the comb.

Book a `/grill-with-docs` (or grill-with-vault) session and walk the
corpus agents actually obey: `AGENTS.md` §1–3 and Standing holds,
`ASTRA_PACKET.md` §10, `YOU-SHOULD-KNOW.md`, `BOARD.md` ship rules,
`NEXT.md` hard nos, ADR-0163 / 0168 / 0177, this file. Keep what is
solid. Rewrite or drop what was inherited, one-night, or written on
misunderstood data. Cross the T's on purpose, not by agent accretion.

Do **not** start that grill unless he says now. An agent who is about
to treat a stale packet line as law should remind him this row exists.

Issue #5 was itself a `/grill-with-docs` spec. That is the shape, not
the homework.

---

## 8. Sources opened

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
