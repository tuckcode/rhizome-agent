---
name: rhizome-ship
description: >-
  Runs Rhizome Agent ship as three separate verbs: commit, push, and
  rebuild. Use when the user says commit, push, rebuild Applications,
  ship, or rhizome-ship. Never combine the three. Never --no-verify.
---

# rhizome-ship

Three jobs. One verb per invocation. Spec:
[`docs/plans/rhizome-ship-skill.md`](../../../docs/plans/rhizome-ship-skill.md).

This is a **coding-tool** skill. Not a Prime product skill. Do not copy
STE / voice files into this tree.

## Hard stops

- Never `--no-verify`, `--no-gpg-sign`, or force-push `main`.
- Never add `knispo/rhizome` as a remote.
- Never `git add -A` / `git add .`. Stage **named paths**. Commit with
  `git commit -- path/a path/b`.
- Never rebuild `/Applications` unless the user said **rebuild** and
  will launch the new app.
- Never invent a fourth verb (no `ship`, no `release`, no auto-commit).
- Co-author trailer on agent commits. Human commits need none.

## Which verb

| User said | Run |
|---|---|
| commit / save the work | **commit** only |
| push / get it off this machine | **push** only (after commits exist) |
| rebuild / install the Mac app | **rebuild** only |

If they said two words, do the first, stop, then ask or wait for the
second. Do not chain them “while we are here.”

---

## 1. commit

1. `git status --short` and `git diff` / `git diff --staged`.
2. Stage only the files this session owns, by name.
3. `git commit -- path1 path2` with a why-message (`feat:` / `fix:` /
   `docs:` / `test:` / `refactor:`).
4. Agent trailer:

   ```
   Co-Authored-By: <Model Name> <noreply@example.com>
   ```

5. If the hook edits files, make a **new** commit. Do not amend unless
   the usual amend rules all hold (this commit is HEAD, unpushed, you
   authored it, user asked or the hook only rewrote yours).

**Done when:** `git log -1` is the new commit. `git status` is clean for
the intended files. Did **not** push. Did **not** rebuild.

---

## 2. push

Origin is `https://github.com/tuckcode/rhizome-agent.git` (private).

1. Confirm there are local commits to push:
   `git log --oneline origin/main..HEAD`.
2. `git push` to `origin`. Pre-push is the CI. It sets LLVM tools on
   macOS when unset. On a PR branch, push it to the origin branch with
   the same name. The hook refuses any other name (ADR-0181). Do not
   merge the PR.
3. If Playwright fails on a sandbox browser cache, retry **outside**
   the sandbox. That is not a reason to skip hooks.
4. Never force-push main. Never buy CI.

**Done when:** `git status` shows in sync with `origin/main` (or with
the origin PR branch), or still
ahead only if the push was refused and you reported why.

---

## 3. rebuild

Only when the user will **use** `/Applications/Rhizome.app`.

1. Ask before quitting a live app — it may hold unsaved chat/note
   state (C65). If they already said rebuild and the app is open:

   ```bash
   osascript -e 'tell application id "ai.rhizome.agent" to quit'
   ```

2. If `/Applications/Rhizome Agent.app` is still installed, move it to
   an archive folder. Do not delete it. Both apps must not stay
   installed, or Spotlight can open the old binary.

   ```bash
   mkdir -p ~/Documents/Rhizome\ archives
   mv "/Applications/Rhizome Agent.app" ~/Documents/Rhizome\ archives/
   ```

3. Remove leftover `*.app.bak` copies so Spotlight cannot open the
   wrong binary.
4. Package into `/Applications/Rhizome.app` using this repo’s
   documented Tauri build path (`pnpm tauri build` / the ship docs
   in `AGENTS.md`). Vite / `pnpm tauri dev` is **not** this verb.
5. Add a ship note under `docs/plans/handoffs/` and stamp `docs/BOARD.md`
   with the new commit + install time. Keep three SHAs: origin, local, app.
   Do not append a line to `docs/HANDOFF.md`.

**Done when:** the installed app’s commit/mtime matches the intended
HEAD, leftovers are gone, and living docs name the new app SHA.

---

## Environment (look up; do not cache)

- Push lanes and LLVM: `AGENTS.md` Commits & pushes.
- App id: `ai.rhizome.agent`.
- Installed path: `/Applications/Rhizome.app`.
- Archive an older `/Applications/Rhizome Agent.app` before install;
  do not delete it.
- Ship rules: `docs/BOARD.md` “Ship rules”.
- In-app updater (`app_updater.rs`) is a **different** path. Not a
  fourth verb.
