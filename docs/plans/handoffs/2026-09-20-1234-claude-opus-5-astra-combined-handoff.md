---
session: 2026-09-20T12:34-05:00
model: Claude Opus 5 (Claude Code, desktop)
description: >-
  Combined handoff for Astra. Folds Cursor Grok 4.6's 12:30 wrap together with
  the Claude Opus 5 audit rounds that ran beside it: Wave 1 verification, the
  issue-26 host-gate finding (now fixed), the visual audit that opened C77/C78,
  the Pi package-registry check that rescopes the plugin slices, and an ADR
  audit finding 144 of 155 active ADRs were written for Rhizome Desktop.
commits: ba7702f..6ce3782
---

# Combined handoff for Astra — 20 September 12:34

**Origin:** Claude Opus 5 · Claude Code desktop · 2026-09-20 12:34.

Astra wrote the plan on the night of 2026-09-19. Two agents executed against it
in parallel on 2026-09-20: **Cursor Grok 4.6** did the building, **Claude Opus
5** did the auditing, and the two exchanged review rounds through Atticus. This
file is the single handoff back. Cursor's own wrap is
[`2026-09-20-1230-cursor-grok-4-6-handy.md`](2026-09-20-1230-cursor-grok-4-6-handy.md)
and the morning narrative is
[`2026-09-20-1228-cursor-grok-4-6-astra-cursor-recap.md`](2026-09-20-1228-cursor-grok-4-6-astra-cursor-recap.md).
Nothing below replaces those; it adds the audit half and reconciles state.

## Landing update — GPT-6 Codex, 12:55

The D1–D7 range and Free-only slice passed an independent standards/spec
review. The review found and fixed shared-toggle drift, incomplete provider
selection, a paid-model filter exception, missing picker analytics, stale
architecture text, the missing handoff index, and a CommandRail lint error.

Free only and Edit list landed in `6ce3782`. The rail lint fix is `854e031`.
Focused verification: 82 model tests and 29 rail tests pass. Typecheck and
focused lint pass. Gitleaks found no leaks. `/Applications` still points to
`b7264d6`; this landing did not rebuild the app.

## Exact state, verified 12:34

| Surface | Value |
|---|---|
| Branch | `main` at `ffc135f` |
| Origin | `ba7702f` — **11 local commits unpushed** (D1–D7 merges + slices) |
| Wave 1 | `b5dd7a1` — verified an ancestor of `origin/main`. On origin. |
| App | `/Applications/Rhizome Agent.app` **07:23**, stamped `b7264d6` |
| Vite 5202 | stopped |
| Prime | 0.9.3. `auth.json`: anthropic, deepseek, opencode, opencode-go, openrouter, xai. **No `nvidia`.** |

Dirty working tree (all Cursor's, none mine — I wrote no code this session):

`src/lib/primeModels.ts` + test · `src/components/PrimeModelPicker.tsx` + test ·
`src/components/PrimeModelAllowListSection.tsx` + test ·
`src/lib/productAnalytics.ts` · `src/components/ChatComposerDeck.test.tsx` ·
`AGENTS.md` · `.cursor/rules/one-job-in-flight.mdc` · `docs/HANDOFF.md` ·
untracked `2026-09-20-1228` recap.

**I did not update `docs/HANDOFF.md`.** It is dirty in Cursor's tree and
AGENTS.md forbids editing files another agent holds mid-edit. Whoever lands the
Free-only slice should add the index line for this file.

## What the audit loop actually produced

Three review rounds ran against Wave 1 and issue 26. **Cursor acted on every
finding.** Verified in the tree at 12:34, not taken on report:

| Finding | State |
|---|---|
| `parked-organs.test.ts` pinned a source string Lane B replaced — full suite failed 1/6703 while lint, typecheck and every focused suite passed | Fixed |
| `chatTurnOutcome.ts` — 123 lines plus a full test suite, imported by nothing in the app; knip cannot see it because its own test imports it | Deleted. The four endings survive in the Lane B recipe |
| `leftover-public-preview-claims.test.ts` pinned commit SHAs and required the docs to say "unpushed" — a test that would defend a false statement after the push | Rewritten to pin behaviour |
| `prime_vault_skill.rs` HOME-skip edit stranded uncommitted | Committed as `b5dd7a1` |
| **#26: the host took the client's word for the mid-turn guard** | **Fixed** — `refuse_busy_chat(chat_busy, prime_session_host::is_streaming())` at `prime_update.rs:248`, with a test named `apply_refuses_when_the_host_is_streaming_even_if_the_client_says_idle` |
| #26 added two new `en.json` keys (C18) | Removed |
| `check_prime_update` returned null and `list_prime_sessions` returned `[]`, so #26 and the title unwrap were both unverifiable in the browser | Both seeded in `mock-handlers.ts` |

The #26 one is worth Astra's attention as a pattern, not just a fix. The host
owns the Prime session and `prime_session_host::is_streaming()` was already
public and already used by the window-close path — the more destructive
operation was gated on a client boolean while a less destructive one was gated
on host knowledge. The class of bug is "the authority exists and the caller
didn't ask it."

## Still open from the audit

- **Windows `~\` is unexpanded.** `expandLeadingTilde` in `mcp-server/vault-path.js:24`
  handles `~` and `~/` only. On Windows `~\Laputa` skips expansion, so
  `isHomeVaultPath` returns false and the home-vault guard is bypassed. The same
  file branches on `win32` at line 51, so this is an omission, not a decision.
- **C77** — `AiPanelChrome.tsx:484` stacks `opacity: 0.6` on
  `text-muted-foreground` at 11px. Measured **2.76:1 light, 3.93:1 dark**; AA
  needs 4.5:1. It was the only contrast failure on the whole visible first-run
  surface, and it is the one line of guidance a new user reads in Chat.
  Pre-existing (`3bf045c`).
- **C78** — `NoteListHeader.tsx` renders "Inbox" as "I…" at **every** width
  including 1440px. `flex-1 truncate` gives the title 21px for a 37px word
  while four icon buttons keep theirs. Pre-existing (`39fc511`).
- **Collapsed rail first-run.** `command-rail` measures 46×870px with a 64px
  footer — 93% blank — and hover did not expand it. `PrimeSessionList.tsx:812`
  does have empty-state copy, but it mounts into the rail's *expanded* slot, so
  a collapsed rail shows nothing regardless. Unverified since; Vite is stopped.

## Findings a fresh session will miss (Cursor's, preserved)

- NVIDIA **is** Prime provider `nvidia` / `NVIDIA_API_KEY`. It is absent from
  this machine's catalog only because the key is not in auth. NIM ids have **no**
  `:free` suffix. OpenRouter still ships `nvidia/…:free` twins.
- Free only is a **live** catalog cut (OpenRouter `:free` / `openrouter/free`,
  OpenCode `-free`). Do not snapshot free ids into the allow-list.
- An empty allow-list still means "show all." That is why Settings reads as
  though everything is already enabled.
- Hermes-style **Edit list** — picker footer, provider check-all, more Settings
  space — was agreed and **not built**. It is the next action.
- #26's mock apply on 5202 reached "Chat engine is now 0.9.4." Native Update
  against a real 0.9.3 is still **unverified**. Do not close #26.
- D1–D7 exist on local `main` only. The installed app does not contain them.
- Atticus replies while he reads. An interrupt is extra work, not a signal to
  drop the current job.

## Decisions Atticus made this session

**Naming — keep "Rhizome Agent."** He opened by wanting to drop "Agent." The
argument for dropping it was that an agent-harness searcher landing on a
knowledge vault is a mismatched lead. He then said the product is *mainly an
agent harness that has a vault built in*, which inverts that premise: the name
is accurate rather than category-borrowed, and the harness searcher is the right
lead. Two supporting facts: `productName` and `identifier` are separate fields
in `tauri.conf.json` and macOS keys app identity off the **identifier**, so a
display-name rename never orphans the installed app — meaning the rename stays
cheap forever and has no deadline. And "rhizome" alone is a crowded search term
(Deleuze, botany, rhizome.org since 1996). Revisit only if the centre of gravity
moves off the harness.

**Archive the two dead repos.** `knispo/rhizome` (Desktop) last committed
2026-08-09, the day this repo forked; `knispo/rhizome-old` died 2026-07-24.
Archiving also removes the thing AGENTS.md's STOP block defends against.
**Check the 8 uncommitted files in `~/code/projects/rhizome` before moving that
path.** `rhizome-old` is clean.

**ADR-0168: keep the four REJECTs, drop the citation tax.** Agreed but not
written. See below — the blocking question is unanswered.

## Pi package registry — the plugin slices need rescoping

`docs/design/harness-composition.md:382` lays out three slices for the DeepSeek
Harness plugin idea. Checked against the live registry (queried npm on the
`pi-package` keyword; `pi.dev` is blocked by this session's site permissions and
there is no `prime-agent package search`):

- **10,266 packages**, not the ~5,000 the note's 2026-08-31 amendment claims.
- **The `ctx.ui` surface is larger than the note lists.** Verified against
  Prime's own `~/.local/lib/node_modules/prime-agent/docs/extensions.md`:
  `select`, `confirm`, `input`, **`notify`**, plus **`ctx.ui.custom()`** for full
  TUI components with keyboard input, `setStatus`, and `setWidget`. Extensions
  also get `registerShortcut` and `registerFlag`. The hook list in the note
  (`turn_start`/`turn_end`, `before_provider_request`/`after_provider_response`,
  `tool_call`, `tool_execution_*`) is accurate.
- **Slice 1 is under-scoped.** Rhizome cancels every `extension_ui` request at
  `prime_session_host.rs:2734` with `{"cancelled": true}`. What that costs, in
  monthly npm downloads of extensions that are inert in the app today:
  `@juicesharp/rpiv-ask-user-question` 198k, `@juicesharp/rpiv-todo` 162k,
  `@plannotator/pi-extension` 73k, `pi-powerline-footer` 44k,
  `@gotgenes/pi-permission-system` 39k. Over half a million. And the most
  popular of them is an overlay you collapse with `Ctrl+]` with persistent
  multiline drafts — that is `ctx.ui.custom()`, not a `select`. Slice 1 has to
  decide what a GUI does with `custom()` and `setWidget`, and that is the actual
  hard part, not rendering three dialog types.
- **Slice 3 probably should not be built.** `@gotgenes/pi-permission-system`
  (39k/mo) already does allow/ask/deny at tool-call time with wildcard patterns,
  guards paths outside `cwd`, forwards subagent prompts, and detects indirection
  wrappers that hide a gated command (`bash -c`, `eval`, `sudo`, `env`, `xargs`,
  `find -exec`). It fails closed. That is far more than "Prime tool allow-lists
  as Rhizome presets." Consequence: because it fails closed and Rhizome cancels
  the confirm, every `ask` rule currently resolves as a **deny** — a second
  argument for slice 1.
- **Slice 2 has an unweighed cost.** `packages.md` states packages "run with
  full system access" and "extensions execute arbitrary code." A catalog that
  makes installing easy is a supply-chain surface.
- **Two packages sit on product surface.** `pi-memory` (36k/mo, semantic search
  over daily logs and long-term memory) is on Rhizome's stated centre of
  gravity. `pi-goal-x` (88k/mo, `/goal` with persistent progress) overlaps the
  Goal button already in the composer — and IDENTITY.md says to use Prime's
  mechanism rather than building beside it.

## ADR audit — the corpus is inherited

Atticus asked whether rules are blocking good changes by being stale. The
answer is bigger than ADR-0168.

**144 of 155 active ADRs were written for Rhizome Desktop**, before this repo
existed. They arrived in one commit — `11e1315`, the Desktop bootstrap, **166
ADR files at once**. Only 11 were written for Rhizome Agent. Every one is
`status: active` and reads as binding. This is the same inheritance problem
AGENTS.md already documents about its own Sections 2 and 3, at thirteen times
the scale. Most are probably fine. Two are confirmed stale gatekeepers:

- **ADR-0149, "Drop the CodeScene quality gate (no free tier)."** The
  parenthetical is false and AGENTS.md says so as of 2026-08-26 — CodeScene
  ships a free Community edition scoped to open-source projects. The correction
  lives in AGENTS.md; the ADR still asserts the falsehood in its title and its
  options table. This matters now, because going public is live: Community
  becomes available the moment the repo flips, and the ADR a session reads first
  says the door is shut.
- **ADR-0028, "CLI agent only — no direct Anthropic API key"** (2026-03-29). It
  describes spawning `claude` CLI as a subprocess behind a Vite Anthropic proxy.
  This product talks to Prime's daemon and Prime owns credentials. Its decision
  — "No API key field in settings" — is still active and would read as binding
  on any credential UI.

**On 0168 specifically, the decision is smaller than #56 makes it look.** 0168's
own Consequences section already carves out the thing #56 says it forbids:

> The inherited `ai_models.rs` provider path may remain for non-Prime Desktop
> leftovers, but it is rejected as an architectural path for Prime chat.

So the doctrine permits it *as a leftover*, and #56's claim that the codebase
does not follow the doctrine is stronger than the evidence supports. What #56
correctly catches is that the path is not behaving like a leftover: 815 lines
with its own credential handling, a Settings summary naming which store the key
came from, and live routing at `aiAgentSession.ts:102`.

## The one blocking question

**Is `api_model` a Desktop leftover or a feature?**

- *Leftover* → hide it from the picker, and ADR-0168 becomes true as written.
- *Feature* (BYO-provider without going through Prime) → say so deliberately and
  the superseding ADR scopes it.

Either answer closes #56 without deleting 815 lines of working, user-reachable
code to make a document true. Until it is answered the doctrine is neither
enforced nor retired, and that ambiguity is exactly what lets it be cited as a
veto. The superseding ADR is drafted in intent — keep the four REJECTs, drop
"new harness work cites this ADR" — and waiting only on this.

## Next action

Cursor's next action stands: **finish the Hermes-style Edit list** on the dirty
picker and Settings allow-list. Picker footer gets Edit list / Done with
per-model and per-provider checks; Settings takes more space in edit mode; keep
Free only as a live cut; no new `en.json` keys.

I started reading toward that and stopped on Atticus's instruction to write this
handoff instead. **I changed nothing.** The tree is exactly as Cursor left it.

Commit, push and rebuild stay three separate verbs. Do not rebuild unless he
will launch. `import_jsonl` waits for `1`. Do not merge #66. Do not close #26.
