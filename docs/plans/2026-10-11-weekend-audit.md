# Weekend audit: #101 to #136 on main

**Origin:** Claude Code (Opus 5.5) · 2026-10-11 · read-only audit, uncommitted
**Checked against:** `origin/main` at `202f4bed` (the #135 merge). The local `main` checkout was 30 commits behind (#131, #133 to #136 missing). Every finding below was re-checked on `origin/main` with `git show` / `git grep`. Line numbers are `origin/main` lines unless marked *(local)*.
**Spec:** `docs/plans/2026-10-10-harness-remaining-threads.md`, ADR-0182 to ADR-0185.
**Method:** two read-only sub-agents (native loop and 2c; keychain, routing, old path), then spot checks by hand. No tests were run. Each finding says if it was verified by reading code.

## Already fixed on origin (do not reopen)

The stale tree showed these. `origin/main` fixes them:

- Free-tier settings did not reach the router. Fixed: `native_chat.rs:488` calls `.with_options(settings.to_options())`. #131.
- No read or save commands for free tier. Fixed: `commands/free_tier.rs` (`get_free_tier_overview`, `save_free_tier_settings`), registered at `lib.rs:826-827`.
- No path saved the Cloudflare account id. `commands/free_tier.rs:4` now names `cloudflare-ai:account`. The save path itself was not traced.
- The session-log scrub did not see keychain keys. Fixed in `80ef1045`.
- Two ADRs numbered 0184. Fixed: keychain ADR is now 0185 (`0d831f15`).

## High

**H1. Secrets go into the transcript index without the scrub.** `commands/native_chat.rs:184` and `:318` pass the raw prompt and raw assistant text to `session_transcript_index::append_native_turns`. `scrub_secrets` (`engines/native_log.rs:163`) runs only on the JSONL log. A key pasted into chat is redacted in the session file but sits in plain text in the index. ADR-0183 promises a known-credential filter for saved history. The index is a second store that the filter does not cover. Verified.

**H2. The transcript index has no write lock and a shared temp file.** `session_transcript_index.rs:139` writes every save to the same `*.json.tmp`, then renames it. The load, change, save cycle has no lock (the only `Mutex` is test-only at `:182`). Two native chats that end a turn at the same time on separate worker threads can lose one chat's turns, or mix writes in the temp file. Verified by reading. Not reproduced.

**H3. Index and engine errors are dropped.** `native_chat.rs:184`, `:318` (`let _ = append_native_turns`) and `:168` *(local)* (`let _ = engine.start`). A full disk or a corrupt index makes native chats disappear from search, and the user sees nothing. Verified.

**H4. A corrupt legacy key file hides every key, including keys already in the keychain.** `ProviderKeys::get` (`provider_keys.rs:79-91`) always calls `migrate_one`, which calls `self.legacy.key(id)?` (`:168`). A bad `ai-provider-secrets.json` returns `Err`. `credential()` (`:247`) turns that into `None`. Result: every provider looks keyless and nothing says why. Verified by reading.

## Medium

**M1. Quit waits for each native chat in turn, then for Prime.** `settle_all` (`native_chat.rs:425-438`) calls `settle_on_quit` and a 2 s join (`NATIVE_QUIT_BOUND`, `:38`) for one session at a time. Five stuck chats add up to about 10 s before the Prime settle starts. The plan (§4 2b step 6) says "Bound the wait. Quit must not hang." The bound is per session, not total. Fix shape: signal all sessions first, then join against one deadline. Verified.

**M2. Delete ignores a failed end and removes a held lock file.** `delete_native_session` (`native_chat.rs:573-574`) does `let _ = chats.end(..)`, then deletes the log and the `.lock` file. If the join times out, the worker still writes to an unlinked file. A new lock-file inode then lets a second writer start. Verified by reading.

**M3. A poisoned log mutex stops all saving with no error.** `engines/native.rs:233` *(local)*: `if let Ok(mut writer) = log.lock()`. After one panic under the lock, no durable event is saved for the rest of the session. Verified.

**M4. A failed append does not fail the turn.** `engines/native.rs:236-237` *(local)*. An I/O error only emits an `Error` event. The UI shows turns the log never got, so a resume after restart differs from what the user saw (breaks D10's promise in spirit). Verified by reading.

**M5. A failed successor open shows the wrong error.** `native_chat.rs:709-725` *(local)*: the `open_session_log` error is dropped by `unwrap_or_else`, and a fake header with `target: ""` is built. The user sees a target error in place of the real I/O or parse error. Verified on the local tree. #133 touched this area, so re-check the line on origin.

**M6. Orphan successor logs.** `native_log.rs:434-445` *(local)*: `let _ = write_successor_pointer` and `create_successor(..).ok()`. Each reopen of a damaged log can create a new successor UUID. Verified on the local tree.

**M7. `migrate_all` has no production caller.** `provider_keys.rs:146`. Callers are tests only (`:620`, `:649`). Migration happens lazily in `get`, which matches ADR-0185, so this is dead code with a green test suite (the `AiAgentsBadge` pattern in `AGENTS.md`). Verified by grep.

**M8. Keychain read errors are swallowed.** `provider_keys.rs:84` falls back to the file with no report, and the reason in `Step::Kept` is dropped (`:88`). ADR-0185 says the failure is reported by provider id. Today nothing reports it. Verified.

**M9. Provider response body reaches the final error.** `ai_models.rs` `classify_http_failure` formats "AI provider returned {status}: {body}". `rhizome_routing/mod.rs:348` wraps it as "Every free-tier provider failed. Last: …". The 1c observer events are clean (`observer_reason_has_no_response_body`), but this final text is not. If it is saved as an `Error` durable event, the body reaches the session file. Persistence not checked.

**M10. Legacy file read-modify-write race.** `LegacyFile::remove` reads, edits, and rewrites with no lock. Two concurrent `get` calls for different providers can bring back a key the other removed. The next read heals it. Not verified by test.

## Low

- **L1.** `Credential` derives `Debug` while it holds `api_key` (`rhizome_routing/mod.rs:38`). No `{:?}` leak exists today. A later debug print or failed assert would print the key.
- **L2.** Session header (`native_log.rs:620-630` *(local)*) saves `system_prompt` and vault paths without the scrub. A custom profile holding a token would be saved in plain text.
- **L3.** `write_lock_is_held` probes by taking and releasing the lock (`native_log.rs:328-335` *(local)*). Small TOCTOU window: a reader can treat a half-written last line as damage and fork a successor.
- **L4.** `sync_all` on every line (`native_log.rs:570` *(local)*). The plan asks only on `TurnEnd` and `Cancelled`. Safer than spec, more disk work.
- **L5.** `checksum_value` uses `unwrap_or_default` (`native_log.rs:151` *(local)*). A serialize failure checks against an empty string. No real trigger.
- **L6.** The scrub ignores saved keys shorter than 8 characters (`native_log.rs:163-167` *(local)*).
- **L7.** Free-tier providers are labelled `AiModelApiKeyStorage::LocalFile` (`native_chat.rs:500`). Keys live in the keychain now.

## Doc and ADR drift

- **D1. ADR-0184 says `fs2`. The code uses `fs4`.** `Cargo.toml:55` has `fs4 = "0.8"`. `native_log.rs:274` calls `fs4::FileExt`. ADR title, `:20`, `:28`, and `docs/adr/README.md:223` all say `fs2`. A new dependency name with no ADR row. Per `AGENTS.md`, write a superseding ADR, do not edit 0184.
- **D2. Keychain comments cite ADR-0183 for the migration rule.** `provider_keys.rs:1`, `:165`; ADR-0185 `:14`, `:48`. The crash rule is written in the plan's "2c ADR" list, and 0183 is the session-saving ADR. Check 0183 holds that rule; if not, point at 0185.
- **D3. Stale comment.** `rhizome_routing/mod.rs:43` says "The OS keychain implements this later." It is implemented in `provider_keys.rs`.
- **D4. HANDOFF.md has no entry for this weekend's work.** It is at 899 of 900 lines. "What to pick up next" still leads with a 2026-09-26 item. No Origin line covers 2a, 2b, 2c, 3a, or 3b. The plan rule ("each PR swaps lines") was not followed for the State section.
- **D5. Local checkout drift.** This working tree's `main` was 30 commits behind origin when the audit started. Any agent that reads the local tree (as this audit's sub-agents did) reports fixed bugs as open.

## Promises checked and kept

create_note dispatch, vault bound, no overwrite, Limited asks every call with no session grant (`policy.rs:91`, `:157`, `:167`); `stream_model_events` fully removed; Anthropic refused (`anthropic_target_is_refused_until_6a`); 1c observer with error class only; keychain service `ai.rhizome.agent`, account = provider id; old path reads keys through `ProviderKeys`; per-key write, read-back, remove; file deleted only when empty; JSONL header, serde `DurableEvent`, stop at first bad line, unknown version read-only, 1 MiB marker and 100 MiB roll, process lock, no grants restored, reopen warning, delete removes log and index entry. Each has a named test (read, not run).

## Not checked

- Step 3b UI (`FreeTierSettings.tsx`, Settings screen): out of scope by request.
- Whether `docs/vendored-sources.md` lists `keyring` and `fs4`.
- Whether the ported 1b tests match the old ones one for one.
- Whether `ai_run_target` callers set `vault_path` (plan §0 "Not checked", still open for step 6).
