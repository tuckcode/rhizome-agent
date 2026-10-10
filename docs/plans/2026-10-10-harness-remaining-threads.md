# Harness: the four remaining threads

**Origin:** Claude Code (Opus 5.5) · 2026-10-10 · plan for the threads left after #108
**Updated:** Claude Code (Opus 5.5) · 2026-10-10 · knispo's Q1 to Q10 answers locked in. A resume step (2c) is added.
**Updated:** Claude Code (Opus 5.5) · 2026-10-10 · knispo said yes to notes N1 to N3. They are now D11 to D13.
**Status:** locked by knispo, 2026-10-10 (D1 to D13). This file writes no product code. Each step ships as its own draft PR. knispo merges.
**Binding:** [ADR-0180](../adr/0180-rhizome-is-its-own-harness.md) (Rhizome is its own harness), [ADR-0182](../adr/0182-free-tier-provider-routing.md) (free-tier routing). ADR-0177 is superseded. ADR-0168 borrow rules still apply.
**Parent plan:** [2026-10-09-rhizome-harness-plan.md](2026-10-09-rhizome-harness-plan.md) §4 to §6. That file stays the source for phase scope. This file adds steps, owners, and order for what is left.

---

## 0. Ground truth

Checked on `main` at `dbd94b96` (the #108 merge), 2026-10-10. Each line names what was read.

| Fact | Evidence |
|---|---|
| #101, #102, #103, #105, #106, #107, #108 are on `main`. #103 names plan Phase 3 (plugin seam) apart from #101. | `git log origin/main` |
| `Engine` has `kind`, `start`, `stop`, `events`. `EngineEvent` has `Text` and `Cancelled` only. `events()` returns a `Vec` after the run. | `src-tauri/src/engines/mod.rs` |
| No command reaches `engines::`, `rhizome_loop`, or `rhizome_routing`. | `grep` over `src-tauri/src/commands/` |
| Loop tools are `echo` and `bash`. `tools::execute_allowed` returns its input. | `rhizome_loop/tools.rs` (6 lines), `rhizome_loop/policy.rs:63` |
| `set_approval_dismiss` exists. `prompt_gen` and `live_prompt` drop a late reply. | `rhizome_loop/driver.rs:156` |
| `on_after_tool_for_test` is the only other hook. It is test-only. | `driver.rs` |
| The loop keeps its durable log in memory only (`Shared.log: Vec<DurableEvent>`). `DurableEvent` has no serde derive. | `rhizome_loop/driver.rs`, `rhizome_loop/types.rs` |
| `stream_model_events` and `stream_model_events_with` have test callers only. | `ai_models.rs:246`, `:254`, tests at `:1148` to `:1407` |
| The old path is `run_ai_model_stream` → `send_model_message` → `send_openai_compatible_message` → `execute_openai_tool_calls`. It is not a stream: one blocking request, then one `TextDelta`. | `ai_models.rs:169`, `:528`, `:536` |
| `send_anthropic_message` is one blocking request. It sends no tools. | `ai_models.rs:556` |
| Old-path callers: `commands/ai.rs:226` (`stream_ai_model`), `commands/ai.rs:254` → `ai_models::test_ai_model_provider` (`ai_models.rs:184`), `ai_run_target.rs:70`, `rhizome_distill.rs:222`, `rhizome_import.rs:314`. | `grep` |
| Frontend callers of the old path: `src/utils/streamAiModel.ts` (invokes `stream_ai_model`), used by `src/lib/aiAgentSession.ts`, `src/components/AiWorkspace.tsx`, `src/components/aiWorkspaceConversations.ts`, and `src/utils/aiConversationTitle.ts`. | `grep` |
| The system prompt reaches the provider through `AiModelStreamRequest.system_prompt`. The Prime path composes the profile in the command layer. | `ai_models.rs:371`, `commands/ai.rs:579` |
| `RoutingModel` takes a `KeyStore` trait. No keychain implementation exists. `Cargo.toml` has no keychain crate. | `rhizome_routing/mod.rs:45`, `src-tauri/Cargo.toml` |
| Every free-catalog provider needs a key. Only the user endpoint may be keyless. | `rhizome_routing/catalog.rs:46`, `free_catalog.json` |
| Keys today sit in `ai-provider-secrets.json` under `com.rhizome.app`. | `ai_models.rs:668` to `:698`, `app_config.rs:3` |
| **A key file exists on disk.** `~/.config/com.rhizome.app/ai-provider-secrets.json` holds 3 keys, all for custom `open_ai_compatible-*` providers. `~/.config/com.tolaria.app/ai-provider-secrets.json` exists and is empty. | `ls`, key ids read without values, 2026-10-10 |
| Quit runs in `RunEvent::Exit` at `lib.rs:914`. It calls `prime_session_host::settle_session_on_quit`. | `lib.rs` |
| The Chat lock is `parked-organs.test.ts:244` ("keeps Chat on Prime when Settings default is an API model"). `leftover-prime-keep.test.ts` also names `api_model`. | `grep` |
| `leftover-omniroute-parked.test.ts` reads "No OmniRoute code in tree" from a 2026-09-14 handoff. | file |
| `HANDOFF.md` is 899 lines. | `wc -l` |

Not checked: whether `ai_run_target` callers set `vault_path`. If they do, the old path offers `create_note` to distill and import runs. Step 6 must check this first.

---

## 1. Order

| Step | Thread | PR | Lane |
|---|---|---|---|
| 1a | 3 prep | `create_note` becomes a real loop tool | Cursor (loop) with a Claude-owned helper |
| 1b | 3 prep | Delete `stream_model_events`. Port its tests. | Claude |
| 1c | 3 prep | `RoutingModel` reports each provider attempt | Claude |
| 2a | 2 backend | Wider `Engine` trait and a live event sink | Cursor |
| 2b | 2 backend | Native Chat Tauri commands, quit cancel, transcript index | Cursor |
| **2c** | 2 backend | **Durable loop log and resume after restart** | Cursor |
| 3 | 4b | Keychain `KeyStore`, key migration, free-tier settings backend and UI | Claude |
| 4 | 2 frontend | Phase 6 toggle in Settings, native model picker, lock updates | Cursor |
| 5a | 4a | Native approval prompt and its dismiss | Cursor |
| 5c | 4c | Loop activity in Chat | Cursor |
| 6a | 3 cleanup | Anthropic streams `ModelEvent`s (after launch) | Claude |
| 6 | 3 cleanup | Move the five callers and the `api_model` Chat target. Delete the old path. | Claude, Cursor for the frontend Chat callers |
| 7 | 1 | Plugin seam, only if a second hook appears | Cursor |

**Dependencies.**

- 1a, 1b, and 1c do not depend on each other. They can run in parallel, one worktree each.
- 2a needs 1c for the provider event shape. 2b needs 2a. 2c needs 2a (event types) and 2b (commands).
- Step 3 does not need step 2. It can run in parallel with 2a to 2c.
- **Step 4 needs 1a, 2b, 2c, and 3.** It ships last of the launch set. Resume (2c) must be on `main` before the toggle ships. Step 3 must be on `main` because the picker asks the router if it has a provider it can use (D11), and keys come from step 3.
- 5a and 5c need 2b. They can land before or after step 4. Until step 4 merges, nothing reaches them.
- 6a needs nothing in step 2 to 5. It is not in the launch path.
- Step 6 can start before 6a (D12). It moves the OpenAI-compatible callers first. The Anthropic part of step 6 waits for 6a.

---

## 2. Rules for every PR

- The app keeps working. Chat runs through Prime until step 4 merges. Prime stays the default after step 4.
- Do not change `stream_model_events` or the old path outside thread 3 PRs (1b, 6a, 6).
- One phase per PR. Test first: push a red commit, paste the run, then green.
- Agents open draft PRs. knispo merges.
- Push through the installed pre-push hook. If it refuses, stop and ask knispo. Never `--no-verify`.
- `HANDOFF.md` stays at or under 900 lines. Each PR swaps lines. It does not add net lines.
- Stage by name. Commit with `git commit -- <paths>`. One worktree per writing agent.
- Licences: copy only MIT, BSD, or Apache-2.0 code, with a file header and a `docs/vendored-sources.md` row. Do not copy freellmapi's hosted catalog. Hermes, Prime, DeepSeek, and Cordis stay idea-only. `leftover-omniroute-parked.test.ts` changes only if real OmniRoute code is copied. No step in this plan copies OmniRoute code.
- A new dependency needs an ADR in the same PR (`AGENTS.md` §ADRs).

---

## 3. Thread 3 prep (steps 1a, 1b, 1c)

Phase 6 needs all three. They change no user-facing behaviour.

### 1a. `create_note` as a real loop tool

**Steps.**

1. Claude lane: keep `ai_model_tools::create_note` as the one vault-bounded body. Give it a signature the loop can call with `(vault_path, args_json) -> Result<String, String>`. No model request inside it (it is already that shape since `b5908993`).
2. Cursor lane: replace `tools::execute_allowed(args)` with a dispatch by tool name. `echo` keeps its body. `create_note` calls the helper. An unknown name returns an error result. It does not panic.
3. The loop needs the vault path. Add it to the loop's run context (set once per engine start). Do not put it in `ModelView`.
4. `policy.rs`: add `create_note` to `offered_tools` for both modes.
5. Ruling (decision D3):
   - **Limited tools:** ask on every call. The options are Allow once and Deny. Do not offer Allow for this session for `create_note` in Limited tools, and do not match a session grant for it.
   - **Power User:** allow with no prompt.
6. `rhizome_provider_model.rs` already sends the real `create_note` schema (`:179`). No change there.

**Files.** `rhizome_loop/tools.rs`, `rhizome_loop/policy.rs`, `rhizome_loop/driver.rs` (context only), `ai_model_tools.rs`.

**Tests (red first).**

- `create_note_tool_writes_a_note_in_the_vault`: scripted model calls `create_note`. A temp vault has the file. The log has `ToolResult`.
- `create_note_refuses_a_path_outside_the_vault`: `../x.md` gives a `ToolResult` with the error text. No file outside the temp dir.
- `create_note_does_not_overwrite`: an existing path gives an error result. The file content is unchanged.
- `limited_tools_asks_for_every_create_note`: two calls in one turn give two prompts.
- `limited_tools_create_note_offers_no_session_grant`: the prompt options are Allow once and Deny only.
- `power_user_runs_create_note_without_a_prompt`.
- `unknown_tool_name_returns_an_error_result`.

**Risks.** The old API path ran `create_note` with no approval. Limited tools users of the native engine see a prompt for each note. That is the decision (D3).

### 1b. Delete `stream_model_events`

Decision D4: native launches with OpenAI-compatible providers only. Anthropic streaming moves to step 6a.

**Steps.**

1. Delete `stream_model_events` and `stream_model_events_with`. They have no app caller. `ProviderModel` uses `stream_chat_events_with_params`.
2. Port the tests that cover behaviour `stream_chat_events_with` does not already cover: whole-JSON completion, stop when `emit` returns false, HTTP failure as one error, connect failure as `Unavailable`, bad base URL. The tool-call parse test moves to `stream_chat_events_with` with a tool list.
3. Keep the Anthropic rejection test. Point it at `stream_chat_events_with` if that function rejects Anthropic. If it does not, add the rejection there, so a native turn on an Anthropic provider fails with one clear error.

**Files.** `ai_models.rs`, `ai_models/test_server.rs` if a fixture moves.

**Tests.** The ported `stream_model_events_*` tests, renamed for `stream_chat_events_with`, plus `stream_chat_events_rejects_anthropic`.

**Risks.** Rust coverage must stay ≥85%. Run `cargo llvm-cov` before push.

### 1c. Provider attempt event

`RoutingModel` retargets one `ProviderModel` per attempt (`rhizome_routing/mod.rs`). Nothing outside it can see which provider it tried.

**Proposed shape: an observer on `RoutingModel`.** Do not add a `ModelEvent` variant and do not add a `DurableEvent` variant. The loop rule is "model-visible means logged". Which provider answered is not model-visible. It is live coordination. An observer keeps `rhizome_loop/` and `model_events.rs` unchanged.

**Steps.**

1. Add `ProviderAttempt { provider_id, model_id, outcome }` with `outcome` one of `Trying`, `FailedOver { reason }`, `Answered`, `Exhausted`. `reason` is a short class (`rate_limited`, `quota`, `auth`, `server`, `connect`, `bad_stream`). It is never a response body.
2. `RoutingModel::with_observer(Box<dyn FnMut(ProviderAttempt) + Send>)`. Default is no observer.
3. Call it at each attempt start, each failover, and the first event that reaches the loop.

**Files.** `rhizome_routing/mod.rs`, `rhizome_routing/health.rs` (reason class only).

**Tests.**

- `observer_sees_failover_then_answer` (first mock 429, second answers).
- `observer_reason_has_no_response_body`.
- `no_observer_changes_nothing` (existing routing tests stay green).

---

## 4. Thread 2: Phase 6, Chat on the native engine

### 2a. Wider `Engine` trait (Cursor)

Today `start` runs to the end and `events()` returns a `Vec`. Chat needs live events and control while a turn runs.

**Steps.**

1. `EngineEvent` grows to: `TextDelta`, `ToolCall { id, name, args }`, `ToolResult { id, name, output }`, `ToolDenied { id, name, reason }`, `ApprovalRequested { prompt_id, tool, args, options }`, `ApprovalDismissed { prompt_id }`, `Provider(ProviderAttempt)`, `TurnEnd`, `Cancelled { cause }`, `Error { message }`. Map from `DurableEvent` where one exists.
2. The trait takes an event sink: `start(&mut self, prompt, sink: Box<dyn FnMut(EngineEvent) + Send>)`. Keep a test helper that collects into a `Vec`, so the five Phase 5 tests stay readable.
3. Add `steer(&mut self, text)` (native: `submit` to the inbox), `cancel(&mut self, cause)`, `reply_approval(&mut self, prompt_id, reply)`, and `settle_on_quit(&mut self)` (native: `stop_and_drain("quit")`, Prime: detach, Hermes: detach ACP).
4. The native approval waiter emits `ApprovalRequested`, then blocks on a channel with a timeout. Timeout or a closed channel returns `Cancelled` (fail-closed). `set_approval_dismiss` emits `ApprovalDismissed`.
5. Prime and Hermes adapters implement the new methods with the events they can produce. They are not Chat's path yet.

**Files.** `engines/mod.rs`, `engines/native.rs`, `engines/prime.rs`, `engines/hermes.rs`.

**Tests.**

- `native_engine_streams_text_before_turn_end`.
- `native_engine_reports_tool_call_and_result`.
- `native_engine_approval_timeout_denies`.
- `native_engine_cancel_during_approval_dismisses_prompt`.
- `native_engine_steer_waits_for_idle`.
- `native_engine_reports_provider_failover` (uses 1c).
- `native_settle_on_quit_cancels_and_refuses_submit`.
- The five Phase 5 tests stay green.

### 2b. Native Chat commands (Cursor)

`commands/ai.rs` belongs to neither lane. Put the new commands in a new file, `src-tauri/src/commands/native_chat.rs`, so 2b does not edit the existing stream commands.

**Steps.**

1. Managed state `NativeChats(Mutex<HashMap<SessionId, NativeEngine<..>>>)`.
2. Commands: `native_chat_start(request) -> session_id`, `native_chat_send` (follow-up or steer), `native_chat_cancel`, `native_chat_approval_reply`, `native_chat_end`. Events go out on a scoped channel, `native-chat:<session_id>`, through the existing `StreamEmitter` pattern in `commands/ai.rs:24`.
3. The request carries the target (a catalog model or "Free tier (auto)", decision D2), `system_prompt`, `vault_path`, and the permission mode. A catalog model builds a `ProviderModel`. "Free tier (auto)" builds a `RoutingModel`. Compose the profile in the command layer with `settings::compose_agent_profile`, as `normalize_prime_request` does (`commands/ai.rs:579`). This keeps persona out of the loop. See thread 1.
4. Refuse an Anthropic catalog model with one clear error until 6a lands (D4).
5. Run each engine on its own thread. `reqwest::blocking` panics when dropped inside a tokio runtime (handoff 2026-10-10-1900).
6. Quit: in `RunEvent::Exit` (`lib.rs:914`), call `settle_on_quit` on every native engine **before** the Prime settle. Bound the wait. Quit must not hang on a slow provider. No Keep working for native turns.
7. Transcript index: on `TurnEnd`, append user and assistant turns through `session_transcript_index.rs`. Native sessions get a Rhizome-owned `path` (proposed `rhizome-native:<uuid>`). Nothing is written under `~/.prime`.
8. Register the commands in `lib.rs`. Add them to `src/mock-tauri/index.ts` so `pnpm dev` and Playwright work without a provider.

**Files.** new `commands/native_chat.rs`, `commands/mod.rs`, `lib.rs`, `session_transcript_index.rs`, `src/mock-tauri/index.ts`.

**Tests.**

- `native_chat_start_emits_text_on_the_scoped_channel` (fake model).
- `free_tier_target_builds_a_routing_model`.
- `anthropic_target_is_refused_until_6a`.
- `quit_cancels_native_chat_turn` (parent plan Phase 6 test 5).
- `quit_does_not_wait_past_the_bound`.
- `transcript_index_contains_native_turn` (parent plan Phase 6 test 4).
- `native_chat_writes_nothing_under_prime_home` (temp `HOME`, assert no `~/.prime` writes).
- `prime_engine_detaches_never_shutdown_on_exit` (parent plan Phase 6 test 3).

**Risks.** Quit order. A native cancel that blocks would delay the Prime detach. Test the bound.

### 2c. Durable loop log and resume (Cursor)

Decision D10: a native session must reopen and continue after Rhizome restarts. Reading the old turns is not enough. This step must be on `main` before step 4 ships.

The log is a session transcript. It is not memory. The vault stays the one memory authority (parent plan §1 non-goals). Nothing goes under `~/.prime`.

**Steps.**

1. Add serde to `DurableEvent` (`rhizome_loop/types.rs`). Keep the variant names stable. They become an on-disk format.
2. Storage: one append-only JSONL file per native session at `<app config dir>/native-sessions/<session_id>.jsonl`, through `app_config::preferred_app_config_path`. Line 1 is a header: `{ version, session_id, created_at, target, permission_mode, vault_path }`. Each later line is one `DurableEvent`.
3. The engine appends each durable event as the loop logs it. It flushes and syncs on `TurnEnd` and `Cancelled`.
4. Add `AgentLoop::from_log(events)` in the loop. It rebuilds `history` and `turn_start` from the logged events. Resume rules:
   - A turn with no `TurnEnd` or `Cancelled` at the end of the file is closed on load as `Cancelled { cause: "restart" }`. It then follows the same history rule the loop applies to a cancelled turn today.
   - A tool call with no result gets the existing "the turn stopped first" answer (`rhizome_provider_model::openai_messages`).
   - Pending approvals are not restored. Session grants and unspent allow-once grants are not restored. A resumed session starts with no grants (fail-closed, D13). For example, a user who allowed `bash` for the session is asked again.
   - `native_chat_open` returns a reopen warning with the events. The warning says that permissions from before the restart do not carry over. Proposed copy: "Rhizome restarted. Permissions you gave earlier in this chat no longer apply, so Rhizome asks again."
   - Inbox items that were not admitted are not restored. `stop_and_drain` already drops them on quit.
5. Commands: `native_chat_list` (sessions from the log folder, newest first) and `native_chat_open(session_id)`. `open` returns the logged events for the UI, then holds a live engine that accepts `native_chat_send`.
6. The session target comes from the header. If that model or its key is gone, `open` returns the events and an error that names the missing target. The UI then lets the user pick another target to continue (step 4).
7. A bad line ends the read at the last good line. The session opens with a warning. An unknown `version` opens read-only.
8. The transcript index `path` (`rhizome-native:<uuid>`) points to this log. Deleting a native session from the session list deletes its log file and its index entry, through the existing session-delete flow.

**Files.** `rhizome_loop/types.rs`, `rhizome_loop/driver.rs` (`from_log`), `engines/native.rs`, new `engines/native_log.rs`, `commands/native_chat.rs`, `session_transcript_index.rs`.

**Tests (red first).**

- `resume_sends_earlier_turns_to_the_model`: write a log with two turns, open it, send a third message. The fake model's `ModelView` holds both earlier turns.
- `restart_mid_turn_closes_the_turn_as_cancelled`.
- `resume_restores_no_session_grants`.
- `reopen_warning_says_grants_do_not_carry_over`.
- `pending_approval_is_not_restored`.
- `unanswered_tool_call_gets_the_stopped_answer`.
- `bad_tail_line_is_ignored`.
- `unknown_version_opens_read_only`.
- `missing_target_returns_the_events_and_an_error`.
- `native_log_is_never_written_under_prime_home`.
- `delete_removes_the_log_and_the_index_entry`.

**Risks.**

- `DurableEvent` becomes a file format. A later rename breaks old logs. The `version` field and a round-trip test guard it.
- The log holds full chat text in the app config folder. It also holds tool output, such as `bash` output and note contents that `create_note` wrote. The transcript index holds user and assistant turn text only. So the log adds a new class of data on disk. Secret scrubbing is open for the 2c ADR (§8, held list).
- One write per event adds disk work. Text deltas are not durable events, so the count is one line per message, tool call, or result.

### 4. Phase 6 frontend: the toggle (Cursor)

**Decisions:** D1 (Settings, one control), D2 (one picker), D9 (`api_model` stays on its current path until step 6).

**Steps.**

1. Add an engine choice, `prime` or `native`, to Settings. This is the only control. The composer gets no engine control. Default `prime`. A fresh install and an existing install both read `prime` when the value is absent. No migration is needed because no value exists on disk yet.
2. Native model picker: one list. It shows Rhizome's main catalog models (`ai_models.rs` / `aiModelProviderCatalog.json`) and a "Free tier (auto)" entry. The default is a specific catalog model. "Free tier (auto)" appears whenever the router has at least one provider it can use (D11). That includes a user endpoint with no key. Anthropic models are hidden until 6a (D4). The Prime picker still reads Prime's catalog.
3. `ChatHome.tsx` (~`:101` to `:110`): the `chatTarget` memo keeps forcing Prime when the engine is `prime`. When the engine is `native`, Chat uses the native target.
4. `aiAgentSession.ts` `streamWithSelectedTarget` (`:94`): add a native branch that calls a new `src/utils/streamNativeChat.ts` (invokes `native_chat_*`). Leave the `api_model` branch unchanged (D9).
5. `AiPanel.tsx`: 32 uses of `isPrimeTarget`. Prime chrome stays for Prime. Native gets the plain composer plus 4a and 4c. Do not strip Prime chrome.
6. Session list: native sessions show from `native_chat_list`. Opening one calls `native_chat_open` and continues the session (2c). A missing target shows the picker.
7. Update `parked-organs.test.ts:244` and `leftover-prime-keep.test.ts` **in this PR only**. Quote the 2026-10-09 decision: "Prime stays the Chat default. Phase 6 adds a Settings or composer toggle to pick the native Rhizome engine." Quote the 2026-10-10 answer that the toggle lives in Settings. The new lock asserts that Prime is the default and that the toggle exists once, in Settings.
8. PostHog: `chat_native_turn_started` with `{ engine: 'native' }` only. No prompt, no model id, no provider id.

**Files.** `src/components/ChatHome.tsx`, `src/components/AiPanel.tsx`, `src/lib/aiAgentSession.ts`, new `src/utils/streamNativeChat.ts`, the Settings component that holds agent defaults, the native model picker, `src/lib/parked-organs.test.ts`, `src/lib/leftover-prime-keep.test.ts`. Use shadcn/ui for the control.

**Tests.**

- `chat_default_engine_is_prime` (fresh state, send goes to Prime).
- `chat_toggle_native_uses_rhizome_loop` (mock Tauri, no Prime socket).
- `engine_toggle_renders_once_in_settings_and_never_in_the_composer`.
- `free_tier_entry_hidden_when_the_router_has_no_usable_provider`.
- `free_tier_entry_shown_for_a_keyless_user_endpoint`.
- `native_picker_default_is_a_catalog_model`.
- `native_session_reopens_after_restart` (mock Tauri: list, open, send).
- `native_turn_tracks_engine_id_only` (PostHog payload equals `{ engine: 'native' }`).
- Playwright smoke only if the change touches a core flow listed in `AGENTS.md`. Chat send is not on that list. Keep it in the regression lane.
- Native QA with computer-use: toggle in Settings, send, quit mid-turn, relaunch, reopen, continue. Record ✅ or ❌ in the PR.

**Risks.** This is the switch that can break Chat for everyone. It lands after 1a, 2b, 2c, and step 3 so that only the UI is new in this PR.

---

## 5. Thread 4: three frontend pieces

### 4b. Keychain and free-tier settings (step 3, Claude)

ADR-0182 decision 4: "User keys live in the OS keychain via Tauri. One key per provider." This overlaps #45 (Rhizome's own model settings are the main settings).

**Backend steps.**

1. Add the `keyring` crate (decision D8). Write an ADR in the same PR, because this is a new dependency and a storage strategy. Check its licence at add time. The expected licence is MIT or Apache-2.0. This plan did not verify it.
2. `KeychainKeyStore` implements `rhizome_routing::KeyStore`. Service name `ai.rhizome.agent`. Account is the provider id. Cloudflare also stores `account_id` (proposed second entry, `<id>:account`).
3. The old path's key lookup (`ai_models.rs` secrets functions) reads through the same store. One store serves both paths.
4. `save_ai_model_provider_api_key` and `delete_ai_model_provider_api_key` write to the keychain.
5. **Migration (decision D5).** The compatibility path exists because a key file is on disk (§0). Move the keys one at a time. For each key in `com.rhizome.app/ai-provider-secrets.json`:
   1. Write the key to the keychain.
   2. Read it back. Compare it with the file value.
   3. If they match, remove that key from the file and write the file.
   4. If the write or the read-back fails, leave the key in the file and log the provider id only. The next start tries again.
   
   Delete the file only when it holds no keys. The empty `com.tolaria.app` file gets no compatibility path. `secrets_path` uses `preferred_app_config_path`, which never reads the Tolaria directory.
6. Routing settings in `settings.json`: per-provider on or off, Cloudflare opt-in, strict mode. These map to `RoutingOptions { opt_in, strict }` plus a per-provider off set.
7. A read command returns the fixed routing order for display (decision D6).
8. A read command answers "does the router have at least one provider it can use" for the step 4 picker (D11). A keyless user endpoint counts. The command applies the same on/off, opt-in, and strict settings that routing uses.

**Frontend steps.**

1. A "Free tier" section in `AiProviderSettings.tsx` (425 lines today, so a new child component). One row per catalog provider: name, key field, on/off `Switch`, "default-on" or "opt-in" label.
2. Cloudflare card: off by default. Turning it on shows the warning first. Proposed copy: "Cloudflare Workers AI bills the card on your Cloudflare account when you pass the free daily allowance."
3. Strict mode `Switch`, with one line that says it keeps only providers with a confirmed hard stop (Groq today) and your own endpoint.
4. Fallback order: a read-only ordered list, fixed by ADR-0182 (D6). No drag handles, no reorder control.
5. shadcn/ui only. English strings inline (C18).

**Files.** `Cargo.toml`, new `src-tauri/src/keychain.rs` (or `rhizome_routing/keychain.rs`), `ai_models.rs` secrets section, `settings.rs`, `src/components/AiProviderSettings.tsx`, new `src/components/FreeTierSettings.tsx`, new ADR.

**Tests.**

- `keychain_store_round_trips_one_key` (behind a fake backend in CI. The real keychain needs a live login session.)
- `migration_moves_each_key_after_read_back`.
- `migration_keeps_a_key_when_read_back_differs`.
- `migration_keeps_a_key_when_the_keychain_write_fails`.
- `migration_deletes_the_file_only_when_empty`.
- `no_file_means_no_migration_attempt`.
- `strict_mode_routes_only_hard_stop_and_user_endpoint` (backend already has a test. Add the settings-to-options mapping test.)
- Frontend: `cloudflare_warning_shows_before_opt_in`, `strict_toggle_sets_strict`, `fallback_order_is_read_only`.
- PostHog proposal: `free_tier_provider_toggled { provider_id, enabled }`. Provider ids are catalog names, not PII. knispo may drop it as noise.

**Risks.** Keychain prompts on macOS for an unsigned dev build. Every `pnpm tauri dev` rebuild may ask again. Native QA must use the real `.app` once. Windows needs the Credential Manager feature on the crate. The migration runs on knispo's 3 real keys, so test it on a copy of the file first.

### 4a. Clear a cancelled approval prompt (step 5a, Cursor, after 2b)

**Steps.**

1. A native approval prompt in Chat: tool name, args summary, and the options the backend sends. For `create_note` in Limited tools that is Allow once and Deny (D3). Use shadcn `Button`s, inline in the transcript, so the user can still read the reply. Confirm the placement with knispo in the PR.
2. On `ApprovalDismissed { prompt_id }`, remove the prompt. A click on a removed prompt does nothing.
3. A reply calls `native_chat_approval_reply`. The backend `prompt_gen` check already drops a late reply.
4. A resumed session (2c) shows no old prompt.

**Tests.** `cancel_removes_the_open_prompt`, `late_click_after_dismiss_runs_no_tool` (backend), `quit_during_prompt_runs_no_tool`, `prompt_shows_only_backend_options`.

PostHog: no event. Approval answers are frequent and say little about adoption.

### 4c. Loop activity in Chat (step 5c, Cursor, after 2b)

**Steps.**

1. Render `ToolCall`, `ToolResult`, `ToolDenied` as compact rows in the native transcript. Reuse the existing tool-row component that Prime turns use, if its props fit. Check `src/components/` first.
2. Render `Provider` events as one quiet line per turn: "Answered by Groq" or "Groq was rate-limited, used Mistral". Failure reasons use the short class from 1c.
3. Nothing from 4c goes into the model's view or the transcript index text. Provider lines are live only and do not come back on resume.

**Tests.** `tool_row_shows_name_and_result`, `failover_line_names_both_providers`, `denied_tool_shows_reason`, `resumed_session_shows_tool_rows_from_the_log`.

---

## 6. Thread 3 cleanup (steps 6a and 6)

### 6a. Anthropic streaming (Claude, after launch)

Decision D4 keeps this out of the launch path. The Anthropic part of step 6 needs it, because that part deletes `send_anthropic_message` and moves Anthropic `api_model` Chat users onto the native engine (D12).

**Steps.**

1. Add an Anthropic Messages SSE parser beside `ai_models/openai_stream.rs` (new `ai_models/anthropic_stream.rs`). It maps text deltas to `ModelEvent` text, `tool_use` blocks with JSON input deltas to `ModelEvent` tool calls, and the stop reason to the terminal event. Read Anthropic's own streaming docs at implementation time for the event names. Do not take them from this plan.
2. Add `stream_anthropic_events_with(request, messages, tools, limits, emit)`. The system prompt goes in the top-level `system` field.
3. `ProviderModel` chooses by `provider.kind`. Anthropic needs its own message mapper: tool results are `tool_result` content blocks in a `user` message, with `tool_use_id`. Keep `openai_messages` unchanged.
4. Remove the 2b refusal and the step 4 picker filter for Anthropic models.

**Tests.** `anthropic_text_stream_becomes_model_events`, `anthropic_tool_use_becomes_one_tool_call`, `anthropic_tool_result_maps_to_a_user_tool_result_block`, `anthropic_http_error_is_one_model_error`, `provider_model_runs_the_loop_against_anthropic_fixture`.

### 6. Move the callers, delete the old path

Move each caller, then delete the old path in the PR that removes its last caller.

**If 6a slips (D12).** Step 6 still moves every OpenAI-compatible caller, including OpenAI-compatible `api_model` Chat turns, to the native engine. Anthropic stays on the old call: `send_anthropic_message` is the Anthropic arm of `complete_text`, and Anthropic `api_model` Chat turns stay on `stream_ai_model`. Delete those two only in the PR after 6a lands.

**Shared helper first (Claude).** `ai_models::complete_text(request) -> Result<String, String>`: a plain stream with no tools. It accumulates text from `stream_chat_events_with` (OpenAI-compatible) or the 6a Anthropic stream. Batch callers and the connection test use it. They do not use the loop.

| Caller | Moves to | Owner |
|---|---|---|
| `commands/ai.rs` `test_ai_model_provider` → `ai_models::test_ai_model_provider` | `complete_text` with the existing "Reply with exactly OK." prompt. Succeeds on a non-empty reply. | Claude |
| `ai_run_target.rs:70` | `complete_text`. First check whether its requests set `vault_path` (see §0 "Not checked"). | Claude |
| `rhizome_distill.rs:222` | follows `ai_run_target` | Claude |
| `rhizome_import.rs:314` | follows `ai_run_target` | Claude |
| `src/utils/aiConversationTitle.ts` | a new `complete_ai_model_text` command over `complete_text` | Claude |
| Chat's `api_model` target: `commands/ai.rs` `stream_ai_model`, `src/utils/streamAiModel.ts`, and its users `aiAgentSession.ts`, `AiWorkspace.tsx`, `aiWorkspaceConversations.ts` | the native engine (D9) | Cursor |

**Delete when the last caller is gone:** `run_ai_model_stream`, `send_model_message`, `send_openai_compatible_message`, `send_anthropic_message`, `send_json_request` if unused, `extract_openai_text`, `extract_anthropic_text`, `ai_model_tools::execute_openai_tool_calls`, `ai_model_tools::openai_chat_payload` if unused, the `stream_ai_model` command, `streamAiModel.ts` and its test. Keep `ai_model_tools::create_note` (1a uses it) and `openai_create_note_tool` (`ProviderModel` uses it).

**Tests.**

- `connection_test_streams_without_tools` (request body has no `tools`).
- `distill_runs_without_tools` and `import_runs_without_tools`.
- `conversation_title_uses_plain_completion`.
- `api_model_target_runs_on_the_native_engine`.
- Before each delete, run `pnpm deadcode` and `grep` the filename across `src-tauri/`, `src/`, and `docs/`. knip does not see Rust or `invoke` strings.

**Risks.**

- Batch jobs lose `create_note` if they had it. That is the intent only if §0 "Not checked" confirms they never needed it.
- A Chat `api_model` turn changes from one blocking reply to a streamed loop turn with tools. Users whose default agent is not Prime see this change in step 6. Limited tools users also start to see `create_note` prompts (D3).

---

## 7. Thread 1: plugin seam (step 7, conditional)

**Trigger.** Open Phase 3 only if Phase 6 needs a second hook at the same point as policy. The expected candidate is a persona injector from `compose_agent_profile`.

**Assessment.** Step 2b composes the profile in the command layer and passes it as `system_prompt`, the same way the Prime path does. That needs no hook. With that design, policy stays the only real hook, and Phase 3 closes as skipped. The 2c log does not need a hook either. The engine writes it from the events it already receives.

**If a second hook does appear** (for example, persona must change per step, or a logging interceptor is needed):

1. Named hook points only: `pre_step`, `on_request`, `pre_tool`, `post_tool`, `turn_stopping`.
2. `src-tauri/src/rhizome_loop/hooks.rs`. Plugins are Rust trait objects compiled into the app. Registrations unwind on drop.
3. Move policy onto the trait. Add the second plugin. Delete `on_after_tool_for_test` if `post_tool` replaces it.
4. No Cordis, no `dsh`, no Node sidecar, no third-party script in process.
5. Tests: the three in parent plan §4 Phase 3.

**If no second hook appears:** a docs-only PR (or a line in the step 4 PR) records "Phase 3 skipped: one hook only (policy). Persona is composed in the command layer." Do not merge an empty framework.

---

## 8. Decisions (knispo, 2026-10-10)

These answer the ten questions in the first draft. Agents treat them as settled.

| # | Topic | Decision | Steps it changes |
|---|---|---|---|
| D1 | Toggle home | Settings. One control only. Prime stays the default. | 4 |
| D2 | Native model | One picker with catalog models and "Free tier (auto)". The default is a specific catalog model. When the entry shows is set by D11. | 2b, 3, 4 |
| D3 | `create_note` approval | Limited tools: ask on every call. Power User: allow with no prompt. | 1a, 5a |
| D4 | Anthropic | Native launches with OpenAI-compatible providers only. 1b only deletes `stream_model_events` and ports its tests. Anthropic streaming comes after launch. | 1b, 2b, 4, 6a |
| D5 | Key migration | Move the 3 custom `open_ai_compatible` keys into the keychain one at a time: write, read back, then remove from the file. Delete the file only when empty. | 3 |
| D6 | Fallback order | Fixed per ADR-0182. Settings shows it read-only. No reorder. | 3 |
| D7 | Lanes | Cursor: 1a loop part, 2a, 2b, 2c, 4, 4a, 4c. Claude: 1a helper, 1b, 1c, routing, keychain and keys, free-tier settings backend and UI. | all |
| D8 | `keyring` crate | Approved. ADR in the step 3 PR. | 3 |
| D9 | `api_model` target | Moves to the native engine in step 6, not in step 4. | 4, 6 |
| D10 | Resume | Required before launch. Native sessions reopen and continue after a restart. New step 2c, before step 4. | 2c, 4 |

Three more answers, from notes N1 to N3 in the second draft:

| # | Topic | Decision | Steps it changes |
|---|---|---|---|
| D11 | Free-tier entry (was N1) | Show "Free tier (auto)" whenever the router has at least one provider it can use. A user endpoint with no key counts. This replaces "only when a key is saved". | 3, 4 |
| D12 | Step 6 if 6a slips (was N2) | Step 6 still moves the OpenAI-compatible callers to the native engine. The old Anthropic call stays until 6a lands. | 6a, 6 |
| D13 | Grants after a restart (was N3) | Grants do not carry over. A reopened session starts with no grants, so `bash` is asked again. The reopen warning says so. | 2c, 4 |

**2c ADR (knispo, 2026-10-10).** The held list is decided in
[ADR-0183](../adr/0183-save-native-chat-sessions.md). Status `active`.

- Secrets: known-credential filter on messages and tool results. No
  encryption and no user-picked exclusions before release. The filter
  cannot catch every secret.
- Two windows: the native engine owns writes. One turn at a time.
  Process lock against a second instance.
- Damage: stop at the first invalid line, including middle damage. Show
  the verified prefix. Continue in a new session. Never skip damaged
  lines.
- Size: 100 MiB per session log, 1 MiB per tool result. Mark truncated
  results. Require a new session before the cap. Do not silently drop
  history.
- Key migration crash (step 3): write to the keychain, verify retrieval,
  then remove the old copy. On crash, verify then finish removal. If
  verify fails, keep the old copy. Never log key values.

---

## 9. Parked (not in this plan)

- GLM 5.3 against NVIDIA's own catalog.
- GitHub Models, until checked against GitHub's own docs.
- Usage dashboard and outward gateway.
- Native keep-running: a native turn that keeps working after quit. This stays parked. Quit still cancels a native turn. Resume after restart (2c) is in scope and is a different feature. 2c reopens a session that quit stopped. It does not keep a turn running.
- Per-vault `AGENTS.md`.
- Client-side enforcement of NIM's ~40 requests/minute limit.
- Issue #48 (sidecar gateway). Proposed: close it under ADR-0182.
