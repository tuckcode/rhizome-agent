# Public preview — install, scope, and recovery

**Origin:** Cursor Grok 4.6 · Lane I · 2026-09-20.
**Stamps:** local product checkpoint `4f9b4c4` (**unpushed**); `origin/main`
`dc44d84`; planning local `bcd4b87` (**unpushed**); installed app still
documented `6860762`. **C76** source is in this commit series.
**Not a release.** This file describes the advertised macOS preview. It
does not authorize repository publication, a signed download, or a
rebuild.

Developer commands stay in [`GETTING-STARTED.md`](GETTING-STARTED.md).
Parked ideas stay in
[`plans/2026-09-20-public-readiness-inventory.md`](plans/2026-09-20-public-readiness-inventory.md).
A row there is a retained idea, not implementation approval.

## What this preview supports

Claim only this scope until a later native matrix says otherwise:

| Area | Supported now | Not claimed |
|---|---|---|
| Platform | macOS source or an already-installed `.app` | Windows daily driver (#32). Linux source/build exists; it is not a verified stranger install. |
| Language | English | Localization (C18) |
| Chat | Prime Agent harness, optional vault | Self-contained app with Prime/Node bundled (#26) |
| Notes | Open a local vault, save a note, reopen it | Remote starter vault (C11), list-row `import_jsonl` (waits for `1`) |
| Layout | Chat on launch. Notes from **Show Notes** / View / Cmd+2. Four presets in ADR-0173 | Portfolio, Today, kanban, vault pop-out, extra rail destinations |
| Updates | Replace the `.app` or rebuild from source | In-app updater. `createUpdaterArtifacts` is false and updater endpoints are empty. |

The installed bundle on this machine reports version `0.1.0` and
`LSMinimumSystemVersion` `10.13`. That is a bundle floor, not a tested
daily-driver matrix. Record the actual macOS version and CPU when a
clean-account run happens.

Windows remains deferred. Do not ship or document a Windows first launch
from this preview.

## Quick start (source preview)

These steps were checked against current source and this machine's
toolchain on 2026-09-20. They were **not** run in a fresh OS account.
A stranger-install dogfood is still open (NEXT priority 4).

Checked here: Node `v22.22.3`, pnpm `11.9.0`, Rust `1.98.0`,
`prime-agent` `0.9.3` on `PATH`, Vite engines `^20.19.0 || >=22.12.0`,
Vite port `5202` in `vite.config.ts`.

### 1. Prerequisites

1. macOS with Xcode Command Line Tools.
2. **Node.js** `^20.19.0` or `>=22.12.0`. Vite 7 refuses older Node.
   `GETTING-STARTED.md` used to say Node 18+; that is wrong for `pnpm
   dev` / `pnpm tauri dev`.
3. **pnpm** (this repo has no `packageManager` pin; 11.x works here).
4. **Rust** `1.77.2` or newer (`src-tauri/Cargo.toml`).
5. **git**.
6. **Prime Agent** on `PATH`. The app does not vendor it.

```bash
npm i -g prime-agent
prime-agent          # first-run login / provider setup
# On macOS/Linux the daemon dies with the terminal that started it:
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

Missing Prime is a truthful first-minute state. The Chat subhead says
`Prime is not installed — run npm i -g prime-agent` after a second
status poll (C64). Do not treat a brief Starting… flash as that copy.

### 2. Run from source

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
# This repository is private. Clone fails without access.
pnpm install
pnpm tauri dev
```

Browser-only UI (mock Tauri, no live Prime chat):

```bash
pnpm dev
# Open http://localhost:5202
# Not 5173. Vite pins 5202. Playwright's own default is 5201 if BASE_URL is unset.
```

Quit `/Applications/Rhizome Agent.app` before `pnpm tauri dev`. Both
binaries share `ai.rhizome.agent`. A second launch forwards to the first
(C65).

### 3. First minute

1. First launch may ask **Help improve Rhizome**. See Telemetry below.
2. Chat opens. Notes stay closed (ADR-0173).
3. Optional: Welcome can create a **local** scaffold vault (folders and
   type documents only, no network) or open an existing folder. A remote
   clone happens only when `RHIZOME_GETTING_STARTED_REPO_URL` is set.
   Old `TOLARIA_*` / `LAPUTA_*` names are not read.
4. Send one prompt. Expect an answer or an actionable failure (missing
   Prime, expired provider, transport loss). A thinking fold that never
   answers is a live P1 sample, not a documented success.
5. Show Notes, create or open a note, save, quit, reopen the same file.

Installed-app path, when you already have a build:

```text
/Applications/Rhizome Agent.app
```

Documented stamp: **`6860762`**, 2026-09-19 11:27. That build is behind
`4f9b4c4`. The bundle itself only reports `0.1.0`. Rebuild is a separate
verb and waits for Atticus.

## Recovery

| Situation | What to do |
|---|---|
| Prime missing | Install with `npm i -g prime-agent`, run `prime-agent` once, start the daemon detached, reopen Chat. |
| Prime installed but Chat says so | Wait one extra poll (~4s). Watch the first two seconds of three launches before calling C64 a regression. |
| Provider / auth failure | Settings → Agents. Prime owns OAuth/API login for the Chat path. Recover the draft; do not send again until the status is distinct. |
| Folder permission denied | macOS may ask for Documents, Desktop, or Downloads. Those usage strings are required. A vault in a protected folder can kill the Prime worker with `EPERM` on `cwd` (C53). Move the vault or grant access. |
| Offline / no model | Notes remain local files. Chat cannot invent a reply. The app must stay usable for existing notes. |
| Red window button | **Hides.** It does not quit. Cmd+Q quits. |
| Hide vs helpers | Hide stops the app-owned **ws-bridge** and **Mindwalk**. The spawned Prime daemon stays warm (C75). A warm daemon is not proof that a session is still working. |
| Keep working | Marks the session resident. It does not change the hide helper list. |
| Lost window | Click the Dock icon or tray. `focus_main_window` unhides the app, then the window. |
| Revert the app | Quit, replace `/Applications/Rhizome Agent.app` with the previous bundle, or check out an older commit and rebuild. There is no working in-app updater. |
| Notes | Live in the vault folder you opened. Git, if you enabled it, is that folder's repository. |
| Chat transcripts | Prime owns `~/.prime/agent/sessions/<id>.jsonl`. Rhizome archive is a view. It does not rewrite Prime's files. |
| Rhizome settings | Preferred path `~/.config/com.rhizome.app/settings.json`. Legacy `com.tolaria.app` / `com.laputa.app` are still read if present. |

Do not send Prime `shutdown` from hide. Do not use HOME as a vault
(#46). Chat without a vault is intended.

## Permissions

The macOS Info.plist declares:

- **Local network** — connect to local model servers you configure.
- **Documents / Desktop / Downloads** — open a vault stored there.

The app does not declare microphone, camera, or accessibility usage.
Global hotkey, screen capture, and voice stay parked (#52 job 2).

Prime tools and installed packages can use the machine. Vault scope is
**not** a general Prime sandbox. Settings → Packages says those
packages have full system access. Confirm once.

## Telemetry

First-run dialog: **Help improve Rhizome**. Copy talks about anonymous
crash reports. **Accept also sets `analytics_enabled: true`.** Decline
sets both crash reporting and analytics off. Change either later in
Settings → Telemetry.

Runtime gates, from current code:

- Crash reporting starts only when `crash_reporting_enabled === true`
  **and** a Sentry DSN was baked in at build (`SENTRY_DSN` /
  `VITE_SENTRY_DSN`).
- Usage analytics start only when `analytics_enabled === true` **and**
  `VITE_POSTHOG_KEY` is present. Default host is `https://us.i.posthog.com`.
- PostHog: `autocapture` off, pageview off, session recording off,
  memory persistence.
- Events use an anonymous id. Settings copy says no vault content, note
  titles, or file paths. Native Sentry scrubs paths and a token list;
  frontend redaction is separate and not complete for every prefix.

If the build has no DSN or PostHog key, the toggles save and nothing
leaves the machine through those clients.

## #56 — honest exception

Chat's default path is Prime. Settings still contains a reachable
**direct API-model** path (`ai_models.rs`, `api_model` targets,
Research/Distill fallback). That path can run without Prime. ADR-0168
must not be cited as settled. Keep / remove / amend waits for Atticus.
Findings:
[`plans/handoffs/2026-09-14-1602-issue-56-findings.md`](plans/handoffs/2026-09-14-1602-issue-56-findings.md).

## License and attribution (inventory, not a legal determination)

This is a completeness check. It is **not** legal advice and not a
publication clearance.

| Item | Present | Gap |
|---|---|---|
| Root `LICENSE` | GNU AGPL v3 text | README still says confirm before a public `tuckcode` release. That confirmation has not happened. |
| `package.json` / `Cargo.toml` | `AGPL-3.0-or-later` | Cargo `authors` still lists the Desktop snapshot author. |
| GitHub license metadata | `agpl-3.0` on the private repo | Repository is private. Visibility change is a separate approval. |
| Mindwalk / Mycelium | UI footer: Mindwalk (MIT) © 2026 Ricko Yu | No root `NOTICE` / `THIRD_PARTY` file. |
| Brand / organic artwork | In-repo brand docs | No separate attribution file for inherited Desktop assets. |
| Distributed npm / crates | Lockfiles record versions | No generated NOTICE of bundled dependency licenses. |
| `SECURITY.md` | Asks for GitHub private vulnerability reporting | Live `gh` repo payload has `security_and_analysis: null`. Do not assume the private-report channel is on. |

Do not treat this table as permission to publish.

## Draft documentation PRs

- 17 open issues, same set as the inventory (`#5` `#13` `#23` `#26`
  `#32` `#36` `#39` `#40` `#41` `#45` `#46` `#48` `#50` `#51` `#52`
  `#56` `#57`).
- Drafts **#66**, **#67**, **#68** were closed 2026-09-21. Their hide
  sentences that stop spawned Prime predate C75. Do not reopen them
  to merge. C75 wording now lives in `ARCHITECTURE.md` and
  `CROSS-MODEL-HANDOFF.md` §21 / §25.

## Still unverified

- Clean-account first run.
- Native matrix on `4f9b4c4` (installed app is still `6860762`).
- Incomplete streamed history display (C76, coordinator).
- Live thinking / no-answer sample.
- #46 aliases and no-vault Chat on a native build.
- Publication security scan and history secret scan (Lane S).
