# Getting started

This is a macOS developer preview. There is no signed download. Prime Agent and Node are not bundled. Chat on Rhizome's own engine does not need Prime.

You need:

1. macOS, with Xcode Command Line Tools.
2. Node.js `^20.19.0` or `>=22.12.0`.
3. pnpm.
4. Rust `1.77.2` or newer, and the Tauri toolchain.
5. git.

```bash
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
./install.sh
pnpm tauri dev
```

`./install.sh` installs this repo and fetches Prime Agent when that program is not already on the machine. Settings still starts Chat on Prime until you switch **Chat engine** to Rhizome's own engine. Native chat does not need Prime. The script still downloads the Prime command-line tool because that default is Prime.

The first launch of `prime-agent` asks you to run `/login` and choose a provider. Skip that if you use Rhizome's engine and add a provider key in Settings. Keys live in the system keychain.

`prime-agent` stops when that terminal closes. To leave it running (only if you use the Prime engine):

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

Quit `/Applications/Rhizome.app` before `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, and a second launch attaches to the one already open.

To look at the interface without a live engine: `pnpm dev`, then http://localhost:5202.

## First minute

1. The first launch may ask **Help improve Rhizome**. You can decline. Telemetry stays off until you accept, and a build without a Sentry or PostHog key sends nothing. Graphite is the default theme. Earth dark, Earth light, Loam, Mycelium, and Match system (on Earth) are in Settings.
2. Chat opens. The sessions list opens with it on a first launch. The left rail holds sessions, Views (Research, Graph, Mycelium, History), and Settings. Changes sits next to Notes. Views use Ctrl+Cmd+1–4 on Mac and Ctrl+Shift+1–4 on Windows.
3. Create a local vault, or open a folder you already have.
4. Send one message. On Rhizome's engine you should get an answer, a notice if a non-fatal error occurred, or a clear failure (no provider key, for example). Prime-targeted chats still need Prime installed.
5. Show Notes (View menu, or Cmd+2). Save a note, quit, and reopen the same file.

Notes live in the vault folder you opened. You can read and diff them in the app. The agent cannot search the vault or old Mycelium sessions yet. Mycelium replays builds.

Native chat logs live in the app config folder (`com.rhizome.app/native-sessions`). Prime transcripts live under `~/.prime/agent/sessions/` when you use that engine.

If something fails, the longer recovery page is [`docs/PUBLIC-PREVIEW.md`](../PUBLIC-PREVIEW.md). Ports and tests are in [`docs/GETTING-STARTED.md`](../GETTING-STARTED.md).
