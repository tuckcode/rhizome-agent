# `rhizome-ship` skill — three verbs

**Status:** authored 2026-09-14 as `.cursor/skills/rhizome-ship/SKILL.md`.
`.gitignore` allow-lists that folder (was swallowed by `.cursor/*`).
Not auto-commit. Three verbs only.  
**Origin:** Atticus · BOARD “Ideas in the ring” + `AGENTS.md` Learned User Preferences.  
**Pickup:** [`BOARD.md`](../BOARD.md).

---

## Done / now / next

- **Done:** ship rules written (private, solo, local pre-push is CI).
- **Now:** skill exists. Invoke by saying `commit`, `push`, or `rebuild`.
- **Next:** use it. Do not invent a fourth verb.

**Done when:** `commit`, `push`, and `rebuild` are three separate invocations, each with a checkable stop.

**Stamped 15:32:** skill still three verbs. `git add -n .cursor` still
ship-skill only. Do not rebuild `/Applications` this window.

---

## Why

Atticus ships this private repo himself. Agents already know `git commit` / `git push` / rebuild `/Applications`. They mix the three. Rebuild when he is not going to use the packaged app wastes ~minutes and fights the live app (same bundle id).

---

## Verbs

| Verb | Does | Does not |
|---|---|---|
| **commit** | Stage intended files. Commit with a why-message. Run repo hooks. | Push. Rebuild. `--no-verify`. Amend unless the usual amend rules hold. |
| **push** | `git push` to `tuckcode/rhizome-agent` after pre-push passes. | Skip hooks. Force-push main. Add remotes. Buy CI. |
| **rebuild** | Quit the installed app if needed, then package into `/Applications/Rhizome Agent.app`. Delete leftover `.app` copies. Stamp HANDOFF/BOARD with commit + time. | Rebuild “while we’re here.” Vite/`pnpm tauri:dev` is not this verb. |

Commit, push, and rebuild stay **three jobs**. Rebuild only when he will use the packaged app.

---

## Ship rules (copy, do not reinterpret)

Source of truth: `AGENTS.md` Learned User Preferences + [`BOARD.md`](../BOARD.md) Ship rules.

- Stays private, solo → local pre-push is CI. No GitHub Actions, Chunk, Codacy cloud, CodeScene.
- Repo goes public → then Actions can be free.
- A human joins → then branches, split-to-PRs, review.
- Apple Developer Program (~$99/year) is the only paid thing he may buy later. Not now.
- Never `--no-verify`.
- `knispo/rhizome` is never a remote here.

---

## Environment (look it up; do not cache)

- Push lanes: `AGENTS.md` Commits & pushes (LLVM helpers, Playwright cache).
- Packaged app path: `/Applications/Rhizome Agent.app`.
- Quit first: `osascript -e 'tell application id "ai.rhizome.agent" to quit'` — ask before quitting; it may hold unsaved chat/note state (C65).
- Agent `git push` can fail in a sandbox because Playwright looks in a sandbox browser cache. Retry outside the sandbox, or push from Terminal.

---

## Skill shape (when built)

Location: a **coding-tool** skill (Cursor/Claude), not a Prime product skill, unless the God plan says otherwise. Do not copy STE/voice into this repo.

Each verb’s completion criterion:

1. **commit** — `git status` clean for the intended files; `git log -1` is the new commit.
2. **push** — `git status` shows in sync with `origin/main` (or ahead only if push was not requested).
3. **rebuild** — `/Applications/Rhizome Agent.app` mtime/commit matches HEAD; HANDOFF State line updated.

---

## Out of scope

In-app Rhizome updater (`app_updater.rs` stub). That is a different product path: [`handoffs/2026-09-07-0000-composer-in-app-update-path.md`](handoffs/2026-09-07-0000-composer-in-app-update-path.md).
