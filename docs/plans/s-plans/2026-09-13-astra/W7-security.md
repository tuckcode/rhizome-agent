# W7 — HOME vault and MCP scope

**Owner:** Cursor Grok 4.6 · W7 remainder · 2026-09-14 11:22
**Start:** continue now. Follow the [parent contract](README.md).
**Close checklist:** [2026-09-14-1122-cursor-grok-4-6-w7-46-checklist.md](../../handoffs/2026-09-14-1122-cursor-grok-4-6-w7-46-checklist.md)

Owner: Cursor Grok 4.6 / W7 HOME-vault remainder
State: ready to integrate (source) · blocked on live close
Starting revision: local `4416411` (origin still `5c629a0` at pickup)
Owned paths:
- `mcp-server/vault-path.js`, `mcp-server/test.js`, `mcp-server/cli-call.mjs`
- `src-tauri/src/prime_vault_skill.rs`, `src-tauri/src/vault_list.rs`
- this stub + the 1122 checklist
Sibling overlap and release condition:
- Shared Rust (`lib.rs`, `prime_session_host.rs`, `mcp.rs`) released after `4416411`.
- W4 may edit those paths. W7 does not drive-by `lib.rs`.
One bounded change or evidence task:
- Write the #46 close checklist. Confirm `normalize_cwd("")` stays.
- Add missing Rust symlink-HOME / tilde tests. No live close. No issue close.
Acceptance cases:
- HOME, `~`, and a HOME shortcut cannot be a vault (JS + Rust).
- User-authored global `rhizome-vault` stays. Rhizome-generated copy can be scrubbed on a **fixture** home only.
- Chat without a vault still works. Prime cwd may be `$HOME`. MCP must not see HOME.
- Global Prime settings stay unchanged.
Evidence: command / native observation, revision, result, evidence path
- `cargo test --lib` focused names: 5 passed (symlink HOME, tilde HOME, fixture scrub + preserve) on tree atop `4416411`.
- Live Chat-without-vault: **NOT RUN**.
- `pnpm test:mcp` not rerun this slice (JS symlink already in `4416411`).
Commit: none this slice (tests + docs uncommitted)
Pushed: no. `4416411` still local-only.
Installed build tested: no. Packaged app remains `476756c`.
Unverified behavior: live Chat-without-vault; no global skill returns after that connect.
Blocker and next action: run the live close checklist. Keep #46 OPEN.

**Later same day (source, not #46 close):** Astra S1–S4 + R1–R4 are in the
dirty tree ([1305](../../handoffs/2026-09-14-1305-cursor-grok-4-6-r2-r4-secure-fs.md)).
`lib.rs` gained `mod secure_fs` for that slice. Live Sentry / #46 still
**NOT RUN**.

Read #46 and the current security diff. Claim the affected Rust and MCP paths before further changes.

1. Verify rejection across explicit, configured, and fallback vault paths.
2. Test HOME aliases, symlinks, tilde expansion where accepted, and normal nested vaults.
3. Prove global Prime settings remain unchanged.
4. Review global skill cleanup for provenance, user-authored content, and observable errors.
5. Keep all cleanup tests in temporary fixtures. Inspect call paths before running seed tests.
6. Run focused Rust checks, `pnpm test:mcp`, and required local analysis.
7. Release shared paths to W4 at a tested checkpoint.

**Review leads (God plan, dirty-diff era):** JS used lexical `resolve`; scrub deleted by name and discarded errors.

**Recheck against `4416411`:** JS now `realpathSync`. Scrub requires Rhizome-generated `SKILL.md` (`cli-call.mjs` + `rhizome-vault`), logs `#46:` on skip or failure, and never writes Prime global settings. User-authored content stays. JS already had a HOME-symlink test. This remainder added Rust `looks_like_vault` + `reject_home_vault_list` symlink/tilde tests.

**Done (source):** unsafe roots cannot expose HOME or alter global settings. Normal vault tools and vault-less Chat remain usable in code. Live close still required.
**Stop:** uncertain ownership requires preserving content. No global cleanup by name alone. No unrelated scanner or dependency project.
Do not close #46. Do not change `normalize_cwd("")`. Do not invent a Prime sandbox.
Residual #29 redaction work stays a separate bounded slice if already owned.

Daily-drive security requires the known #46 fix and safe handling at changed credential boundaries.
Use synthetic ENV/password/API-key fixtures. Verify redaction without exposing real values.
Broader credential hygiene is reserve work only after actionable W1–W11 tasks and daily-drive checks finish.
Follow the God plan's reserve limits. Do not search HOME, dump ENV, rotate keys, or rewrite user configuration.
