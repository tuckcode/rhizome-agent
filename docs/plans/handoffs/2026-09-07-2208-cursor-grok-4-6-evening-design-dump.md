---
session: 2026-09-07T22:08-05:00
model: Cursor Grok 4.6
description: >-
  Parked evening design dump (no UI). Portfolio-on-boot, vault as skill/memory
  home, no CC Switch in product, STE sync must not drift. Chat ↔ Prime still first.
commits: none
---

# Evening design dump — 2026-09-07

**Origin:** Cursor Grok 4.6 · Atticus ramble, then “make sense of these notes.”
**Not built.** North star stays Chat ↔ Prime. Do not rebuild `/Applications`
over a live app.

Reopen this file. `docs/NEXT.md` only indexes it.

## Hard no

- Do not add Hermes `kanban.db`.
- Do not invent the briefing. Bind to real git / vault / session facts.
- Do not expand two big overlays at once.
- Do not hover-open top or bottom overlays (TV above the monitor).
- Do not port **CC Switch** into Rhizome Agent or Prime. Take copy/symlink +
  backup as an idea only.
- Do not let the memory-updater own voice. STE lives in the vault, then sync.
- Do not let vault source and tool copies **drift**. That already happened
  tonight (`mode` was `ste`, `sync-voice.sh` still only knew `adhd`/`normal`).

## Product UI (parked)

**Boot:** Chat shows a **portfolio overview** of projects touched in about
the last two weeks, plus **pinned** projects that stay longer. Composer stays.
Not a blank “start chatting” screen. A **small** “start a conversation” hint
can sit **just above the composer** (same style or a light redesign), not
dead-center.

Replies push the overview up. It docks to a thin **Today** strip (~left-rail
height, click to open). Settings can hide the strip. Board launcher is a
separate centered rising panel (hotkey too). One big extra surface at a time
(same family as Graph only on Changes, ADR-0170).

**Launcher:** one small control, bottom bar, middle-right, opens up like the
vault menu. Neighbors: board, scheduled work, in-flight. Idle/working stays on
the composer.

**Cards:** vault notes with `status`. App draws columns later
(`presentation.type: board`, ADR-0144). Human work = vault notes. Agent work
= a view over Prime sessions.

**Lint:** every other night, report only (`rhizome_lint` + intake when due).
No auto-delete.

**Theme:** keep the corner light/dark icons. Color skins stay in Settings.
Later polish only.

**Windows:** Mac is the daily drive. First public **may be Mac-only**. Last
check: Windows unbootable (`C42`). Keep Windows *paths* in tooling. No
combined Mac+Windows polish plan.

## Instruction architecture (parked)

**App** = coding tool (Cursor, Claude Code, Codex, Hermes), not a git repo.

1. **Vault `agents/shared/`** — voice, learned prefs that apply everywhere.
2. **Repo `AGENTS.md`** — product rules for *this* tree only. The ~560-line
   file is the Cursor tax. Later: audit living docs for stale/false claims.
3. Tools only auto-read **must-load** files. Pointers often lose. Sync
   **copies** into those files. That is why Atticus over-copied `AGENTS.md`.

**Learned bullets:** keep the job (durable prefs/facts). Steal from Cursor’s
continual-learning plugin: after a Session, incremental index, two buckets,
cap, dedupe, skip secrets. Writer should target the vault, then sync. The
plugin itself is Cursor-only, not Prime, not Rhizome.

**Reply shape:** STE-100 is the voice. Useful short-reply quirks (answer
first, short blocks, stop then offer more) may fold into `voice-ste.md` later.
Do not reinstall the ADHD plugin into this repo.

Speech-to-text odd spellings: infer for now. Temporary. Overrides / learned
words / digits (`23`) will replace that note.

## Rhizome as harness: vault holds skills

Prime today seeds a skill under
`<vault>/.prime/agent/skills/rhizome-vault/`
(three folders: `.prime` / `agent` / `skills`). Hidden from the wiki.

Atticus: **Rhizome should be the harness that uses the vault we already made.**
Skills, memory, and “all the above” live as vault files (markdown first; the
vault can hold other files). Searchable. One place. Saves context vs pasting
the same block into ten `AGENTS.md` files.

Prime stays the engine. It may **read or link** those vault files. It does
not become a second home for them. Do not copy CC Switch’s SQLite store into
the product.

CC Switch on this Mac already copies skills into Claude/Codex/Hermes. Cursor
is not in that app list. Keep using it as a **coding-tool** helper if useful.
Do not make it the brain.

## Live drift (must not return)

Vault `agents/shared/mode` = `ste`. Sync must copy `voice-ste.md` into
`~/.cursor/AGENTS.md`, `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`. If those
diverge, the next session follows the wrong voice.

## Not tonight

No kanban UI. No briefing UI. No CC Switch port. No instruction-sync rewrite
beyond stopping the STE drift. Chat ↔ Prime first.
