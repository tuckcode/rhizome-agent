# #57 — Delete code for users who do not exist

**Status:** spec. Do not mass-delete tonight.
**Stamped 15:30:** still no mass-delete. Live `~/Laputa` is data, not a ghost.  
**Origin:** Cursor Grok 4.6 · 2026-09-13 · GitHub [#57](https://github.com/tuckcode/rhizome-agent/issues/57)  
**Pickup:** [`NEXT.md`](../NEXT.md) First-run table. Issue body is 2026-08-29; some of it already landed.

---

## Plain answer

Old product names (Laputa, Tolaria) still sit in this tree. Some of that is **dead**. Some of it is **Atticus’s live data** under an old folder name. Deleting the second kind breaks the app he already uses.

---

## Already gone (do not re-delete)

- `migrate_views` — `view_migration.rs` is now only `is_view_definition_file`. Comment names #57.
- `config/agents.md` → root `AGENTS.md` move — repair leaves the old file where it is (`test_repair_config_files_leaves_a_legacy_file_where_it_is`).
- Launch no longer migrates `~/Laputa` (PR #62 / Area E).
- `migrate_legacy_cache` as a function — gone. The comment “Legacy cache path inside the vault” in `cache.rs` is leftover prose.

---

## Still live — and it is his data, not ghosts

| Thing | Why keep until renamed |
|---|---|
| `LAPUTA_CACHE_DIR` + `~/.laputa/cache` | **This is the current cache**, not a one-shot migrate. |
| `com.tolaria.app` / `com.laputa.app` in `app_config.rs` | Settings lookup still walks those folders. Check disk before dropping. |
| `@@TOLARIA_*` tokens in notes | Live markdown format. Not #57. |

Do not rename those in the same commit as deletions.

---

## Still live — safe to delete after a disk check

1. **`LAPUTA_` / `TOLARIA_` Getting Started env aliases** in `getting_started.rs` (C11 pin). Keep `RHIZOME_GETTING_STARTED_REPO_URL`.
2. **Test-only `TOLARIA_*` env names** (`shell_env.rs`, stdin probes, `TOLARIA_CUSTOM_KEY`). Cosmetic; closes C21 residue. One commit, tests retargeted.
3. **Settings shape migrations** — check `settings.json` on this machine first: `gemini` → antigravity, `release_channel: "beta"` drop, `zh-Hans` alias, ignored `gho_` GitHub token. Keep any that his file still needs.

---

## `is_a:` → `type:` — the leftover bug, already answered

`migrate_is_a_to_type` runs only on **Repair Vault**, not on vault open (`lifecycle_cmds.rs`). That is why `agents/claude/session-logs/2026-08-26 - Rhizome Agent live check and Mycelium skin.md` still has `is_a: Note`.

**Do not delete this migrator yet.** Next slice:

1. Convert that one vault file (or run Repair on the attached vault).
2. Confirm `find` across the real vault + demos returns zero `is_a:`.
3. Then delete `vault/migration.rs` and the Repair call.

---

## AGENTS.md line to add in the same commit as the first real deletion

Do not add a compatibility path for a stored value, filename, or env var without first checking whether any instance exists on disk.

**Done when:** GitHub #57 can close with a comment listing what was deleted vs what is still Atticus’s live path. Not a drive-by knip sweep.
