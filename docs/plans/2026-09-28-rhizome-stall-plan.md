# Rhizome stall plan

**Origin:** Cursor Grok 4.7 · 2026-09-28. Revised the same day for a Claude Opus 5.5 review.

Execution order, 2026-10-02: do not wait on that review. Follow [`2026-10-02-stall-and-empty-reply.md`](2026-10-02-stall-and-empty-reply.md). This file stays the mechanism notes.

The app hangs with the macOS pinwheel. It is not only cold start. Atticus sees it when the app opens, when Settings opens, and when AI Agents inside Settings opens. He described those three as the places the stall shows, and the stall as the whole app.

This plan is enough to start the fix. It is not a timed proof. Nobody sampled the live process during a click.

## For the Opus 5.5 review

Opus is asked to push back on this plan, not to implement it. Grok 4.7 in Cursor will execute after the review. Astra is the interface redesign. This hang is not an Astra job.

Push on these claims. Each one can be wrong.

1. **The pinwheel is the AppKit main thread, not a frozen web view.** A synchronous Tauri command blocks the Rust process, and macOS shows the beachball. A long JavaScript task freezes the page inside WKWebView and can look the same to a person. Step 1 has to say which one the sample shows. If the sample is the web view, step 2 does not fix it.
2. **The 30 second daemon wait is what Atticus hits.** The code allows that wait. The live call was not timed. If `get_available_prime_models` returns in under a second on this machine, the 30 second constant is not the bug he feels.
3. **`prime-agent --version` on the 4 second poll is not the bug.** It measured 0.07 seconds. Opus should still check that `get_prime_session_host_status` calls `check_cli()` on every poll, because eight of those in a row, or one of them holding the host mutex, is a different cost than one `--version`.
4. **`list_vault` is not the Settings click.** `list_vault` is an async command. The uncommitted vault gate is a product decision (do not scan on a chat-only launch). It can still matter at startup. It does not explain Settings or AI Agents by itself.
5. **Moving commands to `spawn_blocking` is the whole fix.** The window can stay movable while the model list is still empty for seconds, because the host mutex is one lock. Atticus asked for the pinwheel to stop. He did not say a slow list with a spinner is acceptable. The review should say which bar is the goal.

Two bars, so the review can pick:

- **Bar A.** The window still moves during app open, Settings open, and AI Agents open. No beachball.
- **Bar B.** Those three moments also finish the visible update in about a second. The model list is on screen, not only a spinner.

This plan currently aims at Bar A, then checks Bar B only if the sample says the remaining wait is the thing he feels.

Alternate causes, not the lead, still worth a look in the review:

- `src/lib/i18n.ts` loads every locale JSON with `import.meta.glob` eager. The `src/lib/locales` directory is about 1.4MB. That is a startup parse cost. It does not run again when Settings opens.
- `SettingsPanel` is imported eagerly from `App.tsx` and renders every section in one scroll. The first Settings open pays that tree. Do not split it until the sample says the web view is the stall.
- C75 already covers an older cold-start blank and a slow Prime ready. Do not reopen it. C64 covers a false "Prime is not installed" flash on the first poll. Do not mix that flash into this hang.

Welcome additions: a better timing method than `sample`, a command that should be on the hot list, or a reason Bar A is the wrong goal. Unwelcome additions: a redesign of Settings, a new model picker, or a second plan that skips the sample.

## What was measured

On 2026-09-27, `prime-agent --version` took 0.07 seconds, twice. That probe alone does not explain a pinwheel.

No one timed these against the running app:

- `ensure_prime_session_host`
- `get_prime_session_host_status`
- `get_available_prime_models`
- the first paint of Settings
- the click that opens AI Agents

Do that before calling a slice done. A fix that only matches this document is not done.

## What the code allows

A synchronous Tauri command (`pub fn`, not `pub async fn`) runs on the app main thread. While it runs, the window does not process events. The cursor becomes the pinwheel.

These commands are synchronous, in `src-tauri/src/commands/ai.rs`:

| Command | What it does on the calling thread |
| --- | --- |
| `ensure_prime_session_host` | `ensure_host` |
| `get_prime_session_host_status` | `check_cli()`, which runs `prime-agent --version`, then locks the host |
| `get_available_prime_models` | `host.call` → `ensure_session` → wait up to `DAEMON_RESPONSE_TIMEOUT` (30s) |
| `get_prime_provider_status` | provider preflight |
| `get_prime_model_allow_list` | settings read |

`DAEMON_RESPONSE_TIMEOUT` is `Duration::from_secs(30)` in `src-tauri/src/prime_session_host.rs`.

Startup calls the first two immediately, then every 4 seconds. `usePrimeHostStatus(true, resolvedPath)` in `src/App.tsx` subscribes, and `tick` in `src/hooks/usePrimeHostStatus.ts` calls `ensure_prime_session_host` and then `get_prime_session_host_status`. The interval is 4000 ms. The first tick is not delayed.

Opening AI Agents mounts `PrimeProviderStatusSection`, `PrimeDefaultModelSection`, and `PrimeModelAllowListSection` once `loadModelCatalog` is true (`SettingsPanel.tsx`). Those sections call `get_prime_provider_status`, `get_available_prime_models`, `get_prime_session_host_status`, and `get_prime_model_allow_list`. `get_available_prime_models` can create a Prime session on that same thread.

`get_ai_agents_status` is already async and uses `spawn_blocking`. It is not the same bug. C75 already moved an earlier cold-start cost off the first paint. This plan does not reopen C75.

Settings is imported eagerly (`import { SettingsPanel } from './components/SettingsPanel'` in `App.tsx`). The panel renders every section in one scroll. The model catalog waits for an intersection observer, or for the panel to open already on the AI section. If that section is in view on open, the Prime calls start with the Settings click.

## Already in the working tree

Uncommitted, and not in `/Applications`:

- The vault index does not scan until the notes dock opens, or a note tab is already open. `notesDockRequested` in `src/App.tsx`. `loadIndex` in `src/hooks/useVaultLoader.ts`. Test: `useVaultLoader.startup.test.ts` ("does not scan the vault until the notes dock asks for the index").
- The note bar shows a pinned **Source** / **Editor** control. `BreadcrumbBar.tsx`. That is unrelated to the stall.

Atticus was explicit: do not load the vault on start. Keep the notes dock. Load the index when the dock opens. Keep that gate. It is not the whole stall. Settings and AI Agents still call Prime on the main thread after the scan is gone.

Do not revert those edits while you work on this plan. Do not commit them unless Atticus asks.

## Order of work

1. **Time the three moments.** On this machine, with the real vault and a live Prime daemon, record main-thread block time for app open, Settings open, and AI Agents open. `sample` on the Rhizome process during the click is enough. Write the numbers in the handoff. If a moment is under about one second, it is not the pinwheel. The pinwheel means the main thread stopped processing events.

2. **Move the hot Prime commands off the main thread.** Make `ensure_prime_session_host`, `get_prime_session_host_status`, `get_available_prime_models`, and `get_prime_provider_status` async, and do the blocking work in `spawn_blocking`. Do not hold the host mutex across a 30 second wait on the UI thread. Cache the Prime version from the package manifest (`prime_discovery` already reads `package.json`) so the 4 second poll does not spawn `prime-agent --version`.

3. **Keep the vault index lazy.** The uncommitted gate is the product decision. Confirm a chat-only launch does not call `list_vault`, `reload_vault`, `list_vault_folders`, or `get_modified_files`. A note window still loads its vault (`isNoteWindow()` forces the index).

4. **Stop Settings from calling Prime before AI Agents is the section on screen.** Opening Settings must not call `get_available_prime_models`. If the pinwheel remains after the commands leave the main thread, the next suspect is the Settings tree itself. Split the first paint to the nav plus one section. Do not do that split until step 1 shows the React tree is the stall.

5. **Rebuild only if Atticus asks.** Until then, `/Applications` still has the old behavior.

## Done when

- The timing note from step 1 exists, before and after the change.
- App open, Settings open, and AI Agents open each meet Bar A on this machine. Bar B is required only if the review or the sample says the remaining wait is the stall he feels.
- A chat-only launch does not scan the vault.
- Atticus can open Settings and AI Agents without the pinwheel. That last check needs the rebuilt app, or a `tauri dev` session he is watching. Do not claim it from unit tests alone.

## Not this plan

- Duplicate models in the AI Agents list, and whether the allow-list save sticks. Separate ask. Still open.
- Notes dock width, mycelium and the node map as icons, right-click mycelium report. Parked.
- Gate A harness cleanup. Parked.
