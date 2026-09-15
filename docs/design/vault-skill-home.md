# Vault as skill / memory home

**Status:** parked harness idea. Structured from 2026-09-07 dump. Not a second Prime.  
**Origin:** Atticus · evening dump. Indexed in `NEXT.md` §0.  
**Pickup:** [`BOARD.md`](../BOARD.md).

---

## Done / now / next

- **Done:** Prime seeds `<vault>/.prime/agent/skills/rhizome-vault/` (three hidden folders). Continual-learning plugin mines Cursor chats into **this repo’s** `AGENTS.md`.
- **Now:** Atticus wants skills + shared agent memory in the **vault we already made**.
- **Next:** one source in the vault, **sync copies** into must-load files. Prime stays the engine and may read or link those files.

**Done when:** a skill or learned bullet has one vault path, and Cursor / Claude Code / Codex / Prime Chat actually load it without pasting the same block into ten `AGENTS.md` files.

---

## Problem-theory (world)

Tools only auto-read **sacred files**:

| Tool | Must-load |
|---|---|
| Cursor | `~/.cursor/AGENTS.md` + repo `AGENTS.md` |
| Claude Code | `~/CLAUDE.md` then what that chain names |
| Codex | `~/.codex/AGENTS.md` |
| Prime in Chat | vault / Prime **skills**, not those files |

A pointer (“go read the vault”) often loses. A **copy** into the sacred file wins. That is why Atticus over-copied `AGENTS.md`.

---

## Instruction architecture (parked)

**App** = coding tool (Cursor, Claude Code, Codex, Hermes), not a git repo.

1. **Vault `agents/shared/`** — voice, learned prefs that apply everywhere.
2. **Repo `AGENTS.md`** — product rules for **this tree** only (~560 lines is the Cursor tax).
3. Sync **copies** into must-load files (`sync-voice.sh` already exists).

STE stays in the vault. **Do not copy voice skills into this tree.**

---

## Learned memory (Cursor continual-learning)

Keep the **job** (durable prefs vs facts, incremental transcript index).
In this repo it may write **only** the empty-by-default Learned
sections in `AGENTS.md`, under the **Continual-learning** guard there
and [`.cursor/rules/continual-learning.mdc`](../../.cursor/rules/continual-learning.mdc).

Default is write nothing. No mega-bullets. No SHAs, clocks, billing, or
session chore lists. Session truth stays in HANDOFF / BOARD / handoffs.

STE / voice stays in the vault (`agents/shared/`), then sync. Do not
copy voice skills into this tree.

Live bug recorded 2026-09-07: vault `mode` was `ste` but `sync-voice.sh`
only accepted `adhd`/`normal`. That class of silent skip must not return.

---

## Prime’s hidden skill folders

Today: `<vault>/.prime/agent/skills/…` (`.prime` / `agent` / `skills`). Hidden from the wiki.

Atticus: Rhizome should house skills and shared memory **as vault files** (markdown first; other files allowed). Searchable. One place.

Prime may **read or link** those files. It is not a second home. Do not copy CC Switch’s SQLite (`cc-switch.db`) into the product.

**CC Switch** on this Mac is a coding-tool copier. Take copy/symlink + backup. **Do not implement CC Switch in Rhizome Agent or Prime.**

---

## Doctor-door (parked, thinner)

While you wrap up, a helper hangs the chart on the door. You stay in the loop. The next agent walks in and the note is already there.

That is closer to Claude Code’s handoff skill than to `@` a file. Suggestions (Grok, not decided) live in the 2208 dump. Do not treat `@` as the idea. Do not hang the 560-line repo `AGENTS.md` on the door.

---

## Hard no

- Do not port CC Switch.
- Do not let the memory-updater own voice.
- Do not let vault source and tool copies drift.
- Do not reinstall the ADHD plugin into this repo (sibling owns Cursor User Rules / `~/CLAUDE.md` for that hybrid).
- Personal reply-voice skills stay out of `tuckcode/rhizome-agent`.

---

## First build slice (when claimed)

1. Name the vault paths (`agents/shared/` for prefs/facts; skills as notes, not only `.prime/...`).
2. Point Prime at those paths (link or seed), without a second store.
3. Drift check: sync fails if `BEGIN:voice` in a sacred file does not match `voice-{mode}.md`.

Completion: one note in the vault appears as a Prime skill **or** a loaded Cursor/Claude instruction after sync, without a manual paste.
