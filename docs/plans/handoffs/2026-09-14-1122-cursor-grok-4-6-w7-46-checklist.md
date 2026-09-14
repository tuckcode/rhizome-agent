---
session: 2026-09-14T11:22-05:00
model: Grok 4.6 (Cursor)
description: >-
  W7 #46 close checklist. Local harden 4416411. Do not close.
  normalize_cwd("") stays. Added Rust symlink-HOME / tilde tests.
commits: none
---

# W7 / #46 close checklist — 2026-09-14 11:22

**Origin:** Cursor Grok 4.6 · W7 remainder · local `4416411`
**Issue:** [#46](https://github.com/tuckcode/rhizome-agent/issues/46) still **OPEN**.
**Do not close.** Do not invent a Prime sandbox. Do not edit global Prime settings.

## Plain status

The code now refuses the home folder (the whole user directory) as a vault,
including a shortcut that points at it. Chat with no vault still works because
Prime’s working folder can be home. That is **not** the same as giving vault
tools the whole home tree.

Close only after a live Chat-without-vault check. Source tests are not enough.

## Keep this

`normalize_cwd("")` in `src-tauri/src/prime_session_host.rs` must stay.

Empty vault path → Prime cwd is `$HOME`. That is Chat-without-vault.

It is **not** MCP (vault-tool) scope. Seed, MCP, and `vaults.json` already
refuse HOME. Do not “fix” cwd by inventing a sandbox or rewriting Prime’s
global `~/.prime/agent/settings.json`.

Covered by `normalize_cwd_falls_back_to_home_for_blank_paths`.

## Already landed (local `4416411`, not on origin)

- JS `isHomeVaultPath` uses `realpathSync` (follows shortcuts).
- Rust `is_home_directory` canonicalizes both sides.
- `save_vault_list` / MCP / ws-bridge drop HOME roots.
- Scrub removes only a Rhizome-written global `rhizome-vault` skill
  (`cli-call.mjs` + `rhizome-vault` in `SKILL.md`). User-authored stays.
- Scrub errors log `#46:` and do not rewrite Prime settings.

God-plan review leads against this tree: **fixed in `4416411`**. Close is
still the live check.

## Automated coverage

**Already there (do not rerun cleanup on real `$HOME`):**

- JS: `refuses $HOME as a vault path`, `refuses a symlink that resolves to $HOME`
- Rust: `the_home_directory_is_never_a_vault`, `save_refuses_the_home_directory_as_a_vault`
- Rust fixtures: `a_rhizome_vault_skill_in_prime_global_skills_is_removed`,
  `a_user_authored_global_skill_named_rhizome_vault_is_left_in_place`

**Added this session (path compare only; no scrub on real HOME):**

- `prime_vault_skill.rs`: `a_symlink_to_the_home_directory_is_never_a_vault`
- `vault_list.rs`: `save_refuses_a_symlink_to_home_as_a_vault`,
  `save_refuses_tilde_home_as_a_vault`

**Hygiene leftover:** `seeding_the_home_directory_is_refused` still calls
`seed_vault_skill($HOME)`, which always attempts the real-HOME scrub first.
New tests must not copy that. Prefer `looks_like_vault` / fixture
`scrub_global_rhizome_vault_skill_at`.

## Close checklist (live)

Record **PASS / FAIL / NOT RUN**, revision, and the actual app path.

Do now:

1. **Chat without a vault.** Open Chat with no vault attached. Send one
   turn. Chat must work. Prime cwd may be `$HOME`. That is expected.
2. **No global skill returns.** After that connect, confirm
   `~/.prime/agent/skills/rhizome-vault` is absent, or is a user’s own
   file (no `cli-call.mjs` + Rhizome body). A generated copy coming back
   is FAIL.
3. **Prime settings untouched.** `~/.prime/agent/settings.json` must not
   gain `mcpServers.rhizome` with `VAULT_PATH` = `$HOME`. Snapshot mtime
   or a copy **before** the check. Do not edit that file to “pass.”
4. **MCP refuses HOME.** Explicit `$HOME`, `~`, and a temp shortcut to
   `$HOME` must error. Nested vault under home must still work.
5. **Fixtures only.** Any scrub/seed cleanup uses a temp folder. Never
   `rm` or scrub the real `$HOME` tree to clean a test.

Later (not close-blockers if 1–3 pass):

- Push `4416411` (integration owner). Installed app is still `476756c`.
- Do not treat `/` or `/Users` as the #46 bug. That was never the report.
- Windows HOME aliases: blocked (no Windows box). C42 / #32.

## Stop

- Do not close #46 from this file or from unit tests.
- Do not change `normalize_cwd("")`.
- Do not invent a Prime sandbox.
- Do not change global Prime settings to make a check pass.
- Do not mass-delete skills by folder name.

## W1 fragment

- **Changed:** close checklist + Rust symlink/tilde HOME tests.
- **Revision:** working tree on top of local `4416411`. Origin still
  `5c629a0` at pickup.
- **Evidence:** five focused Rust tests passed, including the two new
  symlink cases and the existing user-skill preserve fixture.
- **Blocker:** live Chat-without-vault still **NOT RUN**. #46 stays open.
