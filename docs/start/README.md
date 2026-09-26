# Getting started

This is a macOS developer preview. There is no signed download. Prime Agent and Node are not bundled.

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

`./install.sh` installs this repo and fetches Prime Agent when that program is not already on the machine. Chat needs Prime. The script downloads the command-line tool Prime publishes. There is no smaller copy inside Rhizome.

The first launch of `prime-agent` asks you to run `/login` and choose a provider.

`prime-agent` stops when that terminal closes. To leave it running:

```bash
(prime-agent --mode daemon >/dev/null 2>&1 &) && sleep 2 && prime-agent status
```

Quit `/Applications/Rhizome Agent.app` before `pnpm tauri dev`. Both use the bundle id `ai.rhizome.agent`, and a second launch attaches to the one already open.

To look at the interface without a live Prime session: `pnpm dev`, then http://localhost:5202.

## First minute

1. The first launch may ask **Help improve Rhizome**. You can decline. Telemetry stays off until you accept, and a build without a Sentry or PostHog key sends nothing.
2. Chat opens. The sessions list opens with it on a first launch.
3. Create a local vault, or open a folder you already have.
4. Send one message. You should get an answer, or a clear failure: Prime is missing, the provider login expired, or the connection dropped.
5. Show Notes (View menu, or Cmd+2). Save a note, quit, and reopen the same file.

Notes live in the vault folder you opened. Chat transcripts live with Prime, under `~/.prime/agent/sessions/`.

If something fails, the longer recovery page is [`docs/PUBLIC-PREVIEW.md`](../PUBLIC-PREVIEW.md). Ports and tests are in [`docs/GETTING-STARTED.md`](../GETTING-STARTED.md).
