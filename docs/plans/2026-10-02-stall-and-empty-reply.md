# Stall, then the empty chat line

**Origin:** Cursor Grok 4.7 · 2026-10-02.

Two bugs. Do them in this order. Do not wait on the Opus review of the 28 September stall notes. Those notes still hold the mechanism: [`2026-09-28-rhizome-stall-plan.md`](2026-09-28-rhizome-stall-plan.md).

Do not click **Update now**. That installs the Chat engine. The button already runs `prime-agent update`. Issue #26 is closed.

Do not revert the uncommitted vault-index gate or the **Source** control. Do not start OmniRoute, the model list, or the other open issues while this plan is in progress.

## 1. Time the stall

The pinwheel shows when the app opens, when Settings opens, and when AI Agents inside Settings opens. Atticus said the slowness is the whole app. Those three are where it shows.

On this machine, with the real vault and a live Prime daemon, record what the main thread is doing during each moment. `sample` on the Rhizome process during the click is enough. Write the numbers here before changing code.

The code allows a synchronous Prime command to sit on the main thread for up to 30 seconds (`DAEMON_RESPONSE_TIMEOUT` in `src-tauri/src/prime_session_host.rs`). Startup calls `ensure_prime_session_host` and `get_prime_session_host_status` immediately, then every 4 seconds (`usePrimeHostStatus`). AI Agents then calls `get_available_prime_models`, which can create a session on that same thread.

`prime-agent --version` was 0.07 seconds on 2026-09-27. That probe is not the pinwheel by itself.

If the sample is the web view and not the Rust process, do not move the commands yet. The Settings tree and the eager locale JSON are the next suspects. They are listed in the 28 September plan.

### Timing, before the code change

**Origin:** Cursor Grok 4.7 · 2026-10-02. Installed app `/Applications/Rhizome Agent.app` (0.1.0). Vault on screen: Rhizome Vault. Prime daemon started with the app (`prime-agent` 0.9.8). `sample` every 1 ms. A hit is about 1 ms on the main thread. Idle means `mach_msg2_trap` inside the event loop. The window can move while the thread is idle.

| Moment | Window | Main-thread hits | Idle | Blocked | What held the thread |
|---|---|---|---|---|---|
| App open | 3 s, from about 5 s after launch | 1909 | ~0 | ~1.9 s | `preflight_chat` → `connected_providers` → `user_shell_bindings` → `Command::output` (~1.0 s). Then `git::is_inside_work_tree` on the same shell lookup (~0.6 s). Then `ensure_prime_session_host` → `find_node` (~0.1 s). |
| Settings open | 8 s, menu **Settings…** | 6134 | ~5.6 s | ~0.1 s | `ensure_prime_session_host` → `seed_vault_skill` → `find_node` → shell `poll` (108 hits). Under one second. Not the pinwheel by itself. |
| AI Agents open | 5 s, click **AI Agents** | 3872 | ~2.2 s | ~1.7 s | `get_prime_provider_status` → `provider_statuses` → `user_shell_bindings` → `Command::output`. |

The WebContent process during the AI Agents click was idle for about 3.0 s of 3.2 s. A style update was about 0.08 s. The stall is the Rust process, not the Settings tree.

`get_available_prime_models`, `list_vault`, and `prime-agent --version` did not appear on the main thread in these three samples. The 30 second daemon wait did not appear either. The block is a synchronous shell spawn on the UI thread.

## 2. Move the wait off the main thread

The before sample showed the Rust process blocked. The shell waits now run in `spawn_blocking`: `preflight_chat`, `get_connected_providers`, `get_prime_provider_status`, `ensure_prime_session_host`, `get_prime_session_host_status`, `get_available_prime_models`, and `is_git_repo`. The Prime version for the status poll is read from the package manifest before any `--version` process.

### Timing, after `spawn_blocking`

**Origin:** Cursor Grok 4.7 · 2026-10-03. Debug app `target/debug/RhizomeAgent`, pid 61180, already running (not a cold start). `sample` every 1 ms. A hit is about 1 ms on the main thread. Idle means `mach_msg2_trap` in the event loop.

| Moment | Window | Main-thread hits | Idle | Blocked | What held the thread |
|---|---|---|---|---|---|
| Settings open | 8 s, ⌘, | 5263 | 5263 | 0 | Event loop. No `Command::output`, no `user_shell_bindings`. Settings was on screen. |
| Settings section change | 5–6 s, Content, Packages, Appearance | 3401–4023 | all of them | 0 | Event loop. Packages drew its catalog. No shell spawn on the main thread. |

AI Agents was not the row the click landed on, so that one moment is not in this table. The before sample’s block (`get_prime_provider_status` → `Command::output`, ~1.7 s) did not appear on the main thread in any of these after samples. Cold start was not measured again. The installed app was not rebuilt.

Make these async, and do the blocking work in `spawn_blocking`:

- `ensure_prime_session_host`
- `get_prime_session_host_status`
- `get_available_prime_models`
- `get_prime_provider_status`

Do not hold the host mutex across a 30 second wait on the UI thread. Cache the Prime version from the package manifest so the 4 second poll does not spawn `prime-agent --version`.

Keep the vault index lazy. A chat-only launch must not call `list_vault`.

Opening Settings must not call `get_available_prime_models` until AI Agents is the section on screen.

Time the same three moments again. The window has to keep moving. If the model list is still empty for seconds after the beachball is gone, say so. Do not split the Settings tree until the second timing says the tree is the stall.

Rebuild `/Applications` only if Atticus asks.

## 3. The empty chat line

The sentence is `{Agent} finished without returning a reply.`

`finalResponseText` in `src/lib/aiAgentStreamCallbacks.ts` writes it when a turn ends with no assistant text. A turn that only thought, and never said anything, gets the same sentence. `onDone` skips the sentence when a turn boundary already sealed an empty accumulator.

Atticus sees this too often. After the stall sample, capture one live turn that shows the sentence. Record whether Prime sent text, only thinking, a tool result, or nothing. Then fix the case the capture shows. Do not replace the sentence with a nicer one and leave the empty turn in place.

## Done when

- The before-and-after timing note exists.
- App open, Settings open, and AI Agents open keep the window moving on this machine.
- One captured empty turn names why the reply was empty, and that case no longer shows the sentence for a turn that did produce an answer.
