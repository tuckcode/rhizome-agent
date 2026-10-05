# #57 — Delete code for users who do not exist

**Status:** implemented in `cursor/issue-57-ghost-compat-3319`.
**Origin:** Cursor Grok 4.6 · 2026-10-05 · GitHub [#57](https://github.com/tuckcode/rhizome-agent/issues/57)

---

## `is_a:` root cause (verified in this tree)

`run_startup_tasks_for_vault` is gone. The rewriter `migrate_is_a_to_type` still
works, but until this slice it ran only from **Repair Vault**. Normal open uses
`list_vault` (cached scan). `reload_vault` is the empty-cache / force-refresh
path. That is why a leftover `is_a: Note` in a live vault could sit for days.

The leftover file named in the issue lives on Atticus's machine, not in this
repo. Do not invent vault content. The next open of that vault rewrites it.

`migrate_is_a_on_open` runs on a full rescan (`scan_vault_cached` with no
reusable cache) and from `reload_vault` / Repair. A warm cache hit does not
walk the vault again. Parser aliases for `is_a` stay so notes still read
until that open.

---

## Already gone before this slice

- `migrate_legacy_cache` (`.laputa-cache.json`)
- `migrate_agents_md` / `migrate_legacy_agents_file`
- `migrate_views` directory move (`view_migration.rs` is only `is_view_definition_file`)

## Removed or retargeted here

- `LAPUTA_CACHE_DIR` → `RHIZOME_CACHE_DIR` (test override). Default dir stays
  `~/.laputa/cache` — that is live data, not a ghost path.
- `TOLARIA_APPIMAGE_WAYLAND_PRELOAD_ATTEMPTED` → `RHIZOME_APPIMAGE_WAYLAND_PRELOAD_ATTEMPTED`
- Getting Started already ignores `LAPUTA_` / `TOLARIA_` repo URL names
- New notes write `type: Note` (`promoteChatToVault`, vault skill example)

## Settings migrations — kept

This VM does not hold Atticus's settings. Prior disk check (2026-09-18):
`com.tolaria.app/settings.json` still exists beside `com.rhizome.app`. Kept:

- `gemini` → `antigravity` (ADR-0147)
- `normalize_release_channel` (current validator; only `alpha` is a channel)
- UI-language alias table (current locale normalizer; C18 is English-only product)
- `gho_` in settings tests is ignored `github_token` load, not a live token path

`LEGACY_APP_CONFIG_DIRS` (`com.tolaria.app`, `com.laputa.app`) stays.

## Still live — not ghosts

- `~/.laputa/cache` default cache directory
- `@@TOLARIA_*` note tokens
- Frontmatter `is_a` *read* aliases until the one leftover file is converted
