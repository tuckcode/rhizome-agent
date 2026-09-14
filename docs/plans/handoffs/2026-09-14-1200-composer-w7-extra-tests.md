---
session: 2026-09-14T12:00-05:00
model: Composer
description: >-
  W7 extra HOME guard tests confirmed present and passing. Symlink-to-HOME and
  tilde-HOME refuse covered in prime_vault_skill.rs and vault_list.rs; no adds.
---

# W7 extra tests — 2026-09-14 12:00

**Origin:** Composer · W7 #46 leftover · test-only verification

## Scope

Confirm decided extra cases from W7 security work:

1. **Symlink to `$HOME`** — must not look like a vault (`looks_like_vault`) or pass save guard (`reject_home_vault_list`).
2. **Tilde `$HOME`** (`~`) — save must refuse.

Constraints: no `normalize_cwd("")` changes; no scanning real `$HOME` for vaults; no commit.

## Tests found

| File | Test | Case |
|------|------|------|
| `src-tauri/src/prime_vault_skill.rs` | `a_symlink_to_the_home_directory_is_never_a_vault` | symlink → `$HOME` not a vault (`#[cfg(unix)]`) |
| `src-tauri/src/vault_list.rs` | `save_refuses_tilde_home_as_a_vault` | `~` path refused on save |
| `src-tauri/src/vault_list.rs` | `save_refuses_a_symlink_to_home_as_a_vault` | symlink → `$HOME` refused on save (`#[cfg(unix)]`) |

Related baseline tests (not W7 extras, already present): `the_home_directory_is_never_a_vault`, `seeding_the_home_directory_is_refused`, `save_refuses_the_home_directory_as_a_vault`.

## Cargo results

All three W7 extra tests **pass**. Compiled cleanly (no test adds required).

```bash
cargo test --manifest-path src-tauri/Cargo.toml save_refuses_tilde_home_as_a_vault
# test vault_list::tests::save_refuses_tilde_home_as_a_vault ... ok
# test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1836 filtered out

cargo test --manifest-path src-tauri/Cargo.toml save_refuses_a_symlink_to_home_as_a_vault
# test vault_list::tests::save_refuses_a_symlink_to_home_as_a_vault ... ok
# test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1836 filtered out

cargo test --manifest-path src-tauri/Cargo.toml a_symlink_to_the_home_directory_is_never_a_vault
# test prime_vault_skill::tests::a_symlink_to_the_home_directory_is_never_a_vault ... ok
# test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 1836 filtered out
```

## Verdict

**PASS** — 3/3 W7 extra tests present, compile, and green. No code changes.
