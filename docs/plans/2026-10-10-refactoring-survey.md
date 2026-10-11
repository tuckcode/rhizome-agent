# Refactoring survey — Rhizome Agent

**Origin:** DeepSeek Flash (DSH) · 2026-10-10 · read-only survey session, `main` @ `dbd94b96`
**Status:** survey only. No product code changed. Committed later as a docs-only PR.
**Scope:** whole tree — 154k lines of non-test TypeScript (848 files, 515 components) and 91k lines of Rust (~95 files), 808 test files. One axis per sub-survey: frontend components, hooks/state, Rust backend, tests/tooling.

---

## 0. How to read this

Every finding carries an evidence line, the smallest move that captures most of the value, and a risk note. Claims are labelled:

- **[V]** — verified in the survey session by reading code, counting, or running a command.
- **[I]** — inferred: the mechanism is verified, the consequence is not.

Counts were produced by scripted analysis, not estimation, except where a figure is explicitly marked as approximate. Two starting hypotheses were falsified during the survey and are recorded in §9 rather than deleted — the negative results are the point of a survey.

---

## 1. Executive summary

The single through-line: **this codebase extracts a seam, then re-draws it beside itself.** `callHost`, `find_cli_binary`, `is_auth_error`, the combobox, the IPC types — each is the same shape. The highest-leverage habit to change is not any one refactor; it is adding the ratchet (an ESLint rule, a baseline checker) *at the same time* as the extraction, which is what did not happen the first time.

| # | Finding | Area | Cost of leaving it | Effort |
|---|---|---|---|---|
| 1 | `callHost` seam re-drawn in 22 files; 116 raw `invoke` sites | IPC | 54 test files mock two modules; mock/browser paths already diverge | S |
| 2 | CLI binary discovery duplicated 451 lines / 8 files; canonical helper bypassed and **behind** a copy | Rust | a login-shell fix must land in 8 places | S–M |
| 3 | Active vault is two React states, 9 write sites, 3 unpaired | State | the divergent branch is the untested one | M |
| 4 | `AppAiWorkspaceSurface` is a 120-line zero-behaviour adapter | Components | test convenience dictates a production interface | S |
| 5 | No `Combobox` primitive; 6 siblings re-implement it (2337 lines) | Components | keyboard-nav bugs fixed 4×, no seam to test | M |
| 6 | `SettingsPanel` is a real god component (1741 lines, one export, ~70-field props) | Components | every section behind the same 70-name wall | M |
| 7 | `prime_session_host.rs`: 8 process-wide statics force `--test-threads=1` | Rust | serialized 2152-test suite on every push | M |
| 8 | 9 `is_auth_error` functions, 7 different needle sets | Rust | same failure classified differently per CLI (user-visible) | S |
| 9 | 67 hand-mirrored Rust↔TS types, zero generation, zero check | IPC | nothing fails to compile when a field is renamed | S–M |
| 10 | ADR-0003 claims `useEditorTabSwap` was deleted; it is 1205 live lines | Docs | an agent may delete live code on the ADR's authority | S |

Effort: S ≈ an afternoon, M ≈ a focused day.

---

## 2. Preconditions (repo hygiene)

- Working tree was clean and nothing unpushed when the survey started. Two untracked docs exist — `docs/plans/2026-10-10-harness-remaining-threads.md` (which itself says "Do not commit until knispo says so") and `docs/plans/paste-claude-plan-answers.md`. Both are deliberate, not stranded.
- **18 registered git worktrees**, several parked on the same commit. Relevant to the shared-tree collisions AGENTS.md keeps documenting. Not a code problem, but it is the environment this survey ran in.
- The survey wrote only one artifact, `src-tauri/target/rhizome-cov.lcov` (5.2 MB), which is inside gitignored build output.

---

## 3. Tier 1 — cheap, bounded, correctness-bearing

### 3.1 The Tauri IPC seam was extracted, then re-drawn beside itself **[V]**

`src/lib/callHost.ts` exists for exactly this. Its docstring quotes the four-line pattern it replaced and concludes: *"Callers should import `callHost` and never `invoke`."*

**Evidence.** Outside the adapter, non-test:

- **116** raw `invoke(` occurrences across **74** files.
- **22** byte-identical copies of the exact line the module was built to delete: `return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(...)`.
- **21** files define their own `tauriCall`/`call`-style helper; ~76 call sites go through local copies vs ~79 through `callHost`/`callHostOr`.
- **The copies have already drifted.** `args === undefined` appears in *only* `callHost.ts:30-31`, so 19 of the copies produce a different call shape. `src/hooks/vaultLoaderCommands.ts:54-56` passes **different arguments under mock**. `src/hooks/useSettings.ts:27-40` models a **third host tier** (a native bridge) that `callHost` does not have — the canonical adapter is less capable than one of its replacements.
- Cost: **54 test files must mock both** `@tauri-apps/api/core` *and* `mock-tauri`; 97 mock only `mock-tauri`.
- No guard: `eslint.config.js` has no `no-restricted-imports` rule.

**Why it matters.** The seam eroded once already. Fixing the call sites without adding the lint rule invites a third round. Every bypass also means that surface is unreachable in mock and browser runs — the failure mode the module was written to prevent.

**Smallest move.** Delete the local helpers; extend `callHost` with an optional `mockArgs` and a native-tier hook so `useSettings`'s shape becomes a supported option rather than a fork; add one `no-restricted-imports` rule for `@tauri-apps/api/core` outside `src/lib/callHost.ts`.

**Risk: LOW.** The 54 dual-mock files fail loudly as each migrates. One real hazard: `src/hooks/useAppSave.test.ts:14-20` mocks **React itself** to replace `startTransition`, pinning implementation rather than behaviour.

---

### 3.2 Rust binary discovery is duplicated 451 lines across 8 files, and the canonical helper is behind its own copies **[V]**

**Evidence.** Provider-neutral helpers, counted across adapter and `*_discovery` files:

| helper | copies |
|---|---|
| `user_shell_candidates` / `shell_candidates` | **9** (5 in the adapter cluster; also `cli_agent_runtime.rs`, `shell_env.rs`, `mcp/runtime.rs`, `git/mod.rs`) |
| `path_from_successful_output` | 7 |
| `first_existing_path` | 7 |
| `first_existing_path_for_platform` | 6 |
| `existing_path`, `path_lookup_command`, `find_binary_on_path`, `find_binary_in_user_shell` | 4 each |
| `command_path_from_shell` | 5 |

Roughly **451 duplicated lines**, plus duplicated tests — `first_existing_path_skips_empty_and_missing_lines` in 5 files, `windows_path_lookup_prefers_cmd_shim_over_extensionless_npm_script` in 3.

The seam already exists: `cli_agent_runtime::find_cli_binary` (`cli_agent_runtime.rs:593-609`) and `check_cli_availability` (`:699-712`). It is used by `hermes_discovery.rs:9`, `kiro_discovery.rs:9`, `prime_discovery.rs:50`. **`antigravity_/opencode_/pi_discovery`, `claude_cli`, `codex_cli`, `mcp/runtime` and `git/mod` all bypass it.**

**The decisive fact — the copies have diverged:**

- `pi_discovery.rs:71-80` retries with `-lic` after `-lc`, and has a regression test at `:384`. The canonical `cli_agent_runtime.rs:639-646` only tries `-lc`. **The shared helper is behind one of its duplicates.**
- `mcp/runtime.rs:128` uses `super::subprocess::command`, not `crate::hidden_command` — which is what suppresses the Windows console (`lib.rs:107-111`).
- `claude_cli.rs:161-180` needs a Claude-specific Windows predicate the shared version does not model.

**Cost evidence, not theory.** Commit `bee2ed0f` ("close C83 — the Rust suite passes on Windows") touched **9 adapter files in one commit**. That is the price of one platform fix here.

**ADR check.** `docs/adr/0093-shared-cli-agent-runtime-adapters.md` deliberately keeps *"binary discovery candidates"* per adapter — correct, and not what this proposes to change. The duplicated functions above carry **zero provider content**; they are path-resolution machinery. ADR-0093's own rationale ("small runtime fixes had to be repeated across several adapter files") argues for moving *these* into `cli_agent_runtime`. That is a refinement, so it needs a superseding ADR.

**Smallest move.** Promote pi's `-lic` retry into `cli_agent_runtime::command_path_from_shell` first, then route the three old-generation modules (`antigravity_discovery`, `opencode_discovery`, `pi_discovery`) through `find_cli_binary` + `check_cli_availability` exactly as `hermes_discovery`/`kiro_discovery` already do. Delete the orphaned clusters and their duplicated tests. `claude_cli`/`codex_cli`/`mcp/runtime`/`git/mod` are a second, larger slice.

**Risk: LOW.** Fanout is module-local; no `#[tauri::command]` signature changes; `find_binary()` keeps `Result<PathBuf, String>`. The only behaviour change is that every agent inherits the `-lic` retry and the console-suppressed command builder — both strict improvements, both already tested.

---

### 3.3 The active vault is two React states with asymmetric writes **[V]**

**Evidence.** `src/hooks/useVaultSwitcher.ts:501-502` declares `vaultPath` and `selectedVaultPath`. Nine write sites; only two write both:

- `setVaultPath`: `:389`, `:396`, `:724`, `:815`
- `setSelectedVaultPath`: `:390`, `:723`, `:789`, `:805`, `:811`
- Paired at only `(:389,:390)` and `(:723,:724)`, inside `switchVaultPath`.
- **Unpaired:** `:396` sets `vaultPath` alone, leaving `selectedVaultPath === null`. `:789` and `:805` set `selectedVaultPath` alone; the remove-last-vault branch nulls it and **never clears `vaultPath`**, then returns.
- The guard at `:787-790` is **asymmetric**: the outer test is `if (vaultPath !== removedPath)`, with the `selectedVaultPath` check nested inside. Divergence on either side skips the correction.
- Persistence splits them too: `saveVaultList` (`:490`, `:677`) persists only `selectedVaultPath`.

Four owners of one logical value: this hook, `src/App.tsx:305-309` (`resolvedPath`, **75 references** — the de-facto source of truth), `src/hooks/useVaultLoader.ts:160-166` (a ref mirror), `src/hooks/useOnboarding.ts` (`state.vaultPath`). Plus 76 components receiving `vaultPath` as a prop.

**Enabling mechanism:** the file declares `Dispatch<SetStateAction<…>>` **51** times and threads `setSelectedVaultPath` as a function parameter **26** times — so every helper may write one without the other, which is exactly what happened.

**Why it matters.** There is no vault module: there is a variable name with four owners, and the invariant *"effective = selected, or the resolved default when nothing is remembered"* is re-implemented at each write site. Locality is zero.

**Smallest move.** One reducer owning `{ active, remembered }` with a single `applySelection()` as the only writer; make `shouldPreferOnboardingVaultPath` an input to it, not a peer arbiter in `App.tsx`.

**Risk: MEDIUM.** `useVaultSwitcher.test.ts` asserts the two-state shape directly at `:197-198`, `:225-226`, `:265-266` — those assertions must be rewritten, which is the point. Blast radius is wide (App.tsx, useVaultLoader, 76 components) but the tests are behavioural. **Real gap:** the divergent last-vault branch is *untested* — the remove tests at `:526-541` assert only the toast, and `:547` comments "Add another vault first so we're not removing the last one."

---

### 3.4 `AppAiWorkspaceSurface` is a 120-line adapter with no behaviour **[V]**

**Evidence.** `src/components/AppAiWorkspaceSurface.tsx` is 120 lines. Its `AppAiWorkspaceSurfaceProps` has **34** fields; `AiWorkspaceProps` in `src/components/AiWorkspace.tsx:72-112` has **34** fields; the symmetric difference of the two name sets is **empty**. Optionality differs on exactly **9** fields (`defaultAiAgent`, `defaultAiAgentReadiness`, `defaultAiAgentReady`, `entries`, `locale`, `mode`, `noteList`, `noteListFilter`, `openTabs`) — that is the file's entire reason to exist. It destructures all 34 and re-emits all 34 in a different order.

It is the **only non-test route** into the 1121-line `AiWorkspace` (imported at `src/App.tsx:38` and `src/components/AiWorkspaceWindowApp.tsx:32`). **Zero tests name it.**

**Cause [I]:** `src/components/AiWorkspace.test.tsx:192` renders `<AiWorkspace>` with 6 of 34 props, so 28 were loosened to optional — and a production caller was handed a duplicate strict interface.

**Why it matters.** This is a **fake seam**. The interface at the AI boundary is a hand-maintained copy: 34 names × 3 sites of connascence-of-name, zero depth. Any future *optional* prop added to `AiWorkspaceProps` will silently not be forwarded, and TypeScript will not complain. It inverts leverage: 120 lines of shim gate a 1121-line component, and test convenience dictates the production interface.

**Smallest move.** Make those 9 props required and delete the file (2 call sites), giving the test a local `renderWorkspace(overrides)` helper. Three-line alternative: `type Props = AiWorkspaceProps & Required<Pick<AiWorkspaceProps, …>>` then `return <AiWorkspace {...props} />`.

**Risk: LOW.** No test on the surface; `AiWorkspace.test.tsx` (736 lines) exercises `AiWorkspace` directly; `App.test.tsx` (1813 lines) and the smoke lane cover both mounts. Only failure mode is a missing prop, which TypeScript reports.

---

### 3.5 No `Combobox` primitive; six siblings re-implement it in 2337 lines **[V]**

**Evidence.** Worst component-layer pair: `TypeSelector.tsx` ↔ `WorkspaceSelector.tsx` share **26 five-line shingles (~130 duplicated lines)** — exact runs at `TypeSelector.tsx:12-17, 58-63, 288-296, 309-314, 349-353, 369-373, 409-413, 431-439, 447-453, 467-474` matching `WorkspaceSelector.tsx:9-14, 80-85, 188-196, 209-214, 251-255, 271-275, 314-318, 336-344, 352-358, 372-379`.

Both independently define `MIN_POPOVER_WIDTH`, `OPEN_COMBOBOX_KEYS`, `normalizeXQuery`, `buildXOptions`, `initialHighlightedIndex`, `shouldOpenCombobox`. `initialHighlightedIndex` and `shouldOpenCombobox` appear in **3** files; `stepHighlightedIndex` in **4**.

Separately `StatusDropdown.tsx` ↔ `TagsDropdown.tsx` share **11 shingles (~55 lines)**, plus same-named local components `ColorPickerRow` (`:39` / `:38`) and `SectionLabel` (`:117` / `:103`), a byte-identical pill style block (`:19-30` ≡ `:18-29`) and a byte-identical "Create \<pill\>" row (`:393-405` ≡ `:352-364`).

Six files, **2337 lines**, for one widget shape. `src/components/ui/` has `select.tsx` and **no combobox**.

**Why it matters.** The missing abstraction is a genuine deep module: a `Combobox<TOption>` absorbs open/close, query state, highlighted index, arrow/Enter/Escape handling, `role="combobox"` / `aria-activedescendant`, popover sizing and option rendering. Today a keyboard-nav bug must be fixed in four places and there is no single seam to test. A reviewer of a status-dropdown keydown change cannot see the same logic in `TagsDropdown`.

**Smallest move.** Add `src/components/ui/combobox.tsx` and convert the worst pair first (`TypeSelector`/`WorkspaceSelector`, ~130 lines removed), leaving the rest to migrate opportunistically. **Keep the per-widget option builders** — they are the real differences.

**Risk: LOW–MEDIUM.** Good tests to lean on: `TypeSelector.test.tsx` (115), `WorkspaceSelector.test.tsx` (97), `StatusDropdown.test.tsx` (161) + `.extra` (59), `TagsDropdown.test.tsx` (149), plus smoke specs. Main hazard is losing a subtle matching-semantics difference between `buildTypeOptions` and `buildWorkspaceOptions`.

---

## 4. Tier 2 — frontend components

### 4.1 `SettingsPanel.tsx` is a real god component **[V]**

1741 lines, **one export** (`:386`), and at least five unrelated responsibilities: the settings draft/persistence model (`createSettingsDraft` `:258`, `buildSettingsFromDraft` `:333`, the three `resolveSettingsDraft*`/`resolveTelemetryConsent`/`resolveAnonymousId` resolvers, `sanitizePositiveInteger` `:369`); a DOM/theme side effect (`applyAppearanceSelection` `:374-385`); keyboard-shortcut matching (`:247`); overlay-nesting detection (`:251`); two IntersectionObserver lazy-mount effects (`:823-882`); and **16 inline UI sections** from `:664` to `:1727`. Plus `interface SettingsBodyProps` at `:166` — I counted **68** fields, spread wholesale into three children at `:871-874`.

**Precedent:** `src/components/` already contains seven extracted siblings — `AboutSettingsSection.tsx`, `AiProviderSettings.tsx`, `GitSettingsSection.tsx`, `PrivacySettingsSection.tsx`, `SessionImportSettingsSection.tsx`, `VaultContentSettingsSection.tsx`, `WorkspaceSettingsSection.tsx`. The extraction was started and abandoned, so this is **mechanical completion, not design**.

**Why it matters.** A ~70-field props object is not an interface — it is the absence of one. Each section's true dependency set is 3–8 names, and nothing in the code expresses that, so no seam narrower than "everything" exists. An autosave-row change can break the AI-agent section invisibly.

**Smallest move.** Split the three wrapper groups and their leaves into per-section files, each with its own 3–8 field props. Leave `SettingsPanel` as shell + draft/persist. **Do not** also fix the 70-field object in the same pass.

**Risk: MEDIUM–LOW.** `SettingsPanel.test.tsx` (1445 lines) tests through the exported panel, so it is structure-insensitive and should survive a file split. Hazards: the observers key on `document.getElementById(SETTINGS_SECTION_IDS.ai/extensions)` so section DOM ids must survive (`settingsSectionIds.ts`), and `applyAppearanceSelection` must not be duplicated.

### 4.2 `App.tsx` — corrected: not a god component, but two mounting defects **[V]**

An early hypothesis that `App.tsx` is a tangled god component was **falsified**. It is already decomposed: 64 `from './hooks/'` imports, ~50 distinct hooks, and the inline mass is wiring, not logic — the 81 `useCallback` blocks total ~695 lines at a **median of 4 lines**. Imports L1-188; body L200-2109 (78%); JSX L2110-2510 (401 lines, 16%).

Its real defects are narrower:

- **`<Editor>` is mounted twice** (`:2178` and `:2320`), 77 props each, with **74 byte-identical prop lines**. The entire difference is 4 lines vs 3, and it is exactly the AI-surface wiring (`leadingControl`, `showAIChat`, `onToggleAIChat`, `aiWorkspaceSurface`) — the part most likely to change. A prop added to one shell and not the other is a silent feature gap in the branch every route passes through.
- **A 101-line overlay tail** (`:2410-2510`) with **186 prop bindings over 122 distinct names from 15 hook objects**, plus `<StatusBar>` at `:2412` as a single **2159-character line carrying 49 props**.

**Smallest move.** Two independent steps: (a) hoist the shared props into one `editorPaneProps` (or a local `<NoteEditor>` whose only varying inputs are `aiWorkspaceSurface`/`showAIChat`) and render at both sites — ~74 lines gone and the shells identical by construction; (b) move `:2410-2510` into an `<AppOverlays>` receiving the already-bundled hook objects.

**Risk: MEDIUM for (a)** — the shells render in different layouts, so preserve per-shell wiring and land them as separate commits. **LOW for (b)** — pure JSX relocation.

### 4.3 `useNoteListModel` has no interface at all **[V]**

43 destructured inputs (`:678-722`), ~57 returned keys, of which **55 are pure pass-throughs** (`params.X.Y`), 12 of them three levels deep. `src/components/note-list/NoteListLayout.tsx:8` is literally:

```ts
type NoteListLayoutProps = ReturnType<typeof useNoteListModel> & { handleBulkOrganize?: () => void }
```

and `src/components/NoteList.tsx` (53 lines) forwards `<NoteListLayout {...model} />`. Real logic is ~25 lines (one keydown handler, two effects).

**Why it matters.** The component's public prop type *is* the hook's return type, so adding a sub-hook field silently changes a component's props. The module makes no decisions; it renames.

**Smallest move.** Delete the `ReturnType<…>` alias so the layout takes the already-existing `NoteListProps`; group the 57 flat keys into `state`/`actions`.

**Risk: LOW.** No `useNoteListModel.test.*` exists, but `NoteList` is protected by five component tests plus the smoke suite. The one internal-pinning test is `noteListHooks.extra.test.tsx` (4 `vi.mock`).

### 4.4 `StatusBar.tsx` re-lists 39 props for no reason **[V]**

`StatusBarPrimaryFromFooter` (`:116-205`, 90 lines) destructures **39** props and re-emits the **identical 39 names** to `StatusBarPrimarySection` — I diffed the two name sets and they are the same, in the same order. The function body could be `({...props}) => <StatusBarPrimarySection {...props} />`.

**Why it matters.** ~90 lines of pure re-listing in a file already spread four ways (`:267-268` and `:283` do use `{...props}` correctly, which makes the named version look deliberate).

**Smallest move.** Replace the destructure-and-re-emit with a spread.

**Risk: LOW.** Covered by `StatusBar.test.tsx` (955 lines) plus four `status-bar/*.test` files. The surrounding prop-drilling problem is large but diffuse — 342 `locale={locale}` and 242 `onClose={onClose}` forwarding sites repo-wide — and this is worth doing *because* it is bounded, not because it fixes that.

### 4.5 The "always use shadcn/ui" rule is violated inconsistently **[V]**

Counts over `src/**/*.tsx`, excluding tests, `testUtils`, `src/components/ui/**` and `mock-tauri`: **115 raw `<button>` in 57 files; 13 raw `<input>` in 10 files; 1 raw `<select>`; 0 user-facing raw `<textarea>`.**

Clearest offenders: the raw `<select>` at `src/components/SessionActivityHistory.tsx:91-94` (`aria-label="Activity session"`, while `ui/select.tsx` exists); raw inputs at `TagsDropdown.tsx:264`, `StatusDropdown.tsx:325`, `inspector/RelationshipsPanel.tsx:422` and `:609`, `AiPanelChrome.tsx:814`, `PrimeModelPicker.tsx:294`, `SearchPanel.tsx:487`, `PropertyValueCells.tsx:198`, `ColorInput.tsx:42` and `:135`, `EditableValue.tsx:13`. Documented exception to exclude: `MenuBarCompanionApp.tsx:201` (justified at `:18-25`).

The decisive evidence that this is inconsistency rather than a missing primitive: **42 files already import shadcn `Input`**, and **19 files use both** shadcn `<Button>` and raw `<button>`.

**Concrete behaviour gap, not just styling:** `src/components/ui/input.tsx:11` applies `nativeTextAssistanceDisabledProps` (`spellCheck: false`, `autoComplete: 'off'`) from `src/lib/nativeTextAssistance.ts`, and its runtime installer `observeNativeTextAssistanceDisabled` is called in exactly one place — `src/components/SingleEditorView.tsx:34`. So every raw input **outside** the editor keeps native spellcheck and autocomplete. No test asserts `spellCheck` or the wrapper component.

**Smallest move.** Do **not** convert 115 buttons. Take the 14 input/select sites (11 files) — 12 of the 13 inputs hand-roll the same visual treatment, so it is mechanical — and add one `no-restricted-syntax` ESLint rule scoped to `src/components/**` (exempting `ui/**`) so the fix ratchets.

**Risk: LOW per site, MEDIUM across the batch.** Watch `data-testid="color-picker-input"` and `"boolean-toggle"`.

---

## 5. Tier 2 — Rust backend

### 5.1 `prime_session_host.rs`: the defect is process-wide statics, not size **[V]**

9860 lines total, of which **4226 are production** (`#[cfg(test)] mod tests` starts at 4227) and 5633 are tests, with **190 `#[test]`**. It is also the **most-churned code file in the repo — 82 changes in 90 days**.

**8 process-wide mutable statics:** `last_problem` (`:119`), `NEXT_REQUEST_ID` (`:143`), `HOST_SUSPENDED` (`:145`), `LAST_SETTLE_KEEP_DAEMON` (`:148`), `spawned_daemon_pid` (`:158`), `host_slot` (`:714`), `ROSTER_IN_FLIGHT` (`:3182`), `CLIENT_ID` (`:3351`). Plus a `TEST_LOCK` at `:4239` whose own comment explains why: *"The host registry is a process-wide `OnceLock`, so parallel tests otherwise tear down each other's connection mid-assertion… It also guards `RHIZOME_PRIME_DAEMON_SOCKET`, which is process-global."*

**The measurable consequence:** `.husky/pre-push:270` runs the entire **2152-test** Rust suite with `-- --test-threads=1`. That is a per-push tax paid forever.

Also inside: `impl PrimeHost` spans `:3356-4046` — **691 lines, 27 methods** — over a **30-field** struct (`:734-793`) mixing transport, session identity, model state, naming, capabilities and turn state.

**Counter-evidence to record:** the production region contains **zero** `unwrap()`/`expect()`. Crate-wide, only four files over 300 lines have any production unwrap (max 4). The testability defect here is global mutable state, not panics.

**Smallest move.** Extract the daemon process/socket band (~**450** production lines) into `prime_daemon_process.rs`, keeping the four public names and their signatures. External callers are only **4 sites** (`lib.rs:413`, `:432`, `:440`, `:656`).

**Risk: MEDIUM.** `TEST_LOCK` must be shared by both modules' tests during the transition or the race returns. Does not touch the Tauri command contract. Do it with `cargo test` per step, not in one commit.

### 5.2 Per-adapter error mapping: 7 different auth-needle sets **[V]**

Nine `is_auth_error`-family functions, with **seven different needle lists**: `kiro_cli.rs:114` `["auth","login","token"]`; `codex_cli.rs:485` `["auth","login","sign in"]`; `antigravity_cli.rs:46` (8 needles); `hermes_cli.rs:289`; `opencode_events.rs:177`; `pi_events.rs:158`; `claude_cli.rs:505`.

**Verified drift:** `pi_events` catches `"401"` and `"api.key"`; `opencode_events` catches neither, although both surface the same provider auth failures. `kiro_cli` misses `"sign in"`, `"unauthorized"` and `"api key"`.

Plus **6** copies of the identical stderr-tail branch (`lines().take(3)…join`) and **8** copies of `format!("{program} exited with status {status}")`, differing only by program name. `antigravity_cli.rs:46-59` and `hermes_cli.rs:289-302` are the same code with different strings. The `rhizome:i18n-error:` + `localized_error` helper is written out **3** times.

**Why it matters.** The adapter is exactly the thing that should hide protocol differences — but here the *policy* (what counts as an auth failure) is duplicated per adapter, so it cannot be reviewed or changed in one place. This is a missing seam where the adapters genuinely differ only in **data**: program name, hint text, needle list. It is also user-visible: it is the difference between "run X login" and a raw stderr dump.

**Smallest move.** `format_cli_error(spec: CliErrorSpec, stderr, status) -> String` in `cli_agent_runtime.rs` with `CliErrorSpec { program, auth_hint, needles }` plus a `DEFAULT_AUTH_NEEDLES`; each adapter keeps only a `const` spec.

**Risk: LOW–MEDIUM.** It **does** change user-visible text, so unify the needles in a separate commit from the de-duplication.

### 5.3 The `run_*_via_*` triad: 10 suppressed lints and two test-only public functions **[V]**

Eleven `#[allow(clippy::too_many_arguments)]` sit in production code — the linter naming a wide-interface problem that is suppressed rather than fixed. Ten are in `rhizome_import`, `rhizome_distill` and `rhizome_repo_research`. The shape is a two-hop pass-through chain duplicated across two modules:

```
run_import_via_agent(vault, source, project, trigger, agent, on_line)
  → run_import_via_target(…, target: AiRunTarget, on_line)
     → run_import_via_target_with_model_runner(…, model_runner: R)
```

`run_distill_*` is the same triad with `text`/`kind` instead of `source`.

**And two of the three public wrappers are reachable only from `#[ignore]`d live tests:** `run_import_via_agent` (`rhizome_import.rs:376`) is called solely at `:749` inside a `#[ignore]` test; `run_distill_via_agent` (`rhizome_distill.rs:272`) solely at `:706`, likewise. Both are one-line wrappers over `run_*_via_target` that exist to shorten a skipped test.

**Smallest move.** A parameter struct collapses the argument lists; deleting the two test-only wrappers removes 2 of the 11 suppressions. Inline `AiRunTarget::Agent(...)` in the live tests.

**Risk: LOW.** No command-contract change; the live tests keep working.

### 5.4 Two dead seams, one of which contradicts ADR-0180 **[V]**

- **`engines::Engine` is unwired.** `lib.rs:71` (`pub mod engines;`) sits directly under `lib.rs:70`: *"Loop and engines compile now. Chat must not call them until Phase 6."* Grepping `engines::`, `EngineEvent`, `dyn Engine`, `impl Engine`, `*Engine` outside `src-tauri/src/engines/` returns **zero hits**. It is 342 lines with 5 passing tests, and its `EngineEvent::{Text, Cancelled}` / `start(&mut self, prompt)` shape does not line up with the live `AiAgentStreamEvent` / `AgentStreamRequest` — so it cannot be adopted without a rewrite.
- **A second dead seam:** `define_desktop_stream_command!` (`commands/ai.rs:77-97`) has exactly **one** call site (`:172-177`, generating `stream_claude_chat`, registered at `lib.rs:759`). No file under `src/` listens for its `"claude-stream"` event — grepping returns only `src/mock-tauri/mock-handlers.ts:951` and its test, though `docs/ARCHITECTURE.md:1778` documents it.

**Why it matters.** Unwired code that reads as the intended design is worse than no code: the next agent either wires a shape-incompatible trait or adds a third vocabulary. ADR-0180 says Rhizome owns its own harness — so an unwired trait under a "Phase 6" comment is a trap, not a plan.

**Smallest move.** Make an explicit decision on `engines/`: delete it, or open a C-number in `HANDOFF.md`. **Do not** leave it undecided. For `stream_claude_chat`, confirm with the owner before deleting — the missing frontend caller is not proof, since ARCHITECTURE.md documents it.

**Risk: LOW** by construction (zero references); touches `lib.rs:70-71`.

### 5.5 The Rust↔TypeScript type surface has no generator and no checker **[V]**

**209** distinct `pub struct`/`pub enum` names exist in Rust; **67** of them are re-declared by hand in `src/**.ts(x)`. **Zero generation** — no `ts-rs`, `specta`, `tauri-specta` or `typegen` in `Cargo.toml` or `package.json`. **Zero verification** — the only script that reads Rust from JS, `scripts/check-prime-surface.mjs`, diffs *Prime's* command names, not Rhizome's own IPC types. There are **11 explicit hand-mirror comments** (e.g. `src/hooks/usePrimeHostStatus.ts:8`, `src/lib/primeModels.ts:4`).

**Two serialization conventions coexist:** 88 structs are `#[serde(rename_all = "camelCase")]`, while `Settings` (`settings.rs:118`) has no `rename_all` and is snake_case — pinned only by a test comment at `settings.rs:736-742` warning that adding one *"would silently blank the Settings panel's token field."*

**54 of 169 commands return bare `String`** (untyped payload, `JSON.parse` plus hand-cast on the TS side).

**Why it matters.** The IPC boundary is the crate's widest interface and it is not a module — it is 67 uncoupled pairs. Nothing fails to compile when a Rust field is renamed, so drift is silent in exactly the place where silence is most expensive. It also multiplies the cost of every other Rust-side refactor.

**Smallest move.** `scripts/check-ipc-types.mjs` modelled on `check-prime-surface.mjs`: extract serde types and fields from Rust (honouring `rename_all` and `#[serde(rename)]`), extract TS declarations, fail on a missing twin or field mismatch, ship with a **committed baseline** so the 67 existing pairs are grandfathered. No Rust change, no build step, no codegen dependency. `ts-rs` on the ~10 highest-churn types is the follow-up.

**Risk: LOW** for the checker. The first run legitimately reports the existing 67, so it must ship baselined rather than as a hard gate.

### 5.6 `claude_cli` is the single event-type bypass **[V]**

To answer the obvious question directly: the request type **is** unified — `AgentStreamRequest` has exactly one definition (`cli_agent_runtime.rs:22`), consumed by all 7 adapters. Process spawning is **not** duplicated — all 7 use `cli_agent_runtime` helpers. The event type is the gap: 6 of 7 emit `AiAgentStreamEvent` (`ai_agents.rs:68`), while `claude_cli` defines its own `ClaudeStreamEvent` (`claude_cli.rs:44-72`) requiring a **33-line** mapper `map_claude_event` (`ai_agents.rs:323-355`) and a special-cased arm.

There is no CLI-adapter trait; dispatch is an 8-arm match (`ai_agents.rs:197-241`) funnelling 6 arms through the generic `run_shared_agent_stream` (`:295-313`). That generic *is* the seam — a function parameter, not a type, and the ADR explicitly rejected a trait object. That is fine; the event duplicate is not.

**Smallest move.** Make `claude_cli::run_agent_stream` emit `AiAgentStreamEvent` (keeping `Result { text, session_id }` as a `TextDelta` plus a session-id update). Two files, ~50 lines; `map_claude_event` and the special-cased arm disappear.

**Risk: MEDIUM.** 40+ test assertions across `claude_cli.rs:903-1330` name the variants, so it is wide even though shallow — give it its own commit.

### 5.7 A genuine false seam in the test suite **[V]**

`cli_agent_runtime::parse_json_line` (`:361`) and `parse_ai_agent_json_line` (`:399`) are `#[cfg(test)]`-only, as are `pi_events::parse_line` (`:8`) and `opencode_events::parse_line` (`:4`). Production goes through the **different** `parse_process_stdout_line` (`:374-391`), whose only behavioural difference is recording invalid lines for diagnostics. So two malformed-line tests assert the behaviour of a parser production never runs.

**Smallest move.** Call the production function, or delete the test-only copies. Two lines.

### 5.8 A cheap extra: `run_blocking` is private while its logic is hand-rolled 25 times **[V]**

`commands/ai.rs:370` defines `run_blocking`, **private**, used 6 times inside `ai.rs`. Meanwhile **25** raw `tokio::task::spawn_blocking` sites elsewhere in `commands/` hand-roll the same thing with **12** copies of `.map_err(|e| format!("<X> task failed: {e}"))`.

**Smallest move.** Make it `pub(crate)` and route those 25 sites through it. About an hour. Not Tier 1 only because it is mechanical cleanup rather than a correctness or testability fix.

**Genuinely thin command-module coverage** (from the coverage run in §6): `commands/ai.rs` — 80 commands in 1180 lines with 10 tests, at **17.0%** production coverage; `commands/system.rs` — 710 lines, 35 commands, 6 tests, **20.4%**; `commands/git.rs` — 592/36/2; `commands/sheet.rs` — 679/1/3.

---

## 6. The Rust coverage gate is measuring test code **[V — measured]**

`AGENTS.md` and `.husky/pre-push:270` state the gate as **Rust line coverage ≥ 85%**, via `cargo llvm-cov … --ignore-filename-regex "lib\.rs|main\.rs|menu\.rs" --fail-under-lines 85`.

I ran it. Measured on this tree:

| | lines | % |
|---|---|---|
| **What the gate reports** | 46,996 / 54,542 | **86.16%** — passes |
| Test code (`mod tests` + `_tests.rs`) | 25,606 / 27,153 | 94.30% |
| **Production code only** | 21,390 / 27,389 | **78.10%** — fails the stated bar |

**Test code is 49.8% of the gate's denominator.** The metric that reads "Rust line coverage ≥85%" is a blend of roughly half test bodies that are 94% covered by definition, and production code at 78%.

**Why `--ignore-filename-regex` cannot catch it:** that flag filters **filenames**, and this repo's tests live *inside* the files they test. The extreme case is the module flagged in §5.1:

| file | inline test lines | production lines |
|---|---|---|
| `prime_session_host.rs` | 3,510 | 2,322 |
| `rhizome_loop/mod.rs` | 1,081 | 0 |
| `claude_cli.rs` | 702 | 488 |
| `settings.rs` | 690 | 348 |
| `mcp.rs` | 626 | 470 |
| `prime_sessions.rs` | 589 | 352 |

### Caveat — this run was not a clean gate verdict

12 tests failed, all `Operation not permitted`, because the sandbox blocked writes to `~/Library/Caches/com.tolaria.app/search/` and subprocess spawning. 2084 passed, 24 ignored. The failures hit `rhizome_search/mod.rs` (4), `rhizome_search/service.rs` (4), `rhizome_api.rs` (2), `claude_cli.rs` (1), `codex_cli.rs` (1).

**This does not change the conclusion, and the arithmetic shows why.** Closing the gap to 85% needs **1,891** more covered production lines; all the affected modules together contain fewer than ~400 uncovered production lines. Even if every failing test covered everything it touches, production coverage lands near **79.6%** — still ~5 points short. The gap is structural, not sandbox noise.

### Worst production-coverage modules (test files excluded)

| % | production lines | file |
|---|---|---|
| 0.0% | 221 | `bin/rhizome_tool.rs` — `main.rs` is excluded by the regex; this second entry point is not |
| 17.0% | 294 | `commands/ai.rs` |
| 20.4% | 285 | `commands/system.rs` |
| 25.4% | 126 | `mycelium_skin.rs` |
| 25.5% | 341 | `rhizome_search/mod.rs` |
| 26.6% | 184 | `mycelium.rs` |
| 26.9% | 108 | `prime_packages.rs` |
| 32.4% | 170 | `rhizome_jobs.rs` |
| 40.8% | 539 | `menu_bar_companion.rs` |
| 43.9% | 228 | `inbox_watcher.rs` |

Note that `commands/ai.rs` at 17.0% independently corroborates §5.8's "80 commands, 10 tests" from a completely different direction.

### The fix — and the trap inside it

The repo already has the right convention: **11 sibling test files** wired by `#[path = "…"] mod …;` (`vault/view_tests.rs`, `acp_client/client_tests.rs`, `pi_events_tests.rs`, …; declared at `vault/mod.rs:503-513`, `acp_client/mod.rs:16`). So: move the largest inline `mod tests` blocks into sibling `_tests.rs` files, then extend the regex to `_test(s)?\.rs`. The metric becomes a real production metric.

**But correcting the denominator drops the number from ~86% to ~78%.** Doing that without re-basing the threshold fails the gate on the very next push — which is precisely the failure mode AGENTS.md names: *"a blocking gate nobody can pass is a gate nobody trusts."* The threshold must move **in the same change**, set from the measured production number rather than aspiration.

**To get the exact number:** re-run with full filesystem access so the 12 sandbox-blocked tests execute. The lcov artifact from this run is at `src-tauri/target/rhizome-cov.lcov` (gitignored).

---

## 7. Documentation and doctrine

### 7.1 ADR-0003 says a live 1811-line module was deleted **[V]**

`docs/adr/0003-single-note-model.md` is `status: active` and its Consequences read:

> Removes ~2000 lines of code (`TabBar`, `useClosedTabHistory`, **`useEditorTabSwap`**, `tabLayout`) … Closed tab history and **`useTabManagement`** are removed.

`TabBar.tsx` and `useClosedTabHistory.ts` are indeed gone. But `src/hooks/useEditorTabSwap.ts` (**1205 lines**) and `src/hooks/useTabManagement.ts` (**606 lines**) are alive — and they are the *live* note-open fast path, governed by **ADR-0105** ("generation-checked, source-content-checked … bounded parsed-block cache") and documented as current design in `docs/ARCHITECTURE.md:125-127` and `docs/ABSTRACTIONS.md:230-232`.

**Why this is not a doc nit.** AGENTS.md's central warning is a gate staying green over unreachable code, and the repo already lost time to knip inviting the deletion of `mcp-server/cli-call.mjs`. Here an agent doing a dead-code sweep, or told to "finish removing the tab model", has a *binding ADR* telling it these 1811 lines are already deleted. Per repo rules ADR-0003 must be **superseded**, not edited.

I swept every active ADR for this pattern mechanically (removal verbs near backticked file names, then tested each path for existence): **ADR-0003 is the only true instance.** Two other hits were my regex catching sentence context.

### 7.2 ADR-0026 is superseded, which unblocks the `App.tsx` question **[V]**

`docs/adr/0026-props-down-no-global-state.md` ("`App.tsx` is the state orchestrator … no global state") is `status: superseded`, `superseded_by: 0115`. The doctrine that produced the current shape is no longer binding, so extracting state into real modules is permitted rather than forbidden.

### 7.3 A naming residue worth an ADR

`useEditorTabSwap` and `useTabManagement` keep tab-era names for a single-note swap pipeline. That is why ADR-0003 still reads as current. A short ADR recording "these modules are the note-open pipeline, not a tab model" would close the loop.

---

## 8. Tests, tooling, and configuration

### 8.1 The `@smoke` tag no longer means pre-push protection **[V]**

`playwright.smoke.config.ts` already sets `grep: /@smoke/` — but `playwright:smoke` in `package.json` passes an explicit **15-file list**, which overrides it. **51 spec files carry `@smoke`; 36 are never collected by any automated gate.** CI (`ci.yml`) has no Playwright step at all. `.husky/pre-push:273` uses that script, and `.chunk/run-playwright-smoke.sh:47-70` parses the same string, so the sidecar lanes inherit it.

**Why it matters.** AGENTS.md defines `@smoke` as what "protects a core pre-push workflow". 36 files assert that and do not have it — a regression in add-remote, autogit checkpoints, create-note-in-folder, editor-find-replace, vault-switch or table-hover-crash passes every gate. Same shape as the `AiAgentsBadge.tsx` story in AGENTS.md.

**Smallest move.** Either drop the file list and let the grep select, or remove `@smoke` from the 36 so the tag stops lying. A tag that lies is worse than no tag.

**Risk: MEDIUM for the first option.** Re-enabling 36 files will breach the documented <5 min smoke budget and will probably surface real failures — the median mtime of the 123 uncurated `tests/smoke` files is the bootstrap-import date, versus 2026-09-27 for the curated 15. Do it as a standalone triage change with `pnpm playwright:regression`, never inside a release push.

### 8.2 `vite.config.ts` is an untested, unscanned vault-write surface **[V]**

1089 lines, **86 top-level functions**. Lines 22-962 are a dev HTTP vault API with real `renameSync`/`unlinkSync`/`writeFileSync` (**13 fs mutations**) behind guards `ensureInsideVaultRoot` (`:42`), `resolveInside` (`:287`), `readVaultEndpointArgs` (`:661`). Grepping `src`, `tests` and `scripts` for references to it returns **nothing**. It is listed in `.codacy.yaml` `exclude_paths` and is outside coverage (`include: ['src/**']`, `vite.config.ts:1063`).

That combination — filesystem write surface, no tests, and no scanner — is the one that deserves attention first in this area.

**Smallest move.** Move the middleware to `vite/vault-api-plugin.ts`, leave ~40 lines of composition, unit-test the two pure guards, then drop `vite.config.ts` from `.codacy.yaml` since the real file is now scannable.

**Risk: LOW functionally, MODERATE diff** — the smoke suite depends on this server. Land it standalone with a full `pnpm playwright:regression`.

### 8.3 Mock duplication in tests **[V]**

**94 test files** hand-roll `vi.mock('../mock-tauri')` and **68** repeat `@tauri-apps/api/core`; 200 of 808 test files call `vi.mock(` at all, **463 calls total**. There are **14 distinct inline factory shapes** for the same module (`isTauri: vi.fn()`, `() => false`, `() => tauriMode`, `() => isTauriState.value`, …). `src/test/` contains only `setup.ts`.

**Why it matters.** Those factories are the suite's de-facto contract with the Tauri host; the copies have already drifted semantically (see §3.1).

**Smallest move.** One `src/test/mockTauri.ts` exporting `mockTauriModule(overrides)`, migrated file-by-file as files are touched. No mass commit.

### 8.4 Configuration drift **[V]**

- `vite.config.ts:1070` excludes `src/hooks/useAiAgent.ts` — **that file does not exist**.
- `knip.json` ignores `"src/mock-tauri.ts"` — that path is now a **directory**, so the intended ignore matches nothing.
- Full `knip` run: 47 findings, **0 unused files**; 12 "configuration hints" of which **6 are dead patterns** (`mcp-server/index.js`, `tests/**/*.setup.ts`, `mcp-server/**/*.js` — `mcp-server` is its own pnpm workspace, so the root globs are inert).
- Three near-duplicate Playwright configs with three ports (5201 / 41741 / 5365), three timeouts and three retry counts. The integration config serves `tests/integration/`, which contains exactly **1** spec file.
- `mcp-server/package.json` `test` runs 2 of its 6 `*.test.js` files; root `pnpm test:mcp` globs all 6 — a trap only for someone running the workspace script.

**Smallest move.** Delete the dead coverage exclude and the 6 dead knip patterns; add a small check that every path in the coverage `exclude` and knip `ignore` resolves to something. Leave the Playwright configs alone unless §8.1 collapses them.

**Risk: near-zero** for the deletions. Removing knip patterns will surface new findings — that is the point.

### 8.5 A slice of tests assert only fixture literals **[V facts; I keep/delete call]**

`src/mock-tauri/` is ~2972 lines of mock infrastructure with 5 test files (666 lines), including `mock-handlers.more.test.ts` whose describe block is `describe('mockHandlers additional coverage', …)` and which asserts fixture constants like `shortHash: 'a1b2c3d'` and `toContain('deleted file mode 100644')` — values from `mock-entries.ts`, not product code. Naming smell across `src`: 15 `*.extra.test.ts`, 2 `*.coverage.test.ts`, 1 `*.more.test.ts`.

For balance: `mock-handlers.ts` itself is only **64.7%** statements, so it *drags the average down* — this is a test-value issue, not score gaming.

**Smallest move.** For the 19 `.extra.`/`.coverage.`/`.more.` files, delete any test whose only assertions are literals from `mock-entries.ts`/`mock-content.ts`. **Keep** `src/mock-tauri/mock-handlers.test.ts` (33 lines) — it encodes real dev-vault git semantics.

**Risk [I]:** these are change detectors; no mutation signal was run, so I measured slack and naming, not necessity.

---

## 9. What is healthy (checked, not assumed)

Stated because it bounds the above, and because several of these were *falsified* hypotheses rather than assertions:

- **Nothing in the frontend is dead.** An import-graph BFS from `src/main.tsx` over all 1656 `src` files (842 reachable) found **zero unreachable components and zero with only-test importers**. Exactly two files under `src/components` have no importers, and both are reached via `new Worker(new URL(...))` — `confetti.worker.ts` and `tableOfContents.worker.ts`. `AiAgentsBadge.tsx` no longer exists.
- **`BreadcrumbBar.tsx` is not a problem.** 1345 lines, but **0 shared shingles with any other file**: 53 private functions behind one 76-line export, covered by 1128 + 106 lines of tests. A closed black box, not a duplication offender. No action.
- **Frontend file-level duplication is not systemic.** Overlap detection across 299 files ≥60 substantive lines found exactly **one** pair above 50% (`StatusBar.tsx` / `StatusBarSections.tsx`). The real duplication is in Rust discovery (§3.2) and test mocking (§8.3), not components.
- **Production TypeScript type safety is good:** 3 `as any`, 3 `: any`, **0** `@ts-expect-error`, 24 `eslint-disable` across 154k lines.
- **No snapshot tests exist** — 0 `toMatchSnapshot`, 0 `toMatchInlineSnapshot`, 0 `.snap` files, 0 `__snapshots__` directories.
- **The test-typecheck ratchet is holding and shrinking:** `tsconfig.test.json`'s exclude went **150 → 119** while test files grew **533 → 808**; the 14 files added since the last ratchet commit are all included. Shape: 119 = 114 test files + 5 source files, all 5 still gated by `tsconfig.app.json`.
- **The coverage gates are real and enforced.** `scripts/run-vitest-coverage-shards.mjs:75` sets `VITEST_COVERAGE_SKIP_THRESHOLDS: '1'` per shard, which looks like a bypass — but `:197` re-checks thresholds on the merged map, and both pre-push and CI go through it. (This is about *enforcement*, not about §6's denominator.)
- **Test colocation is consistent:** 807 of 808 `src` test files sit beside their source; exactly one `__tests__` directory exists repo-wide; 0 `__mocks__`.
- **The Tauri command surface is consistent:** **169** distinct commands from 223 declaration sites (54 are `#[cfg]` desktop/mobile pairs), **all 169 registered** in the single `app_invoke_handler!` at `lib.rs:718-888`. No declared-but-unregistered command.
- **Rust production code is essentially unwrap-free** (see §5.1) and suppressions are low: **16** `#[allow(...)]` total, 11 of them the `too_many_arguments` ones in §5.3.
- **"No inline tests" ≠ untested.** The repo uses sibling test files wired by `#[path = "…"] mod …;` (11 files). Files without an inline `mod tests` are not necessarily uncovered — a trap worth recording.
- **`knip.json`'s ignore list is not hiding real signal.** `src/types/mockTauriBridge.ts` and `src/types/rhizomeTestBridge.ts` are bare `declare global` ambient files with zero name mentions anywhere (knip's documented most-dangerous false positive — do not touch); `mcp-server/cli-call.mjs` and `prime-login.mjs` are named by non-JS callers (`prime_login.rs`, `scripts/bundle-mcp-server.mjs:64`).

---

## 10. Not measured / open questions

1. **The exact Rust production coverage number.** §6 is a lower bound: 12 tests were blocked by the sandbox. The structural conclusion is robust (§6 arithmetic), but an exact figure needs one re-run with full filesystem access.
2. **Frontend coverage precision.** The statement/branch numbers in §9 come from `coverage/coverage-final.json`, dated 2026-10-04, i.e. stale against `dbd94b96`. They read **statements 85.14%, functions 86.82%, branches 76.87%** against a 70% threshold — branches is the tightest. Re-running `pnpm test:coverage` would firm it up.
3. **Whether `stream_claude_chat` is deliberately retained** (§5.4). The absent frontend caller is not proof; ARCHITECTURE.md documents it.
4. **Test necessity, not just test count.** §8.5 measured naming and coverage slack, not mutation signal. Deleting the `.extra.`/`.coverage.`/`.more.` files is a judgement call.
5. **One worktree was not audited** — `.claude/worktrees/phase4-model-events/`. Agents writing there could invalidate file-level claims.

---

## 11. Suggested order

Chosen so that cheap, certain, correctness-bearing work lands first and shrinks the blast radius of everything after it.

1. **Verify the Rust coverage denominator** (§6) — cheap, and it recalibrates what the 85% gate is worth. Re-base the threshold in the same change.
2. **Promote pi's `-lic` retry into `cli_agent_runtime` and route the three old-generation discovery modules through `find_cli_binary`** (§3.2). A correctness fix that deletes ~451 duplicated lines and 5 copies of a test.
3. **`AppAiWorkspaceSurface` deletion; `callHost` migration + its ESLint rule; the raw `<input>`/`<select>` sweep + its ESLint rule** (§3.1, §3.4, §4.5). All three are mechanical, test-verified and ratcheting.
4. **Decide on `engines/`** — delete it or open a C-number (§5.4). Unwired code that looks like the intended design is a trap.
5. **Supersede ADR-0003** (§7.1) — one document, and it removes a live landmine.
6. **Delete the `ReturnType<…>` alias in `NoteListLayout`** (§4.3) — an afternoon, well covered.
7. Then the larger pieces: the `Editor`-mount hoist and `<AppOverlays>` (§4.2), the `prime_session_host` statics extraction (§5.1), the IPC type checker (§5.5), the vault reducer (§3.3), the combobox (§3.5).

---

## 12. Survey hygiene

- **Nothing was committed, pushed, or branched.** `git status` shows only the two pre-existing untracked docs from §2.
- One artifact was written: `src-tauri/target/rhizome-cov.lcov` (5.2 MB), inside gitignored build output. Safe to delete.
- The clean `cargo llvm-cov` run required a sandbox escalation because cargo instruments into `src-tauri/target/`. That run rebuilt from scratch, so the local `llvm-cov-target` cache is now warm and current (previously it held a profile from another worktree).
- All file paths in this document are written as `<repo>/…` or `~/…`; no machine-specific paths.
