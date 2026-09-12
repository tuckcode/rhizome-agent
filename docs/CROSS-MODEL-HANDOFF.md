# Cross-model handoff — mistakes already made, don't repeat them

This file exists because one session (Claude, 2026-07-24/25) hit a run of
real traps in this repo — some cost hours to diagnose, one shipped a
production bug (window-chrome collision). Read this before touching the
areas listed. Every claim below is verified against actual code/commits/CI
runs, not inferred — file paths and commit hashes are given so you can
re-verify rather than trust this doc blindly. If something here goes stale,
fix the doc, don't just work around it silently.

For general project state, read `docs/HANDOFF.md` first — this file is
narrower: traps and landmines, not status.

---

## 1. knip (`pnpm deadcode`) has one specific false-positive class that will make you break the build

Ambient `declare global { interface Window { ... } }` files are imported by
**nobody, by design** — TypeScript picks them up from the project include,
not an import. knip reports them as "unused files." `src/types/rhizomeTestBridge.ts`
is exactly this: five source files (`main.tsx`, `App.tsx`, `useMenuEvents.ts`,
`useDeepLinks.ts`, `SingleEditorView.tsx`) fail to typecheck without it, and
a smoke spec drives the runtime bridge it types. `src/types/mockTauriBridge.ts`
(added 2026-08-21) is the same thing for `__mockContent` / `__mockHandlers`;
both are in `knip.json`'s `ignore`.

**Rule: always run `pnpm typecheck` after deleting anything knip flagged.**
(`npx tsc --noEmit` is a no-op here — root `tsconfig.json` is `"files": []`
plus references, which `--noEmit` does not follow. Measured 2026-08-20.)
It's already in `knip.json`'s `ignore` list — if knip flags a NEW ambient
file, check for `declare global` before believing it's dead.

## Native QA on macOS: permissions, and which binary you can drive

**0. The debug bundle cannot run at all while the installed app is open —
found 2026-09-05, after two prior sessions misdiagnosed this as a Codex
attachment quirk.** The debug bundle and `/Applications/Rhizome Agent.app`
share the same bundle identifier (`ai.rhizome.agent`), and
`tauri-plugin-single-instance` (`src-tauri/src/lib.rs:403`) allows only one
running process per identifier. Launching the debug bundle while the
installed app is running (`open -n`, or the raw executable) silently
forwards to the installed instance; the new process exits immediately with
no error or log output. It never stays alive to attach to — this is why
prior sessions' native controls kept landing on the installed app's old
UI no matter what they launched. **Fix: quit the installed app first**
(`osascript -e 'tell application id "ai.rhizome.agent" to quit'`, after
asking the user — it may hold unsaved chat/note state), **then** launch the
debug `.app`. Confirm it's really the debug process with `ps aux | grep
RhizomeAgent` (path should point at `target/debug/bundle/macos/`, not
`/Applications`) before attaching.

Two more traps cost a session on 2026-08-27. Both are environment, not code.

**1. The dev binary cannot be driven or screenshotted reliably.**
`target/debug/RhizomeAgent` has **no bundle identifier** (`osascript ... get
bundle identifier` returns `missing value`). Consequences:
- computer-use screenshot filtering blanks its window — the app looks like it
  never launched. It did.
- It can never hold a TCC grant, so protected-folder behaviour (a vault in
  `~/Documents`, C53) is **untestable** from `pnpm tauri dev`.

Build a bundle for anything permission-related:
`pnpm tauri build --bundles app` (skip plain `tauri build` — the DMG step
fails on this machine and the `.app` is all you need).

**2. Do not use `osascript` for native QA — use the cua-driver tools.**
Observed 2026-08-27: `osascript` drove the View menu and read window geometry
early in a session, then began denying **every** cross-app target (System
Events *and* Finder) with `-1743 Not authorized to send Apple events`, while
both toggles stayed ON in System Settings. Toggling them off and back on did
not restore it. Pure AppleScript (`osascript -e '1+1'`) still worked, so the
interpreter was fine — only cross-app events were refused.

**CuaDriver was unaffected throughout** and could still enumerate windows,
read AX trees, and click. The grants are per-process: the shell host's Apple
Events were denied while CuaDriver's were not.

So the fix is not a permission hunt. `osascript` is a redundant path —
`invoke_menu`, `list_windows` and `get_window_state` cover menus, geometry and
elements. Reach for cua-driver first and do not spend a session toggling TCC
rows, as one did. Two plausible-sounding explanations (per-process caching,
then code-signature invalidation after an app update) were both proposed and
both failed to predict the behaviour; the actual trigger is still unknown.

CuaDriver needs its own grants (Automation → System Events, and Accessibility
for typing); they are separate rows from the host's.

## 2. The MCP `:9711` bridge IS live — RESOLVED 2026-07-25, an earlier version of this doc got it wrong

**Verified working.** An earlier revision of this file claimed
`ws-bridge.js`'s `startUiBridge`/`startBridge` "have no callers anywhere"
and raised it as a possible broken integration. That was wrong, and the
mistake is worth understanding because it's an easy one to repeat:
**those exports are called by the module's own entrypoint**
(`ws-bridge.js:268` — `startUiBridge().then(() => startBridge())`), which
runs when the file is executed as a script. Grepping for *importers* of an
exported symbol finds nothing; the self-invocation at the bottom of the
file is the caller. Rust spawns it from `src-tauri/src/lib.rs:276`
(`spawn_background_task("tolaria-ws-bridge-startup", ...)`); the
`"ws-bridge spawned"` log lives at `src-tauri/src/mcp.rs:215`.

Confirmed live at runtime under `pnpm tauri dev` — `lsof -i:9711` showed
`ws-bridge.js` LISTENING with **two** established client connections (the
Rhizome app itself, and an external MCP client). The full chain works.

`src/hooks/useMcpBridge.ts` was genuinely unimported and has been deleted
(area B nightly, 2026-09-06). That is not evidence of a broken bridge —
the live path is `useMcpBridgeVaultSync` inside the vault switcher. Run
`pnpm typecheck` after further hook deletes (see #1).

**General lesson: before concluding "this export has no callers," check for
a self-invoking entrypoint at the bottom of the same file, and prefer
runtime evidence (`lsof`, process list, logs) over static grep for
anything that runs as a spawned process.**

## 3. Release pipeline: unsigned publish path (resolved 2026-07-25)

Commit `62be2cbc` made macOS/Windows build **unsigned**. Publish used to
hard-require `.sig` for every platform — that contradiction is fixed:

- `release.yml` / `release-stable.yml`: `.sig` optional; latest.json omits
  `signature` when missing and still publishes download URLs.
- macOS packages `.app.tar.gz` manually when Tauri does not
  (`createUpdaterArtifacts: false`).
- Intel Mac dropped; Linux unsigned + `ubuntu-24.04`; `fail-fast: false`.
- Publish still needs **all remaining** build jobs green (aarch64 macOS +
  Linux + Windows) — no partial releases. See `docs/HANDOFF.md` release
  bullet for trade-offs (Linux glibc ≳ 2.38).

## 4. Prior build failures (as of `run 30138779741`) — addressed in workflows

- **Linux `__isoc23_strtoll`**: runner moved to `ubuntu-24.04` (not yet
  proven green end-to-end; if it still fails, pin rustc next).
- **macOS Intel**: removed from matrix (`ort-sys`/fastembed no prebuilt).
- **fail-fast**: now `false`. aarch64 was previously cancelled by Intel
  failures — don't assume aarch64 was broken from that run alone.

## 5. Native window-chrome bugs are invisible to browser QA — this already shipped one bug

The command rail (`src/components/CommandRail.tsx`, wave 5.3) shipped with
the macOS traffic-light buttons drawn on top of its first button — a real,
live collision (`x 18–72, y 24–38` for the lights vs `x 8–38, y 8–38` for
the rail button). Browser-only QA (Vite has no native window chrome) could
not catch this; it was found only when native QA (`pnpm tauri dev`,
screenshot via macOS `screencapture`) ran for the first time on 2026-07-24,
weeks after the feature shipped. Fixed in `5f792a5a`
(`MACOS_TRAFFIC_LIGHT_SAFE_TOP` in `src/utils/platform.ts`).

**Rule: any UI surface that touches a window edge (rail, custom titlebar,
overlay chrome) needs native QA before its feature flag graduates — browser
QA passing is not evidence it's safe.**

## 6. Several separate "Tolaria" residues exist — know which is which before touching any

- **The public VitePress `site/` tree shipped Tolaria branding** (`tolaria.md`
  CNAME, Download Tolaria, `refactoringhq/tolaria`). **Removed 2026-09-06**
  (area D). `pnpm agent-docs` now no-ops if `site/` is absent and leaves the
  existing `src-tauri/resources/agent-docs/` bundle in place. Do not recreate
  a Tolaria or Desktop public site here.
- **`https://tolaria.md/...` and `refactoringhq/tolaria` may still appear in
  product code** (`src/utils/releaseDownloadPage.ts`, vault getting-started).
  Those are not this slice. Don't "fix" them without a replacement domain and
  a C11 replacement starter vault.
- **Same URL, second surface — `src-tauri/src/vault/getting_started.rs`**
  (found 2026-07-31). This ships into **every vault a user creates**, not
  just the docs site. Partially resolved; the three parts are *not*
  interchangeable, and this is the one place a mechanical sweep does real
  damage:
  - **Live seeded template (`AGENTS_MD`) — FIXED.** Read
    `[Rhizome](https://github.com/refactoringhq/tolaria)`: the rename swept
    the label and left the URL. Now plain text, "This is a Rhizome vault."
    Guarded by `test_seeded_agents_template_has_no_upstream_fork_link`.
  - **`STALE_AGENTS_MD` / `PRE_TYPE_AGENTS_MD` / `LEGACY_AGENTS_MD` — DO
    NOT TOUCH.** They still say `[Tolaria](https://github.com/refactoringhq/tolaria)`
    and they must. They are exact-match *fingerprints* consumed by
    `agents_content_is_known_managed_template` (lines 279-281) to recognise
    an older vault's `AGENTS.md` as app-owned and therefore safe to
    auto-refresh. Rewrite their text and existing vaults stop matching — the
    app then treats those files as user-authored and silently never
    refreshes them again. No user-visible error; it just quietly stops.
    `test_legacy_agents_fingerprints_keep_their_exact_historical_text` now
    fails loudly if anyone sweeps them.
  - **`GETTING_STARTED_REPO_URL` (line 6) — STILL OPEN.** It clones
    `refactoringhq/tolaria-getting-started.git` and is asserted by
    `test_default_getting_started_repo_url_uses_tolaria_slug`. This is a
    *functional* clone URL behind the Getting Started flow, not prose —
    removing it breaks the feature. Needs a real replacement starter-vault
    repo under `knispo`, which needs GitHub access.
- **`club.refactoring.tolaria`** — bundle identifier in
  `src-tauri/gen/apple/laputa.xcodeproj/project.pbxproj`, an unused `tauri
  ios init` scaffold (no CI references it, untouched since initial import).
  Real desktop bundle ID (`ai.rhizome.desktop` in `tauri.conf.json`) is
  already correct. Don't hand-edit the `.pbxproj` — no test or CI would
  catch a malformed edit; delete the scaffold or regenerate it properly via
  the Tauri CLI if iOS is ever a real target.
- **MCP server identity + frontend localStorage — FIXED 2026-08-02, ADR-0162.**
  `MCP_SERVER_NAME` in `mcp.rs` was still `"tolaria"` (tools were literally
  `mcp__tolaria__rhizome_search`), `appStorage.ts`'s primary keys were
  still `tolaria:*`, and `useVaultConfig.ts`'s per-vault prefix had *never*
  been migrated even once — still `laputa:vault-config:` after two renames.
  All fixed, with legacy-key/fallback handling generalized so future
  renames don't repeat this. Also surfaced a genuine, unrelated,
  currently-broken bug: `deepLinks.ts` built/parsed `tolaria://` URLs while
  `tauri.conf.json` already registers the OS scheme as `"rhizome"`, so
  every real deep link was silently rejected. Fixed; full detail in
  ADR-0162, not repeated here.
- **`tolariaEditorFormatting.tsx` + 7 sibling files — found 2026-08-02,
  RESOLVED same day.** Real file-name-level branding across the
  rich-editor's BlockNote formatting toolbar and side menu, including
  exported component names (`TolariaFormattingToolbar`, `TolariaSideMenu`,
  etc.) consumed by `SingleEditorView.tsx` and mocked by name in
  `SingleEditorView.testUtils.tsx`, `App.test.tsx`, and `Editor.test.tsx`.
  Deliberately deferred out of ADR-0162's initial scope as a file-rename
  job, then picked up explicitly the same day: `git mv` on all 11 files
  (8 modules + 3 dedicated tests, history preserved) → `rhizomeEditorFormatting.tsx`
  and 7 siblings, every import site and mock path updated, plus the two
  CSS rule-groups in `Editor.css`/`EditorTheme.css` that had to match
  (`.tolaria-slash-menu-icon*`, `.tolaria-block-drag-handle`). **Do not
  confuse with the other "Tolaria"-prefixed CSS in those same two files**
  (`.tolaria-note-pdf-exporting`, `.tolaria-rich-editor-text-direction-rtl`,
  `.tolaria-rich-editor-block-selected`, `--tolaria-overlay-zoom-inverse`) —
  those belong to separate, still-unrenamed source files
  (`notePdfExport.ts`, `richEditorTextDirection.ts`,
  `richEditorBlockSelectionExtension.ts`, `useZoom.ts`) and were correctly
  left alone; renaming a CSS selector without renaming its source breaks
  styling silently, same failure mode in the other direction.
- **`src/types/laputaTestBridge.ts` + `window.__laputaTest` — found
  2026-08-02, RESOLVED 2026-08-02 (C15).** The native-QA test bridge
  global, already documented by name in this file's code-health section
  (ambient declarations, a knip false-positive trap) and used throughout
  `App.test.tsx` and native QA scripts. `git mv` to `rhizomeTestBridge.ts`
  (history preserved), `LaputaTestBridge` → `RhizomeTestBridge`,
  `window.__laputaTest` → `window.__rhizomeTest` across every app,
  test-helper, and Playwright smoke-spec reference; `knip.json`'s ignore
  entry updated to match the new filename.

## 7. `belongsTo`/`relatedTo` camelCase in `src/types.ts` is NOT a spec violation — don't "fix" it

Rhizome implements the Portent spec (`portent.md`), which mandates
snake_case `belongs_to`/`related_to` in frontmatter. The actual markdown
files on disk correctly use snake_case (verified: `graph.rs:56` recognizes
`"belongs_to"`/`"related_to"` as the real keys; `getting_started.rs`'s
sample vault content uses `belongs_to:`). The camelCase version exists
**only** as the JSON shape sent over Tauri IPC to the frontend
(`entry.rs:23`: `#[serde(rename = "belongsTo")] pub belongs_to: ...`) —
no file, no agent, no user ever writes or reads camelCase. This looks like
drift from the spec; it isn't.

Also: Portent's 8 canonical types (Project/Operation/Responsibility/Task +
Event/Note/Topic/Person) are all seeded on vault open/create —
`seed_config_files` / repair write Note via `NOTE_TYPE_DEFINITION` and the
other 7 via the Portent templates (`write_if_missing`). Settings still
exposes `seed_portent_type_definitions` for older vaults. Updated 2026-09-06
(was opt-in-only before).

## 8. Hermes CLI `--source` value must be literally `"tool"`, not a product name

`src-tauri/src/hermes_cli.rs` invokes `hermes chat --quiet --source <value> -q <prompt>`
for every distill call — one fresh CLI invocation per call, no session
reuse. Hermes's own app lists every `chat` invocation as a visible session
in its sidebar, **unless** `--source tool` is passed — per `hermes chat
--help`: `--source SOURCE Session source tag for filtering (default: cli).
Use 'tool' for third-party integrations that should not appear in user
session lists.` Any other string, including `rhizome` or `tolaria`, is just
a visible tag — it does NOT hide the entry. This was actually flooding the
user's Hermes session list with dozens of "Distill the following text..."
entries. Fixed to `"tool"` — **do not "helpfully" change this to a product
name**, that reintroduces the flooding.

## 9. This repo's `origin` used to be shared with an unrelated repo — history if you find something confusing

`~/code/projects/rhizome` (this app) and a since-renamed
`~/code/projects/rhizome-old` (an older, unrelated Python/CLI-era project,
100+ commits, own history) both had `git remote origin` pointed at
`git@github.com:knispo/rhizome.git` — the same live public remote. Confirmed
via `git ls-remote`: that remote only ever actually held this app's history;
the old repo's refs were stale local tracking info. A `git push --force`
from the old folder, even accidental, would have overwritten this repo's
public history. **Already fixed**: the old repo's `origin` was removed and
its full history (3 branches) backed up to a new private
`knispo/rhizome-old`. If you're operating in either folder and something
about remotes/history looks confusing, this is why — it's resolved, not an
active hazard, but the folder names (`rhizome` / `rhizome-old`) are recent
(2026-07-24) and older docs/scripts/memory may still say `rhizome-desktop`.

## 10. LARA / `l10n:*` invitation is gone (C18)

The `l10n:*` scripts, `lara.yaml`, and `@translated/lara-cli` were removed
in area D. Do not re-add them. English only for v0.

## 11. Status-bar/shell work is mid-migration behind `shell_command_rail` — check HANDOFF before assuming spec fidelity

ADR-0166 / ADR-0170 are the living shell decisions. Verify against
`docs/HANDOFF.md` and the code before assuming an older design spec is
ground truth.

## 12. "Default ON when unset" flags don't help existing vaults — explicit `false` is already persisted

Found during native QA 2026-07-25, verifying `5c208466` ("default inbox
automation on").

The logic itself is correct — `isInboxAutomationEnabled()` in
`src/utils/inboxAutomation.ts` returns `value !== false`, so `null`/
`undefined` count as enabled. Wiring is correct too: `App.tsx:357` →
`useInboxWatcher` → `invoke('start_inbox_watcher')`.

**But it does nothing for any vault that already has the flag stored.**
Verified on the real `~/Documents/Rhizome Vault`: dropping a file into
`raw/inbox/` produced no processing, no `events.jsonl` entry, and zero
watcher log lines — across two app restarts and both create and modify
events. Cause, read straight out of the native WebKit localStorage:

```
laputa:vault-config:/Users/dtc/Documents/Rhizome Vault
  inbox_automation_enabled = False     ← explicit, persisted
```

The watcher correctly stayed off. "Default ON when unset" only reaches
brand-new vaults; every vault that was ever opened while the old
default-OFF code shipped has an explicit `false` written to
`laputa:vault-config:<path>` in localStorage and is unaffected.

**FIXED 2026-07-31** — `migrateInboxAutomationDefault` in
`src/utils/configMigration.ts`, wired into `useVaultConfig`.

It was deferred here as "a product decision, not a bug" — flipping a
persisted `false` looks like overriding a user's choice. That framing was
wrong, and the thing that settles it is `SettingsPanel.tsx:488`:

```ts
const handleSave = useCallback(() => {
  ...
  onSaveInboxAutomation?.(draft.inboxAutomationEnabled)   // every save, unconditional
```

The draft is seeded from the `inboxAutomationEnabled` prop, which under the
old code was `Boolean(vaultConfig.inbox_automation_enabled)` → `false` when
unset. So **any** user who opened Settings and hit Save for an unrelated
reason (theme, zoom, anything) persisted `inbox_automation_enabled: false`
without ever seeing that toggle. The stored `false` is an artifact of the
old default leaking through the draft, not a decision — which is what makes
clearing it safe.

Two things worth copying if you write a similar migration:

- **Per-vault flag** (`tolaria:inbox-automation-migrated:<path>`), not the
  existing global `configMigrationFlag`. The config is keyed by vault path,
  and the global flag is *already* `'1'` on every existing install, so
  reusing it would have skipped the migration entirely.
- **Set the flag even when nothing changed.** Once the default is ON the
  draft seeds `true`, so any later `false` can only come from a real toggle
  — an unmarked vault would clobber that genuine opt-out on next load.

Contrast `session_auto_distill_enabled`, which carries the same "default ON
when unset" comment but is written on toggle change
(`SettingsPanel.tsx:1254`), never through the draft. It never had this bug
and needs no migration. That is the pattern to prefer.

**How to inspect this yourself** (native localStorage is UTF-16 in SQLite,
so a plain `sqlite3` select prints mojibake):

```python
import sqlite3, json
db = "~/Library/WebKit/ai.rhizome.desktop/WebsiteData/Default/<hash>/<hash>/LocalStorage/localstorage.sqlite3"
con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
raw = con.execute("SELECT value FROM ItemTable WHERE key=?", (f"laputa:vault-config:{vault_path}",)).fetchone()[0]
print(json.loads(raw.decode("utf-16-le") if isinstance(raw, bytes) else raw))
```

Related, spotted while tracing this: `App.tsx:356` computes `isWikiVault`
but does **not** pass it to `useInboxWatcher` on the next line, even though
that hook's own doc comment says it starts the watcher "for a wiki vault."
Either the gate was dropped or the comment is stale — worth a look, not
touched here.

## 13. `cargo llvm-cov --no-clean` can report a badly false coverage number — clean first before believing a failure

**AGENTS.md documents `--no-clean` as the standard flag** for the pre-push Rust
coverage gate (it reuses instrumented artifacts, ~30-60s instead of ~8min).
That optimization is real, but it silently produces **stale, wrong numbers**
when the toolchain has changed underneath it.

Observed 2026-07-25 by two agents working independently in the same session —
both hit it, so this is corroborated, not a one-off:

- `--no-clean` reported **82.75%** (gate FAIL, `--fail-under-lines 85`).
- A clean run on identical code reported **85.16%** (gate PASS).
- The stale report was mixing std files from **two different rustc versions**
  (1.96.1 and 1.97.1) into one profile, and showed one just-edited file at an
  impossible ~38%.

**Rule: a `--no-clean` coverage FAILURE is not evidence until you re-run
clean.** Before concluding you regressed coverage:

```bash
cargo llvm-cov clean --workspace --manifest-path src-tauri/Cargo.toml
LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" \
LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata" \
  cargo llvm-cov --manifest-path src-tauri/Cargo.toml --ignore-filename-regex "lib\.rs|main\.rs|menu\.rs" --fail-under-lines 85
```

A `--no-clean` *pass* is trustworthy; only failures need the clean re-run.

**⚠️ A clean re-run can also confirm the failure — see C27 in `HANDOFF.md`.**
Measured 2026-08-16: `--no-clean` 84.86%, clean 84.86%, and `origin/main`
itself at 84.87% in a detached worktree. When the two numbers agree, the
coverage shortfall is real and this section does not apply. Check the clean
number before reaching for the stale-profile explanation — otherwise this
section becomes a way to explain away a genuine regression.
(The `clean` line above lacked `--manifest-path` until 2026-08-16 and simply
errored with `could not find Cargo.toml`; there is no root manifest.)

Related environment note: this machine has Homebrew rust and **no `rustup`**, so
`cargo llvm-cov` fails outright with `failed to find llvm-tools-preview` unless
`LLVM_COV`/`LLVM_PROFDATA` are exported as above. That is also why `git push`
fails at step 4/6 without them — same root cause, different symptom.

**Second trap, same area:** when two agents edit the crate concurrently,
whole-crate coverage transiently dips below the gate because of *the other
agent's* half-finished file. One agent measured 84.87% purely because a
concurrently-edited `rhizome_jobs.rs` sat at 9.74%; it resolved to 85.17% once
that work settled. Don't pad tests to chase a number that isn't yours — check
`git diff --stat` and confirm which files are actually in your commit first.

## 14. Four gotchas migrated from HANDOFF.md history — still live, still true

The following were archived out of HANDOFF.md's history sections on
2026-07-25. They remain current gotchas, not historical notes.

Rule for the rest of the sweep: "past tense" ≠ "history." Ask whether
the fact is still true today. If yes, it's current state regardless of how
it's phrased.

- **pnpm 10 vs 11 lockfile mismatch:** CI pins pnpm 10. Local is pnpm 11. Regenerate with `CI=true npx pnpm@10 install --no-frozen-lockfile`.
- **Local QA scripts don't exist** — `~/.openclaw/skills/tolaria-qa/scripts/` is a dead path. Fix already applied: AGENTS.md native QA block and QA scripts section now reference `computer-use` instead.
- **`tests/smoke/fix-crash-create-note.spec.ts` is timing-flaky** — pre-existing, unrelated to shell waves. Worth a fix-flaky pass per AGENTS.md.
- **TAURI_SIGNING_PRIVATE_KEY missing** / **Updater pubkey empty** — free Tauri updater key, not a paid Authenticode cert. `tauri.conf.json` has an empty `pubkey`. Don't fix without a real signing keypair.

## 15. OBSOLETE — MCP server path mismatch (fixed in 2fa620a5)

This section described a stale `tolaria` MCP server path mismatch across live
configs. The bug was fixed in commit `2fa620a5` (detect stale registration
copies instead of reporting installed). The section had no body before this
rewrite because it was never completed; it is now marked resolved and kept
only to preserve section numbering.

## 16. Sidecar routing trap — Python fallback when RHIZOME_TOOL_PATH is unset

`mcp-server/index.js:413` falls back to a Python subprocess when the
environment variable `RHIZOME_TOOL_PATH` is not set. Meanwhile, `mcp.rs`
deliberately omits this key rather than guessing the sidecar path when the
binary is absent (non-`externalBin` builds). The net effect: released builds
that lack the bundled `rhizome-tool` binary silently route external agents
through the deprecated Python path instead of failing cleanly.

Do not add `RHIZOME_TOOL_PATH` to `mcp.rs`'s environment block unless
`externalBin` packaging (release pipeline§3) is also resolved — guessing the
path from `cargo` metadata is wrong for release builds, and hardcoding a
relative path is wrong for development. The deliberate omission is correct
today, but this should be documented wherever `mcp.rs` sets up subprocess
env so a future developer doesn't re-add it as a "fix."

The Python fallback in `mcp-server/index.js` is `AGENTS.md`'s
responsibility to document until packaging picks it up. See
`docs/CROSS-MODEL-HANDOFF.md` §3 for the release-pipeline interaction.

## 17. When you patch a helper, prove it from a caller that bypasses it

Launch now opens ChatHome. Notes-shell Playwright needs
`AGENT_CHAT_OPENED_SESSION_KEY`. Pinning that only inside
`installFixtureVaultInitScript` (`0b94652`) made a green
`create-note-backing-file` look like proof — that spec **uses** the
fixture, so it structurally could not fail. Pre-push died twice on
`wikilink-path-fix` first describe: bare `page.goto('/')`.

41 specs navigate that way. Export `pinNotesShellLaunch` and call it
**before** first `goto` (`de1a437`). Do not bury launch behaviour only
inside the fixture file — the next spec author will never see it.

“Run more tests” is the weak reading. Proof is a spec that **does not**
use the helper you patched, then `pnpm playwright:smoke` (26).

## 18. Probe Prime's live daemon before building anything against it — docs and symmetry both lie

Verified 2026-08-16 across four independent mistakes in one session. **Prime's
documented behaviour and Prime's actual behaviour diverged four separate times.**
Every time the live daemon (or its installed source) was probed first, the work
was right. Every time docs or symmetry with a neighbouring feature was trusted,
the work was wrong.

| Assumption | Reality | How it would have been caught |
|---|---|---|
| `export` is a protocol call like `fork`/`compact` | Absent from `serverCapabilities`; CLI-only — `prime-agent session export <file>` | Check `serverCapabilities` |
| Skills carry `argumentHint` | Only `source: "prompt"` entries do | Read `dist/modes/agent-connection/snapshot.js` |
| `sessionFile` is always in state | Arrives on only some payloads — a live session can have an id and no path | Only visible at runtime |
| `get_state` carries `goal` | Never set by the daemon; RPC-mode only. Correct call is `get_connection_state`, fields are `tokenBudget`/`tokensUsed` | Read `dist/modes/daemon/daemon-mode.js` |
| `SessionSummary.sessionName` names a session | **Declared in the `.d.ts` and never sent.** No live session carries it; `prime-agent list` prints a blank `name` column. Fall back to `firstMessage` | `list` against the live daemon (added 2026-08-19, #13) |

**Rule: before building anything Prime-facing, probe the running daemon and read
the installed source under `~/.local/lib/node_modules/prime-agent/dist/`.** It
costs ~30 seconds and would have caught three of the four. The one time this
session *did* probe first (`get_commands` / `sourceInfo`), the work landed
correctly on the first try.

Practical probes that have paid off:

```bash
prime-agent --mode daemon   # if status says nothing is running
# then against a live session / connection:
# serverCapabilities, get_commands, get_connection_state, get_state
ls ~/.local/lib/node_modules/prime-agent/dist/modes/
```

**Fifth instance, 2026-08-19 (#13).** The menu-bar roster was built from the
daemon's `list` command. The `.d.ts` declares `sessionName?: string` on
`SessionSummary`; a live probe showed no session carries it, so a row title
built on `sessionName` would have rendered blank for every real session. The
same probe *confirmed* `summary`, `runtimeKind`, `rlmDepth` and
`hasRunningRlmChildren` are all really sent — so the probe is not only for
catching absences, it is what lets you use an optional field with confidence.

**A `.d.ts` optional marker tells you nothing about whether the field arrives.**
Every field on `SessionSummary` past the first four is optional; in practice
some are always present and some never are, and the type cannot distinguish
them. Probe, then treat what you saw as the contract.

**When you cannot probe something, say so in the code.** #13 could not observe
subagent parentage — no subagents were running — so it follows the daemon's own
`buildRlmChildSnapshots` source and the module comment names that as the one
unprobed assumption. A future reader debugging bad subagent counts starts at
the right line instead of re-deriving what was and wasn't verified.

### Subagent verification — demand the full suite, not the agent's own tests

Five Sonnet subagents in the same session each produced useful work and each
**overstated** green status. Every overstatement was caught only by running the
full suite rather than the files the agent touched:

- "5/5 green" that was flaky on two independent re-runs
- a null deref that unmounted the app, invisible to the agent's own new tests
- unformatted Rust that broke the push (`cargo fmt --check`)
- a boolean passed where analytics requires `string | number` — `tsc` missed it,
  the pre-push build caught it
- a session-limit exit that left `console.debug` instrumentation in the tree

**Agent prompts must demand the full `pnpm test` suite plus `cargo fmt --check`,
explicitly.** Focused tests are a development loop, not a ship gate.

## 19. Titlebar double-click + native drag on the same mousedown races maximize

Observed 2026-08-25 on the chat-centered shell: double-clicking the overlay
titlebar went fullscreen, then instantly snapped back to half-height.

Two causes stacked. First, `data-tauri-drag-region` and `useDragRegion`
(`src/hooks/useDragRegion.ts` → `perform_current_window_titlebar_double_click`)
were both live on the same strip, so one gesture toggled maximize twice.
Second, even after the native attribute was removed, the first mousedown of
the double-click called `startDragging()`. The second click maximized; the
still-active drag then restored the previous frame.

**Rule:** one owner per titlebar surface — `useDragRegion` only. Start a
window drag only after the pointer moves. Keep a short lock so the native
titlebar command cannot fire twice in one gesture. Browser Playwright
cannot see this; it needs a rebuilt `.app` / `pnpm tauri dev`.

Related: the breadcrumb control that looks like a sidebar collapse opens
Properties (`editor.toolbar.openProperties`). Closing the note is the
trailing **X** (`editor.toolbar.closeNote`).
