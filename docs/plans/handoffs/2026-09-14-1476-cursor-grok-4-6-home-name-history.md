---
session: 2026-09-14T14:54-05:00
model: Grok 4.6 (Cursor)
description: >-
  Chat-without-vault session names use the home folder, not "vault".
  Composer up-arrow history has no vaultPath. Do not close #46.
commits: uncommitted
---

# HOME session name + composer history

**Origin:** Cursor Grok 4.6 · 2026-09-14 14:54 · leftover tests.

Empty-vault Chat still names a new session with the local clock and
the home folder (`<user>`), not the generic `vault` fallback. Composer
up-arrow history is in-memory only — the library has no `vaultPath`.

```bash
cargo test --manifest-path src-tauri/Cargo.toml created_session_names_use_the_home_folder
npx vitest run src/lib/composerPromptHistory.test.ts -t "vault path"
```

**1 rust + 1 JS PASS.** No product edit. `prime_session_host.rs` added
to D6 group 4 (test only). Do not change `normalize_cwd("")`. Do not
close #46.

## Not this window

- C64 still **NOT RUN**. App still `476756c`.
- D6 commits wait ~15:45.
