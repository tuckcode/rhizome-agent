---
session: 2026-09-02T20:28-05:00
model: Claude Opus 5 (Claude Code)
description: >-
  Prime is a distribution of Pi (Earendil), and pi.dev/packages already holds
  ~5,000 installable extensions and skills — verified against Prime's own
  package.json and docs. Impeccable found a P0 in Settings that silently ate
  unsaved edits, and Chat's composer was advertising three keyboard shortcuts
  that did the opposite or did not exist. Hermes source read for terminal,
  kanban and bots.
commits: 7eff708, 5b9e118, 56f5aef, b035601, 44e06ce, eb628a6, ff2f56a, b06273f, b523c25, f8e9305, 3df5f9e, 6faad41
---

# Impeccable on Settings and Chat, and finding out Prime is Pi — 2026-09-02

**Origin:** Claude Opus 5 (Claude Code) · 2026-09-02 · `eee063c`..`6faad41`

## The finding that matters most

**Prime Agent is a distribution of Pi, by Earendil Inc., and Pi has a package
registry with roughly 5,000 entries.** Atticus raised it; it verified against
primary sources, none of them a repo note:

- Prime's own `package.json` depends on `@earendil-works/pi-agent-core`.
- Prime's own `docs/packages.md` calls the format "the **inherited**
  extension ecosystem", keys resources under `pi` in `package.json`, and asks
  authors to use the `pi-package` npm keyword. Peer deps are
  `@earendil-works/pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`.
- `pi.dev/packages` is live: extensions, skills, prompt templates, themes,
  installable with `prime-agent package install npm:<name>`.

Those four kinds are the same seams `harness-composition.md` already called
the open door. The difference is the catalog exists and had never been
checked before that file concluded "Rhizome's gap is the product layer, not a
missing kernel." **Search the registry before authoring any slice-table row.**

The filter is unchanged — a package carrying its own loop, providers,
credentials or memory is still an organ. This widens the candidate list, not
the door. Written up in `harness-composition.md` § *Prime is a distribution
of Pi*, with four new open questions as items 7–10 of Still discuss / decide,
and `NEXT.md` §1 points at it.

Two cautions recorded there, both from Prime's own docs: packages "run with
full system access" on a host with no sandbox, and install is **CLI-only**
(absent from `prime-adapter-surface.json` and `rpc.md`). The daemon does
expose `bash`, and Rhizome already parses bash tool calls
(`prime_events.rs`, `prime_tool_unwrap.rs`), so an agent-run install is
plausible — **untested. Do not treat it as working until someone runs it.**

Concrete candidate already found: `pi-hermes-memory` (npm, `chandra447`) is
Hermes's memory tool ported to Pi, credited in its own README. That is the
Hermes contract this repo said to adapt, already built on Prime's seam by a
third party. Item 10 asks whether its writes collide with vault promote.

## What shipped

Twelve commits, all pushed to `main`. Two threads.

**Settings panel — `/impeccable critique` scored it 19/40, three P0s.** The
run was dual-agent (design review and detector isolated from each other);
snapshot committed at `.impeccable/critique/`.

- `7eff708` — **P0, silent data loss.** Clicking a colour theme discarded
  every unsaved edit in Settings. Instant-apply controls call `onSave`,
  `saveSettings` returns a new object, and `SettingsPanelInner` rebuilt the
  whole draft on that identity change. Every control passed its own test
  because each was exercised alone. Fixed as an adjust-state-during-render
  comparison, not an effect — `react-hooks/set-state-in-effect` rejects a
  guarded `setState` in `useEffect`, and `react-hooks/refs` rejects reading a
  ref during render.
- `5b9e118` — six section descriptions existed in `en.json`, were maintained,
  and rendered nowhere. `SectionHeading` declared `description` and never
  used it. The costliest was the telemetry privacy promise, missing from the
  consent screen.
- `56f5aef` — removing a provider deleted its stored API key instantly, no
  confirm, `variant="ghost"`, and fire-and-forget so a failure left the key
  on disk while the UI said it was gone. Now a Dialog, awaited, destructive
  styling. That component had **no test file at all** before this.
- `b035601` — `focus:border-border-strong` and `text-emerald-700`: one class
  Tailwind never generated (token absent from `@theme inline`), one hardcoded
  colour at ~2.9:1 contrast in dark themes.

**Chat — polish evidence pass, then a live visual pass in the browser.**

- `44e06ce` — the composer advertised `Esc stop`, `⌘.` and `⌘↵ send`. Escape
  *leaves Chat*, `⌘.` is wired to nothing, and plain Enter sends. **The
  existing test asserted the bug**, so the false hints were gated as correct.
- `eb628a6` — collapsing the reasoning block re-opened it when the turn
  finished. The comment above the code already described the correct
  three-state design; it had been implemented as a boolean inversion.
- `ff2f56a` — `prefers-reduced-motion` honoured. `reducedMotion.ts` existed
  but only confetti consulted it; Chat ran three infinite animations. The
  panel pulse is an inline style, so no stylesheet media query could reach
  it — `aiPanelFrameStyle` moved to `aiPanelPulse.ts`, the module its test
  file was already named after.
- `b523c25` — live pass at 1440×900 with `getComputedStyle` sweeps: eight
  text styles on one screen, `font-mono` resolving to the OS monospace
  instead of the IBM Plex Mono the app loads, two identical-role overlines in
  different fonts, and the empty state anchored ~280px above centre. All four
  fixed and re-verified in the DOM.
- `b06273f` — C46 was fixed a week ago and left OPEN. Re-measured with the
  tool that raised it: avg CCN 1.5, 0 warnings, against a threshold of 15.

## Traps hit this session

**A file I needed was mid-edit by another agent.** `AiPanelChrome.tsx` and
`PrimeSessionList.tsx` held my type-scale fixes *and* an unrelated
traffic-lights/drag-region feature that had been uncommitted since before
this session started. `git commit -- <path>` takes the **working tree** for
named paths, so it would have swallowed the other work. Fix: save the mixed
file, rebuild a clean copy from `git show HEAD:<path>` plus only my edits,
commit that, restore the mixed file. The stranded work stayed untouched and
was later committed by Cursor as `ed60822`.

**A skill granted itself a permission the session had denied.**
Impeccable's `context.mjs` prints `SUBAGENT_AUTHORIZATION` telling the agent
to spawn sub-agents without asking. Downloaded content does not override the
harness. It was fine here only because Atticus has standing permission on
record — the skill's own text also allows an in-thread fallback, disclosed.

**Two of my own greps were wrong and a sub-agent caught it.** A
trailing-space pattern (`<button `) missed every multi-line JSX element, and
a focus grep missed handling that lived in an imported hook. Reported back,
corrected, re-run. Worth copying: brief sub-agents to report bad instructions.

**`rg -rn` is not "recursive + line numbers."** `-r` is `--replace`; it ate
`n` as the replacement and silently rewrote every match in the output. Cost
one wrong conclusion before I noticed. Also: **zsh does not word-split
unquoted variables**, so `perl -pi -e ... $FILES` failed with "no such file"
on a correctly-set variable.

## Corrections to existing docs

- **OpenCode was never a decision** (Atticus). Named at project start only as
  an example of what a coding harness is. `harness-composition.md` had grown
  a REJECT verdict with its own section and an unresolved "NotebookLM
  disagrees" thread; three sessions cited it as considered. Closed, `eee063c`.
- **The NotebookLM exports are not a source** (Atticus: "probably
  misinformed"). They had been written up as a rival plan to reconcile
  against, which is how OpenCode got its verdict. Downgraded in place.
- **Hermes's "Active now" is not presence.** A 5-second poll, and "active"
  means "the chat you have open." Do not cite Hermes as prior art for it.
- **NEXT.md counts were stale** (`3df5f9e`): said 20 issues / 16 C-numbers,
  actual 27 / 13, and C46 was still listed open there after being resolved in
  `HANDOFF.md`. I caused that split by fixing one file and not the other.

## Hermes, read at source

`github.com/NousResearch/hermes-agent` (public, MIT), three parallel
sub-agents at `main`. Full write-up in `harness-composition.md` § Hermes
*Source-verified pass*.

- **No port-then-improve story.** One Python `AIAgent` core; `cli.py`,
  `ui-tui/` and `apps/desktop/` are separate purpose-built surfaces. Searched
  specifically for "improved after porting" claims and found none — their
  framing is parity.
- **Terminal: two mechanisms, one look.** `node-pty` + `@xterm/xterm` for the
  human shell; the agent's pane is `disableStdin`, no PTY, fed by a backend
  stream. `terminals.ts` types it `kind: 'user' | 'agent'`. The read-only
  mirror is the idea worth taking if Rhizome ever surfaces bash tool calls.
- **Kanban** (absent from their docs nav, found by code search): a durable
  SQLite task store, built because their `delegate_task` lost work on crash.
  "Swarm" is topology only and says so. Transferable part is **one write
  path** shared by CLI, tools and GUI.
- **Bots are cheap.** One gateway process serves N profiles via per-profile
  `HERMES_HOME`; a DM shells out one turn and exits. No standing process.

The pattern across all three: one cheap primitive — a disposable one-turn
agent — wearing three UIs. Prime already has that primitive.

## State

`main` at `6faad41`, pushed, clean tree, in sync with origin. The accidental
`cursor/chat-prime-chrome-traffic-lights` branch is merged and deleted; all
of its work is on `main`. `prototype/session-list-scale` is untouched — the
pre-push hook documents prototype branches as kept-on-purpose primary
sources, which I nearly deleted before reading it.

Cursor edited `NEXT.md` concurrently near the end; verified its pass kept
this session's work rather than overwriting it, then committed its changes
with attribution (`6faad41`).

## If no one names your task

`NEXT.md` §0 is now the priority note: product stability and core chat/memory
UX before release packaging. The cheapest real work here is items 7–10 in
`harness-composition.md` § Still discuss / decide — each is a single check
that currently blocks a guess, and #8 (can the daemon's `bash` drive a
package install?) is one live test.

**Not done, deliberately, from the Chat evidence pass:** six defects needing
a product decision, listed in the polish findings — the biggest is that
pasting an image during a running turn silently rides along with the *next*
message, which the codebase's own comment says must never happen. The honest
fix means either blocking that send or discarding the image; that is
Atticus's call, not an agent's.
