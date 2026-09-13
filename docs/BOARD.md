# Session board — 2026-09-12 night

**Origin:** Cursor Grok 4.6 · 2026-09-12 · Atticus asked for one STE board of
the last two sessions: finished, found, pile, and ideas in the ring.

This is the picture. `HANDOFF.md` is still the daily index. `NEXT.md` is
still unclaimed work. Older parked design lives in the
[2026-09-07 evening dump](plans/handoffs/2026-09-07-2208-cursor-grok-4-6-evening-design-dump.md).

---

## True right now

- Origin `main` last stamped app: **`6908554`**, installed
  **2026-09-12 20:31** as `/Applications/Rhizome Agent.app`.
- Notes divider commit **`013481f`** is on origin. It is **not** in
  `/Applications` until a rebuild.
- Vite / mock-tauri is not the Applications vault.
- Prime on this machine: **0.9.3**.

---

## Finished (in the packaged app, `6908554`)

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

Also landed on origin tonight (not only this chat):

- PR **#65**: closed Notes rail matches the 46px left rail.
- Session-switch lag cut: clear transcript first; Settings provider
  status waits until Agents is open.

---

## Finished here, not in `/Applications` yet

- Notes inner divider is back (`--sidebar-border`) so the right panel
  has a clear edge.
- Sessions rail stays faint so Chat’s **pulsing green working strip**
  (`ai-border-pulse`) still reads.
- Learned memory: Packages hub, hide-on-close should stop Prime/MCP
  helpers, Tab Case 1 is shipped, Copy covers notes.

That is `013481f` on origin. Rebuild `/Applications` to see it.

---

## Found

- Matching Notes color to Sessions **dropped the visible inner line**.
  Atticus wants that seam. Keep it on Notes. Do not cover the left pulse.
- Close (red button) **hides** the window. **Cmd+Q** quits. That is
  C22. Prime/MCP helpers should stop after hide. The Rhizome process
  stays in the Dock until Cmd+Q. Atticus has not asked to make the red
  button quit.
- Agent `git push` from this environment can fail because Playwright
  looks in a sandbox browser cache. Retry outside the sandbox, or push
  from Terminal. Never `--no-verify`.
- DeepSeek Chat (other session) found Medium on a model that cannot run
  it. That filter is in the packaged app.
- Origin gained **#65** while this tree was local. Rebase dropped
  duplicate rail commits. The 32px hit-target fix stayed.

---

## Pile (do not start unless asked)

1. **C64** — first 2 seconds of Chat subhead, three times, on the new app.
2. **#47** — native confirm-close, then close the GitHub issue.
3. **#51 Case 2** — model-backed Tab suggestions (Case 1 is enough).
4. **C72** remainder — Inbox rename / discoverability. Rail polish
   belongs in a **new** ADR, not edits to ADR-0166 or ADR-0170.
5. Prime **session-list import** for Claude / Cursor / GPT / Hermes
   (vault `Imports/` writer exists; list rows do not).
6. Hide-on-close: actually **stop** spawned Prime and MCP helpers.
7. Rebuild `/Applications` if Atticus will use the divider tonight.
8. Grokbot leftover review (parked 2026-09-06).
9. Windows first boot (C42, last check unbootable). Not a Mac daily-drive
   gate.
10. Dirty file to leave alone:
    `docs/plans/handoffs/2026-09-12-1714-rhizome-deepseek-v4-flash-thinking-pill.md`.

---

## Ideas in the ring (talk, not a bill of materials)

From **tonight**:

- A `rhizome-ship` skill with three verbs: **commit**, **push**,
  **rebuild**. Not auto-commit.
- Keep local pre-push. Do not buy CI. See ship rules below.

From **2026-09-07 evening dump** (still parked, Chat ↔ Prime still first):

- Portfolio overview on idle Chat (last ~two weeks + pinned). Not a blank
  canvas. Docks to a thin Today strip. Click, not hover.
- Board / kanban = vault notes with `status`. App draws columns later
  (ADR-0144). No Hermes `kanban.db`.
- Bottom-bar launcher (board, scheduled work, in-flight). One extra
  surface at a time.
- Vault as the skill / memory home. Sync copies into must-load files.
  Continual-learning is a Cursor helper, not Prime.
- STE stays in the vault. Do not copy voice skills into this tree.
- No CC Switch in the product.
- Lint every other night, report only. No auto-delete.
- TokenJuice / NVIDIA router: design notes only.
- Living-docs audit for stale claims. Not a mass rewrite.

**Hard no (unchanged):** do not replace Chat. Do not invent the
briefing. Do not expand two big overlays at once.

---

## Ship rules (Atticus, 2026-09-12)

**Origin:** Atticus · private repo, solo, not paying for cloud gates.

| Situation | What to do |
|---|---|
| Stays private, solo | Local pre-push is CI. Do not add GitHub Actions, Chunk, or other paid CI. |
| Repo goes public | GitHub Actions can be free. Then pull requests make sense. |
| A human joins | Then branches, split-to-PRs, and review. Not before. |

Do not buy cloud minutes, Chunk, Codacy cloud, or CodeScene. The only
paid thing Atticus may buy later is the **Apple Developer Program**
(about $99 per year) for Mac distribution. Not now.

Commit, push, and rebuild stay **three separate jobs**. Rebuild only
when he will use the packaged app.

Detail: `AGENTS.md` Learned User Preferences.
