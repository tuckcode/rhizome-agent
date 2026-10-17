# Public preview

A coding harness that doesn't forget. Rhizome runs its own agent loop on any model, free ones included, and keeps what matters as plain Markdown in a vault you own. You can switch Chat to [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent). Prime is the current Chat default.

This page is the install and recovery guide. Developer commands live in [`GETTING-STARTED.md`](GETTING-STARTED.md).

## What this preview includes

| | Included | Not included |
|---|---|---|
| Platform | macOS, from source or from an app you already built | A signed download. Windows as a daily driver. A verified Linux install for a stranger. |
| Language | English | Other languages |
| Chat | Rhizome's own engine. Prime if you switch to it. Native chat works without Prime. | Prime or Node bundled inside the app. Hermes as a usable engine. Agent search of the vault or old Mycelium sessions. |
| Notes | Open a local vault, save a note, reopen the same file, read and diff notes | A remote starter vault |
| Layout | Chat opens on launch. Left rail: sessions, Views (Research, Graph, Mycelium, History), Settings. Notes and Changes sit in the sidebar. Show Notes, the View menu, or Cmd+2 still open Notes. Views use Ctrl+Cmd+1–4 on Mac and Ctrl+Shift+1–4 on Windows. | Portfolio, Today, kanban, or extra destinations |
| Theme | Earth dark (default), Earth light, Loam, and Match system | |
| Models | Free tier (auto), plus catalog providers you add a key for | The name Taproot (that rename is not on main) |
| Keys | System keychain (macOS Keychain, Windows Credential Manager, or Secret Service) | A JSON key file you edit by hand |
| Updates | Replace the `.app`, or rebuild from source | An in-app updater |

The app reports version `0.1.0`. That number is the bundle version, not a promise about every macOS release.

## Install from source

These tools have to be on the machine before the app will build:

1. macOS, with Xcode Command Line Tools.
2. Node.js `^20.19.0` or `>=22.12.0`. Vite 7 refuses older Node.
3. pnpm.
4. Rust `1.77.2` or newer.
5. git.
6. Prime Agent on `PATH` only if you keep the default Prime Chat engine. Native chat does not need it.

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs this repo and fetches Prime Agent when that program is not already on the machine. Settings still starts Chat on Prime until you switch **Chat engine**. The script downloads the command-line tool Prime publishes.

`prime-agent` on macOS stops when that terminal closes. To leave the daemon running:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

Quit `/Applications/Rhizome.app` before `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, and a second launch attaches to the one that is already open.

To look at the interface without a live engine:

```bash
pnpm dev
```

Open http://localhost:5202. The dev server does not use port 5173.

## First minute

1. The first launch may ask **Help improve Rhizome**. Telemetry is explained below. Graphite is the default theme.
2. Chat opens. Notes stay closed until you show them. Views sit on the left rail.
3. You can create a local vault or open a folder you already have. Nothing is cloned from the network unless you set `RHIZOME_GETTING_STARTED_REPO_URL`.
4. Send one message. On Rhizome's engine you should get an answer, a notice if a non-fatal error occurred, or a clear failure. Prime-targeted chats fail clearly when Prime is missing, the provider login expired, or the connection dropped.
5. Show Notes, open or create a note, save, quit, and reopen the same file.

## If something fails

| What you see | What to do |
|---|---|
| Prime is missing | Switch **Chat engine** to Rhizome's engine, or install Prime, run `prime-agent` once, start the daemon, then reopen Chat. |
| Prime is installed and Chat still says it is missing | Wait a few seconds. The status check repeats. Or switch to Rhizome's engine. |
| Provider or login failure | Settings → AI Agents. Native keys go in the system keychain. Prime owns Prime login. |
| macOS blocks the vault folder | Grant access to Documents, Desktop, or Downloads, or move the vault. |
| No network, or no model | Notes on disk still open. Chat cannot answer. |
| The red window button | It quits, unless **Keep in taskbar** is on. Then it hides. Cmd+Q quits. |
| The window is gone | Click the Dock icon. |

Notes live in the vault folder you opened. Native chat logs live in the app config folder (`com.rhizome.app/native-sessions`). Prime transcripts live under `~/.prime/agent/sessions/` when you use that engine. Rhizome settings prefer `~/.config/com.rhizome.app/settings.json`.

## Permissions

The macOS app asks for:

- Local network, so it can reach a model server you configure.
- Documents, Desktop, and Downloads, so it can open a vault stored there.

It does not ask for the microphone, the camera, or accessibility.

Prime tools and packages you install can use the machine. A vault is not a sandbox for those tools. Settings → AI Agents → Advanced Prime engine says that those packages have full system access.

## Telemetry

**Help improve Rhizome** is the first-run choice.

- Accept turns on crash reports and usage analytics.
- Decline turns both off.
- You can change either one later in Settings → Telemetry.

Crash reports leave the machine only when crash reporting is on and the build contains a Sentry DSN. Usage analytics leave the machine only when analytics are on and the build contains a PostHog key. A build without those keys stores the toggles and sends nothing through those clients.

Analytics do not record the page, do not record the session, and do not use autocapture. The settings copy says the events omit vault content, note titles, and file paths.

## License

AGPL-3.0-or-later. See [LICENSE](../LICENSE).

Rhizome is a modified version of Rhizome Desktop, which builds on [Tolaria](https://github.com/refactoringhq/tolaria) by Luca Rossi (AGPL-3.0). The Mycelium view embeds Mindwalk (MIT) © 2026 Ricko Yu.

This page is a product description, not legal advice.
