---
session: 2026-09-20T04:38-05:00
model: Composer (Cursor)
description: >-
  Sessions-only rail and reasoning history strip landed as 4f9b4c4.
  /Applications remains 6860762. Pickup plan covers CPR, thinking/no-answer,
  and public-install dogfood.
commits: 4f9b4c4
---

# Rail + reasoning + harness pickup — 2026-09-20

**Origin:** Composer · Cursor · rhizome-agent.

## True right now

| Item | Value |
|---|---|
| Product commit | **`4f9b4c4`**; planning commit follows it |
| Packaged app | Still **`6860762`**, installed 2026-09-19 11:27 — **behind** `main` |
| Working tree | Clean after the product and planning commits |
| Windows | Out of scope for ship (Atticus) |
| `import_jsonl` | Still waits for Atticus to type **`1`** |
| ADR-0168 / #56 | Design intent only; do **not** cite as settled |

`docs/NEXT.md` also has a parked TraderAlice row from earlier; leave it unless
asked to commit alone.

## What landed on origin already (`dc44d84`)

Pushed earlier in this long chat (not this morning’s dirty tree):

- Command rail: compact lock (“Keep as rail”), footer Settings/Pin without
  hover-expand stealing the click
- Session list: Filter + Sort, denser rows, git branch on the meta line
- Changes moved to the right Notes panel (Inbox / All Notes / Archive)
- Mycelium: light `:root` tokens, compact readable card, Evaluate login
  sentence + Claude/Codex judge list (Codex disabled when missing)
- Hide Chat on Notes; one-job Cursor rule; ADHD packing off outside Cursor
  (Hermes memories → STE-100)

## Product slice landed as `4f9b4c4`

### Sessions-only left rail

- **Removed** Chat and Research destination buttons from `CommandRail`
- Rail = **sessions list** (expanded) + Settings gear + pin
- Research opens from **`status-research`** (status bar) and the command
  palette; Settings duplicate stays hidden when the rail is active
- Exit copy is **“Back to chat”** on Research / Graph / Mycelium
  (`research.exit`, `graph.exit`, `mycelium.close` in `en.json`)
- Graph exit now calls `handleRailSelectChat` (leave canvas), not the graph
  toggle
- Smoke ready markers use `chat-center`, not `command-rail-chat`

### Reasoning fold

- `normalizeReasoningDisplay` strips echoed `<conversation_history>…</…>`
  blocks (display-only; not persisted)
- If nothing remains after strip, AiMessage **hides** the Reasoning control
- **Atticus:** click-to-expand real thinking stays important; disable path is
  composer thinking pill → **Off** (do not add a second “hide reasoning”
  preference unless he asks)

## Agent harness — where we stand

Prime is still the only chat engine (daemon client). Spoken surface: attach /
prompt, sessions, model + thinking, goals/schedules, packages hub, vault
skill seed. Snapshot: `docs/prime-adapter-surface.json` (Prime **0.9.3** on
this machine). Re-check with `pnpm prime:surface`.

**Working enough for Atticus daily drive on a current build, not stranger-
ready.** Known harness gaps:

1. **Thinking budget vs answer** — High / loud thinking on weak models
   (e.g. DeepSeek Flash) can dump salad or echo prompt history into the
   thinking stream, then fail to produce a clean reply. Off is the safe
   picker for Flash. Needs a live sample + product call on default level
   (do not globally force Off).
2. **Session titles** — rail rows can still show raw
   `<conversation_history>` blobs; Mycelium compact labels unwrap, list
   titles often do not.
3. **#46** — Chat without a vault must not scope tools to `$HOME` / whole
   disk; live check, not units alone.
4. **#41** — steer/queue source wired; live W4 not closed from units.
5. **#56** — second provider path undecided; do not delete providers.
6. **C64** — Prime install flash on first second of launch; weak verify only.
7. **Packages** — Settings → Packages is the Pi catalog; a rail shortcut
   was brainstormed, not built. Automations / kanban on the rail: later,
   when each is a real screen.

Skill manners (answer first, CLI not IPython, stop after one env error)
landed in the hybrid PATH work on `6860762` / later commits — see CPR
handoff [1127](2026-09-19-1127-cursor-grok-4-6-cpr.md).

## Ideas shelf (parked product shape)

| Idea | Status |
|---|---|
| Sessions-only rail; Research off rail | **Landed in `4f9b4c4`** |
| Packages / skills shortcut on rail → Settings Packages + market link | Parked brainstorm |
| Automations / kanban on rail | Later — empty icons no |
| Vault pop-out | Parked earlier |
| Portfolio / Today / idle overview | W11 cards — not UI |
| Selective harness doctrine as fact | Blocked on #56 |

## What the next agent should plan / tackle

**Preferred order** (Atticus can reorder with “now”):

1. **Rebuild** only if Atticus wants the installed app to match source.
   CPR is three separate verbs, and commit plus push are complete.
2. **Live dogfood on the new build:** one turn, thinking Off on Flash or a
   stronger model; confirm Reasoning fold shows real thought, not history;
   confirm Research from status bar and Back to chat.
3. **Thinking / silent no-answer** — reproduce with a named model + level;
   decide default thinking policy (product call). Display strip is already
   in `4f9b4c4`.
4. **Public-install bar (most → least):** honest first minute if Prime
   missing (C64); one live turn + note save; #46 live; stranger install
   note (install Prime, log in, open Rhizome, starter vault, one message);
   live steer/queue (#41); #45 remainder; human session titles; Prime/Node
   bundle later; #56 one sentence later.
5. Do **not** start Windows packaging. Do **not** merge #66. Do **not**
   enable list `import_jsonl` without **`1`**.

## Test notes

Focused green this session: CommandRail*, leftover-research-rail,
StatusBar research visibility, normalizeReasoningDisplay, AiMessage
history-hide, parked-organs pin/research locks, App Research-from-status
tests. The push gate ran before publication.

## Hard nos (unchanged)

- Wrong tree / Desktop branding
- English-only / no `en.json` migrations (C18) — exit label *value* edits
  for “Back to chat” are OK
- ADHD packing / telegraph voice
- Cite ADR-0168 as decided until #56 resolves
