---
type: ADR
id: "0162"
title: "Identity rename: tolaria to rhizome, MCP server + localStorage"
status: active
date: 2026-08-01
---
## Context

`src-tauri/src/mcp.rs`'s `MCP_SERVER_NAME` — the key every external agent
config (Claude Code, Kiro, Antigravity, Codex, Pi, OpenCode) registers this
app's MCP server under — was still `"tolaria"`, the pre-rename product
name. Every MCP client names tools `mcp__<server-key>__<tool>`, so this
public, Rhizome-branded, AGPL repo was handing every new agent tools named
`mcp__tolaria__rhizome_search` and 15 siblings — naming the old product,
not this one.

This was one of two already-completed `laputa`→`tolaria` renames in the
same file (`LEGACY_MCP_SERVER_NAME`, a single legacy name with its own
cleanup logic), so the mechanism to do this safely already existed; it just
hadn't been run a second time.

Auditing the blast radius surfaced a materially larger scope than "rename
one constant," in two directions:

**On the MCP side:**
- **Four more independent config writers**, none sharing `mcp.rs`'s
  machinery: `kiro_cli.rs`, `antigravity_config.rs`, `pi_config.rs` persist
  their own MCP config file to disk; `codex_cli.rs` and `opencode_config.rs`
  build one fresh per invocation.
- **Three of those persisted-config writers had no legacy-key cleanup at
  all.** Kiro, Antigravity and Pi each did a bare
  `servers.insert("tolaria", ...)` on every run — meaning even the prior
  `laputa`→`tolaria` rename had been silently incomplete for these three
  CLIs the whole time, not just this one.
- **`claude_invocation.rs`'s in-app-chat allowlist strings**
  (`CLAUDE_SAFE_AGENT_TOOLS`, `CLAUDE_POWER_USER_AGENT_TOOLS`) hardcoded
  `mcp__tolaria__*`. This is the one dependency that made "just rename the
  key" unsafe as a single find-replace: renaming `mcp_config()`'s key
  without renaming the allowlist to match would have made `claude` refuse
  every Rhizome tool call in the in-app AI chat — silently, with the
  mismatch as the only cause, and no error pointing at it.
- **Discovery-path gaps** in `mcp.rs`'s `linux_package_mcp_server_dirs()`,
  `mcp/paths.rs` (Windows/AppImage), and `mcp/extraction.rs` (Linux
  stable-extraction cache): all three only ever searched for
  `Tolaria`/`tolaria` paths, despite `tauri.conf.json`'s `productName`
  already being `"Rhizome"`. A package built at HEAD would have been
  invisible to its own app's discovery logic.

**On the frontend side** (scope extended mid-session on explicit direction
— "we have no users but me right now, perfect time to" — after raising that
`appStorage.ts`'s `tolaria:` localStorage prefixes were a different class
of residue from the MCP key, since real user preferences live under them):
- `APP_STORAGE_KEYS`' primary values were still `tolaria*`; its
  `LEGACY_APP_STORAGE_KEYS` fallback pointed two generations back
  (`laputa*`), one generation short of where it needed to be.
- **`useVaultConfig.ts`'s per-vault config prefix had never been migrated
  even once** — still `laputa:vault-config:` through the entire
  `laputa`→`tolaria` rename, found only because this audit went looking.
  Would have carried straight through this rename too, undetected.
- Auditing turned up a **real, currently-broken bug unrelated to naming**:
  `deepLinks.ts`'s `TOLARIA_DEEP_LINK_SCHEME` said `"tolaria"` while
  `tauri.conf.json` already registers the OS deep-link scheme as
  `"rhizome"`. Every deep link the OS actually delivered was being silently
  rejected as `invalid_scheme`; every link this app built could never be
  delivered back to it, since only `"rhizome"` is registered. Deep links
  had been non-functional since `tauri.conf.json`'s scheme was set, and
  nothing caught it because every test in `deepLinks.test.ts` built and
  parsed its own `tolaria://` URLs — internally consistent, testing the
  wrong scheme the whole time.

## Decision

**Rename `MCP_SERVER_NAME` to `"rhizome"` (generalizing the single-`&str`
legacy constant to a list, `LEGACY_MCP_SERVER_NAMES: &[&str] = &["tolaria",
"laputa"]`), and apply the equivalent identity rename everywhere the old
name is independently written, read, or discovered — MCP config, frontend
localStorage keys, and the deep-link scheme.**

Landed as five commits, each independently compiling/testing, so the change
is reviewable in pieces without any intermediate state being silently
broken:

1. **Core MCP registration engine** (`mcp.rs`, `mcp/opencode.rs`,
   `mcp/paths.rs`): the shared upsert/remove/read logic, widened to a
   legacy-name list, plus additive `Rhizome`/`rhizome` discovery candidates
   alongside the kept `Tolaria`/`tolaria` ones.
2. **Every CLI integration** (`cli_agent_runtime/mcp_config.rs`,
   `claude_invocation.rs` — including the allowlist strings, which had to
   travel with the key rename — `kiro_cli.rs`, `antigravity_config.rs`,
   `pi_config.rs`, `codex_cli.rs`, `opencode_config.rs`, and
   `mcp/extraction.rs`, caught auditing this file's neighborhood after
   commit 1 landed).
3. **Frontend localStorage identity** (`appStorage.ts` and its primary/
   legacy key pair; `windowMode.ts`, `aiWorkspaceSizing.ts`,
   `useClaudeCodeOnboarding.ts`, `useAiAgentsOnboarding.ts`; `useVaultConfig.ts`'s
   never-migrated prefix; the MCP setup dialog's now-inconsistent copy; the
   browser-preview mock's matching snippet keys).
4. **The deep-link scheme bug** and, bundled with it since it was the same
   "single-importer exported-symbol rename" shape, `sheetClipboard.ts`'s
   internal MIME type/payload naming.
5. This ADR plus `ARCHITECTURE.md`/`ABSTRACTIONS.md`/`HANDOFF.md`/
   `CROSS-MODEL-HANDOFF.md` corrections.

**Explicitly out of scope at the time of this decision, found auditing, not
attempted here:**
- ~~`src/components/tolariaEditorFormatting.tsx` and five sibling files~~ —
  **picked up and closed the same day**, on explicit request, as a separate
  follow-on commit (`5e40fd02`, "C14"). Left the reasoning below as-written
  since it was accurate at decision time — real file-name-level branding
  across the rich-editor module, renaming meant renaming files and updating
  every import site, a materially larger and differently-risked change than
  a string/key rename — and that reasoning is exactly why it shipped as its
  own commit rather than folded into this series. `docs/CROSS-MODEL-HANDOFF.md`
  §6 has the closed writeup.
- ~~`src/types/laputaTestBridge.ts` and `window.__laputaTest`~~ —
  **picked up and closed 2026-08-02 (C15)**, on explicit request, as a
  separate follow-on commit. Left the reasoning below as-written since it
  was accurate at decision time — the native-QA test bridge AGENTS.md
  documents by name as a known quantity (ambient declarations, a knip
  false-positive trap), and renaming it touched Playwright test
  infrastructure outside `src/`, a differently-risked change than this
  ADR's string/key renames. `docs/CROSS-MODEL-HANDOFF.md` §6 has the
  closed writeup.
- `configMigration.ts`'s and `localizedStreamError.ts`'s existing
  deliberate legacy-fallback literals (`'laputa:tag-color-overrides'`,
  `'tolaria:i18n-error:'`) — genuine historical pointers, not residue.
- `site/public/CNAME`'s `tolaria.md` domain — the live, deployed docs-site
  domain (documented in `CROSS-MODEL-HANDOFF.md` §6); needs a
  domain-ownership decision, not a text edit.
- Dozens of test files using "Tolaria"/"Laputa" purely as arbitrary fixture
  content (a fake vault name, a fake note title) with no bearing on the
  product's own identity — left as historical color; renaming adds no
  value.

## Options considered

* **Option A** (chosen): rename the primary identifier everywhere it's
  independently held, generalize legacy-name handling to a list/fallback,
  add missing migration where it was absent, leave already-written state to
  self-heal. Matches the existing `laputa`→`tolaria` pattern (Rust side)
  and the existing `copyLegacyAppStorageKeys` pattern (frontend side)
  exactly — no new mechanism to review, only a second application of each
  plus fixes for the gaps where the first application never actually ran
  (Kiro/Antigravity/Pi's MCP config, `useVaultConfig.ts`'s prefix).
* **Option B**: rename only the *label* shown in UI/docs, leave the
  underlying key/scheme as `"tolaria"`. Rejected — this is what already
  happened to the seeded vault `AGENTS.md` link earlier in this series
  (2026-07-31: `getting_started.rs`), where the label was swept and the URL
  wasn't. The same half-measure here would leave real tool names
  (`mcp__tolaria__rhizome_search`) and a non-functional deep-link scheme
  permanently.
* **Option C**: version the identifiers (e.g. `rhizome-v2`) instead of
  reusing the migration pattern. Rejected — adds a concept (versioned
  identity) the codebase doesn't otherwise have, for no benefit over the
  proven remove-legacy-then-insert-current / read-fallback approaches
  already in place on both sides.
* **Full-codebase sweep** (considered, not chosen for this ADR): the
  editor-formatting file family and the test-bridge subsystem are the same
  *kind* of decision as everything above, just larger. Left for a separate,
  explicitly-scoped pass rather than folded in here.

## Consequences

* Every newly-registered or re-registered external agent config now reads
  `mcp__rhizome__*`, matching the product name and the tools' own
  `rhizome_*` naming. A config written by any build since the original
  `laputa` rename — `tolaria` **or** `laputa` — is cleaned up in one pass
  the next time that agent's config is written, for every writer that
  persists to disk. Kiro, Antigravity and Pi gained this cleanup for the
  first time; they never had it, even for the prior rename.
* `codex_cli.rs`, `opencode_config.rs`, and `claude_invocation.rs`'s
  `mcp_config()` build their config fresh per invocation, so no migration
  applies there — the very next run already uses the new key.
* The Linux stable-extraction dir
  (`<data_dir>/tolaria/mcp-server` → `<data_dir>/rhizome/mcp-server`) is
  self-managed and self-healing: a leftover old-named directory becomes a
  few MB of orphaned, unread disk space, not a correctness issue.
* **Anyone whose external agent config allowlists `mcp__tolaria__*`
  explicitly** (rather than trusting the app's own registration) needs to
  update that allowlist by hand after upgrading. One-time, documented here;
  not a blocker, since the app's own `--allowedTools`/`--tools` flags are
  generated fresh per invocation and always match.
* Current localStorage reads/writes go through `rhizome:*` keys; a value
  under `tolaria:*` (or, for `useVaultConfig.ts`, `laputa:vault-config:*`)
  is still read as a fallback, so no local preference silently resets.
* **Deep links should now actually work** — this is the one change in the
  series that fixes previously-broken behavior rather than renaming
  functioning code. Native confirmation (open a `rhizome://` link, observe
  the app handle it) is still outstanding; see the open native-QA item.
* `docs/CROSS-MODEL-HANDOFF.md` §6 ("Two separate 'Tolaria' residues")
  gains this as closed instances alongside what's still deliberately
  `Tolaria`/`tolaria` (`STALE_AGENTS_MD` et al. — exact-match fingerprints,
  not identity strings; `tolaria.md` — the live domain) and the newly
  identified out-of-scope items above.
