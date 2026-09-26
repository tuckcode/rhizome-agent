# Handoff — Frame A, remaining work (A4 + composer foot row)

Written 2026-08-13 by Claude Opus 5 for whichever model picks this up next.
Self-contained: you should not need the conversation that produced it.

**Status 2026-08-14:** foot row shipped (`aeee08c`, `7f7f19a`). **A4 skipped** —
no Frame A titlebar exists; vault/last-tool already live on subhead/deck/foot.
Optional leftover: New chat on the subhead (header is `showHeader={false}`).
See `docs/HANDOFF.md` § 2026-08-13b. Traps below still apply.

**If you are not Claude, read `docs/CROSS-MODEL-HANDOFF.md` first.** It lists
traps a previous non-Anthropic session already hit here. This document adds the
Frame A-specific ones.

---

## Where things stand

`main` is green and pushed at `c25b505`. Gates: `pnpm test` 5254 passed / 498
files · `cargo test --lib` 1380 · clippy `-D warnings`, `cargo fmt`, `tsc -b`,
eslint all clean.

Landed today, in order:

| Slice | What it does |
|---|---|
| Prime session list slices 1–4 | Enumerate sessions from disk, replay a transcript, switch the live host, rehydrate the panel |
| Frame A / A1 | Chat is a rail destination that owns the window — no sidebar, no note list, no editor |
| Frame A / A2 | `PrimeSessionSubhead` — live · sess_xxxx · model · vault |
| Frame A / A3 | `ChatComposerDeck` — Prime · model ▾ · vault · Skills, with a working model picker |

Spec for the session list: `docs/plans/2026-08-13-prime-session-list-spec.md`.

## The design system is the source of truth

`~/Desktop/rhizome-agent-design-system/`. **Read it before writing
UI.** Atticus pointed at it mid-session and it corrected three decisions I had
already shipped, so treat it as authoritative over your own judgement about
layout.

- `rhizome-agent-desktop-ui.html` — the canonical artboards. Frame A starts at
  line 1642, Frame F (session list) at 2139. Grep for `.session-item`,
  `.subhead`, `.composer` to get exact CSS values.
- `DESIGN.md` — tokens, density, anti-patterns.
- `ui_kits/app/components/` — React sketches of each role.

**The model names in those artboards (`xai / grok-4.5`) are examples only.**
Rhizome Agent is BYO-model: the user connects any OAuth / API /
OpenAI-compatible provider. Never hardcode a model or provider in product code.
Everything reads live from `get_available_prime_models` /
`get_prime_session_host_status`.

---

## Task 1 — composer foot row

Frame A, `rhizome-agent-desktop-ui.html:1751`:

```html
<div class="composer-foot">
  <span>Working · last tool get_note</span>
  <span><kbd>Esc</kbd> stop · <kbd>⌘</kbd><kbd>.</kbd></span>
</div>
```

CSS: grep `.composer-foot {`. It is mono, muted, small.

**Why it was not done in A3.** The left half needs the *name of the last tool
that ran*, which lives in the panel controller (`useAiPanelController` →
`agent.messages`, whose last entry carries `actions: AiAction[]`), not in
`ChatComposerDeck`. `ChatComposerDeck` is rendered through `AiPanel`'s
`composerControls` prop from `ChatHome`, which is outside the controller. So
either:

- render the foot row inside `AiPanel` where `agent` is in scope (simplest), or
- lift a `lastToolName` value out through a prop.

Prefer the first. Put it under the composer in `AiPanelChrome`'s composer
block, gated on the same `isPrimeTarget` the deck uses.

The last tool name is the last `action.tool` of the last message with actions.
Write that as a **pure function with tests** — `lastToolName(messages)` — do not
inline it. Edge cases that matter: no messages, messages with no actions, and
an action list where the last entry is `status: 'pending'` (that is the one to
show — it is what is running).

## Task 2 — A4, titlebar status chips

Frame A, `rhizome-agent-desktop-ui.html:1653`:

```html
<span class="chip" title="Attached vault"><strong>Laputa</strong></span>
<span class="chip working"><span class="dot"></span>Running tools · 2</span>
<span class="chip tool-hot" title="Last tool">get_note</span>
<button class="icon-btn" aria-label="New chat">+</button>
```

**Look at the existing titlebar before adding anything.** This app already has
a status bar and window chrome; Frame A's titlebar may overlap it. Find what
renders today (`grep -rn "titlebar\|StatusBar" src/components/`) and decide
whether these chips belong there, in the subhead, or nowhere. It is legitimate
to conclude the subhead already carries this information and skip A4 — say so
explicitly rather than building a duplicate.

If you do build it: `Running tools · N` needs a count of in-flight actions, the
same data as Task 1. Do the pure function once and use it for both.

---

## How to work here

Read `AGENTS.md` at the repo root — it is binding. The parts that will bite you:

**TDD is mandatory.** Red → green → refactor → commit, one cycle per commit.
I slipped on this once today (wrote a parse before its tests) and said so in
the report rather than pretending otherwise. Do the same if it happens.

**Sign your commits.** Every agent adds a trailer naming the model that wrote
the change:

```
Co-Authored-By: Grok 4.6 <noreply@x.ai>
```

Git's author is `Atticus` on every commit regardless of who wrote it, so the
trailer is the only provenance.

**Completion comment.** Each commit message must cover: what shipped, QA,
tests/coverage with numbers, Codacy, localization, PostHog, refactoring, ADRs,
docs. Look at `git log -3` for the shape.

**Long commit messages make an unreadable task label.** Write the message to a
file and use `git commit -F <file>` rather than a heredoc — with a heredoc the
whole message becomes part of the shell command and the UI renders all of it.

### Gates

```bash
pnpm lint && npx tsc -b && pnpm test && pnpm test:coverage
```

```bash
cargo test --manifest-path=src-tauri/Cargo.toml --lib
```

```bash
cargo clippy --manifest-path=src-tauri/Cargo.toml --all-targets -- -D warnings
```

Before pushing, export the LLVM vars or the Rust coverage gate fails at step
4/6 without naming what is missing:

```bash
export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
```

### Verifying UI

Do not ship UI you have not looked at. Start the dev server through the preview
tooling (never `pnpm dev` in a raw shell), navigate to the Chat rail
destination, and check the DOM.

**The browser preview found three real bugs today that every test missed:**

1. A toggle rendered into `AiPanelHeader`, which the workspace mounts with
   `showHeader={false}` — it existed, tests passed, and no user could reach it.
   This is the `AiAgentsBadge` failure `AGENTS.md` documents, repeated.
2. The session list rendered 102px inside its 228px column — it is a flex child
   and was sizing to content.
3. Radix menus open on `pointerdown`, not `click`. A synthetic `.click()` did
   nothing. Use a real mouse click for QA and `fireEvent.pointerDown` in tests.

The browser mock returns empty lists for Prime commands
(`src/mock-tauri/mock-handlers.ts`), so populated states are covered by unit
tests, not the preview. **Any new Tauri command needs an entry there** — the
fake IPC table returns `null` for anything unlisted, and a `null` where the app
expects a payload has blanked the entire app before (see the A1 note in
`docs/HANDOFF.md`).

---

## Traps specific to this area

**`npx tsc --noEmit` is not the build gate.** `tsc -b` is, and they disagree.

**Adding a rail destination means moving four unions together** —
`SidebarFilter` (`src/types.ts`), `CommandRailDestination`
(`src/components/CommandRail.tsx`), `RailDestination`
(`src/lib/productAnalytics.ts`), and the `Record<SidebarFilter, string>` label
map (`src/collections/collectionFromSelection.ts`). Missing one fails only at
`tsc -b`. This has broken the build three times.

**eslint's `react-hooks/set-state-in-effect` rejects an effect that calls a
state-setting callback.** The working shape is an async IIFE inside the effect
that awaits before touching state. `MyceliumView` predates the rule; do not
copy it. Never add `// eslint-disable` — `AGENTS.md` forbids it.

**zsh does not word-split unquoted `$VAR`,** and `--include=*.rs` needs
quoting. Use python for anything iterating paths.

**`cd` persists between tool calls.** I drifted into the design-system folder
twice and ran repo commands there. Use absolute paths or re-`cd`.

**Localization will fail and that is expected.** `pnpm l10n:validate` reports
~190 missing keys per locale because no session has had `LARA_ACCESS_KEY_ID`.
That is C18 in `docs/HANDOFF.md`. Add your English keys to
`src/lib/locales/en.json`, then **say in the completion comment that
`l10n:translate` was not run and why** — do not report the gate as passing.

**Codacy has never been set up here** (paid tier, private repo). Say
"Codacy: not run — no MCP tool, no `.codacy/` directory in this session"
rather than skipping it silently.

## Verify claims against the thing itself

Two defects today were invisible to passing tests because the fixtures encoded
my *reading* of a format rather than the format:

- A `model_change` parse invented a nested `model` object. Real logs are flat:
  `{"provider":"xai","modelId":"grok-4.5"}`. Every fixture test passed.
- A finding recorded as "`get_messages` is broken" was a misread of a fresh
  session. It returns 125 messages once a session is loaded.

If you touch the Prime log parse, run it against a real log:

```bash
PRIME_SESSION_LOG=~/.prime/agent/sessions/<id>.jsonl cargo test --manifest-path=src-tauri/Cargo.toml --lib prime_sessions -- --ignored --nocapture
```

To probe the RPC contract directly, spawn `prime-agent --mode rpc` and write
JSONL to stdin. That is how `switch_session`'s `sessionPath` parameter and
`set_model`'s `{provider, modelId}` pair were found — the errors name no
parameter, so both were found by elimination.

## Where to write results

Per `~/CLAUDE.md`, write all that apply:

| Artifact | Destination |
|---|---|
| Repo current state | `docs/HANDOFF.md` (update in place) |
| Session detail | `docs/plans/YYYY-MM-DD-*-session-status.md` |
| Session narrative | `~/Documents/Rhizome Vault/agents/claude/session-logs/` |

If you write "pre-existing" or "not introduced by this change" anywhere, open a
`C`-number in `HANDOFF.md`'s Open threads **in the same commit**. That rule
exists because the same bug was independently logged as pre-existing by three
separate sessions and fixed by none.
