---
session: 2026-09-07T22:48-05:00
model: Cursor Grok 4.6
description: >-
  Parked evening design dump plus later ramblings (doctor-door handoff,
  vault as skill home, no CC Switch in product). Grok suggestions tagged.
  No UI. Chat ↔ Prime still first.
commits: none
---

# Evening design dump — 2026-09-07

**Origin:** Cursor Grok 4.6 · Atticus ramble, then “make sense of these notes.”
Later ramblings through ~22:48. **Not built.** North star stays Chat ↔ Prime.
Do not rebuild `/Applications` over a live app.

**Paper for tomorrow:** this file + the [2216 dock](2026-09-07-2216-cursor-grok-4-6-next-agent-paste.md)
(the chart). `docs/NEXT.md` only indexes them.

At dump close these were **local / uncommitted:** 2208, 2216, `docs/NEXT.md`
pointer. Origin last: **`2871fc3`**.

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
- Do not treat `@` a file as the doctor-door idea. He already does that.

## Product UI (parked)

**Boot:** Chat shows a **portfolio overview** of projects touched in about
the last two weeks, plus **pinned** projects that stay longer. Composer stays.
Not a blank “start chatting” screen. A **small** “start a conversation” hint
can sit **just above the composer** (same style, or a light redesign), not
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

**Theme:** keep the corner light/dark icons (sun/moon). Color skins stay in
Settings. Later polish only.

**Windows:** Mac is the daily drive. First public **may be Mac-only**. Last
check: Windows unbootable (`C42`). Keep Windows *paths* in tooling. No
combined Mac+Windows polish plan.

**Stuck-agent path (said, thin on paper until tonight):** when agents are
stuck, Mycelium (run footprint / time-lapse) plus a Graph that is actually
useful, **then** a better fullscreen toggle. Do not ship fullscreen before the
graph is useful. Do not put Graph back as the Chat canvas (ADR-0170).

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
Do not make it the brain. Do not implement CC Switch as a whole in the product.

## Live drift (must not return)

Vault `agents/shared/mode` = `ste`. Sync must copy `voice-ste.md` into
`~/.cursor/AGENTS.md`, `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`. If those
diverge, the next session follows the wrong voice. Taught `ste` to
`sync-voice.sh` and ran it tonight. Keep a check so it cannot silently skip.

## Doctor-door handoff (parked)

**Origin:** Atticus · 2026-09-07 22:48. Earlier “pin a file” / `@` read was
wrong. He already `@`s files. Do not build tonight.

**The picture:** a doctor’s office. While you wrap up, a helper shoots the
handoff note onto the **paper holder on the door**. You stay in the loop. The
next agent walks in and the chart is already hanging there. It does **not**
run the appointment without you.

That is closer to Claude Code’s handoff skill (a sub-agent **starts** the
next Session and leaves the note) than to `@` a path in a fresh chat. Smaller
than “go complete the work.” Cursor has no door-holder today. The 2216 dock
is the chart; the missing piece is hanging it on a named, waiting Session.

## Suggestions (Grok · not decided)

**Origin:** Cursor Grok 4.6 · 2026-09-07 22:48. Atticus asked for input.
These are options for tomorrow, not a build list.

1. **Two doors, same chart.** Coding-tool door ≠ Rhizome Chat door. Cursor /
   Claude Code / Hermes hang a vault file. Rhizome Chat later hangs a waiting
   Prime session. Same dock shape. Different hanger. Do not wait on Cursor
   to invent a pin button.

2. **Vault door that already works in Claude.** A single
   `Rhizome Vault/agents/shared/door.md` (overwrite each wrap-up). Claude’s
   `~/CLAUDE.md` step 0 already reads the vault. Add one line: “If `door.md`
   exists, read it before repo `AGENTS.md`.” Cursor pack gets the same line
   in `~/.cursor/AGENTS.md`. No new product. The helper’s only job is rewrite
   `door.md` + point at 2216/2208.

3. **Cursor door-holder v1 (if a create-chat tool exists later):** name the
   Session with the rename ritual (`rhizome-agent-<three-words>`), leave
   **one** first message: “Read the 2216 dock and the 2208 dump. Wait for
   Atticus.” Stop. No tools after that. You stay in the loop.

4. **Do not hang the 560-line repo `AGENTS.md` on the door.** Chart = dock +
   dump. Product rules stay in the repo file the agent loads when cwd is this
   tree.

5. **Drift alarm.** Sync should fail if `~/.cursor/AGENTS.md` inside
   `BEGIN:voice` does not match `voice-{mode}.md`. Tonight’s bug was silent.

6. **Graph useful first.** Mycelium footprint is already the run record.
   Make Graph answer “what is orphaned / dead / connected to this note”
   before a fullscreen toggle. Fullscreen on a weak graph is another overlay
   to kill.

7. **CC Switch stays a copier for CLI tools.** Prompts panel already writes
   `CLAUDE.md` / `AGENTS.md`. Fine as a sync engine. Vault markdown stays the
   source. Never SQLite as the wiki.

## Not tonight

No kanban UI. No briefing UI. No CC Switch port. No instruction-sync rewrite
beyond the STE sync fix already run. Chat ↔ Prime first. No doctor-door
feature tonight.
