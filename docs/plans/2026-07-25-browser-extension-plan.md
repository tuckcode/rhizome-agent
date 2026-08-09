# Browser extension — build plan (2026-07-25)

**Start here in a fresh session.** This doc is written to be read cold. It
assumes no memory of the session that produced it.

Read first: `docs/CROSS-MODEL-HANDOFF.md` (traps), then `docs/HANDOFF.md`
(current state). This file is the extension build only.

---

## What this is

A Chrome/Firefox extension that saves web pages into the user's Rhizome
vault. Modelled on **GatherOS** (`/Applications/GatherOS.app`), whose popup
the user pointed at as the reference UX:

| GatherOS popup item | Rhizome v1 |
|---|---|
| Capture page / full page / area | **Skip.** Rhizome is a knowledge vault, not a screenshot tool. |
| Save URL — "This page as a link" | **Yes.** Core action. |
| Import bookmarks / Import saved | **Reframed** as "Distill this page" — pull article text through `rhizome_distill` instead of only storing a link. |
| "Open GatherOS" + green "is open" dot | **Yes.** Same pattern, same value: the dot tells you whether the desktop app is reachable. |

User's words on scope: *"your ideas to broaden it even more for rhizome
sound great"* — i.e. Save URL + Distill, not screenshot capture.

## Transport — decided, already de-risked

The extension talks to the **running desktop app** over the existing
WebSocket bridge at `ws://localhost:9711`. Do **not** invent a new channel.

- That bridge is live and proven — see `CROSS-MODEL-HANDOFF.md` §2. It was
  verified at runtime with `lsof -i:9711` showing `ws-bridge.js` LISTENING
  with two established client connections.
- `mcp-server/ws-bridge.js` is spawned by Rust (`src-tauri/src/lib.rs`
  ~line 266). Its `startUiBridge()`/`startBridge()` are called by the
  file's own self-invoking entrypoint at `ws-bridge.js:268`, **not** by an
  importer — do not conclude they are dead from a grep.
- **Chrome MV3 risk was spiked and cleared.** A service worker can hold a
  WebSocket to localhost. No HTTP-fallback fork is needed. This was the
  single biggest architectural unknown and it is resolved.

Consequence: the extension only works while Rhizome is running. That is
the same constraint GatherOS has, and the connection dot exists precisely
to make it legible. Accepted deliberately.

## Prerequisites — DONE, do not redo

Both landed and are pushed (`origin/main` @ `cfc4b1ac`):

- **`9f36711e`** — hardcoded `trigger` at three dispatch sites. All three now
  route through one `build_verb_call(name, args) -> Result<VerbCall, String>`
  resolver in `src-tauri/src/rhizome_jobs.rs`. **This was a live bug**:
  `sessionAutoDistill.ts:84` and `MenuBarCompanionApp.tsx:79,109` were
  sending real triggers that got overwritten as `"manual"` in
  `.rhizome/events.jsonl`. The extension needs `trigger: "browser_extension"`
  to survive, which it now does — there are tests asserting exactly that
  string.
- **`f3aad805`** — bare-URL inbox drops imported by file path instead of by
  URL, so the URL was never fetched. Dead from the day it was written.
  Matters here because "Save URL" may land as a bare-URL `.txt` in
  `raw/inbox/`. Note `file_is_bare_url` is stricter than it looks:
  whole-file, no interior whitespace, literal `http://`/`https://` prefix.

## Remaining commit sequence (3 → 19)

Commit 4 is the next action. Commits 1–2 were the prerequisites above;
commit 3 landed 2026-07-25.

**3. `inbox_action` frontmatter contract + ADR — DONE.**
Shipped as **ADR-0158**, not 0161: this doc guessed a number, and 0157 was
still the highest on disk when the work started (commits 1–2 added no ADRs).
Use `ls docs/adr/` for the next free number rather than the numbers sketched
here.
New module `src-tauri/src/inbox_action.rs`: `InboxAction { Save, Distill,
Import }` parsed from an `inbox_action:` frontmatter key, declared action
beats `classify_inbox_file`'s extension heuristic, unknown value falls back
to it. `InboxAction` **replaced** `inbox_watcher::InboxKind` (one enum for
the routing decision, not two). `save_captured_file` is the save-only
lane — files the capture as a Document via
`rhizome_import::write_imported_document`, no agent call, logs a
`type:"capture"` event carrying the caller's `trigger` verbatim. That
`trigger` param is the seam commits 4–7 push `"browser_extension"` through.
Docs updated: `VAULT_CONTRACT.md`, `ARCHITECTURE.md` (Alpha-3 section).

**4–6. The bridge — DONE 2026-07-25. The transport premise in this doc was
wrong; read this before trusting §"Transport" above.**

`ws://localhost:9711` is a **broadcast relay**, not a tool bridge — it
dispatches no verbs. `9710`, the real tool bridge, rejected *every* browser
client by design (`ws-bridge.js`: `bridgeType === 'tool' && origin`), and
9711's allowlist would not have taken a `chrome-extension://` origin either.
The MV3 spike cleared the **client** side (a service worker can hold a
WebSocket); nobody checked whether the server accepts one. It did not.

- **4 (`484caf3f`)** — `rhizome_save_capture` verb + `CaptureRequest` /
  `save_capture` field-based entry point, so a capture does not have to go
  through `raw/inbox/`. It must not: per `CROSS-MODEL-HANDOFF.md` §12 the
  inbox watcher is explicitly disabled on every pre-existing vault, so an
  extension routed that way would write a file and silently do nothing.
- **5 (`289280f9`, ADR-0159)** — browser-extension origins may now reach the
  tool bridge, but dispatch nothing until they send `bridge_auth` with a
  token. `settings::ensure_bridge_token()` generates a 32-hex UUIDv4 once
  per install; `spawn_ws_bridge_with_paths` passes it as
  `RHIZOME_BRIDGE_TOKEN`. No token → extensions refused (fails closed).
- **6** — `rhizome_save_capture` exposed on the bridge, fulfilled by the
  `rhizome-tool` sidecar. Verified end to end against a temp vault: a real
  card written, `trigger:"browser_extension"` in `.rhizome/events.jsonl`.
  **Dev-only:** `RHIZOME_TOOL_PATH` resolves the sidecar beside the running
  exe, which holds in `pnpm tauri dev` but not in a packaged build (needs
  Tauri `externalBin`, MCP bridge Phase 3). Deliberate — see below.

**7. Not built: Settings UI to show the user their bridge token.**
Nothing surfaces `bridge_token` yet, so pairing an extension means reading
`settings.json` by hand. Needs UI + `en.json` copy (English only, LARA
unfunded).

**8–19. Extension surface.**
Manifest V3, service worker, popup UI (mirror the GatherOS layout above),
connection-status dot, Save URL, Distill this page, options page.

Sequence 8–19 was not decomposed commit-by-commit in the originating
session. Decompose it at the start of the next one, once 3–7 are real.

## Constraints that bite here

1. **New build target.** The extension is its own directory and its own
   build output. It is NOT part of the Vite app bundle. Decide where it
   lives (suggest `extension/`) in commit 3 and keep it out of
   `knip.json`'s entry points until it has real entrypoints, or knip will
   report the whole tree as unused.
2. **Localization.** Any user-facing string in the popup must go in
   `src/lib/locales/en.json` per AGENTS.md. LARA is unfunded — see
   `CROSS-MODEL-HANDOFF.md` §10. Say "English only, LARA unfunded" in the
   completion note rather than implying the l10n gate passed.
3. **PostHog.** A new user-facing surface needs events. `browser_extension`
   as trigger gives server-side visibility; the popup itself still wants
   its own events for discovery/adoption.
4. **Coverage gate.** Rust ≥85%, frontend ≥70%. If `cargo llvm-cov
   --no-clean` reports a FAILURE, re-run clean before believing it —
   `CROSS-MODEL-HANDOFF.md` §13. A `--no-clean` pass is trustworthy; a
   failure is not.
5. **Pushing needs LLVM env vars.** No `rustup` on this machine:
   ```bash
   export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov" \
          LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
   ```
   Without them `git push` dies at gate 4/6. Same root cause as the
   `cargo llvm-cov` failure.

## Next action

The whole backend lane is done and verified end to end. Next is commit 7
(Settings UI for the bridge token — without it nobody can pair an
extension) and then 8–19, the extension itself.

Decompose 8–19 at the start of that session. The extension's contract with
the app is now fixed and small: connect to `ws://localhost:9710`, send
`{ id, tool: "bridge_auth", args: { token } }`, then
`{ id, tool: "rhizome_save_capture", args: { vaultPath?, source, title?,
context?, text? } }`. Trigger is set by the bridge, not the extension.
